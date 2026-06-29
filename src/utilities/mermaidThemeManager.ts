import { App, normalizePath } from 'obsidian';

import {
	DEFAULT_MERMAID_THEME_DEFINITIONS,
	DEFAULT_MERMAID_THEME_DIRECTORY,
	DEFAULT_MERMAID_THEME_FILE_NAMES,
	parseMermaidThemeNameFromCss,
} from './defaultMermaidThemes';
import { normalizeThemeName, themeNameToFileName } from './defaultThemes';

export type MermaidThemeSource = 'default' | 'custom';

export interface InstalledMermaidThemeEntry {
	name: string;
	fileName: string;
	path: string;
	source: MermaidThemeSource;
}

export interface EnsureDefaultMermaidThemesOptions {
	overwrite?: boolean;
}

function joinVaultPath(...parts: string[]): string {
	return normalizePath(parts.filter(Boolean).join('/'));
}

function fileNameFromPath(path: string): string {
	return path.split('/').pop() ?? path;
}

function getDefaultMermaidThemeDefinition(fileNameOrThemeName: string) {
	return DEFAULT_MERMAID_THEME_DEFINITIONS.find((theme) =>
		theme.fileName === fileNameOrThemeName || theme.name === fileNameOrThemeName
	);
}

function replaceMermaidThemeNameInCss(css: string, themeName: string): string {
	if (parseMermaidThemeNameFromCss(css)) {
		return css.replace(/(@mermaid-theme\s+)([A-Za-z0-9_-]+)/, `$1${themeName}`);
	}

	return `/* @mermaid-theme ${themeName} */\n\n${css.trim()}`;
}

function uniqueByPath(entries: InstalledMermaidThemeEntry[]): InstalledMermaidThemeEntry[] {
	const seen = new Set<string>();
	return entries.filter((entry) => {
		if (seen.has(entry.path)) {
			return false;
		}
		seen.add(entry.path);
		return true;
	});
}

export class MermaidThemeManager {
	constructor(private app: App) {}

	getDefaultThemeDirectory(): string {
		return DEFAULT_MERMAID_THEME_DIRECTORY;
	}

	async ensureDefaultThemes(options: EnsureDefaultMermaidThemesOptions = {}): Promise<string[]> {
		await this.ensureVaultFolder(DEFAULT_MERMAID_THEME_DIRECTORY);

		const installed: string[] = [];
		for (const theme of DEFAULT_MERMAID_THEME_DEFINITIONS) {
			const path = joinVaultPath(DEFAULT_MERMAID_THEME_DIRECTORY, theme.fileName);
			if (!options.overwrite && await this.app.vault.adapter.exists(path)) {
				continue;
			}

			await this.writeDefaultTheme(theme.fileName, theme.css);
			installed.push(theme.name);
		}

		return installed;
	}

	async listThemes(): Promise<InstalledMermaidThemeEntry[]> {
		const entries = await this.listThemesFromDirectory(DEFAULT_MERMAID_THEME_DIRECTORY, 'default');
		return uniqueByPath(entries).sort((a, b) => {
			if (a.source !== b.source) {
				return a.source === 'default' ? -1 : 1;
			}
			return a.name.localeCompare(b.name);
		});
	}

	async loadThemeCss(themeName: string): Promise<string | null> {
		const normalizedName = normalizeThemeName(themeName);
		const expectedPath = joinVaultPath(DEFAULT_MERMAID_THEME_DIRECTORY, themeNameToFileName(normalizedName));
		if (await this.app.vault.adapter.exists(expectedPath)) {
			const css = await this.app.vault.adapter.read(expectedPath);
			const parsedThemeName = parseMermaidThemeNameFromCss(css);
			if (!parsedThemeName || normalizeThemeName(parsedThemeName) === normalizedName) {
				return css;
			}
		}

		const themes = await this.listThemes();
		const theme = themes.find((entry) => entry.name === normalizedName);
		return theme ? this.app.vault.adapter.read(theme.path) : null;
	}

	async removeTheme(path: string): Promise<void> {
		await this.app.vault.adapter.remove(normalizePath(path));
	}

	async addThemeFromCss(css: string, preferredName = ''): Promise<InstalledMermaidThemeEntry> {
		const themeFile = this.prepareCustomThemeFile(css, preferredName);

		await this.ensureVaultFolder(DEFAULT_MERMAID_THEME_DIRECTORY);

		const path = joinVaultPath(DEFAULT_MERMAID_THEME_DIRECTORY, themeFile.fileName);
		await this.app.vault.adapter.write(path, `${themeFile.css}\n`);

		return {
			name: themeFile.name,
			fileName: themeFile.fileName,
			path,
			source: 'custom',
		};
	}

