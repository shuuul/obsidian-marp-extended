import { App, TFile } from 'obsidian';
import { expect, jest, test } from '@jest/globals';

import { FilePath } from '@/utilities/filePath';
import {
	createMarpPreparationContext,
	prepareMarpDeck,
	serializeMarpDeckStyles,
} from '@/utilities/marpPreparation';
import { DEFAULT_SETTINGS } from '@/utilities/settings';

test('keeps preview and export preparation aligned except for note-link policy', async () => {
	const sourceFile = new TFile();
	const linkedImage = new TFile();
	sourceFile.path = 'slides/deck.md';
	sourceFile.parent = { path: 'slides' } as TFile['parent'];
	linkedImage.path = 'assets/photo.png';
	const app = {
		metadataCache: {
			getFirstLinkpathDest: jest.fn(() => linkedImage),
		},
	} as unknown as App;
	const markdown = [
		'%%marp-slide[class=cover]%%',
		'',
		'![[photo.png]]',
		'',
		'Based on [[source-note|Source]]',
		'',
		'```mermaid[Flow]',
		'flowchart LR',
		'  A --> B',
		'```',
	].join('\n');
	const mermaidThemeCss = 'section svg { --accent: #123456; }';
	const context = createMarpPreparationContext(mermaidThemeCss);
	const filePath = new FilePath(DEFAULT_SETTINGS);

	const preview = await prepareMarpDeck(markdown, sourceFile, app, filePath, context, {
		mode: 'preview',
		mermaidAutoFit: true,
	});
	const exported = await prepareMarpDeck(markdown, sourceFile, app, filePath, context, {
		mode: 'export',
		mermaidAutoFit: true,
	});

	expect(context.mermaidRenderOptions).toEqual({ accent: '#123456' });
	expect(preview.styles).toBe(exported.styles);
	expect(preview.markdown).toContain('[Source](<obsidian://open?file=source-note>)');
	expect(exported.markdown).toContain('Based on Source');
	expect(preview.markdown).toContain('data-mermaid-renderer="beautiful-mermaid"');
	expect(preview.markdown.replace('[Source](<obsidian://open?file=source-note>)', 'Source')).toBe(exported.markdown);

	const previewStyles = serializeMarpDeckStyles(preview.styles, 'preview');
	const exportStyles = serializeMarpDeckStyles(exported.styles, 'export');
	expect(previewStyles.indexOf(mermaidThemeCss)).toBeLessThan(previewStyles.indexOf('section[data-theme="default"]'));
	expect(previewStyles.indexOf('section[data-theme="default"]')).toBeLessThan(previewStyles.indexOf('.marp-extended-columns'));
	expect(exportStyles.indexOf('marp-extended-mermaid-theme')).toBeLessThan(exportStyles.indexOf('marp-extended-builtin-scale'));
	expect(exportStyles.indexOf('marp-extended-builtin-scale')).toBeLessThan(exportStyles.indexOf('.marp-extended-columns'));
	expect(exportStyles).not.toContain('__marp-extended-preview-style');
});
