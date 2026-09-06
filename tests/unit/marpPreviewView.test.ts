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
		createDiv(options?: { cls?: string; text?: string }): HTMLDivElement;
		createEl<K extends keyof HTMLElementTagNameMap>(tag: K, options?: { cls?: string; text?: string }): HTMLElementTagNameMap[K];
	};
	extended.createEl = <K extends keyof HTMLElementTagNameMap>(tag: K, options?: { cls?: string; text?: string }) => {
		const child = addObsidianDomHelpers(element.ownerDocument.createElement(tag));
		if (options?.cls) child.className = options.cls;
		if (options?.text != null) child.textContent = options.text;
		element.appendChild(child);
		return child;
	};
	extended.createDiv = (options?: { cls?: string; text?: string }) => extended.createEl('div', options);
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

test('clicking a preview slide moves the matching editor source into view', () => {
	const view = createPreviewView();
	const access = marpPreviewViewTestAccess(view);
	const iframe = access.previewIframeEl;
	if (!iframe) {
		throw new Error('Preview harness missing iframe');
	}

	const file = { path: 'slides/deck.md' } as TFile;
	const setCursor = jest.fn();
	const scrollIntoView = jest.fn();
	const focus = jest.fn();
	access.file = file;
	access.sourceView = {
		file,
		getViewData: () => '---\ntheme: default\n---\n# First\n```\n---\n```\n---\n# Second',
		editor: { setCursor, scrollIntoView, focus },
	} as unknown as MarkdownView;

	const doc = document.implementation.createHTMLDocument('preview');
	const firstSlide = doc.createElement('div');
	const secondSlide = doc.createElement('div');
	const secondSlideContent = doc.createElement('p');
	firstSlide.setAttribute('data-marp-vscode-slide-wrapper', '');
	secondSlide.setAttribute('data-marp-vscode-slide-wrapper', '');
	secondSlide.appendChild(secondSlideContent);
	doc.body.append(firstSlide, secondSlide);
	access.previewSlideEls = [firstSlide, secondSlide];
	Object.defineProperty(iframe, 'contentDocument', { configurable: true, value: doc });

	access.registerPreviewIframeLinkHandler();
	secondSlideContent.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));

	expect(setCursor).toHaveBeenCalledWith({ line: 8, ch: 0 });
	expect(scrollIntoView).toHaveBeenCalledWith({
		from: { line: 8, ch: 0 },
		to: { line: 8, ch: 0 },
	}, true);
	expect(focus).toHaveBeenCalledTimes(1);
});

test('selecting preview text briefly highlights and centers the matching source text', () => {
	jest.useFakeTimers();
	try {
		const view = createPreviewView();
		const access = marpPreviewViewTestAccess(view);
		const iframe = access.previewIframeEl;
		if (!iframe) {
			throw new Error('Preview harness missing iframe');
		}

		const file = { path: 'slides/deck.md' } as TFile;
		const markdown = '# First\n---\n# Second title';
		const from = { line: 2, ch: 2 };
		const to = { line: 2, ch: 14 };
		const setCursor = jest.fn();
		const setSelection = jest.fn();
		const scrollIntoView = jest.fn();
		const focus = jest.fn();
		access.file = file;
		access.sourceView = {
			file,
			getViewData: () => markdown,
			editor: {
				focus,
				listSelections: () => [{ anchor: from, head: to }],
				offsetToPos: (offset: number) => offset === markdown.indexOf('Second title') ? from : to,
				scrollIntoView,
				setCursor,
				setSelection,
			},
		} as unknown as MarkdownView;

		const doc = document.implementation.createHTMLDocument('preview');
		const firstSlide = doc.createElement('div');
		const secondSlide = doc.createElement('div');
		const selectedText = doc.createTextNode('Second title');
		firstSlide.setAttribute('data-marp-vscode-slide-wrapper', '');
		secondSlide.setAttribute('data-marp-vscode-slide-wrapper', '');
		secondSlide.appendChild(selectedText);
		doc.body.append(firstSlide, secondSlide);
		access.previewSlideEls = [firstSlide, secondSlide];
		Object.defineProperty(iframe, 'contentDocument', { configurable: true, value: doc });
		jest.spyOn(doc, 'getSelection').mockReturnValue({
			anchorNode: selectedText,
			focusNode: selectedText,
			toString: () => 'Second title',
		} as unknown as Selection);

		access.registerPreviewIframeLinkHandler();
		secondSlide.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));

		expect(setSelection).toHaveBeenCalledWith(from, to);
		expect(scrollIntoView).toHaveBeenCalledWith({ from, to }, true);
		expect(focus).toHaveBeenCalledTimes(1);
		expect(setCursor).not.toHaveBeenCalled();

		jest.advanceTimersByTime(700);
		expect(setCursor).toHaveBeenCalledWith(to);
	} finally {
		jest.useRealTimers();
	}
});

