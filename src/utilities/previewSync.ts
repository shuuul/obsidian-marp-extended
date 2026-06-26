const SLIDE_SEPARATOR_PATTERN = /^ {0,3}---\s*$/;
const CODE_FENCE_PATTERN = /^ {0,3}(`{3,}|~{3,})/;

type CodeFence = {
	marker: '`' | '~';
	length: number;
};

export function getPreviewSlideIndex(markdown: string, cursorLine: number): number {
	const lines = markdown.split('\n');
	const linesBeforeCursor = getLinesBeforeCursor(lines.length, cursorLine);
	const frontmatterEndLine = getFrontmatterEndLine(lines);
	const firstContentLine = frontmatterEndLine == null ? 0 : frontmatterEndLine + 1;
	let slideIndex = 0;
	let codeFence: CodeFence | null = null;

	for (let lineNumber = firstContentLine; lineNumber < linesBeforeCursor; lineNumber++) {
		const line = lines[lineNumber];

		if (codeFence) {
			if (isClosingCodeFence(line, codeFence)) {
				codeFence = null;
			}
			continue;
		}

		codeFence = getOpeningCodeFence(line);
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

function getFrontmatterEndLine(lines: string[]): number | null {
	if (lines[0]?.trim() !== '---') {
		return null;
	}

	for (let lineNumber = 1; lineNumber < lines.length; lineNumber++) {
		if (lines[lineNumber].trim() === '---') {
			return lineNumber;
		}
	}

	return null;
}

function getOpeningCodeFence(line: string): CodeFence | null {
	const match = line.match(CODE_FENCE_PATTERN);
	if (!match) {
		return null;
	}

	const fence = match[1];
	return {
		marker: fence[0] as '`' | '~',
		length: fence.length,
	};
}

function isClosingCodeFence(line: string, fence: CodeFence): boolean {
	const match = line.match(/^ {0,3}(`+|~+)\s*$/);
	if (!match) {
		return false;
	}

	const closingFence = match[1];
	return closingFence[0] === fence.marker && closingFence.length >= fence.length;
}
