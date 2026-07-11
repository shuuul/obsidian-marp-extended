/** @jest-environment jsdom */

import { ItemView, type MarkdownView, type TFile } from 'obsidian';
import { expect, jest, test, beforeEach } from '@jest/globals';

import { DEFAULT_SETTINGS } from '@/utilities/settings';
import { MarpPreviewView } from '@/views/marpPreviewView';
import { marpPreviewViewTestAccess } from '../helpers/marpPreviewViewTestAccess';

jest.mock('@/utilities/themeManager', () => ({
	ThemeManager: jest.fn().mockImplementation(() => ({
		loadThemeCss: jest.fn(async () => [] as string[]),
	})),
}));

jest.mock('@/utilities/themeAssetCache', () => ({
	ThemeAssetCache: jest.fn().mockImplementation(() => ({
		rewriteRemoteAssets: jest.fn(async (css: string) => css),
	})),
}));

jest.mock('@/utilities/mermaidTheme', () => ({
	loadMermaidThemeCssForFile: jest.fn(async () => '/* mermaid theme css */'),
}));

jest.mock('@/utilities/marpExport', () => ({
	exportWithNotice: jest.fn(async () => undefined),
}));


function createPreviewView(appExtras: Record<string, unknown> = {}): MarpPreviewView {
	const app = {
		vault: { adapter: {} },
		metadataCache: { getFirstLinkpathDest: () => null },
		...appExtras,
	};
	const leaf = { app };
	const view = new MarpPreviewView(DEFAULT_SETTINGS, leaf as never);
	const access = marpPreviewViewTestAccess(view);
	const container = document.createElement('div');
	container.className = 'marp-extended-preview-content';
	const iframe = document.createElement('iframe');
	container.appendChild(iframe);
	view.contentEl.appendChild(container);
	access.previewContainerEl = container;
	access.previewIframeEl = iframe;
	return view;
}

beforeEach(() => {
	jest.clearAllMocks();
});

test('displaySlides builds preview HTML with base URL, Kami, wiki image, and mermaid theme CSS', async () => {
	const linkedImage = { path: 'assets/photo.png' };
	const view = createPreviewView({
		metadataCache: {
			getFirstLinkpathDest: () => linkedImage,
		},
	});
	const access = marpPreviewViewTestAccess(view);
	const sourceFile = {
		path: 'slides/deck.md',
		parent: { path: 'slides' },
		vault: {
			adapter: {
				write: async () => undefined,
				getResourcePath: (path: string) => `app://local/${path}?id=1`,
			},
			getConfig: () => 'relative',
		},
	} as unknown as TFile;

	let capturedHtml = '';
	const renderSpy = jest
		.spyOn(access, 'renderPreviewDocument')
		.mockImplementation(async (html: string) => {
			capturedHtml = html;
		});

	const markdownView = {
		file: sourceFile,
		getViewData: () => [
			'%%marp-slide[class=cover]%%',
			'',
			'![[photo.png]]',
			'',
			'```mermaid[Deck flow]',
			'flowchart LR',
			'  A --> B',
			'```',
		].join('\n'),
		app: {
			metadataCache: {
				getFirstLinkpathDest: () => linkedImage,
			},
			vault: sourceFile.vault,
		},
	} as unknown as MarkdownView;

	await view.displaySlides(markdownView);

	expect(capturedHtml).toContain('class="cover"');
	expect(capturedHtml).toContain('../assets/photo.png');
	expect(capturedHtml).toContain('/* mermaid theme css */');
	expect(capturedHtml).toContain('data-mermaid-renderer="beautiful-mermaid"');

	renderSpy.mockRestore();
});

test('applyPreviewZoom sets fit scale CSS variable and iframe width from slide viewBox', () => {
	const view = createPreviewView();
	const access = marpPreviewViewTestAccess(view);
	const container = access.previewContainerEl;
	const iframe = access.previewIframeEl;

	if (!container || !iframe) {
		throw new Error('Preview harness missing container or iframe');
	}

	Object.defineProperty(container, 'clientWidth', { configurable: true, value: 600 });

	const doc = document.implementation.createHTMLDocument('preview');
	doc.body.innerHTML = `
<div id="__marp-vscode">
  <div data-marp-vscode-slide-wrapper>
    <svg viewBox="0 0 1200 675"></svg>
  </div>
</div>`;
	Object.defineProperty(iframe, 'contentDocument', { configurable: true, value: doc });

	access.applyPreviewZoom();

	expect(container.style.getPropertyValue('--marp-extended-preview-zoom')).toBe('0.5');
	expect(iframe.style.width).toBe('600px');
});

test('loadPreviewSrcdoc resolves after iframe load and assigns srcdoc', async () => {
	const view = createPreviewView();
	const access = marpPreviewViewTestAccess(view);
	const iframe = access.previewIframeEl;

	if (!iframe) {
		throw new Error('Preview harness missing iframe');
	}

	const html = '<!DOCTYPE html><html><body><div id="__marp-vscode"></div></body></html>';
	const loadPromise = access.loadPreviewSrcdoc(html);

	iframe.dispatchEvent(new Event('load'));

	await expect(loadPromise).resolves.toBeUndefined();
	expect(iframe.srcdoc).toBe(html);
});

test('preview view constructs with ItemView toolbar hooks', () => {
	const view = createPreviewView();

	expect(view).toBeInstanceOf(ItemView);
	expect(view.contentEl.querySelector('iframe')).not.toBeNull();
});