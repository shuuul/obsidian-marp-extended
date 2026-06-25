export interface MarpSlidesSettings {
	CHROME_PATH: string;
	ThemePath: string;
	DefaultThemesSeeded: boolean;
	DefaultThemesVersion: number;
	EnableHTML: boolean;
	MathTypesettings: string ;
	HTMLExportMode: string;
	EXPORT_PATH: string;
	EnableSyncPreview: boolean;
	EnableMarkdownItPlugins: boolean;
}

export const DEFAULT_SETTINGS: MarpSlidesSettings = {
	CHROME_PATH: '',
	ThemePath: '',
	DefaultThemesSeeded: false,
	DefaultThemesVersion: 0,
	EnableHTML: false,
	MathTypesettings: 'mathjax',
	HTMLExportMode: 'bare',
	EXPORT_PATH: '',
	EnableSyncPreview: true,
	EnableMarkdownItPlugins: false
}
