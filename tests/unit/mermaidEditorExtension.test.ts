import { expect, test } from '@jest/globals';

import { findMermaidFenceRanges } from '@/editor/mermaidEditorExtension';

test('findMermaidFenceRanges returns bracket-caption alt for mermaid fences', () => {
	const markdown = [
		'# X',
		'',
		'```mermaid[Kami Mermaid]',
		'flowchart LR',
		'  A --> B',
		'```',
		'',
	].join('\n');

	const ranges = findMermaidFenceRanges(markdown);

	expect(ranges).toHaveLength(1);
	expect(ranges[0]?.alt).toBe('Kami Mermaid');
	expect(ranges[0]?.info).toBe('mermaid[Kami Mermaid]');
});

test('findMermaidFenceRanges ignores non-mermaid fences', () => {
	const markdown = [
		'```typescript',
		'const value = 1;',
		'```',
		'',
		'```mermaid[Flow]',
		'flowchart LR',
		'  A --> B',
		'```',
	].join('\n');

	const ranges = findMermaidFenceRanges(markdown);

	expect(ranges).toHaveLength(1);
	expect(ranges[0]?.alt).toBe('Flow');
});

test('findMermaidFenceRanges returns diagram source without fence lines', () => {
	const markdown = '```mermaid[Kami Mermaid]\nflowchart LR\n  A --> B\n```\n';

	const ranges = findMermaidFenceRanges(markdown);

	expect(ranges).toHaveLength(1);
	expect(ranges[0]?.source).toBe('flowchart LR\n  A --> B\n');
	expect(ranges[0]?.source).not.toContain('```');
});

test('findMermaidFenceRanges sets document offsets for the full fence span', () => {
	const markdown = '# Title\n\n```mermaid[Caption]\ngraph TD\n  X\n```\n\nTail';

	const ranges = findMermaidFenceRanges(markdown);
	const fenceStart = markdown.indexOf('```mermaid[Caption]');
	const fenceEnd = markdown.indexOf('```', fenceStart + 3) + '```'.length;

	expect(ranges).toHaveLength(1);
	expect(ranges[0]?.from).toBe(fenceStart);
	expect(ranges[0]?.to).toBe(fenceEnd);
});