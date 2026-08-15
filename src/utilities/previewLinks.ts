import { getInternalLinkpathFromHref } from '@marp-extended/wiki-links';

const HTTP_PROTOCOL = 'http:';
const HTTPS_PROTOCOL = 'https:';
const ABSOLUTE_SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;

export type OpenInternalPreviewLink = (linkpath: string, newLeaf: boolean) => boolean;

type ElectronShell = {
	openExternal?: (url: string) => unknown;
};

type ElectronModule = {
	shell?: ElectronShell;
};

export type OpenExternalPreviewUrlOptions = {
	openWindow?: (url: string, target?: string, features?: string) => Window | null;
	openExternal?: (url: string) => unknown;
};

export function getExternalPreviewUrl(href: string, baseHref?: string): string | null {
	const trimmed = href.trim();
	if (!trimmed || trimmed.startsWith('#')) {
		return null;
	}

	try {
		const resolved = resolvePreviewHref(trimmed, baseHref);
		if (!resolved) {
			return null;
		}
		if (resolved.protocol !== HTTP_PROTOCOL && resolved.protocol !== HTTPS_PROTOCOL) {
			return null;
		}
		return resolved.href;
	} catch {
		return null;
	}
}

export function openExternalPreviewUrl(url: string, options: OpenExternalPreviewUrlOptions = {}): boolean {
	const openExternal = options.openExternal ?? getElectronOpenExternal();
	if (openExternal) {
		try {
			void openExternal(url);
			return true;
		} catch {
			// Fall through to window.open when Electron cannot launch the URL.
		}
	}

	const openWindow = options.openWindow ?? ((href, target, features) => window.open(href, target, features));
	return openWindow(url, '_blank', 'noopener,noreferrer') != null;
}

export function handlePreviewLinkActivation(
	event: Event,
	openUrl: (url: string) => boolean = openExternalPreviewUrl,
	openInternalLink?: OpenInternalPreviewLink,
): boolean {
	if (event.defaultPrevented || !shouldHandlePreviewLinkEvent(event)) {
		return false;
	}

	const anchor = getActivatedAnchor(event.target);
	if (!anchor) {
		return false;
	}

	const href = anchor.getAttribute('href');
	if (!href) {
		return false;
	}

	const internalLinkpath = getInternalLinkpathFromHref(href);
	if (internalLinkpath) {
		if (!openInternalLink) {
			return false;
		}
		event.preventDefault();
		event.stopPropagation();
		return openInternalLink(internalLinkpath, shouldOpenInNewLeaf(event));
	}

	const url = getExternalPreviewUrl(href, anchor.baseURI || anchor.ownerDocument?.baseURI);
	if (!url) {
		return false;
	}

	event.preventDefault();
	event.stopPropagation();
	openUrl(url);
	return true;
}

function resolvePreviewHref(href: string, baseHref?: string): URL | null {
	if (href.startsWith('//')) {
		return new URL(`https:${href}`);
	}

	if (ABSOLUTE_SCHEME_PATTERN.test(href)) {
		return new URL(href);
	}

	if (!baseHref) {
		return null;
	}

	return new URL(href, baseHref);
}

function shouldHandlePreviewLinkEvent(event: Event): boolean {
	const button = getMouseButton(event);

	if (event.type === 'auxclick') {
		return button === 1;
	}

	return event.type === 'click' && button === 0;
}

function shouldOpenInNewLeaf(event: Event): boolean {
	if (event.type === 'auxclick') {
		return true;
	}

	const mouseEvent = event as Partial<MouseEvent>;
	return mouseEvent.metaKey === true || mouseEvent.ctrlKey === true;
}

function getMouseButton(event: Event): number {
	const button = (event as Partial<MouseEvent>).button;
	return typeof button === 'number' ? button : 0;
}

function getActivatedAnchor(target: EventTarget | null): HTMLAnchorElement | null {
	const element = getClosestElement(target);
	if (!element) {
		return null;
	}

	const anchor = element.closest('a[href]');
	if (!anchor || typeof (anchor as HTMLAnchorElement).getAttribute !== 'function') {
		return null;
	}

	return anchor as HTMLAnchorElement;
}

function getClosestElement(target: EventTarget | null): Element | null {
	let node = target as Node | null;
	while (node && typeof (node as Element).closest !== 'function') {
		node = node.parentNode;
	}

	return node && typeof (node as Element).closest === 'function'
		? node as Element
		: null;
}

function getElectronOpenExternal(): ((url: string) => unknown) | undefined {
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports -- Obsidian desktop exposes Electron through CommonJS.
		const electron = require('electron') as ElectronModule;
		if (typeof electron.shell?.openExternal === 'function') {
			return (url) => electron.shell?.openExternal?.(url);
		}
	} catch {
		return undefined;
	}

	return undefined;
}
