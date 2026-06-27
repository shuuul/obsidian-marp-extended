import { expect, test } from '@jest/globals';

import { compileKamiFencedBlocks } from '@/utilities/kamiDsl';

test('compiles slide metadata fences into Marp spot directives', () => {
	const markdown = [
		'# Cover',
		'',
		'```slide[]',
		'class: cover',
		'paginate: false',
		'footer: ""',
		'header: 01 · Origin',
		'```',
	].join('\n');

	expect(compileKamiFencedBlocks(markdown)).toContain([
		'<!-- _class: cover -->',
		'<!-- _paginate: false -->',
		'<!-- _footer: "" -->',
		'<!-- _header: 01 · Origin -->',
	].join('\n'));
});

test('compiles Kami semantic fences into theme class blocks', () => {
	const markdown = [
		'```lead[]',
		'Same palette, fonts, layout tokens.',
		'```',
		'',
		'```callout[mc]',
		'Fix the layer outside the loop.',
		'```',
	].join('\n');
	const compiled = compileKamiFencedBlocks(markdown);

	expect(compiled).toContain('<div class="lead">\n\nSame palette, fonts, layout tokens.\n\n</div>');
	expect(compiled).toContain('<div class="mc">\n\nFix the layer outside the loop.\n\n</div>');
});

test('compiles columns split by === into the existing Kami two-column wrapper', () => {
	const markdown = [
		'```cols[]',
		'### Left',
		'',
		'- A',
		'===',
		'### Right',
		'',
		'- B',
		'```',
	].join('\n');
	const compiled = compileKamiFencedBlocks(markdown);

	expect(compiled).toContain('<div class="c2">');
	expect(compiled).toContain('### Left');
	expect(compiled).toContain('### Right');
	expect(compiled).toContain('</div>\n\n<div>');
});

test('keeps nested code fences inside Kami blocks', () => {
	const markdown = [
		'```cols[]',
		'### Diagram',
		'',
		'```mermaid[Kami Mermaid]',
		'flowchart LR',
		'  A --> B',
		'```',
		'===',
		'### Notes',
		'',
		'- Text',
		'```',
	].join('\n');
	const compiled = compileKamiFencedBlocks(markdown);

	expect(compiled).toContain('<div class="c2">');
	expect(compiled).toContain('```mermaid[Kami Mermaid]');
	expect(compiled).toContain('flowchart LR');
	expect(compiled).toContain('### Notes');
});

test('does not split columns on === inside nested code fences', () => {
	const markdown = [
		'```cols[]',
		'```text',
		'before',
		'===',
		'after',
		'```',
		'===',
		'Right column',
		'```',
	].join('\n');
	const compiled = compileKamiFencedBlocks(markdown);

	expect(compiled.match(/<div>/g)).toHaveLength(2);
	expect(compiled).toContain('before\n===\nafter');
	expect(compiled).toContain('Right column');
});

test('compiles 2x2 card fences into the existing Kami metric table', () => {
	const markdown = [
		'```cards[2x2]',
		'### A · Palette',
		'One accent.',
		'===',
		'### B · Type',
		'One serif.',
		'```',
	].join('\n');
	const compiled = compileKamiFencedBlocks(markdown);

	expect(compiled).toContain('<table class="t2x2">');
	expect(compiled).toContain('<div class="mt"><span class="ml">A</span>Palette</div>');
	expect(compiled).toContain('<div class="mt"><span class="ml">B</span>Type</div>');
	expect(compiled).toContain('One accent.');
});
