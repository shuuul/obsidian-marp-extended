import { expect, test } from '@jest/globals';

import { getPreviewSlideIndex } from '@/utilities/previewSync';

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
