# Marp / Marpit syntax reference for Marp Extended

This is a compact, source-linked guide for agents writing Marp decks in Obsidian. It summarizes official Marpit, Marp Core, and Marp CLI behavior and calls out plugin-relevant usage. See `SOURCES.md` and `upstream/` for refreshable source snapshots.

## Minimal deck

```markdown
---
marp: true
theme: default
paginate: true
---

# Slide 1

---

## Slide 2

Content
```

- `marp: true` is common for editor integrations and should be included in Obsidian notes intended as Marp decks.
- Slides are split by horizontal rulers. `---` is common; `___`, `***`, and `- - -` also work.
- YAML frontmatter must be the first thing in the file. The closing `---` ends metadata; the first actual slide starts after it.

## Directives

Directives are YAML key/value settings written in frontmatter or HTML comments.

### Global directives

Global directives affect the entire deck. If repeated, Marpit uses the last value.

| Directive | Use |
| --- | --- |
| `theme` | Select a theme registered in the theme set, e.g. `default`, `gaia`, `uncover`, or a vault CSS theme. |
| `mermaidTheme` | Marp Extended property for selecting a Mermaid-only CSS theme from `.marp-extended/mermaid-themes`. |
| `mermaidFlat` | Marp Extended property. Use `true` to remove the Mermaid figure card background, border, shadow, and padding so diagrams blend into the slide. |
| `style` | Add CSS tweaks as a YAML block scalar. Prefer this to raw `<style>` when possible. |
| `headingDivider` | Auto-split slides before headings. Use number `1`-`6` or an array such as `[1, 2]`. |
| `lang` | Set the HTML `lang` attribute. |
| `size` | Marp Core extension for slide size. Built-in themes support `16:9` and `4:3`. |
| `math` | Marp Core math engine: `mathjax` or `katex`. |
| `title`, `author`, `keywords`, `url`, `image` | Marp CLI metadata for exported HTML/PDF/PPTX where supported. |

Example:

```yaml
---
marp: true
theme: gaia
mermaidTheme: github
mermaidFlat: false
size: 16:9
headingDivider: 2
math: katex
style: |
  section {
    letter-spacing: 0.01em;
  }
---
```

### Local directives

Local directives apply to the current slide and following slides. Prefix with `_` to apply only to the current slide (spot directive).

| Directive | Use |
| --- | --- |
| `paginate` | `true`, `false`, `hold`, or `skip`. Controls showing and incrementing page numbers. |
| `header`, `footer` | Add repeated slide header/footer content. Markdown and inline images are supported; `![bg]` is not. |
| `class` | Add classes to the slide `<section>`, e.g. `_class: lead`. |
| `backgroundColor` / `backgroundImage` | Set slide background CSS. |
| `backgroundPosition` | Default `center`. |
| `backgroundRepeat` | Default `no-repeat`. |
| `backgroundSize` | Default `cover`. |
| `color` | Set slide text color. |
| `transition` | Marp CLI bespoke template transition to the next slide boundary. |

HTML comment examples:

```markdown
<!-- _class: lead -->
<!-- paginate: hold -->
<!-- backgroundColor: "#111" -->
<!-- color: "#eee" -->
```

Use quotes when YAML special characters are present:

```yaml
footer: "**Draft** · v0.3"
```

## HTML blocks for advanced Obsidian slide layouts

Obsidian Markdown and Marp directives cover common slides, but many editorial
layouts need explicit HTML. In this plugin, hand-written HTML is an accepted
escape hatch for structures that Markdown cannot express cleanly, such as two
column grids, cards, callouts, metric tables, title metadata, and Kami-style
paper layouts.

```markdown
<div class="c2">
<div>

### Left column

- Markdown still works inside the HTML wrapper.

</div>
<div>

<div class="mc">A styled callout controlled by the theme CSS.</div>

</div>
</div>
```

Keep the HTML semantic and small. Put reusable styling in a theme CSS file
instead of repeating `style="..."` attributes across slides. If raw HTML does
not render, check the plugin's HTML setting and export path before assuming
vanilla Obsidian preview behavior applies.

## Images

Standard Markdown image syntax works:

```markdown
![Alt text](attachments/photo.png)
```

Marpit extends image alt text with keywords.

### Inline image sizing

```markdown
![w:320](image.png)
![h:180](image.png)
![width:320px height:180px](image.png)
```

- `w`/`h` are shorthands for `width`/`height`.
- Inline images support CSS absolute length units and `auto`; viewport-relative units are intentionally limited for stable rendering.

### Image filters

```markdown
![blur:8px](image.png)
![brightness:1.3 contrast:120%](image.png)
![drop-shadow:0,5px,10px,rgba(0,0,0,.35)](image.png)
```

Supported filter keywords include `blur`, `brightness`, `contrast`, `drop-shadow`, `grayscale`, `hue-rotate`, `invert`, `opacity`, `saturate`, and `sepia`.

### Slide backgrounds

```markdown
![bg](background.png)
![bg cover](background.png)
![bg contain](background.png)
![bg fit](background.png)
![bg 150%](background.png)
![bg left:40%](portrait.png)
![bg right](portrait.png)
```

- `cover` fills the slide and is the default.
- `contain` fits the whole image; `fit` is an alias.
- Percent values scale the background.
- `left`, `right`, `left:33%`, and `right:40%` create split backgrounds.
- Multiple `![bg]` images on one slide form advanced backgrounds in inline SVG mode.

