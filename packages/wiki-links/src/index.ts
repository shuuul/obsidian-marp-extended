import { mapOutsideCodeFences, mapOutsideInlineCode } from '@marp-extended/code-fence-scanner';

const NOTE_WIKI_LINK_REGEX = /(?<!!)\[\[([^\]]+)\]\]/g;
const OBSIDIAN_OPEN_PROTOCOL = 'obsidian:';
const OBSIDIAN_OPEN_HOST = 'open';

export type NoteWikiLinkMode = 'preview' | 'export';

/**
 * Convert Obsidian note wiki-links ([[path|alias]]) for Marp rendering.
 *
 * - preview: renders as a markdown link carrying an obsidian://open href so the
 *   preview click handler can open the note inside Obsidian.
 * - export: renders as plain display text; exported decks contain no link.
 *
 * Image embeds (![[...]]) are left untouched, and fenced or inline code blocks
 * are skipped so Mermaid shapes like A[[subroutine]] and code samples survive.
 * Indented (4-space) code blocks are intentionally out of scope because their
 * CommonMark interpretation is ambiguous with list content.
 */
export function convertNoteWikiLinks(markdown: string, mode: NoteWikiLinkMode): string {
	return mapOutsideCodeFences(markdown, (segment) =>
		mapOutsideInlineCode(segment, (plainText) =>
			plainText.replace(NOTE_WIKI_LINK_REGEX, (match: string, wikiLink: string) => {
				const pipeIndex = wikiLink.indexOf('|');
				const linkpath = (pipeIndex >= 0 ? wikiLink.slice(0, pipeIndex) : wikiLink).trim();
				const displayText = (pipeIndex >= 0 ? wikiLink.slice(pipeIndex + 1) : linkpath).trim();

				if (!linkpath || !displayText) {
					return match;
				}

				if (mode === 'export') {
					return displayText;
				}

				return `[${escapeMarkdownLinkText(displayText)}](<${buildObsidianOpenHref(linkpath)}>)`;
			}),
		),
	);
}

/**
 * Build the obsidian://open href carried by preview-mode note links.
 */
export function buildObsidianOpenHref(linkpath: string): string {
	return `obsidian://open?file=${encodeURIComponent(linkpath)}`;
}

/**
 * Extract the note linkpath from an obsidian://open href, or null for any other href.
 */
export function getInternalLinkpathFromHref(href: string): string | null {
	const trimmed = href.trim();
	if (!trimmed) {
		return null;
	}

	try {
		const url = new URL(trimmed);
		if (url.protocol !== OBSIDIAN_OPEN_PROTOCOL || url.hostname !== OBSIDIAN_OPEN_HOST) {
			return null;
		}

		const linkpath = url.searchParams.get('file');
		return linkpath && linkpath.length > 0 ? linkpath : null;
	} catch {
		return null;
	}
}

function escapeMarkdownLinkText(text: string): string {
	return text.replace(/\\/g, '\\\\').replace(/\[/g, '\\[').replace(/]/g, '\\]');
}
