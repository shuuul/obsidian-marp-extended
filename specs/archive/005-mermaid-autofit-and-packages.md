---
id: "005"
title: "Mermaid auto-fit packaging + packages/ monorepo extraction"
status: Completed
created: 2026-08-15
updated: 2026-08-15
coordinator: "Droid"
---

# 005 — Mermaid auto-fit packaging + packages/ monorepo extraction

## Context

Long linear `flowchart LR` chains in slide decks (e.g. `朱镕基时代与经济政策.md`
with four 6–8 node chains) render on a single line; Marp scales the figure to
fit the slide width, which shrinks node text. Neither official Mermaid nor
beautiful-mermaid can auto-wrap a chain based on available space.

Verified facts (beautiful-mermaid 1.1.3 in `node_modules`):

- Exports `parseMermaid` (structured chain detection without regex) and a
  synchronous `renderMermaidSVG` returning a measurable SVG string.
- Parser supports per-subgraph `direction` overrides; layout uses ELK SEPARATE
  hierarchy handling with cross-subgraph ports, so a zigzag (snake) layout via
  per-row subgraphs works.
- The renderer always draws subgraph chrome (outer rect + header band) and
  `style` statements only affect nodes, not groups. Chrome for generated wrap
  groups must be stripped from the SVG by `data-id` prefix (`mwWrap*`); nodes
  are not nested inside group `<g>` elements, so stripping is safe.
- Preview and export both funnel through two render entry points:
  `src/utilities/mermaid.ts` `renderMermaidFigure` and
  `src/runtime/mermaidFallback.ts` `renderMermaidFallbackFigure`.

The same change establishes the `packages/` npm-workspaces layout and extracts
three existing Obsidian-free modules into sub-packages.

## Goal and success criteria

- [ ] New workspace package `@marp-extended/mermaid-autofit` wraps
  beautiful-mermaid: pure linear LR chains longer than a threshold are
  re-rendered as multi-row zigzag layouts until the diagram aspect ratio fits a
  target (default 2.2); all other diagrams render unchanged.
- [ ] Preview, export, and Live Preview editor rendering use the auto-fit path;
  a new settings toggle `MERMAID_AUTO_FIT` (default on) disables it.
- [ ] `packages/` workspace with `@marp-extended/code-fence-scanner`,
  `@marp-extended/marp-dsl`, `@marp-extended/wiki-links` extracted from
  `src/utilities/` with all imports updated.
- [ ] `npm run typecheck`, `npm run lint`, `npm run check:specs`,
  `npm test -- --runInBand`, and `npm run build` all pass.
- [ ] Integration tests render real beautiful-mermaid output for the actual
  8-node and 6-node chains from the slide file: all labels preserved, wrap
  chrome stripped, aspect ratio at or below target.

## Scope and non-goals

In scope:

- Auto-fit for pure linear LR flowchart chains only; branching diagrams
  (e.g. 分税制的交换) and TD chains render unchanged.
- "Remaining space" is approximated by a target aspect ratio (Marp scales
  slides as a whole, so aspect ratio is the scale-invariant constraint).
- npm workspaces plumbing: root `workspaces`, tsconfig `paths`, jest
  `moduleNameMapper`, lint script coverage of `packages/`.

Not in scope:

- Extracting Obsidian-coupled modules (filePath, theme managers, previewLinks).
- Moving `src/runtime/` engine modules (already effectively isolated).
- Hand-editing CHANGELOG.md (owned by Release Please) or the slide file.

## Decisions

| Date | Decision | Rationale | Affected workstreams |
| --- | --- | --- | --- |
| 2026-08-15 | Package name `@marp-extended/mermaid-autofit`, repo-private scope | User choice; signals not independently published | WS-04 |
| 2026-08-15 | Settings toggle `MERMAID_AUTO_FIT` default on | User choice; conservative detection keeps risk low | WS-05 |
| 2026-08-15 | Extract code-fence-scanner, marp-dsl, wiki-links as separate packages | User choice; wiki-links must not depend on marp-dsl, so the shared scanner gets its own package | WS-02 |
| 2026-08-15 | Zigzag via per-row subgraphs + SVG chrome strip by `mwWrap` id prefix | beautiful-mermaid ignores `style` for groups and always draws group chrome; `style` lines are still emitted for official-mermaid compatibility | WS-04 |
| 2026-08-15 | Chain detection via `parseMermaid`, bail to pass-through on any anomaly | Real parser beats regex; conservative bail preserves current behavior | WS-04 |
| 2026-08-15 | Zigzag outer direction TD (not LR) with per-row LR/RL overrides | Empirically verified against real renderer: LR-outer places row subgraphs diagonally (aspect stuck ~8), TD-outer stacks rows vertically (aspect 3.0/1.6/0.9 for 2/3/4 rows) | WS-03 |
| 2026-08-15 | Jest integration project with narrowed roots excluding `tests/__mocks__` | Jest auto-applies node-module manual mocks found under roots; integration tests also map beautiful-mermaid to its bundled dist because the package ships no CJS export | WS-05 |

