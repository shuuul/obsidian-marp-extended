import { jest } from '@jest/globals';

export type RenderOptions = Record<string, string | number | boolean>;

export const renderMermaidSVG = jest.fn((_source: string, options: RenderOptions = {}): string => {
	return `<svg style="--accent:${options.accent ?? ''};--line:${options.line ?? ''}"><text>mock diagram</text></svg>`;
});
