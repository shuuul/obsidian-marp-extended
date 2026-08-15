import type { RenderOptions } from 'beautiful-mermaid';
import type { App, TFile } from 'obsidian';
import { BUILTIN_THEME_SCALE_CSS, wrapBuiltinThemeScaleCss } from './builtinThemeScale';
import { FilePath } from './filePath';
import { MARP_EXTENDED_STRUCTURAL_CSS } from './marpExtendedStructuralCss';
import { compileMarkdownForMarp } from './marpMarkdown';
import {
	loadMermaidThemeCssForFile,
	parseMermaidRenderOptionsFromCss,
	wrapMermaidThemeCss,
} from './mermaidTheme';

export type MarpPreparationMode = 'preview' | 'export';
export type MarpDeckStyleKind = 'mermaid-theme' | 'builtin-theme-scale' | 'structural';
export type MarpDeckStyle = Readonly<{ kind: MarpDeckStyleKind; css: string }>;

export type MarpPreparationContext = Readonly<{
	styles: readonly MarpDeckStyle[];
	mermaidRenderOptions: RenderOptions;
}>;

export type PreparedMarpDeck = Readonly<{
	markdown: string;
	styles: readonly MarpDeckStyle[];
}>;

export function createMarpPreparationContext(mermaidThemeCss: string): MarpPreparationContext {
	return {
		styles: [
			{ kind: 'mermaid-theme', css: mermaidThemeCss },
			{ kind: 'builtin-theme-scale', css: BUILTIN_THEME_SCALE_CSS },
			{ kind: 'structural', css: MARP_EXTENDED_STRUCTURAL_CSS },
		],
		mermaidRenderOptions: parseMermaidRenderOptionsFromCss(mermaidThemeCss),
	};
}

export async function loadMarpPreparationContext(
	app: App,
	file: TFile,
	markdown: string,
): Promise<MarpPreparationContext> {
	return createMarpPreparationContext(await loadMermaidThemeCssForFile(app, file, markdown));
}

export async function prepareMarpDeck(
	markdown: string,
	file: TFile,
	app: App,
	filePath: FilePath,
	context: MarpPreparationContext,
	options: { mode: MarpPreparationMode; mermaidAutoFit: boolean },
): Promise<PreparedMarpDeck> {
	return {
		markdown: await compileMarkdownForMarp(markdown, file, app, filePath, {
			renderMermaidInline: true,
			mermaidOptions: {
				renderOptions: context.mermaidRenderOptions,
				autoFit: { enabled: options.mermaidAutoFit },
			},
			noteWikiLinkMode: options.mode,
		}),
		styles: context.styles,
	};
}

export function serializeMarpDeckStyles(
	styles: readonly MarpDeckStyle[],
	target: MarpPreparationMode,
): string {
	if (target === 'preview') {
		return styles.map(({ css }) => css).join('\n');
	}

	return styles.map(({ kind, css }) => {
		switch (kind) {
			case 'mermaid-theme':
				return wrapMermaidThemeCss(css);
			case 'builtin-theme-scale':
				return wrapBuiltinThemeScaleCss(css);
			case 'structural':
				return `\n<style>${css}</style>`;
		}
	}).join('');
}
