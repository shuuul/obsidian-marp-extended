import type { App, TFile } from 'obsidian';
import { FilePath } from './filePath';
import { compileMarpExtendedCommentBlocks } from '@marp-extended/marp-dsl';
import { renderMermaidFences, type MermaidPluginOptions } from './mermaid';
import { convertNoteWikiLinks, type NoteWikiLinkMode } from '@marp-extended/wiki-links';

export type CompileMarkdownForMarpOptions = {
	renderMermaidInline?: boolean;
	mermaidOptions?: MermaidPluginOptions;
	/**
	 * How note wiki-links ([[path|alias]]) are compiled.
	 * 'preview' keeps them clickable via obsidian:// hrefs; 'export' (default)
	 * reduces them to plain display text.
	 */
	noteWikiLinkMode?: NoteWikiLinkMode;
};

export async function compileMarkdownForMarp(
	markdown: string,
	file: TFile,
	app: App,
	filePath: FilePath,
	options: CompileMarkdownForMarpOptions = {},
): Promise<string> {
	const compiled = compileMarpExtendedCommentBlocks(markdown);
	const convertedImages = filePath.convertImageWikiLinks(compiled, file, app);
	const converted = convertNoteWikiLinks(convertedImages, options.noteWikiLinkMode ?? 'export');

	if (options.renderMermaidInline === true) {
		return renderMermaidFences(converted, options.mermaidOptions);
	}

	return converted;
}
