import { TFile } from 'obsidian';
import { expect, test} from '@jest/globals';
import { FilePath } from "@/utilities/filePath";
import { DEFAULT_SETTINGS } from "@/utilities/settings";

class pathsUtility {
  base: string;
  relative: string;
  expected:string;
}

test('file base path', () => {

  const filePath = new FilePath(DEFAULT_SETTINGS);
  const tests : pathsUtility[] = [
    { base: "aaa", relative: "bbb", expected: "app://local/aaa/bbb/"},
    { base: "C:\\user\\foo\\vault", relative: "folder\\file", expected: "app://local/C:/user/foo/vault/folder/file/"},
  ];

  tests.forEach(element => {
    const file = new TFile;

    if (file.parent != null){
      file.parent.path = element.relative;
      file.vault.adapter.write(`${element.base}\\${element.relative}`, '');
    }

    const result = filePath.getCompleteFileBasePath(file);

    expect(result).toBe(element.expected);
  });

});

test('file path', () => {

  const filePath = new FilePath(DEFAULT_SETTINGS);
  const tests : pathsUtility[] = [
    { base: "aaa", relative: "bbb.md", expected: "aaa/bbb.md"},
    { base: "C:\\user\\foo\\vault", relative: "folder\\file.md", expected: "C:/user/foo/vault/folder/file.md"},
  ];

  tests.forEach(element => {
    const file = new TFile;

    file.path = element.relative;
    file.vault.adapter.write(element.base, '');

    const result = filePath.getCompleteFilePath(file);

    expect(result).toBe(element.expected);
  });

});

test('file path uses Obsidian adapter full paths for export', () => {

  const filePath = new FilePath(DEFAULT_SETTINGS);
  const file = new TFile;

  file.path = 'inbox/deck.md';
  file.vault.adapter.write('/Users/shuuul/Library/Mobile Documents/iCloud~md~obsidian/Documents/Base', '');
  (file.vault.adapter as any).getFullPath = (path: string) => (
    `/Users/shuuul/Library/Mobile Documents/iCloud~md~obsidian/Documents/Base/${path}`
  );

  const result = filePath.getCompleteFilePath(file);

  expect(result).toBe('/Users/shuuul/Library/Mobile Documents/iCloud~md~obsidian/Documents/Base/inbox/deck.md');

});

test('managed plugin paths use Obsidian adapter full paths for export', () => {

  const filePath = new FilePath(DEFAULT_SETTINGS);
  const file = new TFile;

  file.vault.configDir = '.obsidian';
  file.vault.adapter.write('/Users/shuuul/Library/Mobile Documents/iCloud~md~obsidian/Documents/Base', '');
  (file.vault.adapter as any).getFullPath = (path: string) => (
    `/Users/shuuul/Library/Mobile Documents/iCloud~md~obsidian/Documents/Base/${path}`
  );

  const result = filePath.getMarpEngine(file.vault);

  expect(result).toBe('/Users/shuuul/Library/Mobile Documents/iCloud~md~obsidian/Documents/Base/.obsidian/plugins/marp-extended/lib3/marp.config.js');

});

test('file path decodes Obsidian app resource URLs when full paths are unavailable', () => {

  const filePath = new FilePath(DEFAULT_SETTINGS);
  const file = new TFile;

  file.path = 'inbox/deck.md';
  (file.vault.adapter as any).getFilePath = (path: string) => (
    `app://1067c2dabfdf176f64ce90173984a4c77385/Users/shuuul/Library/Mobile%20Documents/iCloud%7Emd%7Eobsidian/Documents/Base/${path}`
  );

  const result = filePath.getCompleteFilePath(file);

  expect(result).toBe('/Users/shuuul/Library/Mobile Documents/iCloud~md~obsidian/Documents/Base/inbox/deck.md');

});

test('theme paths include managed theme directory', () => {

  const filePath = new FilePath(DEFAULT_SETTINGS);

  const file = new TFile;
  file.vault.adapter.write('aaa', '');

  const result = filePath.getThemePaths(file);

  expect(result).toEqual([
    'aaa/.marp-extended/themes',
  ]);

});
