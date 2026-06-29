import { Notice } from 'obsidian';

import type MarpSlides from '../main';
import { ThemeManager } from './themeManager';

export async function ensureDefaultThemes(plugin: MarpSlides): Promise<void> {
	const manager = new ThemeManager(plugin.app);

	try {
		await manager.ensureDefaultThemes({ overwrite: true });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		new Notice(`Default theme install failed: ${message}`, 8000);
		throw error;
	}
}
