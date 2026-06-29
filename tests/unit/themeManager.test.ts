import { FileSystemAdapter } from 'obsidian';
import { expect, test } from '@jest/globals';

import { DEFAULT_THEME_DEFINITIONS, DEFAULT_THEME_DIRECTORY, normalizeThemeName, parseThemeNameFromCss, parseThemeSizeNamesFromCss, themeNameToFileName } from '@/utilities/defaultThemes';
import { DEFAULT_MERMAID_THEME_DEFINITIONS, DEFAULT_MERMAID_THEME_DIRECTORY, parseMermaidThemeNameFromCss } from '@/utilities/defaultMermaidThemes';
import { MermaidThemeManager } from '@/utilities/mermaidThemeManager';
import { ThemeManager } from '@/utilities/themeManager';
import { ensureDefaultThemes } from '@/utilities/ensureDefaultThemes';
import { ensureDefaultMermaidThemes } from '@/utilities/ensureDefaultMermaidThemes';

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
	expect(parseMermaidThemeNameFromCss('/* @mermaid-theme kami */\nsection {}')).toBe('kami');
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

test('custom Marp themes cannot overwrite bundled default names', async () => {
	const adapter = new FileSystemAdapter();
	const manager = new ThemeManager(createApp(adapter));

	await expect(manager.addThemeFromCss('section { color: red; }', 'kami'))
		.rejects.toThrow('Bundled default themes cannot be overwritten');
	await expect(manager.addThemeFromCss('/* @theme github */\nsection {}'))
		.rejects.toThrow('Bundled default themes cannot be overwritten');
});

test('custom Marp themes can be edited and renamed', async () => {
	const adapter = new FileSystemAdapter();
	const manager = new ThemeManager(createApp(adapter));
	const entry = await manager.addThemeFromCss('section { color: red; }', 'local');

	const updated = await manager.updateCustomThemeFromCss(entry.path, '/* @theme local */\nsection { color: blue; }', 'Local Updated!');

	expect(updated).toEqual({
		name: 'local-updated',
		fileName: 'local-updated.css',
		path: `${DEFAULT_THEME_DIRECTORY}/local-updated.css`,
		source: 'custom',
	});
	expect(await adapter.exists(entry.path)).toBe(false);
	expect(await adapter.read(updated.path)).toContain('/* @theme local-updated */');
	expect(await adapter.read(updated.path)).toContain('color: blue');
});

