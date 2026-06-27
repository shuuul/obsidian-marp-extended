import MarpSlides from '../main';
import { DEFAULT_MERMAID_THEME_MANIFEST_VERSION } from './defaultMermaidThemes';
import { MermaidThemeManager } from './mermaidThemeManager';

function shouldEnsureDefaultMermaidThemes(settings: {
	DefaultMermaidThemesSeeded?: boolean;
	DefaultMermaidThemesVersion?: number;
}): boolean {
	return settings.DefaultMermaidThemesSeeded !== true
		|| settings.DefaultMermaidThemesVersion !== DEFAULT_MERMAID_THEME_MANIFEST_VERSION;
}

export async function ensureDefaultMermaidThemes(plugin: MarpSlides): Promise<void> {
	if (!shouldEnsureDefaultMermaidThemes(plugin.settings)) {
		return;
	}

	const manager = new MermaidThemeManager(plugin.app);
	try {
		await manager.ensureDefaultThemes();
		plugin.settings.DefaultMermaidThemesSeeded = true;
		plugin.settings.DefaultMermaidThemesVersion = DEFAULT_MERMAID_THEME_MANIFEST_VERSION;
		await plugin.saveSettings();
	} catch (error) {
		plugin.settings.DefaultMermaidThemesSeeded = false;
		await plugin.saveSettings();
		throw error;
	}
}
