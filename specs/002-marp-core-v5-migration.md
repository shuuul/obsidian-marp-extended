---
id: "002"
title: "Marp Core v5 migration and dependency refresh"
status: Draft
created: 2026-08-08
updated: 2026-08-08
coordinator: "amp"
---

# 002 — Marp Core v5 migration and dependency refresh

## Context

Marp Extended preview still uses `@marp-team/marp-core` **4.4.0** (`package.json`
`^4.3.1`). Upstream published Core **5.0.0** as a GitHub prerelease / npm `next` tag
(2026-08-07). There is no traditional `rc` dist-tag; RC is `next` → `5.0.0`.

Export uses external / npx Marp CLI, currently pinned at
`marpExtended.npxMarpCliPackage = @marp-team/marp-cli@4.4.1`. CLI **4.5.0** is latest
and still depends on Core `^4.4.0` (no CLI v5 yet).

Core v5 breaks the all-in-one entry: default `@marp-team/marp-core` is lightweight;
math, syntax highlight, and mermaid move to optional plugins + peer deps. Highlighter
moves highlight.js → Shiki (`.hljs-*` theme rules stop applying). MathJax becomes v4.

This plugin already has a deep custom Mermaid stack (`src/utilities/mermaid.ts`,
`mermaidTheme.ts`, theme manager, editor decorations, `mermaidTheme` /
`mermaidFlat` frontmatter). Core’s mermaid plugin only wraps beautiful-mermaid with
`--marp-mermaid-*` CSS variables and does **not** preserve our figure DOM, official
Mermaid fallback, or theme files.

Verified baseline (2026-08-08):

| Piece | Current |
| --- | --- |
| Plugin | `marp-extended` `0.9.0` |
| Preview | `@marp-team/marp-core` installed **4.4.0** |
| Export npx pin | `@marp-team/marp-cli@4.4.1` |
| Mermaid | custom + `beautiful-mermaid@^1.1.3` |
| Math | `new Marp({ math: 'mathjax' })` in `MarpPreviewView.createMarp()` |
| Browser helper | `@marp-team/marp-core/browser`, `script: false` |
| Sample hljs themes | e.g. `vault/themes/olive.css`, `dracula.css` |

Preview path:

```text
MarkdownView → compileMarkdownForMarp → Marp.render → iframe / browser polyfill
```

Export path:

```text
command → compileMarkdownForMarp → temp .md → child_process marp-cli
  → pdf | pdf-with-notes | pptx | html(bespoke) | preview
```

