declare module 'markdown-it-container' {
	import type MarkdownIt from 'markdown-it';

	type ContainerPlugin = (md: MarkdownIt, name: string) => void;
	const plugin: ContainerPlugin;
	export default plugin;
}

declare module 'markdown-it-mark' {
	import type MarkdownIt from 'markdown-it';

	type MarkPlugin = (md: MarkdownIt) => void;
	const plugin: MarkPlugin;
	export default plugin;
}