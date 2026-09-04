import { expect, test } from '@jest/globals';

import {
	getPreviewSlideIndex,
	getPreviewSlideStartLine,
	getPreviewSourceRange,
} from '@/utilities/previewSync';

test('preview sync maps cursor lines to slide indexes', () => {
	const markdown = '# First\n\n---\n\n# Second\n\n---\n\n# Third';

	expect(getPreviewSlideIndex(markdown, 0)).toBe(0);
	expect(getPreviewSlideIndex(markdown, 2)).toBe(0);
	expect(getPreviewSlideIndex(markdown, 4)).toBe(1);
	expect(getPreviewSlideIndex(markdown, 8)).toBe(2);
});

test('preview sync ignores frontmatter delimiters', () => {
	const markdown = '---\ntheme: default\n---\n# First\n---\n# Second';

	expect(getPreviewSlideIndex(markdown, 1)).toBe(0);
	expect(getPreviewSlideIndex(markdown, 3)).toBe(0);
	expect(getPreviewSlideIndex(markdown, 5)).toBe(1);
});

test('preview sync counts only standalone slide separators', () => {
	const markdown = '# First\ntext --- text\n    ---\n ---\n# Second';

	expect(getPreviewSlideIndex(markdown, 3)).toBe(0);
	expect(getPreviewSlideIndex(markdown, 4)).toBe(1);
});

test('preview sync ignores separators inside fenced code blocks', () => {
	const markdown = '# First\n```\n---\n```\n---\n# Second';

	expect(getPreviewSlideIndex(markdown, 3)).toBe(0);
	expect(getPreviewSlideIndex(markdown, 5)).toBe(1);
});

test('preview sync clamps invalid cursor lines', () => {
	const markdown = '# First\n---\n# Second';

	expect(getPreviewSlideIndex(markdown, Number.NaN)).toBe(0);
	expect(getPreviewSlideIndex(markdown, -1)).toBe(0);
	expect(getPreviewSlideIndex(markdown, 99)).toBe(1);
});

test('preview source navigation maps slide indexes to start lines', () => {
	const markdown = '---\ntheme: default\n---\n# First\n\n---\n\n# Second\n---\n# Third';

	expect(getPreviewSlideStartLine(markdown, 0)).toBe(3);
	expect(getPreviewSlideStartLine(markdown, 1)).toBe(6);
	expect(getPreviewSlideStartLine(markdown, 2)).toBe(9);
});

test('preview source navigation ignores non-separators and fenced separators', () => {
	const markdown = '# First\ntext --- text\n    ---\n```\n---\n```\n ---\n# Second';

	expect(getPreviewSlideStartLine(markdown, 1)).toBe(7);
	expect(getPreviewSlideStartLine(markdown, 2)).toBeNull();
});

test('preview source navigation rejects invalid slide indexes', () => {
	const markdown = '# First\n---\n# Second';

	expect(getPreviewSlideStartLine(markdown, -1)).toBeNull();
	expect(getPreviewSlideStartLine(markdown, 1.5)).toBeNull();
	expect(getPreviewSlideStartLine(markdown, 2)).toBeNull();
});

test('preview source navigation finds selected text within only the matching slide', () => {
	const markdown = '# Repeated title\n---\n# Repeated title\n\nAlpha\nBeta';
	const secondTitleOffset = markdown.lastIndexOf('Repeated title');
	const multilineOffset = markdown.indexOf('Alpha');

	expect(getPreviewSourceRange(markdown, 1, 'Repeated title')).toEqual({
		fromOffset: secondTitleOffset,
		toOffset: secondTitleOffset + 'Repeated title'.length,
	});
	expect(getPreviewSourceRange(markdown, 1, 'Alpha Beta')).toEqual({
		fromOffset: multilineOffset,
		toOffset: multilineOffset + 'Alpha\nBeta'.length,
	});
	expect(getPreviewSourceRange(markdown, 0, 'Alpha')).toBeNull();
});
