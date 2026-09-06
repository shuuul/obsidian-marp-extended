import { expect, test, beforeEach } from '@jest/globals';
import { Marp } from '@marp-team/marp-core';
import { renderMermaidSVG } from 'beautiful-mermaid';
import { loadMermaid } from 'obsidian';

import {
	applyOfficialMermaidSectionContrast,
	detectMermaidDiagramType,
	isBeautifulMermaidSupported,
	mapRenderOptionsToMermaidThemeVariables,
	mermaidFencePlugin,
	normalizeOfficialMermaidSvg,
	renderMermaidFences,
	resetMermaidState,
	DEFAULT_MERMAID_RENDER_OPTIONS,
} from '@/utilities/mermaid';

beforeEach(() => {
	resetMermaidState();
});

async function render(markdown: string, options = {}): Promise<string> {
	const processed = await renderMermaidFences(markdown, options);
	const marp = new Marp({ html: true }).use(mermaidFencePlugin, options);
	return marp.render(processed).html;
}

test('detectMermaidDiagramType skips comments and init directives', () => {
	const source = [
		'%% comment',
		'%%{init: {"theme":"dark"}}%%',
		'',
		'pie',
		'  "A": 40',
	].join('\n');

	expect(detectMermaidDiagramType(source)).toBe('pie');
	expect(isBeautifulMermaidSupported('pie')).toBe(false);
	expect(isBeautifulMermaidSupported('flowchart')).toBe(true);
	expect(isBeautifulMermaidSupported('sequenceDiagram')).toBe(true);
});

test('mermaid fence renders an inline beautiful-mermaid SVG with caption', async () => {
	const source = 'flowchart LR\n  A --> B\n';
	const html = await render(`\`\`\`mermaid[Architecture flow]\n${source}\`\`\`\n`);

	expect(html).toContain('<figure class="mermaid-diagram-container mermaid-diagram mermaid-diagram-svg" data-mermaid-renderer="beautiful-mermaid">');
	expect(html).toContain('<svg');
	expect(html).toContain('--accent:#1B365D');
	expect(html).toContain('--line:#504e49');
	expect(html).toContain('<figcaption>Architecture flow</figcaption>');
	expect(html).not.toContain('https://kroki.io');
});

test('tilde mermaid fences render an inline beautiful-mermaid SVG', async () => {
	const html = await render('~~~mermaid[Tilde flow]\nflowchart LR\n  A --> B\n~~~\n');

	expect(html).toContain('data-mermaid-renderer="beautiful-mermaid"');
	expect(html).toContain('<figcaption>Tilde flow</figcaption>');
});

test('long mermaid fences are not closed by shorter nested fences', async () => {
	const renderMermaidSVGMock = renderMermaidSVG as jest.MockedFunction<typeof renderMermaidSVG>;
	renderMermaidSVGMock.mockClear();
	const markdown = [
		'````mermaid',
		'flowchart LR',
		'  A --> B',
		'```text',
		'sample',
		'```',
		'````',
		'',
	].join('\n');

	const processed = await renderMermaidFences(markdown);

	expect(processed).toContain('data-mermaid-renderer="beautiful-mermaid"');
	expect(processed).not.toContain('```text');
	expect(renderMermaidSVGMock.mock.calls[0]?.[0]).toContain('```text\nsample\n```');
});

test('unsupported diagram types fall back to official Mermaid via loadMermaid', async () => {
	const loadMermaidMock = loadMermaid as jest.MockedFunction<typeof loadMermaid>;
	loadMermaidMock.mockClear();
	const source = 'pie\n  "Dogs" : 386\n  "Cats" : 85\n';
	const html = await render(`\`\`\`mermaid[Pet share]\n${source}\`\`\`\n`);

	expect(html).toContain('data-mermaid-renderer="mermaid"');
	expect(html).toContain('data-official-mermaid="1"');
	expect(html).toContain('width="640"');
	expect(html).toContain('height="320"');
	expect(html).toContain('<figcaption>Pet share</figcaption>');
	expect(loadMermaidMock).toHaveBeenCalled();
});

