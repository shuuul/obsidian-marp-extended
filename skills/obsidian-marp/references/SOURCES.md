# Sources for the Obsidian Marp skill

Generated/updatable upstream snapshots are stored in `upstream/` by `../scripts/update-references.py`.

Current project metadata source: **Marp Extended** `0.4.0`, plugin/package id
`marp-extended`, repository <https://github.com/shuuul/obsidian-marp-extended>.

## Agent Skill specification

- https://agentskills.io/specification

## Marp / Marpit official docs

- Marp homepage: https://marp.app/
- Marpit Markdown: https://marpit.marp.app/markdown
- Marpit directives: https://marpit.marp.app/directives
- Marpit image syntax: https://marpit.marp.app/image-syntax
- Marpit fragmented list: https://marpit.marp.app/fragmented-list
- Marpit theme CSS: https://marpit.marp.app/theme-css
- Marp Core features: https://github.com/marp-team/marp-core#features
- Marp CLI: https://github.com/marp-team/marp-cli
- Marp CLI bespoke transitions: https://github.com/marp-team/marp-cli/blob/main/docs/bespoke-transitions/README.md

## Plugin source files used for adaptation

- `manifest.json` — plugin id/name/version.
- `package.json` — Marp dependency versions and scripts.
- `README.md` — user-facing behavior and theme credits.
- `src/utilities/settings.ts` — defaults for math, HTML export mode, browser path, markdown-it plugins.
- `src/utilities/filePath.ts` — filesystem path resolution and Obsidian image wiki-link conversion.
- `src/utilities/marpExport.ts` — Marp CLI argv construction and export behavior.
- `src/config/marp.config.js` — optional markdown-it plugin engine config.
- `vault/Themes.md` and `vault/themes/*.css` — sample vault theme references.

## Refresh procedure

From the repo root:

```bash
python3 skills/obsidian-marp/scripts/update-references.py
```

Then review `references/upstream/` and update `syntax.md` / `plugin-adapter.md` only when upstream or plugin behavior changed.
