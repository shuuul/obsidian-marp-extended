# AGENTS.md

## Project overview

This is **Marp Extended**, an Obsidian community plugin forked from `obsidian-marp-slides`. It previews, presents, and exports Marp-based Markdown slide decks inside Obsidian.

The fork is being renamed from upstream **Marp Slides** to **Marp Extended**. Prefer changes that preserve current slide/export behavior while making fork metadata and maintenance workflows explicit.

Current plugin ID: `marp-extended`.

## Repo structure

```text
src/main.ts                    # Obsidian plugin entry point, commands, settings UI, preview sync
src/views/marpPreviewView.ts   # Custom ItemView for rendered slide preview
src/utilities/settings.ts      # Settings interface and defaults
src/utilities/filePath.ts      # Vault/resource path resolution and image wiki-link conversion
src/utilities/marpExport.ts    # Marp CLI export orchestration
src/utilities/libs.ts          # Downloads/extracts optional markdown-it plugin assets
src/utilities/icons.ts         # SVG icons registered with Obsidian
src/config/marp.config.js      # Marp CLI engine config for markdown-it plugins
tests/                         # Jest tests and Obsidian mocks
vault/                         # Sample vault notes and theme references
manifest.json                  # Obsidian plugin metadata
styles.css                     # Plugin CSS
esbuild.config.mjs             # Build/watch configuration
CHANGELOG.md                   # Release notes
```

## Commands

Run focused checks before reporting completion:

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
```

For release/build-output changes, also run:

```bash
npm run build
```

Useful commands:

| Task | Command |
| --- | --- |
| Install dependencies | `npm install` |
| Development watch build | `npm run dev` |
| Production build | `npm run build` |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Auto-fix lint | `npm run lint:fix` |
| Test | `npm test` |
| Test coverage | `npm run test:coverage` |
| Single test file | `npm run test -- --runInBand tests/unit/filePath.test.ts` |
| Bundle analysis | `npm run analyze:bundle` |
| Reload local Obsidian dev plugin | `npm run obsidian:reload` |
| Version metadata sync | `npm run version` |

For manual Obsidian testing, set `OBSIDIAN_VAULT` in `.env.local`; `npm run dev` and `npm run build` auto-copy `main.js`, `manifest.json`, and `styles.css` into:

```text
<vault>/.obsidian/plugins/marp-extended/
```

Then reload the dev plugin with the Obsidian CLI:

```bash
npm run obsidian:reload
```

After completing code/config/style changes, refresh the local Obsidian dev plugin automatically: run `npm run build` so the updated runtime files are copied, then run `npm run obsidian:reload`. The reload script prefers `obsidian plugin:reload id=marp-extended`, uses `obsidian plugin:enable id=marp-extended filter=community` only when the plugin is installed but disabled, and then checks `obsidian dev:errors`. Do not run `plugin:enable` in parallel with a full `obsidian reload`; transient command registration during reload can report misleading “command not found” errors. If `OBSIDIAN_VAULT` is unset, the Obsidian CLI is unavailable, or Obsidian is not running, report that the reload could not be completed.

Required runtime files for a local plugin install are:

```text
main.js
manifest.json
styles.css
```

`npm run analyze:bundle` writes `metafile.json` for the esbuild analyzer. Remove it after ad-hoc analysis unless a task explicitly asks to keep it.

## Release flow

The GitHub Actions workflow uses Release Please on pushes to `main`.

- Config: `release-please-config.json`
- Workflow: `.github/workflows/release-please.yml`
- Changelog: `CHANGELOG.md`
- Release artifact folder/name: `marp-extended`

Release Please expects [Conventional Commit](https://www.conventionalcommits.org/) messages:

- `fix:` for patch releases
- `feat:` for minor releases
- `feat!:` / `fix!:` / other `!` prefixes for breaking major releases

The release job uploads:

- `main.js`
- `manifest.json`
- `styles.css`
- `marp-extended-<version>.zip`

## Architecture

```diagram
╭──────────╮      ╭────────────╮      ╭───────────────╮
│ Obsidian │─────▶│ src/main.ts│─────▶│ Preview view  │
╰────┬─────╯      ╰─────┬──────╯      ╰──────┬────────╯
     │                  │                    │
     │                  ▼                    ▼
     │            ╭──────────╮        ╭────────────╮
     │            │ Exporter │───────▶│ Marp Core  │
     │            ╰────┬─────╯        ╰────────────╯
     │                 │
     │                 ▼
     │            ╭──────────╮        ╭──────────╮
     ╰───────────▶│ FilePath │───────▶│ Marp CLI │
                  ╰──────────╯        ╰──────────╯
```

Preview flow: active `MarkdownView` → `MarpPreviewView.displaySlides()` → `FilePath` base path/wiki-link conversion → Marp Core render → preview pane update.

Export flow: command/action → `MarpExport.export()` → `FilePath` source/theme/lib paths → optional wiki-link conversion → Marp CLI output.

## Coding conventions

- Follow `.editorconfig`: UTF-8, LF, final newline, tabs width 4.
- Keep edits small and scoped; path/export behavior is sensitive.
- Do not hand-edit `main.js`; it is generated by `npm run build` and ignored by git.
- TypeScript uses ES modules, but this legacy plugin still permits `require()` where needed.
- Preserve user settings compatibility unless a task explicitly covers migration.
- When changing the fork name, keep `package.json`, `package-lock.json`, `manifest.json`, `versions.json`, README, release workflow artifact names, and hardcoded plugin paths consistent.

## Testing guidance

- Tests live under `tests/unit/` and use `tests/__mocks__/obsidian.ts`.
- Use `npm run test*` scripts so tests go through `scripts/run-jest.js`.
- Current coverage is focused on `FilePath`; add tests when changing path handling, wiki-link conversion, export argv construction, or frontmatter/preview sync.
- For path-related changes, consider relative and absolute Obsidian link formats plus Windows-style paths.

## Gotchas

- Export except HTML requires Chrome/Chromium/Edge or a configured `CHROME_PATH`.
- `src/utilities/libs.ts` still downloads optional markdown-it assets from the upstream `samuele-cozzi` release URL. Decide whether to move this to fork-owned release assets before publishing independent releases.
- `MarpExport.export()` writes processed Markdown to the resolved export source before invoking Marp CLI. Be careful with source-file mutation semantics.
- Preview sync uses an `EditorSuggest` subclass as a cursor listener and counts `---` separators, with a lightweight frontmatter delimiter adjustment.
- Runtime dependencies should audit clean with `npm audit --omit=dev`. Full `npm audit` may still report a dev-only `js-yaml` advisory through Jest/coverage tooling.
- `docs/` was removed. Do not re-add a user documentation site unless asked.
- Release notes live at root `CHANGELOG.md`.
