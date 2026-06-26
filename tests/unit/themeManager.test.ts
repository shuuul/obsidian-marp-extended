import { FileSystemAdapter, requestUrl } from 'obsidian';
import { beforeEach, expect, test } from '@jest/globals';

import { DEFAULT_THEME_DEFINITIONS, DEFAULT_THEME_DIRECTORY, DEFAULT_THEME_MANIFEST_VERSION, normalizeThemeName, parseDefaultThemeVersionFromCss, parseThemeNameFromCss, parseThemeSizeNamesFromCss, themeNameToFileName } from '@/utilities/defaultThemes';
import { ThemeManager } from '@/utilities/themeManager';

function createApp(adapter: any): any {
	return {
		vault: {
			adapter,
		},
	};
}

beforeEach(() => {
	(requestUrl as jest.Mock).mockReset();
});

test('theme metadata helpers parse and sanitize theme names', () => {
	expect(parseThemeNameFromCss('/* @theme minimal-turquoise */\nsection {}')).toBe('minimal-turquoise');
	expect(parseThemeNameFromCss('section {}')).toBeNull();
	expect(normalizeThemeName('My Theme!')).toBe('my-theme');
	expect(themeNameToFileName('My Theme!')).toBe('my-theme.css');
	expect(parseThemeSizeNamesFromCss('/* @size 16:9 1280px 720px */\n/* @size print-wide 280mm 158mm */')).toEqual(['16:9', 'print-wide']);
	expect(parseThemeSizeNamesFromCss('/* @size 4:3 false */')).toEqual([]);
	expect(parseDefaultThemeVersionFromCss(`/* @marp-extended-theme-version ${DEFAULT_THEME_MANIFEST_VERSION} */`)).toBe(DEFAULT_THEME_MANIFEST_VERSION);
	expect(parseDefaultThemeVersionFromCss('/* @theme custom */\nsection {}')).toBeNull();
});

test('pasted theme CSS is saved under the default theme directory', async () => {
	const adapter = new FileSystemAdapter();
	const manager = new ThemeManager(createApp(adapter));

	const entry = await manager.addThemeFromCss('section { color: red; }', 'My Theme!');

	expect(entry).toEqual({
		name: 'my-theme',
		fileName: 'my-theme.css',
		path: `${DEFAULT_THEME_DIRECTORY}/my-theme.css`,
		source: 'custom',
		version: null,
	});
	expect(await adapter.read(entry.path)).toContain('/* @theme my-theme */');
	expect((await manager.listThemes())[0].source).toBe('custom');
});

test('theme list includes default themes before custom themes in managed directory', async () => {
	const adapter = new FileSystemAdapter();
	await adapter.mkdir('.marp-extended');
	await adapter.mkdir(DEFAULT_THEME_DIRECTORY);
	await adapter.write(`${DEFAULT_THEME_DIRECTORY}/kami.css`, `/* @theme kami */\n/* @marp-extended-theme-version ${DEFAULT_THEME_MANIFEST_VERSION} */\nsection {}`);
	await adapter.write(`${DEFAULT_THEME_DIRECTORY}/local.css`, '/* @theme local */\nsection {}');

	const manager = new ThemeManager(createApp(adapter));

	const themes = await manager.listThemes();
	expect(themes.map((theme) => `${theme.source}:${theme.name}`)).toEqual([
		'default:kami',
		'custom:local',
	]);
	expect(themes[0].version).toBe(DEFAULT_THEME_MANIFEST_VERSION);
});

test('default theme update pulls repo CSS and overwrites the installed file', async () => {
	const adapter = new FileSystemAdapter();
	await adapter.mkdir('.marp-extended');
	await adapter.mkdir(DEFAULT_THEME_DIRECTORY);
	await adapter.write(`${DEFAULT_THEME_DIRECTORY}/kami.css`, '/* @theme kami */\nsection { color: red; }');
	(requestUrl as jest.Mock).mockResolvedValueOnce({
		status: 200,
		text: `/* @theme kami */\n/* @marp-extended-theme-version ${DEFAULT_THEME_MANIFEST_VERSION} */\nsection { color: blue; }`,
	});

	const manager = new ThemeManager(createApp(adapter));
	const entry = await manager.updateDefaultTheme('kami');

	expect(requestUrl).toHaveBeenCalledWith(expect.objectContaining({
		url: expect.stringContaining(`/kami.css?marp-extended-theme-version=${DEFAULT_THEME_MANIFEST_VERSION}`),
	}));
	expect(entry).toEqual({
		name: 'kami',
		fileName: 'kami.css',
		path: `${DEFAULT_THEME_DIRECTORY}/kami.css`,
		source: 'default',
		version: DEFAULT_THEME_MANIFEST_VERSION,
	});
	expect(await adapter.read(entry.path)).toContain('color: blue');
});

test('default theme refresh uses versioned repo URLs for every default theme', async () => {
	const adapter = new FileSystemAdapter();
	(requestUrl as jest.Mock).mockResolvedValue({
		status: 200,
		text: `/* @theme refreshed */\n/* @marp-extended-theme-version ${DEFAULT_THEME_MANIFEST_VERSION} */\nsection { color: blue; }`,
	});

	const manager = new ThemeManager(createApp(adapter));
	const installed = await manager.ensureDefaultThemes({ overwrite: true });

	expect(installed).toEqual(DEFAULT_THEME_DEFINITIONS.map((theme) => theme.name));
	expect(requestUrl).toHaveBeenCalledTimes(DEFAULT_THEME_DEFINITIONS.length);
	expect(requestUrl).toHaveBeenCalledWith(expect.objectContaining({
		url: `${DEFAULT_THEME_DEFINITIONS[0].url}?marp-extended-theme-version=${DEFAULT_THEME_MANIFEST_VERSION}`,
	}));
	expect(await adapter.read(`${DEFAULT_THEME_DIRECTORY}/${DEFAULT_THEME_DEFINITIONS[0].fileName}`)).toContain('color: blue');
});