	async updateCustomThemeFromCss(path: string, css: string, preferredName = ''): Promise<InstalledMermaidThemeEntry> {
		const oldPath = normalizePath(path);
		const oldFileName = fileNameFromPath(oldPath);
		if (DEFAULT_MERMAID_THEME_FILE_NAMES.has(oldFileName)) {
			throw new Error('Bundled default Mermaid themes cannot be edited. Fork the theme first.');
		}

		const themeFile = this.prepareCustomThemeFile(css, preferredName, { preferProvidedName: true });
		await this.ensureVaultFolder(DEFAULT_MERMAID_THEME_DIRECTORY);

		const nextPath = joinVaultPath(DEFAULT_MERMAID_THEME_DIRECTORY, themeFile.fileName);
		if (nextPath !== oldPath && await this.app.vault.adapter.exists(nextPath)) {
			throw new Error(`A Mermaid theme named ${themeFile.name} already exists.`);
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

	async forkDefaultTheme(fileNameOrThemeName: string): Promise<InstalledMermaidThemeEntry> {
		const theme = getDefaultMermaidThemeDefinition(fileNameOrThemeName);
		if (!theme) {
			throw new Error(`Unknown default Mermaid theme: ${fileNameOrThemeName}`);
		}

		await this.ensureVaultFolder(DEFAULT_MERMAID_THEME_DIRECTORY);

		const themeName = await this.nextAvailableCustomThemeName(`${theme.name}-fork`);
		const fileName = themeNameToFileName(themeName);
		const path = joinVaultPath(DEFAULT_MERMAID_THEME_DIRECTORY, fileName);
		const css = replaceMermaidThemeNameInCss(theme.css, themeName);
		await this.app.vault.adapter.write(path, css.endsWith('\n') ? css : `${css}\n`);

		return {
			name: themeName,
			fileName,
			path,
			source: 'custom',
		};
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
			throw new Error('Paste a Mermaid theme CSS first.');
		}

		const parsedThemeName = parseMermaidThemeNameFromCss(trimmedCss);
		const providedThemeName = preferredName.trim();
		const rawThemeName = options.preferProvidedName
			? providedThemeName || parsedThemeName
			: parsedThemeName || providedThemeName;
		if (!rawThemeName) {
			throw new Error('Mermaid theme CSS must include an @mermaid-theme metadata comment, or you must provide a theme name.');
		}

		const themeName = normalizeThemeName(rawThemeName);
		const fileName = themeNameToFileName(themeName);
		if (DEFAULT_MERMAID_THEME_FILE_NAMES.has(fileName)) {
			throw new Error('Bundled default Mermaid themes cannot be overwritten. Fork the theme with a custom name.');
		}

		const cssToWrite = parsedThemeName
			? replaceMermaidThemeNameInCss(trimmedCss, themeName)
			: `/* @mermaid-theme ${themeName} */\n\n${trimmedCss}`;
		return { name: themeName, fileName, css: cssToWrite };
	}

	private async listThemesFromDirectory(directory: string, source: MermaidThemeSource): Promise<InstalledMermaidThemeEntry[]> {
		const normalizedDirectory = normalizePath(directory.trim());
		if (!normalizedDirectory || !await this.app.vault.adapter.exists(normalizedDirectory)) {
			return [];
		}

		const listed = await this.app.vault.adapter.list(normalizedDirectory);
		const cssFiles = listed.files
			.filter((path) => path.toLowerCase().endsWith('.css'))
			.sort((a, b) => a.localeCompare(b));

		const entries: InstalledMermaidThemeEntry[] = [];
		for (const path of cssFiles) {
			const css = await this.app.vault.adapter.read(path);
			const fileName = fileNameFromPath(path);
			const themeSource = source === 'default' && !DEFAULT_MERMAID_THEME_FILE_NAMES.has(fileName)
				? 'custom'
				: source;
			entries.push({
				name: parseMermaidThemeNameFromCss(css) ?? fileName.replace(/\.css$/i, ''),
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
		const path = joinVaultPath(DEFAULT_MERMAID_THEME_DIRECTORY, fileName);
		await this.app.vault.adapter.write(path, css.endsWith('\n') ? css : `${css}\n`);
		return path;
	}

	private async nextAvailableCustomThemeName(baseName: string): Promise<string> {
		const normalizedBaseName = normalizeThemeName(baseName);
		let themeName = normalizedBaseName;
		let index = 2;

		while (true) {
			const fileName = themeNameToFileName(themeName);
			const path = joinVaultPath(DEFAULT_MERMAID_THEME_DIRECTORY, fileName);
			if (!DEFAULT_MERMAID_THEME_FILE_NAMES.has(fileName) && !(await this.app.vault.adapter.exists(path))) {
				return themeName;
			}

			themeName = `${normalizedBaseName}-${index}`;
			index += 1;
		}
	}

}
