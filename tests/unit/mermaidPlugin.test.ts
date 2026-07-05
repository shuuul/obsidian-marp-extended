import { expect, test } from '@jest/globals';
import { Marp } from '@marp-team/marp-core';
import { renderMermaidSVG } from 'beautiful-mermaid';

import { mermaidFencePlugin, renderMermaidFences } from '@/utilities/mermaid';

function render(markdown: string, options = {}): string {
	const marp = new Marp({ html: true }).use(mermaidFencePlugin, options);

	return marp.render(markdown).html;
}

test('mermaid fence renders an inline beautiful-mermaid SVG with caption', () => {
	const source = 'flowchart LR\n  A --> B\n';
	const html = render(`\`\`\`mermaid[Architecture flow]\n${source}\`\`\`\n`);

	expect(html).toContain('<figure class="mermaid-diagram-container mermaid-diagram mermaid-diagram-svg" data-mermaid-renderer="beautiful-mermaid">');
	expect(html).toContain('<svg');
	expect(html).toContain('--accent:#1B365D');
	expect(html).toContain('--line:#504e49');
	expect(html).toContain('<figcaption>Architecture flow</figcaption>');
	expect(html).not.toContain('https://kroki.io');
});

test('unsupported fences delegate to the existing fence renderer', () => {
	const html = render('```typescript\nconst value = 1;\n```\n');

	expect(html).toContain('class="language-typescript"');
	expect(html).toContain('value');
	expect(html).not.toContain('mermaid-diagram-container');
});

test('alt text and container class are escaped in generated HTML', () => {
	const html = render('```mermaid[<Diagram & flow>]\nflowchart LR\n  A --> B\n```\n', {
		containerClass: 'diagram-wrapper',
	});

	expect(html).toContain('<figure class="diagram-wrapper mermaid-diagram mermaid-diagram-svg"');
	expect(html).toContain('<figcaption>&lt;Diagram &amp; flow&gt;</figcaption>');
});

test('mermaid fence title can be supplied as a bracket attribute', () => {
	const html = render('```mermaid[title="Kami Mermaid" theme=kami]\nflowchart LR\n  A --> B\n```\n');

	expect(html).toContain('<figcaption>Kami Mermaid</figcaption>');
});

test('legacy mermaid captions can contain equals signs', () => {
	const html = render('```mermaid[A = B flow]\nflowchart LR\n  A --> B\n```\n');

	expect(html).toContain('<figcaption>A = B flow</figcaption>');
});

test('export preprocessing replaces mermaid fences with inline figures', () => {
	const markdown = '# Slide\n\n```mermaid[Flow]\nflowchart LR\n  A --> B\n```\n';
	const processed = renderMermaidFences(markdown);

	expect(processed).toContain('# Slide');
	expect(processed).toContain('data-mermaid-renderer="beautiful-mermaid"');
	expect(processed).toContain('<svg');
	expect(processed).toContain('<figcaption>Flow</figcaption>');
	expect(processed).not.toContain('```mermaid');
});

test('mermaid figure rendering reuses cached SVG output', () => {
	const renderMermaidSVGMock = renderMermaidSVG as jest.MockedFunction<typeof renderMermaidSVG>;
	renderMermaidSVGMock.mockClear();
	const markdown = '# Slide\n\n```mermaid[Cached]\nflowchart LR\n  CacheA --> CacheB\n```\n';

	const firstRender = renderMermaidFences(markdown);
	const secondRender = renderMermaidFences(markdown);

	expect(firstRender).toBe(secondRender);
	expect(renderMermaidSVGMock).toHaveBeenCalledTimes(1);
});
