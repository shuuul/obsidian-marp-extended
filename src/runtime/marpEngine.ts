import { Marp } from '@marp-team/marp-core';
import shikiPlugin from '@marp-team/marp-core/plugins/shiki';
import mathjaxPlugin from '@marp-team/marp-core/plugins/mathjax';
import { mermaidFencePlugin } from './mermaidFallback';

type MarpOptions = NonNullable<ConstructorParameters<typeof Marp>[0]>;
export type MarpEngineHostOptions = Omit<MarpOptions, 'html' | 'inlineSVG' | 'math' | 'minifyCSS' | 'script'>;

/** Create an isolated engine while retaining wrappers and language owned by the host. */
export function createMarpEngine(hostOptions: MarpEngineHostOptions = {}): Marp {
	return new Marp({
		...hostOptions,
		html: true,
		inlineSVG: { enabled: true, backdropSelector: false },
		math: 'mathjax',
		minifyCSS: true,
		script: false,
	})
		.use(shikiPlugin())
		.use(mathjaxPlugin())
		.use(mermaidFencePlugin);
}
