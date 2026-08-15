import { setIcon, type App } from 'obsidian';
import { Prec, StateEffect, StateField, type EditorState } from '@codemirror/state';
import {
	Decoration,
	type DecorationSet,
	EditorView,
	WidgetType,
} from '@codemirror/view';

import { closingCodeFence, openingCodeFence, type CodeFence } from '@marp-extended/code-fence-scanner';
import { parseMermaidFenceInfo } from '../runtime/mermaidShared';
import type { MarpExtendedSettings } from '../utilities/settings';
import { renderMermaidFigure } from '../utilities/mermaid';
import {
	getMermaidThemeName,
	loadMermaidThemeCssByName,
	parseMermaidRenderOptionsFromCss,
} from '../utilities/mermaidTheme';

declare global {
	interface Window {
		createDiv(o?: string | { cls?: string; text?: string; attr?: Record<string, string | number | boolean | null>; title?: string }): HTMLDivElement;
		createSpan(o?: string | { cls?: string; text?: string; attr?: Record<string, string | number | boolean | null>; title?: string }): HTMLSpanElement;
		createEl<K extends keyof HTMLElementTagNameMap>(
			tag: K,
			o?: string | { cls?: string; text?: string; attr?: Record<string, string | number | boolean | null>; title?: string }
		): HTMLElementTagNameMap[K];
	}
}

export type MermaidFenceRange = {
	from: number;
	to: number;
	sourceFrom: number;
	info: string;
	source: string;
	alt: string;
};

export const refreshMermaidEditorDecorations = StateEffect.define<void>();

export function resolveEditorMermaidTheme(markdown: string, settings: MarpExtendedSettings): string {
	return getMermaidThemeName(markdown) || settings.MERMAID_EDITOR_THEME || 'kami';
}

function getFrontmatterEndOffset(markdown: string): number {
	const match = markdown.match(/^---\s*\n[\s\S]*?\n---\s*(?:\n|$)/);
	return match?.[0].length ?? 0;
}

export function findMermaidFenceRanges(markdown: string): MermaidFenceRange[] {
	const ranges: MermaidFenceRange[] = [];
	const frontmatterEndOffset = getFrontmatterEndOffset(markdown);
	const lines = markdown.split('\n');
	let offset = 0;
	let active: {
		from: number;
		fence: CodeFence;
		info: string;
		sourceFrom: number;
	} | null = null;

	for (const [index, line] of lines.entries()) {
		const lineStart = offset;
		const lineEnd = lineStart + line.length;
		const hasNewline = index < lines.length - 1;

		if (lineStart < frontmatterEndOffset) {
			offset = lineEnd + (hasNewline ? 1 : 0);
			continue;
		}

		if (active) {
			if (closingCodeFence(line, active.fence)) {
				const { language, alt } = parseMermaidFenceInfo(active.info);
				if (language === 'mermaid') {
					ranges.push({
						from: active.from,
						to: lineEnd,
						sourceFrom: active.sourceFrom,
						info: active.info,
						source: markdown.slice(active.sourceFrom, lineStart),
						alt,
					});
				}
				active = null;
			}
		} else if (hasNewline) {
			const opening = openingCodeFence(line);
			if (opening) {
				const markerStart = line.indexOf(opening.marker);
				active = {
					from: lineStart,
					fence: opening,
					info: line.slice(markerStart + opening.length),
					sourceFrom: lineEnd + 1,
				};
			}
		}

		offset = lineEnd + (hasNewline ? 1 : 0);
	}

	return ranges;
}


const MERMAID_MIN_SCALE = 0.1;
const MERMAID_MAX_SCALE = 2;
const MERMAID_SCALE_STEP = 0.25;
const MERMAID_WHEEL_SCALE_SENSITIVITY = 0.006;

function clampMermaidScale(scale: number): number {
	return Math.min(MERMAID_MAX_SCALE, Math.max(MERMAID_MIN_SCALE, scale));
}

function getMermaidDiagramSize(svg: SVGSVGElement): { width: number; height: number } {
	const rawWidth = svg.getAttribute('width') ?? '';
	const rawHeight = svg.getAttribute('height') ?? '';

	// Ignore percentage widths (e.g. 100% used in official Mermaid renderer) and check viewBox
	if (!rawWidth.includes('%') && !rawHeight.includes('%')) {
		const width = Number.parseFloat(rawWidth);
		const height = Number.parseFloat(rawHeight);
		if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
			return { width, height };
		}
	}

	const viewBox = svg.viewBox?.baseVal;
	if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
		return { width: viewBox.width, height: viewBox.height };
	}

	const rect = svg.getBoundingClientRect();
	return {
		width: rect.width > 0 ? rect.width : 800,
		height: rect.height > 0 ? rect.height : 400,
	};
}

