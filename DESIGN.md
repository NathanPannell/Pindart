# Design system

Pindart is a focused visual feedback workbench. The red open-corner mark represents a selected region and the arrow drawn toward the exact change. The image remains the main surface during markup and issue composition. Jam's public product screens informed the split preview and composer structure, with original Pindart assets, copy, and styling.

## Surface roles

- **Canvas** `#f5f6f7`: quiet workspace around the screenshot.
- **Surface** `#ffffff`: controls, context card, and fixed submit area.
- **Ink** `#202329`: primary text.
- **Muted** `#69717d`: supporting labels and metadata.
- **Line** `#dfe3e8`: panel and control boundaries.
- **Red** `#d83c38`: drawing ink and primary actions. The same hue connects annotation to submission.
- **Green** `#247f5c`: connected and completed states.

## Type and layout

Segoe UI and platform fallbacks match Chrome's utility context. Headings use a compact 26–27 px scale. Controls and form content use 11–12 px labels. The screenshot fills the markup workbench. In the issue step, a persistent image panel occupies the left side and a focused GitHub composer occupies the right. The bottom action stays visible as details scroll. Under 760 px the panels stack.

## Interaction

The extension action starts selection directly on the page. Selection is temporary, reversible with Escape, and disappears before capture. A dedicated popup window keeps markup and the issue form in one flow. Red arrows and freehand strokes are undoable. A success screen provides the created issue link.