test('normalizeOfficialMermaidSvg replaces percent width with viewBox size', () => {
	const svg = normalizeOfficialMermaidSvg(
		'<svg width="100%" id="x" viewBox="0 0 800 400" style="max-width: 800px;"><g></g></svg>',
	);

	expect(svg).toContain('width="800"');
	expect(svg).toContain('height="400"');
	expect(svg).toMatch(/style="[^"]*max-width:\s*100%/);
	expect(svg).toMatch(/style="[^"]*height:\s*auto/);
	expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
});

test('gantt fences use official Mermaid fallback with concrete SVG size', async () => {
	const source = [
		'gantt',
		'  title 项目计划',
		'  dateFormat YYYY-MM-DD',
		'  section 需求',
		'    需求分析     :done, a1, 2026-01-01, 7d',
		'    原型设计     :active, a2, 2026-01-08, 5d',
	].join('\n');
	const html = await render(`\`\`\`mermaid\n${source}\n\`\`\`\n`);

	expect(html).toContain('data-mermaid-renderer="mermaid"');
	expect(html).toContain('width="640"');
	expect(html).toContain('height="320"');
	expect(html).not.toContain('width="100%"');
});

test('beautiful-mermaid render failure falls back to official Mermaid', async () => {
	const renderMermaidSVGMock = renderMermaidSVG as jest.MockedFunction<typeof renderMermaidSVG>;
	renderMermaidSVGMock.mockImplementationOnce(() => {
		throw new Error('BM parse failed');
	});

	const html = await render('```mermaid[Broken BM]\nflowchart LR\n  UniqueFallbackNode --> B\n```\n');

	expect(renderMermaidSVGMock).toHaveBeenCalled();
	expect(html).toContain('data-mermaid-renderer="mermaid"');
	expect(html).toContain('data-official-mermaid="1"');
	expect(html).toContain('UniqueFallbackNode');
});

