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

## Start here

1. Read `references/syntax.md` when you need Marp / Marpit Markdown syntax, directives, image syntax, themes, math, transitions, or examples.
2. Read `references/plugin-adapter.md` before advising on behavior inside this plugin: Obsidian wiki-links, custom themes, markdown-it plugins, export options, Chrome requirements, and local-file handling differ from generic Marp CLI docs.
3. Read `references/SOURCES.md` when you need upstream links or want to refresh the downloaded reference bundle.
4. Run `scripts/update-references.py` from the repo root to refresh `references/upstream/` from official sources.

## Authoring rules for this plugin

- Put `marp: true` in YAML frontmatter when creating decks for editor integrations, even though the core renderer can process Marp syntax without it.
- Split slides with a horizontal rule (`---`, `___`, `***`, or `- - -`). Do not confuse the closing frontmatter `---` with a slide separator.
- Prefer Marp directives over raw HTML/CSS where possible. Raw HTML may be restricted by Marp Core and this plugin's `EnableHTML` setting.
- Use Obsidian image wiki-links freely for images: `![[diagram.png]]` and `![[diagram.png|Alt text]]` are converted by this plugin for preview/export. Non-image wiki-links are not converted by the plugin's image converter.
- For predictable export, keep local images and theme CSS inside the vault. The plugin invokes Marp CLI with `--allow-local-files` for export.
- Use built-in theme names (`default`, `gaia`, `uncover`) or custom CSS themes registered in the vault/plugin theme set. Custom theme CSS must include `/* @theme name */`.
- For math-heavy slides, declare the math engine explicitly in frontmatter, matching the plugin setting default (`mathjax` unless changed): `math: mathjax` or `math: katex`.
- For diagrams, this plugin can enable markdown-it plugins for Kroki, mark, and containers via its custom engine config. If a diagram does not render, check `EnableMarkdownItPlugins` first.

## Common deck skeleton

```markdown
---
marp: true
theme: default
size: 16:9
paginate: true
math: mathjax
---

# Title

<!-- _class: lead -->

---

## Image from Obsidian vault

![[attachments/example.png|Example image]]

---

## Presenter notes

Main slide content.

<!--
These notes can be exported into PDF notes when using the plugin's PDF with notes export.
-->
```

## Update references

Refresh official docs snapshots after Marp / Marpit / Marp CLI upgrades:

```bash
python3 skills/obsidian-marp/scripts/update-references.py
```

The script only updates generated upstream snapshots and source indexes. Keep the hand-written plugin adaptation notes in `references/plugin-adapter.md` aligned with this repository's code.
