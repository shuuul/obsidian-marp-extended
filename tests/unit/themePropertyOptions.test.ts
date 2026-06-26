import { FileSystemAdapter } from 'obsidian';
import { expect, jest, test } from '@jest/globals';

import { DEFAULT_THEME_DIRECTORY } from '@/utilities/defaultThemes';
import { DEFAULT_MERMAID_THEME_DIRECTORY } from '@/utilities/defaultMermaidThemes';
import { MermaidThemeManager } from '@/utilities/mermaidThemeManager';
import { ThemeManager } from '@/utilities/themeManager';
import { ThemePropertyOptions } from '@/utilities/themePropertyOptions';

function createApp(adapter: any, getValues: (key: string) => string[]): any {
	return {
		vault: {
			adapter,
		},
		metadataCache: {
			getFrontmatterPropertyValuesForKey: jest.fn(getValues),
		},
	};
}

test('theme property suggestions include installed Marp themes', async () => {
	const adapter = new FileSystemAdapter();
	await adapter.mkdir('.marp-extended');
	await adapter.mkdir(DEFAULT_THEME_DIRECTORY);
	await adapter.write(`${DEFAULT_THEME_DIRECTORY}/academic.css`, '/* @theme academic */\nsection {}');
	await adapter.write(`${DEFAULT_THEME_DIRECTORY}/kami.css`, '/* @theme kami */\nsection {}');

	const app = createApp(adapter, (key) => key === 'theme' ? ['gaia', 'kami'] : ['draft']);
	const options = new ThemePropertyOptions(app, new ThemeManager(app));

	options.register();
	await options.refresh();

	expect(app.metadataCache.getFrontmatterPropertyValuesForKey('theme')).toEqual([
		'gaia',
		'kami',
		'academic',
	]);
	expect(app.metadataCache.getFrontmatterPropertyValuesForKey('status')).toEqual(['draft']);
});

test('mermaidTheme property suggestions include installed Mermaid themes', async () => {
	const adapter = new FileSystemAdapter();
	await adapter.mkdir('.marp-extended');
	await adapter.mkdir(DEFAULT_MERMAID_THEME_DIRECTORY);
	await adapter.write(`${DEFAULT_MERMAID_THEME_DIRECTORY}/kami.css`, '/* @mermaid-theme kami */\nsection .mermaid-diagram-container svg {}');
	await adapter.write(`${DEFAULT_MERMAID_THEME_DIRECTORY}/dracula.css`, '/* @mermaid-theme dracula */\nsection .mermaid-diagram-container svg {}');

	const app = createApp(adapter, (key) => key === 'mermaidTheme' ? ['local', 'kami'] : []);
	const options = new ThemePropertyOptions(app, new ThemeManager(app), new MermaidThemeManager(app));

	options.register();
	await options.refresh();

	expect(app.metadataCache.getFrontmatterPropertyValuesForKey('mermaidTheme')).toEqual([
		'local',
		'kami',
		'dracula',
	]);
});

test('mermaidFlat property suggestions include boolean values', async () => {
	const adapter = new FileSystemAdapter();
	const app = createApp(adapter, (key) => key === 'mermaidFlat' ? ['true'] : []);
	const options = new ThemePropertyOptions(app, new ThemeManager(app), new MermaidThemeManager(app));

	options.register();
	await options.refresh();

	expect(app.metadataCache.getFrontmatterPropertyValuesForKey('mermaidFlat')).toEqual([
		'true',
		'false',
	]);
});

test('size property suggestions include Marp theme size presets', async () => {
	const adapter = new FileSystemAdapter();
	await adapter.mkdir('.marp-extended');
	await adapter.mkdir(DEFAULT_THEME_DIRECTORY);
	await adapter.write(
		`${DEFAULT_THEME_DIRECTORY}/kami.css`,
		'/* @theme kami */\n/* @size 16:9 1280px 720px */\n/* @size 4:3 960px 720px */\nsection {}'
	);
	await adapter.write(
		`${DEFAULT_THEME_DIRECTORY}/print.css`,
		'/* @theme print */\n/* @size print-wide 280mm 158mm */\n/* @size disabled false */\nsection {}'
	);

	const app = createApp(adapter, (key) => key === 'size' ? ['custom'] : []);
	const options = new ThemePropertyOptions(app, new ThemeManager(app));

	options.register();
	await options.refresh();

	expect(app.metadataCache.getFrontmatterPropertyValuesForKey('size')).toEqual([
		'custom',
		'16:9',
		'4:3',
		'print-wide',
	]);
});

test('theme property suggestions restore original metadata cache method on unregister', async () => {
	const adapter = new FileSystemAdapter();
	const app = createApp(adapter, () => ['original']);
	const originalGetValues = app.metadataCache.getFrontmatterPropertyValuesForKey;
	const options = new ThemePropertyOptions(app, new ThemeManager(app));

	options.register();
	expect(app.metadataCache.getFrontmatterPropertyValuesForKey).not.toBe(originalGetValues);

	options.unregister();
	expect(app.metadataCache.getFrontmatterPropertyValuesForKey).toBe(originalGetValues);
	expect(app.metadataCache.getFrontmatterPropertyValuesForKey('theme')).toEqual(['original']);
});