Upstream: [marp-core v5.0.0](https://github.com/marp-team/marp-core/releases/tag/v5.0.0),
[migration-v5.md](https://github.com/marp-team/marp-core/blob/v5.0.0/docs/migration-v5.md).

## Goal and success criteria

Outcome: preview runs on Marp Core **5.0.0**; export npx pin is CLI **4.5.0**; all
direct runtime/dev dependency floors are current stable; custom Mermaid theming is
unchanged for users.

- [ ] `package.json` pins `@marp-team/marp-core` to exact `5.0.0` and adds Core peer
  deps (`shiki`, `katex`, `@mathjax/src`, four mathjax font extensions); `beautiful-mermaid`
  remains a direct dependency.
- [ ] `marpExtended.npxMarpCliPackage` is `@marp-team/marp-cli@4.5.0`; README and
  settings copy no longer mention `4.4.1`.
- [ ] Direct devDependency caret floors match latest stable per Decisions table
  (dual TypeScript aliases preserved).
- [ ] `MarpPreviewView.createMarp()` uses lightweight core + `.use(shiki)`,
  `.use(mathjax)`, `.use(katex)`, then custom `mermaidFencePlugin` — **no** Core
  mermaid plugin.
- [ ] Bundled/sample slide themes that embedded `.hljs-*` use `--marp-shiki-*` variables.
- [ ] Mermaid user API unchanged: `mermaidTheme`, `mermaidFlat`, theme files under
  `.marp-extended/mermaid-themes/`, editor mermaid render.
- [ ] `npm run typecheck && npm run lint && npm test -- --runInBand && npm run build`
  pass; `npm run check:specs` passes; `npm audit --omit=dev` clean or documented.
- [ ] Manual Obsidian smoke: Kami mermaid themes, math, code fences, export HTML/PDF
  with npx 4.5.0 when fallback enabled.

## Scope and non-goals

In scope:

- Core 5 preview wiring (curated plugins).
- CLI npx pin 4.5.0 + user-facing version strings.
- Full direct dependency refresh (runtime + dev) within safe major policy.
- Shiki theme CSS migration for bundled/sample themes.
- Bundle/esbuild resolve fixes required by new entrypoints.
- README / CHANGELOG / skills upstream refresh notes for engine versions and skew.
- Automated + manual verification listed above.

Not in scope:

- Enabling `@marp-team/marp-core/plugins/mermaid`.
- Rewriting Mermaid themes to `--marp-mermaid-*` (follow-up).
- Waiting for Marp CLI v5 / Core-5-tracking CLI.
- In-process PDF/PPTX without CLI.
- Collapsing dual TypeScript package aliases.
- Taking tooling canary/next tags.
- Re-adding a full user documentation site under `docs/` (existing `docs/custom-css.md`
  and `docs/kami-dsl.md` may gain a short note only if needed).

## Decisions

| Date | Decision | Rationale | Affected workstreams |
| --- | --- | --- | --- |
| 2026-08-08 | Curated plugins, not `/full` | Avoid Core mermaid; clearer ownership; smaller than full 11.4MiB path | WS-02 |
| 2026-08-08 | Keep custom Mermaid (option A) | Theme DOM, frontmatter, BM+official fallback, editor must stay | WS-02, WS-04 |
| 2026-08-08 | Never register Core mermaid while custom is active | Double fence handlers / DOM mismatch | WS-02 |
| 2026-08-08 | Math default remains MathJax; load KaTeX plugin too | Preserve current default; allow `math: katex` directive | WS-02 |
| 2026-08-08 | Pin Core exact `5.0.0` while RC | Reproducible builds; `latest` is still 4.4.0 | WS-01 |
| 2026-08-08 | Require CLI npx pin **4.5.0** in this migration | User-requested; PDF fixes/boot improvements without Core 5 on export | WS-01, WS-05 |
| 2026-08-08 | Refresh all direct deps to latest stable floors | User-requested; reduce drift | WS-01 |
| 2026-08-08 | Accept preview Core5 / export Core4 skew | CLI has no Core 5 yet; mermaid pre-render aligns both paths | WS-05, WS-06 |
| 2026-08-08 | Tracked specs live in `specs/`, not `docs/superpowers` | init-repo tracked spec system | WS-00 (done) |

### Runtime dependency targets (npm snapshot 2026-08-08)

```json
"dependencies": {
  "@marp-team/marp-core": "5.0.0",
  "@mathjax/mathjax-bbm-font-extension": "^4.1.3",
  "@mathjax/mathjax-bboldx-font-extension": "^4.1.3",
  "@mathjax/mathjax-dsfont-font-extension": "^4.1.3",
  "@mathjax/mathjax-mhchem-font-extension": "^4.1.3",
  "@mathjax/src": "^4.1.3",
  "beautiful-mermaid": "^1.1.3",
  "katex": "^0.18.2",
  "shiki": "^4.4.2"
},
"marpExtended": {
  "npxMarpCliPackage": "@marp-team/marp-cli@4.5.0"
}
```

Core v5 optional plugins (complete list): `shiki`, `mermaid`, `katex`, `mathjax`.
We enable shiki + mathjax + katex only.

### DevDependency floor bumps

Bump caret floors to installed/latest stable: `@codemirror/view ^6.43.8`,
`@types/node ^26.2.0`, `@typescript-eslint/*` and `typescript-eslint ^8.66.0`,
`eslint ^10.8.1`, `globals ^17.9.0`, `ts-jest ^29.4.12`. Leave already-current
packages and dual TS aliases (`typescript` → `@typescript/typescript6@^6.0.2`,
`typescript-native` → `typescript@^7.0.2`) unchanged in policy.

### Preview construction shape

```ts
import { Marp } from '@marp-team/marp-core'
import shikiPlugin from '@marp-team/marp-core/plugins/shiki'
import mathjaxPlugin from '@marp-team/marp-core/plugins/mathjax'
import katexPlugin from '@marp-team/marp-core/plugins/katex'
import { mermaidFencePlugin } from '../utilities/mermaid'

new Marp({
  container: { tag: 'div', id: '__marp-vscode' },
  slideContainer: { tag: 'div', 'data-marp-vscode-slide-wrapper': '' },
  html: true,
  inlineSVG: { enabled: true, backdropSelector: false },
  math: 'mathjax',
  minifyCSS: true,
  script: false,
})
  .use(shikiPlugin())
  .use(mathjaxPlugin())
  .use(katexPlugin())
  .use(mermaidFencePlugin)
```

### Export engine skew (accepted)

| Surface | Engine |
| --- | --- |
| Preview | Marp Core **5.0.0** |
| npx export | Marp CLI **4.5.0** + Core **^4.4.0** |
| User global CLI | Recommend ≥ 4.5.0 in docs |

Mermaid stays aligned because we pre-render fences before both preview and CLI.

### Shiki theme migration

Replace bundled/sample `.hljs-*` rules with `--marp-shiki-*` on `section` (see upstream
theme-authoring). Do not auto-rewrite user-installed themes; document in CHANGELOG.

### Mermaid themes (no change)

Keep selectors `section .mermaid-diagram-container.mermaid-diagram`, CSS vars
`--bg/--fg/--line/--accent/--muted/--surface/--border`, `mermaidFlat`, default theme
install path.

## Workstreams

| ID | Deliverable | Owner | Status | Dependencies | Verification |
| --- | --- | --- | --- | --- | --- |
| WS-00 | Tracked specs system + superpowers removal | amp | Done | None | `npm run check:specs`; no `docs/superpowers` |
| WS-01 | package.json/lock: Core 5 + peers + CLI 4.5.0 + dev floors | Unassigned | Pending | WS-00 | `npm install`; `npm outdated` policy; lock committed |
| WS-02 | `createMarp` curated plugins + browser helper | Unassigned | Pending | WS-01 | typecheck; preview boots |
| WS-03 | esbuild/bundle resolve for new entrypoints | Unassigned | Pending | WS-01 | `npm run build`; optional `analyze:bundle` |
| WS-04 | Slide theme CSS hljs → shiki vars | Unassigned | Pending | WS-02 | sample themes render code colors |
| WS-05 | README/settings/CHANGELOG copy for CLI 4.5.0 + Core 5 + skew | Unassigned | Pending | WS-01 | grep no stale `4.4.1` pin strings |
| WS-06 | Unit/manual verification + skills upstream refresh | Unassigned | Pending | WS-02–WS-05 | commands in Verification |

## Verification

Automated:

```bash
npm run check:specs
npm run typecheck
npm run lint
npm test -- --runInBand
npm run build
npm audit --omit=dev
# ad-hoc:
npm run analyze:bundle   # delete metafile.json after
```

Manual (desktop Obsidian, `OBSIDIAN_VAULT` set):

1. `vault/samples/Kami.md` / `Kami.en.md` — `mermaidTheme` + `mermaidFlat` apply.
2. MathJax deck renders in preview.
3. Fenced code shows Shiki colors (no empty/broken chrome).
4. Mermaid types beyond BM still fall back to official Mermaid.
5. Export HTML + PDF succeed; mermaid figures present.
6. npx fallback without `MARP_CLI_PATH` uses `@marp-team/marp-cli@4.5.0`.
7. Settings copy mentions 4.5.0; Test CLI works.
8. Editor mermaid live render respects theme settings/frontmatter.

Success = all Goal checkboxes true; no Core mermaid plugin registration in `src/`.

Rollback: restore Core `^4.3.1`, CLI pin `4.4.1`, previous lockfile, single
`import { Marp } from '@marp-team/marp-core'` without plugin imports.

## Documentation sync

- Durable product/developer docs: `README.md`, `CHANGELOG.md`; optional short notes in
  `docs/custom-css.md` if theme author guidance needs Shiki vars.
- Nearest local `AGENTS.md`: root `AGENTS.md` (commands, structure, Marp version notes).
- Parent/package guidance: None.
- Root guidance and roadmap: root `AGENTS.md`; this spec until archived.
- Skills: refresh `skills/obsidian-marp/references/upstream` via
  `python3 skills/obsidian-marp/scripts/update-references.py` after implementation.

### Experiment refs

None yet.

## Progress and handoff

### 2026-08-08 — amp — WS-00

- Changed: Removed `docs/superpowers/` and `.gitignore` superpowers entries. Added
  `specs/` (template, README, archive `001`, active `002`), `scripts/check-specs.mjs`,
  `tests/unit/scripts/checkSpecs.test.ts`, `npm run check:specs`, CI verify workflow,
  AGENTS guidance.
- Evidence: tree under `specs/`; validator tests.
- Remaining: WS-01 through WS-06 implementation of Core 5 migration.
- Blockers: None.
- Next action: Claim WS-01 and land dependency refresh + CLI pin.

## Completion summary

(Incomplete — fill before archive.)
