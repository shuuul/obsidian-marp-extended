/**
 * Curated Shiki language loaders for Marp Core's `#marp-shiki` internal.
 *
 * Marp Core ships loaders for 200+ languages. Obsidian/Pivi reading view uses
 * Prism (broad set); slide decks only need a practical subset. Keep this list
 * aligned with common Prism fence tags used in notes and technical slides,
 * weighted by grammar size — large cold grammars (cpp family, TS/JS family)
 * stay, small cold grammars are dropped and degrade to plain code blocks.
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
	html: () => require('shiki/langs/html.mjs').default,
	css: () => require('shiki/langs/css.mjs').default,
	scss: () => require('shiki/langs/scss.mjs').default,
	xml: () => require('shiki/langs/xml.mjs').default,
	svg: () => require('shiki/langs/xml.mjs').default,

	// data
	json: () => require('shiki/langs/json.mjs').default,
	jsonc: () => require('shiki/langs/jsonc.mjs').default,
	yaml: () => require('shiki/langs/yaml.mjs').default,
	toml: () => require('shiki/langs/toml.mjs').default,
	ini: () => require('shiki/langs/ini.mjs').default,

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

	// systems / app
	c: () => require('shiki/langs/c.mjs').default,
	cpp: () => require('shiki/langs/cpp.mjs').default,
	csharp: () => require('shiki/langs/csharp.mjs').default,
	java: () => require('shiki/langs/java.mjs').default,
	kotlin: () => require('shiki/langs/kotlin.mjs').default,
	go: () => require('shiki/langs/go.mjs').default,
	rust: () => require('shiki/langs/rust.mjs').default,

	// infra / query
	sql: () => require('shiki/langs/sql.mjs').default,
	graphql: () => require('shiki/langs/graphql.mjs').default,
	proto: () => require('shiki/langs/proto.mjs').default,
	docker: () => require('shiki/langs/docker.mjs').default,
	make: () => require('shiki/langs/make.mjs').default,
	terraform: () => require('shiki/langs/terraform.mjs').default,
	diff: () => require('shiki/langs/diff.mjs').default,
	log: () => require('shiki/langs/log.mjs').default,

	// math / docs
	latex: () => require('shiki/langs/latex.mjs').default,
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
