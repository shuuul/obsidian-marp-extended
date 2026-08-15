import type { RenderOptions } from 'beautiful-mermaid';
import { renderMermaidAutoFitSVG, type MermaidAutoFitOptions } from '@marp-extended/mermaid-autofit';
import {
	BEAUTIFUL_MERMAID_SUPPORTED_TYPES,
	DEFAULT_BEAUTIFUL_MERMAID_RENDER_OPTIONS,
	parseMermaidFenceInfo,
} from './mermaidShared';

type FenceToken = { info: string; content: string };
type FenceRenderer = (tokens: FenceToken[], index: number, options: unknown, env: unknown, self: unknown) => string;
type MarkdownRenderer = {
	utils: { escapeHtml(value: string): string; unescapeAll(value: string): string };
	renderer: { rules: { fence?: FenceRenderer } };
};

export type MermaidFallbackOptions = {
	containerClass?: string;
	renderOptions?: RenderOptions;
	autoFit?: MermaidAutoFitOptions;
};

function escape(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderMermaidFallbackFigure(source: string, alt: string, options: MermaidFallbackOptions = {}): string {
	const type = source.split(/\r?\n/).map((line) => line.trim())
		.find((line) => line && !line.startsWith('%%'))?.match(/^([A-Za-z][A-Za-z0-9_-]*)/)?.[1];
	if (!type || !BEAUTIFUL_MERMAID_SUPPORTED_TYPES.has(type.toLowerCase())) {
		throw new Error(type
			? `Diagram type "${type}" is not supported by beautiful-mermaid; use async pre-render for official Mermaid fallback.`
			: 'Unable to detect Mermaid diagram type for beautiful-mermaid rendering.');
	}
	const svg = renderMermaidAutoFitSVG(source, { ...DEFAULT_BEAUTIFUL_MERMAID_RENDER_OPTIONS, ...(options.renderOptions ?? {}) }, options.autoFit);
	const classes = `${options.containerClass ?? 'mermaid-diagram-container'} mermaid-diagram mermaid-diagram-svg`;
	return `<figure class="${escape(classes)}" data-mermaid-renderer="beautiful-mermaid">${svg}${alt ? `<figcaption>${escape(alt)}</figcaption>` : ''}</figure>`;
}

/** Obsidian-free synchronous safety net used by both preview and CLI engines. */
export function mermaidFencePlugin(md: MarkdownRenderer, options: MermaidFallbackOptions = {}): void {
	const defaultFence = md.renderer.rules.fence;
	md.renderer.rules.fence = (tokens, index, renderOptions, env, self) => {
		const token = tokens[index];
		const { language, alt } = parseMermaidFenceInfo(md.utils.unescapeAll(token.info));
		if (language !== 'mermaid') return defaultFence ? defaultFence(tokens, index, renderOptions, env, self) : '';
		try {
			return renderMermaidFallbackFigure(token.content, alt, options);
		} catch (error) {
			return `<pre class="mermaid-render-error"><code>${md.utils.escapeHtml(error instanceof Error ? error.message : String(error))}</code></pre>`;
		}
	};
}
