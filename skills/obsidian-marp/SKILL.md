---
name: obsidian-marp
description: "Helps agents write, preview, debug, and export Marp / Marpit slide Markdown for the Marp Extended Obsidian plugin. Use when the user mentions Obsidian Marp, Marp Extended, slide syntax, directives, themes, wiki-link images, math, diagrams, or Marp export behavior."
license: MIT
compatibility: "Project-local Agent Skill for Marp Extended / Obsidian; reference updater needs Python 3.11+, network access, curl, and optionally npx defuddle."
metadata:
  sources: "Marp, Marpit, Marp Core, Marp CLI, and this plugin's source tree"
---

# Obsidian Marp

Use this skill to help agents author Marp slide decks that work in **Marp Extended**, this repository's Obsidian plugin (`manifest.json` id: `marp-extended`).

Current project metadata: **Marp Extended** `0.9.0`, plugin/package id
`marp-extended`, repository <https://github.com/shuuul/obsidian-marp-extended>.

Runtime stack (2026-08):

- **Preview:** `@marp-team/marp-core` `5.0.0` (RC / npm `next`) with curated plugins **Shiki** + **MathJax** only. Custom Mermaid stack (not Core mermaid plugin).
- **Export:** external Marp CLI or npx pin `@marp-team/marp-cli@4.5.0` (CLI still embeds Core **4.4.x**). Preview and export engines can differ until CLI tracks Core 5.
- **Math:** MathJax only in this plugin build. Do **not** recommend `math: katex` for Marp Extended preview.
- **Code highlight:** Shiki with a **curated language subset** (`src/shims/marp-shiki.cjs`). Theme colors via `--marp-shiki-*`, not `.hljs-*`.
- **Themes:** packaged sources under `assets/themes/` and `assets/mermaid-themes/`; installed to vault `.marp-extended/themes/` and `.marp-extended/mermaid-themes/`.

## Start here

1. Read `references/syntax.md` for Marp / Marpit Markdown syntax, directives, image syntax, themes, math, transitions, or examples.
2. Read `references/plugin-adapter.md` before advising on behavior inside this plugin: Obsidian wiki-links, custom themes, Mermaid, export options, Chrome requirements, and local-file handling differ from generic Marp CLI docs.
3. Read `references/SOURCES.md` for upstream links or to refresh the downloaded reference bundle.
4. Run `scripts/update-references.py` from the repo root to refresh `references/upstream/` from official sources.

## Authoring rules for this plugin

- Put `marp: true` in YAML frontmatter when creating decks for editor integrations.
- Split slides with a horizontal rule (`---`, `___`, `***`, or `- - -`). Do not confuse the closing frontmatter `---` with a slide separator.
- Prefer deck frontmatter plus Marp Extended Kami `%%marp-*%%` comment-marker blocks over raw HTML/CSS where possible.
- Use Kami `%%marp-*%%` comment-marker blocks for Obsidian-friendly authoring: `%%marp-slide[...]%%`, `%%marp-lead%%`, `%%marp-sub%%`, `%%marp-meta%%`, `%%marp-co%%`, `%%marp-mc%%`, `%%marp-note%%`, `%%marp-callout[...]%%`, `%%marp-cols%%`, and `%%marp-cards[2x2]%%`. Split `cols` / `cards` items with hidden `%%marp-col%%` / `%%marp-card%%` marker lines.
- Use Obsidian image wiki-links for images: `![[diagram.png]]`, `![[diagram.png|Alt text]]`, `![[diagram.png|600]]`, and `![[diagram.png|600x400]]`. Size aliases become Marp image directives such as `![w:600]` and `![w:600 h:400]`.
- For predictable export, keep local images and theme CSS inside the vault. Export uses Marp CLI with `--allow-local-files`.
- Use built-in theme names (`default`, `gaia`, `uncover`) or custom CSS themes with `/* @theme name */`. Packaged themes include `kami`, `kami-en`, `github`, `beamer`, `olive`, `dracula`.
- For math, use `math: mathjax` (or omit; MathJax is the plugin default). **KaTeX is not bundled** in Marp Extended preview.
- For diagrams, Mermaid fences render as inline SVG via `beautiful-mermaid` (with official Mermaid fallback for unsupported diagram types). Style with `mermaidTheme` / `mermaidFlat`.
- For code fences, prefer languages in the curated Shiki subset (e.g. `python`, `ts`/`typescript`, `rust`, `js`, `json`, `yaml`, `bash`/`shellscript`, `go`, `sql`). Unsupported languages fall back to plain text.
- Theme authors: style syntax highlighting with `--marp-shiki-*` on `section`. Kami code blocks use ivory fill, soft border, mono ~10pt, `width: fit-content; max-width: 100%`.
- Keep example frontmatter explicit: include `marp`, `theme`, `mermaidTheme`, `mermaidFlat`, `size`, and `paginate`.

## Common deck skeleton

````markdown
---
marp: true
theme: kami-en
mermaidTheme: kami-en
mermaidFlat: true
size: kami
paginate: true
math: mathjax
---

# Title

%%marp-slide[class=lead]%%

---

## Image from Obsidian vault

![[attachments/example.png|Example image]]

---

## Code (Shiki)

```ts
const ok: boolean = true;
```

---

## Presenter notes

Main slide content.

<!--
These notes can be exported into PDF notes when using the plugin's PDF with notes export.
-->
````

## Update references

Refresh official docs snapshots after Marp / Marpit / Marp CLI upgrades:

```bash
python3 skills/obsidian-marp/scripts/update-references.py
```

The script only updates generated upstream snapshots and source indexes. Keep the hand-written plugin adaptation notes in `references/plugin-adapter.md` aligned with this repository's code.
