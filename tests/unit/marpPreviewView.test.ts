/** @jest-environment jsdom */

import { ItemView, Notice, type MarkdownView, type TFile } from 'obsidian';
import type { Marp } from '@marp-team/marp-core';
import { expect, jest, test, beforeEach } from '@jest/globals';

import { exportWithNotice } from '@/utilities/marpExport';
import { DEFAULT_SETTINGS } from '@/utilities/settings';
import { loadMermaidThemeCssForFile } from '@/utilities/mermaidTheme';
import { ThemeManager } from '@/utilities/themeManager';
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
	parseMermaidRenderOptionsFromCss: jest.fn(() => ({})),
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

function addObsidianDomHelpers<T extends HTMLElement>(element: T): T {
	const extended = element as T & {
		createDiv(options?: { text?: string }): HTMLDivElement;
		createEl<K extends keyof HTMLElementTagNameMap>(tag: K, options?: { text?: string }): HTMLElementTagNameMap[K];
	};
	extended.createEl = <K extends keyof HTMLElementTagNameMap>(tag: K, options?: { text?: string }) => {
		const child = addObsidianDomHelpers(element.ownerDocument.createElement(tag));
		if (options?.text != null) child.textContent = options.text;
		element.appendChild(child);
		return child;
	};
	extended.createDiv = (options?: { text?: string }) => extended.createEl('div', options);
	return element;
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

test('preview export reads current editor markdown even before the preview refreshes', async () => {
	const view = createPreviewView();
	const access = marpPreviewViewTestAccess(view);
	const sourceFile = {
		path: 'slides/deck.md',
		parent: { path: 'slides' },
		vault: {
			adapter: {
				getResourcePath: (path: string) => `app://local/${path}?id=1`,
			},
			getConfig: () => 'relative',
		},
	} as unknown as TFile;
	let currentMarkdown = '# Previous title';
	const markdownView = {
		file: sourceFile,
		getViewData: () => currentMarkdown,
	} as unknown as MarkdownView;
	jest.spyOn(access, 'renderPreviewDocument').mockResolvedValue();

	await view.displaySlides(markdownView);
	currentMarkdown = '%%marp-slide[class=cover]%%\n\n# Current title';
	await access.exportFile('pdf');

	const exportCalls = (exportWithNotice as unknown as { mock: { calls: unknown[][] } }).mock.calls;
	expect(exportCalls[0]).toEqual([
		DEFAULT_SETTINGS,
		view.app,
		'pdf',
		sourceFile,
		undefined,
		currentMarkdown,
	]);
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

test('preview iframe clicks open http(s) links externally and leave vault links alone', () => {
	const view = createPreviewView();
	const access = marpPreviewViewTestAccess(view);
	const iframe = access.previewIframeEl;
	if (!iframe) {
		throw new Error('Preview harness missing iframe');
	}

	const doc = document.implementation.createHTMLDocument('preview');
	const base = doc.createElement('base');
	base.href = 'app://local/slides/';
	doc.head.appendChild(base);
	const youtube = doc.createElement('a');
	youtube.setAttribute('href', 'https://www.youtube.com/watch?v=mGhvK8xJP1w');
	youtube.textContent = 'video';
	const vault = doc.createElement('a');
	vault.setAttribute('href', '../assets/photo.png');
	vault.textContent = 'photo';
	doc.body.append(youtube, vault);
	Object.defineProperty(iframe, 'contentDocument', { configurable: true, value: doc });

	const openWindow = jest.spyOn(window, 'open').mockReturnValue({} as Window);

	access.registerPreviewIframeLinkHandler();

	const youtubeEvent = new MouseEvent('click', { bubbles: true, button: 0, cancelable: true });
	youtube.dispatchEvent(youtubeEvent);
	expect(youtubeEvent.defaultPrevented).toBe(true);
	expect(openWindow).toHaveBeenCalledWith(
		'https://www.youtube.com/watch?v=mGhvK8xJP1w',
		'_blank',
		'noopener,noreferrer',
	);

	openWindow.mockClear();
	const vaultEvent = new MouseEvent('click', { bubbles: true, button: 0, cancelable: true });
	vault.dispatchEvent(vaultEvent);
	expect(vaultEvent.defaultPrevented).toBe(false);
	expect(openWindow).not.toHaveBeenCalled();

	openWindow.mockRestore();
});

test('preview view constructs with ItemView toolbar hooks', () => {
	const view = createPreviewView();

	expect(view).toBeInstanceOf(ItemView);
	expect(view.contentEl.querySelector('iframe')).not.toBeNull();
});

test('fragment actions follow numeric order, stop at boundaries, and cursor sync preserves progress', () => {
	const view = createPreviewView();
	const access = marpPreviewViewTestAccess(view);
	const wrapper = document.createElement('div');
	wrapper.innerHTML = '<section><i data-marpit-fragment="2"></i><b data-marpit-fragment="1"></b></section>';
	access.previewSlideEls = [wrapper];
	access.initializePreviewState([[]]);

	view.nextFragment();
	expect(wrapper.querySelector('[data-marpit-fragment="1"]')?.getAttribute('aria-hidden')).toBe('false');
	expect(wrapper.querySelector('[data-marpit-fragment="2"]')?.getAttribute('aria-hidden')).toBe('true');
	view.nextFragment();
	view.nextFragment();
	expect(access.fragmentRevealCounts).toEqual([2]);
	view.onLineChanged(0);
	expect(access.fragmentRevealCounts).toEqual([2]);
	view.previousFragment();
	view.resetActiveSlideFragments();
	expect(access.fragmentRevealCounts).toEqual([0]);
});

test('cursor sync keeps a visible slide in place and clamps scrolling for a hidden slide', () => {
	const view = createPreviewView();
	const access = marpPreviewViewTestAccess(view);
	const container = access.previewContainerEl;
	const iframe = access.previewIframeEl;
	const visibleSlide = document.createElement('div');
	const hiddenSlide = document.createElement('div');

	if (!container || !iframe) throw new Error('Preview harness missing container or iframe');
	Object.defineProperty(container, 'clientHeight', { configurable: true, value: 400 });
	Object.defineProperty(container, 'scrollHeight', { configurable: true, value: 1000 });
	container.scrollTop = 250;
	container.getBoundingClientRect = () => ({ top: 100 } as DOMRect);
	iframe.getBoundingClientRect = () => ({ top: -300 } as DOMRect);
	visibleSlide.getBoundingClientRect = () => ({ top: 450, bottom: 750 } as DOMRect);
	hiddenSlide.getBoundingClientRect = () => ({ top: 900, bottom: 1200 } as DOMRect);
	access.previewSlideEls = [visibleSlide, hiddenSlide];

	view.onLineChanged(0);
	expect(container.scrollTop).toBe(250);

	view.onLineChanged(1);
	expect(container.scrollTop).toBe(600);
});

test('comments map by logical wrapper and presenter notes use literal text with an empty state', () => {
	const view = createPreviewView();
	const access = marpPreviewViewTestAccess(view);
	const first = document.createElement('div');
	first.innerHTML = '<section></section><section data-marpit-advanced-background="content"></section>';
	const second = document.createElement('div');
	access.previewSlideEls = [first, second];
	access.presenterNotesEl = addObsidianDomHelpers(document.createElement('div'));
	access.initializePreviewState([['line one\nline two', '<img src=x onerror=alert(1)>'], []]);
	view.togglePresenterNotes();

	expect(access.presenterNotesEl.querySelectorAll('li')).toHaveLength(2);
	expect(access.presenterNotesEl.textContent).toContain('<img src=x onerror=alert(1)>');
	expect(access.presenterNotesEl.querySelector('img')).toBeNull();
	access.activeSlideIndex = 1;
	access.applyPreviewState();
	expect(access.presenterNotesEl.textContent).toBe('No presenter notes for this slide.');
});

test('outer preview scrolling selects the nearest slide across iframe coordinates', async () => {
	const view = createPreviewView();
	const access = marpPreviewViewTestAccess(view);
	const container = access.previewContainerEl;
	const iframe = access.previewIframeEl;
	const first = document.createElement('div');
	const second = document.createElement('div');

	if (!container || !iframe) throw new Error('Preview harness missing container or iframe');
	access.previewSlideEls = [first, second];
	container.getBoundingClientRect = () => ({ top: 100 } as DOMRect);
	iframe.getBoundingClientRect = () => ({ top: -500 } as DOMRect);
	first.getBoundingClientRect = () => ({ top: 0 } as DOMRect);
	second.getBoundingClientRect = () => ({ top: 600 } as DOMRect);
	access.registerPreviewScrollTracking();

	container.dispatchEvent(new Event('scroll'));
	await new Promise((resolve) => window.requestAnimationFrame(resolve));

	expect(access.activeSlideIndex).toBe(1);
});

test('serializes preview commits so stale iframe loads cannot initialize newer state', async () => {
	const view = createPreviewView();
	const access = marpPreviewViewTestAccess(view);
	const pending: Array<() => void> = [];
	const renderSpy = jest.spyOn(access, 'renderPreviewDocument').mockImplementation(() => (
		new Promise<void>((resolve) => pending.push(resolve))
	));
	jest.spyOn(access, 'applyPreviewZoom').mockImplementation(() => undefined);
	const staleSlide = document.createElement('div');
	staleSlide.innerHTML = '<i data-marpit-fragment="1"></i>';
	const currentSlide = document.createElement('div');
	currentSlide.innerHTML = '<i data-marpit-fragment="1"></i><i data-marpit-fragment="2"></i>';

	access.displaySlidesRevision = 1;
	access.previewSlideEls = [staleSlide];
	const staleCommit = access.commitPreviewRender(1, '<html>stale</html>', [['stale note']]);
	await new Promise((resolve) => setTimeout(resolve, 0));
	access.displaySlidesRevision = 2;
	const currentCommit = access.commitPreviewRender(2, '<html>current</html>', [['current note']]);
	await new Promise((resolve) => setTimeout(resolve, 0));
	expect(renderSpy).toHaveBeenCalledTimes(1);

	pending.shift()?.();
	await staleCommit;
	await new Promise((resolve) => setTimeout(resolve, 0));
	expect(renderSpy).toHaveBeenCalledTimes(2);
	access.previewSlideEls = [currentSlide];
	pending.shift()?.();
	await currentCommit;

	expect(access.fragmentTotals).toEqual([2]);
	expect(access.presenterComments).toEqual([['current note']]);
	expect(renderSpy).toHaveBeenLastCalledWith('<html>current</html>');
});

test('internal preview links strip subpaths for lookup but open the full linktext', () => {
	const openLinkText = jest.fn(async (_linktext: string, _sourcePath?: string, _newLeaf?: boolean) => undefined);
	const getFirstLinkpathDest = jest.fn((linkpath: string, _sourcePath?: string) => (
		linkpath === 'Note' ? { path: 'Note.md' } : null
	));
	const view = createPreviewView({
		metadataCache: { getFirstLinkpathDest },
		workspace: { openLinkText },
	});
	const access = marpPreviewViewTestAccess(view);
	access.file = { path: 'slides/deck.md' } as unknown as TFile;

	expect(access.openInternalPreviewLink('Note#Section', false)).toBe(true);
	expect(getFirstLinkpathDest).toHaveBeenCalledWith('Note', 'slides/deck.md');
	expect(openLinkText).toHaveBeenCalledWith('Note#Section', 'slides/deck.md', false);

	getFirstLinkpathDest.mockReturnValue(null);
	expect(access.openInternalPreviewLink('Missing#heading', true)).toBe(false);
	expect(Notice).toHaveBeenCalledWith('Marp preview: note not found for [[Missing#heading]]', 5000);
	expect(openLinkText).toHaveBeenCalledTimes(1);
});

test('displaySlides caches theme CSS and engine until invalidatePreviewCaches', async () => {
	const view = createPreviewView();
	const access = marpPreviewViewTestAccess(view);
	const sourceFile = {
		path: 'slides/deck.md',
		parent: { path: 'slides' },
		vault: {
			adapter: {
				write: async () => undefined,
				getResourcePath: (path: string) => `app://local/${path}`,
			},
			getConfig: () => 'relative',
		},
	} as unknown as TFile;
	const markdownView = {
		file: sourceFile,
		getViewData: () => '---\nmarp: true\n---\n\n# Title',
		app: { vault: sourceFile.vault },
	} as unknown as MarkdownView;
	jest.spyOn(access, 'renderPreviewDocument').mockImplementation(async () => undefined);
	const createMarpSpy = jest.spyOn(access, 'createMarp');
	const themeManagerMock = ThemeManager as jest.MockedClass<typeof ThemeManager>;

	await view.displaySlides(markdownView);
	await view.displaySlides(markdownView, '# Updated');

	expect(themeManagerMock).toHaveBeenCalledTimes(1);
	expect(createMarpSpy).toHaveBeenCalledTimes(1);

	view.invalidatePreviewCaches();
	await view.displaySlides(markdownView, '# After invalidation');

	expect(themeManagerMock).toHaveBeenCalledTimes(2);
	expect(createMarpSpy).toHaveBeenCalledTimes(2);
});

test('uses a fresh render-local engine when theme loads finish out of order', async () => {
	const view = createPreviewView();
	const access = marpPreviewViewTestAccess(view);
	const sourceFile = {
		path: 'slides/deck.md',
		parent: { path: 'slides' },
		vault: {
			adapter: {
				write: async () => undefined,
				getResourcePath: (path: string) => `app://local/${path}`,
			},
			getConfig: () => 'relative',
		},
	} as unknown as TFile;
	const markdownView = {
		file: sourceFile,
		getViewData: () => '---\nmarp: true\n---\n\n# Current',
		app: { vault: sourceFile.vault },
	} as unknown as MarkdownView;
	let resolveStaleTheme: (themes: string[]) => void = () => undefined;
	let resolveCurrentMermaid: (css: string) => void = () => undefined;
	const staleTheme = new Promise<string[]>((resolve) => {
		resolveStaleTheme = resolve;
	});
	const currentMermaid = new Promise<string>((resolve) => {
		resolveCurrentMermaid = resolve;
	});

	const themeManagerMock = ThemeManager as jest.MockedClass<typeof ThemeManager>;
	themeManagerMock
		.mockImplementationOnce(() => ({ loadThemeCss: () => staleTheme }) as unknown as jest.Mocked<ThemeManager>)
		.mockImplementationOnce(() => ({ loadThemeCss: async () => ['current-theme'] }) as unknown as jest.Mocked<ThemeManager>);
	jest.mocked(loadMermaidThemeCssForFile).mockImplementationOnce(() => currentMermaid);

	const engines: Array<{ themes: string[]; engine: Marp }> = [];
	jest.spyOn(access, 'createMarp').mockImplementation(() => {
		const themes: string[] = [];
		const engine = {
			themeSet: { add: (theme: string) => themes.push(theme) },
			render: () => ({ html: `<section>${themes.join(',')}</section>`, css: '', comments: [] }),
		} as unknown as Marp;
		engines.push({ themes, engine });
		return engine;
	});
	let capturedHtml = '';
	jest.spyOn(access, 'renderPreviewDocument').mockImplementation(async (html: string) => {
		capturedHtml = html;
	});

	const staleDisplay = view.displaySlides(markdownView, '# Stale');
	await Promise.resolve();
	const currentDisplay = view.displaySlides(markdownView, '# Current');
	await Promise.resolve();
	await Promise.resolve();
	resolveStaleTheme(['stale-theme']);
	await staleDisplay;
	resolveCurrentMermaid('');
	await currentDisplay;

	expect(engines).toHaveLength(1);
	expect(engines[0]?.themes).toEqual(['current-theme']);
	expect(capturedHtml).toContain('current-theme');
	expect(capturedHtml).not.toContain('stale-theme');
});
