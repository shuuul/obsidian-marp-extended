import { expect, test } from '@jest/globals';

import { findMermaidFenceRanges, resolveEditorMermaidTheme } from '@/editor/mermaidEditorExtension';
import type { MarpExtendedSettings } from '@/utilities/settings';

const settings: MarpExtendedSettings = {
	MARP_CLI_PATH: '',
	MARP_CLI_USE_NPX: false,
	CHROME_PATH: '',
	MERMAID_EDITOR_RENDER: true,
	MERMAID_EDITOR_THEME: 'kami',
};

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

test('findMermaidFenceRanges returns source start offset', () => {
	const markdown = '# Title\n\n```mermaid[Caption]\ngraph TD\n  X\n```';

	const ranges = findMermaidFenceRanges(markdown);

	expect(ranges).toHaveLength(1);
	expect(ranges[0]?.sourceFrom).toBe(markdown.indexOf('graph TD'));
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

test('findMermaidFenceRanges ignores mermaid fences inside frontmatter metadata', () => {
	const markdown = [
		'---',
		'description: |',
		'  ```mermaid',
		'  flowchart LR',
		'  ```',
		'---',
		'',
		'```mermaid',
		'flowchart TD',
		'  A --> B',
		'```',
	].join('\n');

	const ranges = findMermaidFenceRanges(markdown);

	expect(ranges).toHaveLength(1);
	expect(ranges[0]?.source).toBe('flowchart TD\n  A --> B\n');
});

test('resolveEditorMermaidTheme prefers frontmatter mermaidTheme over settings theme', () => {
	const markdown = '---\nmermaidTheme: custom-mermaid\n---\n\n```mermaid\nflowchart LR\n  A --> B\n```';

	expect(resolveEditorMermaidTheme(markdown, settings)).toBe('custom-mermaid');
});

test('resolveEditorMermaidTheme falls back to settings theme when frontmatter has no mermaidTheme', () => {
	const markdown = '---\ntheme: default\n---\n\n```mermaid\nflowchart LR\n  A --> B\n```';

	expect(resolveEditorMermaidTheme(markdown, settings)).toBe('kami');
});
