import { expect, test } from '@jest/globals';

import { compileMarpExtendedCommentBlocks } from '@marp-extended/marp-dsl';

test('compiles slide metadata markers into Marp spot directives', () => {
	const markdown = [
		'# Cover',
		'',
		'%%marp-slide[class=cover paginate=false footer="" header="01 · Origin"]%%',
	].join('\n');

	const compiled = compileMarpExtendedCommentBlocks(markdown);

	expect(compiled).toContain('<!-- _class: cover -->');
	expect(compiled).toContain('<!-- _paginate: false -->');
	expect(compiled).toContain('<!-- _header: 01 · Origin -->');
	expect(compiled).toMatch(/<!-- _footer: (\"\"|) -->/);
});

test('compiles semantic markers into namespaced class blocks', () => {
	const markdown = [
		'%%marp-lead%%',
		'Same palette, fonts, layout tokens.',
		'%%/marp-lead%%',
		'',
		'%%marp-callout[variant=mc]%%',
		'Fix the layer outside the loop.',
		'%%/marp-callout%%',
	].join('\n');
	const compiled = compileMarpExtendedCommentBlocks(markdown);

	expect(compiled).toContain('<div class="marp-extended-lead">\n\nSame palette, fonts, layout tokens.\n\n</div>');
	expect(compiled).toContain('<div class="marp-extended-callout marp-extended-callout-mc">\n\nFix the layer outside the loop.\n\n</div>');
});

test('compiles canonical columns into namespaced wrappers', () => {
	const markdown = [
		'%%marp-columns%%',
		'### Left',
		'',
		'- A',
		'%%marp-column%%',
		'### Right',
		'',
		'- B',
		'%%/marp-columns%%',
	].join('\n');
	const compiled = compileMarpExtendedCommentBlocks(markdown);

	expect(compiled).toContain('<div class="marp-extended-columns marp-extended-columns-2">');
	expect(compiled).toContain('### Left');
	expect(compiled).toContain('### Right');
	expect(compiled).toContain('</div>\n\n<div class="marp-extended-column">');
});

test('keeps nested code fences inside Extended blocks', () => {
	const markdown = [
		'%%marp-columns%%',
		'### Diagram',
		'',
		'```mermaid[Diagram]',
		'flowchart LR',
		'  A --> B',
		'```',
		'%%marp-column%%',
		'### Notes',
		'',
		'- Text',
		'%%/marp-columns%%',
	].join('\n');
	const compiled = compileMarpExtendedCommentBlocks(markdown);

	expect(compiled).toContain('<div class="marp-extended-columns marp-extended-columns-2">');
	expect(compiled).toContain('```mermaid[Diagram]');
	expect(compiled).toContain('flowchart LR');
	expect(compiled).toContain('### Notes');
});

test('does not split columns on canonical separators inside nested code fences', () => {
	const markdown = [
		'%%marp-columns%%',
		'```text',
		'before',
		'%%marp-column%%',
		'after',
		'```',
		'%%marp-column%%',
		'Right column',
		'%%/marp-columns%%',
	].join('\n');
	const compiled = compileMarpExtendedCommentBlocks(markdown);

	expect(compiled.match(/class="marp-extended-column"/g)).toHaveLength(2);
	expect(compiled).toContain('before\n%%marp-column%%\nafter');
	expect(compiled).toContain('Right column');
});

test('compiles canonical cards into namespaced metric markup', () => {
	const markdown = [
		'%%marp-cards[columns=2]%%',
		'### A · Palette',
		'One accent.',
		'%%marp-card%%',
		'### B · Type',
		'One serif.',
		'%%/marp-cards%%',
	].join('\n');
	const compiled = compileMarpExtendedCommentBlocks(markdown);

	expect(compiled).toContain('<table class="marp-extended-cards marp-extended-cards-2">');
	expect(compiled).toContain('<div class="marp-extended-card-title"><span class="marp-extended-card-label">A</span>Palette</div>');
	expect(compiled).toContain('<div class="marp-extended-card-title"><span class="marp-extended-card-label">B</span>Type</div>');
	expect(compiled).toContain('One accent.');
});

test('preserves regular Obsidian comments unchanged', () => {
	const markdown = 'Before\n%%draft note%%\nAfter';

	expect(compileMarpExtendedCommentBlocks(markdown)).toBe(markdown);
});

test('leaves unclosed Extended markers unchanged without swallowing content', () => {
	const markdown = '%%marp-lead%%\nText';

	expect(compileMarpExtendedCommentBlocks(markdown)).toBe(markdown);
});

test('leaves mismatched closing Extended markers unchanged without swallowing content', () => {
	const markdown = '%%marp-lead%%\nText\n%%/marp-callout%%';

	expect(compileMarpExtendedCommentBlocks(markdown)).toBe(markdown);
});

test('compiles an empty canonical callout to an empty wrapper', () => {
	const markdown = ['%%marp-callout[variant=mc]%%', '%%/marp-callout%%'].join('\n');

	expect(compileMarpExtendedCommentBlocks(markdown)).toContain('<div class="marp-extended-callout marp-extended-callout-mc">\n\n\n\n</div>');
});

test('uses the co variant when a canonical callout omits variant', () => {
	const markdown = ['%%marp-callout%%', 'Conclusion', '%%/marp-callout%%'].join('\n');

	expect(compileMarpExtendedCommentBlocks(markdown)).toContain('class="marp-extended-callout marp-extended-callout-co"');
});

test('compiles nested comment markers inside columns', () => {
	const markdown = [
		'%%marp-columns%%',
		'%%marp-lead%%',
		'Lead in first column',
		'%%/marp-lead%%',
		'%%marp-column%%',
		'Second column plain text',
		'%%/marp-columns%%',
	].join('\n');
	const compiled = compileMarpExtendedCommentBlocks(markdown);

	expect(compiled).toContain('<div class="marp-extended-columns marp-extended-columns-2">');
	expect(compiled).toContain('<div class="marp-extended-lead">');
	expect(compiled).toContain('Lead in first column');
	expect(compiled).toContain('Second column plain text');
	expect(compiled).not.toContain('%%marp-');
	expect(compiled).not.toContain('%%/marp-');
});

test('recursively compiles nested semantic, callout, and layout markers', () => {
	const markdown = [
		'%%marp-lead%%',
		'Lead text',
		'%%marp-callout[variant=warning]%%',
		'Nested warning',
		'%%/marp-callout%%',
		'%%marp-columns%%',
		'Left',
		'%%marp-column%%',
		'Right',
		'%%/marp-columns%%',
		'%%/marp-lead%%',
	].join('\n');
	const compiled = compileMarpExtendedCommentBlocks(markdown);

	expect(compiled).toContain('class="marp-extended-lead"');
	expect(compiled).toContain('class="marp-extended-callout marp-extended-callout-warning"');
	expect(compiled).toContain('marp-extended-columns-2');
	expect(compiled).not.toContain('%%marp-');
	expect(compiled).not.toContain('%%/marp-');
});

test('compiles canonical semantic names and sanitizes callout variants', () => {
	const markdown = '%%marp-subtitle%%\nSub\n%%/marp-subtitle%%\n%%marp-metadata%%\nMeta\n%%/marp-metadata%%\n%%marp-callout[variant="Big Alert!"]%%\nBody\n%%/marp-callout%%';
	const compiled = compileMarpExtendedCommentBlocks(markdown);

	expect(compiled).toContain('class="marp-extended-subtitle"');
	expect(compiled).toContain('class="marp-extended-metadata"');
	expect(compiled).toContain('class="marp-extended-callout marp-extended-callout-big-alert"');
	expect(compiled).not.toMatch(/class="(?:lead|sub|meta|co|mc|note|c2|t2x2|mt|ml)(?:\s|")/);
});

test('leaves removed marker names and attribute forms unchanged', () => {
	for (const markdown of [
		'%%marp-sub%%\nSub\n%%/marp-sub%%',
		'%%marp-meta%%\nMeta\n%%/marp-meta%%',
		'%%marp-co%%\nConclusion\n%%/marp-co%%',
		'%%marp-mc%%\nMini\n%%/marp-mc%%',
		'%%marp-note%%\nNote\n%%/marp-note%%',
		'%%marp-cols%%\nLeft\n%%marp-col%%\nRight\n%%/marp-cols%%',
		'%%marp-callout[mc]%%\nBody\n%%/marp-callout%%',
		'%%marp-callout[type=mc]%%\nBody\n%%/marp-callout%%',
		'%%marp-cards[2x2]%%\nCard\n%%/marp-cards%%',
	]) expect(compileMarpExtendedCommentBlocks(markdown)).toBe(markdown);
});

test('leaves markers with unbalanced attribute quotes unchanged', () => {
	for (const markdown of [
		'%%marp-slide[class="unterminated]%%',
		'%%marp-callout[variant="unterminated]%%\nBody\n%%/marp-callout%%',
	]) expect(compileMarpExtendedCommentBlocks(markdown)).toBe(markdown);
});

test('supports canonical columns and cards column counts', () => {
	const columns = compileMarpExtendedCommentBlocks('%%marp-columns%%\nA\n%%marp-column%%\nB\n%%marp-column%%\nC\n%%/marp-columns%%');
	const cards = compileMarpExtendedCommentBlocks('%%marp-cards[columns=3]%%\nA\n%%marp-card%%\nB\n%%marp-card%%\nC\n%%/marp-cards%%');

	expect(columns).toContain('marp-extended-columns-3');
	expect(cards).toContain('marp-extended-cards-3');
	expect(cards.match(/class="marp-extended-card"/g)).toHaveLength(3);
});

test('keeps markers literal in tilde, long, and indented CommonMark fences', () => {
	for (const markdown of [
		'~~~text\n%%marp-lead%%\nText\n%%/marp-lead%%\n~~~',
		'````text\n%%marp-slide[class=cover]%%\n```\n````',
		'   ```text\n%%marp-lead%%\nText\n%%/marp-lead%%\n   ```',
	]) expect(compileMarpExtendedCommentBlocks(markdown)).toBe(markdown);
});

test('does not split columns at separators inside a tilde fence', () => {
	const markdown = '%%marp-columns%%\n~~~\n%%marp-column%%\n~~~\n%%marp-column%%\nRight\n%%/marp-columns%%';
	const compiled = compileMarpExtendedCommentBlocks(markdown);
	expect(compiled.match(/class="marp-extended-column"/g)).toHaveLength(2);
	expect(compiled).toContain('~~~\n%%marp-column%%\n~~~');
});
