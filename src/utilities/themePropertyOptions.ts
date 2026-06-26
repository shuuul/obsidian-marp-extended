import type { App, MetadataCache } from 'obsidian';

import { ThemeManager } from './themeManager';

const THEME_PROPERTY_KEY = 'theme';

type MetadataCacheWithPropertyValues = MetadataCache & {
	getFrontmatterPropertyValuesForKey?: (key: string) => unknown;
};

type PropertyValueGetter = (key: string) => string[];

function isThemePropertyKey(key: string): boolean {
	return key.trim().toLowerCase() === THEME_PROPERTY_KEY;
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
	private originalGetValues: ((key: string) => unknown) | null = null;
	private patchedGetValues: PropertyValueGetter | null = null;
	private themeNames: string[] = [];

	constructor(
		private app: App,
		private themeManager = new ThemeManager(app),
	) {}

	register(): void {
		const metadataCache = this.getMetadataCacheWithPropertyValues();
		if (!metadataCache?.getFrontmatterPropertyValuesForKey || this.patchedGetValues) {
			return;
		}

		const originalGetValues = metadataCache.getFrontmatterPropertyValuesForKey;
		this.originalGetValues = originalGetValues;
		this.patchedGetValues = (key: string) => {
			const existingValues = toStringArray(originalGetValues.call(metadataCache, key));
			if (!isThemePropertyKey(key)) {
				return existingValues;
			}

			return uniqueStrings([...existingValues, ...this.themeNames]);
		};

		metadataCache.getFrontmatterPropertyValuesForKey = this.patchedGetValues;
	}

	async refresh(): Promise<void> {
		const themes = await this.themeManager.listThemes();
		this.themeNames = uniqueStrings(themes.map((theme) => theme.name)).sort((a, b) => a.localeCompare(b));
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
	}

	private getMetadataCacheWithPropertyValues(): MetadataCacheWithPropertyValues | null {
		return this.app.metadataCache as MetadataCacheWithPropertyValues | null;
	}
}