## Workstreams

Use `Pending`, `Claimed`, `In progress`, `Blocked`, or `Done`.

| ID | Deliverable | Owner | Status | Dependencies | Verification |
| --- | --- | --- | --- | --- | --- |
| WS-01 | Workspace plumbing: root workspaces field, tsconfig paths, jest moduleNameMapper, lint script, npm install | Droid | Done | None | typecheck + jest bootstrap |
| WS-02 | Extract code-fence-scanner, marp-dsl, wiki-links packages; update all src + test imports | Droid | Done | WS-01 | typecheck, existing tests green |
| WS-03 | Implement mermaid-autofit (chain/zigzag/fit/svg/index) | Droid | Done | WS-01 | unit + integration tests |
| WS-04 | Plugin integration: mermaid.ts, mermaidFallback.ts, settings + tab, preview view, marpExport, editor extension | Droid | Done | WS-03 | typecheck, tests, build |
| WS-05 | Tests: extend beautiful-mermaid mock, unit tests, jest integration project | Droid | Done | WS-03 | npm test -- --runInBand |
| WS-06 | Validation, docs sync (AGENTS.md, tests/AGENTS.md), Obsidian reload, spec closeout | Droid | Done | WS-02–05 | all gates + check:specs |

## Verification

```bash
npm install
npm run typecheck
npm run lint
npm run check:specs
npm test -- --runInBand
npm run build
npm run obsidian:reload   # report if OBSIDIAN_VAULT/Obsidian unavailable
```

Manual scenario: preview `slides/朱镕基时代与经济政策.md`; the four long LR
chains render as multi-row zigzag with larger text; the branched 分税制 diagram
is unchanged. Export to HTML and confirm identical zigzag output.

## Documentation sync

- Durable product/developer docs: none (no user docs site change needed).
- Nearest local `AGENTS.md`: `tests/AGENTS.md` (package name imports, integration project).
- Parent/package guidance: none.
- Root guidance and roadmap: root `AGENTS.md` repo-structure section gains `packages/` rows.

### Experiment refs

None.

## Progress and handoff

Append entries rather than rewriting another worker's record.

### 2026-08-15 — Droid — WS-01

- Changed: spec created and indexed; investigation evidence recorded in Context.
- Evidence: beautiful-mermaid 1.1.3 source inspection (parser.ts, layout-engine.ts, renderer.ts, dist/index.d.ts).
- Remaining: WS-01 through WS-06.
- Blockers: none.
- Next action: workspace plumbing, then extractions, then mermaid-autofit.

### 2026-08-15 — Droid — WS-01..WS-06

- Changed: workspace plumbing (root workspaces, tsconfig paths, jest mappers, lint glob); extracted `@marp-extended/code-fence-scanner`, `@marp-extended/marp-dsl`, `@marp-extended/wiki-links`; implemented `@marp-extended/mermaid-autofit`; integrated auto-fit into preview/export/editor rendering with `MERMAID_AUTO_FIT` (default on); extended the beautiful-mermaid mock; added unit + integration tests; synced AGENTS.md files.
- Evidence: typecheck clean; lint 0 errors (2 pre-existing warnings); 228 tests passed across unit + integration projects; `npm run build` passed including standalone engine smoke check; `npm run obsidian:reload` reloaded the dev plugin; `npm run check:specs` passed.
- Remaining: none.
- Blockers: none.
- Next action: archive this spec.

## Completion summary

Delivered the `packages/` npm-workspaces layout with four sub-packages. The new
`@marp-extended/mermaid-autofit` wraps beautiful-mermaid and re-lays pure linear
`flowchart LR` chains as multi-row zigzag diagrams (hidden TD subgraphs with
alternating LR/RL row directions, chrome stripped from the SVG) until the
rendered aspect ratio fits the 2.2 target; all other diagrams render unchanged.
Preview, export, and Live Preview editor rendering route through it behind the
`MERMAID_AUTO_FIT` setting (default on). Three existing Obsidian-free modules
were extracted to `@marp-extended/code-fence-scanner`, `@marp-extended/marp-dsl`,
and `@marp-extended/wiki-links` with all imports updated. One scope deviation
from the earliest draft: zigzag uses TD as the outer direction because LR-outer
placement was empirically broken (recorded in Decisions). Verification:
typecheck, lint, check:specs, full Jest suite (unit + integration against the
real renderer), production build with engine verification, and Obsidian dev
plugin reload all passed. Durable docs updated: root `AGENTS.md` (structure,
testing guidance) and `tests/AGENTS.md` (projects, mocks, package imports).
