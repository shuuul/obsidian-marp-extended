import { PACKAGED_DEFAULT_MERMAID_THEME_CSS } from './packagedDefaultThemeCss';

export interface DefaultMermaidThemeDefinition {
	name: string;
	fileName: string;
	css: string;
}

export const DEFAULT_MERMAID_THEME_DIRECTORY = '.marp-extended/mermaid-themes';

function packagedMermaidTheme(name: string): DefaultMermaidThemeDefinition {
	const fileName = `${name}.css`;
	const css = PACKAGED_DEFAULT_MERMAID_THEME_CSS[fileName];
	if (!css) {
		throw new Error(`Missing packaged default Mermaid theme CSS: ${fileName}`);
	}

	return { name, fileName, css };
}

export const DEFAULT_MERMAID_THEME_DEFINITIONS: DefaultMermaidThemeDefinition[] = [
	'kami',
	'kami-en',
	'github',
	'beamer',
	'olive',
	'dracula',
].map(packagedMermaidTheme);

export const DEFAULT_MERMAID_THEME_FILE_NAMES = new Set(
	DEFAULT_MERMAID_THEME_DEFINITIONS.map((theme) => theme.fileName)
);

export function parseMermaidThemeNameFromCss(css: string): string | null {
	const match = css.match(/@mermaid-theme\s+([A-Za-z0-9_-]+)/);
	return match?.[1] ?? null;
}
