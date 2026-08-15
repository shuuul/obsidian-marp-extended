import { expect, test } from '@jest/globals';

import {
	buildObsidianOpenHref,
	convertNoteWikiLinks,
	getInternalLinkpathFromHref,
} from '@/utilities/wikiLinks';

test('preview mode renders the alias as an obsidian:// link', () => {
	const markdown = '基于 [[sources/transcripts/聊聊朱镕基那个时代和经济政策|来源笔记]] · 再快一点';

	const converted = convertNoteWikiLinks(markdown, 'preview');

	const href = buildObsidianOpenHref('sources/transcripts/聊聊朱镕基那个时代和经济政策');
	expect(converted).toBe(`基于 [来源笔记](<${href}>) · 再快一点`);
	expect(getInternalLinkpathFromHref(href)).toBe('sources/transcripts/聊聊朱镕基那个时代和经济政策');
});

test('links without an alias display the raw linkpath', () => {
	expect(convertNoteWikiLinks('见 [[Inbox/Note]]', 'preview')).toBe(
		`见 [Inbox/Note](<${buildObsidianOpenHref('Inbox/Note')}>)`,
	);
	expect(convertNoteWikiLinks('见 [[Inbox/Note]]', 'export')).toBe('见 Inbox/Note');
});

test('the first pipe separates target and alias', () => {
	const converted = convertNoteWikiLinks('[[Note|a|b]]', 'preview');
	expect(converted).toBe(`[a|b](<${buildObsidianOpenHref('Note')}>)`);
});

test('heading and block subpaths survive for navigation', () => {
	const linkpath = 'Note#小节';
	const converted = convertNoteWikiLinks(`[[${linkpath}|标题]]`, 'preview');
	expect(converted).toBe(`[标题](<${buildObsidianOpenHref(linkpath)}>)`);
	expect(getInternalLinkpathFromHref(buildObsidianOpenHref(linkpath))).toBe(linkpath);
});

test('export mode reduces links to plain display text', () => {
	const markdown = '基于 [[sources/transcripts/聊聊朱镕基那个时代和经济政策|来源笔记]] · 再快一点';

	expect(convertNoteWikiLinks(markdown, 'export')).toBe('基于 来源笔记 · 再快一点');
});

test('image embeds and note embeds are not converted', () => {
	const markdown = '![[assets/photo.png]]\n\n![[sources/transcripts/Note]]';

	expect(convertNoteWikiLinks(markdown, 'preview')).toBe(markdown);
	expect(convertNoteWikiLinks(markdown, 'export')).toBe(markdown);
});

test('fenced code blocks keep their wikilink-like syntax', () => {
	const markdown = [
		'[[Note|外部链接]]',
		'',
		'```mermaid[流程]',
		'flowchart LR',
		'  A[[subroutine]] --> B',
		'```',
		'',
		'~~~',
		'const s = "[[x]]";',
		'~~~',
	].join('\n');

	const converted = convertNoteWikiLinks(markdown, 'export');

	expect(converted).toContain('外部链接');
	expect(converted).toContain('A[[subroutine]] --> B');
	expect(converted).toContain('"[[x]]"');
});

test('inline code spans keep their wikilink-like syntax in both modes', () => {
	const markdown = '`[[x]]` and [[Note|alias]]';

	expect(convertNoteWikiLinks(markdown, 'preview')).toBe(
		'`[[x]]` and [alias](<obsidian://open?file=Note>)',
	);
	expect(convertNoteWikiLinks(markdown, 'export')).toBe('`[[x]]` and alias');
});

test('long fences stay closed until a matching-length fence', () => {
	const markdown = ['````text', '```', '[[x]]', '````'].join('\n');

	expect(convertNoteWikiLinks(markdown, 'preview')).toBe(markdown);
	expect(convertNoteWikiLinks(markdown, 'export')).toBe(markdown);
});

test('note names with unbalanced parentheses use an angle-bracket destination', () => {
	expect(convertNoteWikiLinks('[[Notes/foo)bar|x]]', 'preview')).toBe(
		'[x](<obsidian://open?file=Notes%2Ffoo)bar>)',
	);
});

test('brackets in the alias keep the markdown link well-formed', () => {
	const converted = convertNoteWikiLinks('[[Note|草稿 [v2]]', 'preview');
	expect(converted).toBe(`[草稿 \\[v2](<${buildObsidianOpenHref('Note')}>)`);
});

test('empty targets or aliases are left untouched', () => {
	expect(convertNoteWikiLinks('[[|alias]]', 'preview')).toBe('[[|alias]]');
});

test('getInternalLinkpathFromHref rejects non-internal hrefs', () => {
	expect(getInternalLinkpathFromHref('https://example.com')).toBeNull();
	expect(getInternalLinkpathFromHref('obsidian://search?query=x')).toBeNull();
	expect(getInternalLinkpathFromHref('obsidian://open')).toBeNull();
	expect(getInternalLinkpathFromHref('')).toBeNull();
	expect(getInternalLinkpathFromHref('not a url')).toBeNull();
});
