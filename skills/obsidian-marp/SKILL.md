---
name: obsidian-marp
description: "Helps agents write, preview, debug, and export Marp / Marpit slide Markdown for the Marp Extended Obsidian plugin. Use when the user mentions Obsidian Marp, Marp Extended, slide syntax, directives, themes, wiki-link images, math, diagrams, fragmented lists, backgrounds, fitting headers, Shiki, or Marp export behavior."
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
- **Slides:** Marpit Markdown (ruler split + directives + image syntax + fragmented lists) with Marp Core extras (size, emoji/Twemoji, fitting header, GFM, loose YAML, inline SVG).

## Start here

1. Read `references/syntax.md` first — Marpit base syntax, directives, images, fragments, Marp Core extras, Kami markers, and the **language style** table for this plugin.
2. Read `references/plugin-adapter.md` before advising on behavior inside this plugin: wiki-links, custom themes, Mermaid, export options, Chrome requirements, and local-file handling differ from generic Marp CLI docs.
3. Read `references/SOURCES.md` for upstream links or to refresh the downloaded reference bundle.
4. Run `scripts/update-references.py` from the repo root to refresh `references/upstream/` from official sources.

## Language style (keep decks Obsidian-readable)

Official Marpit goal: decks should still look fine in a normal Markdown editor.
Marp Extended strengthens that for Obsidian.

| Prefer | Default away from |
| --- | --- |
| YAML frontmatter for deck settings | Repeated global HTML comment directives |
| `%%marp-slide[...]%%` for spot slide metadata | Visible `<!-- _class: ... -->` when Kami markers work |
| Kami `%%marp-*%%` layout blocks | Large hand-rolled HTML trees |
| Obsidian `![[image\|600]]` wiki-links | Absolute filesystem image paths |
| `math: mathjax` / omit | `math: katex` |
| Curated Shiki fence tags + optional `{lines}` | highlight.js / `.hljs-*` theme rules |
| Marpit `![bg …]()` / filters when needed | Assuming wiki-links encode `bg`/filters (they do not) |

## Authoring rules for this plugin

- Put `marp: true` in YAML frontmatter when creating decks for editor integrations.
- Split slides with a horizontal rule (`---`, `___`, `***`, or `- - -`). Blank line before `---` when CommonMark needs it. Do not confuse the closing frontmatter `---` with a slide separator.
- Prefer `headingDivider` when converting a plain note into slides without littering rulers.
- Prefer deck frontmatter plus Marp Extended Kami `%%marp-*%%` comment-marker blocks over raw HTML/CSS where possible.
- Use Kami `%%marp-*%%` comment-marker blocks for Obsidian-friendly authoring: `%%marp-slide[...]%%`, `%%marp-lead%%`, `%%marp-sub%%`, `%%marp-meta%%`, `%%marp-co%%`, `%%marp-mc%%`, `%%marp-note%%`, `%%marp-callout[...]%%`, `%%marp-cols%%`, and `%%marp-cards[2x2]%%`. Split `cols` / `cards` items with hidden `%%marp-col%%` / `%%marp-card%%` marker lines.
- Local directives apply forward; prefix `_` for current-slide-only spot directives. `paginate` accepts `true` / `false` / `hold` / `skip`.
- Use Obsidian image wiki-links for images: `![[diagram.png]]`, `![[diagram.png|Alt text]]`, `![[diagram.png|600]]`, and `![[diagram.png|600x400]]`. Size aliases become Marp image directives such as `![w:600]` and `![w:600 h:400]`.
- For backgrounds, split layouts, and filters, use Marpit image syntax (`![bg left:40%](…)`, `![brightness:.8](…)`). Advanced multi/split backgrounds need inline SVG (enabled in this plugin).
- Fragmented lists: bullets with `*`, ordered with `1)`. Regular lists use `-`/`+` and `1.`. Fragment animation depends on the viewer (bespoke HTML export is the reliable path).
- Fitting headers (theme must support `@auto-scaling`): `# <!-- fit --> Title`.
- For predictable export, keep local images and theme CSS inside the vault. Export uses Marp CLI with `--allow-local-files`.
- Themes: Marp Core built-ins `default`, `gaia`, `uncover`, plus packaged custom `kami`. Kami default = former CN look; `lang: en` = former `kami-en` look. Add more via vault CSS with `/* @theme name */`. Kami sizes: `kami`, `portfolio`.
- For math, use `math: mathjax` (or omit; MathJax is the plugin default). **KaTeX is not bundled** in Marp Extended preview.
- For diagrams, Mermaid fences render as inline SVG via `beautiful-mermaid` (with official Mermaid fallback for unsupported diagram types). Style with `mermaidTheme` / `mermaidFlat`. Caption via ` ```mermaid[Title] `.
- For code fences, prefer languages in the curated Shiki subset (e.g. `python`, `ts`/`typescript`, `rust`, `js`, `json`, `yaml`, `bash`/`shellscript`, `go`, `sql`). Unsupported languages fall back to plain text. Line highlight: ` ```ts {1,3-4} `.
- Theme authors: style syntax highlighting with `--marp-shiki-*` on `section`. Kami code blocks use ivory fill, soft border, mono ~10pt, `width: fit-content; max-width: 100%`.
- Keep example frontmatter explicit: include `marp`, `theme`, `mermaidTheme`, `mermaidFlat`, `size`, and `paginate`.

## Common deck skeleton

````markdown
---
marp: true
theme: kami
lang: en
mermaidTheme: kami
mermaidFlat: true
size: kami
paginate: true
math: mathjax
---

# Title

%%marp-slide[class=cover paginate=false]%%

%%marp-sub%%
Subtitle for the cover
%%/marp-sub%%

%%marp-meta%%
Team · 2026
%%/marp-meta%%

---

## Image from Obsidian vault

![[attachments/example.png|Example image]]

![bg right:40%](attachments/side.png)

Content stays on the left when using split backgrounds.

---

## Fragments and code

* First point
* Second point

```ts {1,3}
const ok: boolean = true;
const skip = 0;
const also = true;
```

---

## Diagram

```mermaid[Agent loop]
flowchart LR
  P[PLAN] --> A[ACT] --> O[OBSERVE]
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

The script only updates generated upstream snapshots and source indexes. Keep the hand-written plugin adaptation notes in `references/syntax.md` and `references/plugin-adapter.md` aligned with this repository's code.
