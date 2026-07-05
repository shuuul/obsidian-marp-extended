import { Notice } from 'obsidian';

import type MarpExtended from '../main';
import { ThemeManager } from './themeManager';

export async function ensureDefaultThemes(plugin: MarpExtended): Promise<void> {
	const manager = new ThemeManager(plugin.app);

	try {
		await manager.ensureDefaultThemes({ overwrite: true });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		new Notice(`Default theme install failed: ${message}`, 8000);
		throw error;
	}
}
