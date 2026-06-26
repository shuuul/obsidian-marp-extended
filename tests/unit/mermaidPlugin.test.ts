import { expect, test } from '@jest/globals';
import { renderMermaidSVG } from 'beautiful-mermaid';

import { markdownItMermaid, renderMermaidFences } from '@/markdown-it/mermaid';

const MarkdownIt = require('markdown-it');

function render(markdown: string, options = {}): string {
	const md = new MarkdownIt();
	md.use(markdownItMermaid, options);

	return md.render(markdown);
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

	expect(html).toContain('<pre><code class="language-typescript">');
	expect(html).toContain('const value = 1;');
	expect(html).not.toContain('mermaid-diagram-container');
});

test('alt text and container class are escaped in generated HTML', () => {
	const html = render('```mermaid[<Diagram & flow>]\nflowchart LR\n  A --> B\n```\n', {
		containerClass: 'diagram-wrapper',
	});

	expect(html).toContain('<figure class="diagram-wrapper mermaid-diagram mermaid-diagram-svg"');
	expect(html).toContain('<figcaption>&lt;Diagram &amp; flow&gt;</figcaption>');
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
