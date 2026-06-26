import { FileSystemAdapter, requestUrl } from 'obsidian';
import { beforeEach, expect, test } from '@jest/globals';

import { ThemeAssetCache, THEME_ASSET_CACHE_DIRECTORY } from '@/utilities/themeAssetCache';

function createApp(adapter: any): any {
	return {
		vault: {
			adapter,
		},
	};
}

function arrayBufferFromBytes(bytes: number[]): ArrayBuffer {
	return new Uint8Array(bytes).buffer;
}

beforeEach(() => {
	(requestUrl as jest.Mock).mockReset();
});

test('theme asset cache rewrites remote CSS imports and nested font URLs to vault resources', async () => {
	const adapter = new FileSystemAdapter();
	const sourceCss = '@import url("https://fonts.googleapis.com/css?family=Test");\nsection { font-family: Test; }';
	const fontBytes = arrayBufferFromBytes([1, 2, 3]);

	(requestUrl as jest.Mock).mockImplementation(async (request: { url: string }) => {
		if (request.url === 'https://fonts.googleapis.com/css?family=Test') {
			return {
				status: 200,
				headers: {},
				text: '@font-face { font-family: Test; src: url("https://fonts.gstatic.com/test.woff2") format("woff2"); }',
				arrayBuffer: arrayBufferFromBytes([]),
			};
		}

		if (request.url === 'https://fonts.gstatic.com/test.woff2') {
			return {
				status: 200,
				headers: {},
				text: '',
				arrayBuffer: fontBytes,
			};
		}

		throw new Error(`Unexpected request: ${request.url}`);
	});

	const cache = new ThemeAssetCache(createApp(adapter));
	const rewrittenCss = await cache.rewriteRemoteAssets(sourceCss);

	expect(rewrittenCss).toMatch(/@import url\("app:\/\/local\/\.marp-extended\/cache\/theme-assets\/.*\.css\?aaaa"\);/);
	expect(rewrittenCss).not.toContain('fonts.googleapis.com');
	expect(requestUrl).toHaveBeenCalledTimes(2);

	const cachedFiles = (await adapter.list(THEME_ASSET_CACHE_DIRECTORY)).files;
	const cachedCssPath = cachedFiles.find((path) => path.endsWith('.css'));
	const cachedFontPath = cachedFiles.find((path) => path.endsWith('.woff2'));
	expect(cachedCssPath).toBeDefined();
	expect(cachedFontPath).toBeDefined();

	const cachedCss = await adapter.read(cachedCssPath as string);
	expect(cachedCss).toContain('@font-face');
	expect(cachedCss).toContain(`app://local/${cachedFontPath}?aaaa`);
	expect(cachedCss).not.toContain('fonts.gstatic.com');
	expect((await adapter.readBinary(cachedFontPath as string)).byteLength).toBe(3);

	(requestUrl as jest.Mock).mockClear();
	const freshCache = new ThemeAssetCache(createApp(adapter));
	const rewrittenFromCache = await freshCache.rewriteRemoteAssets(sourceCss);

	expect(rewrittenFromCache).toBe(rewrittenCss);
	expect(requestUrl).not.toHaveBeenCalled();
});

test('theme asset cache leaves local imports and relative URLs unchanged', async () => {
	const adapter = new FileSystemAdapter();
	const sourceCss = '@import "default";\nsection { background: url("./local.png"); mask: url(data:image/png;base64,aaa); }';

	const cache = new ThemeAssetCache(createApp(adapter));
	const rewrittenCss = await cache.rewriteRemoteAssets(sourceCss);

	expect(rewrittenCss).toBe(sourceCss);
	expect(requestUrl).not.toHaveBeenCalled();
});

test('theme asset cache leaves failed remote imports unchanged', async () => {
	const adapter = new FileSystemAdapter();
	const sourceCss = '@import url("https://example.com/theme.css");\nsection { color: red; }';
	const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
	(requestUrl as jest.Mock).mockResolvedValue({
		status: 500,
		headers: {},
		text: '',
		arrayBuffer: arrayBufferFromBytes([]),
	});

	try {
		const cache = new ThemeAssetCache(createApp(adapter));
		const rewrittenCss = await cache.rewriteRemoteAssets(sourceCss);

		expect(rewrittenCss).toBe(sourceCss);
		expect(requestUrl).toHaveBeenCalledTimes(1);
		expect((await adapter.list(THEME_ASSET_CACHE_DIRECTORY)).files).toEqual([]);
	} finally {
		warnSpy.mockRestore();
	}
});

test('theme asset cache does not persist partially rewritten imported CSS', async () => {
	const adapter = new FileSystemAdapter();
	const sourceCss = '@import url("https://example.com/theme.css");\nsection { color: red; }';
	const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
	(requestUrl as jest.Mock).mockImplementation(async (request: { url: string }) => {
		if (request.url === 'https://example.com/theme.css') {
			return {
				status: 200,
				headers: {},
				text: '@font-face { font-family: Remote; src: url("https://example.com/remote.woff2"); }',
				arrayBuffer: arrayBufferFromBytes([]),
			};
		}

		return {
			status: 500,
			headers: {},
			text: '',
			arrayBuffer: arrayBufferFromBytes([]),
		};
	});

	try {
		const cache = new ThemeAssetCache(createApp(adapter));
		const rewrittenCss = await cache.rewriteRemoteAssets(sourceCss);

		expect(rewrittenCss).toBe(sourceCss);
		expect(requestUrl).toHaveBeenCalledTimes(2);
		expect((await adapter.list(THEME_ASSET_CACHE_DIRECTORY)).files).toEqual([]);
	} finally {
		warnSpy.mockRestore();
	}
});