test('preview source navigation ignores links and modified clicks', () => {
	const view = createPreviewView();
	const access = marpPreviewViewTestAccess(view);
	const iframe = access.previewIframeEl;
	if (!iframe) {
		throw new Error('Preview harness missing iframe');
	}

	const file = { path: 'slides/deck.md' } as TFile;
	const setCursor = jest.fn();
	access.file = file;
	access.sourceView = {
		file,
		getViewData: () => '# First',
		editor: { setCursor, scrollIntoView: jest.fn(), focus: jest.fn() },
	} as unknown as MarkdownView;

	const doc = document.implementation.createHTMLDocument('preview');
	const slide = doc.createElement('div');
	const link = doc.createElement('a');
	const content = doc.createElement('p');
	slide.setAttribute('data-marp-vscode-slide-wrapper', '');
	link.href = '../assets/photo.png';
	slide.append(link, content);
	doc.body.appendChild(slide);
	access.previewSlideEls = [slide];
	Object.defineProperty(iframe, 'contentDocument', { configurable: true, value: doc });

	access.registerPreviewIframeLinkHandler();
	link.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
	content.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, ctrlKey: true }));

	expect(setCursor).not.toHaveBeenCalled();
});

test('preview view constructs with ItemView toolbar hooks', () => {
	const view = createPreviewView();

	expect(view).toBeInstanceOf(ItemView);
	expect(view.contentEl.querySelector('iframe')).not.toBeNull();
});

test('fragments start fully revealed, step in numeric order, and reset rewinds', () => {
	const view = createPreviewView();
	const access = marpPreviewViewTestAccess(view);
	const wrapper = document.createElement('div');
	wrapper.innerHTML = '<section><i data-marpit-fragment="2"></i><b data-marpit-fragment="1"></b></section>';
	access.previewSlideEls = [wrapper];
	access.initializePreviewState([[]]);

	// Fragments render fully revealed so the preview matches the exported deck.
	expect(access.fragmentRevealCounts).toEqual([2]);
	expect(wrapper.querySelector('[data-marpit-fragment="1"]')?.getAttribute('aria-hidden')).toBe('false');
	expect(wrapper.querySelector('[data-marpit-fragment="2"]')?.getAttribute('aria-hidden')).toBe('false');

	// Stepping forward at the end is a no-op.
	view.nextFragment();
	expect(access.fragmentRevealCounts).toEqual([2]);

	// Stepping backward hides fragments in reverse numeric order.
	view.previousFragment();
	expect(access.fragmentRevealCounts).toEqual([1]);
	expect(wrapper.querySelector('[data-marpit-fragment="1"]')?.getAttribute('aria-hidden')).toBe('false');
	expect(wrapper.querySelector('[data-marpit-fragment="2"]')?.getAttribute('aria-hidden')).toBe('true');

	// Reset rewinds the active slide for a fresh fragment run.
	view.resetActiveSlideFragments();
	expect(access.fragmentRevealCounts).toEqual([0]);
	expect(wrapper.querySelector('[data-marpit-fragment="1"]')?.getAttribute('aria-hidden')).toBe('true');
	expect(wrapper.querySelector('[data-marpit-fragment="2"]')?.getAttribute('aria-hidden')).toBe('true');

	// Stepping forward from the rewind reveals in numeric order and stops at the end.
	view.nextFragment();
	expect(wrapper.querySelector('[data-marpit-fragment="1"]')?.getAttribute('aria-hidden')).toBe('false');
	expect(wrapper.querySelector('[data-marpit-fragment="2"]')?.getAttribute('aria-hidden')).toBe('true');
	view.nextFragment();
	view.nextFragment();
	expect(access.fragmentRevealCounts).toEqual([2]);

	// Cursor sync preserves reveal progress.
	view.onLineChanged(0);
	expect(access.fragmentRevealCounts).toEqual([2]);
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
	const notes = addObsidianDomHelpers(document.createElement('div'));
	const handle = document.createElement('div');
	const body = addObsidianDomHelpers(document.createElement('div'));
	notes.appendChild(handle);
	notes.appendChild(body);
	access.presenterNotesEl = notes;
	access.presenterNotesResizeEl = handle;
	access.presenterNotesBodyEl = body;
	access.initializePreviewState([['line one\nline two', '<img src=x onerror=alert(1)>'], []]);
	view.togglePresenterNotes();

	expect(notes.contains(handle)).toBe(true);
	expect(body.querySelector('.marp-extended-presenter-notes-heading')?.textContent).toBe('Slide 1');
	expect(notes.getAttribute('aria-label')).toBe('Presenter notes, slide 1');
	expect(body.querySelector('ol')).toBeNull();
	expect(body.querySelectorAll('li')).toHaveLength(2);
	expect(body.textContent).toContain('<img src=x onerror=alert(1)>');
	expect(body.querySelector('img')).toBeNull();
	access.activeSlideIndex = 1;
	access.applyPreviewState();
	expect(notes.contains(handle)).toBe(true);
	expect(body.querySelector('.marp-extended-presenter-notes-heading')?.textContent).toBe('Slide 2');
	expect(notes.getAttribute('aria-label')).toBe('Presenter notes, slide 2');
	expect(body.textContent).toContain('No presenter notes for this slide.');
});

