import type { App, MetadataCache } from 'obsidian';
import { parseThemeSizeNamesFromCss } from './defaultThemes';

import { ThemeManager } from './themeManager';

const THEME_PROPERTY_KEY = 'theme';
const SIZE_PROPERTY_KEY = 'size';

type MetadataCacheWithPropertyValues = MetadataCache & {
	getFrontmatterPropertyValuesForKey?: (key: string) => unknown;
};

type PropertyValueGetter = (key: string) => string[];

function getPropertyKey(key: string): string {
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
	private originalGetValues: ((key: string) => unknown) | null = null;
	private patchedGetValues: PropertyValueGetter | null = null;
	private themeNames: string[] = [];
	private sizeNames: string[] = [];

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
			switch (getPropertyKey(key)) {
				case THEME_PROPERTY_KEY:
					return uniqueStrings([...existingValues, ...this.themeNames]);
				case SIZE_PROPERTY_KEY:
					return uniqueStrings([...existingValues, ...this.sizeNames]);
				default:
					return existingValues;
			}
		};

		metadataCache.getFrontmatterPropertyValuesForKey = this.patchedGetValues;
	}

	async refresh(): Promise<void> {
		const [themes, themeCss] = await Promise.all([
			this.themeManager.listThemes(),
			this.themeManager.loadThemeCss(),
		]);
		this.themeNames = uniqueStrings(themes.map((theme) => theme.name)).sort((a, b) => a.localeCompare(b));
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
		this.sizeNames = [];
	}

	private getMetadataCacheWithPropertyValues(): MetadataCacheWithPropertyValues | null {
		return this.app.metadataCache as MetadataCacheWithPropertyValues | null;
	}
}
