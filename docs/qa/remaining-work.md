# Remaining product-quality work

This checklist tracks the requested areas. A passing scoped regression does not complete its entire area. Continue without a new approval step for routine investigation and fixes.

| Area | Verified progress | Remaining acceptance |
|---|---|---|
| Clipping/rendering | Standard Heatmap/Column/Waterfall/Sunburst fixes; Bullet endpoint, negative and zero-domain geometry | Review remaining settled candidates by information loss; tiny/extreme sizes, legends, marks and canvas labels |
| Visual-specific formatting | Card/text expansions and independent axis/readability controls | Line/area, pie/donut, scatter/bubble, hierarchy/flow, tables and other family-specific controls |
| Colors/appearance | Scoped value, axis and card color checks | Per-series overrides, gradients, opacity, borders, themes and selected/unselected appearance across families |
| Text/labels | Rich-text/value/title/axis scoped checks; long Unicode ellipsis | Full legend/tooltip/data-label/date/number controls; mixed styles, wrapping combinations and accessibility |
| Settings usability | All41 pane applicability checks; shared named sections | Advanced discoverability, clutter reduction, consistent defaults/help/reset and each control's acceptance |
| Interactions | Native16/16 suite; Bar/Column/Grouped/Stacked modifier add/remove/clear/plain replacement and emphasis | Other visual families, Mac-native modifier input, Power BI secondary-axis cross-filtering |
| AI/UI parity | Remove-measure and sequential patch operations verified | Shared complete typed config contract, invalid-type/unknown-key rejection, new-control hints, live provider validation |
| Persistence/recovery | Isolated production pipeline checks include registry roundtrip, dataset isolation, update/rename/delete/collision | New keys through full user save/reopen, older-project compatibility, undo/recovery and fault handling |
| Regression testing | Full suite465pass/1fail; all three builds pass | EXPORT-AXIS-010 real capability gap; deterministic screenshots beyond diagnostic captures; full per-control coverage |

Next: continue clipping candidate triage and complete visual families with their formatting/interaction/persistence tests together. The Power BI runtime gap requires a compatible multi-role binding design and integration verification; do not revert to previously broken routing. See bug-log.md for defect-level evidence.


Latest scope expansion: see [full local round](full-round-report.md) for Present, both Playgrounds and built web/Fabric artifacts. Successful local runtime checks do not complete tenant publication, native-keyboard, library persistence or exhaustive visual acceptance. Latest unit baseline470pass/1fail.
