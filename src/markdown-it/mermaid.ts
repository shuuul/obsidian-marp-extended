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
const MERMAID_FIGURE_CACHE_LIMIT = 100;
const PROFILE_STORAGE_KEY = 'marp-extended-profile';

const mermaidFigureCache = new Map<string, string>();
let mermaidMeasureCounter = 0;

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

function getMermaidFigureCacheKey(
	source: string,
	alt: string,
	containerClass: string,
	renderOptions: RenderOptions | undefined,
): string {
	const normalizedRenderOptions = Object.entries(renderOptions ?? {})
		.sort(([left], [right]) => left.localeCompare(right));
	return JSON.stringify([source, alt, containerClass, normalizedRenderOptions]);
}

function getCachedMermaidFigure(cacheKey: string): string | null {
	const cached = mermaidFigureCache.get(cacheKey);
	if (cached == null) {
		return null;
	}

	mermaidFigureCache.delete(cacheKey);
	mermaidFigureCache.set(cacheKey, cached);
	return cached;
}

function setCachedMermaidFigure(cacheKey: string, figure: string): void {
	mermaidFigureCache.set(cacheKey, figure);
	if (mermaidFigureCache.size <= MERMAID_FIGURE_CACHE_LIMIT) {
		return;
	}

	const oldestKey = mermaidFigureCache.keys().next().value;
	if (oldestKey !== undefined) {
		mermaidFigureCache.delete(oldestKey);
	}
}

function isMermaidProfilingEnabled(): boolean {
	try {
		return typeof window !== 'undefined'
			&& window.localStorage?.getItem(PROFILE_STORAGE_KEY) === '1'
			&& typeof performance !== 'undefined';
	} catch {
		return false;
	}
}

function measureMermaidStep<T>(name: string, callback: () => T): T {
	if (!isMermaidProfilingEnabled()) {
		return callback();
	}

	const startMark = `marp-extended:mermaid:${name}:start:${++mermaidMeasureCounter}`;
	const endMark = startMark.replace(':start:', ':end:');
	performance.mark(startMark);
	try {
		return callback();
	} finally {
		performance.mark(endMark);
		performance.measure(`marp-extended:mermaid:${name}`, startMark, endMark);
		performance.clearMarks(startMark);
		performance.clearMarks(endMark);
	}
}

export function renderMermaidFigure(source: string, alt: string, options: MermaidPluginOptions = {}): string {
	const containerClass = options.containerClass ?? DEFAULT_CONTAINER_CLASS;
	const cacheKey = getMermaidFigureCacheKey(source, alt, containerClass, options.renderOptions);
	const cachedFigure = getCachedMermaidFigure(cacheKey);
	if (cachedFigure != null) {
		return cachedFigure;
	}

	const classAttribute = escapeHtml(buildContainerClass(containerClass));
	const caption = alt ? `<figcaption>${escapeHtml(alt)}</figcaption>` : '';
	const svg = measureMermaidStep('renderSVG', () => renderMermaidSVG(source, {
		...DEFAULT_MERMAID_RENDER_OPTIONS,
		...(options.renderOptions ?? {}),
	}));

	const figure = `<figure class="${classAttribute}" data-mermaid-renderer="beautiful-mermaid">${svg}${caption}</figure>`;
	setCachedMermaidFigure(cacheKey, figure);
	return figure;
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
