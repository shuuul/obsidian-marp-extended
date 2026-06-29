import { TFile } from 'obsidian';
import { afterEach, expect, test } from '@jest/globals';
import { spawnSync } from 'node:child_process';
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
const shouldRunRealMarpExports = /^(1|true)$/i.test(process.env.RUN_REAL_MARP_EXPORTS ?? '') || Boolean(process.env.MARP_CLI_PATH);
const MARP_CLI_PATH = process.env.MARP_CLI_PATH || (shouldRunRealMarpExports ? MarpExport.detectCliPath() : null) || 'marp';
const testWithMarpCli = shouldRunRealMarpExports && spawnSync(MARP_CLI_PATH, ['--version'], { encoding: 'utf-8' }).status === 0
	? test
	: test.skip;

function createRealExportFixture(): VaultFixture {
	const fixtureVaultRoot = join(process.cwd(), 'vault');
	const tempVaultRoot = mkdtempSync(join(tmpdir(), 'marp-real-export-vault-'));
	const markdownPath = 'samples/Kami.md';
	const managedThemeDirectory = join(tempVaultRoot, '.marp-extended/themes');
	tempDirectories.push(tempVaultRoot);
	mkdirSync(join(tempVaultRoot, 'samples'), { recursive: true });
	mkdirSync(managedThemeDirectory, { recursive: true });
	writeFileSync(
		join(tempVaultRoot, markdownPath),
		readFileSync(join(fixtureVaultRoot, markdownPath), 'utf-8'),
		'utf-8',
	);
	writeFileSync(
		join(managedThemeDirectory, 'kami.css'),
		readFileSync(join(fixtureVaultRoot, 'themes/kami.css'), 'utf-8'),
		'utf-8',
	);

	const file = new TFile() as TFile & {
		basename: string;
		name: string;
		vault: TFile['vault'] & { configDir: string };
	};

	file.path = markdownPath;
	file.name = 'Kami.md';
	file.basename = 'Kami';
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

testWithMarpCli('real Marp CLI exports a vault sample deck with a managed theme in every file format', async () => {
	const { file, root } = createRealExportFixture();
	const exporter = new MarpExport({
		...DEFAULT_SETTINGS,
		MARP_CLI_PATH,
	});
	const expectedOutputs = [
		{ type: 'pdf', path: join(root, 'samples/Kami.pdf') },
		{ type: 'pdf-with-notes', path: join(root, 'samples/Kami.pdf') },
		{ type: 'pptx', path: join(root, 'samples/Kami.pptx') },
		{ type: 'html', path: join(root, 'samples/Kami.html') },
	];

	for (const expected of expectedOutputs) {
		const outputPath = await exporter.export(file, expected.type);

		expect(outputPath).toBe(expected.path);
		expect(existsSync(expected.path)).toBe(true);
		expect(statSync(expected.path).size).toBeGreaterThan(0);
	}
}, 300_000);
