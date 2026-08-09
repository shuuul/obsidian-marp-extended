---
id: "003"
title: "Marp Extended language and complete runtime"
status: Completed
created: 2026-08-09
updated: 2026-08-09
coordinator: "Amp"
---

# 003 — Marp Extended language and complete runtime

## Context

Marp Extended currently compiles a Kami-oriented `%%marp-*%%` marker DSL before
preview and export. The shared preprocessing path is sound, but its public syntax,
HTML class contract, templates, and documentation remain tied to the Kami theme.
Preview runs bundled Marp Core 5.0.0 with Shiki, MathJax, and the custom Mermaid
stack, while export delegates rendering to an external or npx Marp CLI 4.5.0.
Marpit syntax is inherited by preview, but the application does not implement
fragment stepping or expose presenter notes in its preview UI.

This spec implements the selected complete-runtime option: a theme-independent
Marp Extended authoring language, a shared preview/export engine contract,
fragment playback, and presenter notes.

## Goal and success criteria

Deliver one documented Marp Extended authoring and runtime contract that behaves
consistently in Obsidian preview and supported Marp CLI exports.

- [x] Canonical Marp Extended markers compile to stable namespaced markup and official Marpit directives.
- [x] The compiler safely handles nested markers plus CommonMark backtick/tilde fences and preserves ordinary Obsidian comments and malformed blocks without swallowing source.
- [x] Preview and the managed export path use the same pinned Marp Core major, constructor options, optional plugins, preprocessing order, and theme inputs; unsupported custom external CLI configurations are detected and documented rather than silently called equivalent.
- [x] Preview users can move backward and forward through Marpit fragments with visible state, toolbar controls, keyboard-bindable commands, and accessible status text.
- [x] Preview exposes Marpit presenter comments for the active slide in a toggleable, accessible notes panel.
- [x] Marpit conformance fixtures cover slide splitting, directives, image backgrounds, fragments, scoped styles, notes, and shared Extended compilation across preview/export boundaries.
- [x] User and developer documentation accurately describes the supported Marpit baseline, Extended syntax, runtime controls, export parity, and HTML policy.
- [x] Typecheck, lint, spec validation, unit tests, production build, and available local Obsidian reload checks pass.

## Scope and non-goals

In scope:

- A canonical Extended syntax/compiler contract, structural CSS, templates, and conformance tests.
- Shared Marp engine configuration for preview and managed exports, including a verified Marp CLI integration strategy.
- Fragment navigation and presenter-notes UI in the Obsidian preview.
- Trusted-author HTML handling and durable documentation.

Not in scope:

- Replacing standard Marpit directives, image syntax, theme CSS, or slide separators with redundant Extended syntax.
- Building a full presenter console, speaker timer, multi-window synchronization, or custom PPTX renderer.
- Guaranteeing parity for arbitrary user-supplied Marp CLI versions or engines that reject the managed engine contract.

## Decisions

| Date | Decision | Rationale | Affected workstreams |
| --- | --- | --- | --- |
| 2026-08-09 | Marp Extended extends authoring and host integration but does not redefine standard Marpit syntax. | Keeps generated Markdown portable and minimizes coupling to Marpit internals. | WS-01, WS-02, WS-04 |
| 2026-08-09 | Extended markers, generated classes, editor commands, and utility exports use the canonical Marp Extended names. | One language contract keeps authoring and theme integration explicit. | WS-01 |
| 2026-08-09 | Visible callouts use `%%marp-callout[variant=...]%%`; presenter notes use ordinary Marpit comments. | Keeps slide content distinct from presenter metadata. | WS-01, WS-03 |
| 2026-08-09 | Fragment playback is application state over Marpit's emitted `data-marpit-fragment` attributes, not new Markdown syntax. | This follows Marpit's integration contract and preserves standard source. | WS-03 |
| 2026-08-09 | Engine parity must be verified through executable/version/plugin contracts and render fixtures; the implementation may not label independent Core 5 and CLI 4 renderers as shared. | Prevents false compatibility claims and preview/export drift. | WS-02, WS-04 |
| 2026-08-09 | Preview and CLI share semantic engine invariants, while host-owned containers, templates, language, and CLI metadata plugins remain host-specific. | CLI 4.5 supplies and reapplies layout/template options that preview must not override. | WS-02, WS-04 |
| 2026-08-09 | Managed export uses exactly Marp CLI 4.5.0 with an absolute `--engine` path to a self-contained Core 5 engine; explicit incompatible CLI paths fail clearly. | CLI 4.5 defaults to Core 4.4, so version detection plus the bundled engine are required for a truthful parity contract. | WS-02 |
| 2026-08-09 | The standalone engine is both a release/manual-install artifact and embedded in `main.js`; marketplace installs materialize a hash-checked, content-addressed engine path and accept a matching concurrent rename winner. | Obsidian Community installs only the standard three files; content addressing also avoids unsafe in-place replacement of a stale engine on Windows. | WS-02, WS-04 |
| 2026-08-09 | Preview retains trusted-author `html: true` for generated Mermaid SVG and author HTML, while the iframe is sandboxed without author script execution if the runtime smoke passes. | Core's safe allowlist cannot reliably cover Mermaid SVG; sandboxing limits preview risk while preserving standard Marpit HTML behavior. | WS-02, WS-03, WS-04 |
| 2026-08-09 | A successful rerender preserves/clamps the active logical slide but resets fragment progress; cursor sync preserves progress, and comments map by wrapper index rather than descendant sections. | Prevents stale reveal state and advanced-background section duplication from corrupting fragments or notes. | WS-03 |

