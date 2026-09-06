# Preview sync

Sync preview links the Markdown note and the Deck preview. It is on by default and toggled from the Deck preview toolbar.

## Rules

1. One driver. The pane that received the latest user input (cursor, selection, scroll, click) is the driver. The other pane is the follower.
2. The driver never jumps. Programmatic scroll, cursor moves, and focus changes must not run on the pane the user is currently using.
3. The follower follows. Map the driver's current slide and align the matching source line to the same screen Y as the slide top.
4. Focus does not drive. Clicking or focusing a pane must not sync from the other pane. Attach listeners only; do not run an initial follow on bind or on leaf change.
5. Click-to-source is off while sync is on. Clicking a slide while sync is on must not move the editor cursor or steal focus. That jump-to-source behavior is only for sync off.

## Mapping

- Markdown → slide: count `---` separators, ignoring frontmatter and fenced code. Align to the first visible content line of that slide, skipping blank lines and `%%marp-slide...%%` markers.
- Slide → Markdown: same mapping in reverse. Align that source line to the slide's screen Y.
- Edit mode uses the cursor line. Reading view uses the source line of the section at the top of the viewport.

## Drivers

| User input | Driver | Follower action |
| --- | --- | --- |
| Move cursor / select text in edit mode | Markdown | Deck shows that slide if it is off-screen. Markdown does not move. |
| Scroll reading view | Markdown | Deck shows that slide if it is off-screen. Reading view does not move. |
| Scroll Deck preview | Deck | Markdown scrolls so the matching content line shares the slide's screen Y. Deck does not move. |
| Click Deck preview with selected text | Deck | Highlight the matching source text in the editor. |
| Click Deck preview with no selection (sync on) | Deck | No jump-to-source. No Markdown focus change. |
| Click Deck preview with no selection (sync off) | none | Jump the editor to the start of that slide. |

After a programmatic follower scroll, ignore that pane's scroll events for one frame so the follower cannot become the driver.

## Non-goals

- Pixel-perfect line matching inside a slide
- Syncing when Sync preview is off
- Re-rendering the deck because a leaf became active
