# Enhancement backlog

These are product/design decisions or engineering improvements, separate from reproduced defects.

| ID | Area | Current experience | Proposed improvement | Benefit | Effort | Priority |
|---|---|---|---|---|---|---|
| UX-001 | Visual semantics | sankey/chord use arcs; sunburst is a donut approximation; bump is inverted line | Label actual capabilities clearly and define full data roles before new implementations | Prevent misleading visualization choice | Medium/large | P2 |
| UX-002 | Property discoverability | Manual panels coexist with schema controls and per-type hidden defaults | One capability catalog driving documented visibility and defaults after parity audit | Predictable equivalent controls | Large | P2 |
| UX-003 | Recovery | React state and save flow have no established audit evidence for undo/recovery | Define undo history and failed-save recovery behavior | Safer editing | Medium/large | P2 |
| UX-004 | AI feedback | Patch count is shown, not proven visual effect | Summarize accepted named operations and unsupported settings | Users can verify what changed | Medium | P2 |
| UX-005 | Small charts | Fixed card fonts/shapes and host clipping compete | Explicit compact/readability thresholds with recoverable labels | Usable narrow/tiny visuals | Medium | P2 |
| ENG-001 | Tests | Several tests assert source text or copy algorithms | Move critical claims to production-function and mounted behavior assertions | Less false confidence | Medium | P2 |
| ENG-002 | Bundle | Desktop JS is about 2.26 MB minified; old variants remain imported | Measure startup, then lazy-load large secondary workflows if justified | Faster startup/builds | Medium | P3 |
| DOC-001 | Naming/documentation | Semantica-era documents conflict with current Vilsem code | Keep dated historical notes, add current verified architecture/runbook | Clear onboarding | Small | P3 |
| UX-006 | Incomplete visual drafts | Creating an unbound bar is allowed and saved; a later AI title edit on another visual fails whole-document validation with `data.measures must be a non-empty array` | Define draft validity and identify incomplete cards before save/refinement; allow safe edits without an unrelated draft blocking them | Predictable authoring and actionable recovery | Medium | P2 |

Effort is relative, not a delivery estimate. UX issues based only on source require UI confirmation before detailed redesign.


## UX-TEXT-003 ? Make active and mixed formatting visible
- Area: Text-box inspector.
- Current: B/I/U have no active/mixed-state indication; font/size dropdowns reset to generic placeholders; formatting controls are visually gated by pointer-events when inactive.
- Proposed: expose selected formatting and mixed values; give controls accessible names, real disabled states and keyboard access; distinguish selection formatting from base formatting clearly.
- Benefit: predictable editing and fewer accidental style changes.
- Priority: P2. Effort: medium; selection state, browser commands and undo require regression coverage.


## FORMAT-DETAIL-001 ? Detailed per-visual formatting
- Area: All visual formatting; first implementation targets Bullet, Metric Tile, Stat Card, Progress and Text box.
- Current: missing schemas and hardcoded geometry/paint/text details; generic settings cannot express each visual's useful options.
- Proposed: visual-specific named groups, typography under Text, geometry/paint under Style; preserve defaults and wire/test every added field.
- Benefit: precise design control without unrelated or ineffective options.
- Priority: P1. Effort: staged by visual family. Full41-visual target tracked separately from implemented controls.


## FORMAT-DETAIL-002 ? Independent axis typography
- Area: Cartesian visual formatting.
- Current experience: one shared axis font/color/size; no independent rotation, weight or spacing controls.
- Proposed improvement: named X-axis and Y-axis label sections with optional explicit overrides.
- User benefit: readable dense categories and separate category/value label styling without changing data or scales.
- Priority: P2. Effort: small shared option adapter plus cross-host regression.


## FORMAT-DETAIL-003 ? Axis label readability
- Area: Cartesian axis labels. Priority: P2.
- Current experience: shared font only; no common width/wrapping/overlap controls.
- Proposed improvement: optional per-axis font, maximum width, overflow mode and overlap suppression.
- User benefit: readable dense/long categories with consistent controls.
- Effort: small shared adapter expansion plus both-host checks.


## SETTINGS-003 ? Distinguish shared container settings from visual appearance
- Area: Formatting pane / all data visuals.
- Current experience: shared palette/card/corner controls and schema-driven mark controls can both be headed Appearance.
- Proposed improvement: name the shared section Colors & container; preserve the visual-specific schema sections.
- User benefit: distinguish palette and card styling from bar/point/arc/tile geometry without opening or guessing between identical headings.
- Effort: Small. Priority: P3.
- Implementation: heading-only change; saved keys, controls, defaults and renderer behavior unchanged. Verification tracked in work-log.md.

SETTINGS-003 verification: implemented; 237/237 pane checks pass across41 types. Palette swatches also have explicit accessible color-scheme names. Main UI build passed.


## SETTINGS-004 ? Keep label visibility with label typography
- Area: Schema-driven label controls. Priority:P2.
- Current: label visibility/content remain under Style while label fonts/colors are under Text.
- Improvement: move showLabels, showValues, showCenterText and labelStyle to Text with their existing settings.
- Benefit: change label content, visibility and appearance in one tab. Saved keys/defaults unchanged.
