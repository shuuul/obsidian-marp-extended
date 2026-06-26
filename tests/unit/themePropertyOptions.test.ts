import { FileSystemAdapter } from 'obsidian';
import { expect, jest, test } from '@jest/globals';

import { DEFAULT_THEME_DIRECTORY } from '@/utilities/defaultThemes';
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
