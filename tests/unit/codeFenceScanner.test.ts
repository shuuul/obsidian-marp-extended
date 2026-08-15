import { expect, test } from '@jest/globals';

import {
	closingCodeFence,
	mapOutsideCodeFences,
	mapOutsideInlineCode,
	openingCodeFence,
} from '@marp-extended/code-fence-scanner';

const MARKER = '[[MARK]]';

test('openingCodeFence accepts up to 3 leading spaces and both markers', () => {
	expect(openingCodeFence('```mermaid')).toEqual({ marker: '`', length: 3 });
	expect(openingCodeFence('   ~~~~')).toEqual({ marker: '~', length: 4 });
	expect(openingCodeFence('    ```')).toBeNull();
	expect(openingCodeFence('``')).toBeNull();
	expect(openingCodeFence('text ```')).toBeNull();
});

test('closingCodeFence requires same marker, sufficient length, and no info string', () => {
	const fence = { marker: '`' as const, length: 4 };
	expect(closingCodeFence('````', fence)).toBe(true);
	expect(closingCodeFence('`````', fence)).toBe(true);
	expect(closingCodeFence('```', fence)).toBe(false);
	expect(closingCodeFence('```js', fence)).toBe(false);
	expect(closingCodeFence('~~~', fence)).toBe(false);
	expect(closingCodeFence('  ````  ', fence)).toBe(true);
	expect(closingCodeFence('````\r', fence)).toBe(true);
});

test('mapOutsideCodeFences transforms only content outside fences', () => {
	const markdown = [
		'outside [[x]]',
		'```js',
		'const s = "[[y]]";',
		'```',
		'back out [[z]]',
	].join('\n');

	const result = mapOutsideCodeFences(markdown, (segment) => segment.replace(/\[\[[^\]]*\]\]/g, MARKER));

	expect(result).toBe([
		`outside ${MARKER}`,
		'```js',
		'const s = "[[y]]";',
		'```',
		`back out ${MARKER}`,
	].join('\n'));
});

test('mapOutsideCodeFences does not close a longer fence with a shorter run', () => {
	const markdown = [
		'````',
		'```',
		'[[nested]]',
		'```',
		'````',
		'[[after]]',
	].join('\n');

	const result = mapOutsideCodeFences(markdown, (segment) => segment.replace(/\[\[[^\]]*\]\]/g, MARKER));

	expect(result).toContain('[[nested]]');
	expect(result).toContain(MARKER);
	expect(result.endsWith(MARKER)).toBe(true);
});

test('mapOutsideCodeFences leaves an unterminated fence untouched', () => {
	const markdown = 'start [[a]]\n```\n[[b]]';
	const result = mapOutsideCodeFences(markdown, (segment) => segment.replace(/\[\[[^\]]*\]\]/g, MARKER));
	expect(result).toBe(`start ${MARKER}\n\`\`\`\n[[b]]`);
});

test('mapOutsideInlineCode skips single and double backtick spans', () => {
	const text = 'a [[x]] `[[y]]` b ``c [[z]] d`` e';
	const result = mapOutsideInlineCode(text, (segment) => segment.replace(/\[\[[^\]]*\]\]/g, MARKER));
	expect(result).toBe(`a ${MARKER} \`[[y]]\` b \`\`c [[z]] d\`\` e`);
});

test('mapOutsideInlineCode treats unmatched runs as literal text', () => {
	const text = 'before `unmatched [[x]]';
	const result = mapOutsideInlineCode(text, (segment) => segment.replace(/\[\[[^\]]*\]\]/g, MARKER));
	expect(result).toBe(`before \`unmatched ${MARKER}`);
});

test('mapOutsideInlineCode matches runs by exact length', () => {
	const text = '``a ` [[x]] `` tail';
	const result = mapOutsideInlineCode(text, (segment) => segment.replace(/\[\[[^\]]*\]\]/g, MARKER));
	expect(result).toBe('``a ` [[x]] `` tail');
});
