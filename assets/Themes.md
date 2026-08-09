# Marp theme references

This note collects Marp theme resources for **Marp Extended**
(`marp-extended`), the independent Obsidian plugin at
<https://github.com/shuuul/obsidian-marp-extended>.

## Shipped with the plugin

| Theme | Source | Notes |
| --- | --- | --- |
| `default`, `gaia`, `uncover` | Marp Core built-ins | No vault CSS file; always available via Marp |
| `kami` | [tw93/Kami Marp templates](https://github.com/tw93/Kami/tree/main/assets/templates/marp) | One file, two locales: Chinese by default; English with `lang: en`. Installed to `.marp-extended/themes/kami.css` |

## Not packaged (install yourself if needed)

Older community packs that used to ship with this fork, now optional:

- [matsubara0507/marp-themes](https://github.com/matsubara0507/marp-themes) — `github`, `olive`
- [dracula/marp](https://github.com/dracula/marp) — `dracula`

Paste their CSS in **Settings → Marp Extended → themes**, or copy a `.css`
file into `.marp-extended/themes/` with a `/* @theme name */` header.