test('mapRenderOptionsToMermaidThemeVariables maps palette CSS vars', () => {
	const mapped = mapRenderOptionsToMermaidThemeVariables(DEFAULT_MERMAID_RENDER_OPTIONS);

	expect(mapped.background).toBe(DEFAULT_MERMAID_RENDER_OPTIONS.bg);
	expect(mapped.primaryTextColor).toBe(DEFAULT_MERMAID_RENDER_OPTIONS.fg);
	expect(mapped.lineColor).toBe(DEFAULT_MERMAID_RENDER_OPTIONS.line);
	expect(mapped.primaryColor).toBe(DEFAULT_MERMAID_RENDER_OPTIONS.surface);
	expect(mapped.primaryBorderColor).toBe(DEFAULT_MERMAID_RENDER_OPTIONS.border);
	expect(mapped.darkMode).toBe(false);
	// Dark accent must not become a section fill (mindmap/timeline go black).
	expect(mapped.tertiaryColor).not.toBe(DEFAULT_MERMAID_RENDER_OPTIONS.accent);
	// Do not pre-set cScale*: Mermaid darkens provided cScale values.
	expect(mapped.cScale2).toBeUndefined();
	expect(mapped.cScaleLabel2).toBe(DEFAULT_MERMAID_RENDER_OPTIONS.fg);
	expect(mapped.fillType2).toMatch(/^#/);
});

test('applyOfficialMermaidSectionContrast injects light section overrides', () => {
	const svg = applyOfficialMermaidSectionContrast(
		'<svg><g class="section-2"><rect/><text>2020</text></g></svg>',
		DEFAULT_MERMAID_RENDER_OPTIONS,
	);

	expect(svg).toContain('data-marp-extended-mermaid-contrast="1"');
	expect(svg).toContain('.section-2 rect');
	expect(svg).toContain(`fill: ${DEFAULT_MERMAID_RENDER_OPTIONS.fg} !important`);
	// Section 2 should get the third fill (#dde8fb at index 2), not an off-by-one.
	expect(svg).toContain('.section-2 rect, .section-2 path, .section-2 circle, .section-2 polygon { fill: #dde8fb !important; }');
	// Sections must start at 0; no invalid .section--1 selector.
	expect(svg).not.toContain('section--1');
	expect(svg).toContain('.section-0 rect');
});

test('unsupported fences delegate to the existing fence renderer', async () => {
	const html = await render('```typescript\nconst value = 1;\n```\n');

	expect(html).toContain('class="language-typescript"');
	expect(html).toContain('value');
	expect(html).not.toContain('mermaid-diagram-container');
});

test('alt text and container class are escaped in generated HTML', async () => {
	const html = await render('```mermaid[<Diagram & flow>]\nflowchart LR\n  A --> B\n```\n', {
		containerClass: 'diagram-wrapper',
	});

	expect(html).toContain('<figure class="diagram-wrapper mermaid-diagram mermaid-diagram-svg"');
	expect(html).toContain('<figcaption>&lt;Diagram &amp; flow&gt;</figcaption>');
});

test('mermaid fence title can be supplied as a bracket attribute', async () => {
	const html = await render('```mermaid[title="Kami Mermaid" theme=kami]\nflowchart LR\n  A --> B\n```\n');

	expect(html).toContain('<figcaption>Kami Mermaid</figcaption>');
});

test('legacy mermaid captions can contain equals signs', async () => {
	const html = await render('```mermaid[A = B flow]\nflowchart LR\n  A --> B\n```\n');

	expect(html).toContain('<figcaption>A = B flow</figcaption>');
});

test('export preprocessing replaces mermaid fences with inline figures', async () => {
	const markdown = '# Slide\n\n```mermaid[Flow]\nflowchart LR\n  A --> B\n```\n';
	const processed = await renderMermaidFences(markdown);

	expect(processed).toContain('# Slide');
	expect(processed).toContain('data-mermaid-renderer="beautiful-mermaid"');
	expect(processed).toContain('<svg');
	expect(processed).toContain('<figcaption>Flow</figcaption>');
	expect(processed).not.toContain('```mermaid');
});

test('mermaid figure rendering reuses cached SVG output', async () => {
	const renderMermaidSVGMock = renderMermaidSVG as jest.MockedFunction<typeof renderMermaidSVG>;
	renderMermaidSVGMock.mockClear();
	const markdown = '# Slide\n\n```mermaid[Cached]\nflowchart LR\n  CacheA --> CacheB\n```\n';

	const firstRender = await renderMermaidFences(markdown);
	const secondRender = await renderMermaidFences(markdown);

	expect(firstRender).toBe(secondRender);
	expect(renderMermaidSVGMock).toHaveBeenCalledTimes(1);
});

test('fence plugin rewrites mermaid fences to native marp_mermaid tokens with data-marp-mermaid', () => {
	const renderMermaidSVGMock = renderMermaidSVG as jest.MockedFunction<typeof renderMermaidSVG>;
	renderMermaidSVGMock.mockClear();
	const marp = new Marp({ html: true }).use(mermaidFencePlugin);

	const { html } = marp.render('```mermaid\nflowchart LR\n  TokenA --> TokenB\n```');

	expect(html).toContain('<svg data-marp-mermaid');
	expect(html).toContain('data-mermaid-renderer="beautiful-mermaid"');
	expect(html).not.toContain('language-mermaid');
});

test('theme pack injects the native mermaid default CSS', () => {
	const marp = new Marp({ html: true }).use(mermaidFencePlugin);

	const { css } = marp.render('```mermaid\nflowchart LR\n  A --> B\n```');

	expect(css).toContain(':where(svg[data-marp-mermaid])');
});

test('interactive fence keyword is forwarded to beautiful-mermaid render options', () => {
	const renderMermaidSVGMock = renderMermaidSVG as jest.MockedFunction<typeof renderMermaidSVG>;
	renderMermaidSVGMock.mockClear();
	const marp = new Marp({ html: true }).use(mermaidFencePlugin);

	marp.render('```mermaid interactive\nflowchart LR\n  A --> B\n```');
	expect(renderMermaidSVGMock.mock.calls[0]?.[1]?.interactive).toBe(true);

	renderMermaidSVGMock.mockClear();
	marp.render('```mermaid\nflowchart LR\n  A --> B\n```');
	// Native semantics always pass a boolean; no keyword means non-interactive.
	expect(renderMermaidSVGMock.mock.calls[0]?.[1]?.interactive).toBe(false);
});