function enhanceMermaidDiagram(section: HTMLElement, figure: HTMLElement, doc: Document): void {
	const svg = figure.querySelector<SVGSVGElement>('svg');
	if (!svg) {
		section.appendChild(figure);
		return;
	}

	const size = getMermaidDiagramSize(svg);
	// Guarantee viewBox exists so browser can scale contents properly
	if (!svg.getAttribute('viewBox')) {
		svg.setAttribute('viewBox', `0 0 ${size.width} ${size.height}`);
	}

	const scroll = section.createDiv({ cls: 'marp-extended-mermaid-scroll' });
	const zoomSurface = scroll.createDiv({ cls: 'marp-extended-mermaid-zoom-surface' });

	zoomSurface.appendChild(figure);

	const controls = scroll.createDiv({ cls: 'marp-extended-mermaid-controls' });

	let scale = 1;
	let resetButton: HTMLButtonElement | null = null;
	const getFitToWidthScale = () => {
		const viewportWidth = scroll.clientWidth > 0 ? scroll.clientWidth - 16 : 0;
		if (size.width <= 0 || viewportWidth <= 0) return 1;
		return viewportWidth / size.width;
	};

	const applyScale = () => {
		const scaledWidth = Math.ceil(size.width * scale);
		const scaledHeight = Math.ceil(size.height * scale);
		// Scale the layout box size of SVG directly to prevent transform clipping/scrollbar bugs
		svg.style.width = `${scaledWidth}px`;
		svg.style.height = `${scaledHeight}px`;

		const scaleLabel = `${Math.round(scale * 100)}%`;
		scroll.dataset.marpExtendedMermaidScale = scaleLabel;
		if (resetButton) resetButton.textContent = scaleLabel;
	};

	const setScale = (nextScale: number) => {
		scale = clampMermaidScale(nextScale);
		applyScale();
	};

	const makeButton = (label: string, ariaLabel: string, onClick: () => void, icon?: string): HTMLButtonElement => {
		const button = controls.createEl('button', {
			cls: 'marp-extended-mermaid-control-btn',
			attr: {
				type: 'button',
				'aria-label': ariaLabel,
				title: ariaLabel,
			}
		});
		if (icon) {
			button.addClass('marp-extended-mermaid-control-btn-icon');
			setIcon(button, icon);
		} else {
			button.textContent = label;
		}
		button.addEventListener('click', (event: MouseEvent) => {
			event.preventDefault();
			event.stopPropagation();
			onClick();
		});
		return button;
	};

	makeButton('−', 'Zoom out', () => {
		setScale(scale - MERMAID_SCALE_STEP);
	});
	resetButton = makeButton('100%', 'Reset zoom', () => {
		setScale(1);
	});
	makeButton('+', 'Zoom in', () => {
		setScale(scale + MERMAID_SCALE_STEP);
	});
	makeButton('', 'Fit to width', () => {
		setScale(getFitToWidthScale());
	}, 'stretch-horizontal');

	scroll.addEventListener('wheel', (event: WheelEvent) => {
		const wantsZoom = event.ctrlKey || event.metaKey;
		const hasHorizontalPan = Math.abs(event.deltaX) > 0.5;
		const hasVerticalZoom = wantsZoom && Math.abs(event.deltaY) > 0.5;
		if (!hasHorizontalPan && !hasVerticalZoom) return;
		event.preventDefault();
		event.stopPropagation();
		if (hasHorizontalPan) {
			scroll.scrollLeft += event.deltaX;
		}
		if (hasVerticalZoom) {
			const nextScale = scale * Math.exp(-event.deltaY * MERMAID_WHEEL_SCALE_SENSITIVITY);
			setScale(nextScale);
		}
	}, { passive: false });

	applyScale();
	if (doc.defaultView) {
		doc.defaultView.requestAnimationFrame(applyScale);
	}
}

class MermaidWidget extends WidgetType {
	private renderToken = 0;

	constructor(
		private readonly app: App,
		private readonly source: string,
		private readonly alt: string,
		private readonly themeName: string,
		private readonly sourceFrom: number,
		private readonly autoFitEnabled: boolean,
	) {
		super();
	}

