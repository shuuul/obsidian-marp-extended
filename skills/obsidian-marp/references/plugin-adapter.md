# Marp Extended plugin adaptation notes

These notes adapt upstream Marp syntax to this repository's Obsidian plugin. Source paths are relative to the repo root.

## Plugin identity

- Display name: `Marp Extended` (`manifest.json`).
- Plugin id: `marp-extended` (`manifest.json`).
- Package name: `marp-extended` (`package.json`).
- Current version: `0.9.0` (`manifest.json`, `package.json`).
- Repository: <https://github.com/shuuul/obsidian-marp-extended>.
- Obsidian runtime files: `main.js`, `manifest.json`, `styles.css`.
- Generated `main.js` should not be edited by hand; change `src/` and run the build.
- Node.js **≥ 20.19** required for local typecheck/build (Marp Core 5).

## Runtime engines

| Surface | Engine |
| --- | --- |
| In-Obsidian preview | `@marp-team/marp-core` **5.0.0** (RC) + plugins `shiki`, `mathjax` |
| Export (npx pin) | `@marp-team/marp-cli@4.5.0` (embeds Core **^4.4.0**) |
| Export (user CLI path) | Whatever is installed; recommend ≥ 4.5.0 |

Preview wires Marp in `src/views/marpPreviewView.ts` (`createMarp`): lightweight core + `.use(shikiPlugin())` + `.use(mathjaxPlugin())` + custom `mermaidFencePlugin`. **Do not** enable Core mermaid or KaTeX plugins in this product build.

Shiki languages are a curated subset via esbuild alias of `#marp-shiki` → `src/shims/marp-shiki.cjs`.

## Settings that affect export and editor

Defined in `src/utilities/settings.ts`:

| Setting | Default | Effect |
| --- | --- | --- |
| `MARP_CLI_PATH` | `''` | Explicit Marp CLI executable path. |
| `MARP_CLI_USE_NPX` | `false` | When enabled and no path is set, run pinned `@marp-team/marp-cli@4.5.0` via npx. |
| `CHROME_PATH` | `''` | Optional browser path for PDF/PPTX export. |
| `MERMAID_EDITOR_RENDER` | `true` | Live Preview Mermaid decorations in the editor. |
| `MERMAID_EDITOR_THEME` | `kami` | Default Mermaid theme name for editor when frontmatter omits `mermaidTheme`. |

There is **no** plugin setting for math engine or HTML export template in the current settings interface. Preview math is fixed to MathJax. HTML export uses the bespoke template path in export code (see `marpExport.ts`).

## Wiki-link image conversion

Implemented in `src/utilities/filePath.ts`.

The converter transforms Obsidian image wiki-links into standard Markdown image links:

```markdown
![[image.png]]              -> ![image.png](resolved/path/image.png)
![[image.png|Alt text]]     -> ![Alt text](resolved/path/image.png)
![[image.png|600]]          -> ![w:600](resolved/path/image.png)
![[image.png|600x400]]      -> ![w:600 h:400](resolved/path/image.png)
```

Important constraints:

- Only image extensions are converted: `png`, `jpg`, `jpeg`, `gif`, `svg`, `webp`, `bmp`.
- The file is resolved with Obsidian `metadataCache.getFirstLinkpathDest(filename, sourceFile.path)`.
- Absolute Obsidian link format produces paths from the vault root.
- Relative Obsidian link format produces paths relative to the current note's folder.
- If the linked image cannot be resolved, the converter still emits a Markdown image using the wiki-link target as the path.
- Non-image wiki-links and embeds are out of scope for this converter.

## Export behavior

Implemented in `src/utilities/marpExport.ts`.

Before calling Marp CLI, the plugin:

1. Resolves a filesystem path for the source note (desktop only).
2. Collects existing theme paths from `.marp-extended/themes`.
3. Compiles Marp Extended Kami `%%marp-*%%` comment markers into Marp-compatible directives/HTML.
4. Converts image wiki-links.
5. Loads Mermaid theme CSS, parses `--bg/--fg/...` into beautiful-mermaid render options, and replaces Mermaid fences with inline SVG figures.
6. Writes a temporary export source when content was transformed.
7. Invokes Marp CLI (configured path, PATH detect, or npx pin `4.5.0`).

Typical CLI argv shape:

