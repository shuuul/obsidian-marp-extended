import type { RenderOptions } from 'beautiful-mermaid';

/** Diagram headers supported by beautiful-mermaid v1.1.x. */
export const BEAUTIFUL_MERMAID_SUPPORTED_TYPES = new Set([
	'flowchart',
	'graph',
	'sequencediagram',
	'classdiagram',
	'statediagram',
	'statediagram-v2',
	'erdiagram',
	'xychart',
	'xychart-beta',
]);

export const DEFAULT_BEAUTIFUL_MERMAID_RENDER_OPTIONS: RenderOptions = {
	bg: '#f5f4ed',
	fg: '#141413',
	line: '#504e49',
	accent: '#1B365D',
	muted: '#6b6a64',
	surface: '#faf9f5',
	border: '#e8e6dc',
	font: 'Charter',
	transparent: true,
	padding: 32,
	nodeSpacing: 32,
	layerSpacing: 48,
};

export function parseMermaidFenceInfo(info: string): { language: string; alt: string } {
	if (!info) {
		return { language: '', alt: '' };
	}

	const trimmed = info.trim();
	const languageEnd = /[\s[]/.exec(trimmed);
	const rawAttributes = trimmed.match(/\[(.*?)]/)?.[1]?.trim() ?? '';
	const alt = parseMermaidTitle(rawAttributes);

	return {
		language: languageEnd ? trimmed.substring(0, languageEnd.index) : trimmed,
		alt,
	};
}

function parseMermaidTitle(rawAttributes: string): string {
	if (!rawAttributes) {
		return '';
	}

	if (!rawAttributes.includes('=')) {
		return rawAttributes;
	}

	const titleMatch = rawAttributes.match(/(?:^|\s)(?:title|alt)=("[^"]*"|'[^']*'|[^\s]+)/);
	if (!titleMatch) {
		return rawAttributes;
	}

	const value = titleMatch[1];
	if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
		return value.slice(1, -1);
	}

	return value;
}
