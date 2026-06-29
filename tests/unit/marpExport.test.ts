import { spawn } from 'node:child_process';
import { App, TFile } from 'obsidian';
import { expect, jest, test, beforeEach, afterEach } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename as pathBasename, dirname, join } from 'node:path';

import { MarpCLIError, MarpExport } from '@/utilities/marpExport';
import { DEFAULT_SETTINGS } from '@/utilities/settings';

jest.mock('node:child_process', () => ({
	spawn: jest.fn(),
}));

type SpawnError = Error & { code?: string | number };
type MockChildProcess = EventEmitter & {
	stdout: EventEmitter;
	stderr: EventEmitter;
	kill: jest.MockedFunction<() => boolean>;
};
type SpawnMock = jest.MockedFunction<(
	executable: string,
	args: string[],
	options: Record<string, unknown>,
) => MockChildProcess>;

const spawnMock = spawn as unknown as SpawnMock;

type TestElectronRequire = (moduleName: string) => {
	remote?: {
		dialog?: {
			showSaveDialog?: (options: unknown) => Promise<{ canceled: boolean; filePath?: string }>;
		};
	};
};

type TestWindow = Window & { require?: TestElectronRequire };
const tempDirectories: string[] = [];

function createMockChildProcess(result: {
	error?: SpawnError;
	exitCode?: number | null;
	signal?: NodeJS.Signals | null;
	stdout?: string;
	stderr?: string;
} = {}): MockChildProcess {
	const child = new EventEmitter() as MockChildProcess;
	child.stdout = new EventEmitter();
	child.stderr = new EventEmitter();
	child.kill = jest.fn(() => true);

	process.nextTick(() => {
		if (result.stdout) {
			child.stdout.emit('data', result.stdout);
		}
		if (result.stderr) {
			child.stderr.emit('data', result.stderr);
		}
		if (result.error) {
			child.emit('error', result.error);
			return;
		}

		child.emit('close', result.exitCode ?? 0, result.signal ?? null);
	});

	return child;
}

function mockCliSuccess(stdout = '', stderr = ''): void {
	spawnMock.mockImplementation(() => createMockChildProcess({ stdout, stderr }));
}

function getLastCliExecutable(): string {
	return spawnMock.mock.calls[spawnMock.mock.calls.length - 1][0];
}

function getLastCliArgs(): string[] {
	return spawnMock.mock.calls[spawnMock.mock.calls.length - 1][1];
}

function getLastCliOptions(): Record<string, unknown> {
	return spawnMock.mock.calls[spawnMock.mock.calls.length - 1][2];
}

function expectMarpExecutable(executable: string): void {
	expect(executable).toMatch(/(?:^|[/\\])marp(?:\.cmd|\.exe)?$/);
}

function expectNpxExecutable(executable: string): void {
	expect(executable).toMatch(/(?:^|[/\\])npx(?:\.cmd|\.exe)?$/);
}

function createFile(): TFile {
	const file = new TFile() as TFile & {
		basename: string;
		name: string;
		vault: TFile['vault'] & { configDir: string };
	};

	file.path = 'slides/deck.md';
	file.name = 'deck.md';
	file.basename = 'deck';
	file.parent = { path: 'slides' } as TFile['parent'];
	file.vault.configDir = '.obsidian';
	void file.vault.adapter.write('vault', '');

	return file;
}

function createDiskBackedFile(root: string, markdownPath: string, content: string): TFile {
	const file = new TFile() as TFile & {
		basename: string;
		name: string;
		vault: TFile['vault'] & { configDir: string };
	};
	const parentPath = dirname(markdownPath);
	const sourcePath = join(root, markdownPath);

	mkdirSync(join(root, parentPath), { recursive: true });
	writeFileSync(sourcePath, content, 'utf-8');
	file.path = markdownPath;
	file.name = pathBasename(markdownPath);
	file.basename = file.name.replace(/\.md$/i, '');
	file.parent = { path: parentPath === '.' ? '' : parentPath } as TFile['parent'];
	file.vault.configDir = '.obsidian';
	void file.vault.adapter.write(root, '');
	(file.vault.adapter as any).getFullPath = (path: string) => join(root, path);
	file.vault.cachedRead = async () => readFileSync(sourcePath, 'utf-8');

	return file;
}

