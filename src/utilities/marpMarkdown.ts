import type { App, TFile } from 'obsidian';
import { compileKamiCommentBlocks } from './kamiDsl';
import { FilePath } from './filePath';
import { renderMermaidFences, type MermaidPluginOptions } from './mermaid';

export type CompileMarkdownForMarpOptions = {
	renderMermaidInline?: boolean;
	mermaidOptions?: MermaidPluginOptions;
};

export function compileMarkdownForMarp(
	markdown: string,
	file: TFile,
	app: App,
	filePath: FilePath,
	options: CompileMarkdownForMarpOptions = {},
): string {
	const compiled = compileKamiCommentBlocks(markdown);
	const converted = filePath.convertImageWikiLinks(compiled, file, app);

	if (options.renderMermaidInline === true) {
		return renderMermaidFences(converted, options.mermaidOptions);
	}

	return converted;
}
