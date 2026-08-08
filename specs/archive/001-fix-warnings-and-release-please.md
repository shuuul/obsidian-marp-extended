---
id: "001"
title: "Fix linter warnings and sync Release Please metadata"
status: Completed
created: 2026-07-08
updated: 2026-07-08
coordinator: "historical (superpowers design)"
---

# 001 — Fix linter warnings and sync Release Please metadata

## Context

Historical execution record migrated from the removed `docs/superpowers/` tree
(`2026-07-08-fix-warnings-and-release-please-design.md` and matching plan). The work
fixed security/style linter warnings and aligned Release Please Obsidian version
metadata sync with the `obsidian-pivi` workflow.

Repository evidence after completion (still present at migration time 2026-08-08):

- `src/utilities/marpExport.ts` defines `getEnvVar` and uses it for PATH/HOME/browser paths.
- `styles.css` uses `.HyperMD-frontmatter` rather than `:has(.cm-hmd-frontmatter)`.
- `.github/workflows/release-please.yml` includes `sync-obsidian-version-metadata` on
  `prs_created == 'true'`.

## Goal and success criteria

- [x] Avoid static AST warnings for system identity / `process.env` access in export code.
- [x] Resolve CSS style lint issues called out in the design (frontmatter selector, theme CSS).
- [x] Sync Obsidian `versions.json` / manifest version metadata on the Release Please PR branch.

## Scope and non-goals

In scope:

- Env lookup encapsulation in `marpExport.ts`.
- Targeted CSS cleanups in plugin and packaged theme CSS.
- Release Please workflow job to push version metadata onto the release PR branch.
- `version-bump.mjs` reading version from `package.json` when npm env vars are absent.

Not in scope:

- Marp Core version upgrades.
- Broader theme redesign.

## Decisions

| Date | Decision | Rationale | Affected workstreams |
| --- | --- | --- | --- |
| 2026-07-08 | Use dynamic/bracket env access helper | Satisfy security AST checks without changing runtime behavior | WS-01 |
| 2026-07-08 | Align Release Please metadata sync with pivi | Keep Obsidian `versions.json` correct on the release PR | WS-03 |
| 2026-08-08 | Archive under tracked specs as 001 | Superpowers layout removed; retain permanent ID | WS-04 |

## Workstreams

| ID | Deliverable | Owner | Status | Dependencies | Verification |
| --- | --- | --- | --- | --- | --- |
| WS-01 | Env helper in marpExport | historical | Done | None | `getEnvVar` present; lint clean |
| WS-02 | CSS lint cleanups | historical | Done | None | styles/themes match design |
| WS-03 | Release Please metadata sync job | historical | Done | None | workflow job exists |
| WS-04 | Migrate record into `specs/archive` | amp | Done | None | `npm run check:specs` |

## Verification

```bash
npm run lint
npm run typecheck
npm test -- --runInBand
npm run check:specs
```

Manual: confirm release PR receives `versions.json` sync commit when Release Please opens a PR.

## Documentation sync

- Durable product/developer docs: Release flow remains in root `AGENTS.md` and
  `.github/workflows/release-please.yml`.
- Nearest local `AGENTS.md`: root `AGENTS.md` Release flow section.
- Parent/package guidance: None.
- Root guidance and roadmap: root `AGENTS.md`.

## Progress and handoff

### 2026-07-08 — historical — WS-01/WS-02/WS-03

- Changed: Implemented design under the old superpowers plan layout.
- Evidence: Code and workflow still match the design intents listed in Context.
- Remaining: None for original scope.
- Blockers: None.
- Next action: None.

### 2026-08-08 — amp — WS-04

- Changed: Removed `docs/superpowers/`; archived this completed work as `001`.
- Evidence: This file; `specs/README.md` Archived row.
- Remaining: None.
- Blockers: None.
- Next action: None.

## Completion summary

Env access encapsulation, CSS lint cleanups, and Release Please Obsidian metadata sync
were delivered. On 2026-08-08 the historical superpowers design/plan pair was retired and
this permanent archived spec was created so the new tracked specs system starts at `001`
with continuous IDs.
