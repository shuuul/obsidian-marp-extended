import marpCli from '@marp-team/marp-cli';
import { App, TFile } from 'obsidian';
import { expect, jest, test, beforeEach, afterEach } from '@jest/globals';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename as pathBasename, dirname, join } from 'node:path';

import { MarpCLIError, MarpExport } from '@/utilities/marpExport';
import { DEFAULT_SETTINGS } from '@/utilities/settings';

jest.mock('@marp-team/marp-cli', () => ({
	__esModule: true,
	default: jest.fn(async () => 0),
	CLIError: class CLIError extends Error {
		errorCode = '';
	},
	CLIErrorCode: {
		NOT_FOUND_CHROMIUM: 'NOT_FOUND_CHROMIUM',
	},
}));

const marpCliMock = marpCli as unknown as jest.MockedFunction<(argv: string[], opts: unknown) => Promise<number>>;

type TestElectronRequire = (moduleName: string) => {
	remote?: {
		dialog?: {
			showOpenDialog: (options: unknown) => Promise<{ canceled: boolean; filePaths?: string[] }>;
		};
	};
};

type TestWindow = Window & { require?: TestElectronRequire };
type NodeRequireFunction = (moduleName: string) => unknown;
const tempDirectories: string[] = [];



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


function mockFolderPicker(result: { canceled: boolean; filePaths?: string[] }) {
	const showOpenDialog = jest.fn(async (_options: unknown) => result);
	const electronRequire: TestElectronRequire = (moduleName: string) => {
		if (moduleName === 'electron') {
			return {
				remote: {
					dialog: { showOpenDialog },
				},
			};
		}

		throw new Error(`Unexpected module: ${moduleName}`);
	};
	(window as TestWindow).require = electronRequire;

	return showOpenDialog;
}

beforeEach(() => {
	marpCliMock.mockClear();
	marpCliMock.mockResolvedValue(0);
});

