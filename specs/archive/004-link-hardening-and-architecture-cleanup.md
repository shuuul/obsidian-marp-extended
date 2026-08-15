---
id: "004"
title: "Link hardening and architecture cleanup"
status: Completed
created: 2026-08-15
updated: 2026-08-15
coordinator: "Droid"
---

# 004 — Link hardening and architecture cleanup

## Context

Review of `0.10.0-beta.1..HEAD` (preview link handling + note wiki-link navigation)
found four confirmed defects, and an architecture survey found five duplicated
implementations plus per-render/per-export redundancy. Confirmed defects:

- [P1] `marpPreviewView.openInternalPreviewLink` passes full linktext (incl.
  `#heading`/`#^block`) to `getFirstLinkpathDest`, which expects a plain linkpath;
  subpath links misreport "note not found".
- [P2] `wikiLinks.mapOutsideCodeFences` protects only fenced blocks; inline code
  spans and indented code containing `[[...]]` get converted, corrupting code samples.
- [P3] `buildObsidianOpenHref` leaves `(`/`)` unescaped in the Markdown link
  destination; note names with unbalanced parens produce truncated/unrendered links.
- [P3] Fence closing ignores fence length/info-string rules; a ```` fence is closed
  early by a ``` line, exposing fenced content to conversion.

Architecture targets: unify fence scanning (5 divergent copies), merge Mermaid
dual-stack constants/parsers, merge ThemeManager/MermaidThemeManager twins, reduce
per-edit preview re-render cost (double event trigger, theme CSS re-read, Marp
instance rebuild), cache CLI version checks, differential default-theme writes, and
consolidate MarpPreviewView lifecycle state.

## Goal and success criteria

- [x] All four review findings fixed with regression tests.
- [x] `src/utilities/codeFenceScanner.ts` (coordinator-owned, already landed with
  tests) adopted by wikiLinks, marpExtendedDsl, previewSync, mermaid, and the
  mermaid editor extension; no behavior drift on `~~~`/indented/long fences.
- [x] Mermaid supported-types/default-options/fence-info parsing live in one shared
  module used by both `mermaid.ts` and `runtime/mermaidFallback.ts`.
- [x] ThemeManager and MermaidThemeManager share a generic base; default theme
  install writes only when content differs.
- [x] Preview pipeline: single debounced trigger per edit, cached theme CSS with
  explicit invalidation, reused Marp engine instance; MarpPreviewView lifecycle
  resources managed through one session/dispose abstraction.
- [x] Export path caches the CLI version check within a settings snapshot.
- [x] `npm run typecheck`, `npm run lint`, `npm run check:specs`, and
  `npm test -- --runInBand` all pass; `npm run build` succeeds.

## Scope and non-goals

In scope:

- The four review fixes and optimizations O1–O7 from the 2026-08-15 review.
- Regression tests for changed behavior; CHANGELOG/README sync.

Not in scope:

- Rewriting the revision/commit-queue render discipline (verified good).
- Engine artifact, esbuild dual-bundle, or release workflow changes.
- Pixel-level preview/export parity work.

## Decisions

| Date | Decision | Rationale | Affected workstreams |
| --- | --- | --- | --- |
| 2026-08-15 | Coordinator lands `codeFenceScanner.ts` before parallel work | Shared contract prevents two workstreams writing the same module | WS-01, WS-02 |
| 2026-08-15 | Scanner semantics follow `previewSync.ts` (length-aware closing, ≤3 leading spaces) | Most CommonMark-correct existing copy; fixes wikiLinks drift | WS-01, WS-02 |
| 2026-08-15 | O6 differential theme write folded into WS-03 | Same `ensureDefaultThemes` methods being refactored; avoids file conflicts | WS-03 |
| 2026-08-15 | Theme CSS cache invalidated via `refreshActivePreview` callers (settings tab + post-install) | Settings tab already routes all theme mutations through it; no settings-tab ownership needed by WS-04 | WS-04 |

## Workstreams

| ID | Deliverable | Owner | Status | Dependencies | Verification |
| --- | --- | --- | --- | --- | --- |
| WS-01 | wikiLinks fixes (inline code, parens, fence length) + scanner adoption in wikiLinks/marpExtendedDsl/previewSync | worker | Done | codeFenceScanner | wikiLinks/marpExtendedDsl/previewSync/codeFenceScanner tests |
| WS-02 | Mermaid shared constants/parser module + scanner adoption in mermaid.ts and mermaidEditorExtension.ts | worker | Done | codeFenceScanner | mermaidPlugin/mermaidEditorExtension tests |
| WS-03 | Generic theme manager base + thin Theme/MermaidTheme managers + settings-tab UI dedupe + differential default-theme writes | worker | Done | None | themeManager/themePropertyOptions tests |
| WS-04 | P1 subpath fix + preview pipeline caching/debounce + MarpPreviewView session lifecycle | worker | Done | None | marpPreviewView tests |
| WS-05 | Marp CLI version-check cache keyed by settings snapshot | worker | Done | None | marpExport tests |

## Verification

- `npm run typecheck`
- `npm run lint`
- `npm run check:specs`
- `npm test -- --runInBand`
- `npm run build`
- Manual: preview a deck with `[[Note#heading|alias]]`, inline `` `[[x]]` `` code,
  and a ```` fenced sample; click links in the preview sidebar.

## Documentation sync

- Durable product/developer docs: README wiki-link section (inline code protection),
  CHANGELOG Unreleased entries.
- Nearest local `AGENTS.md`: root AGENTS.md repo structure if new modules are added.

## Progress and handoff

### 2026-08-15 — Droid/coordinator — setup

- Changed: landed `src/utilities/codeFenceScanner.ts` + 8 unit tests (all pass);
  created this spec from the 2026-08-15 review findings.
- Evidence: `npm test -- --runInBand tests/unit/codeFenceScanner.test.ts` 8/8 pass.
- Remaining: WS-01..WS-05 execution, integration, doc sync.
- Blockers: none.
- Next action: dispatch parallel workers.

### 2026-08-15 — worker — WS-01

- Changed: wikiLinks adopted `mapOutsideCodeFences` + `mapOutsideInlineCode`
  (inline-code fix), angle-bracket Markdown destinations (parens fix), scanner-based
  fence closing (length fix); scanner adopted in marpExtendedDsl and previewSync;
  regression tests added.
- Evidence: focused suites 45/45; typecheck/lint clean (2 pre-existing warnings).
- Coordinator follow-up: updated unowned `tests/unit/marpMarkdown.test.ts`
  expectation to the angle-bracket form.

### 2026-08-15 — worker — WS-02

- Changed: new `src/runtime/mermaidShared.ts` (supported types union was already
  identical — 9 types; default render options; fence-info parsing); mermaid.ts and
  mermaidFallback.ts import from it; scanner adopted in `renderMermaidFences` and
  the editor extension; `~~~`/long-fence regression tests.
- Evidence: 5 suites 33/33; typecheck/lint clean; `npm run build` passed including
  the CLI engine bundle.

### 2026-08-15 — worker — WS-03

- Changed: new `src/utilities/vaultThemeManager.ts` generic base; ThemeManager
  (260→42 lines) and MermaidThemeManager (275→68 lines) are thin subclasses with
  unchanged public APIs; settings tab merged into parameterized
  `displayThemeSection`/`renderThemeList`/`AddVaultThemeModal` preserving all copy
  and the Marp-only preview refresh; `ensureDefaultThemes({overwrite:true})` now
  skips byte-identical writes. Note: returned `installed` now lists only themes
  actually written (no production caller consumes it).
- Evidence: theme suites 28/28 incl. 3 differential-write regressions; full suite
  205 passed at handoff.

### 2026-08-15 — worker — WS-04

- Changed: `openInternalPreviewLink` resolves via `parseLinktext(linkpath).path`
  and opens the full linktext (P1 fix; mock gained additive `parseLinktext`);
  100 ms trailing debounce coalesces `modify` + `metadataCache changed` per file
  (cursor sync untouched); view caches theme CSS + Marp engine with
  `invalidatePreviewCaches()` wired to `refreshActivePreview`/`onOpen`;
  `PreviewSessionResources` owns detach callbacks, rAF handles, and the
  ResizeObserver; revision/commit-queue logic untouched.
- Evidence: marpPreviewView suite 13/13 incl. subpath and cache-invalidation
  regressions; full suite 207 passed. Note: no main.ts harness exists, so the
  debounce has no dedicated test.

### 2026-08-15 — worker — WS-05

- Changed: module-level CLI version-check cache keyed by trimmed `MARP_CLI_PATH` +
  `MARP_CLI_USE_NPX`; caches the selected invocation (primary vs npx); errors are
  deliberately not cached; test-only reset helper added.
- Evidence: marpExport suites 27/27 incl. cache reuse/path-change/error-repeat
  regressions; typecheck/lint clean.

### 2026-08-15 — Droid/coordinator — integration

- Changed: fixed `tests/unit/marpMarkdown.test.ts` expectation; synced
  CHANGELOG (fixes/perf/refactors), README (inline-code + subpath behavior), and
  root AGENTS.md repo structure (codeFenceScanner, vaultThemeManager,
  mermaidShared, wikiLinks, previewLinks, theme managers).
- Evidence: integration verification recorded under Verification.

## Completion summary

All five workstreams completed on 2026-08-15 with no scope deviations. The four
review findings are fixed with regression tests (subpath navigation via
`parseLinktext`, inline-code protection via `mapOutsideInlineCode`,
angle-bracket link destinations, length-aware fence closing). Deduplication
landed as planned: `codeFenceScanner` is now the single fence/inline-code
scanner for five former copies; `runtime/mermaidShared` owns the Mermaid
constants and fence-info parsing for both stacks; `VaultThemeManager` is the
shared theme-manager base with differential default-theme writes and a unified
settings-tab UI. Preview renders now coalesce duplicate edit triggers (100 ms
debounce), reuse cached theme CSS and the Marp engine behind
`invalidatePreviewCaches()`, and manage iframe listeners/rAF/observer through
`PreviewSessionResources`; export caches the CLI version check per settings
snapshot (errors deliberately uncached).

Verification: typecheck clean; lint 0 errors / 2 pre-existing warnings;
`npm run check:specs` passed; `npm test -- --runInBand` 207 passed / 1 skipped
(pre-existing); `npm run build` succeeded and `npm run obsidian:reload`
reloaded the dev plugin (only a transient ResizeObserver notice in
dev:errors). Recommended but not executed: manual smoke pass clicking
`[[Note#heading|alias]]` and external links in a live preview.

Documentation sync: CHANGELOG Unreleased (bug fixes / performance /
refactoring entries), README note wiki-link section (subpaths + inline code),
root AGENTS.md repo structure (three new modules + previously undocumented
link utilities and theme managers).

Deviation notes: `ensureDefaultThemes` return value now lists only themes
actually written (no production caller consumes it); the main.ts debounce has
no dedicated unit test because no main.ts harness exists.
