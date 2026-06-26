import type { App, MetadataCache } from 'obsidian';
import { parseThemeSizeNamesFromCss } from './defaultThemes';

import { MermaidThemeManager } from './mermaidThemeManager';
import { ThemeManager } from './themeManager';

const THEME_PROPERTY_KEY = 'theme';
const MERMAID_THEME_PROPERTY_KEY = 'mermaidtheme';
const MERMAID_FLAT_PROPERTY_KEY = 'mermaidflat';
const SIZE_PROPERTY_KEY = 'size';

type MetadataCacheWithPropertyValues = MetadataCache & {
	getFrontmatterPropertyValuesForKey?: (...args: unknown[]) => unknown;
};

type PropertyValueGetter = (...args: unknown[]) => unknown;

function getPropertyKey(key: unknown): string | null {
	if (typeof key !== 'string') {
		return null;
	}

	return key.trim().toLowerCase();
}

function toStringArray(values: unknown): string[] {
	if (!Array.isArray(values)) {
		return [];
	}

	return values.filter((value): value is string => typeof value === 'string');
}

function uniqueStrings(values: string[]): string[] {
	const seen = new Set<string>();
	const unique: string[] = [];

	for (const value of values) {
		const normalized = value.trim();
		if (!normalized || seen.has(normalized)) {
			continue;
		}
		seen.add(normalized);
		unique.push(normalized);
	}

	return unique;
}

export class ThemePropertyOptions {
	private originalGetValues: ((...args: unknown[]) => unknown) | null = null;
	private patchedGetValues: PropertyValueGetter | null = null;
	private themeNames: string[] = [];
	private mermaidThemeNames: string[] = [];
	private sizeNames: string[] = [];

	constructor(
		private app: App,
		private themeManager = new ThemeManager(app),
		private mermaidThemeManager = new MermaidThemeManager(app),
	) {}

	register(): void {
		const metadataCache = this.getMetadataCacheWithPropertyValues();
		if (!metadataCache?.getFrontmatterPropertyValuesForKey || this.patchedGetValues) {
			return;
		}

		const originalGetValues = metadataCache.getFrontmatterPropertyValuesForKey;
		this.originalGetValues = originalGetValues;
		this.patchedGetValues = (...args: unknown[]) => {
			const originalValues = originalGetValues.call(metadataCache, ...args);
			const propertyKey = getPropertyKey(args[0]);

			if (!propertyKey) {
				return originalValues;
			}

			const existingValues = toStringArray(originalValues);
			switch (propertyKey) {
				case THEME_PROPERTY_KEY:
					return uniqueStrings([...existingValues, ...this.themeNames]);
				case MERMAID_THEME_PROPERTY_KEY:
					return uniqueStrings([...existingValues, ...this.mermaidThemeNames]);
				case MERMAID_FLAT_PROPERTY_KEY:
					return uniqueStrings([...existingValues, 'true', 'false']);
				case SIZE_PROPERTY_KEY:
					return uniqueStrings([...existingValues, ...this.sizeNames]);
				default:
					return originalValues;
			}
		};

		metadataCache.getFrontmatterPropertyValuesForKey = this.patchedGetValues;
	}

	async refresh(): Promise<void> {
		const [themes, mermaidThemes, themeCss] = await Promise.all([
			this.themeManager.listThemes(),
			this.mermaidThemeManager.listThemes(),
			this.themeManager.loadThemeCss(),
		]);
		this.themeNames = uniqueStrings(themes.map((theme) => theme.name)).sort((a, b) => a.localeCompare(b));
		this.mermaidThemeNames = uniqueStrings(mermaidThemes.map((theme) => theme.name)).sort((a, b) => a.localeCompare(b));
		this.sizeNames = uniqueStrings(themeCss.flatMap(parseThemeSizeNamesFromCss)).sort((a, b) => a.localeCompare(b));
	}

	unregister(): void {
		const metadataCache = this.getMetadataCacheWithPropertyValues();
		if (
			metadataCache?.getFrontmatterPropertyValuesForKey
			&& this.originalGetValues
			&& this.patchedGetValues
			&& metadataCache.getFrontmatterPropertyValuesForKey === this.patchedGetValues
		) {
			metadataCache.getFrontmatterPropertyValuesForKey = this.originalGetValues;
		}

		this.originalGetValues = null;
		this.patchedGetValues = null;
		this.themeNames = [];
		this.mermaidThemeNames = [];
		this.sizeNames = [];
	}

	private getMetadataCacheWithPropertyValues(): MetadataCacheWithPropertyValues | null {
		return this.app.metadataCache as MetadataCacheWithPropertyValues | null;
	}
}
