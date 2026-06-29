import { App, normalizePath } from 'obsidian';

import {
	DEFAULT_THEME_DEFINITIONS,
	DEFAULT_THEME_DIRECTORY,
	DEFAULT_THEME_FILE_NAMES,
	normalizeThemeName,
	parseThemeNameFromCss,
	themeNameToFileName,
} from './defaultThemes';

export type ThemeSource = 'default' | 'custom';

export interface InstalledThemeEntry {
	name: string;
	fileName: string;
	path: string;
	source: ThemeSource;
}

export interface EnsureDefaultThemesOptions {
	overwrite?: boolean;
}

function joinVaultPath(...parts: string[]): string {
	return normalizePath(parts.filter(Boolean).join('/'));
}

function fileNameFromPath(path: string): string {
	return path.split('/').pop() ?? path;
}

function getDefaultThemeDefinition(fileNameOrThemeName: string) {
	return DEFAULT_THEME_DEFINITIONS.find((theme) =>
		theme.fileName === fileNameOrThemeName || theme.name === fileNameOrThemeName
	);
}

function replaceThemeNameInCss(css: string, themeName: string): string {
	if (parseThemeNameFromCss(css)) {
		return css.replace(/(@theme\s+)([A-Za-z0-9_-]+)/, `$1${themeName}`);
	}

	return `/* @theme ${themeName} */\n\n${css.trim()}`;
}

function uniqueByPath(entries: InstalledThemeEntry[]): InstalledThemeEntry[] {
	const seen = new Set<string>();
	return entries.filter((entry) => {
		if (seen.has(entry.path)) {
			return false;
		}
		seen.add(entry.path);
		return true;
	});
}

export class ThemeManager {
	constructor(private app: App) {}

	getDefaultThemeDirectory(): string {
		return DEFAULT_THEME_DIRECTORY;
	}

	async ensureDefaultThemes(options: EnsureDefaultThemesOptions = {}): Promise<string[]> {
		await this.ensureVaultFolder(DEFAULT_THEME_DIRECTORY);

		const installed: string[] = [];
		for (const theme of DEFAULT_THEME_DEFINITIONS) {
			const path = joinVaultPath(DEFAULT_THEME_DIRECTORY, theme.fileName);
			if (!options.overwrite && await this.app.vault.adapter.exists(path)) {
				continue;
			}

			await this.writeDefaultTheme(theme.fileName, theme.css);
			installed.push(theme.name);
		}

		return installed;
	}

	async loadThemeCss(): Promise<string[]> {
		const entries = await this.listThemes();
		return Promise.all(entries.map((entry) => this.app.vault.adapter.read(entry.path)));
	}

	async listThemes(): Promise<InstalledThemeEntry[]> {
		const entries: InstalledThemeEntry[] = [];
		entries.push(...await this.listThemesFromDirectory(DEFAULT_THEME_DIRECTORY, 'default'));

		return uniqueByPath(entries).sort((a, b) => {
			if (a.source !== b.source) {
				return a.source === 'default' ? -1 : 1;
			}
			return a.name.localeCompare(b.name);
		});
	}

	async addThemeFromCss(css: string, preferredName = ''): Promise<InstalledThemeEntry> {
		const themeFile = this.prepareCustomThemeFile(css, preferredName);

		await this.ensureVaultFolder(DEFAULT_THEME_DIRECTORY);

		const path = joinVaultPath(DEFAULT_THEME_DIRECTORY, themeFile.fileName);
		await this.app.vault.adapter.write(path, `${themeFile.css}\n`);

		return {
			name: themeFile.name,
			fileName: themeFile.fileName,
			path,
			source: 'custom',
		};
	}

	async updateCustomThemeFromCss(path: string, css: string, preferredName = ''): Promise<InstalledThemeEntry> {
		const oldPath = normalizePath(path);
		const oldFileName = fileNameFromPath(oldPath);
		if (DEFAULT_THEME_FILE_NAMES.has(oldFileName)) {
			throw new Error('Bundled default themes cannot be edited. Fork the theme first.');
		}

		const themeFile = this.prepareCustomThemeFile(css, preferredName, { preferProvidedName: true });
		await this.ensureVaultFolder(DEFAULT_THEME_DIRECTORY);

		const nextPath = joinVaultPath(DEFAULT_THEME_DIRECTORY, themeFile.fileName);
		if (nextPath !== oldPath && await this.app.vault.adapter.exists(nextPath)) {
			throw new Error(`A theme named ${themeFile.name} already exists.`);
		}

		await this.app.vault.adapter.write(nextPath, `${themeFile.css}\n`);
		if (nextPath !== oldPath && await this.app.vault.adapter.exists(oldPath)) {
			await this.app.vault.adapter.remove(oldPath);
		}

		return {
			name: themeFile.name,
			fileName: themeFile.fileName,
			path: nextPath,
			source: 'custom',
		};
	}

