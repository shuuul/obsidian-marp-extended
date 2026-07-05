import { App, TFile } from 'obsidian';
import { expect, jest, test } from '@jest/globals';

import { compileMarkdownForMarp } from '@/utilities/marpMarkdown';
import { FilePath } from '@/utilities/filePath';
import { DEFAULT_SETTINGS } from '@/utilities/settings';

function createAppWithResolvedFile(linkedFile: TFile | null): App {
	return {
		metadataCache: {
			getFirstLinkpathDest: jest.fn(() => linkedFile),
		},
	} as unknown as App;
}

test('default preview pipeline compiles Kami and wiki images but keeps mermaid fences', () => {
	const filePath = new FilePath(DEFAULT_SETTINGS);
	const sourceFile = new TFile();
	const linkedImage = new TFile();

	sourceFile.path = 'slides/deck.md';
	sourceFile.parent = { path: 'slides' } as TFile['parent'];
	linkedImage.path = 'assets/photo.png';

	const markdown = [
		'%%marp-slide[class=cover]%%',
		'',
		'![[photo.png]]',
		'',
		'```mermaid[Preview flow]',
		'flowchart LR',
		'  A --> B',
		'```',
	].join('\n');

	const processed = compileMarkdownForMarp(
		markdown,
		sourceFile,
		createAppWithResolvedFile(linkedImage),
		filePath,
	);

	expect(processed).toContain('<!-- _class: cover -->');
	expect(processed).toContain('![photo.png](../assets/photo.png)');
	expect(processed).toContain('```mermaid[Preview flow]');
	expect(processed).not.toContain('data-mermaid-renderer="beautiful-mermaid"');
});

test('inline mermaid export mode replaces fences with beautiful-mermaid figures', () => {
	const filePath = new FilePath(DEFAULT_SETTINGS);
	const sourceFile = new TFile();

	sourceFile.path = 'slides/deck.md';
	sourceFile.parent = { path: 'slides' } as TFile['parent'];

	const markdown = '# Slide\n\n```mermaid[Export flow]\nflowchart LR\n  A --> B\n```\n';

	const processed = compileMarkdownForMarp(
		markdown,
		sourceFile,
		createAppWithResolvedFile(null),
		filePath,
		{ renderMermaidInline: true },
	);

	expect(processed).toContain('data-mermaid-renderer="beautiful-mermaid"');
	expect(processed).toContain('<figcaption>Export flow</figcaption>');
	expect(processed).not.toContain('```mermaid');
});