/** @jest-environment jsdom */

import { expect, jest, test } from '@jest/globals';

import {
	getExternalPreviewUrl,
	handlePreviewLinkActivation,
	openExternalPreviewUrl,
	type OpenInternalPreviewLink,
} from '@/utilities/previewLinks';
import { buildObsidianOpenHref } from '@/utilities/wikiLinks';

const YOUTUBE_URL = 'https://www.youtube.com/watch?v=mGhvK8xJP1w';

test('getExternalPreviewUrl accepts only http(s) destinations', () => {
	expect(getExternalPreviewUrl(YOUTUBE_URL)).toBe(YOUTUBE_URL);
	expect(getExternalPreviewUrl('http://example.com/notes')).toBe('http://example.com/notes');
	expect(getExternalPreviewUrl('//www.youtube.com/watch?v=mGhvK8xJP1w')).toBe(YOUTUBE_URL);
	expect(getExternalPreviewUrl('obsidian://open?file=deck.md')).toBeNull();
	expect(getExternalPreviewUrl('app://local/slides/deck.md')).toBeNull();
	expect(getExternalPreviewUrl('../assets/photo.png', 'app://local/slides/')).toBeNull();
	expect(getExternalPreviewUrl('deck.md')).toBeNull();
	expect(getExternalPreviewUrl('#section')).toBeNull();
	expect(getExternalPreviewUrl('')).toBeNull();
});

test('openExternalPreviewUrl prefers Electron and falls back to window.open', () => {
	const openExternal = jest.fn<(url: string) => void>();
	expect(openExternalPreviewUrl(YOUTUBE_URL, { openExternal })).toBe(true);
	expect(openExternal).toHaveBeenCalledWith(YOUTUBE_URL);

	const openWindow = jest.fn<(url: string, target?: string, features?: string) => Window | null>(
		() => ({} as Window),
	);
	expect(openExternalPreviewUrl(YOUTUBE_URL, {
		openExternal: () => {
			throw new Error('electron unavailable');
		},
		openWindow,
	})).toBe(true);
	expect(openWindow).toHaveBeenCalledWith(YOUTUBE_URL, '_blank', 'noopener,noreferrer');
});

test('handlePreviewLinkActivation opens YouTube links and leaves vault links alone', () => {
	const openUrl = jest.fn<(url: string) => boolean>(() => true);
	const externalEvent = createAnchorEvent(YOUTUBE_URL);
	expect(handlePreviewLinkActivation(externalEvent, openUrl)).toBe(true);
	expect(externalEvent.defaultPrevented).toBe(true);
	expect(openUrl).toHaveBeenCalledWith(YOUTUBE_URL);

	openUrl.mockClear();
	const vaultEvent = createAnchorEvent('../assets/photo.png', 'app://local/slides/');
	expect(handlePreviewLinkActivation(vaultEvent, openUrl)).toBe(false);
	expect(vaultEvent.defaultPrevented).toBe(false);
	expect(openUrl).not.toHaveBeenCalled();
});

test('handlePreviewLinkActivation follows nested clicks and middle-clicks', () => {
	const openUrl = jest.fn<(url: string) => boolean>(() => true);
	const { event, textEvent } = createNestedAnchorEvent(YOUTUBE_URL);
	expect(handlePreviewLinkActivation(event, openUrl)).toBe(true);
	expect(openUrl).toHaveBeenCalledWith(YOUTUBE_URL);

	openUrl.mockClear();
	expect(handlePreviewLinkActivation(textEvent, openUrl)).toBe(true);
	expect(openUrl).toHaveBeenCalledWith(YOUTUBE_URL);

	openUrl.mockClear();
	const middleClick = createAnchorEvent(YOUTUBE_URL, undefined, { type: 'auxclick', button: 1 });
	expect(handlePreviewLinkActivation(middleClick, openUrl)).toBe(true);
	expect(openUrl).toHaveBeenCalledWith(YOUTUBE_URL);

	openUrl.mockClear();
	const rightClick = createAnchorEvent(YOUTUBE_URL, undefined, { type: 'auxclick', button: 2 });
	expect(handlePreviewLinkActivation(rightClick, openUrl)).toBe(false);
	expect(openUrl).not.toHaveBeenCalled();
});

test('handlePreviewLinkActivation routes obsidian://open links to the internal handler', () => {
	const linkpath = 'sources/transcripts/聊聊朱镕基那个时代和经济政策';
	const href = buildObsidianOpenHref(linkpath);
	const openUrl = jest.fn<(url: string) => boolean>(() => true);
	const openInternalLink = jest.fn<OpenInternalPreviewLink>(() => true);

	const clickEvent = createAnchorEvent(href);
	expect(handlePreviewLinkActivation(clickEvent, openUrl, openInternalLink)).toBe(true);
	expect(clickEvent.defaultPrevented).toBe(true);
	expect(openInternalLink).toHaveBeenCalledWith(linkpath, false);
	expect(openUrl).not.toHaveBeenCalled();

	openInternalLink.mockClear();
	const middleClick = createAnchorEvent(href, undefined, { type: 'auxclick', button: 1 });
	expect(handlePreviewLinkActivation(middleClick, openUrl, openInternalLink)).toBe(true);
	expect(openInternalLink).toHaveBeenCalledWith(linkpath, true);

	openInternalLink.mockClear();
	const modClick = createAnchorEvent(href, undefined, { metaKey: true });
	expect(handlePreviewLinkActivation(modClick, openUrl, openInternalLink)).toBe(true);
	expect(openInternalLink).toHaveBeenCalledWith(linkpath, true);
});

test('handlePreviewLinkActivation ignores internal links without a handler', () => {
	const openUrl = jest.fn<(url: string) => boolean>(() => true);
	const event = createAnchorEvent(buildObsidianOpenHref('Note'));
	expect(handlePreviewLinkActivation(event, openUrl)).toBe(false);
	expect(event.defaultPrevented).toBe(false);
	expect(openUrl).not.toHaveBeenCalled();
});

function createAnchorEvent(
	href: string,
	baseHref?: string,
	options: { type?: string; button?: number; metaKey?: boolean } = {},
): MouseEvent {
	const doc = document.implementation.createHTMLDocument('preview');
	if (baseHref) {
		const base = doc.createElement('base');
		base.href = baseHref;
		doc.head.appendChild(base);
	}
	const anchor = doc.createElement('a');
	anchor.setAttribute('href', href);
	anchor.textContent = 'link';
	doc.body.appendChild(anchor);
	return createMouseEvent(anchor, options);
}

function createNestedAnchorEvent(href: string): { event: MouseEvent; textEvent: MouseEvent } {
	const doc = document.implementation.createHTMLDocument('preview');
	const anchor = doc.createElement('a');
	anchor.setAttribute('href', href);
	const label = doc.createElement('span');
	label.textContent = 'nested';
	anchor.appendChild(label);
	doc.body.appendChild(anchor);
	const textNode = label.firstChild;
	if (!textNode) {
		throw new Error('Expected nested link text node');
	}
	return {
		event: createMouseEvent(label),
		textEvent: createMouseEvent(textNode),
	};
}

function createMouseEvent(
	target: EventTarget,
	options: { type?: string; button?: number; metaKey?: boolean } = {},
): MouseEvent {
	const event = new MouseEvent(options.type ?? 'click', {
		bubbles: true,
		button: options.button ?? 0,
		cancelable: true,
		metaKey: options.metaKey ?? false,
	});
	Object.defineProperty(event, 'target', { configurable: true, value: target });
	return event;
}
