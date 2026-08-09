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
src/utilities/mermaid.ts       # Mermaid fence rendering for preview/export
src/utilities/icons.ts         # SVG icons registered with Obsidian
specs/                         # Tracked execution specs (Draft/Active) + archive/
scripts/check-specs.mjs        # Spec tree validator
tests/                         # Jest tests and Obsidian mocks
assets/themes/                 # Packaged slide theme CSS sources
assets/mermaid-themes/         # Packaged Mermaid theme CSS sources
docs/                          # Optional user-facing notes (not a full docs site)
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
npm run check:specs
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
| Tracked specs validator | `npm run check:specs` |
| Sync packaged theme CSS | `npm run sync:themes` |
| Test | `npm test` |
| Test coverage | `npm run test:coverage` |
| Single test file | `npm run test -- --runInBand tests/unit/filePath.test.ts` |
| Spec validator tests | `npm test -- --runInBand tests/unit/scripts/checkSpecs.test.ts` |
| Bundle analysis | `npm run analyze:bundle` |
| Reload local Obsidian dev plugin | `npm run obsidian:reload` |
| Profile local Obsidian preview | `npm run obsidian:profile -- path="slides/examples/kami.md"` |
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

`npm run obsidian:profile` uses the Obsidian CLI and Chrome DevTools Protocol to capture Chrome Performance metrics and Marp Extended user-timing measures for the preview command. It temporarily enables preview profiling through `localStorage.marp-extended-profile` and accepts `path=`, `command=`, `settle=`, `delay=`, `timeout=`, `cpu=true`, and `out=` arguments. CPU profile capture is optional because CDP profiler stop can be flaky in Obsidian/Electron; when `cpu=true` succeeds, it writes a `.cpuprofile` file to the system temp directory by default. Do not commit generated `.cpuprofile` files.

## Release flow

Releases are fully automated by [Release Please](https://github.com/google-github-actions/release-please-action) on pushes to `main`. The fork no longer tracks `upstream` and maintains its own release history (tags `0.1.x` onward); stale inherited upstream tags were removed so Release Please computes versions from the fork's own latest release.

- Config: `release-please-config.json`
- Workflow: `.github/workflows/release-please.yml`
- Changelog: `CHANGELOG.md`
- Release artifact folder/name: `marp-extended`

Release Please expects [Conventional Commit](https://www.conventionalcommits.org/) messages:

- `fix:` for patch releases
- `feat:` for minor releases
- `feat!:` / `fix!:` / other `!` prefixes for breaking major releases

Flow:

1. Push `feat:`/`fix:`/`chore:` commits to `main`. The `release-please` job runs on every push to `main` and opens (or updates) a single release PR collecting unreleased Conventional Commits. `chore:` commits do not trigger a release.
2. Merge the release PR. Release Please tags the merge commit (no `v` prefix), creates the GitHub release, and bumps `package.json`, `manifest.json` (`$.version` via `extra-files`), and `CHANGELOG.md`.
3. The `release-plugin` job then runs (`release_created == 'true'`): it syncs `versions.json` via `npm run version`, commits that to `main`, builds with `npm run build`, and uploads the release assets.

Uploaded release assets:

- `main.js`
- `manifest.json`
- `styles.css`
- `marp-extended-<version>.zip`

Do not create tags or GitHub releases manually; let Release Please own them. `versions.json` is synced by the `release-plugin` job right after the release is created, so it lands on `main` moments after the tag.

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

## Runtime requirements

- Node.js **≥ 20.19** for local typecheck/build (Marp Core 5).
- Desktop Obsidian for export (Marp CLI + browser).

## Coding conventions

- Follow `.editorconfig`: UTF-8, LF, final newline, tabs width 4.
- Keep edits small and scoped; path/export behavior is sensitive.
- Do not hand-edit `main.js`; it is generated by `npm run build` and ignored by git.
- TypeScript uses ES modules, but this legacy plugin still permits `require()` where needed.
- Preserve user settings compatibility unless a task explicitly covers migration.
- When changing the fork name, keep `package.json`, `package-lock.json`, `manifest.json`, `versions.json`, README, release workflow artifact names, and hardcoded plugin paths consistent.

## Tracked specs

Long-running or multi-workstream work uses the tracked spec system under `specs/`
(init-repo contract). Specs are execution records; durable behavior still lands in
code, tests, `README.md`, `CHANGELOG.md`, optional `docs/*` notes, and this file.

| Status | Location | Meaning |
| --- | --- | --- |
| `Draft` | `specs/` | Scope/decisions not complete |
| `Active` | `specs/` | Execution contract ready |
| `Completed` | `specs/archive/` | Acceptance + doc sync done |

Rules:

- Copy `specs/000-template.md` → `specs/NNN-kebab-case.md`. IDs are permanent and continuous from `001` across active + archive.
- Coordinator owns frontmatter, index row in `specs/README.md`, cross-workstream decisions, and closeout.
- Claim a workstream before editing; append Progress and handoff entries.
- Before archive: satisfy success criteria, sync durable docs/AGENTS, set `status: Completed`, move file + index row together, run `npm run check:specs`.
- Do not store execution specs under `docs/superpowers` or any superpowers layout. That path is retired.

See `specs/README.md` for the full lifecycle.

## Testing guidance

- Tests live under `tests/unit/` and use `tests/__mocks__/obsidian.ts`.
- Use `npm run test*` scripts so tests go through `scripts/run-jest.js`.
- Current coverage is focused on `FilePath` and the specs validator; add tests when changing path handling, wiki-link conversion, export argv construction, frontmatter/preview sync, or `scripts/check-specs.mjs`.
- For path-related changes, consider relative and absolute Obsidian link formats plus Windows-style paths.

## Gotchas

- Export except HTML requires Chrome/Chromium/Edge or a configured `CHROME_PATH`.
- `MarpExport.export()` writes processed Markdown to the resolved export source before invoking Marp CLI. Be careful with source-file mutation semantics.
- Preview sync uses an `EditorSuggest` subclass as a cursor listener and counts `---` separators, with a lightweight frontmatter delimiter adjustment.
- Runtime dependencies should audit clean with `npm audit --omit=dev`. Full `npm audit` may still report a dev-only `js-yaml` advisory through Jest/coverage tooling.
- Keep `docs/` limited to short user-facing notes (`custom-css.md`, `kami-dsl.md`). Do not re-add a full documentation site or a `docs/superpowers` tree unless explicitly requested.
- Release notes live at root `CHANGELOG.md`.
- Tracked specs live only under `specs/` (and `specs/archive/`).
