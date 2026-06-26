---
marp: true
theme: minimal-container-turquoise
mermaidTheme: minimal-container-turquoise
mermaidFlat: false
size: 16:9
paginate: true
---
<!-- _class: lead -->
# Title

## Subtitle

---

<!-- _class: box-flex -->
# Columns Containers

**[markdown-it-container](https://github.com/markdown-it/markdown-it-container)**

::: container
## Column 1

text text text text text text text text text text

:::

::: container
## Column 2

text

:::

---

# Text Highlights

**[markdown-it-mark](https://github.com/markdown-it/markdown-it-mark)**

This is ==marked== text

---

# Mermaid Diagram

**Built-in Marp Extended Mermaid support**

```mermaid[Mermaid flowchart]
flowchart LR
  A[Markdown] --> B[Marp Extended]
  B --> C{Preview or export?}
  C -->|Preview| D[Inline SVG]
  C -->|Export| E[Processed Markdown]
```

---

# CallOuts (Work in Progress)

https://github.com/ebullient/markdown-it-obsidian-callouts
