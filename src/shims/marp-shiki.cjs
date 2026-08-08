/**
 * Curated Shiki language loaders for Marp Core's `#marp-shiki` internal.
 *
 * Marp Core ships loaders for 200+ languages. Obsidian/Pivi reading view uses
 * Prism (broad set); slide decks only need a practical subset. Keep this list
 * aligned with common Prism fence tags used in notes and technical slides.
 *
 * Must export `{ shiki }` with the same shape as
 * `@marp-team/marp-core/lib/internals/shiki.node.cjs`.
 */

const { createCssVariablesTheme, createHighlighterCoreSync } = require('shiki/core');
const { createJavaScriptRegexEngine } = require('shiki/engine/javascript');

/** @type {Record<string, () => unknown>} */
const langLoaders = {
	// plain
	// (text/txt/plain are handled as no-op langs inside marp-core shiki plugin)

	// web / notes
	markdown: () => require('shiki/langs/markdown.mjs').default,
	mdx: () => require('shiki/langs/mdx.mjs').default,
	html: () => require('shiki/langs/html.mjs').default,
	css: () => require('shiki/langs/css.mjs').default,
	scss: () => require('shiki/langs/scss.mjs').default,
	less: () => require('shiki/langs/less.mjs').default,
	xml: () => require('shiki/langs/xml.mjs').default,
	svg: () => require('shiki/langs/xml.mjs').default,

	// data
	json: () => require('shiki/langs/json.mjs').default,
	jsonc: () => require('shiki/langs/jsonc.mjs').default,
	json5: () => require('shiki/langs/json5.mjs').default,
	yaml: () => require('shiki/langs/yaml.mjs').default,
	toml: () => require('shiki/langs/toml.mjs').default,
	ini: () => require('shiki/langs/ini.mjs').default,
	csv: () => require('shiki/langs/csv.mjs').default,

	// scripting
	javascript: () => require('shiki/langs/javascript.mjs').default,
	typescript: () => require('shiki/langs/typescript.mjs').default,
	jsx: () => require('shiki/langs/jsx.mjs').default,
	tsx: () => require('shiki/langs/tsx.mjs').default,
	python: () => require('shiki/langs/python.mjs').default,
	shellscript: () => require('shiki/langs/shellscript.mjs').default,
	shellsession: () => require('shiki/langs/shellsession.mjs').default,
	powershell: () => require('shiki/langs/powershell.mjs').default,
	ruby: () => require('shiki/langs/ruby.mjs').default,
	php: () => require('shiki/langs/php.mjs').default,
	perl: () => require('shiki/langs/perl.mjs').default,
	lua: () => require('shiki/langs/lua.mjs').default,
	r: () => require('shiki/langs/r.mjs').default,

	// systems / app
	c: () => require('shiki/langs/c.mjs').default,
	cpp: () => require('shiki/langs/cpp.mjs').default,
	csharp: () => require('shiki/langs/csharp.mjs').default,
	java: () => require('shiki/langs/java.mjs').default,
	kotlin: () => require('shiki/langs/kotlin.mjs').default,
	scala: () => require('shiki/langs/scala.mjs').default,
	go: () => require('shiki/langs/go.mjs').default,
	rust: () => require('shiki/langs/rust.mjs').default,
	swift: () => require('shiki/langs/swift.mjs').default,
	'objective-c': () => require('shiki/langs/objective-c.mjs').default,

	// infra / query
	sql: () => require('shiki/langs/sql.mjs').default,
	graphql: () => require('shiki/langs/graphql.mjs').default,
	proto: () => require('shiki/langs/proto.mjs').default,
	docker: () => require('shiki/langs/docker.mjs').default,
	make: () => require('shiki/langs/make.mjs').default,
	cmake: () => require('shiki/langs/cmake.mjs').default,
	nginx: () => require('shiki/langs/nginx.mjs').default,
	terraform: () => require('shiki/langs/terraform.mjs').default,
	diff: () => require('shiki/langs/diff.mjs').default,
	log: () => require('shiki/langs/log.mjs').default,

	// frontend frameworks common in slides
	vue: () => require('shiki/langs/vue.mjs').default,
	svelte: () => require('shiki/langs/svelte.mjs').default,
	astro: () => require('shiki/langs/astro.mjs').default,

	// math / docs
	latex: () => require('shiki/langs/latex.mjs').default,
	tex: () => require('shiki/langs/tex.mjs').default,
	bibtex: () => require('shiki/langs/bibtex.mjs').default,

	// misc useful in technical decks
	wasm: () => require('shiki/langs/wasm.mjs').default,
	glsl: () => require('shiki/langs/glsl.mjs').default,
	haskell: () => require('shiki/langs/haskell.mjs').default,
	elixir: () => require('shiki/langs/elixir.mjs').default,
	erlang: () => require('shiki/langs/erlang.mjs').default,
	clojure: () => require('shiki/langs/clojure.mjs').default,
	scheme: () => require('shiki/langs/scheme.mjs').default,
	matlab: () => require('shiki/langs/matlab.mjs').default,
	julia: () => require('shiki/langs/julia.mjs').default,
	zig: () => require('shiki/langs/zig.mjs').default,
	nim: () => require('shiki/langs/nim.mjs').default,
	dart: () => require('shiki/langs/dart.mjs').default,
	solidity: () => require('shiki/langs/solidity.mjs').default,
};

let highlighter = null;

const shiki = {
	get highlighter() {
		if (!highlighter) {
			highlighter = createHighlighterCoreSync({
				themes: [
					createCssVariablesTheme({
						name: 'marp-shiki',
						variablePrefix: '--marp-shiki-',
					}),
				],
				langs: [],
				engine: createJavaScriptRegexEngine({ forgiving: true }),
			});
		}
		return highlighter;
	},
	resolveLang(id) {
		return langLoaders[id];
	},
};

module.exports = { shiki };