```text
<source.md> --allow-local-files --html [--theme-set ...] [--browser-path ...] --pdf|--pptx|--template bespoke ...
```

Security note: `--allow-local-files` is necessary for vault resources but should only be used with trusted Markdown.

## Mermaid themes

Mermaid styling is separate from Marp slide themes:

- Slide themes live under `.marp-extended/themes` and are selected with `theme`.
- Mermaid themes live under `.marp-extended/mermaid-themes` and are selected with `mermaidTheme`.
- Theme CSS sources for packaging live in `assets/themes/` and `assets/mermaid-themes/`; regenerate the TS package with `npm run sync:themes`.
- `mermaidFlat: true` injects a small post-theme override to remove the Mermaid figure background, border, shadow, and padding.
- Preview/export/editor parse Mermaid theme CSS variables (`--bg`, `--fg`, `--line`, `--accent`, `--muted`, `--surface`, `--border`) into beautiful-mermaid render options so diagram fills match the theme.

Example frontmatter for a complete deck:

```yaml
---
marp: true
theme: kami-en
mermaidTheme: kami-en
mermaidFlat: true
size: kami
paginate: true
math: mathjax
---
```

Obsidian property suggestions for `theme`, `size`, `mermaidTheme`, and `mermaidFlat` are patched by the plugin.

## Math

- Preview always constructs Marp with `math: 'mathjax'` and registers the MathJax Core plugin.
- KaTeX is **not** a dependency and is **not** registered. Frontmatter `math: katex` will not work in this plugin build.
- Prefer `math: mathjax` or omit the field.

## Code highlighting (Shiki)

- Preview uses Marp Core Shiki plugin with CSS variables `--marp-shiki-*`.
- Language coverage is a curated subset in `src/shims/marp-shiki.cjs` (not the full 200+ Marp Core pack).
- Theme authors must not rely on highlight.js `.hljs-*` classes for preview.
- Kami / Kami-en code chrome: ivory background, `1px` border, `6pt` radius, mono ~`10pt`, `width: fit-content; max-width: 100%`, optional scroll for tall blocks.

## Kami comment-marker compiler

Preview (`src/views/marpPreviewView.ts`) and export (`src/utilities/marpExport.ts`) both run `compileKamiCommentBlocks` before Marp rendering. The compiler is implemented in `src/utilities/kamiDsl.ts`:

```markdown
%%marp-slide[class=cover paginate=false footer=""]%%

%%marp-cols%%
### Left

%%marp-col%%

### Right
%%/marp-cols%%
```

- `%%marp-slide[...]%%` metadata becomes Marp spot directives such as `<!-- _class: cover -->`.
- `%%marp-lead%%`, `%%marp-sub%%`, `%%marp-meta%%`, `%%marp-co%%`, `%%marp-mc%%`, `%%marp-note%%`, and `%%marp-callout[...]%%` become Kami theme class wrappers.
- `%%marp-cols%%` and `%%marp-cards[2x2]%%` split children on hidden `%%marp-col%%` and `%%marp-card%%` marker lines.
- Nested code fences such as `mermaid[...]` are preserved inside Kami blocks and are processed later by the Mermaid renderer/export preprocessor.

## Themes in this repo

Packaged theme CSS lives under `assets/themes/` (and Mermaid themes under `assets/mermaid-themes/`); see `assets/Themes.md` for credits.

When adding or advising custom themes:

- Include `/* @theme name */`.
- Prefer vault theme files under `.marp-extended/themes` so `--theme-set` can register them.
- Keep upstream license notices in copied/modified theme CSS.
- For Kami themes, note the TsangerJinKai02 font licensing caveat from `README.md`.
- After editing `assets/themes` or `assets/mermaid-themes`, run `npm run sync:themes`.

## Export prerequisites and gotchas

- PDF, PPTX, and image export require Chrome/Chromium/Edge or a configured browser path.
- The plugin reports a friendly error when Marp CLI cannot find Chromium.
- Export is desktop-only (`Platform.isDesktop`).
- Preview (Core 5 / Shiki / MathJax v4) can differ from export (CLI 4.5 / Core 4) for code highlight and math rendering; Mermaid is largely aligned because fences are pre-rendered by the plugin.
- Obsidian preview paths may differ from Node filesystem paths. The plugin normalizes paths for Marp CLI.
