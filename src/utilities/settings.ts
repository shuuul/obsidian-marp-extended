export interface MarpSlidesSettings {
	CHROME_PATH: string;
	DefaultThemesSeeded: boolean;
	DefaultThemesVersion: number;
	DefaultMermaidThemesSeeded: boolean;
	DefaultMermaidThemesVersion: number;
	EnableHTML: boolean;
	MathTypesettings: string ;
	HTMLExportMode: string;
}

export const DEFAULT_SETTINGS: MarpSlidesSettings = {
	CHROME_PATH: '',
	DefaultThemesSeeded: false,
	DefaultThemesVersion: 0,
	DefaultMermaidThemesSeeded: false,
	DefaultMermaidThemesVersion: 0,
	EnableHTML: false,
	MathTypesettings: 'mathjax',
	HTMLExportMode: 'bare'
}