## Workstreams

Use `Pending`, `Claimed`, `In progress`, `Blocked`, or `Done`.

| ID | Deliverable | Owner | Status | Dependencies | Verification |
| --- | --- | --- | --- | --- | --- |
| WS-01 | Canonical Extended compiler, structural CSS, templates, and conformance fixtures | Amp | Done | None | Focused DSL, Markdown pipeline, theme, and template tests |
| WS-02 | Shared preview/export Marp engine contract and managed CLI integration | Amp | Done | WS-01 output contract | Engine parity and export argv/integration tests |
| WS-03 | Fragment controls, commands, presenter-notes panel, and preview state tests | Amp | Done | Stable preview render contract | Focused preview and command tests |
| WS-04 | Integration verification, security/HTML policy, docs, guidance, build/reload, and spec closeout | Amp | Done | WS-01, WS-02, WS-03 | Full required check suite and manual smoke evidence |

## Verification

- `npm run typecheck`
- `npm run lint`
- `npm run check:specs`
- `npm test -- --runInBand`
- `npm run build`
- `npm run obsidian:reload` when the configured local Obsidian environment is available
- Focused runtime fixtures compare normalized Marp HTML/CSS signals for directives, backgrounds, fragments, scoped styles, notes, and Extended components.
- Manual preview smoke covers fragment backward/forward/reset, active-slide changes, notes visibility, rerender state, and a Kami-themed deck.

## Documentation sync

- Durable product/developer docs: `README.md`, `CHANGELOG.md`, and `docs/marp-extended-syntax.md`.
- Nearest local `AGENTS.md`: update only if commands, structure, or maintenance contracts change.
- Parent/package guidance: package metadata and export requirements must match the verified engine strategy.
- Root guidance and roadmap: record the stable compiler/runtime ownership boundary.

### Experiment refs

None planned.

## Progress and handoff

### 2026-08-09 — Amp — WS-01/WS-02/WS-03

- Changed: Created the Active execution contract and claimed the implementation workstreams.
- Evidence: Current code inspection confirmed one shared Markdown preprocessor, preview on Core 5.0.0/Marpit 3.2.2, export through external or npx CLI 4.5.0, emitted fragment attributes without playback, and discarded preview comments.
- Remaining: Implement all workstreams and complete integration verification/documentation.
- Blockers: The exact supported Marp CLI custom-engine mechanism and current Core-5 CLI release must be verified before WS-02 implementation.
- Next action: Verify the CLI engine API and current package compatibility, then implement the compiler/runtime contracts.

### 2026-08-09 — Amp — WS-01/WS-02/WS-03/WS-04 closeout

- Changed: Added the canonical Extended language and namespaced structural contract, hardened nested/fenced marker compilation, added fragments and presenter notes, and routed preview plus managed export through fresh instances of the shared Core 5 engine contract.
- Runtime evidence: The standalone engine probe confirmed fresh instances, comments, fragments, Shiki, and MathJax. Direct Marp CLI fixtures produced HTML, PDF, PPTX, and PDF-with-notes with directives, advanced backgrounds, presenter comments, fragments, Extended components, Mermaid SVG, and custom themes. The opt-in `MarpExport` integration test also passed all managed export formats.
- Release evidence: Production build generated and deployed `main.js`, `manifest.json`, `styles.css`, and `marp-engine.cjs`; deployed and root engine SHA-256 values matched. A release ZIP containing exactly those four root assets passed `npm run scan:release`. Local Obsidian plugin reload exited successfully; Obsidian's global dev-error query also returned non-fatal `ResizeObserver loop` warnings.
- Review evidence: Independent review findings for recursive markers, Windows/concurrent engine materialization, stale iframe commits, and shared preview engine reuse were fixed. Regression tests cover each concurrency boundary.
- Verification: `npm run sync:themes`, `npm run check:specs`, `npm run typecheck`, `npm run lint`, `npm test -- --runInBand` (157 passed, 1 skipped), `npm run build`, `RUN_REAL_MARP_EXPORTS=1 npm run test -- --runInBand tests/unit/marpExportReal.test.ts`, `npm run scan:release`, and `git diff --check` passed. Lint retained two pre-existing warnings and no errors.
- Remaining: None for this spec.
- Blockers: None.
- Next action: Review the completed diff and commit it when ready.

## Completion summary

Marp Extended now treats standard Marp/Marpit Markdown as its base language and
adds a canonical, theme-independent authoring layer for higher-level
layouts. Preview and managed exports share the same Core 5 semantic engine,
preview can step standard fragments and display presenter comments, and release
artifacts carry a verified standalone engine with an embedded fallback.
