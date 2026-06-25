import { Notice } from 'obsidian';

import type MarpSlides from '../main';
import { DEFAULT_THEME_MANIFEST_VERSION } from './defaultThemes';
import { ThemeManager } from './themeManager';

function shouldEnsureDefaultThemes(settings: {
	DefaultThemesSeeded?: boolean;
	DefaultThemesVersion?: number;
}): boolean {
	return settings.DefaultThemesSeeded !== true
		|| settings.DefaultThemesVersion !== DEFAULT_THEME_MANIFEST_VERSION;
}

export async function ensureDefaultThemes(plugin: MarpSlides): Promise<void> {
	if (!shouldEnsureDefaultThemes(plugin.settings)) {
		return;
	}

	const manager = new ThemeManager(plugin.app);
	const notice = new Notice('Installing Marp Extended themes…', 0);

	try {
		const installed = await manager.ensureDefaultThemes();
		plugin.settings.DefaultThemesSeeded = true;
		plugin.settings.DefaultThemesVersion = DEFAULT_THEME_MANIFEST_VERSION;
		await plugin.saveSettings();
		notice.hide();

		if (installed.length > 0) {
			new Notice(`Installed Marp Extended themes (${installed.length}).`, 5000);
		}
	} catch (error) {
		notice.hide();
		const message = error instanceof Error ? error.message : String(error);
		new Notice(`Default theme install failed: ${message}`, 8000);
		throw error;
	}
}
