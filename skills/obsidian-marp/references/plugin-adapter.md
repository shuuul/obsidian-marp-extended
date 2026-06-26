# Marp Extended plugin adaptation notes

These notes adapt upstream Marp syntax to this repository's Obsidian plugin. Source paths are relative to the repo root.

## Plugin identity

- Plugin id: `marp-extended` (`manifest.json`).
- Package name: `marp-extended` (`package.json`).
- Obsidian runtime files: `main.js`, `manifest.json`, `styles.css`.
- Generated `main.js` should not be edited by hand; change `src/` and run the build.

## Settings that affect syntax and export

Defined in `src/utilities/settings.ts`:

| Setting | Default | Effect |
| --- | --- | --- |
| `CHROME_PATH` | `''` | Optional browser path passed to Marp CLI as `--browser-path`; also assigned to `process.env.CHROME_PATH` during export. |
| `EnableHTML` | `false` | Plugin setting for HTML handling. Check render/export code before promising raw HTML support. |
| `MathTypesettings` | `mathjax` | Default math choice exposed by plugin settings. Decks can still declare `math: mathjax` or `math: katex`. |
| `HTMLExportMode` | `bare` | Passed to Marp CLI as `--template <mode>` for HTML export. Marp CLI's default is `bespoke`, but this plugin defaults to `bare`. |
| `EnableMarkdownItPlugins` | `true` | Adds the plugin's custom Marp engine config for Kroki, mark, and container plugins. |

## Wiki-link image conversion

Implemented in `src/utilities/filePath.ts`.

The converter transforms Obsidian image wiki-links into standard Markdown image links:

```markdown
![[image.png]]              -> ![image.png](resolved/path/image.png)
![[image.png|Alt text]]     -> ![Alt text](resolved/path/image.png)
```

Important constraints:

- Only image extensions are converted: `png`, `jpg`, `jpeg`, `gif`, `svg`, `webp`, `bmp`.
- The file is resolved with Obsidian `metadataCache.getFirstLinkpathDest(filename, sourceFile.path)`.
- Absolute Obsidian link format produces paths from the vault root.
- Relative Obsidian link format produces paths relative to the current note's folder.
- If the linked file cannot be resolved, the original wiki-link is left unchanged.
- Non-image wiki-links and embeds are out of scope for this converter.

## Export behavior

Implemented in `src/utilities/marpExport.ts`.

Before calling Marp CLI, the plugin:

1. Removes and copies the note to the vault root when Obsidian is using absolute link format.
2. Resolves a filesystem path for the source note.
3. Collects existing theme paths from `.marp-extended/themes`.
4. Resolves the plugin engine config under the installed plugin's `lib3/marp.config.js`.
5. Converts image wiki-links in the temporary/export source file.

The CLI argv always starts with:

```text
<completeFilePath> --allow-local-files
```

Then it may add:

- `--engine <lib3/marp.config.js>` when markdown-it plugins are enabled.
- `--theme-set <defaultThemePath...>` when theme paths exist.
- `--browser-path <CHROME_PATH>` when configured.
- Export-type flags shown in `references/syntax.md`.

Security note: `--allow-local-files` is necessary for vault resources but should only be used with trusted Markdown.

## Markdown-it plugins

The custom engine config in `src/config/marp.config.js` registers:

- `@kazumatu981/markdown-it-kroki`
- `markdown-it-mark`
- `markdown-it-container` with the container name `container`

Agent guidance:

- If Kroki diagrams, `==marked text==`, or custom containers fail, check `EnableMarkdownItPlugins` and whether the copied `lib3/` assets exist in the installed plugin directory.
- Do not assume these markdown-it extensions are available in vanilla Marp CLI outside this plugin.

## Themes in this repo

The sample vault has theme CSS under `vault/themes/` and theme notes under `vault/Themes.md`.

When adding or advising custom themes:

- Include `/* @theme name */`.
- Prefer local vault theme files so `--theme-set` can register them.
- Keep upstream license notices in copied/modified theme CSS.
- For Kami themes, note the TsangerJinKai02 font licensing caveat from `README.md`.

## Export prerequisites and gotchas

- PDF, PPTX, and image export require Chrome/Chromium/Edge or a configured browser path.
- The plugin reports a friendly error when Marp CLI cannot find Chromium.
- HTML export template defaults to `bare`; transition/fragment behavior may require `bespoke` depending on how the deck is viewed.
- Obsidian preview paths may differ from Node filesystem paths. The plugin normalizes `app://` and `file://` paths for Marp CLI.
