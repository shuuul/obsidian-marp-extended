# Marp Extended for Obsidian

Marp Extended is an Obsidian plugin for creating, previewing, presenting, and exporting [Marp](https://marp.app/) slide decks from Markdown notes.

> **Fork notice:** This project is a maintained fork of [Samuele Cozzi's Marp Slides for Obsidian](https://github.com/samuele-cozzi/obsidian-marp-slides). The original plugin and documentation remain the upstream foundation; this fork is being renamed and maintained as **Marp Extended**.

## Features

- Preview Marp slides inside Obsidian.
- Export slide decks as HTML, PDF, PPTX, or images through Marp CLI.
- Present slide decks from the plugin.
- Use custom Marp theme CSS from your vault.
- Convert Obsidian image wiki-links to standard Markdown image links for preview/export.
- Optional markdown-it extensions for containers, marks, and Kroki diagrams.

See also:

- [Marpit Markdown](https://marpit.marp.app/markdown)
- [Marp Core features](https://github.com/marp-team/marp-core#features)
- [Marp CLI](https://github.com/marp-team/marp-cli)

## Getting started

1. Install or build the plugin into your vault's `.obsidian/plugins/marp-extended/` directory.
2. Enable **Marp Extended** in Obsidian community plugin settings.
3. Open a Markdown note and run **Slide Preview** from the command palette or ribbon icon.
4. Use the export commands for PDF, PDF with notes, HTML, PPTX, or PNG.

> ⚠️ PDF, PPTX, and image export require Google Chrome, Chromium, or Microsoft Edge. You can set a custom browser path with the `CHROME_PATH` setting.

## Development

```bash
npm install
npm run typecheck
npm run lint
npm test -- --runInBand
npm run build
```

Useful scripts:

| Command | Description |
| --- | --- |
| `npm run dev` | Watch build for local development |
| `npm run build` | Typecheck and produce production `main.js` |
| `npm run typecheck` | Run TypeScript checks only |
| `npm run lint` | Run ESLint over `src` and `tests` |
| `npm test` | Run Jest unit tests |
| `npm run test:coverage` | Run Jest unit tests with coverage |
| `npm run analyze:bundle` | Build and emit `metafile.json` for esbuild bundle analysis |

`main.js` is generated. Edit files under `src/`, then rebuild.

Developer guidance lives in [`AGENTS.md`](AGENTS.md). Release notes live in [`CHANGELOG.md`](CHANGELOG.md).

## Security note

Runtime dependencies currently audit clean with `npm audit --omit=dev`. A full `npm audit` may still report a moderate `js-yaml` advisory through Jest/coverage tooling; do not use `npm audit fix --force` unless you intend to change the test stack.

## Upstream credits

Marp Extended builds on the original [Marp Slides for Obsidian](https://github.com/samuele-cozzi/obsidian-marp-slides) plugin by Samuele Cozzi.

Many thanks to:

- [Obsidian plugin development docs](https://marcus.se.net/obsidian-plugin-docs/)
- [Marp for VS Code](https://github.com/marp-team/marp-vscode)
- [Obsidian API](https://github.com/obsidianmd/obsidian-api)
