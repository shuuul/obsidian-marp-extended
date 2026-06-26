export interface DefaultMermaidThemeDefinition {
	name: string;
	fileName: string;
	url: string;
}

const MARP_EXTENDED_REPO_RAW_MERMAID_THEMES = 'https://raw.githubusercontent.com/shuuul/obsidian-marp-extended/main/vault/mermaid-themes';

export const DEFAULT_MERMAID_THEME_DIRECTORY = '.marp-extended/mermaid-themes';
export const DEFAULT_MERMAID_THEME_MANIFEST_VERSION = 1;
export const DEFAULT_MERMAID_THEME_VERSION_COMMENT = '@marp-extended-mermaid-theme-version';

export const DEFAULT_MERMAID_THEME_DEFINITIONS: DefaultMermaidThemeDefinition[] = [
	'academic',
	'beamer',
	'border',
	'color-head',
	'colors',
	'dracula',
	'github',
	'gradient',
	'haskell',
	'iggg',
	'kami',
	'kami-en',
	'minimal-container-turquoise',
	'minimal-turquoise',
	'olive',
].map((name) => ({
	name,
	fileName: `${name}.css`,
	url: `${MARP_EXTENDED_REPO_RAW_MERMAID_THEMES}/${name}.css`,
}));

export const DEFAULT_MERMAID_THEME_FILE_NAMES = new Set(
	DEFAULT_MERMAID_THEME_DEFINITIONS.map((theme) => theme.fileName)
);

export function parseMermaidThemeNameFromCss(css: string): string | null {
	const match = css.match(/@mermaid-theme\s+([A-Za-z0-9_-]+)/);
	return match?.[1] ?? null;
}

export function parseDefaultMermaidThemeVersionFromCss(css: string): number | null {
	const match = css.match(new RegExp(`${DEFAULT_MERMAID_THEME_VERSION_COMMENT}\\s+(\\d+)`));
	if (!match) {
		return null;
	}

	const version = Number.parseInt(match[1], 10);
	return Number.isFinite(version) ? version : null;
}