	async forkDefaultTheme(fileNameOrThemeName: string): Promise<InstalledThemeEntry> {
		const theme = getDefaultThemeDefinition(fileNameOrThemeName);
		if (!theme) {
			throw new Error(`Unknown default theme: ${fileNameOrThemeName}`);
		}

		await this.ensureVaultFolder(DEFAULT_THEME_DIRECTORY);

		const themeName = await this.nextAvailableCustomThemeName(`${theme.name}-fork`);
		const fileName = themeNameToFileName(themeName);
		const path = joinVaultPath(DEFAULT_THEME_DIRECTORY, fileName);
		const css = replaceThemeNameInCss(theme.css, themeName);
		await this.app.vault.adapter.write(path, css.endsWith('\n') ? css : `${css}\n`);

		return {
			name: themeName,
			fileName,
			path,
			source: 'custom',
		};
	}

	async removeTheme(path: string): Promise<void> {
		await this.app.vault.adapter.remove(normalizePath(path));
	}

	async readThemeCss(path: string): Promise<string> {
		return this.app.vault.adapter.read(normalizePath(path));
	}

	private prepareCustomThemeFile(
		css: string,
		preferredName = '',
		options: { preferProvidedName?: boolean } = {},
	): { name: string; fileName: string; css: string } {
		const trimmedCss = css.trim();
		if (!trimmedCss) {
			throw new Error('Paste a Marp theme CSS first.');
		}

		const parsedThemeName = parseThemeNameFromCss(trimmedCss);
		const providedThemeName = preferredName.trim();
		const rawThemeName = options.preferProvidedName
			? providedThemeName || parsedThemeName
			: parsedThemeName || providedThemeName;
		if (!rawThemeName) {
			throw new Error('Theme CSS must include an @theme metadata comment, or you must provide a theme name.');
		}

		const themeName = normalizeThemeName(rawThemeName);
		const fileName = themeNameToFileName(themeName);
		if (DEFAULT_THEME_FILE_NAMES.has(fileName)) {
			throw new Error('Bundled default themes cannot be overwritten. Fork the theme with a custom name.');
		}

		const cssToWrite = parsedThemeName
			? replaceThemeNameInCss(trimmedCss, themeName)
			: `/* @theme ${themeName} */\n\n${trimmedCss}`;
		return { name: themeName, fileName, css: cssToWrite };
	}

	private async listThemesFromDirectory(directory: string, source: ThemeSource): Promise<InstalledThemeEntry[]> {
		const normalizedDirectory = normalizePath(directory.trim());
		if (!normalizedDirectory || !await this.app.vault.adapter.exists(normalizedDirectory)) {
			return [];
		}

		const listed = await this.app.vault.adapter.list(normalizedDirectory);
		const cssFiles = listed.files
			.filter((path) => path.toLowerCase().endsWith('.css'))
			.sort((a, b) => a.localeCompare(b));

		const entries: InstalledThemeEntry[] = [];
		for (const path of cssFiles) {
			const css = await this.app.vault.adapter.read(path);
			const fileName = fileNameFromPath(path);
			const themeSource = source === 'default' && !DEFAULT_THEME_FILE_NAMES.has(fileName)
				? 'custom'
				: source;
			entries.push({
				name: parseThemeNameFromCss(css) ?? fileName.replace(/\.css$/i, ''),
				fileName,
				path,
				source: themeSource,
			});
		}

		return entries;
	}

	private async ensureVaultFolder(directory: string): Promise<void> {
		const parts = normalizePath(directory).split('/').filter(Boolean);
		let current = '';

		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			if (!await this.app.vault.adapter.exists(current)) {
				await this.app.vault.adapter.mkdir(current);
			}
		}
	}

	private async writeDefaultTheme(fileName: string, css: string): Promise<string> {
		const path = joinVaultPath(DEFAULT_THEME_DIRECTORY, fileName);
		await this.app.vault.adapter.write(path, css.endsWith('\n') ? css : `${css}\n`);
		return path;
	}

	private async nextAvailableCustomThemeName(baseName: string): Promise<string> {
		const normalizedBaseName = normalizeThemeName(baseName);
		let themeName = normalizedBaseName;
		let index = 2;

		while (true) {
			const fileName = themeNameToFileName(themeName);
			const path = joinVaultPath(DEFAULT_THEME_DIRECTORY, fileName);
			if (!DEFAULT_THEME_FILE_NAMES.has(fileName) && !(await this.app.vault.adapter.exists(path))) {
				return themeName;
			}

			themeName = `${normalizedBaseName}-${index}`;
			index += 1;
		}
	}

}
