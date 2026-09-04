import { closingCodeFence, openingCodeFence, type CodeFence } from '@marp-extended/code-fence-scanner';

const SLIDE_SEPARATOR_PATTERN = /^ {0,3}---\s*$/;

type LineReader = (lineNumber: number) => string;

export type PreviewSourceRange = {
	fromOffset: number;
	toOffset: number;
};

export function getPreviewSlideIndex(markdown: string, cursorLine: number): number {
	const lines = markdown.split('\n');
	return getPreviewSlideIndexFromLineReader(lines.length, cursorLine, (lineNumber) => lines[lineNumber] ?? '');
}

export function getPreviewSlideIndexFromLineReader(
	lineCount: number,
	cursorLine: number,
	getLine: LineReader,
): number {
	const linesBeforeCursor = getLinesBeforeCursor(lineCount, cursorLine);
	let slideIndex = 0;
	scanSlideSeparators(lineCount, linesBeforeCursor, getLine, () => {
		slideIndex++;
		return true;
	});
	return slideIndex;
}

export function getPreviewSlideStartLine(markdown: string, slideIndex: number): number | null {
	const lines = markdown.split('\n');
	if (!Number.isFinite(slideIndex) || slideIndex < 0 || Math.floor(slideIndex) !== slideIndex) {
		return null;
	}

	const frontmatterEndLine = getFrontmatterEndLine(lines.length, (lineNumber) => lines[lineNumber] ?? '');
	if (slideIndex === 0) {
		return Math.min(frontmatterEndLine == null ? 0 : frontmatterEndLine + 1, lines.length - 1);
	}

	let currentSlideIndex = 0;
	let startLine: number | null = null;
	scanSlideSeparators(lines.length, lines.length, (lineNumber) => lines[lineNumber] ?? '', (lineNumber) => {
		currentSlideIndex++;
		if (currentSlideIndex !== slideIndex) {
			return true;
		}
		startLine = Math.min(lineNumber + 1, lines.length - 1);
		return false;
	});
	return startLine;
}

export function getPreviewSourceRange(
	markdown: string,
	slideIndex: number,
	selectedText: string,
): PreviewSourceRange | null {
	const selection = selectedText.trim();
	const startLine = getPreviewSlideStartLine(markdown, slideIndex);
	if (!selection || startLine == null) {
		return null;
	}

	const lineOffsets = getLineOffsets(markdown);
	const fromOffset = lineOffsets[startLine] ?? markdown.length;
	const nextSlideStartLine = getPreviewSlideStartLine(markdown, slideIndex + 1);
	const toOffset = nextSlideStartLine == null
		? markdown.length
		: lineOffsets[nextSlideStartLine] ?? markdown.length;
	const slideMarkdown = markdown.slice(fromOffset, toOffset);
	const exactOffset = slideMarkdown.indexOf(selection);
	if (exactOffset >= 0) {
		return {
			fromOffset: fromOffset + exactOffset,
			toOffset: fromOffset + exactOffset + selection.length,
		};
	}

	const whitespacePattern = selection
		.split(/\s+/)
		.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
		.join('\\s+');
	const normalizedMatch = new RegExp(whitespacePattern).exec(slideMarkdown);
	return normalizedMatch
		? {
			fromOffset: fromOffset + normalizedMatch.index,
			toOffset: fromOffset + normalizedMatch.index + normalizedMatch[0].length,
		}
		: null;
}

function getLineOffsets(markdown: string): number[] {
	const offsets = [0];
	for (let index = 0; index < markdown.length; index++) {
		if (markdown[index] === '\n') {
			offsets.push(index + 1);
		}
	}
	return offsets;
}

function scanSlideSeparators(
	lineCount: number,
	endLine: number,
	getLine: LineReader,
	onSeparator: (lineNumber: number) => boolean,
): void {
	const frontmatterEndLine = getFrontmatterEndLine(lineCount, getLine);
	const firstContentLine = frontmatterEndLine == null ? 0 : frontmatterEndLine + 1;
	let codeFence: CodeFence | null = null;

	for (let lineNumber = firstContentLine; lineNumber < endLine; lineNumber++) {
		const line = getLine(lineNumber);

		if (codeFence) {
			if (closingCodeFence(line, codeFence)) {
				codeFence = null;
			}
			continue;
		}

		codeFence = openingCodeFence(line);
		if (codeFence) {
			continue;
		}

		if (SLIDE_SEPARATOR_PATTERN.test(line) && !onSeparator(lineNumber)) {
			return;
		}
	}
}

function getLinesBeforeCursor(lineCount: number, cursorLine: number): number {
	if (!Number.isFinite(cursorLine)) {
		return 0;
	}

	return Math.min(Math.max(Math.floor(cursorLine), 0), lineCount);
}

function getFrontmatterEndLine(lineCount: number, getLine: LineReader): number | null {
	if (getLine(0)?.trim() !== '---') {
		return null;
	}

	for (let lineNumber = 1; lineNumber < lineCount; lineNumber++) {
		if (getLine(lineNumber).trim() === '---') {
			return lineNumber;
		}
	}

	return null;
}
