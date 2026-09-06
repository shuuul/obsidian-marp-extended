/** @jest-environment jsdom */

import { expect, test } from '@jest/globals';

import {
	annotateReadingViewSection,
	getPreviewSlideAlignLine,
	getPreviewSlideIndex,
	getPreviewSlideStartLine,
	getPreviewSourceRange,
	getReadingViewScrollContainer,
	getReadingViewSourceLine,
	scrollReadingViewToSourceLine,
	READING_VIEW_SOURCE_LINE_ATTR,
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

test('preview slide align line skips marp-slide markers and blank lines', () => {
	const markdown = [
		'---',
		'theme: default',
		'---',
		'# First',
		'',
		'---',
		'',
		'%%marp-slide[header="21"]%%',
		'',
		'## Second',
	].join('\n');

	expect(getPreviewSlideAlignLine(markdown, 1)).toBe(9);
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

test('reading view annotation stores source line starts and ignores missing info', () => {
	const section = document.createElement('div');
	annotateReadingViewSection(section, { lineStart: 4 });
	expect(section.getAttribute(READING_VIEW_SOURCE_LINE_ATTR)).toBe('4');

	annotateReadingViewSection(section, null);
	expect(section.hasAttribute(READING_VIEW_SOURCE_LINE_ATTR)).toBe(false);
});

test('reading view scroll mapping uses the last section at or above the viewport', () => {
	const container = document.createElement('div');
	const first = document.createElement('div');
	const second = document.createElement('div');
	const third = document.createElement('div');
	annotateReadingViewSection(first, { lineStart: 0 });
	annotateReadingViewSection(second, { lineStart: 6 });
	annotateReadingViewSection(third, { lineStart: 12 });
	container.append(first, second, third);
	container.getBoundingClientRect = () => ({ top: 100 } as DOMRect);
	first.getBoundingClientRect = () => ({ top: 40 } as DOMRect);
	second.getBoundingClientRect = () => ({ top: 90 } as DOMRect);
	third.getBoundingClientRect = () => ({ top: 180 } as DOMRect);

	expect(getReadingViewSourceLine(container)).toBe(6);
});

test('reading view prefers a nested preview scroller when the root does not overflow', () => {
	const root = document.createElement('div');
	const nested = document.createElement('div');
	nested.className = 'markdown-preview-view';
	root.appendChild(nested);
	Object.defineProperty(root, 'scrollHeight', { value: 200 });
	Object.defineProperty(root, 'clientHeight', { value: 200 });

	expect(getReadingViewScrollContainer(root)).toBe(nested);
});

test('reading view scrolls to the last section at or before the source line', () => {
	const container = document.createElement('div');
	const first = document.createElement('div');
	const second = document.createElement('div');
	const third = document.createElement('div');
	annotateReadingViewSection(first, { lineStart: 0 });
	annotateReadingViewSection(second, { lineStart: 6 });
	annotateReadingViewSection(third, { lineStart: 12 });
	container.append(first, second, third);
	container.getBoundingClientRect = () => ({ top: 100 } as DOMRect);
	Object.defineProperty(container, 'clientHeight', { value: 200 });
	first.getBoundingClientRect = () => ({ top: 100 } as DOMRect);
	second.getBoundingClientRect = () => ({ top: 260 } as DOMRect);
	third.getBoundingClientRect = () => ({ top: 420 } as DOMRect);
	container.scrollTop = 0;

	expect(scrollReadingViewToSourceLine(container, 8)).toBe(true);
	expect(container.scrollTop).toBe(160);
});

test('reading view can align a source section to a matching viewport offset', () => {
	const container = document.createElement('div');
	const first = document.createElement('div');
	const second = document.createElement('div');
	annotateReadingViewSection(first, { lineStart: 0 });
	annotateReadingViewSection(second, { lineStart: 6 });
	container.append(first, second);
	container.getBoundingClientRect = () => ({ top: 100 } as DOMRect);
	first.getBoundingClientRect = () => ({ top: 100 } as DOMRect);
	second.getBoundingClientRect = () => ({ top: 260 } as DOMRect);
	container.scrollTop = 0;

	expect(scrollReadingViewToSourceLine(container, 6, 140)).toBe(true);
	expect(container.scrollTop).toBe(120);
});
