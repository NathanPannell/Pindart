# Design system

Frame to Issue is a focused browser utility. Its frame motif comes from the act of selecting a region: a small red open-corner mark identifies the extension, while the user's screenshot remains the largest element in the markup step.

## Surface roles

- **Paper** `#f1f3f4`: quiet workspace around the screenshot and form.
- **Surface** `#ffffff`: controls, context card, and fixed submit area.
- **Ink** `#222629`: primary text.
- **Muted** `#56616a`: supporting labels and metadata.
- **Line** `#d3dbe0`: separation without decorative elevation.
- **Red** `#cb3833`: drawing ink and primary actions. The same hue connects annotation to submission.
- **Green** `#31765b`: connected and completed states.

## Type and layout

Segoe UI and platform fallbacks match Chrome's utility context. Headings use a compact 27 px scale. Controls and form content use 12–13 px labels, with larger text reserved for the capture preview and main action. The markup window is wide so the selected screenshot leads. The issue window narrows to a readable form and keeps its submit action visible while the details scroll.

## Interaction

The extension action starts selection directly on the page. Selection is temporary, reversible with Escape, and disappears before capture. A dedicated popup window keeps markup and the issue form in one flow. Red arrows and freehand strokes are undoable. A success screen provides the created issue link.
