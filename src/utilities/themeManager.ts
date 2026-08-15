import { App } from 'obsidian';

import {
	DEFAULT_THEME_DEFINITIONS,
	DEFAULT_THEME_DIRECTORY,
	DEFAULT_THEME_FILE_NAMES,
	parseThemeNameFromCss,
} from './defaultThemes';
import {
	EnsureDefaultThemesOptions,
	InstalledThemeEntry,
	ThemeSource,
	VaultThemeManager,
	VaultThemeManagerConfig,
} from './vaultThemeManager';

export type { EnsureDefaultThemesOptions, InstalledThemeEntry, ThemeSource };

const MARP_THEME_MANAGER_CONFIG: VaultThemeManagerConfig = {
	directory: DEFAULT_THEME_DIRECTORY,
	definitions: DEFAULT_THEME_DEFINITIONS,
	defaultFileNames: DEFAULT_THEME_FILE_NAMES,
	metaDirective: '@theme',
	parseThemeNameFromCss,
	labels: {
		pasteCssNoun: 'Marp theme CSS',
		cssErrorSubject: 'Theme CSS',
		themeNoun: 'theme',
	},
};

export class ThemeManager extends VaultThemeManager {
	constructor(app: App) {
		super(app, MARP_THEME_MANAGER_CONFIG);
	}

	async loadThemeCss(): Promise<string[]> {
		const entries = await this.listThemes();
		return Promise.all(entries.map((entry) => this.app.vault.adapter.read(entry.path)));
	}
}
