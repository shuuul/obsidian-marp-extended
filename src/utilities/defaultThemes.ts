import { PACKAGED_DEFAULT_THEME_CSS } from './packagedDefaultThemeCss';

export interface DefaultThemeDefinition {
	name: string;
	fileName: string;
	css: string;
	credit: string;
}

export const DEFAULT_THEME_DIRECTORY = '.marp-extended/themes';

function packagedTheme(name: string, fileName: string, credit: string): DefaultThemeDefinition {
	const css = PACKAGED_DEFAULT_THEME_CSS[fileName];
	if (!css) {
		throw new Error(`Missing packaged default theme CSS: ${fileName}`);
	}

	return { name, fileName, css, credit };
}

export const DEFAULT_THEME_DEFINITIONS: DefaultThemeDefinition[] = [
	packagedTheme('kami', 'kami.css', 'tw93/Kami'),
	packagedTheme('kami-en', 'kami-en.css', 'tw93/Kami'),
	packagedTheme('github', 'github.css', 'matsubara0507/marp-themes'),
	packagedTheme('beamer', 'beamer.css', 'vault sample theme'),
	packagedTheme('olive', 'olive.css', 'matsubara0507/marp-themes'),
	packagedTheme('dracula', 'dracula.css', 'dracula/marp'),
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
