export interface MarpExtendedSettings {
	MARP_CLI_PATH: string;
	MARP_CLI_USE_NPX: boolean;
	CHROME_PATH: string;
}

export const DEFAULT_SETTINGS: MarpExtendedSettings = {
	MARP_CLI_PATH: '',
	MARP_CLI_USE_NPX: false,
	CHROME_PATH: '',
}
