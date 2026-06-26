import { FileSystemAdapter } from 'obsidian';
import { expect, test } from '@jest/globals';

import { DEFAULT_THEME_DIRECTORY, normalizeThemeName, parseThemeNameFromCss, parseThemeSizeNamesFromCss, themeNameToFileName } from '@/utilities/defaultThemes';
import { ThemeManager } from '@/utilities/themeManager';

function createApp(adapter: any): any {
	return {
		vault: {
			adapter,
		},
	};
}

test('theme metadata helpers parse and sanitize theme names', () => {
	expect(parseThemeNameFromCss('/* @theme minimal-turquoise */\nsection {}')).toBe('minimal-turquoise');
	expect(parseThemeNameFromCss('section {}')).toBeNull();
	expect(normalizeThemeName('My Theme!')).toBe('my-theme');
	expect(themeNameToFileName('My Theme!')).toBe('my-theme.css');
	expect(parseThemeSizeNamesFromCss('/* @size 16:9 1280px 720px */\n/* @size print-wide 280mm 158mm */')).toEqual(['16:9', 'print-wide']);
	expect(parseThemeSizeNamesFromCss('/* @size 4:3 false */')).toEqual([]);
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
	});
	expect(await adapter.read(entry.path)).toContain('/* @theme my-theme */');
	expect((await manager.listThemes())[0].source).toBe('custom');
});

test('theme list includes default themes before custom themes in managed directory', async () => {
	const adapter = new FileSystemAdapter();
	await adapter.mkdir('.marp-extended');
	await adapter.mkdir(DEFAULT_THEME_DIRECTORY);
	await adapter.write(`${DEFAULT_THEME_DIRECTORY}/kami.css`, '/* @theme kami */\nsection {}');
	await adapter.write(`${DEFAULT_THEME_DIRECTORY}/local.css`, '/* @theme local */\nsection {}');

	const manager = new ThemeManager(createApp(adapter));

	const themes = await manager.listThemes();
	expect(themes.map((theme) => `${theme.source}:${theme.name}`)).toEqual([
		'default:kami',
		'custom:local',
	]);
});
