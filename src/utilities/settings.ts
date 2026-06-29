export interface MarpSlidesSettings {
	MARP_CLI_PATH: string;
	MARP_CLI_USE_NPX: boolean;
	CHROME_PATH: string;
	EnableHTML: boolean;
	MathTypesettings: string ;
	HTMLExportMode: string;
}

export const DEFAULT_SETTINGS: MarpSlidesSettings = {
	MARP_CLI_PATH: '',
	MARP_CLI_USE_NPX: false,
	CHROME_PATH: '',
	EnableHTML: false,
	MathTypesettings: 'mathjax',
	HTMLExportMode: 'bare'
}