	eq(other: MermaidWidget): boolean {
		return this.source === other.source
			&& this.alt === other.alt
			&& this.themeName === other.themeName
			&& this.sourceFrom === other.sourceFrom
			&& this.autoFitEnabled === other.autoFitEnabled;
	}

	toDOM(view: EditorView): HTMLElement {
		const doc = view.dom.ownerDocument;
		const win = doc.win;
		const root = win.createDiv({ cls: 'marp-extended-editor-mermaid' });

		const editButton = win.createEl('button', {
			cls: 'marp-extended-editor-mermaid-source-button',
			attr: {
				type: 'button',
				'aria-label': 'Show Mermaid source',
				title: 'Show Mermaid source',
			}
		});
		setIcon(editButton, 'code');
		editButton.addEventListener('click', (event: MouseEvent) => {
			event.preventDefault();
			event.stopPropagation();
			view.focus();
			view.dispatch({
				selection: { anchor: Math.min(this.sourceFrom, view.state.doc.length) },
				scrollIntoView: true,
			});
		});
		root.appendChild(editButton);

		const style = doc.createElement('style');
		style.className = 'marp-extended-editor-mermaid-theme';
		root.appendChild(style);

		const section = win.createEl('section', { cls: 'marp-extended-editor-mermaid-scope' });
		const placeholder = win.createDiv({
			cls: 'marp-extended-editor-mermaid-loading',
			text: 'Rendering Mermaid…'
		});
		section.appendChild(placeholder);
		root.appendChild(section);

		const renderToken = ++this.renderToken;
		void loadMermaidThemeCssByName(this.app, this.themeName)
			.then(async (css) => {
				if (renderToken !== this.renderToken || !section.isConnected) {
					return;
				}

				style.textContent = css;
				const renderOptions = parseMermaidRenderOptionsFromCss(css);
				const figureHtml = await renderMermaidFigure(this.source, this.alt, { renderOptions, autoFit: { enabled: this.autoFitEnabled } });
				if (renderToken !== this.renderToken || !section.isConnected) {
					return;
				}

				section.replaceChildren();
				// eslint-disable-next-line no-unsanitized/method -- renderMermaidFigure returns locally generated Mermaid SVG markup.
				const fragment = doc.createRange().createContextualFragment(figureHtml);
				const figure = fragment.firstElementChild as HTMLElement;
				if (figure) {
					enhanceMermaidDiagram(section, figure, doc);
				} else {
					section.appendChild(fragment);
				}
			})
			.catch((error: unknown) => {
				if (renderToken !== this.renderToken || !section.isConnected) {
					return;
				}

				console.error('Marp Extended: Mermaid editor theme load failed', error);
				const message = error instanceof Error ? error.message : String(error);
				const errorBlock = win.createEl('pre', { cls: 'mermaid-render-error' });
				const code = win.createEl('code', { text: message });
				errorBlock.appendChild(code);
				section.replaceChildren(errorBlock);
			});

		return root;
	}
}

function buildDecorations(state: EditorState, app: App, settings: MarpExtendedSettings): DecorationSet {
	if (!settings.MERMAID_EDITOR_RENDER) {
		return Decoration.set([]);
	}

	const markdown = state.doc.toString();
	const themeName = resolveEditorMermaidTheme(markdown, settings);
	const cursor = state.selection.main.head;
	const decorations = [];

	for (const range of findMermaidFenceRanges(markdown)) {
		if (cursor >= range.from && cursor <= range.to) {
			continue;
		}

		decorations.push(
			Decoration.replace({
				widget: new MermaidWidget(app, range.source, range.alt, themeName, range.sourceFrom, settings.MERMAID_AUTO_FIT),
				block: true,
			}).range(range.from, range.to),
		);
	}

	return Decoration.set(decorations, true);
}

export function createMermaidEditorExtension(app: App, settings: MarpExtendedSettings) {
	const field = StateField.define<DecorationSet>({
		create(state) {
			return buildDecorations(state, app, settings);
		},
		update(decorations, transaction) {
			if (
				transaction.docChanged
				|| transaction.selection
				|| transaction.effects.some((effect) => effect.is(refreshMermaidEditorDecorations))
			) {
				return buildDecorations(transaction.state, app, settings);
			}

			return decorations.map(transaction.changes);
		},
		provide(field) {
			return EditorView.decorations.from(field);
		},
	});

	return Prec.highest(field);
}
