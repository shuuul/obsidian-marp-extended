import { App, normalizePath, requestUrl } from 'obsidian';

import {
	DEFAULT_MERMAID_THEME_DEFINITIONS,
	DEFAULT_MERMAID_THEME_DIRECTORY,
	DEFAULT_MERMAID_THEME_FILE_NAMES,
	DEFAULT_MERMAID_THEME_MANIFEST_VERSION,
	DEFAULT_MERMAID_THEME_VERSION_COMMENT,
	parseDefaultMermaidThemeVersionFromCss,
	parseMermaidThemeNameFromCss,
} from './defaultMermaidThemes';
import { normalizeThemeName, themeNameToFileName } from './defaultThemes';

export type MermaidThemeSource = 'default' | 'custom';

export interface InstalledMermaidThemeEntry {
	name: string;
	fileName: string;
	path: string;
	source: MermaidThemeSource;
	version: number | null;
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

			const css = await this.downloadThemeCss(theme.url);
			await this.writeDefaultTheme(theme.fileName, css);
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

	async updateDefaultTheme(fileNameOrThemeName: string): Promise<InstalledMermaidThemeEntry> {
		const theme = getDefaultMermaidThemeDefinition(fileNameOrThemeName);
		if (!theme) {
			throw new Error(`Unknown default Mermaid theme: ${fileNameOrThemeName}`);
		}

		await this.ensureVaultFolder(DEFAULT_MERMAID_THEME_DIRECTORY);

		const css = await this.downloadThemeCss(theme.url);
		const path = await this.writeDefaultTheme(theme.fileName, css);

		return {
			name: parseMermaidThemeNameFromCss(css) ?? theme.name,
			fileName: theme.fileName,
			path,
			source: 'default',
			version: parseDefaultMermaidThemeVersionFromCss(css),
		};
	}

	async removeTheme(path: string): Promise<void> {
		await this.app.vault.adapter.remove(normalizePath(path));
	}

	async addThemeFromCss(css: string, preferredName = ''): Promise<InstalledMermaidThemeEntry> {
		const trimmedCss = css.trim();
		if (!trimmedCss) {
			throw new Error('Paste a Mermaid theme CSS first.');
		}

		const parsedThemeName = parseMermaidThemeNameFromCss(trimmedCss);
		const rawThemeName = parsedThemeName || preferredName.trim();
		if (!rawThemeName) {
			throw new Error('Mermaid theme CSS must include an @mermaid-theme metadata comment, or you must provide a theme name.');
		}
		const themeName = normalizeThemeName(rawThemeName);
		const cssToWrite = parsedThemeName ? trimmedCss : `/* @mermaid-theme ${themeName} */\n\n${trimmedCss}`;

		await this.ensureVaultFolder(DEFAULT_MERMAID_THEME_DIRECTORY);

		const fileName = themeNameToFileName(themeName);
		const path = joinVaultPath(DEFAULT_MERMAID_THEME_DIRECTORY, fileName);
		await this.app.vault.adapter.write(path, `${cssToWrite}\n`);

		return {
			name: themeName,
			fileName,
			path,
			source: DEFAULT_MERMAID_THEME_FILE_NAMES.has(fileName) ? 'default' : 'custom',
			version: DEFAULT_MERMAID_THEME_FILE_NAMES.has(fileName) ? parseDefaultMermaidThemeVersionFromCss(cssToWrite) : null,
		};
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
				version: themeSource === 'default' ? parseDefaultMermaidThemeVersionFromCss(css) : null,
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

	private getThemeDownloadUrl(url: string): string {
		const separator = url.includes('?') ? '&' : '?';
		return `${url}${separator}marp-extended-mermaid-theme-version=${DEFAULT_MERMAID_THEME_MANIFEST_VERSION}`;
	}

	private async downloadThemeCss(url: string): Promise<string> {
		const downloadUrl = this.getThemeDownloadUrl(url);
		const response = await requestUrl({
			url: downloadUrl,
			headers: {
				Accept: 'text/css,text/plain,*/*',
				'User-Agent': 'marp-extended-obsidian-plugin',
			},
		});

		if (response.status < 200 || response.status >= 300) {
			throw new Error(`Mermaid theme download failed with status ${response.status}: ${url}`);
		}

		if (!parseMermaidThemeNameFromCss(response.text)) {
			throw new Error(`Downloaded CSS is missing @mermaid-theme metadata: ${url}`);
		}

		if (parseDefaultMermaidThemeVersionFromCss(response.text) == null) {
			throw new Error(`Downloaded CSS is missing ${DEFAULT_MERMAID_THEME_VERSION_COMMENT} metadata: ${url}`);
		}

		return response.text;
	}
}
