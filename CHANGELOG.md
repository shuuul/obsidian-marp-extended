# Changelog

## 0.2.0

- Added fit-width Marp preview zoom controls with step zoom, pinch zoom, and zoom state preservation across preview rerenders.
- Added real Marp CLI export coverage for sample deck exports with managed themes across PDF, PDF notes, PPTX, PNG, and HTML outputs.

## 0.1.1

- Fixed Obsidian sidebar and command export actions so failures and output paths are visible in Notices.
- Fixed export path resolution by using Obsidian adapter filesystem paths instead of `app://` resource URLs for Marp CLI.
- Fixed markdown-it engine loading inside Obsidian's renderer by forcing Marp CLI to resolve local engine files through CommonJS during export.
- Fixed PNG export argument construction to produce a single selected output file.
- Updated bundled Kami themes to use pixel-based Marp slide sizes for browser image/PPTX export compatibility.
- Updated fork-owned theme download URLs to `shuuul/obsidian-marp-extended`.
- Added a README screenshot and clarified the dev-only audit note.

## 0.1.0

- Initial Marp Extended fork baseline.
- Renamed plugin metadata from Marp Slides to Marp Extended.
- Refreshed dependencies and build/test maintenance scripts.
- Removed user-facing docs site content; retained developer notes only.