afterEach(() => {
	delete (window as TestWindow).require;
	for (const directory of tempDirectories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('export selects a folder and passes output path to Marp CLI', async () => {
	const showOpenDialog = mockFolderPicker({ canceled: false, filePaths: ['/tmp/export'] });
	const exporter = new MarpExport(DEFAULT_SETTINGS);

	await exporter.export(createFile(), 'pdf');

	expect(showOpenDialog).toHaveBeenCalledWith({
		title: 'Choose export folder',
		defaultPath: 'vault/slides',
		properties: ['openDirectory', 'createDirectory'],
	});
	expect(marpCliMock).toHaveBeenCalledTimes(1);
	expect(marpCliMock.mock.calls[0][0]).toEqual(expect.arrayContaining([
		'--pdf',
		'-o',
		'/tmp/export/deck.pdf',
	]));
});

test('export cancellation does not run Marp CLI', async () => {
	mockFolderPicker({ canceled: true });
	const exporter = new MarpExport(DEFAULT_SETTINGS);

	await exporter.export(createFile(), 'pptx');

	expect(marpCliMock).not.toHaveBeenCalled();
});

test('HTML export uses selected folder for output file', async () => {
	mockFolderPicker({ canceled: false, filePaths: ['/tmp/export'] });
	const exporter = new MarpExport(DEFAULT_SETTINGS);

	await exporter.export(createFile(), 'html');

	expect(marpCliMock.mock.calls[0][0]).toEqual(expect.arrayContaining([
		'--html',
		'--template',
		'bare',
		'-o',
		'/tmp/export/deck.html',
	]));
});

test('PNG export writes the selected PNG output file', async () => {
	mockFolderPicker({ canceled: false, filePaths: ['/tmp/export'] });
	const exporter = new MarpExport(DEFAULT_SETTINGS);

	await exporter.export(createFile(), 'png');

	expect(marpCliMock.mock.calls[0][0]).toEqual(expect.arrayContaining([
		'--image',
		'png',
		'-o',
		'/tmp/export/deck.png',
	]));
	expect(marpCliMock.mock.calls[0][0]).not.toContain('--images');
	expect(marpCliMock.mock.calls[0][0]).not.toContain('--png');
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
	mockFolderPicker({ canceled: false, filePaths: [exportDirectory] });
	marpCliMock.mockImplementationOnce(async (argv: string[]) => {
		temporarySourcePath = argv[0];
		expect(temporarySourcePath).not.toBe(sourcePath);
		expect(dirname(temporarySourcePath)).toBe(dirname(sourcePath));
		expect(readFileSync(temporarySourcePath, 'utf-8')).toContain('![Alt text](../assets/image.png)');
		expect(readFileSync(sourcePath, 'utf-8')).toBe(originalContent);

		return 0;
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
	expect(marpCliMock.mock.calls[0][0]).toEqual(expect.arrayContaining([
		'--pdf-notes',
		'--pdf-outlines',
	]));
	expect(temporarySourcePath).not.toBe('');
	expect(existsSync(temporarySourcePath)).toBe(false);
	expect(readFileSync(sourcePath, 'utf-8')).toBe(originalContent);
});

test('export falls back to the source folder when native folder picker is unavailable', async () => {
	const exporter = new MarpExport(DEFAULT_SETTINGS);

	const outputPath = await exporter.export(createFile(), 'html');

	expect(outputPath).toBe('vault/slides/deck.html');
	expect(marpCliMock.mock.calls[0][0]).toEqual(expect.arrayContaining([
		'-o',
		'vault/slides/deck.html',
	]));
});

test('export passes configured browser path to Marp CLI', async () => {
	mockFolderPicker({ canceled: false, filePaths: ['/tmp/export'] });
	const exporter = new MarpExport({
		...DEFAULT_SETTINGS,
		CHROME_PATH: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
	});

	await exporter.export(createFile(), 'pdf');

	expect(marpCliMock.mock.calls[0][0]).toEqual(expect.arrayContaining([
		'--browser-path',
		'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
	]));
});

test('export throws when Marp CLI returns a failing exit status', async () => {
	mockFolderPicker({ canceled: false, filePaths: ['/tmp/export'] });
	marpCliMock.mockResolvedValue(1);
	const exporter = new MarpExport(DEFAULT_SETTINGS);

	await expect(exporter.export(createFile(), 'html')).rejects.toThrow(MarpCLIError);
});

test('export keeps Obsidian app URL createRequire patch while Marp CLI runs', async () => {
	mockFolderPicker({ canceled: false, filePaths: ['/tmp/export'] });
	marpCliMock.mockImplementation(async () => {
		const nodeModule = require('node:module') as { createRequire(filename: string | URL): NodeRequireFunction };

		expect(() => nodeModule.createRequire('app://obsidian.md/marp-cli-qbOdG7H_.js')).not.toThrow();

		return 0;
	});
	const exporter = new MarpExport(DEFAULT_SETTINGS);

	await exporter.export(createFile(), 'html');

	expect(marpCliMock).toHaveBeenCalledTimes(1);
});

test('export forces CommonJS engine resolution only while Marp CLI runs', async () => {
	const runtimeProcess = process as typeof process & { pkg?: unknown };
	const hadPkg = Object.prototype.hasOwnProperty.call(runtimeProcess, 'pkg');
	const originalPkg = runtimeProcess.pkg;
	mockFolderPicker({ canceled: false, filePaths: ['/tmp/export'] });
	delete runtimeProcess.pkg;
	marpCliMock.mockImplementation(async () => {
		expect(Object.prototype.hasOwnProperty.call(runtimeProcess, 'pkg')).toBe(true);

		return 0;
	});
	const exporter = new MarpExport(DEFAULT_SETTINGS);

	try {
		await exporter.export(createFile(), 'html');

		expect(Object.prototype.hasOwnProperty.call(runtimeProcess, 'pkg')).toBe(false);
	} finally {
		if (hadPkg) {
			runtimeProcess.pkg = originalPkg;
		} else {
			delete runtimeProcess.pkg;
		}
	}
});
