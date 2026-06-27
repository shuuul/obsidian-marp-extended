import { App } from 'obsidian';
import { afterEach, expect, test } from '@jest/globals';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Libs } from '@/utilities/libs';
import { DEFAULT_SETTINGS } from '@/utilities/settings';

type AdapterWithFullPath = App['vault']['adapter'] & { getFullPath(path: string): string };

const tempDirectories: string[] = [];

function createApp(root: string): App {
	const app = {
		vault: {
			configDir: '.obsidian',
			adapter: {
				getFullPath: (path: string) => join(root, path),
			},
		},
	} as unknown as App;

	(app.vault.adapter as AdapterWithFullPath).getFullPath = (path: string) => join(root, path);
	return app;
}

afterEach(() => {
	for (const directory of tempDirectories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('loadLibs repairs existing Marp engine config to use bundled markdown-it plugins', async () => {
	const root = mkdtempSync(join(tmpdir(), 'marp-libs-'));
	tempDirectories.push(root);
	const libRoot = join(root, '.obsidian/plugins/marp-extended/lib3');
	const markPath = join(libRoot, 'markdown-it/markdown-it-mark/dist');
	const containerPath = join(libRoot, 'markdown-it/markdown-it-container/dist');
	const enginePath = join(libRoot, 'marp.config.js');
	mkdirSync(markPath, { recursive: true });
	mkdirSync(containerPath, { recursive: true });
	writeFileSync(enginePath, 'module.exports = () => "stale";', 'utf-8');
	writeFileSync(join(markPath, 'markdown-it-mark.min.js'), 'module.exports = function mark(md) { return md; };', 'utf-8');
	writeFileSync(join(containerPath, 'markdown-it-container.min.js'), 'module.exports = function container(md) { return md; };', 'utf-8');

	await new Libs(DEFAULT_SETTINGS).loadLibs(createApp(root));

	const engineConfig = readFileSync(enginePath, 'utf-8');
	expect(engineConfig).toContain('markdown-it-mark');
	expect(engineConfig).toContain('markdown-it-container');
	expect(engineConfig).not.toContain('markdownItKroki');
	expect(engineConfig).not.toContain('@kazumatu981/markdown-it-kroki');
	expect(existsSync(enginePath)).toBe(true);

	delete require.cache[enginePath];
	const configure = require(enginePath) as (context: { marp: { use: (...args: unknown[]) => unknown } }) => unknown;
	const usedPlugins: unknown[][] = [];
	const marp = {
		use: (...args: unknown[]) => {
			usedPlugins.push(args);
			return marp;
		},
	};

	expect(() => configure({ marp })).not.toThrow();
	expect(usedPlugins).toHaveLength(2);
	expect(usedPlugins[1][1]).toBe('container');
});
