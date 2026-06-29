# Changelog

## Unreleased

- Changed export to call an external Marp CLI executable instead of bundling `@marp-team/marp-cli` into `main.js`; settings now support explicit path input, auto-detection, and an optional pinned npx fallback.
- Removed the unsupported release ZIP asset from the community release workflow and added provenance attestations for `main.js`, `manifest.json`, and `styles.css`.
- Removed external URLs from packaged theme CSS and replaced plugin `:has()` styling with explicit classes for review compatibility.
- Limited default Marp and Mermaid theme installation to `kami`, `kami-en`, `github`, `beamer`, `olive`, and `dracula` while keeping the other vault CSS files as non-default examples.
- Embedded those default Marp and Mermaid theme CSS files in the plugin bundle so first-run install and restore-default actions no longer fetch CSS from GitHub.
- Removed separate default CSS sync markers; managed defaults are overwritten from the packaged CSS on startup.
- Updated theme settings so bundled defaults are managed/read-only in the UI, can be forked, and custom themes can be edited.
- Fixed review-listed unsafe TypeScript patterns in Mermaid cache eviction, export error handling, and theme property suggestions.
- Removed the legacy markdown-it container/mark extensions, downloaded Marp engine files, and `lib3` runtime artifact.

## [0.7.0](https://github.com/shuuul/obsidian-marp-extended/compare/0.6.0...0.7.0) (2026-06-29)


### Features

* **export:** use external Marp CLI and packaged themes ([48334d1](https://github.com/shuuul/obsidian-marp-extended/commit/48334d1525c73af5f5fc9de481aa66d3a5bb4a05))
* **settings:** simplify Marp options and detect browsers ([ba95712](https://github.com/shuuul/obsidian-marp-extended/commit/ba95712266dfe164c0655de735bd17655d006403))

## [0.6.0](https://github.com/shuuul/obsidian-marp-extended/compare/0.5.0...0.6.0) (2026-06-27)


### Features

* **kami:** add fenced block DSL ([a7c51df](https://github.com/shuuul/obsidian-marp-extended/commit/a7c51dfcfd905771c46a932f931b07710960457a))

## 0.5.0

- Migrated slide preview to sandboxed iframe rendering using ESM `markdown-it-container` and `markdown-it-mark` plugins.
- Restricted Marp CLI export and optional markdown-it lib loading to desktop Obsidian via `Platform.isDesktop` guards.
- Replaced direct `node:path`/`node:fs` imports with lazy CommonJS `require` for mobile-safe bundling.
- Bumped minimum Obsidian version to 1.7.2 and kept the plugin desktop-only.
- Modernized the ESLint toolchain with `eslint-plugin-obsidianmd` and `typescript-eslint`.
- Cleaned up the preview zoom lifecycle, removed dead debug logging, and fixed unsafe type casts.

## 0.4.0

- Added themed Mermaid diagram rendering as inline SVG for preview/export, including `mermaidTheme` and `mermaidFlat` support.
- Added default theme update controls for bundled Marp and Mermaid themes.
- Added the Kami portfolio slide size and refreshed the README example image.
- Improved preview performance by reducing refresh overhead and caching Mermaid render output plus remote theme assets.
- Fixed preview slide sync after render updates.
- Fixed default theme refresh cache busting and Kami blockquote styling.
- Fixed Kami portfolio PDF/PPTX/HTML exports and removed the PNG export option.
- Added Obsidian plugin reload tooling for local development.
- Updated project, vault, CSS, and Obsidian Marp skill documentation for the current Marp Extended release flow and syntax behavior.

## 0.3.0

- Added Obsidian image wiki-link conversion for Marp preview/export, including alt text, image size directives, URL-encoded paths, and unresolved-link fallback.
- Added installed Marp theme suggestions for the frontmatter theme property.
- Added Marp slide size preset suggestions for theme/frontmatter editing.
- Added an Obsidian Marp syntax skill for development guidance.

## 0.2.0

- Added fit-width Marp preview zoom controls with step zoom, pinch zoom, and zoom state preservation across preview rerenders.
- Added real Marp CLI export coverage for sample deck exports with managed themes across PDF, PDF notes, PPTX, PNG, and HTML outputs.

## 0.1.1

- Fixed Obsidian sidebar and command export actions so failures and output paths are visible in Notices.
- Fixed export path resolution by using Obsidian adapter filesystem paths instead of `app://` resource URLs for Marp CLI.
- Fixed markdown-it engine loading inside Obsidian's renderer by forcing Marp CLI to resolve local engine files through CommonJS during export.
- Fixed PNG export argument construction to produce a single selected output file.
- Updated bundled Kami themes to use pixel-based Marp slide sizes for browser image/PPTX export compatibility.
- Updated fork-owned theme download URLs to `shuuul/obsidian-marp-extended`.
- Added a README screenshot and clarified the dev-only audit note.

## 0.1.0

- Initial Marp Extended fork baseline.
- Renamed plugin metadata from Marp Slides to Marp Extended.
- Refreshed dependencies and build/test maintenance scripts.
- Removed user-facing docs site content; retained developer notes only.