### Obsidian image wiki-links in this plugin

Marp Extended converts image wiki-links before render/export:

```markdown
![[attachments/diagram.png]]
![[diagram.png|System diagram]]
![[diagram.png|600]]
![[diagram.png|600x400]]
```

Converted forms become normal Markdown images. Text aliases become image alt text, while numeric aliases become Marp image directives such as `![w:600]` and `![w:600 h:400]`. The converter only targets image extensions: `png`, `jpg`, `jpeg`, `gif`, `svg`, `webp`, and `bmp`. If Obsidian cannot resolve an image file, Marp Extended still emits a Markdown image using the wiki-link target as the path.

## Lists and fragments

Regular lists render normally:

```markdown
- One
- Two
```

Fragmented lists use `*` for bullets or `)` for ordered lists:

```markdown
* First appears
* Then this
* Then this

1) First
2) Second
3) Third
```

Marpit marks fragments in HTML with `data-marpit-fragment`; the viewer/export template decides how to reveal them. Marp CLI's `bespoke` HTML template supports fragment behavior.

## Notes

HTML comments that are not parsed as directives can become presenter notes:

```markdown
# Public slide

<!--
Private presenter notes.
-->
```

The plugin's "PDF with notes" export uses Marp CLI `--pdf-notes` and `--pdf-outlines`.

## Math

Marp Core supports Pandoc-style math:

```markdown
Inline math: $E = mc^2$.

$$
\int_0^1 x^2 dx = \frac{1}{3}
$$
```

Declare the engine when using math:

```yaml
math: mathjax
# or
math: katex
```

MathJax is the default in Marp Core and in this plugin's default settings. KaTeX can be faster but supports a smaller syntax surface.

## Marp Core extras

- Built-in themes: `default`, `gaia`, `uncover`.
- Built-in sizes for official themes: `16:9` and `4:3` via `size`.
- GitHub Flavored Markdown tables and strikethrough are supported.
- Soft line breaks in paragraphs render as `<br>` by default.
- Emoji shortcode and Unicode emoji can be converted to Twemoji SVGs.
- Some unsafe HTML is denied by default. `<style>` and directive comments are still parsed by Marpit.
- Fitting headers use a hidden comment marker in Marp Core; check upstream docs before relying on it in a custom theme, because it depends on `@auto-scaling` metadata.

## Themes

Minimal custom theme:

```css
/* @theme obsidian-example */

section {
  width: 1280px;
  height: 720px;
  font-size: 34px;
  padding: 56px;
  background: #111827;
  color: #f9fafb;
}

section.lead {
  display: grid;
  place-content: center;
  text-align: center;
}

section::after {
  color: #9ca3af;
}
```

Rules:

- `/* @theme name */` is required.
- Style slides through `section` or `:root`; in Marpit theme CSS, `:root` means each slide section, not the document root.
- `section::after` styles pagination.
- `header` and `footer` directives insert `<header>` and `<footer>` content; themes must position them if a PowerPoint-like margin is desired.
- Slide size is one size per theme and must use static absolute units (`px`, `cm`, `in`, `mm`, `pc`, `pt`, `Q`).
- Import another registered theme with `@import 'default';` or `@import-theme 'default';`.
- In Markdown, use `style: |` or `<style scoped>` for deck/slide tweaks instead of creating a full theme when the change is small.

## Transitions for HTML export

Marp CLI's `bespoke` template supports a `transition` local directive:

```yaml
transition: fade
transition: slide 750ms
```

- The transition applies to the next slide boundary.
- Use `_transition` for one boundary only.
- Built-in names include `none`, `fade`, `slide`, `cover`, `push`, `reveal`, `wipe`, `zoom`, `flip`, `cube`, and many others.
- Transitions require a browser with View Transition API support and are relevant mainly to HTML/bespoke presentations.

## Export implications in Marp Extended

The plugin maps export commands to Marp CLI roughly as follows:

| Plugin export | CLI flags |
| --- | --- |
| PDF | `--pdf -o deck.pdf` |
| PDF with notes | `--pdf --pdf-notes --pdf-outlines -o deck.pdf` |
| PPTX | `--pptx -o deck.pptx` |
| PNG | `--image png -o deck.png` |
| HTML | `--html --template <bare|bespoke> -o deck.html` |
| Preview | `--html --preview` |

The plugin also adds `--allow-local-files`, always adds `--engine <plugin lib3/marp.config.js>`, always adds `--html` so pre-rendered Mermaid SVG is preserved, and optionally adds `--theme-set <vault .marp-extended/themes>` plus `--browser-path <CHROME_PATH>`.

## Sources

Primary sources:

- Marpit Markdown: https://marpit.marp.app/markdown
- Marpit directives: https://marpit.marp.app/directives
- Marpit image syntax: https://marpit.marp.app/image-syntax
- Marpit fragmented list: https://marpit.marp.app/fragmented-list
- Marpit theme CSS: https://marpit.marp.app/theme-css
- Marp Core features: https://github.com/marp-team/marp-core#features
- Marp CLI: https://github.com/marp-team/marp-cli
- Marp CLI transitions: https://github.com/marp-team/marp-cli/blob/main/docs/bespoke-transitions/README.md
