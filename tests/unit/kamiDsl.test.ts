import { expect, test } from '@jest/globals';

import { compileKamiCommentBlocks } from '@/utilities/kamiDsl';

test('compiles slide metadata markers into Marp spot directives', () => {
	const markdown = [
		'# Cover',
		'',
		'%%marp-slide[class=cover paginate=false footer="" header="01 · Origin"]%%',
	].join('\n');

	const compiled = compileKamiCommentBlocks(markdown);

	expect(compiled).toContain('<!-- _class: cover -->');
	expect(compiled).toContain('<!-- _paginate: false -->');
	expect(compiled).toContain('<!-- _header: 01 · Origin -->');
	expect(compiled).toMatch(/<!-- _footer: (\"\"|) -->/);
});

test('compiles Kami semantic markers into theme class blocks', () => {
	const markdown = [
		'%%marp-lead%%',
		'Same palette, fonts, layout tokens.',
		'%%/marp-lead%%',
		'',
		'%%marp-callout[mc]%%',
		'Fix the layer outside the loop.',
		'%%/marp-callout%%',
	].join('\n');
	const compiled = compileKamiCommentBlocks(markdown);

	expect(compiled).toContain('<div class="lead marp-extended-lead">\n\nSame palette, fonts, layout tokens.\n\n</div>');
	expect(compiled).toContain('<div class="mc marp-extended-callout marp-extended-callout-mc">\n\nFix the layer outside the loop.\n\n</div>');
});

test('compiles columns split by %%marp-col%% into the existing Kami two-column wrapper', () => {
	const markdown = [
		'%%marp-cols%%',
		'### Left',
		'',
		'- A',
		'%%marp-col%%',
		'### Right',
		'',
		'- B',
		'%%/marp-cols%%',
	].join('\n');
	const compiled = compileKamiCommentBlocks(markdown);

	expect(compiled).toContain('<div class="c2 marp-extended-columns marp-extended-columns-2">');
	expect(compiled).toContain('### Left');
	expect(compiled).toContain('### Right');
	expect(compiled).toContain('</div>\n\n<div class="marp-extended-column">');
});

test('keeps nested code fences inside Kami blocks', () => {
	const markdown = [
		'%%marp-cols%%',
		'### Diagram',
		'',
		'```mermaid[Kami Mermaid]',
		'flowchart LR',
		'  A --> B',
		'```',
		'%%marp-col%%',
		'### Notes',
		'',
		'- Text',
		'%%/marp-cols%%',
	].join('\n');
	const compiled = compileKamiCommentBlocks(markdown);

	expect(compiled).toContain('<div class="c2 marp-extended-columns marp-extended-columns-2">');
	expect(compiled).toContain('```mermaid[Kami Mermaid]');
	expect(compiled).toContain('flowchart LR');
	expect(compiled).toContain('### Notes');
});

test('does not split columns on %%marp-col%% inside nested code fences', () => {
	const markdown = [
		'%%marp-cols%%',
		'```text',
		'before',
		'%%marp-col%%',
		'after',
		'```',
		'%%marp-col%%',
		'Right column',
		'%%/marp-cols%%',
	].join('\n');
	const compiled = compileKamiCommentBlocks(markdown);

	expect(compiled.match(/class="marp-extended-column"/g)).toHaveLength(2);
	expect(compiled).toContain('before\n%%marp-col%%\nafter');
	expect(compiled).toContain('Right column');
});

test('compiles 2x2 card markers into the existing Kami metric table', () => {
	const markdown = [
		'%%marp-cards[2x2]%%',
		'### A · Palette',
		'One accent.',
		'%%marp-card%%',
		'### B · Type',
		'One serif.',
		'%%/marp-cards%%',
	].join('\n');
	const compiled = compileKamiCommentBlocks(markdown);

	expect(compiled).toContain('<table class="t2x2 marp-extended-cards marp-extended-cards-2">');
	expect(compiled).toContain('<div class="mt marp-extended-card-title"><span class="ml marp-extended-card-label">A</span>Palette</div>');
	expect(compiled).toContain('<div class="mt marp-extended-card-title"><span class="ml marp-extended-card-label">B</span>Type</div>');
	expect(compiled).toContain('One accent.');
});

test('preserves regular Obsidian comments unchanged', () => {
	const markdown = 'Before\n%%draft note%%\nAfter';

	expect(compileKamiCommentBlocks(markdown)).toBe(markdown);
});

test('leaves unclosed Kami markers unchanged without swallowing content', () => {
	const markdown = '%%marp-lead%%\nText';

	expect(compileKamiCommentBlocks(markdown)).toBe(markdown);
});

test('leaves mismatched closing Kami markers unchanged without swallowing content', () => {
	const markdown = '%%marp-lead%%\nText\n%%/marp-mc%%';

	expect(compileKamiCommentBlocks(markdown)).toBe(markdown);
});

test('compiles empty mc body to the empty class wrapper', () => {
	const markdown = ['%%marp-mc%%', '%%/marp-mc%%'].join('\n');

	expect(compileKamiCommentBlocks(markdown)).toContain('<div class="mc marp-extended-callout marp-extended-callout-mc">\n\n\n\n</div>');
});

test('compiles nested Kami comment markers inside columns without abandoning the outer cols block', () => {
	const markdown = [
		'%%marp-cols%%',
		'%%marp-lead%%',
		'Lead in first column',
		'%%/marp-lead%%',
		'%%marp-col%%',
		'Second column plain text',
		'%%/marp-cols%%',
	].join('\n');
	const compiled = compileKamiCommentBlocks(markdown);

	expect(compiled).toContain('<div class="c2 marp-extended-columns marp-extended-columns-2">');
	expect(compiled).toContain('<div class="lead marp-extended-lead">');
	expect(compiled).toContain('Lead in first column');
	expect(compiled).toContain('Second column plain text');
	expect(compiled).not.toContain('%%marp-cols%%');
	expect(compiled).not.toContain('%%marp-lead%%');
	expect(compiled).not.toContain('%%/marp-lead%%');
	expect(compiled).not.toContain('%%marp-col%%');
	expect(compiled).not.toContain('%%/marp-cols%%');
});

test('recursively compiles nested markers inside semantic and callout blocks', () => {
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
	const compiled = compileKamiCommentBlocks(markdown);

	expect(compiled).toContain('class="lead marp-extended-lead"');
	expect(compiled).toContain('class="warning marp-extended-callout marp-extended-callout-warning"');
	expect(compiled).toContain('marp-extended-columns-2');
	expect(compiled).not.toContain('%%marp-');
	expect(compiled).not.toContain('%%/marp-');
});

test('supports generic aliases and sanitized callout variants', () => {
	const markdown = '%%marp-subtitle%%\nSub\n%%/marp-subtitle%%\n%%marp-metadata%%\nMeta\n%%/marp-metadata%%\n%%marp-callout[variant="Big Alert!"]%%\nBody\n%%/marp-callout%%';
	const compiled = compileKamiCommentBlocks(markdown);

	expect(compiled).toContain('class="sub marp-extended-subtitle"');
	expect(compiled).toContain('class="meta marp-extended-meta"');
	expect(compiled).toContain('class="big-alert marp-extended-callout marp-extended-callout-big-alert"');
});

test('preserves legacy custom callout class spelling and positional precedence', () => {
	const compiled = compileKamiCommentBlocks([
		'%%marp-callout[Warning type=co]%%',
		'Body',
		'%%/marp-callout%%',
	].join('\n'));

	expect(compiled).toContain('class="Warning marp-extended-callout marp-extended-callout-warning"');
	expect(compiled).not.toContain('class="co ');
});

test('leaves markers with unbalanced attribute quotes unchanged', () => {
	for (const markdown of [
		'%%marp-slide[class="unterminated]%%',
		'%%marp-callout[variant="unterminated]%%\nBody\n%%/marp-callout%%',
	]) expect(compileKamiCommentBlocks(markdown)).toBe(markdown);
});

test('supports generic columns and cards column counts', () => {
	const columns = compileKamiCommentBlocks('%%marp-columns%%\nA\n%%marp-column%%\nB\n%%marp-column%%\nC\n%%/marp-columns%%');
	const cards = compileKamiCommentBlocks('%%marp-cards[columns=3]%%\nA\n%%marp-card%%\nB\n%%marp-card%%\nC\n%%/marp-cards%%');

	expect(columns).toContain('marp-extended-columns-3');
	expect(cards).toContain('marp-extended-cards-3');
	expect(cards.match(/class="marp-extended-card"/g)).toHaveLength(3);
});

test('keeps markers literal in tilde, long, and indented CommonMark fences', () => {
	for (const markdown of [
		'~~~text\n%%marp-lead%%\nText\n%%/marp-lead%%\n~~~',
		'````text\n%%marp-slide[class=cover]%%\n```\n````',
		'   ```text\n%%marp-lead%%\nText\n%%/marp-lead%%\n   ```',
	]) expect(compileKamiCommentBlocks(markdown)).toBe(markdown);
});

test('does not split generic columns at separators inside a tilde fence', () => {
	const markdown = '%%marp-columns%%\n~~~\n%%marp-column%%\n~~~\n%%marp-column%%\nRight\n%%/marp-columns%%';
	const compiled = compileKamiCommentBlocks(markdown);
	expect(compiled.match(/class="marp-extended-column"/g)).toHaveLength(2);
	expect(compiled).toContain('~~~\n%%marp-column%%\n~~~');
});
