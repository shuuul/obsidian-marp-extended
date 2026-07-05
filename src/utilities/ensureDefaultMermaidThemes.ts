import type MarpExtended from '../main';
import { MermaidThemeManager } from './mermaidThemeManager';

export async function ensureDefaultMermaidThemes(plugin: MarpExtended): Promise<void> {
	const manager = new MermaidThemeManager(plugin.app);
	await manager.ensureDefaultThemes({ overwrite: true });
}
