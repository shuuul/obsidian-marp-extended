# Marp Extended specs

Specs are tracked execution records for long-running work. They capture decisions,
workstreams, multi-agent handoffs, and acceptance evidence while a task is in progress.

Specs do not replace stable documentation. Code, tests, `README.md`, `CHANGELOG.md`,
`docs/*.md` (user-facing notes), and the nearest `AGENTS.md` remain the durable sources
of truth. Before a spec is completed, move lasting behavior and maintenance knowledge
into those owners.

Copy [000-template.md](000-template.md) to start a spec.

## Active specs

| Spec | Status | Outcome |
| --- | --- | --- |

## Archived specs

| Spec | Completed | Outcome |
| --- | --- | --- |
| [001-fix-warnings-and-release-please.md](archive/001-fix-warnings-and-release-please.md) | 2026-07-08 | Encapsulated env access, CSS lint cleanups, and Release Please Obsidian metadata sync on the release PR branch. |
| [002-marp-core-v5-migration.md](archive/002-marp-core-v5-migration.md) | 2026-08-09 | Preview on Marp Core 5.0.0 RC (Shiki+MathJax), CLI pin 4.5.0, custom Mermaid kept, Kami code styling, assets themes, docs/skills sync. |
| [003-marp-extended-language-and-runtime.md](archive/003-marp-extended-language-and-runtime.md) | 2026-08-09 | Canonical Extended language, shared preview/export Core 5 engine, fragments, and presenter notes. |

## Numbering and files

- Reserve `000-template.md` for the template. Formal specs use `NNN-kebab-case.md`, beginning with `001`.
- Allocate one more than the highest ID found in both this directory and `archive/`. IDs are permanent: never reuse, renumber, or delete one to close a gap.
- A coordinating agent must create the file and add it to the Active specs index before spawning parallel work.
- Keep `Draft` and `Active` specs in this directory. Once a spec meets its success criteria and completes documentation sync, set it to `Completed`, move the unchanged filename to `archive/`, and move its index entry to Archived specs in the same change.
- Keep both index tables in ascending numeric order. Every formal spec must appear exactly once in the matching table.

## Lifecycle

| Status | Meaning |
| --- | --- |
| `Draft` | Intent, scope, or work breakdown is still being made decision-complete. |
| `Active` | The spec is ready and one or more workstreams are being executed. |
| `Completed` | Acceptance and documentation sync are complete; the file belongs in `archive/`. |

Blocking does not add another top-level status. Mark the affected workstream `Blocked`
and record the evidence, required decision, and next action in Progress and handoff.

## Multi-agent workflow

- The coordinator owns frontmatter, scope, cross-workstream decisions, the index entry, and final closeout.
- Give each workstream a stable ID. A worker claims a workstream before editing and records its owner name in the table.
- Workers should edit only their claimed sections or append-only progress entries.
- Record decisions before dependent work proceeds. Record verification commands and evidence instead of unsupported completion claims.
- Every handoff states what changed, what remains, blockers, evidence, and the next safe action.

## Documentation sync and closeout

Before moving a spec to `archive/`:

1. Satisfy every success criterion or explicitly record why a criterion was removed through a decision entry.
2. Update durable docs (`README.md`, `CHANGELOG.md`, `docs/*`, skills refs) for lasting user- or developer-facing changes.
3. Update root `AGENTS.md` (and any nearer guidance) for changed commands, structure, or maintenance rules.
4. Record final verification evidence and the completion summary in the spec.
5. Set `status: Completed`, update the date, move the file without renaming it, and move its README entry to Archived specs.
6. Run `npm run check:specs` and the focused validator tests.

## Validation

```bash
npm run check:specs
npm test -- --runInBand tests/unit/scripts/checkSpecs.test.ts
```

The check validates filenames, numbering, flat frontmatter, required sections, lifecycle
placement, and index coverage. It cannot prove that prose matches the implementation.
