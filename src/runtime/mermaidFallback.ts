import type { RenderOptions } from 'beautiful-mermaid';
import { renderMermaidAutoFitSVG, type MermaidAutoFitOptions } from '@marp-extended/mermaid-autofit';
import {
	BEAUTIFUL_MERMAID_SUPPORTED_TYPES,
	DEFAULT_BEAUTIFUL_MERMAID_RENDER_OPTIONS,
	parseMermaidFenceInfo,
} from './mermaidShared';

type FenceToken = { type: string; tag: string; info: string; content: string };

type FenceSelf = { rules: Record<string, FenceRenderer | undefined> };

type FenceRenderer = (
	tokens: FenceToken[],
	index: number,
	options: unknown,
	env: unknown,
	self: FenceSelf,
) => string;

type CoreState = { tokens: FenceToken[] };

type MarkdownRenderer = {
	utils: { escapeHtml(value: string): string; unescapeAll(value: string): string };
	core: { ruler: { after(afterName: string, ruleName: string, fn: (state: CoreState) => void): void } };
	renderer: { rules: Record<string, FenceRenderer | undefined> };
	marpit?: {
		themeSetPackOptions?: (...args: unknown[]) => { before?: string };
	};
};

export type MermaidFallbackOptions = {
	containerClass?: string;
	renderOptions?: RenderOptions;
	autoFit?: MermaidAutoFitOptions;
	/** Native `interactive` fence keyword forwarded to beautiful-mermaid. */
	interactive?: boolean;
};

function escape(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Native Marp Core 5 Mermaid default CSS, scoped to the shared attribute. */
const MERMAID_DEFAULT_CSS = `:where(svg[data-marp-mermaid]) {
  display: block;
  width: fit-content;
  max-width: 100%;
  height: auto;
  --marp-mermaid-background: var(--bg);
  --marp-mermaid-foreground: var(--fg);
  --marp-mermaid-line: var(--line);
  --marp-mermaid-accent: var(--accent);
  --marp-mermaid-muted: var(--muted);
  --marp-mermaid-surface: var(--surface);
  --marp-mermaid-border: var(--border);
}
`;

export function renderMermaidFallbackFigure(
	source: string,
	alt: string,
	options: MermaidFallbackOptions = {},
): string {
	const type = source.split(/\r?\n/).map((line) => line.trim())
		.find((line) => line && !line.startsWith('%%'))?.match(/^([A-Za-z][A-Za-z0-9_-]*)/)?.[1];
	if (!type || !BEAUTIFUL_MERMAID_SUPPORTED_TYPES.has(type.toLowerCase())) {
		throw new Error(type
			? `Diagram type "${type}" is not supported by beautiful-mermaid; use async pre-render for official Mermaid fallback.`
			: 'Unable to detect Mermaid diagram type for beautiful-mermaid rendering.');
	}
	const renderOptions: RenderOptions = {
		...DEFAULT_BEAUTIFUL_MERMAID_RENDER_OPTIONS,
		...(options.renderOptions ?? {}),
		...(options.interactive === undefined ? {} : { interactive: options.interactive }),
	};
	const svg = renderMermaidAutoFitSVG(source, renderOptions, options.autoFit);
	const markedSvg = /^<svg\b/i.test(svg) ? svg.replace(/^<svg\b/i, '<svg data-marp-mermaid') : svg;
	const classes = `${options.containerClass ?? 'mermaid-diagram-container'} mermaid-diagram mermaid-diagram-svg`;
	return `<figure class="${escape(classes)}" data-mermaid-renderer="beautiful-mermaid">${markedSvg}${alt ? `<figcaption>${escape(alt)}</figcaption>` : ''}</figure>`;
}

/**
 * Marp Core 5 native Mermaid integration semantics with fork enhancements:
 * fences are rewritten to `marp_mermaid` tokens (like `plugins/mermaid`) and
 * rendered through mermaid-autofit into the fork's figure structure, keeping
 * the `data-marp-mermaid` attribute, `interactive` keyword, and native default
 * CSS injection. Obsidian-free and synchronous; used by both preview and CLI
 * engines as the safety net behind the async pre-render path.
 */
export function mermaidFencePlugin(md: MarkdownRenderer, options: MermaidFallbackOptions = {}): void {
	md.core.ruler.after('block', 'marp_mermaid', ({ tokens }) => {
		for (const token of tokens) {
			if (token.type !== 'fence') {
				continue;
			}
			const { language } = parseMermaidFenceInfo(md.utils.unescapeAll(token.info ?? ''));
			if (language === 'mermaid') {
				token.type = 'marp_mermaid';
				token.tag = 'svg';
			}
		}
	});

	md.renderer.rules.marp_mermaid = (tokens, index, renderOptions, env, self) => {
		const token = tokens[index];
		const info = md.utils.unescapeAll(token.info ?? '');
		const { alt } = parseMermaidFenceInfo(info);
		const interactive = /\binteractive\b/.test(info);
		try {
			return renderMermaidFallbackFigure(token.content, alt, { ...options, interactive });
		} catch (error) {
			console.warn(error);
			const fence = self.rules.fence ?? md.renderer.rules.fence;
			return fence ? fence(tokens, index, renderOptions, env, self) : '';
		}
	};

	const marpit = md.marpit;
	const themeSetPackOptions = marpit?.themeSetPackOptions;
	if (marpit && themeSetPackOptions) {
		marpit.themeSetPackOptions = function marpMermaidCssPack(this: unknown, ...args: unknown[]) {
			const packed = themeSetPackOptions.apply(this, args);
			packed.before = `${MERMAID_DEFAULT_CSS}\n${packed.before ?? ''}`;
			return packed;
		};
	}
}
