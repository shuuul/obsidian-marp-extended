import { loadMermaid } from 'obsidian';
import { renderMermaidSVG, type RenderOptions } from 'beautiful-mermaid';
import { mermaidFencePlugin as pureMermaidFencePlugin } from '../runtime/mermaidFallback';

type MarpMarkdownRenderer = {
	utils: {
		escapeHtml(value: string): string;
		unescapeAll(value: string): string;
	};
	renderer: {
		rules: {
			fence?: MarpFenceRenderer;
		};
	};
};

type MarpFenceRenderer = (
	tokens: MarpFenceToken[],
	idx: number,
	options: unknown,
	env: unknown,
	self: unknown,
) => string;

type MarpFenceToken = {
	info: string;
	content: string;
};

export type MermaidPluginOptions = {
	containerClass?: string;
	renderOptions?: RenderOptions;
};

export type MermaidRendererName = 'beautiful-mermaid' | 'mermaid';

type OfficialMermaidApi = {
	initialize?: (config: Record<string, unknown>) => void | Promise<void>;
	render: (id: string, text: string) => Promise<{ svg: string } | string>;
};

const DEFAULT_CONTAINER_CLASS = 'mermaid-diagram-container';
const MERMAID_FIGURE_CACHE_LIMIT = 100;
const PROFILE_STORAGE_KEY = 'marp-extended-profile';

/** Diagram headers supported by beautiful-mermaid v1.1.x */
const BEAUTIFUL_MERMAID_TYPES = new Set([
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

const mermaidFigureCache = new Map<string, string>();
let mermaidMeasureCounter = 0;
let mermaidRenderIdCounter = 0;
let officialMermaidReady: Promise<OfficialMermaidApi> | null = null;
let officialMermaidRenderQueue: Promise<void> = Promise.resolve();

/** Reset module-level mutable state. Exported for test isolation only. */
export function resetMermaidState(): void {
	mermaidFigureCache.clear();
	mermaidMeasureCounter = 0;
	mermaidRenderIdCounter = 0;
	officialMermaidReady = null;
	officialMermaidRenderQueue = Promise.resolve();
}

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

/**
 * Detect the first Mermaid diagram header token, skipping blank lines,
 * `%%` comments, and `%%{init}%%` directives.
 */
export function detectMermaidDiagramType(source: string): string | null {
	for (const rawLine of source.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line) {
			continue;
		}
		if (line.startsWith('%%')) {
			continue;
		}

		const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*)/);
		return match?.[1] ?? null;
	}

	return null;
}

