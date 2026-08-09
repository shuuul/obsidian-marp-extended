import { renderMermaidSVG, type RenderOptions } from 'beautiful-mermaid';

type FenceToken = { info: string; content: string };
type FenceRenderer = (tokens: FenceToken[], index: number, options: unknown, env: unknown, self: unknown) => string;
type MarkdownRenderer = {
	utils: { escapeHtml(value: string): string; unescapeAll(value: string): string };
	renderer: { rules: { fence?: FenceRenderer } };
};

export type MermaidFallbackOptions = {
	containerClass?: string;
	renderOptions?: RenderOptions;
};

const SUPPORTED_TYPES = new Set([
	'flowchart', 'graph', 'sequencediagram', 'classdiagram', 'statediagram',
	'statediagram-v2', 'erdiagram', 'xychart', 'xychart-beta',
]);

const DEFAULT_OPTIONS: RenderOptions = {
	bg: '#f5f4ed', fg: '#141413', line: '#504e49', accent: '#1B365D',
	muted: '#6b6a64', surface: '#faf9f5', border: '#e8e6dc', font: 'Charter',
	transparent: true, padding: 32, nodeSpacing: 32, layerSpacing: 48,
};

function fenceInfo(info: string): { language: string; alt: string } {
	const trimmed = info.trim();
	const end = /[\s[]/.exec(trimmed);
	const attributes = trimmed.match(/\[(.*?)]/)?.[1]?.trim() ?? '';
	const title = attributes.match(/(?:^|\s)(?:title|alt)=("[^"]*"|'[^']*'|[^\s]+)/)?.[1];
	const alt = title
		? ((title.startsWith('"') || title.startsWith("'")) ? title.slice(1, -1) : title)
		: attributes;
	return { language: end ? trimmed.slice(0, end.index) : trimmed, alt };
}

function escape(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderMermaidFallbackFigure(source: string, alt: string, options: MermaidFallbackOptions = {}): string {
	const type = source.split(/\r?\n/).map((line) => line.trim())
		.find((line) => line && !line.startsWith('%%'))?.match(/^([A-Za-z][A-Za-z0-9_-]*)/)?.[1];
	if (!type || !SUPPORTED_TYPES.has(type.toLowerCase())) {
		throw new Error(type
			? `Diagram type "${type}" is not supported by beautiful-mermaid; use async pre-render for official Mermaid fallback.`
			: 'Unable to detect Mermaid diagram type for beautiful-mermaid rendering.');
	}
	const svg = renderMermaidSVG(source, { ...DEFAULT_OPTIONS, ...(options.renderOptions ?? {}) });
	const classes = `${options.containerClass ?? 'mermaid-diagram-container'} mermaid-diagram mermaid-diagram-svg`;
	return `<figure class="${escape(classes)}" data-mermaid-renderer="beautiful-mermaid">${svg}${alt ? `<figcaption>${escape(alt)}</figcaption>` : ''}</figure>`;
}

/** Obsidian-free synchronous safety net used by both preview and CLI engines. */
export function mermaidFencePlugin(md: MarkdownRenderer, options: MermaidFallbackOptions = {}): void {
	const defaultFence = md.renderer.rules.fence;
	md.renderer.rules.fence = (tokens, index, renderOptions, env, self) => {
		const token = tokens[index];
		const { language, alt } = fenceInfo(md.utils.unescapeAll(token.info));
		if (language !== 'mermaid') return defaultFence ? defaultFence(tokens, index, renderOptions, env, self) : '';
		try {
			return renderMermaidFallbackFigure(token.content, alt, options);
		} catch (error) {
			return `<pre class="mermaid-render-error"><code>${md.utils.escapeHtml(error instanceof Error ? error.message : String(error))}</code></pre>`;
		}
	};
}
