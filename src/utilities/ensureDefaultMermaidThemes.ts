import MarpSlides from '../main';
import { MermaidThemeManager } from './mermaidThemeManager';

export async function ensureDefaultMermaidThemes(plugin: MarpSlides): Promise<void> {
	const manager = new MermaidThemeManager(plugin.app);
	await manager.ensureDefaultThemes({ overwrite: true });
}