export function isBeautifulMermaidSupported(diagramType: string | null): boolean {
	if (!diagramType) {
		return false;
	}

	return BEAUTIFUL_MERMAID_TYPES.has(diagramType.toLowerCase());
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

function mergeRenderOptions(renderOptions: RenderOptions | undefined): RenderOptions {
	return {
		...DEFAULT_MERMAID_RENDER_OPTIONS,
		...(renderOptions ?? {}),
	};
}

const MERMAID_FIGURE_CACHE_VERSION = 4;

function getMermaidFigureCacheKey(
	source: string,
	alt: string,
	containerClass: string,
	renderOptions: RenderOptions | undefined,
): string {
	const normalizedRenderOptions = Object.entries(renderOptions ?? {})
		.sort(([left], [right]) => left.localeCompare(right));
	return JSON.stringify([MERMAID_FIGURE_CACHE_VERSION, source, alt, containerClass, normalizedRenderOptions]);
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

	const oldestEntry = mermaidFigureCache.keys().next();
	if (!oldestEntry.done) {
		mermaidFigureCache.delete(oldestEntry.value);
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

async function measureMermaidStepAsync<T>(name: string, callback: () => Promise<T>): Promise<T> {
	if (!isMermaidProfilingEnabled()) {
		return callback();
	}

	const startMark = `marp-extended:mermaid:${name}:start:${++mermaidMeasureCounter}`;
	const endMark = startMark.replace(':start:', ':end:');
	performance.mark(startMark);
	try {
		return await callback();
	} finally {
		performance.mark(endMark);
		performance.measure(`marp-extended:mermaid:${name}`, startMark, endMark);
		performance.clearMarks(startMark);
		performance.clearMarks(endMark);
	}
}

function buildMermaidFigure(
	svg: string,
	alt: string,
	containerClass: string,
	renderer: MermaidRendererName,
): string {
	const classAttribute = escapeHtml(buildContainerClass(containerClass));
	const caption = alt ? `<figcaption>${escapeHtml(alt)}</figcaption>` : '';
	return `<figure class="${classAttribute}" data-mermaid-renderer="${renderer}">${svg}${caption}</figure>`;
}

function renderBeautifulMermaidSvg(source: string, renderOptions: RenderOptions): string {
	return measureMermaidStep('renderSVG', () => renderMermaidSVG(source, renderOptions));
}

/**
 * Soft multi-section fills for official Mermaid mindmap/timeline/pie.
 *
 * Mermaid's theme engine always darkens every cScale* entry (25% in light mode,
 * 75% in dark mode). Start from pale fills so the post-darken result stays
 * readable, and never put the dark accent color into tertiary/cScale.
 */
const OFFICIAL_MERMAID_SECTION_FILLS = [
	'#fff4d6',
	'#e5f3df',
	'#dde8fb',
	'#f7e4d2',
	'#ebe4f8',
	'#dcf3ee',
	'#f8e2dc',
	'#f0ecda',
	'#d9e7f4',
	'#e4f2d8',
	'#f6e8d6',
	'#e2e5f4',
] as const;

export function mapRenderOptionsToMermaidThemeVariables(
	renderOptions: RenderOptions,
): Record<string, string | boolean | number> {
	const bg = String(renderOptions.bg ?? DEFAULT_MERMAID_RENDER_OPTIONS.bg);
	const fg = String(renderOptions.fg ?? DEFAULT_MERMAID_RENDER_OPTIONS.fg);
	const line = String(renderOptions.line ?? DEFAULT_MERMAID_RENDER_OPTIONS.line);
	const accent = String(renderOptions.accent ?? DEFAULT_MERMAID_RENDER_OPTIONS.accent);
	const muted = String(renderOptions.muted ?? DEFAULT_MERMAID_RENDER_OPTIONS.muted);
	const surface = String(renderOptions.surface ?? DEFAULT_MERMAID_RENDER_OPTIONS.surface);
	const border = String(renderOptions.border ?? DEFAULT_MERMAID_RENDER_OPTIONS.border);
	// Keep fills light; accent is only for strokes/highlights, not node bodies.
	const lightAccentFill = OFFICIAL_MERMAID_SECTION_FILLS[2];
	const lightSecondaryFill = OFFICIAL_MERMAID_SECTION_FILLS[1];

	const themeVariables: Record<string, string | boolean> = {
		// Prevent Obsidian/app dark-theme leakage from blacking out section fills.
		darkMode: false,
		background: bg,
		mainBkg: surface,
		primaryColor: surface,
		secondaryColor: lightSecondaryFill,
		tertiaryColor: lightAccentFill,
		primaryTextColor: fg,
		secondaryTextColor: muted,
		tertiaryTextColor: fg,
		textColor: fg,
		titleColor: fg,
		lineColor: line,
		primaryBorderColor: border,
		secondaryBorderColor: border,
		tertiaryBorderColor: border,
		nodeBorder: border,
		clusterBkg: surface,
		clusterBorder: border,
		edgeLabelBackground: surface,
		actorBkg: surface,
		actorBorder: border,
		actorTextColor: fg,
		actorLineColor: line,
		signalColor: accent,
		signalTextColor: fg,
		labelBoxBkgColor: surface,
		labelBoxBorderColor: border,
		labelTextColor: fg,
		loopTextColor: fg,
		noteBkgColor: lightSecondaryFill,
		noteTextColor: fg,
		noteBorderColor: border,
		activationBkgColor: lightAccentFill,
		activationBorderColor: accent,
		sequenceNumberColor: fg,
		sectionBkgColor: lightSecondaryFill,
		sectionBkgColor2: lightAccentFill,
		altSectionBkgColor: surface,
		taskBkgColor: surface,
		taskTextColor: fg,
		taskTextLightColor: fg,
		taskTextOutsideColor: fg,
		taskTextClickableColor: accent,
		activeTaskBkgColor: lightAccentFill,
		activeTaskBorderColor: accent,
		gridColor: border,
		doneTaskBkgColor: lightSecondaryFill,
		doneTaskBorderColor: border,
		critBkgColor: '#f8e2dc',
		critBorderColor: accent,
		todayLineColor: accent,
		scaleLabelColor: fg,
		fontFamily: String(renderOptions.font ?? DEFAULT_MERMAID_RENDER_OPTIONS.font),
	};

	OFFICIAL_MERMAID_SECTION_FILLS.forEach((fill, index) => {
		// Intentionally omit cScale* here: Mermaid always darkens provided cScale
		// values. We inject final section colors into the SVG after render.
		themeVariables[`cScaleLabel${index}`] = fg;
		themeVariables[`cScaleInv${index}`] = line;
		themeVariables[`fillType${index % 8}`] = fill;
	});

	for (let index = 1; index <= 12; index += 1) {
		themeVariables[`pie${index}`] = OFFICIAL_MERMAID_SECTION_FILLS[(index - 1) % OFFICIAL_MERMAID_SECTION_FILLS.length];
	}
	themeVariables.pieTitleTextColor = fg;
	themeVariables.pieSectionTextColor = fg;
	themeVariables.pieLegendTextColor = fg;
	themeVariables.pieStrokeColor = border;

	return themeVariables;
}

/**
 * Mermaid still darkens cScale fills and may inherit app dark mode. Rewrite
 * mindmap/timeline section colors in the produced SVG so labels stay readable.
 */
export function applyOfficialMermaidSectionContrast(
	svg: string,
	renderOptions: RenderOptions = DEFAULT_MERMAID_RENDER_OPTIONS,
): string {
	const fg = String(renderOptions.fg ?? DEFAULT_MERMAID_RENDER_OPTIONS.fg);
	const line = String(renderOptions.line ?? DEFAULT_MERMAID_RENDER_OPTIONS.line);
	const rules = OFFICIAL_MERMAID_SECTION_FILLS.map((fill, index) => {
		const section = index;
		return [
			`.section-${section} rect, .section-${section} path, .section-${section} circle, .section-${section} polygon { fill: ${fill} !important; }`,
			`.section-${section} text { fill: ${fg} !important; }`,
			`.section-${section} span { color: ${fg} !important; }`,
			`.section-edge-${section} { stroke: ${line} !important; }`,
			`.section-${section} line { stroke: ${line} !important; }`,
		].join('\n');
	}).join('\n');

	const styleBlock = `<style data-marp-extended-mermaid-contrast="1">${rules}</style>`;
	if (/data-marp-extended-mermaid-contrast=/.test(svg)) {
		return svg;
	}

	if (/<svg\b[^>]*>/i.test(svg)) {
		return svg.replace(/<svg\b[^>]*>/i, (openTag) => `${openTag}${styleBlock}`);
	}

	return `${styleBlock}${svg}`;
}

async function getOfficialMermaid(): Promise<OfficialMermaidApi> {
	if (!officialMermaidReady) {
		officialMermaidReady = Promise.resolve(loadMermaid()).then((api) => api as OfficialMermaidApi);
	}

	return officialMermaidReady;
}

function nextMermaidRenderId(): string {
	mermaidRenderIdCounter += 1;
	// Mermaid uses the id as a CSS selector; keep it a plain identifier.
	return `marpExMermaid${mermaidRenderIdCounter}`;
}

async function withOfficialMermaidLock<T>(callback: () => Promise<T>): Promise<T> {
	const previous = officialMermaidRenderQueue;
	let release!: () => void;
	officialMermaidRenderQueue = new Promise<void>((resolve) => {
		release = resolve;
	});
	await previous;
	try {
		return await callback();
	} finally {
		release();
	}
}

/**
 * Official Mermaid often emits width/height="100%". Inside a
 * width:fit-content figure that collapses to an empty white card.
 * Prefer numeric intrinsic dimensions from viewBox (or max-width style),
 * then allow CSS max-width:100% to scale the diagram down to the pane.
 */
export function normalizeOfficialMermaidSvg(svg: string): string {
	const trimmed = svg.trim();
	if (!trimmed) {
		return svg;
	}

	if (typeof DOMParser !== 'undefined') {
		try {
			const document = new DOMParser().parseFromString(trimmed, 'image/svg+xml');
			const root = document.documentElement;
			if (root && (root.localName === 'svg' || root.tagName.toLowerCase() === 'svg')) {
				applyOfficialMermaidSvgSizing(root);
				return root.outerHTML;
			}
		} catch {
			// Fall through to regex path.
		}
	}

	return normalizeOfficialMermaidSvgWithRegex(trimmed);
}

function parsePositiveNumber(value: string | null | undefined): number | null {
	if (!value) {
		return null;
	}

	const match = value.trim().match(/^([0-9]+(?:\.[0-9]+)?)/);
	if (!match) {
		return null;
	}

	const parsed = Number(match[1]);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseViewBoxSize(viewBox: string | null | undefined): { width: number; height: number } | null {
	if (!viewBox) {
		return null;
	}

	const parts = viewBox.trim().split(/[\s,]+/).map(Number);
	if (parts.length !== 4) {
		return null;
	}

	const width = parts[2];
	const height = parts[3];
	if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
		return null;
	}

	return { width, height };
}

function parseMaxWidthFromStyle(style: string | null | undefined): number | null {
	if (!style) {
		return null;
	}

	const match = style.match(/(?:^|;)\s*max-width\s*:\s*([0-9]+(?:\.[0-9]+)?)px/i);
	return match ? parsePositiveNumber(match[1]) : null;
}

function isPercentOrMissing(value: string | null | undefined): boolean {
	if (!value) {
		return true;
	}

	const trimmed = value.trim().toLowerCase();
	return trimmed === '' || trimmed === '100%' || trimmed === 'auto';
}

function mergeSvgStyle(style: string | null | undefined, patch: Record<string, string>): string {
	const declarations = new Map<string, string>();
	for (const part of (style ?? '').split(';')) {
		const trimmed = part.trim();
		if (!trimmed) {
			continue;
		}
		const separator = trimmed.indexOf(':');
		if (separator === -1) {
			continue;
		}
		const property = trimmed.slice(0, separator).trim().toLowerCase();
		const value = trimmed.slice(separator + 1).trim();
		if (property) {
			declarations.set(property, value);
		}
	}

	for (const [property, value] of Object.entries(patch)) {
		declarations.set(property.toLowerCase(), value);
	}

	return [...declarations.entries()]
		.map(([property, value]) => `${property}: ${value}`)
		.join('; ');
}

function applyOfficialMermaidSvgSizing(svg: Element): void {
	const viewBoxSize = parseViewBoxSize(svg.getAttribute('viewBox'));
	const styleMaxWidth = parseMaxWidthFromStyle(svg.getAttribute('style'));
	const currentWidth = parsePositiveNumber(svg.getAttribute('width'));
	const currentHeight = parsePositiveNumber(svg.getAttribute('height'));

	let width = !isPercentOrMissing(svg.getAttribute('width')) ? currentWidth : null;
	let height = !isPercentOrMissing(svg.getAttribute('height')) ? currentHeight : null;

	if (width == null && styleMaxWidth != null) {
		width = styleMaxWidth;
	}

	if (viewBoxSize) {
		if (width == null) {
			width = viewBoxSize.width;
		}
		if (height == null) {
			if (width != null && viewBoxSize.width > 0) {
				height = width * (viewBoxSize.height / viewBoxSize.width);
			} else {
				height = viewBoxSize.height;
			}
		}
	}

	// Intrinsic size for aspect ratio; CSS max-width:100% scales it down.
	if (width != null) {
		svg.setAttribute('width', String(Math.round(width * 1000) / 1000));
	}
	if (height != null) {
		svg.setAttribute('height', String(Math.round(height * 1000) / 1000));
	}

	if (!svg.getAttribute('preserveAspectRatio')) {
		svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
	}

	svg.setAttribute(
		'style',
		mergeSvgStyle(svg.getAttribute('style'), {
			'max-width': '100%',
			height: 'auto',
		}),
	);

	if (!svg.getAttribute('xmlns')) {
		svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
	}
}

function normalizeOfficialMermaidSvgWithRegex(svg: string): string {
	const viewBoxMatch = svg.match(/\bviewBox\s*=\s*["']([^"']+)["']/i);
	const viewBoxSize = parseViewBoxSize(viewBoxMatch?.[1]);
	const styleMatch = svg.match(/\bstyle\s*=\s*["']([^"']*)["']/i);
	const styleMaxWidth = parseMaxWidthFromStyle(styleMatch?.[1]);

	let width = styleMaxWidth ?? viewBoxSize?.width ?? null;
	let height = viewBoxSize?.height ?? null;
	if (width != null && viewBoxSize && viewBoxSize.width > 0) {
		height = width * (viewBoxSize.height / viewBoxSize.width);
	}

	if (width == null || height == null) {
		return svg;
	}

	const widthValue = String(Math.round(width * 1000) / 1000);
	const heightValue = String(Math.round(height * 1000) / 1000);
	let result = svg;

	if (/\bwidth\s*=\s*["'][^"']*["']/i.test(result)) {
		result = result.replace(/\bwidth\s*=\s*["'][^"']*["']/i, `width="${widthValue}"`);
	} else {
		result = result.replace(/<svg\b/i, `<svg width="${widthValue}"`);
	}

	if (/\bheight\s*=\s*["'][^"']*["']/i.test(result)) {
		result = result.replace(/\bheight\s*=\s*["'][^"']*["']/i, `height="${heightValue}"`);
	} else {
		result = result.replace(/<svg\b/i, `<svg height="${heightValue}"`);
	}

	if (!/\bpreserveAspectRatio\s*=/i.test(result)) {
		result = result.replace(/<svg\b/i, '<svg preserveAspectRatio="xMidYMid meet"');
	}

	const nextStyle = mergeSvgStyle(styleMatch?.[1], {
		'max-width': '100%',
		height: 'auto',
	});
	if (/\bstyle\s*=\s*["'][^"']*["']/i.test(result)) {
		result = result.replace(/\bstyle\s*=\s*["'][^"']*["']/i, `style="${nextStyle}"`);
	} else {
		result = result.replace(/<svg\b/i, `<svg style="${nextStyle}"`);
	}

	return result;
}

async function renderOfficialMermaidSvg(source: string, renderOptions: RenderOptions): Promise<string> {
	return measureMermaidStepAsync('renderOfficialSVG', async () => withOfficialMermaidLock(async () => {
		const mermaid = await getOfficialMermaid();
		const themeVariables = mapRenderOptionsToMermaidThemeVariables(renderOptions);

		if (typeof mermaid.initialize === 'function') {
			await mermaid.initialize({
				startOnLoad: false,
				securityLevel: 'loose',
				// Neutral avoids Obsidian dark-theme inheritance better than base/dark.
				theme: 'neutral',
				themeVariables,
				fontFamily: String(renderOptions.font ?? DEFAULT_MERMAID_RENDER_OPTIONS.font),
			});
		}

		const rendered = await mermaid.render(nextMermaidRenderId(), source);
		const svg = typeof rendered === 'string' ? rendered : rendered.svg;
		return applyOfficialMermaidSectionContrast(
			normalizeOfficialMermaidSvg(svg),
			renderOptions,
		);
	}));
}

export async function renderMermaidFigure(
	source: string,
	alt: string,
	options: MermaidPluginOptions = {},
): Promise<string> {
	const containerClass = options.containerClass ?? DEFAULT_CONTAINER_CLASS;
	const cacheKey = getMermaidFigureCacheKey(source, alt, containerClass, options.renderOptions);
	const cachedFigure = getCachedMermaidFigure(cacheKey);
	if (cachedFigure != null) {
		return cachedFigure;
	}

	const renderOptions = mergeRenderOptions(options.renderOptions);
	const diagramType = detectMermaidDiagramType(source);
	let svg: string;
	let renderer: MermaidRendererName;

	if (isBeautifulMermaidSupported(diagramType)) {
		try {
			svg = renderBeautifulMermaidSvg(source, renderOptions);
			renderer = 'beautiful-mermaid';
		} catch {
			svg = await renderOfficialMermaidSvg(source, renderOptions);
			renderer = 'mermaid';
		}
	} else {
		svg = await renderOfficialMermaidSvg(source, renderOptions);
		renderer = 'mermaid';
	}

	const figure = buildMermaidFigure(svg, alt, containerClass, renderer);
	setCachedMermaidFigure(cacheKey, figure);
	return figure;
}

export async function renderMermaidFences(
	markdown: string,
	options: MermaidPluginOptions = {},
): Promise<string> {
	const fencePattern = /^```mermaid([^\n]*)\n([\s\S]*?)^```[ \t]*$/gm;
	const matches = [...markdown.matchAll(fencePattern)];
	if (matches.length === 0) {
		return markdown;
	}

	const replacements = await Promise.all(matches.map(async (match) => {
		const rawInfo = match[1] ?? '';
		const source = match[2] ?? '';
		const { alt } = parseMermaidFenceInfo(`mermaid${rawInfo}`);

		try {
			return await renderMermaidFigure(source, alt, options);
		} catch {
			return match[0];
		}
	}));

	let result = '';
	let lastIndex = 0;
	matches.forEach((match, index) => {
		const start = match.index ?? 0;
		result += markdown.slice(lastIndex, start);
		result += replacements[index];
		lastIndex = start + match[0].length;
	});
	result += markdown.slice(lastIndex);
	return result;
}

export function mermaidFencePlugin(md: MarpMarkdownRenderer, options: MermaidPluginOptions = {}): void {
	pureMermaidFencePlugin(md, options);
}
