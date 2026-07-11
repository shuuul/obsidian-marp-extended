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

test('default preview pipeline compiles Kami and wiki images but keeps mermaid fences', async () => {
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

	const processed = await compileMarkdownForMarp(
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

test('inline mermaid export mode replaces fences with beautiful-mermaid figures', async () => {
	const filePath = new FilePath(DEFAULT_SETTINGS);
	const sourceFile = new TFile();

	sourceFile.path = 'slides/deck.md';
	sourceFile.parent = { path: 'slides' } as TFile['parent'];

	const markdown = '# Slide\n\n```mermaid[Export flow]\nflowchart LR\n  A --> B\n```\n';

	const processed = await compileMarkdownForMarp(
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

test('inline mermaid export mode falls back to official Mermaid for unsupported types', async () => {
	const filePath = new FilePath(DEFAULT_SETTINGS);
	const sourceFile = new TFile();

	sourceFile.path = 'slides/deck.md';
	sourceFile.parent = { path: 'slides' } as TFile['parent'];

	const markdown = '# Slide\n\n```mermaid[Pie]\npie\n  "A": 40\n  "B": 60\n```\n';

	const processed = await compileMarkdownForMarp(
		markdown,
		sourceFile,
		createAppWithResolvedFile(null),
		filePath,
		{ renderMermaidInline: true },
	);

	expect(processed).toContain('data-mermaid-renderer="mermaid"');
	expect(processed).toContain('data-official-mermaid="1"');
	expect(processed).not.toContain('```mermaid');
});
