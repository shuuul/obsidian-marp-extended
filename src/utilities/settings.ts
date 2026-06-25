export interface MarpSlidesSettings {
	CHROME_PATH: string;
	DefaultThemesSeeded: boolean;
	DefaultThemesVersion: number;
	EnableHTML: boolean;
	MathTypesettings: string ;
	HTMLExportMode: string;
	EnableMarkdownItPlugins: boolean;
}

export const DEFAULT_SETTINGS: MarpSlidesSettings = {
	CHROME_PATH: '',
	DefaultThemesSeeded: false,
	DefaultThemesVersion: 0,
	EnableHTML: false,
	MathTypesettings: 'mathjax',
	HTMLExportMode: 'bare',
	EnableMarkdownItPlugins: true
}
