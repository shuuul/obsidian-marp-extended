import { expect, test } from '@jest/globals';
import { parseMermaidRenderOptionsFromCss } from '@/utilities/mermaidTheme';

test('parseMermaidRenderOptionsFromCss reads svg CSS variables', () => {
	const css = `
section .mermaid-diagram-container.mermaid-diagram svg {
  --bg: #f5f4ed;
  --fg: #141413;
  --line: #504e49;
  --accent: #1B365D;
  --muted: #6b6a64;
  --surface: #faf9f5;
  --border: #e8e6dc;
}
`;
	expect(parseMermaidRenderOptionsFromCss(css)).toEqual({
		bg: '#f5f4ed',
		fg: '#141413',
		line: '#504e49',
		accent: '#1B365D',
		muted: '#6b6a64',
		surface: '#faf9f5',
		border: '#e8e6dc',
	});
});

test('parseMermaidRenderOptionsFromCss returns empty object for blank css', () => {
	expect(parseMermaidRenderOptionsFromCss('')).toEqual({});
});

test('parseMermaidRenderOptionsFromCss prefers concrete --marp-mermaid-* over --bg aliases', () => {
	const css = `
section .mermaid-diagram-container.mermaid-diagram svg {
  --bg: #f5f4ed;
  --fg: #141413;
  --marp-mermaid-background: #fff8e7;
  --marp-mermaid-foreground: #111111;
}
`;

	expect(parseMermaidRenderOptionsFromCss(css)).toEqual({
		bg: '#fff8e7',
		fg: '#111111',
	});
});

test('parseMermaidRenderOptionsFromCss does not treat --marp-mermaid-border as --border', () => {
	const css = `
section svg {
  --marp-mermaid-border: var(--border);
  --border: #e8e6dc;
}
`;

	expect(parseMermaidRenderOptionsFromCss(css)).toEqual({
		border: '#e8e6dc',
	});
});

test('parseMermaidRenderOptionsFromCss skips var() native aliases and keeps --bg hex', () => {
	const css = `
section .mermaid-diagram-container.mermaid-diagram svg {
  --bg: #f5f4ed;
  --fg: #141413;
  --marp-mermaid-background: var(--bg);
  --marp-mermaid-foreground: var(--fg);
}
`;

	expect(parseMermaidRenderOptionsFromCss(css)).toEqual({
		bg: '#f5f4ed',
		fg: '#141413',
	});
});
