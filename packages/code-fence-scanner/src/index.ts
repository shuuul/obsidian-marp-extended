/**
 * Shared code fence / inline code scanning primitives.
 *
 * Single source of truth for "is this line a code fence boundary" so the DSL
 * compiler, wiki-link conversion, mermaid pre-rendering, the editor extension,
 * and preview sync all agree on CommonMark-style semantics:
 *
 * - Opening fence: up to 3 leading spaces, then 3+ backticks or tildes.
 * - Closing fence: up to 3 leading spaces, the same marker repeated at least
 *   as many times as the opening fence, and only trailing whitespace.
 */

export type CodeFence = {
	marker: '`' | '~';
	length: number;
};

const OPENING_FENCE_PATTERN = /^ {0,3}(`{3,}|~{3,})/;
const CLOSING_FENCE_PATTERN = /^ {0,3}(`+|~+)[ \t]*\r?$/;
const BACKTICK_RUN_PATTERN = /`+/g;

export function openingCodeFence(line: string): CodeFence | null {
	const match = line.match(OPENING_FENCE_PATTERN);
	if (!match) {
		return null;
	}
	return { marker: match[1][0] as CodeFence['marker'], length: match[1].length };
}

export function closingCodeFence(line: string, fence: CodeFence): boolean {
	const match = line.match(CLOSING_FENCE_PATTERN);
	if (!match) {
		return false;
	}
	return match[1][0] === fence.marker && match[1].length >= fence.length;
}

/**
 * Apply a transform only to the parts of the markdown that are outside fenced
 * code blocks. Fenced blocks (including their boundary lines) pass through
 * untouched. Line endings are preserved (input is split on '\n' only).
 */
export function mapOutsideCodeFences(markdown: string, transform: (segment: string) => string): string {
	const lines = markdown.split('\n');
	const parts: string[] = [];
	let buffer: string[] = [];
	let fence: CodeFence | null = null;

	const flush = (transformable: boolean) => {
		if (buffer.length === 0) {
			return;
		}
		const segment = buffer.join('\n');
		parts.push(transformable ? transform(segment) : segment);
		buffer = [];
	};

	for (const line of lines) {
		if (fence) {
			buffer.push(line);
			if (closingCodeFence(line, fence)) {
				fence = null;
				flush(false);
			}
			continue;
		}

		const opening = openingCodeFence(line);
		if (opening) {
			flush(true);
			fence = opening;
			buffer.push(line);
			continue;
		}

		buffer.push(line);
	}

	flush(!fence);
	return parts.join('\n');
}

/**
 * Apply a transform only to the parts of a text segment that are outside
 * inline code spans (backtick runs). A backtick run opens a span when a
 * matching run of the same length appears later in the segment; unmatched
 * runs are treated as literal text, matching CommonMark.
 */
export function mapOutsideInlineCode(text: string, transform: (segment: string) => string): string {
	const parts: string[] = [];
	let plainStart = 0;
	let cursor = 0;

	while (cursor < text.length) {
		BACKTICK_RUN_PATTERN.lastIndex = cursor;
		const opening = BACKTICK_RUN_PATTERN.exec(text);
		if (!opening) {
			break;
		}

		const runLength = opening[0].length;
		const contentStart = opening.index + runLength;
		let closingEnd = -1;
		let searchFrom = contentStart;

		while (searchFrom < text.length) {
			BACKTICK_RUN_PATTERN.lastIndex = searchFrom;
			const closing = BACKTICK_RUN_PATTERN.exec(text);
			if (!closing) {
				break;
			}
			if (closing[0].length === runLength) {
				closingEnd = closing.index + runLength;
				break;
			}
			searchFrom = closing.index + closing[0].length;
		}

		if (closingEnd < 0) {
			// No matching run: the rest of the segment is plain text.
			break;
		}

		if (opening.index > plainStart) {
			parts.push(transform(text.slice(plainStart, opening.index)));
		}
		parts.push(text.slice(opening.index, closingEnd));
		plainStart = closingEnd;
		cursor = closingEnd;
	}

	if (plainStart < text.length) {
		parts.push(transform(text.slice(plainStart)));
	}

	return parts.join('');
}
