import type { App } from 'obsidian';
import { afterEach, expect, test } from '@jest/globals';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import * as crypto from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ensureEngineArtifact } from '@/runtime/engineArtifact';

const tempDirectories: string[] = [];

function createApp(root: string): App {
	return {
		vault: {
			adapter: { getBasePath: () => root },
		},
	} as unknown as App;
}

afterEach(() => {
	for (const directory of tempDirectories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('materializes the embedded engine and replaces a corrupt installed copy', async () => {
	const root = mkdtempSync(join(tmpdir(), 'marp-engine-artifact-'));
	tempDirectories.push(root);
	const app = createApp(root);
	const pluginDir = '.obsidian/plugins/marp-extended';
	const target = await ensureEngineArtifact(app, pluginDir);

	expect(target).toBe(join(root, pluginDir, 'marp-engine-ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad.cjs'));
	expect(readFileSync(target, 'utf-8')).toBe('abc');
	writeFileSync(target, 'corrupt', 'utf-8');

	expect(await ensureEngineArtifact(app, pluginDir)).toBe(target);
	expect(readFileSync(target, 'utf-8')).toBe('abc');
	expect(existsSync(`${target}.tmp`)).toBe(false);
});

test('uses an installed release engine when its hash already matches', async () => {
	const root = mkdtempSync(join(tmpdir(), 'marp-engine-artifact-release-'));
	tempDirectories.push(root);
	const pluginDir = '.obsidian/plugins/marp-extended';
	const target = join(root, pluginDir, 'marp-engine.cjs');
	fs.mkdirSync(join(root, pluginDir), { recursive: true });
	writeFileSync(target, 'abc', 'utf-8');

	expect(await ensureEngineArtifact(createApp(root), pluginDir)).toBe(target);
});

test('accepts a matching artifact installed by a concurrent rename winner', async () => {
	const root = mkdtempSync(join(tmpdir(), 'marp-engine-artifact-race-'));
	tempDirectories.push(root);
	const dependencies = {
		fs: {
			...fs,
			renameSync: (source: fs.PathLike, destination: fs.PathLike) => {
				fs.copyFileSync(source, destination);
				throw Object.assign(new Error('target exists'), { code: 'EEXIST' });
			},
		} as typeof fs,
		path,
		zlib,
		crypto,
	};

	const target = await ensureEngineArtifact(createApp(root), '.obsidian/plugins/marp-extended', undefined, dependencies);

	expect(readFileSync(target, 'utf-8')).toBe('abc');
	expect(fs.readdirSync(join(root, '.obsidian/plugins/marp-extended')).filter((name) => name.includes('.tmp-'))).toEqual([]);
});

test('rejects an invalid embedded hash before creating the engine file', async () => {
	const root = mkdtempSync(join(tmpdir(), 'marp-engine-artifact-invalid-'));
	tempDirectories.push(root);
	const app = createApp(root);

	await expect(ensureEngineArtifact(app, '.obsidian/plugins/marp-extended', {
		brotliBase64: 'CwGAYWJjAw==',
		sha256: '0'.repeat(64),
	})).rejects.toThrow('SHA-256 integrity check');
	expect(existsSync(join(root, '.obsidian/plugins/marp-extended/marp-engine.cjs'))).toBe(false);
});

test('requires the installed plugin directory before materializing the engine', async () => {
	const root = mkdtempSync(join(tmpdir(), 'marp-engine-artifact-dir-'));
	tempDirectories.push(root);

	await expect(ensureEngineArtifact(createApp(root), undefined)).rejects.toThrow('manifest.dir is unavailable');
});
