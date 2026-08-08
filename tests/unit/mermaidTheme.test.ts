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
