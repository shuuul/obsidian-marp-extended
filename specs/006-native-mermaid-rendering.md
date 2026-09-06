---
id: "006"
title: "Native Marp Core 5 Mermaid rendering with fork enhancements"
status: Active
created: 2026-09-06
updated: 2026-09-06
coordinator: "Droid"
---

# 006 — Native Marp Core 5 Mermaid rendering with fork enhancements

## Context

Marp Core 5 ships a first-class Mermaid integration (`@marp-team/marp-core/plugins/mermaid`,
backed by the same `beautiful-mermaid` package this fork uses). Verified behavior:

- `new Marp(...)` does **not** mount the plugin by default; a default render leaves
  ` ```mermaid ` fences as plain code blocks. The plugin must be `.use()`d explicitly.
- The plugin rewrites `mermaid` fences to `marp_mermaid` tokens, renders
  `<p><svg data-marp-mermaid></p>` via `beautifulMermaid` with colors wired to
  `--marp-mermaid-*` / `--marp-shiki-*` CSS variables, injects default CSS through
  `themeSetPackOptions`, honors an `interactive` fence keyword, and falls back to the
  raw code block on render failure.
- This fork's `mermaidFencePlugin` (from the pre-Core-5 era, kept by spec 002) wraps
  `renderer.rules.fence` itself, renders through `renderMermaidAutoFitSVG`
  (`@marp-extended/mermaid-autofit`), and emits
  `<figure class="mermaid-diagram-container ..."><svg><figcaption></figure>`.
  It consumes every mermaid fence, so Core's plugin code is tree-shaken out of both
  bundles while the fork's copy of `beautiful-mermaid` + `elkjs` (~1.5 MiB) remains.

Both paths share the same rendering kernel. The fork layer is an enhancement wrapper
(zigzag autofit, figure/figcaption, theme RenderOptions, editor widgets), not a rival
implementation. Aligning the fence semantics with Core 5 native keeps future upstream
behavior while preserving the enhancements.

## Goal and success criteria

Preview and export slide rendering use Core 5 native Mermaid fence semantics
(token rewriting, `data-marp-mermaid` output, CSS-variable theming, `interactive`
keyword, native CSS injection) while keeping fork enhancements: mermaid-autofit,
figure/figcaption output, existing theme CSS compatibility, and the editor widget path.

- [ ] ` ```mermaid ` fences in preview and export render through the native
  `marp_mermaid` token type with `data-marp-mermaid` on the SVG.
- [ ] `interactive` fence keyword is honored end to end.
- [ ] Zigzag autofit still applies to linear LR/TD chains when `MERMAID_AUTO_FIT` is on.
- [ ] Packaged themes (kami.css) and user custom CSS targeting
  `.mermaid-diagram-container` keep working, or a documented migration is provided.
- [ ] Editor Live-Preview Mermaid widgets (zoom controls, theme injection) unchanged.
- [ ] `npm test -- --runInBand` passes with updated Mermaid plugin tests.

## Scope and non-goals

In scope:

- Rewrite the fork's Mermaid fence plugin as a Core-5-native fork: same token
  rewriting and CSS-variable defaults as `plugins/mermaid`, with the renderer step
  swapped for `renderMermaidAutoFitSVG` plus figure/figcaption wrapping.
- Theme CSS/docs compatibility pass (`docs/custom-css.md`, `assets/mermaid-themes/*`,
  settings tab placeholder text) for the retained figure structure.
- Updating unit tests that assert the old fence-wrapper behavior.

Not in scope:

- Editor widget rendering path (`src/editor/mermaidEditorExtension.ts`,
  `src/utilities/mermaid.ts` render entry) beyond what the shared plugin requires.
- Bundle-size work (tracked separately in spec 007).
- Removing `beautiful-mermaid`/`elkjs` from the bundle (autofit depends on them).

## Decisions

| Date | Decision | Rationale | Affected workstreams |
| --- | --- | --- | --- |
| 2026-09-06 | Fork the native plugin instead of wrapping `renderer.rules.fence` | Same kernel (`beautiful-mermaid`); native token semantics, CSS variables, `interactive`, and default-CSS injection come free; upstream improvements track automatically | WS-01 |
| 2026-09-06 | Keep figure/figcaption output and existing theme class names | Packaged/user theme CSS targets `.mermaid-diagram-container`; migration is optional follow-up, not a blocker | WS-01, WS-02 |

## Workstreams

| ID | Deliverable | Owner | Status | Dependencies | Verification |
| --- | --- | --- | --- | --- | --- |
| WS-01 | Native-forked Mermaid fence plugin with autofit + figure output | Unassigned | Pending | None | Unit tests: fence rewrite, `interactive`, autofit on/off, error fallback |
| WS-02 | Theme CSS + docs compatibility pass | Unassigned | Pending | WS-01 | `docs/custom-css.md` matches output; packaged themes render in preview smoke test |
| WS-03 | Test suite update and manual preview/export smoke | Unassigned | Pending | WS-01 | `npm test -- --runInBand`; `npm run build`; `npm run obsidian:reload` |

## Verification

- `npm run typecheck && npm run lint`
- `npm test -- --runInBand`
- `npm run build` (production smoke includes `verifyStandaloneEngine`)
- `npm run obsidian:reload` plus manual check: preview a deck with `mermaidTheme`
  frontmatter, a linear LR chain (autofit), an `interactive` fence, and an unsupported
  diagram type (fallback path).
- `npm run check:specs` before closeout.

## Documentation sync

- Durable product/developer docs: `docs/custom-css.md`, `docs/marp-extended-syntax.md` (if syntax notes change), `README.md` (Mermaid feature notes)
- Nearest local `AGENTS.md`: update architecture notes if `src/runtime/mermaidFallback.ts` semantics change
- Parent/package guidance: `packages/mermaid-autofit` README if integration contract changes
- Root guidance and roadmap: root `AGENTS.md` gotchas entry on preview/export parity

### Experiment refs

- None yet.

## Progress and handoff

### 2026-09-06 — Droid/investigation — WS-01

- Changed: none (investigation only).
- Evidence: verified native plugin is opt-in, default `Marp` renders raw code blocks;
  native plugin source (`lib/mermaid-CZN3nxd2.mjs`) uses `beautifulMermaid` with CSS
  variables; fork bundle contains its own `beautiful-mermaid` copy (native code tree-shaken).
- Remaining: WS-01..WS-03.
- Blockers: none.
- Next action: implement WS-01.

## Completion summary

Not yet complete.
