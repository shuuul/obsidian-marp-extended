import marpCli from '@marp-team/marp-cli';
import { TFile } from 'obsidian';
import { expect, jest, test, beforeEach, afterEach } from '@jest/globals';

import { MarpExport } from '@/utilities/marpExport';
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

function mockFolderPicker(result: { canceled: boolean; filePaths?: string[] }) {
	const showOpenDialog = jest.fn(async (_options: unknown) => result);
	(window as any).require = jest.fn((moduleName: string) => {
		if (moduleName === 'electron') {
			return {
				remote: {
					dialog: { showOpenDialog },
				},
			};
		}

		throw new Error(`Unexpected module: ${moduleName}`);
	});

	return showOpenDialog;
}

beforeEach(() => {
	marpCliMock.mockClear();
	marpCliMock.mockResolvedValue(0);
});

afterEach(() => {
	delete (window as any).require;
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
