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

	expect(compiled).toContain('<div class="lead">\n\nSame palette, fonts, layout tokens.\n\n</div>');
	expect(compiled).toContain('<div class="mc">\n\nFix the layer outside the loop.\n\n</div>');
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

	expect(compiled).toContain('<div class="c2">');
	expect(compiled).toContain('### Left');
	expect(compiled).toContain('### Right');
	expect(compiled).toContain('</div>\n\n<div>');
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

	expect(compiled).toContain('<div class="c2">');
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

	expect(compiled.match(/<div>/g)).toHaveLength(2);
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

	expect(compiled).toContain('<table class="t2x2">');
	expect(compiled).toContain('<div class="mt"><span class="ml">A</span>Palette</div>');
	expect(compiled).toContain('<div class="mt"><span class="ml">B</span>Type</div>');
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

	expect(compileKamiCommentBlocks(markdown)).toContain('<div class="mc">\n\n\n\n</div>');
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

	expect(compiled).toContain('<div class="c2">');
	expect(compiled).toContain('<div class="lead">');
	expect(compiled).toContain('Lead in first column');
	expect(compiled).toContain('Second column plain text');
	expect(compiled).not.toContain('%%marp-cols%%');
	expect(compiled).not.toContain('%%marp-lead%%');
	expect(compiled).not.toContain('%%/marp-lead%%');
	expect(compiled).not.toContain('%%marp-col%%');
	expect(compiled).not.toContain('%%/marp-cols%%');
});