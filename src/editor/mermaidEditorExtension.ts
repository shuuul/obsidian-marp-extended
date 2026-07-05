import { setIcon, type App } from 'obsidian';
import { Prec, StateEffect, StateField, type EditorState } from '@codemirror/state';
import {
	Decoration,
	type DecorationSet,
	EditorView,
	WidgetType,
} from '@codemirror/view';

import type { MarpExtendedSettings } from '../utilities/settings';
import { parseMermaidFenceInfo, renderMermaidFigure } from '../utilities/mermaid';
import { getMermaidThemeName, loadMermaidThemeCssByName } from '../utilities/mermaidTheme';

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
	const fencePattern = /^```([^\n]*)\n([\s\S]*?)^```[ \t]*$/gm;
	let match: RegExpExecArray | null;

	while ((match = fencePattern.exec(markdown)) !== null) {
		if (match.index < frontmatterEndOffset) {
			continue;
		}

		const info = match[1];
		const { language, alt } = parseMermaidFenceInfo(info);
		if (language !== 'mermaid') {
			continue;
		}

		const sourceFrom = match.index + match[0].indexOf('\n') + 1;
		ranges.push({
			from: match.index,
			to: match.index + match[0].length,
			sourceFrom,
			info,
			source: match[2],
			alt,
		});
	}

	return ranges;
}


class MermaidWidget extends WidgetType {
	constructor(
		private readonly app: App,
		private readonly source: string,
		private readonly alt: string,
		private readonly themeName: string,
		private readonly sourceFrom: number,
	) {
		super();
	}

	eq(other: MermaidWidget): boolean {
		return this.source === other.source
			&& this.alt === other.alt
			&& this.themeName === other.themeName
			&& this.sourceFrom === other.sourceFrom;
	}

	toDOM(view: EditorView): HTMLElement {
		const root = view.dom.ownerDocument.createElement('div');
		root.className = 'marp-extended-editor-mermaid';

		const editButton = view.dom.ownerDocument.createElement('button');
		editButton.className = 'marp-extended-editor-mermaid-source-button';
		editButton.type = 'button';
		editButton.setAttribute('aria-label', 'Show Mermaid source');
		editButton.setAttribute('title', 'Show Mermaid source');
		setIcon(editButton, 'code');
		editButton.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			view.focus();
			view.dispatch({
				selection: { anchor: Math.min(this.sourceFrom, view.state.doc.length) },
				scrollIntoView: true,
			});
		});
		root.appendChild(editButton);

		const style = view.dom.ownerDocument.createElement('style');
		style.className = 'marp-extended-editor-mermaid-theme';
		root.appendChild(style);

		const section = view.dom.ownerDocument.createElement('section');
		section.className = 'marp-extended-editor-mermaid-scope';
		try {
			// eslint-disable-next-line no-unsanitized/method -- renderMermaidFigure returns locally generated beautiful-mermaid SVG markup.
			const fragment = view.dom.ownerDocument.createRange().createContextualFragment(renderMermaidFigure(this.source, this.alt));
			section.appendChild(fragment);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const errorBlock = view.dom.ownerDocument.createElement('pre');
			errorBlock.className = 'mermaid-render-error';
			const code = view.dom.ownerDocument.createElement('code');
			code.textContent = message;
			errorBlock.appendChild(code);
			section.appendChild(errorBlock);
		}
		root.appendChild(section);

		void loadMermaidThemeCssByName(this.app, this.themeName)
			.then((css) => {
				style.textContent = css;
			})
			.catch((error: unknown) => {
				console.error('Marp Extended: Mermaid editor theme load failed', error);
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
				widget: new MermaidWidget(app, range.source, range.alt, themeName, range.sourceFrom),
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
