# Marp Extended for Obsidian

Marp Extended is an Obsidian plugin for creating, previewing, presenting, and exporting [Marp](https://marp.app/) slide decks from Markdown notes.

> **Fork notice:** This project is a maintained fork of [Samuele Cozzi's Marp Slides for Obsidian](https://github.com/samuele-cozzi/obsidian-marp-slides). The original plugin and documentation remain the upstream foundation; this fork is being renamed and maintained as **Marp Extended**.

![Marp Extended preview and export example](assets/marp-extended-example.png)

## Features

- Preview Marp slides inside Obsidian.
- Export slide decks as HTML, PDF, PPTX, or images through Marp CLI.
- Present slide decks from the plugin.
- Use bundled Marp theme CSS installed into `.marp-extended/themes/` on first load, plus custom theme CSS from your vault.
- Add custom Marp themes by pasting CSS in plugin settings.
- Convert Obsidian image wiki-links to standard Markdown image links for preview/export.
- Optional markdown-it extensions for containers, marks, and Kroki diagrams.

See also:

- [Marpit Markdown](https://marpit.marp.app/markdown)
- [Marp Core features](https://github.com/marp-team/marp-core#features)
- [Marp CLI](https://github.com/marp-team/marp-cli)

## Getting started

1. Install or build the plugin into your vault's `.obsidian/plugins/marp-extended/` directory.
2. Enable **Marp Extended** in Obsidian community plugin settings.
3. On first load, Marp Extended downloads the default theme catalog from GitHub into `.marp-extended/themes/`.
4. Open a Markdown note and run **Slide Preview** from the command palette or ribbon icon.
5. Use the export commands for PDF, PDF with notes, HTML, PPTX, or PNG.

> ⚠️ PDF, PPTX, and image export require Google Chrome, Chromium, or Microsoft Edge. You can set a custom browser path with the `CHROME_PATH` setting.

## Development

```bash
npm install
npm run typecheck
npm run lint
npm test -- --runInBand
npm run build
```

For live Obsidian testing, copy `.env.local.example` to `.env.local` and set `OBSIDIAN_VAULT` to your vault path. `npm run dev` and `npm run build` will then auto-copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/marp-extended/`. Reload and enable with the Obsidian CLI:

```bash
obsidian reload
obsidian plugin:enable id=marp-extended
obsidian dev:errors
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

Runtime dependencies audit clean with `npm audit --omit=dev`. A full `npm audit` currently reports a dev-only moderate `js-yaml` advisory through Istanbul/Jest coverage tooling (`@istanbuljs/load-nyc-config` → `babel-plugin-istanbul` → Jest/ts-jest). `npm audit fix --force` would make breaking test-stack changes, so avoid it unless you are intentionally updating that tooling.

## Upstream credits

Marp Extended builds on the original [Marp Slides for Obsidian](https://github.com/samuele-cozzi/obsidian-marp-slides) plugin by Samuele Cozzi.

Bundled default themes include CSS from [matsubara0507/marp-themes](https://github.com/matsubara0507/marp-themes), [kaisugi/marp-theme-academic](https://github.com/kaisugi/marp-theme-academic), [dracula/marp](https://github.com/dracula/marp), and [tw93/Kami](https://github.com/tw93/Kami), plus Marp Extended sample themes. These upstream projects are MIT-licensed; keep their notices when redistributing modified theme CSS. Kami's Chinese theme references TsangerJinKai02 fonts, whose commercial usage may require a separate font license.

Many thanks to:

- [Obsidian plugin development docs](https://marcus.se.net/obsidian-plugin-docs/)
- [Marp for VS Code](https://github.com/marp-team/marp-vscode)
- [Obsidian API](https://github.com/obsidianmd/obsidian-api)
