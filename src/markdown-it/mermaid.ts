import { renderMermaidSVG, type RenderOptions } from 'beautiful-mermaid';

type MarkdownIt = {
	utils: {
		escapeHtml(value: string): string;
		unescapeAll(value: string): string;
	};
	renderer: {
		rules: {
			fence?: MarkdownItFenceRenderer;
		};
	};
};

type MarkdownItFenceRenderer = (
	tokens: MarkdownItToken[],
	idx: number,
	options: unknown,
	env: unknown,
	self: unknown,
) => string;

type MarkdownItToken = {
	info: string;
	content: string;
};

export type MermaidPluginOptions = {
	containerClass?: string;
	renderOptions?: RenderOptions;
};

const DEFAULT_CONTAINER_CLASS = 'mermaid-diagram-container';

export const DEFAULT_MERMAID_RENDER_OPTIONS: RenderOptions = {
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

function readLanguageAndAltText(info: string): { language: string; alt: string } {
	if (!info) {
		return { language: '', alt: '' };
	}

	const trimmed = info.trim();
	const languageEnd = /[\s[]/.exec(trimmed);
	const alt = trimmed.match(/\[(.*?)]/)?.[1] ?? '';

	return {
		language: languageEnd ? trimmed.substring(0, languageEnd.index) : trimmed,
		alt,
	};
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function buildContainerClass(containerClass: string): string {
	return [
		containerClass,
		'mermaid-diagram',
		'mermaid-diagram-svg',
	].join(' ');
}

export function renderMermaidFigure(source: string, alt: string, options: MermaidPluginOptions = {}): string {
	const containerClass = options.containerClass ?? DEFAULT_CONTAINER_CLASS;
	const classAttribute = escapeHtml(buildContainerClass(containerClass));
	const caption = alt ? `<figcaption>${escapeHtml(alt)}</figcaption>` : '';
	const svg = renderMermaidSVG(source, {
		...DEFAULT_MERMAID_RENDER_OPTIONS,
		...(options.renderOptions ?? {}),
	});

	return `<figure class="${classAttribute}" data-mermaid-renderer="beautiful-mermaid">${svg}${caption}</figure>`;
}

export function renderMermaidFences(markdown: string, options: MermaidPluginOptions = {}): string {
	return markdown.replace(/^```mermaid([^\n]*)\n([\s\S]*?)^```[ \t]*$/gm, (match, rawInfo: string, source: string) => {
		const { alt } = readLanguageAndAltText(`mermaid${rawInfo}`);

		try {
			return renderMermaidFigure(source, alt, options);
		} catch {
			return match;
		}
	});
}

export function markdownItMermaid(md: MarkdownIt, options: MermaidPluginOptions = {}): void {
	const defaultFence = md.renderer.rules.fence;

	md.renderer.rules.fence = (tokens, idx, renderOptions, env, self) => {
		const token = tokens[idx];
		const { language, alt } = readLanguageAndAltText(md.utils.unescapeAll(token.info));

		if (language !== 'mermaid') {
			return defaultFence ? defaultFence(tokens, idx, renderOptions, env, self) : '';
		}

		try {
			return renderMermaidFigure(token.content, alt, options);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return `<pre class="mermaid-render-error"><code>${md.utils.escapeHtml(message)}</code></pre>`;
		}
	};
}