function mockSaveDialog(result: { canceled: boolean; filePath?: string }) {
	const showSaveDialog = jest.fn(async (_options: unknown) => result);
	const electronRequire: TestElectronRequire = (moduleName: string) => {
		if (moduleName === 'electron') {
			return {
				remote: {
					dialog: { showSaveDialog },
				},
			};
		}

		throw new Error(`Unexpected module: ${moduleName}`);
	};
	(window as TestWindow).require = electronRequire;

	return showSaveDialog;
}

beforeEach(() => {
	spawnMock.mockReset();
	mockCliSuccess();
});

afterEach(() => {
	delete (window as TestWindow).require;
	for (const directory of tempDirectories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('export selects a file and passes output path to external Marp CLI', async () => {
	const showSaveDialog = mockSaveDialog({ canceled: false, filePath: '/tmp/export/custom.pdf' });
	const exporter = new MarpExport(DEFAULT_SETTINGS);

	await exporter.export(createFile(), 'pdf');

	expect(showSaveDialog).toHaveBeenCalledWith({
		title: 'Choose export file',
		defaultPath: 'vault/slides/deck.pdf',
		filters: [{ name: 'PDF', extensions: ['pdf'] }],
	});
	expect(spawnMock).toHaveBeenCalledTimes(1);
	expectMarpExecutable(getLastCliExecutable());
	expect(getLastCliArgs()).toEqual(expect.arrayContaining([
		'--pdf',
		'-o',
		'/tmp/export/custom.pdf',
	]));
	expect(getLastCliOptions().stdio).toEqual(['ignore', 'pipe', 'pipe']);
});

test('export uses configured Marp CLI path when provided', async () => {
	mockSaveDialog({ canceled: false, filePath: '/tmp/export/custom.pdf' });
	const exporter = new MarpExport({
		...DEFAULT_SETTINGS,
		MARP_CLI_PATH: '/opt/homebrew/bin/marp',
	});

	await exporter.export(createFile(), 'pdf');

	expect(getLastCliExecutable()).toBe('/opt/homebrew/bin/marp');
});

test('Marp CLI version check runs the configured executable', async () => {
	mockCliSuccess('4.4.0\n');

	const version = await MarpExport.getCliVersion({
		...DEFAULT_SETTINGS,
		MARP_CLI_PATH: '/usr/local/bin/marp',
	});

	expect(version).toBe('4.4.0');
	expect(getLastCliExecutable()).toBe('/usr/local/bin/marp');
	expect(getLastCliArgs()).toEqual(['--version']);
});

test('Marp CLI version check explains missing executable errors', async () => {
	spawnMock.mockImplementationOnce(() => createMockChildProcess({
		error: Object.assign(new Error('spawn marp ENOENT'), { code: 'ENOENT' }),
	}));

	await expect(MarpExport.getCliVersion(DEFAULT_SETTINGS)).rejects.toThrow('Install it with `npm install -g @marp-team/marp-cli`');
});

test('export can fall back to npx when auto-detected Marp CLI is missing', async () => {
	mockSaveDialog({ canceled: false, filePath: '/tmp/export/deck.html' });
	spawnMock
		.mockImplementationOnce(() => createMockChildProcess({
			error: Object.assign(new Error('spawn marp ENOENT'), { code: 'ENOENT' }),
		}))
		.mockImplementationOnce(() => createMockChildProcess());
	const exporter = new MarpExport({
		...DEFAULT_SETTINGS,
		MARP_CLI_USE_NPX: true,
	});

	await exporter.export(createFile(), 'html');

	expect(spawnMock).toHaveBeenCalledTimes(2);
	expectNpxExecutable(spawnMock.mock.calls[1][0]);
	expect(spawnMock.mock.calls[1][1]).toEqual(expect.arrayContaining([
		'--yes',
		'--package',
		'@marp-team/marp-cli@4.4.0',
		'marp',
		'--html',
		'-o',
		'/tmp/export/deck.html',
	]));
});

test('configured Marp CLI path does not fall back to npx when missing', async () => {
	mockSaveDialog({ canceled: false, filePath: '/tmp/export/deck.html' });
	spawnMock.mockImplementationOnce(() => createMockChildProcess({
		error: Object.assign(new Error('spawn /missing/marp ENOENT'), { code: 'ENOENT' }),
	}));
	const exporter = new MarpExport({
		...DEFAULT_SETTINGS,
		MARP_CLI_PATH: '/missing/marp',
		MARP_CLI_USE_NPX: true,
	});

	await expect(exporter.export(createFile(), 'html')).rejects.toThrow('Tried: /missing/marp');
	expect(spawnMock).toHaveBeenCalledTimes(1);
});

test('Marp CLI version check can fall back to npx', async () => {
	spawnMock
		.mockImplementationOnce(() => createMockChildProcess({
			error: Object.assign(new Error('spawn marp ENOENT'), { code: 'ENOENT' }),
		}))
		.mockImplementationOnce(() => createMockChildProcess({ stdout: '4.4.0\n' }));

	const version = await MarpExport.getCliVersion({
		...DEFAULT_SETTINGS,
		MARP_CLI_USE_NPX: true,
	});

	expect(version).toBe('4.4.0');
	expect(spawnMock).toHaveBeenCalledTimes(2);
	expectNpxExecutable(spawnMock.mock.calls[1][0]);
	expect(spawnMock.mock.calls[1][1]).toEqual(['--yes', '--package', '@marp-team/marp-cli@4.4.0', 'marp', '--version']);
});

test('export cancellation does not run Marp CLI', async () => {
	mockSaveDialog({ canceled: true });
	const exporter = new MarpExport(DEFAULT_SETTINGS);

	await exporter.export(createFile(), 'pptx');

	expect(spawnMock).not.toHaveBeenCalled();
});

test('HTML export uses selected file for output file', async () => {
	mockSaveDialog({ canceled: false, filePath: '/tmp/export/custom.html' });
	const exporter = new MarpExport(DEFAULT_SETTINGS);

	await exporter.export(createFile(), 'html');

	expect(getLastCliArgs()).toEqual(expect.arrayContaining([
		'--html',
		'--template',
		'bare',
		'-o',
		'/tmp/export/custom.html',
	]));
});

test('export converts wiki-links through a temporary markdown file without changing the source file', async () => {
	const root = mkdtempSync(join(tmpdir(), 'marp-export-temp-source-'));
	tempDirectories.push(root);
	const originalContent = '# Deck\n\n![[image.png|Alt text]]\n';
	const file = createDiskBackedFile(root, 'slides/deck.md', originalContent);
	const exportDirectory = join(root, 'exports');
	const sourcePath = join(root, 'slides/deck.md');
	const linkedImage = new TFile() as TFile & { path: string };
	let temporarySourcePath = '';

	mkdirSync(exportDirectory, { recursive: true });
	linkedImage.path = 'assets/image.png';
	mockSaveDialog({ canceled: false, filePath: join(exportDirectory, 'deck.pdf') });
	spawnMock.mockImplementationOnce((_executable, args) => {
		temporarySourcePath = args[0];
		expect(temporarySourcePath).not.toBe(sourcePath);
		expect(dirname(temporarySourcePath)).toBe(dirname(sourcePath));
		expect(readFileSync(temporarySourcePath, 'utf-8')).toContain('![Alt text](../assets/image.png)');
		expect(readFileSync(sourcePath, 'utf-8')).toBe(originalContent);

		return createMockChildProcess();
	});

	const app = {
		vault: file.vault,
		metadataCache: {
			getFirstLinkpathDest: jest.fn(() => linkedImage),
		},
	} as unknown as App;
	const exporter = new MarpExport(DEFAULT_SETTINGS, app);

	const outputPath = await exporter.export(file, 'pdf-with-notes');

	expect(outputPath).toBe(join(exportDirectory, 'deck.pdf'));
	expect(getLastCliArgs()).toEqual(expect.arrayContaining([
		'--pdf-notes',
		'--pdf-outlines',
	]));
	expect(temporarySourcePath).not.toBe('');
	expect(existsSync(temporarySourcePath)).toBe(false);
	expect(readFileSync(sourcePath, 'utf-8')).toBe(originalContent);
});

test('export injects selected Mermaid theme CSS and flat mode into the temporary markdown file', async () => {
	const root = mkdtempSync(join(tmpdir(), 'marp-export-mermaid-theme-'));
	tempDirectories.push(root);
	const originalContent = '---\ntheme: kami\nmermaidTheme: dracula\nmermaidFlat: true\n---\n\n```mermaid\nflowchart LR\n  A --> B\n```\n';
	const file = createDiskBackedFile(root, 'slides/deck.md', originalContent);
	const exportDirectory = join(root, 'exports');
	const mermaidThemeDirectory = join(root, '.marp-extended/mermaid-themes');
	let temporarySourcePath = '';

	mkdirSync(exportDirectory, { recursive: true });
	mkdirSync(mermaidThemeDirectory, { recursive: true });
	writeFileSync(join(mermaidThemeDirectory, 'dracula.css'), '/* @mermaid-theme dracula */\nsection .mermaid-diagram-container svg { --accent: pink !important; }', 'utf-8');
	(file.vault.adapter as any).exists = async (path: string) => existsSync(join(root, path));
	(file.vault.adapter as any).list = async (path: string) => ({
		files: [join(path, 'dracula.css')],
		folders: [],
	});
	(file.vault.adapter as any).read = async (path: string) => readFileSync(join(root, path), 'utf-8');
	mockSaveDialog({ canceled: false, filePath: join(exportDirectory, 'deck.html') });
	spawnMock.mockImplementationOnce((_executable, args) => {
		temporarySourcePath = args[0];
		const processed = readFileSync(temporarySourcePath, 'utf-8');
		expect(processed).toMatch(/^---\ntheme: kami\nmermaidTheme: dracula\nmermaidFlat: true\n---\s*<style class="marp-extended-mermaid-theme">/);
		expect(processed).toContain('class="marp-extended-mermaid-theme"');
		expect(processed).toContain('--accent: pink !important');
		expect(processed).toContain('background: transparent !important');
		expect(processed).toContain('svg .edge-label rect');
		expect(processed).toContain('fill: var(--surface, var(--bg)) !important');
		expect(processed).toContain('data-mermaid-renderer="beautiful-mermaid"');

		return createMockChildProcess();
	});

	const app = {
		vault: file.vault,
		metadataCache: {
			getFileCache: jest.fn(() => ({ frontmatter: { mermaidTheme: 'dracula', mermaidFlat: true } })),
			getFirstLinkpathDest: jest.fn(() => null),
		},
	} as unknown as App;
	const exporter = new MarpExport(DEFAULT_SETTINGS, app);

	await exporter.export(file, 'html');

	expect(temporarySourcePath).not.toBe('');
	expect(existsSync(temporarySourcePath)).toBe(false);
	expect(readFileSync(join(root, 'slides/deck.md'), 'utf-8')).toBe(originalContent);
});

test('export compiles Kami fenced blocks in the temporary markdown file', async () => {
	const root = mkdtempSync(join(tmpdir(), 'marp-export-kami-dsl-'));
	tempDirectories.push(root);
	const originalContent = [
		'---',
		'theme: kami',
		'---',
		'',
		'```slide[]',
		'class: cover',
		'paginate: false',
		'```',
		'',
		'```cols[]',
		'### Left',
		'===',
		'### Right',
		'```',
	].join('\n');
	const file = createDiskBackedFile(root, 'slides/deck.md', originalContent);
	const exportDirectory = join(root, 'exports');
	let temporarySourcePath = '';

	mkdirSync(exportDirectory, { recursive: true });
	mockSaveDialog({ canceled: false, filePath: join(exportDirectory, 'deck.html') });
	spawnMock.mockImplementationOnce((_executable, args) => {
		temporarySourcePath = args[0];
		const processed = readFileSync(temporarySourcePath, 'utf-8');
		expect(processed).toContain('<!-- _class: cover -->');
		expect(processed).toContain('<!-- _paginate: false -->');
		expect(processed).toContain('<div class="c2">');
		expect(processed).not.toContain('```slide');
		expect(processed).not.toContain('```cols');

		return createMockChildProcess();
	});

	const app = {
		vault: file.vault,
		metadataCache: {
			getFileCache: jest.fn(() => ({ frontmatter: {} })),
			getFirstLinkpathDest: jest.fn(() => null),
		},
	} as unknown as App;
	const exporter = new MarpExport(DEFAULT_SETTINGS, app);

	await exporter.export(file, 'html');

	expect(temporarySourcePath).not.toBe('');
	expect(existsSync(temporarySourcePath)).toBe(false);
	expect(readFileSync(join(root, 'slides/deck.md'), 'utf-8')).toBe(originalContent);
});

test('export falls back to the source path when native save dialog is unavailable', async () => {
	const exporter = new MarpExport(DEFAULT_SETTINGS);

	const outputPath = await exporter.export(createFile(), 'html');

	expect(outputPath).toBe('vault/slides/deck.html');
	expect(getLastCliArgs()).toEqual(expect.arrayContaining([
		'-o',
		'vault/slides/deck.html',
	]));
});

test('export passes configured browser path to Marp CLI arguments and environment', async () => {
	mockSaveDialog({ canceled: false, filePath: '/tmp/export/deck.pdf' });
	const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
	const exporter = new MarpExport({
		...DEFAULT_SETTINGS,
		CHROME_PATH: chromePath,
	});

	await exporter.export(createFile(), 'pdf');

	expect(getLastCliArgs()).toEqual(expect.arrayContaining([
		'--browser-path',
		chromePath,
	]));
	expect((getLastCliOptions().env as NodeJS.ProcessEnv).CHROME_PATH).toBe(chromePath);
});

test('export throws an actionable error when Marp CLI is missing', async () => {
	mockSaveDialog({ canceled: false, filePath: '/tmp/export/deck.html' });
	spawnMock.mockImplementationOnce(() => createMockChildProcess({
		error: Object.assign(new Error('spawn marp ENOENT'), { code: 'ENOENT' }),
	}));
	const exporter = new MarpExport(DEFAULT_SETTINGS);
	const exportPromise = exporter.export(createFile(), 'html');

	await expect(exportPromise).rejects.toThrow(MarpCLIError);
	await expect(exportPromise).rejects.toThrow('Install it with `npm install -g @marp-team/marp-cli`');
});

test('export throws when Marp CLI returns a failing exit status', async () => {
	mockSaveDialog({ canceled: false, filePath: '/tmp/export/deck.html' });
	spawnMock.mockImplementationOnce(() => createMockChildProcess({
		exitCode: 1,
		stdout: 'stdout details',
		stderr: 'stderr details',
	}));
	const exporter = new MarpExport(DEFAULT_SETTINGS);
	const exportPromise = exporter.export(createFile(), 'html');

	await expect(exportPromise).rejects.toThrow('exit status 1');
	await expect(exportPromise).rejects.toThrow('stderr details');
});

test('export explains missing browser errors from Marp CLI output', async () => {
	mockSaveDialog({ canceled: false, filePath: '/tmp/export/deck.pdf' });
	spawnMock.mockImplementationOnce(() => createMockChildProcess({
		exitCode: 1,
		stderr: 'NOT_FOUND_CHROMIUM',
	}));
	const exporter = new MarpExport(DEFAULT_SETTINGS);

	await expect(exporter.export(createFile(), 'pdf')).rejects.toThrow('could not find Chrome, Chromium, or Microsoft Edge');
});
