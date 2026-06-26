# Script guidance

- Run reference refreshes from the repository root:

  ```bash
  python3 skills/obsidian-marp/scripts/update-references.py
  ```

- Required tools: Python 3.11+, network access, `curl`; `npx` is optional but recommended for HTML-to-Markdown conversion through `defuddle`.
- Upstream snapshots under `skills/obsidian-marp/references/upstream/` are generated. Do not hand-edit them; refresh with the script.
- Hand-written adaptation lives in `skills/obsidian-marp/references/syntax.md` and `skills/obsidian-marp/references/plugin-adapter.md`.
