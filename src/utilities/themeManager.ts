import { App, normalizePath, requestUrl } from 'obsidian';

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

			const css = await this.downloadThemeCss(theme.url);
			await this.app.vault.adapter.write(path, css);
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
		const trimmedCss = css.trim();
		if (!trimmedCss) {
			throw new Error('Paste a Marp theme CSS first.');
		}

		const parsedThemeName = parseThemeNameFromCss(trimmedCss);
		const rawThemeName = parsedThemeName || preferredName.trim();
		if (!rawThemeName) {
			throw new Error('Theme CSS must include an @theme metadata comment, or you must provide a theme name.');
		}
		const themeName = normalizeThemeName(rawThemeName);

		let cssToWrite = trimmedCss;
		if (!parsedThemeName) {
			cssToWrite = `/* @theme ${themeName} */\n\n${trimmedCss}`;
		}

		await this.ensureVaultFolder(DEFAULT_THEME_DIRECTORY);

		const fileName = themeNameToFileName(themeName);
		const path = joinVaultPath(DEFAULT_THEME_DIRECTORY, fileName);
		await this.app.vault.adapter.write(path, `${cssToWrite}\n`);

		return {
			name: themeName,
			fileName,
			path,
			source: DEFAULT_THEME_FILE_NAMES.has(fileName) ? 'default' : 'custom',
		};
	}

	async removeTheme(path: string): Promise<void> {
		await this.app.vault.adapter.remove(normalizePath(path));
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

	private async downloadThemeCss(url: string): Promise<string> {
		const response = await requestUrl({
			url,
			headers: {
				Accept: 'text/css,text/plain,*/*',
				'User-Agent': 'marp-extended-obsidian-plugin',
			},
		});

		if (response.status < 200 || response.status >= 300) {
			throw new Error(`Theme download failed with status ${response.status}: ${url}`);
		}

		if (!parseThemeNameFromCss(response.text)) {
			throw new Error(`Downloaded CSS is missing @theme metadata: ${url}`);
		}

		return response.text;
	}
}
