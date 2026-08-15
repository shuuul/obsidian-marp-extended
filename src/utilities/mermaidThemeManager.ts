import { App } from 'obsidian';

import {
	DEFAULT_MERMAID_THEME_DEFINITIONS,
	DEFAULT_MERMAID_THEME_DIRECTORY,
	DEFAULT_MERMAID_THEME_FILE_NAMES,
	parseMermaidThemeNameFromCss,
} from './defaultMermaidThemes';
import { normalizeThemeName, themeNameToFileName } from './defaultThemes';
import {
	EnsureDefaultThemesOptions,
	InstalledThemeEntry,
	joinVaultPath,
	ThemeSource,
	VaultThemeManager,
	VaultThemeManagerConfig,
} from './vaultThemeManager';

export type MermaidThemeSource = ThemeSource;
export type InstalledMermaidThemeEntry = InstalledThemeEntry;
export type EnsureDefaultMermaidThemesOptions = EnsureDefaultThemesOptions;

const MERMAID_THEME_MANAGER_CONFIG: VaultThemeManagerConfig = {
	directory: DEFAULT_MERMAID_THEME_DIRECTORY,
	definitions: DEFAULT_MERMAID_THEME_DEFINITIONS,
	defaultFileNames: DEFAULT_MERMAID_THEME_FILE_NAMES,
	metaDirective: '@mermaid-theme',
	parseThemeNameFromCss: parseMermaidThemeNameFromCss,
	labels: {
		pasteCssNoun: 'Mermaid theme CSS',
		cssErrorSubject: 'Mermaid theme CSS',
		themeNoun: 'Mermaid theme',
	},
};

export class MermaidThemeManager extends VaultThemeManager {
	constructor(app: App) {
		super(app, MERMAID_THEME_MANAGER_CONFIG);
	}

	async loadThemeCss(themeName: string): Promise<string | null> {
		const normalizedName = normalizeThemeName(themeName);
		const expectedPath = joinVaultPath(this.config.directory, themeNameToFileName(normalizedName));
		if (await this.app.vault.adapter.exists(expectedPath)) {
			const css = await this.app.vault.adapter.read(expectedPath);
			const parsedThemeName = this.config.parseThemeNameFromCss(css);
			if (!parsedThemeName || normalizeThemeName(parsedThemeName) === normalizedName) {
				return css;
			}
		}

		const themes = await this.listThemes();
		const theme = themes.find((entry) => entry.name === normalizedName);
		return theme ? this.app.vault.adapter.read(theme.path) : null;
	}
}