test('default Marp themes can be forked but not edited directly', async () => {
	const adapter = new FileSystemAdapter();
	await adapter.mkdir('.marp-extended');
	await adapter.mkdir(DEFAULT_THEME_DIRECTORY);
	await adapter.write(`${DEFAULT_THEME_DIRECTORY}/kami.css`, DEFAULT_THEME_DEFINITIONS[0].css);
	const manager = new ThemeManager(createApp(adapter));

	const forked = await manager.forkDefaultTheme('kami');

	expect(forked).toEqual({
		name: 'kami-fork',
		fileName: 'kami-fork.css',
		path: `${DEFAULT_THEME_DIRECTORY}/kami-fork.css`,
		source: 'custom',
	});
	expect(await adapter.read(forked.path)).toContain('/* @theme kami-fork */');
	await expect(manager.updateCustomThemeFromCss(`${DEFAULT_THEME_DIRECTORY}/kami.css`, 'section {}', 'kami'))
		.rejects.toThrow('Bundled default themes cannot be edited');
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

test('default theme refresh writes every packaged default theme', async () => {
	const adapter = new FileSystemAdapter();

	const manager = new ThemeManager(createApp(adapter));
	const installed = await manager.ensureDefaultThemes({ overwrite: true });

	expect(installed).toEqual(DEFAULT_THEME_DEFINITIONS.map((theme) => theme.name));
	expect(await adapter.read(`${DEFAULT_THEME_DIRECTORY}/${DEFAULT_THEME_DEFINITIONS[0].fileName}`)).toContain('/* @theme kami */');
	expect(await adapter.read(`${DEFAULT_THEME_DIRECTORY}/${DEFAULT_THEME_DEFINITIONS[0].fileName}`)).not.toContain('@marp-extended-theme-');
});

test('startup default theme ensure always overwrites installed defaults from package CSS', async () => {
	const adapter = new FileSystemAdapter();
	await adapter.mkdir('.marp-extended');
	await adapter.mkdir(DEFAULT_THEME_DIRECTORY);
	await adapter.write(`${DEFAULT_THEME_DIRECTORY}/kami.css`, '/* @theme kami */\nsection { color: red; }');
	const plugin = {
		app: createApp(adapter),
	};

	await ensureDefaultThemes(plugin as any);

	expect(await adapter.read(`${DEFAULT_THEME_DIRECTORY}/kami.css`)).toBe(DEFAULT_THEME_DEFINITIONS[0].css.endsWith('\n') ? DEFAULT_THEME_DEFINITIONS[0].css : `${DEFAULT_THEME_DEFINITIONS[0].css}\n`);
});

test('default Mermaid theme refresh writes every packaged default theme', async () => {
	const adapter = new FileSystemAdapter();

	const manager = new MermaidThemeManager(createApp(adapter));
	const installed = await manager.ensureDefaultThemes({ overwrite: true });

	expect(installed).toEqual(DEFAULT_MERMAID_THEME_DEFINITIONS.map((theme) => theme.name));
	expect(await adapter.read(`${DEFAULT_MERMAID_THEME_DIRECTORY}/${DEFAULT_MERMAID_THEME_DEFINITIONS[0].fileName}`)).toContain('/* @mermaid-theme kami */');
	expect(await adapter.read(`${DEFAULT_MERMAID_THEME_DIRECTORY}/${DEFAULT_MERMAID_THEME_DEFINITIONS[0].fileName}`)).not.toContain('@marp-extended-mermaid-theme-');
});

test('custom Mermaid themes cannot overwrite bundled default names', async () => {
	const adapter = new FileSystemAdapter();
	const manager = new MermaidThemeManager(createApp(adapter));

	await expect(manager.addThemeFromCss('section .mermaid-diagram-container svg {}', 'kami'))
		.rejects.toThrow('Bundled default Mermaid themes cannot be overwritten');
	await expect(manager.addThemeFromCss('/* @mermaid-theme github */\nsection .mermaid-diagram-container svg {}'))
		.rejects.toThrow('Bundled default Mermaid themes cannot be overwritten');
});

test('custom Mermaid themes can be edited and renamed', async () => {
	const adapter = new FileSystemAdapter();
	const manager = new MermaidThemeManager(createApp(adapter));
	const entry = await manager.addThemeFromCss('section .mermaid-diagram-container svg { --accent: red; }', 'local');

	const updated = await manager.updateCustomThemeFromCss(entry.path, '/* @mermaid-theme local */\nsection .mermaid-diagram-container svg { --accent: blue; }', 'Local Updated!');

	expect(updated).toEqual({
		name: 'local-updated',
		fileName: 'local-updated.css',
		path: `${DEFAULT_MERMAID_THEME_DIRECTORY}/local-updated.css`,
		source: 'custom',
	});
	expect(await adapter.exists(entry.path)).toBe(false);
	expect(await adapter.read(updated.path)).toContain('/* @mermaid-theme local-updated */');
	expect(await adapter.read(updated.path)).toContain('--accent: blue');
});

test('default Mermaid themes can be forked but not edited directly', async () => {
	const adapter = new FileSystemAdapter();
	await adapter.mkdir('.marp-extended');
	await adapter.mkdir(DEFAULT_MERMAID_THEME_DIRECTORY);
	await adapter.write(`${DEFAULT_MERMAID_THEME_DIRECTORY}/kami.css`, DEFAULT_MERMAID_THEME_DEFINITIONS[0].css);
	const manager = new MermaidThemeManager(createApp(adapter));

	const forked = await manager.forkDefaultTheme('kami');

	expect(forked).toEqual({
		name: 'kami-fork',
		fileName: 'kami-fork.css',
		path: `${DEFAULT_MERMAID_THEME_DIRECTORY}/kami-fork.css`,
		source: 'custom',
	});
	expect(await adapter.read(forked.path)).toContain('/* @mermaid-theme kami-fork */');
	await expect(manager.updateCustomThemeFromCss(`${DEFAULT_MERMAID_THEME_DIRECTORY}/kami.css`, 'section {}', 'kami'))
		.rejects.toThrow('Bundled default Mermaid themes cannot be edited');
});

test('startup Mermaid theme ensure always overwrites installed defaults from package CSS', async () => {
	const adapter = new FileSystemAdapter();
	await adapter.mkdir('.marp-extended');
	await adapter.mkdir(DEFAULT_MERMAID_THEME_DIRECTORY);
	await adapter.write(`${DEFAULT_MERMAID_THEME_DIRECTORY}/kami.css`, '/* @mermaid-theme kami */\nsection { color: red; }');
	const plugin = {
		app: createApp(adapter),
	};

	await ensureDefaultMermaidThemes(plugin as any);

	expect(await adapter.read(`${DEFAULT_MERMAID_THEME_DIRECTORY}/kami.css`)).toBe(DEFAULT_MERMAID_THEME_DEFINITIONS[0].css.endsWith('\n') ? DEFAULT_MERMAID_THEME_DEFINITIONS[0].css : `${DEFAULT_MERMAID_THEME_DEFINITIONS[0].css}\n`);
});

test('Mermaid theme CSS loads directly from normalized theme file', async () => {
	const adapter = new FileSystemAdapter();
	await adapter.mkdir('.marp-extended');
	await adapter.mkdir(DEFAULT_MERMAID_THEME_DIRECTORY);
	await adapter.write(`${DEFAULT_MERMAID_THEME_DIRECTORY}/dracula.css`, '/* @mermaid-theme dracula */\nsection .mermaid-diagram-container svg { --accent: pink; }');
	await adapter.write(`${DEFAULT_MERMAID_THEME_DIRECTORY}/other.css`, '/* @mermaid-theme other */\nsection .mermaid-diagram-container svg {}');
	const readSpy = jest.spyOn(adapter, 'read');
	const listSpy = jest.spyOn(adapter, 'list');

	const manager = new MermaidThemeManager(createApp(adapter));
	const css = await manager.loadThemeCss('Dracula');

	expect(css).toContain('--accent: pink');
	expect(readSpy).toHaveBeenCalledTimes(1);
	expect(readSpy).toHaveBeenCalledWith(`${DEFAULT_MERMAID_THEME_DIRECTORY}/dracula.css`);
	expect(listSpy).not.toHaveBeenCalled();
});
