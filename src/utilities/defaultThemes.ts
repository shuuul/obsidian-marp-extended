export interface DefaultThemeDefinition {
	name: string;
	fileName: string;
	url: string;
	credit: string;
}

const MARP_EXTENDED_REPO_RAW_THEMES = 'https://raw.githubusercontent.com/shuuul/obsidian-marp-extended/main/vault/themes';

export const DEFAULT_THEME_DIRECTORY = '.marp-extended/themes';
export const DEFAULT_THEME_MANIFEST_VERSION = 4;
export const DEFAULT_THEME_VERSION_COMMENT = '@marp-extended-theme-version';

export const DEFAULT_THEME_DEFINITIONS: DefaultThemeDefinition[] = [
	{ name: 'academic', fileName: 'academic.css', url: `${MARP_EXTENDED_REPO_RAW_THEMES}/academic.css`, credit: 'kaisugi/marp-theme-academic' },
	{ name: 'beamer', fileName: 'beamer.css', url: `${MARP_EXTENDED_REPO_RAW_THEMES}/beamer.css`, credit: 'vault sample theme' },
	{ name: 'border', fileName: 'border.css', url: `${MARP_EXTENDED_REPO_RAW_THEMES}/border.css`, credit: 'vault sample theme' },
	{ name: 'color-head', fileName: 'color-head.css', url: `${MARP_EXTENDED_REPO_RAW_THEMES}/color-head.css`, credit: 'vault sample theme' },
	{ name: 'colors', fileName: 'colors.css', url: `${MARP_EXTENDED_REPO_RAW_THEMES}/colors.css`, credit: 'matsubara0507/marp-themes' },
	{ name: 'dracula', fileName: 'dracula.css', url: `${MARP_EXTENDED_REPO_RAW_THEMES}/dracula.css`, credit: 'dracula/marp' },
	{ name: 'github', fileName: 'github.css', url: `${MARP_EXTENDED_REPO_RAW_THEMES}/github.css`, credit: 'matsubara0507/marp-themes' },
	{ name: 'gradient', fileName: 'gradient.css', url: `${MARP_EXTENDED_REPO_RAW_THEMES}/gradient.css`, credit: 'vault sample theme' },
	{ name: 'haskell', fileName: 'haskell.css', url: `${MARP_EXTENDED_REPO_RAW_THEMES}/haskell.css`, credit: 'matsubara0507/marp-themes' },
	{ name: 'iggg', fileName: 'iggg.css', url: `${MARP_EXTENDED_REPO_RAW_THEMES}/iggg.css`, credit: 'matsubara0507/marp-themes' },
	{ name: 'kami', fileName: 'kami.css', url: `${MARP_EXTENDED_REPO_RAW_THEMES}/kami.css`, credit: 'tw93/Kami' },
	{ name: 'kami-en', fileName: 'kami-en.css', url: `${MARP_EXTENDED_REPO_RAW_THEMES}/kami-en.css`, credit: 'tw93/Kami' },
	{ name: 'minimal-container-turquoise', fileName: 'minimal-container-turquoise.css', url: `${MARP_EXTENDED_REPO_RAW_THEMES}/minimal-container-turquoise.css`, credit: 'vault sample theme' },
	{ name: 'minimal-turquoise', fileName: 'minimal-turquoise.css', url: `${MARP_EXTENDED_REPO_RAW_THEMES}/minimal-turquoise.css`, credit: 'vault sample theme' },
	{ name: 'olive', fileName: 'olive.css', url: `${MARP_EXTENDED_REPO_RAW_THEMES}/olive.css`, credit: 'matsubara0507/marp-themes' },
];

export const DEFAULT_THEME_FILE_NAMES = new Set(
	DEFAULT_THEME_DEFINITIONS.map((theme) => theme.fileName)
);

export function parseThemeNameFromCss(css: string): string | null {
	const match = css.match(/@theme\s+([A-Za-z0-9_-]+)/);
	return match?.[1] ?? null;
}

export function parseThemeSizeNamesFromCss(css: string): string[] {
	const matches = css.matchAll(/@size\s+(\S+)\s+(\S+)/g);
	const names: string[] = [];

	for (const match of matches) {
		if (match[2] !== 'false') {
			names.push(match[1]);
		}
	}

	return names;
}

export function parseDefaultThemeVersionFromCss(css: string): number | null {
	const match = css.match(new RegExp(`${DEFAULT_THEME_VERSION_COMMENT}\\s+(\\d+)`));
	if (!match) {
		return null;
	}

	const version = Number.parseInt(match[1], 10);
	return Number.isFinite(version) ? version : null;
}

export function normalizeThemeName(themeName: string): string {
	const normalized = themeName
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, '-')
		.replace(/^-+|-+$/g, '');

	if (!normalized) {
		throw new Error('Theme name must contain letters, numbers, dashes, or underscores.');
	}

	return normalized;
}

export function themeNameToFileName(themeName: string): string {
	const normalized = normalizeThemeName(themeName);
	return `${normalized}.css`;
}