test('dragging the presenter notes handle upward increases panel height', () => {
	const view = createPreviewView();
	const access = marpPreviewViewTestAccess(view);
	const notes = addObsidianDomHelpers(document.createElement('div'));
	const handle = document.createElement('div');
	const body = addObsidianDomHelpers(document.createElement('div'));
	notes.appendChild(handle);
	notes.appendChild(body);
	view.contentEl.appendChild(notes);
	Object.defineProperty(view.contentEl, 'clientHeight', { configurable: true, value: 900 });
	notes.getBoundingClientRect = () => ({ height: 160, bottom: 900 } as DOMRect);
	access.presenterNotesEl = notes;
	access.presenterNotesResizeEl = handle;
	access.presenterNotesBodyEl = body;
	access.registerPresenterNotesResize();
	view.togglePresenterNotes();

	const pointerEvent = (type: string, clientY = 0) => {
		const event = new Event(type, { bubbles: true }) as Event & { button: number; clientY: number };
		event.button = 0;
		event.clientY = clientY;
		return event;
	};
	handle.dispatchEvent(pointerEvent('pointerdown', 740));
	window.dispatchEvent(pointerEvent('pointermove', 300));
	window.dispatchEvent(pointerEvent('pointerup'));

	expect(access.presenterNotesHeight).toBe(600);
	expect(notes.style.getPropertyValue('--marp-extended-presenter-notes-height')).toBe('600px');
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

test('preview scrolling moves reading view to the matching source section', async () => {
	const view = createPreviewView();
	const access = marpPreviewViewTestAccess(view);
	const container = access.previewContainerEl;
	const iframe = access.previewIframeEl;
	const first = document.createElement('div');
	const second = document.createElement('div');
	if (!container || !iframe) throw new Error('Preview harness missing container or iframe');

	const readingRoot = document.createElement('div');
	const readingScroller = document.createElement('div');
	readingScroller.className = 'markdown-preview-view';
	Object.defineProperty(readingRoot, 'scrollHeight', { value: 200 });
	Object.defineProperty(readingRoot, 'clientHeight', { value: 200 });
	const firstSection = document.createElement('div');
	const secondSection = document.createElement('div');
	firstSection.setAttribute('data-marp-extended-source-line-start', '3');
	secondSection.setAttribute('data-marp-extended-source-line-start', '6');
	readingScroller.append(firstSection, secondSection);
	readingRoot.appendChild(readingScroller);
	readingScroller.getBoundingClientRect = () => ({ top: 100 } as DOMRect);
	firstSection.getBoundingClientRect = () => ({ top: 100 } as DOMRect);
	secondSection.getBoundingClientRect = () => ({ top: 300 } as DOMRect);
	readingScroller.scrollTop = 0;

	const file = { path: 'slides/deck.md' } as TFile;
	access.file = file;
	access.sourceView = {
		file,
		getMode: () => 'preview',
		getViewData: () => '---\ntheme: default\n---\n# First\n\n---\n\n# Second',
		previewMode: { containerEl: readingRoot },
	} as unknown as MarkdownView;
	access.previewSlideEls = [first, second];
	container.getBoundingClientRect = () => ({ top: 100 } as DOMRect);
	iframe.getBoundingClientRect = () => ({ top: -500 } as DOMRect);
	first.getBoundingClientRect = () => ({ top: 0 } as DOMRect);
	second.getBoundingClientRect = () => ({ top: 600 } as DOMRect);
	access.registerPreviewScrollTracking();

	container.dispatchEvent(new Event('scroll'));
	await new Promise((resolve) => window.requestAnimationFrame(resolve));

	expect(access.activeSlideIndex).toBe(1);
	expect(readingScroller.scrollTop).toBe(200);
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
