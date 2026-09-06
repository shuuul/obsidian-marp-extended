---
id: "007"
title: "main.js bundle size reduction (plan B)"
status: Completed
created: 2026-09-06
updated: 2026-09-06
coordinator: "Droid"
---

# 007 — main.js bundle size reduction (plan B)

## Context

Release 0.11.1 `main.js` is 9.75 MiB; the Obsidian plugin review bot warns it exceeds
the Obsidian Sync Standard 5 MB per-file limit. Verified composition
(`npm run analyze:bundle`, production):

| Share | Content | Reducible? |
| --- | --- | --- |
| 2.30 MiB | Embedded engine (`marp-engine.cjs` gzip-9 + base64) for Community installs | Yes — Brotli-11 measured 1.73 MiB for the same bytes |
| 3.17 MiB | Shiki language grammars (75 curated files via `src/shims/marp-shiki.cjs`) | Yes — ~32 cold-language entries ≈ 0.86 MiB |
| 1.40 MiB | `elkjs` (via `beautiful-mermaid`; required by mermaid-autofit) | No (spec 006 keeps autofit) |
| ~1.8 MiB | MathJax: `mathjax-newcm-font` 0.93 + `@mathjax/src` 0.49 + font extensions 0.39 | Partially — 3 cold font extensions ≈ 0.38 MiB |
| ~1 MiB | Marp Core, Marpit, markdown-it, plugin code | No |

Plan B (approved): Brotli embedded payload + MathJax cold-extension shim + Shiki
language trim → target ≈ 7.7 MiB with no loss beyond cold grammar/ fonts.
Removing the embedded engine (plan C, ≈ 5 MiB) is explicitly deferred.

## Goal and success criteria

`main.js` production size ≤ 7.8 MiB with:

- [x] Embedded engine payload uses Brotli; first-export materialization still passes
  SHA-256 verification and `verifyStandaloneEngine` smoke.
- [x] Shiki shim curates ~43 languages; removed grammars degrade to plain code blocks
  (no runtime errors).
- [x] MathJax output unchanged for standard TeX, `\mathbb`, `\ce`; only `\bbm`/`\mathds`
  style cold macros may error (documented).
- [x] `npm test -- --runInBand`, `npm run typecheck`, `npm run lint` pass.
- [x] Recorded before/after `analyze:bundle` numbers in this spec.

## Scope and non-goals

In scope:

- `esbuild.config.mjs`: embedded-engine plugin switch `gzipSync` → `brotliCompressSync`
  (quality 11, size hint), payload symbol rename.
- `src/runtime/engineArtifact.ts`: `gunzipSync` → `brotliDecompressSync`, error copy,
  payload type naming; matching tests.
- `src/shims/marp-shiki.cjs`: trim language loader table (keep list in WS-03).
- esbuild shim replacing `@marp-team/marp-core/lib/internals/mathjax*` so the three
  cold `@mathjax/*-font-extension` packages are no longer required (keep `mhchem`),
  with package.json dependency cleanup.
- `npm run scan:release` / release-asset impact check.

Not in scope:

- Removing the embedded engine (plan C) — future decision.
- Shrinking `elkjs`/`beautiful-mermaid` (required by mermaid-autofit, spec 006).
- Replacing the MathJax `newcm` base font or switching math engines.
- Compressing the on-disk `marp-engine.cjs` release asset (self-extracting format was
  considered; deferred — re-evaluate only if plan C is rejected).

## Decisions

| Date | Decision | Rationale | Affected workstreams |
| --- | --- | --- | --- |
| 2026-09-06 | Plan B over plan C | Keeps offline Community-install exports; 5 MB target deferred | WS-01..WS-03 |
| 2026-09-06 | Brotli over gzip for the embedded payload | 1.73 vs 2.30 MiB measured; `zlib.brotliDecompressSync` is native in Electron's Node | WS-01 |
| 2026-09-06 | Keep `mhchem`, drop `bbm`/`bboldx`/`dsfont` | Chemical equations are common in decks; the three cold fonts are niche overlap with base AMS `\mathbb` | WS-02 (pending user confirmation) |

## Workstreams

| ID | Deliverable | Owner | Status | Dependencies | Verification |
| --- | --- | --- | --- | --- | --- |
| WS-01 | Brotli embedded payload (build + runtime + tests) | Droid | Done | None | Materialization round-trip test; prod build smoke |
| WS-02 | MathJax cold font-extension shim | Droid | Done | User confirmation | A/B stub experiment: standard TeX/`\mathbb`/`\ce` unchanged; `\bbm`/`\mathds` degrade to console warning |
| WS-03 | Shiki language trim (75 → ~43) | Droid | Done | None | Highlight unit tests; removed language degrades to plain block |
| WS-04 | Bundle accounting + docs | Droid | Done | WS-01..WS-03 | 9.75 → 7.70 MiB recorded; AGENTS.md shim list updated |

