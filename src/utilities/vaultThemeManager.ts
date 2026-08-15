import { App, normalizePath } from 'obsidian';

import { normalizeThemeName, themeNameToFileName } from './defaultThemes';

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

export interface VaultThemeDefinition {
	name: string;
	fileName: string;
	css: string;
}

export interface VaultThemeLabels {
	/** Noun used in "Paste a X first." (e.g. 'Marp theme CSS', 'Mermaid theme CSS'). */
	pasteCssNoun: string;
	/** Subject of the metadata-comment error (e.g. 'Theme CSS', 'Mermaid theme CSS'). */
	cssErrorSubject: string;
	/** Noun used in default/duplicate/unknown errors (e.g. 'theme', 'Mermaid theme'). */
	themeNoun: string;
}

export interface VaultThemeManagerConfig {
	directory: string;
	definitions: readonly VaultThemeDefinition[];
	defaultFileNames: ReadonlySet<string>;
	/** CSS metadata directive that names a theme (e.g. '@theme', '@mermaid-theme'). */
	metaDirective: string;
	parseThemeNameFromCss(css: string): string | null;
	labels: VaultThemeLabels;
}

export function joinVaultPath(...parts: string[]): string {
	return normalizePath(parts.filter(Boolean).join('/'));
}

function fileNameFromPath(path: string): string {
	return path.split('/').pop() ?? path;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

export class VaultThemeManager {
	constructor(protected app: App, protected config: VaultThemeManagerConfig) {}

	getDefaultThemeDirectory(): string {
		return this.config.directory;
	}

	async ensureDefaultThemes(options: EnsureDefaultThemesOptions = {}): Promise<string[]> {
		await this.ensureVaultFolder(this.config.directory);

		const installed: string[] = [];
		for (const theme of this.config.definitions) {
			const path = joinVaultPath(this.config.directory, theme.fileName);
			const exists = await this.app.vault.adapter.exists(path);
			if (!options.overwrite && exists) {
				continue;
			}

			const css = theme.css.endsWith('\n') ? theme.css : `${theme.css}\n`;
			if (exists && await this.app.vault.adapter.read(path) === css) {
				// Already installed from the same package CSS: skip the write.
				continue;
			}

			await this.writeDefaultTheme(theme.fileName, theme.css);
			installed.push(theme.name);
		}

		return installed;
	}

	async listThemes(): Promise<InstalledThemeEntry[]> {
		const entries = await this.listThemesFromDirectory(this.config.directory, 'default');
		return uniqueByPath(entries).sort((a, b) => {
			if (a.source !== b.source) {
				return a.source === 'default' ? -1 : 1;
			}
			return a.name.localeCompare(b.name);
		});
	}

	async addThemeFromCss(css: string, preferredName = ''): Promise<InstalledThemeEntry> {
		const themeFile = this.prepareCustomThemeFile(css, preferredName);

		await this.ensureVaultFolder(this.config.directory);

		const path = joinVaultPath(this.config.directory, themeFile.fileName);
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
		if (this.config.defaultFileNames.has(oldFileName)) {
			throw new Error(`Bundled default ${this.config.labels.themeNoun}s cannot be edited. Fork the theme first.`);
		}

		const themeFile = this.prepareCustomThemeFile(css, preferredName, { preferProvidedName: true });
		await this.ensureVaultFolder(this.config.directory);

		const nextPath = joinVaultPath(this.config.directory, themeFile.fileName);
		if (nextPath !== oldPath && await this.app.vault.adapter.exists(nextPath)) {
			throw new Error(`A ${this.config.labels.themeNoun} named ${themeFile.name} already exists.`);
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
		const theme = this.config.definitions.find((definition) =>
			definition.fileName === fileNameOrThemeName || definition.name === fileNameOrThemeName
		);
		if (!theme) {
			throw new Error(`Unknown default ${this.config.labels.themeNoun}: ${fileNameOrThemeName}`);
		}

		await this.ensureVaultFolder(this.config.directory);

		const themeName = await this.nextAvailableCustomThemeName(`${theme.name}-fork`);
		const fileName = themeNameToFileName(themeName);
		const path = joinVaultPath(this.config.directory, fileName);
		const css = this.replaceThemeNameInCss(theme.css, themeName);
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
			throw new Error(`Paste a ${this.config.labels.pasteCssNoun} first.`);
		}

		const parsedThemeName = this.config.parseThemeNameFromCss(trimmedCss);
		const providedThemeName = preferredName.trim();
		const rawThemeName = options.preferProvidedName
			? providedThemeName || parsedThemeName
			: parsedThemeName || providedThemeName;
		if (!rawThemeName) {
			throw new Error(`${this.config.labels.cssErrorSubject} must include an ${this.config.metaDirective} metadata comment, or you must provide a theme name.`);
		}

		const themeName = normalizeThemeName(rawThemeName);
		const fileName = themeNameToFileName(themeName);
		if (this.config.defaultFileNames.has(fileName)) {
			throw new Error(`Bundled default ${this.config.labels.themeNoun}s cannot be overwritten. Fork the theme with a custom name.`);
		}

		const cssToWrite = parsedThemeName
			? this.replaceThemeNameInCss(trimmedCss, themeName)
			: `/* ${this.config.metaDirective} ${themeName} */\n\n${trimmedCss}`;
		return { name: themeName, fileName, css: cssToWrite };
	}

	private replaceThemeNameInCss(css: string, themeName: string): string {
		if (this.config.parseThemeNameFromCss(css)) {
			const pattern = new RegExp(`(${escapeRegExp(this.config.metaDirective)}\\s+)([A-Za-z0-9_-]+)`);
			return css.replace(pattern, `$1${themeName}`);
		}

		return `/* ${this.config.metaDirective} ${themeName} */\n\n${css.trim()}`;
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
			const themeSource = source === 'default' && !this.config.defaultFileNames.has(fileName)
				? 'custom'
				: source;
			entries.push({
				name: this.config.parseThemeNameFromCss(css) ?? fileName.replace(/\.css$/i, ''),
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
		const path = joinVaultPath(this.config.directory, fileName);
		await this.app.vault.adapter.write(path, css.endsWith('\n') ? css : `${css}\n`);
		return path;
	}

	private async nextAvailableCustomThemeName(baseName: string): Promise<string> {
		const normalizedBaseName = normalizeThemeName(baseName);
		let themeName = normalizedBaseName;
		let index = 2;

		while (true) {
			const fileName = themeNameToFileName(themeName);
			const path = joinVaultPath(this.config.directory, fileName);
			if (!this.config.defaultFileNames.has(fileName) && !(await this.app.vault.adapter.exists(path))) {
				return themeName;
			}

			themeName = `${normalizedBaseName}-${index}`;
			index += 1;
		}
	}

}
