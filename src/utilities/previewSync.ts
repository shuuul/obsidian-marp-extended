import { closingCodeFence, openingCodeFence, type CodeFence } from '@marp-extended/code-fence-scanner';

const SLIDE_SEPARATOR_PATTERN = /^ {0,3}---\s*$/;

type LineReader = (lineNumber: number) => string;

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
	const frontmatterEndLine = getFrontmatterEndLine(lineCount, getLine);
	const firstContentLine = frontmatterEndLine == null ? 0 : frontmatterEndLine + 1;
	let slideIndex = 0;
	let codeFence: CodeFence | null = null;

	for (let lineNumber = firstContentLine; lineNumber < linesBeforeCursor; lineNumber++) {
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

		if (SLIDE_SEPARATOR_PATTERN.test(line)) {
			slideIndex++;
		}
	}

	return slideIndex;
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
