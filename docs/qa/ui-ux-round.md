# UI/UX round - 2026-09-07

Scope: production Home, shared Modal, AppGenerator, Present, both Playgrounds, all41 visual settings panes and existing chart interactions. Synthetic data and isolated Electron profiles; no production data or tenant publication.

## Delivered

- Home now distinguishes a search miss from an empty project list, provides Clear search and counts visuals across all pages.
- Project open/delete controls have accessible names; open is a real focusable button. Existing row click and context menu behavior retained.
- Shared dialogs have accessible titles, opening focus, Tab boundary wrapping, top-dialog Escape handling and focus restoration. Capturing the opener before autoFocus commit avoids losing focus on close.
- Dialog bodies scroll while header/footer remain visible; footer actions wrap at limited widths.

## Verification

| Suite | Result |
|---|---|
| Home/shared dialog |11/11|
| Canvas creation/edit/save |10/10|
| Present |7/7|
| Visual Playground |37/37|
| Query Playground |3/3|
| Settings across41 visuals |237/237|
| Chart interactions |16/16|

Total321 scoped checks passed. UI production build passed33.41s to cache/qa-build/shell-ux. Final Home row-click preservation adjustment retested with shell suite. Existing build warnings: CJS Vite API, package module metadata, stale Browserslist data, large bundle.

Inspected shell-ux-modal.png:640x480 content viewport, long content remains scrollable and footer visible. This is a shared-component fixture, not visual approval of every production dialog.

Native keyboard injection failed to deliver activation in this QA window even with focus; Home button semantics and DOM modal keyboard events were tested instead. Native keyboard acceptance is pending. Existing native chart-pointer interaction tests passed separately. Initial search assertion caught an unapplied Unicode text replacement; corrected and reran successfully.

## Still pending

This is not a full product certification. Searchable formatting/progressive disclosure, complete error/retry and deletion recovery, full accessibility/contrast review, all dialog compositions and themes, every clipping/formatting combination, live AI acceptance, deployed export fidelity and local PBIP connection/export integration remain outstanding. Local Power BI foundation from the previous task is retained; no user-facing local export claim.