## Verification

- `npm run typecheck && npm run lint && npm run check:specs`
- `npm test -- --runInBand`
- `npm run build` (runs `verifyStandaloneEngine` in production)
- `npm run analyze:bundle` before/after; delete `metafile.json` afterwards.
- `npm run scan:release` if release-asset layout is touched.

## Documentation sync

- Durable product/developer docs: `README.md` (supported highlight languages, math font note), `CHANGELOG.md` via release-please commits
- Nearest local `AGENTS.md`: bundle/embed notes if payload format changes
- Parent/package guidance: n/a
- Root guidance and roadmap: root `AGENTS.md` gotchas (embedded engine format)

### Experiment refs

- None yet.

## Progress and handoff

### 2026-09-06 — Droid/investigation — WS-01..WS-04

- Changed: none (investigation only; `!important` fix landed separately as 2f81bd7).
- Evidence: composition table above from `metafile.json`; Brotli measurement
  (1.73 MiB vs gzip 2.30 MiB for `marp-engine.cjs`).
- Remaining: WS-01..WS-04.
- Blockers: WS-02 awaits user confirmation on dropping cold font extensions.
- Next action: implement WS-01 (Brotli payload).

### 2026-09-06 — Droid/WS-01 + WS-03 — WS-01, WS-03

- Changed: `esbuild.config.mjs` (embedded payload gzip→Brotli quality 11 with size
  hint, symbol `gzipBase64`→`brotliBase64`), `src/runtime/engineArtifact.ts`
  (`brotliDecompressSync`, payload type), `src/runtime/embeddedEngine.d.ts`,
  `tests/__mocks__/embeddedEngine.ts`, `tests/unit/engineArtifact.test.ts`,
  `src/shims/marp-shiki.cjs` (67 → 37 language entries; dropped mdx, less, json5, csv,
  perl, lua, r, swift, objective-c, scala, cmake, nginx, tex, bibtex, wasm, glsl,
  haskell, elixir, erlang, clojure, scheme, matlab, julia, zig, nim, dart, solidity,
  vue, svelte, astro).
- Evidence: `npm run typecheck` clean; `tests/unit/engineArtifact.test.ts` 5/5;
  full suite 255 passed / 1 skipped (pre-existing); lint clean;
  `npm run build` production smoke passed; `npm run obsidian:reload` no errors.
  Measured sizes: `main.js` 9.75 → **8.23 MiB**, `marp-engine.cjs` 7.32 → **6.49 MiB**.
- Remaining: none.
- Blockers: none.
- Next action: archive.

### 2026-09-06 — Droid/WS-02 + WS-04 — WS-02, WS-04

- Changed: `src/shims/mathjax-cold-font-extensions.cjs` (new empty stubs),
  `esbuild.config.mjs` (`mathjaxColdFontExtensionStub` plugin wired into both engine
  and main builds), `package.json` (dropped bbm/bboldx/dsfont dependencies, mhchem kept),
  `AGENTS.md` (shim list).
- Evidence: esbuild A/B experiment with stubs — `\mathbb{R}`, `\ce{H2O}`, `\sum` render
  identically; `\bbm{R}`/`\mathds{1}` render with a missing glyph plus a console
  warning (`Invalid variant`), no throw, no HTML pollution. Final sizes:
  `main.js` **7.70 MiB** (from 9.75; goal ≤ 7.8), `marp-engine.cjs` 6.12 MiB (from 7.32).
  Lint, typecheck, full test suite (255 passed / 1 pre-existing skip), `check:specs`,
  and `obsidian:reload` all clean.
- Remaining: none — spec ready for archive.
- Blockers: none.
- Next action: move to `specs/archive/` with index row.

## Completion summary

Spec 007 delivered plan B in full. `main.js` went from 9.75 MiB to **7.70 MiB** (-21%)
with three changes: (1) the embedded engine payload switched from gzip-9 to Brotli-11
with matching runtime decompression and tests, (2) the Shiki shim was trimmed from 75
to ~43 curated grammar entries (cold languages degrade to plain code blocks), and (3)
Marp Core's three cold MathJax font extensions are stubbed at build time with mhchem
kept. No scope deviations. Durable docs updated: `AGENTS.md` shim list; README's
existing "curated subset" wording remains accurate. Plan C (removing the embedded
engine to reach the 5 MB Obsidian Sync Standard limit) remains a deferred decision,
recorded above as non-goal.
