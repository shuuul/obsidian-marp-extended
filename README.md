# Marp Extended for Obsidian

Marp Extended is an Obsidian plugin for creating, previewing, presenting, and exporting [Marp](https://marp.app/) slide decks from Markdown notes.

> **Project lineage:** Marp Extended originated from [Samuele Cozzi's Marp Slides for Obsidian](https://github.com/samuele-cozzi/obsidian-marp-slides) and is now maintained as an independent plugin project. Upstream credits are preserved below.

![Marp Extended preview and export example](assets/marp-extended-example.png)

## Project status

| Field | Value |
| --- | --- |
| Plugin name | Marp Extended |
| Plugin/package ID | `marp-extended` |
| Current version | `0.6.0` |
| Repository | <https://github.com/shuuul/obsidian-marp-extended> |

## Features

- Preview Marp slides inside Obsidian.
- Export slide decks as HTML, PDF, or PPTX through a user-installed Marp CLI.
- Present slide decks from the plugin.
- Use bundled Marp theme CSS installed into `.marp-extended/themes/` on first load, plus custom theme CSS from your vault.
- Add custom Marp themes by pasting CSS in plugin settings.
- Convert Obsidian image wiki-links to standard Markdown image links for preview/export.
- Built-in Mermaid diagrams rendered with `beautiful-mermaid`.
- Kami DSL fenced blocks for Obsidian-friendly slide metadata, lead text, callouts, columns, and 2×2 cards.

## Markdown compatibility

Marp Extended renders slides with Marp, so notes should primarily use Marp-compatible Markdown. Obsidian image embeds are supported as a convenience by converting image wiki-links before preview/export.

Supported image wiki-link forms:

| Obsidian syntax | Converted Marp-compatible syntax |
| --- | --- |
| `![[image.png]]` | `![image.png](image.png)` |
| `![[image.png\|Alt text]]` | `![Alt text](image.png)` |
| `![[image.png\|600]]` | `![w:600](image.png)` |
| `![[image.png\|600x400]]` | `![w:600 h:400](image.png)` |

For example:

```md
![[Pasted image 20260625124927.png]]
![[Pasted image 20260625124927.png|Screenshot]]
![[Pasted image 20260625124927.png|600]]
![[Pasted image 20260625124927.png|600x400]]
```

These are converted to standard Markdown image links / Marp image directives. Paths are URL-encoded so spaces become `%20`:

```md
![Pasted image 20260625124927.png](Pasted%20image%2020260625124927.png)
![Screenshot](Pasted%20image%2020260625124927.png)
![w:600](Pasted%20image%2020260625124927.png)
![w:600 h:400](Pasted%20image%2020260625124927.png)
```

When possible, the plugin resolves the image through Obsidian's link resolver and emits a path Marp can read. If the image cannot be resolved, the plugin falls back to treating the wiki-link target as a path relative to the current note.

Other Obsidian-only extensions are not converted automatically. If Marp does not support an Obsidian syntax directly, write it in standard Markdown or Marp syntax.

For Kami-style decks, Marp Extended also supports a small fenced-block DSL that
compiles to Marp local directives and Kami theme HTML wrappers before
preview/export. For example, use `slide` blocks instead of Marp local directive
comments and `cols` / `cards[2x2]` blocks split with `===` for common Kami
layouts. Previewing these layout wrappers requires the plugin's **Enable HTML**
setting; export already invokes Marp CLI with HTML enabled. See
[Kami DSL](docs/kami-dsl.md) for the supported blocks and examples.

See also:

- [Marpit Markdown](https://marpit.marp.app/markdown)
- [Marp Core features](https://github.com/marp-team/marp-core#features)
- [Marp CLI](https://github.com/marp-team/marp-cli)

## Getting started

### Install with BRAT

Marp Extended can be installed from this repository with [BRAT](https://github.com/TfTHacker/obsidian42-brat):

1. Install and enable the **BRAT** plugin in Obsidian.
2. Open **BRAT** settings and choose **Add Beta plugin**.
3. Paste this repository URL: `https://github.com/shuuul/obsidian-marp-extended`.
4. Enable **Marp Extended** in Obsidian community plugin settings.

### First use

1. Install with BRAT, or build the plugin into your vault's `.obsidian/plugins/marp-extended/` directory.
2. Enable **Marp Extended** in Obsidian community plugin settings.
3. On first load, Marp Extended installs bundled, managed default theme CSS into `.marp-extended/themes/`. Fork a bundled theme in settings before editing it.
4. Open a Markdown note and run **Slide Preview** from the command palette or ribbon icon.
5. To export, install or configure Marp CLI (or enable npx fallback) and then use the export commands for PDF, PDF with notes, HTML, or PPTX.

### Local fonts for bundled themes

Bundled themes do not load font files from the network. Install the matching fonts on your operating system before opening Obsidian when you want the theme to match its upstream design; otherwise the browser uses the CSS fallback stack.

| Theme | Recommended local fonts |
| --- | --- |
| `beamer` | CMU Sans Serif, CMU Bright |
| `dracula` | IBM Plex Sans, IBM Plex Mono |
| `github` | Lato, Roboto Mono, NasuM, GenShin Gothic / 源真ゴシック |
| `kami` | TsangerJinKai02 W04, TsangerJinKai02 W05, JetBrains Mono Regular |
| `kami-en` | JetBrains Mono Regular |
| `olive` | Lato, Roboto Mono, NasuM, GenShin Gothic / 源真ゴシック |

Marp Extended does not bundle these font files. TsangerJinKai02 may require a separate license for commercial use.

### Export requirements

Preview and presentation work from the plugin bundle. Export runs an external Marp CLI command so Marp Extended does not bundle the full CLI/Puppeteer toolchain.

Install Marp CLI globally, set an explicit executable path in **Settings → Marp Extended → Marp CLI path**, or enable **Use npx fallback** to let the plugin run a pinned Marp CLI package through `npx` when no executable is found:

```bash
npm install -g @marp-team/marp-cli
marp --version
```

Use **Auto-detect** in settings to search `PATH` and common Homebrew locations such as `/opt/homebrew/bin/marp`. If `marp` is not found automatically, set **Marp CLI path** to the executable path, such as `/opt/homebrew/bin/marp` or `C:\Users\you\AppData\Roaming\npm\marp.cmd`.

The npx fallback uses `@marp-team/marp-cli@4.4.0`. It requires Node.js/npm and may download the package on first use.

> ⚠️ PDF and PPTX export require Google Chrome, Chromium, or Microsoft Edge. You can set a custom browser path with the `CHROME_PATH` setting if Marp CLI cannot auto-detect your browser.

## Development

```bash
npm install
npm run typecheck
npm run lint
npm test -- --runInBand
npm run build
```

For live Obsidian testing, copy `.env.local.example` to `.env.local` and set `OBSIDIAN_VAULT` to your vault path. `npm run dev` and `npm run build` will then auto-copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/marp-extended/`. Reload the dev plugin with the Obsidian CLI:

```bash
npm run obsidian:reload
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
| `npm run obsidian:reload` | Reload the local Obsidian dev plugin and check dev errors |
| `npm run obsidian:profile -- path="samples/Kami Agent Slides.md"` | Capture preview Chrome metrics and Marp Extended timing marks for a vault-relative note path; pass `cpu=true` for a `.cpuprofile` |

`main.js` is generated. Edit files under `src/`, then rebuild.

Developer guidance lives in [`AGENTS.md`](AGENTS.md). Release notes live in [`CHANGELOG.md`](CHANGELOG.md).

Current Marp-related runtime dependencies are `@marp-team/marp-core` `^4.3.0` and `beautiful-mermaid` `^1.1.3`. Export uses an external `@marp-team/marp-cli` executable or optional npx fallback instead of bundling Marp CLI into `main.js`.

## Security note

Runtime dependencies audit clean with `npm audit --omit=dev`. A full `npm audit` currently reports a dev-only moderate `js-yaml` advisory through Istanbul/Jest coverage tooling (`@istanbuljs/load-nyc-config` → `babel-plugin-istanbul` → Jest/ts-jest). `npm audit fix --force` would make breaking test-stack changes, so avoid it unless you are intentionally updating that tooling.

## Upstream credits

Marp Extended builds on the original [Marp Slides for Obsidian](https://github.com/samuele-cozzi/obsidian-marp-slides) plugin by Samuele Cozzi.

Bundled default themes are limited to `kami`, `kami-en`, `github`, `beamer`, `olive`, and `dracula`, with CSS from [tw93/Kami](https://github.com/tw93/Kami), [matsubara0507/marp-themes](https://github.com/matsubara0507/marp-themes), [dracula/marp](https://github.com/dracula/marp), plus the Marp Extended Beamer sample theme. These upstream projects are MIT-licensed; keep their notices when redistributing modified theme CSS. Kami's Chinese theme references TsangerJinKai02 fonts, whose commercial usage may require a separate font license.

Many thanks to:

- [Obsidian plugin development docs](https://marcus.se.net/obsidian-plugin-docs/)
- [Marp for VS Code](https://github.com/marp-team/marp-vscode)
- [Obsidian API](https://github.com/obsidianmd/obsidian-api)
