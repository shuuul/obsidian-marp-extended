import { App, TFile } from 'obsidian';
import { expect, jest, test} from '@jest/globals';
import { FilePath } from "@/utilities/filePath";
import { DEFAULT_SETTINGS } from "@/utilities/settings";

class pathsUtility {
  base: string;
  relative: string;
  expected:string;
}

function createAppWithResolvedFile(linkedFile: TFile | null): App {
  return {
    metadataCache: {
      getFirstLinkpathDest: jest.fn(() => linkedFile),
    },
  } as unknown as App;
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

test('image wiki-links convert to encoded markdown image links', () => {

  const filePath = new FilePath(DEFAULT_SETTINGS);
  const sourceFile = new TFile;
  const linkedImage = new TFile;

  sourceFile.path = 'inbox/unordered/Marp Example.md';
  sourceFile.parent = { path: 'inbox/unordered' } as TFile['parent'];
  linkedImage.path = 'inbox/unordered/Pasted image 20260625124927.png';

  const result = filePath.convertImageWikiLinks(
    '# Slide\n\n![[Pasted image 20260625124927.png]]',
    sourceFile,
    createAppWithResolvedFile(linkedImage),
  );

  expect(result).toContain('![Pasted image 20260625124927.png](Pasted%20image%2020260625124927.png)');

});

test('image wiki-link aliases convert to alt text or Marp size directives', () => {

  const filePath = new FilePath(DEFAULT_SETTINGS);
  const sourceFile = new TFile;
  const linkedImage = new TFile;

  sourceFile.path = 'slides/deck.md';
  sourceFile.parent = { path: 'slides' } as TFile['parent'];
  linkedImage.path = 'assets/diagram final.png';

  const result = filePath.convertImageWikiLinks(
    '![[diagram final.png|Architecture]]\n![[diagram final.png|600x400]]',
    sourceFile,
    createAppWithResolvedFile(linkedImage),
  );

  expect(result).toContain('![Architecture](../assets/diagram%20final.png)');
  expect(result).toContain('![w:600 h:400](../assets/diagram%20final.png)');

});

test('unresolved image wiki-links fall back to same-folder markdown paths', () => {

  const filePath = new FilePath(DEFAULT_SETTINGS);
  const sourceFile = new TFile;

  sourceFile.path = 'slides/deck.md';

  const result = filePath.convertImageWikiLinks(
    '![[Pasted image 20260625124927.png]]\n[[Regular note]]',
    sourceFile,
    createAppWithResolvedFile(null),
  );

  expect(result).toContain('![Pasted image 20260625124927.png](Pasted%20image%2020260625124927.png)');
  expect(result).toContain('[[Regular note]]');

});
