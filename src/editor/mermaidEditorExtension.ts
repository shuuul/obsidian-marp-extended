import type { App } from 'obsidian';
import { StateField, type EditorState } from '@codemirror/state';
import {
	Decoration,
	type DecorationSet,
	EditorView,
	WidgetType,
} from '@codemirror/view';

import { parseMermaidFenceInfo, renderMermaidFigure } from '../utilities/mermaid';
import { loadMermaidThemeCssForMarkdown } from '../utilities/mermaidTheme';

export type MermaidFenceRange = {
	from: number;
	to: number;
	info: string;
	source: string;
	alt: string;
};

export function findMermaidFenceRanges(markdown: string): MermaidFenceRange[] {
	const ranges: MermaidFenceRange[] = [];
	const fencePattern = /^```([^\n]*)\n([\s\S]*?)^```[ \t]*$/gm;
	let match: RegExpExecArray | null;

	while ((match = fencePattern.exec(markdown)) !== null) {
		const info = match[1];
		const { language, alt } = parseMermaidFenceInfo(info);
		if (language !== 'mermaid') {
			continue;
		}

		ranges.push({
			from: match.index,
			to: match.index + match[0].length,
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
		private readonly markdown: string,
	) {
		super();
	}

	eq(other: MermaidWidget): boolean {
		return this.source === other.source && this.alt === other.alt && this.markdown === other.markdown;
	}

	toDOM(view: EditorView): HTMLElement {
		const root = view.dom.ownerDocument.createElement('div');
		root.className = 'marp-extended-editor-mermaid';

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

		void loadMermaidThemeCssForMarkdown(this.app, this.markdown)
			.then((css) => {
				style.textContent = css;
			})
			.catch((error: unknown) => {
				console.error('Marp Extended: Mermaid editor theme load failed', error);
			});

		return root;
	}
}

function buildDecorations(state: EditorState, app: App): DecorationSet {
	const markdown = state.doc.toString();
	const cursor = state.selection.main.head;
	const decorations = [];

	for (const range of findMermaidFenceRanges(markdown)) {
		if (cursor >= range.from && cursor <= range.to) {
			continue;
		}

		decorations.push(
			Decoration.replace({
				widget: new MermaidWidget(app, range.source, range.alt, markdown),
				block: true,
			}).range(range.from, range.to),
		);
	}

	return Decoration.set(decorations, true);
}

export function createMermaidEditorExtension(app: App) {
	const field = StateField.define<DecorationSet>({
		create(state) {
			return buildDecorations(state, app);
		},
		update(decorations, transaction) {
			if (transaction.docChanged || transaction.selection) {
				return buildDecorations(transaction.state, app);
			}

			return decorations.map(transaction.changes);
		},
		provide(field) {
			return EditorView.decorations.from(field);
		},
	});

	return field;
}
