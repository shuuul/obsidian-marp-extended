import { TFile } from 'obsidian';
import { afterEach, expect, test } from '@jest/globals';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MarpExport } from '@/utilities/marpExport';
import { DEFAULT_SETTINGS } from '@/utilities/settings';

type AdapterWithFullPath = TFile['vault']['adapter'] & { getFullPath(path: string): string };

type VaultFixture = {
	file: TFile;
	root: string;
};

const tempDirectories: string[] = [];

function createRealExportFixture(): VaultFixture {
	const fixtureVaultRoot = join(process.cwd(), 'vault');
	const tempVaultRoot = mkdtempSync(join(tmpdir(), 'marp-real-export-vault-'));
	const markdownPath = 'samples/Academic.md';
	const attachmentPath = 'attachments/kenkyu_woman_seikou.png';
	const managedThemeDirectory = join(tempVaultRoot, '.marp-extended/themes');
	tempDirectories.push(tempVaultRoot);
	mkdirSync(join(tempVaultRoot, 'samples'), { recursive: true });
	mkdirSync(join(tempVaultRoot, 'attachments'), { recursive: true });
	mkdirSync(managedThemeDirectory, { recursive: true });
	writeFileSync(
		join(tempVaultRoot, markdownPath),
		readFileSync(join(fixtureVaultRoot, markdownPath), 'utf-8'),
		'utf-8',
	);
	writeFileSync(
		join(tempVaultRoot, attachmentPath),
		readFileSync(join(fixtureVaultRoot, attachmentPath)),
	);
	writeFileSync(
		join(managedThemeDirectory, 'academic.css'),
		readFileSync(join(fixtureVaultRoot, 'themes/academic.css'), 'utf-8'),
		'utf-8',
	);

	const file = new TFile() as TFile & {
		basename: string;
		name: string;
		vault: TFile['vault'] & { configDir: string };
	};

	file.path = markdownPath;
	file.name = 'Academic.md';
	file.basename = 'Academic';
	file.parent = { path: 'samples' } as TFile['parent'];
	file.vault.configDir = '.obsidian';
	(file.vault.adapter as AdapterWithFullPath).getFullPath = (path: string) => join(tempVaultRoot, path);

	return { file, root: tempVaultRoot };
}

afterEach(() => {
	for (const directory of tempDirectories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('real Marp CLI exports a vault sample deck with a managed theme in every file format', async () => {
	const { file, root } = createRealExportFixture();
	const exporter = new MarpExport({
		...DEFAULT_SETTINGS,
		EnableMarkdownItPlugins: false,
	});
	const expectedOutputs = [
		{ type: 'pdf', path: join(root, 'samples/Academic.pdf') },
		{ type: 'pdf-with-notes', path: join(root, 'samples/Academic.pdf') },
		{ type: 'pptx', path: join(root, 'samples/Academic.pptx') },
		{ type: 'png', path: join(root, 'samples/Academic.png') },
		{ type: 'html', path: join(root, 'samples/Academic.html') },
	];

	for (const expected of expectedOutputs) {
		const outputPath = await exporter.export(file, expected.type);

		expect(outputPath).toBe(expected.path);
		expect(existsSync(expected.path)).toBe(true);
		expect(statSync(expected.path).size).toBeGreaterThan(0);
	}
}, 120_000);
