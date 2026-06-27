import type { App, TFile } from 'obsidian';
import { MermaidThemeManager } from './mermaidThemeManager';

const MERMAID_THEME_PROPERTY = 'mermaidTheme';
const MERMAID_FLAT_PROPERTY = 'mermaidFlat';

const MERMAID_FLAT_CSS = `section .mermaid-diagram-container.mermaid-diagram {
  background: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
}

section .mermaid-diagram-container.mermaid-diagram svg {
  --bg: var(--surface, transparent) !important;
}

section .mermaid-diagram-container.mermaid-diagram svg .edge-label rect {
  fill: var(--surface, var(--bg)) !important;
}`;

function getFrontmatter(markdown: string): string | null {
	const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
	return match?.[1] ?? null;
}

export function getMermaidThemeName(markdown: string): string | null {
	const frontmatter = getFrontmatter(markdown);
	if (!frontmatter) {
		return null;
	}

	const property = frontmatter.match(/^mermaidTheme:\s*['"]?([^'"\n#]+?)['"]?\s*(?:#.*)?$/m);
	return property?.[1].trim() || null;
}

function parseBooleanPropertyValue(value: unknown): boolean | null {
	if (typeof value === 'boolean') {
		return value;
	}

	if (typeof value !== 'string') {
		return null;
	}

	switch (value.trim().toLowerCase()) {
		case 'true':
		case 'yes':
		case 'on':
		case '1':
			return true;
		case 'false':
		case 'no':
		case 'off':
		case '0':
			return false;
		default:
			return null;
	}
}

export function getMermaidFlat(markdown: string): boolean {
	const frontmatter = getFrontmatter(markdown);
	if (!frontmatter) {
		return false;
	}

	const property = frontmatter.match(/^mermaidFlat:\s*['"]?([^'"\n#]+?)['"]?\s*(?:#.*)?$/m);
	return parseBooleanPropertyValue(property?.[1]) ?? false;
}

function getMermaidFlatCss(enabled: boolean): string {
	return enabled ? MERMAID_FLAT_CSS : '';
}

export async function loadMermaidThemeCssForMarkdown(app: App, markdown: string): Promise<string> {
	const themeName = getMermaidThemeName(markdown);
	const themeCss = themeName ? await new MermaidThemeManager(app).loadThemeCss(themeName) ?? '' : '';
	const flatCss = getMermaidFlatCss(getMermaidFlat(markdown));

	return [themeCss, flatCss].filter(Boolean).join('\n');
}

export async function loadMermaidThemeCssForFile(app: App, file: TFile, markdown: string): Promise<string> {
	const frontmatter = app.metadataCache.getFileCache?.(file)?.frontmatter;
	const cacheTheme: unknown = frontmatter?.[MERMAID_THEME_PROPERTY];
	const themeName = typeof cacheTheme === 'string' && cacheTheme.trim()
		? cacheTheme.trim()
		: getMermaidThemeName(markdown);
	const cacheFlat = parseBooleanPropertyValue(frontmatter?.[MERMAID_FLAT_PROPERTY]);
	const isFlat = cacheFlat ?? getMermaidFlat(markdown);
	const themeCss = themeName ? await new MermaidThemeManager(app).loadThemeCss(themeName) ?? '' : '';
	const flatCss = getMermaidFlatCss(isFlat);

	return [themeCss, flatCss].filter(Boolean).join('\n');
}

export function wrapMermaidThemeCss(css: string): string {
	return css.trim() ? `<style class="marp-extended-mermaid-theme">\n${css.trim()}\n</style>\n` : '';
}

export function insertMarkdownAfterFrontmatter(markdown: string, content: string): string {
	if (!content) {
		return markdown;
	}

	const frontmatter = markdown.match(/^(---\s*\n[\s\S]*?\n---\s*(?:\n|$))/);
	if (!frontmatter) {
		return `${content}${markdown}`;
	}

	return `${frontmatter[1]}${content}${markdown.slice(frontmatter[1].length)}`;
}
