import { MarkdownRenderChild, type App, type MarkdownPostProcessorContext } from 'obsidian';

import { parseMermaidFenceInfo } from '../runtime/mermaidShared';
import type { MarpExtendedSettings } from '../utilities/settings';
import { MermaidHostRenderer, resolveEditorMermaidTheme } from './mermaidEditorExtension';

type ReadingViewMermaidPlugin = {
	app: App;
	settings: MarpExtendedSettings;
};

export type ReadingViewMermaidBlock = {
	pre: HTMLElement;
	source: string;
	alt: string;
};

function mermaidLanguageFromClassList(el: HTMLElement): string {
	return Array.from(el.classList)
		.find((name) => name.startsWith('language-'))
		?.slice('language-'.length)
		?? '';
}

export function getReadingViewMermaidBlocks(el: HTMLElement): ReadingViewMermaidBlock[] {
	const blocks: ReadingViewMermaidBlock[] = [];
	const pres = el.matches('pre') ? [el] : Array.from(el.querySelectorAll('pre'));

	for (const pre of pres) {
		const codeEl = pre.querySelector('code');
		if (!codeEl) {
			continue;
		}

		const info = mermaidLanguageFromClassList(codeEl) || mermaidLanguageFromClassList(pre);
		const { language, alt } = parseMermaidFenceInfo(info);
		if (language !== 'mermaid') {
			continue;
		}

		blocks.push({
			pre,
			source: codeEl.textContent ?? '',
			alt,
		});
	}

	return blocks;
}

function mermaidThemeMarkdown(ctx: MarkdownPostProcessorContext): string {
	const frontmatter = ctx.frontmatter as Record<string, unknown> | null | undefined;
	const theme = frontmatter?.mermaidTheme;
	return typeof theme === 'string' && theme.trim()
		? `---\nmermaidTheme: ${theme.trim()}\n---\n`
		: '';
}

export function createReadingViewMermaidPostProcessor(plugin: ReadingViewMermaidPlugin) {
	return (el: HTMLElement, ctx: MarkdownPostProcessorContext): void => {
		if (!plugin.settings.MERMAID_EDITOR_RENDER) {
			return;
		}

		const themeName = resolveEditorMermaidTheme(mermaidThemeMarkdown(ctx), plugin.settings);
		for (const block of getReadingViewMermaidBlocks(el)) {
			const host = new MermaidHostRenderer(
				plugin.app,
				block.source,
				block.alt,
				themeName,
				plugin.settings.MERMAID_AUTO_FIT,
			);
			const root = host.mount(block.pre.ownerDocument);
			block.pre.replaceWith(root);
			ctx.addChild(new MermaidReadingViewChild(root, host));
		}
	};
}

class MermaidReadingViewChild extends MarkdownRenderChild {
	constructor(
		containerEl: HTMLElement,
		private readonly host: MermaidHostRenderer,
	) {
		super(containerEl);
	}

	onunload(): void {
		this.host.destroy();
	}
}
