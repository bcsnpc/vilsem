# Current priority update ? 2026-09-11 night

1. **P0 preservation:** EXPORT-PARTS-028 reproduced; original payload preservation implemented. Byte-level tests and live isolated report roundtrip (30/30 identical parts) pass. Complete insertion-path acceptance before release.
2. **P1 target parity:** existing-report insertion still uses static substitutes (EXPORT-INJECT-030); local export rejects 22 types and slicers/drill. Trace dependencies and migrate with preservation/native-slicer regression tests.
3. **P1 interactions:** remaining secondary-axis cross-filter test failure; complete Service/Fabric per-visual native click, multi-select, drill and reset coverage. Do not restore the old filter API approach without native-slicer compatibility tests.
4. **P1 query/failure correctness:** Fabric dimension-only fix verified live; insertion preparation failure guard verified through four failing-before/passing-after scenarios. Extend UX error/recovery acceptance.
5. **P2 visual/format acceptance:** classify 156 clipping candidates, validate every property semantically, resolve placeholder visual semantics and target typography differences.
6. **P2 AI/release work:** AI config validation, saved-project migrations, dependency audit (Fabric generated template: 44 findings), package lint, installer and recovery acceptance.

See [per-visual target coverage](target-coverage-by-visual.md). Earlier plans below are historical and may refer to defects now verified.

---

# Audit priority plan

## Current priorities after runtime investigation

Repair checkpoint: see [verified fixes](fix-status.md). PERSIST-001 and the reproduced shared P1 issues listed there are verified locally. Remaining work includes AI config/patch semantics, label/title consistency, Ctrl-click support, four baseline test failures and broader acceptance coverage. The table below retains the original issue priority, not an assertion that every listed item is still open.

| Priority | Findings | Acceptance |
|---|---|---|
| P0 | PERSIST-001 project overwrite | Stable identity and duplicate-name behavior; real disk and two-project UI roundtrip |
| P1 | DATA-EDITOR-001 | Field/filter change refreshes editor and viewer |
| P1 | VIS-LINE-001, VIS-FUNNEL-001, VIS-AREA-001 | Safe transitions, truthful empty/error states, filled Area |
| P1 | VIS-STACKED-AREA-001, VIS-HEATMAP-001, VIS-NARRATIVE-001 | Real stacking, visible marks, truthful comparison language |
| P1 | VIS-TABLE-001, SPEC-CUSTOM-001, SPEC-SLICER-001, AI-SLICER-001 | Supported specs survive normalization, validation, persistence and AI edits |
| P1 | FILTER-001, LAYOUT-001, LAYOUT-DRAG-001, TOOLTIP-001 | Slicer scope, positive bounded sizes, literal tooltip data |
| P1 investigation | VIS-BOUNDS-001 | Settled captures plus explicit compact/clipping policy; no blanket overflow hiding |
| P2 | AI-PATCH-001/002, AI-CONFIG-001, SPEC-INPUT-001/002, FORMAT-TITLE-001 | Correct patch semantics, boundary validation and visible property effects |
| P2 | VIS-SUNBURST-001, VIS-COLUMN-001, VIS-WATERFALL-001 | Readable enabled labels at maximum/default bounds |
| P2 | QA-BASELINE-001, INTERACTION-MULTI-001, UX-001 through UX-006 | Resolve original failures; define support and recovery contracts |
| P2 | BUILD-001 legacy configuration | Default package.json config excludes .env; align explicit legacy YAML after tracing callers |
| P3 | Bundle and naming polish | Measured benefit and preserved compatibility |

See fix-status.md and linked defect records for current state. The initial plan below is retained as investigation history; its P0 packaging suspicion was resolved and superseded by the persistence issue, whose reproduced overwrite is now prevented.

## Initial investigation history

This initial audit exists before broad fixes. Priorities are provisional and evidence-driven. No issue is VERIFIED or fixed yet.

| Priority | Finding / work | Next concrete action | Dependencies / acceptance |
|---|---|---|---|
| P0 investigation | BUILD-001 potential .env packaging | Resolve effective builder configuration and file inclusion without packaging credentials | Release gate; no confirmed shipped leak |
| P1 | VIS-LINE-001 hook failures | Focused mounted transition regression, then move hooks ahead of conditional returns | Retest line/area/stacked-area/bump in both hosts |
| P1 | VIS-FUNNEL-001 fabricated empty data | Assert empty/error states, remove production demo fallback | Test legitimate standard/zero data |
| P1 | VIS-TABLE-001 disappearing table | Assert dimension-only layout preservation | Check normalized and freeform viewer + export mapping |
| P1 | SPEC-CUSTOM-001 schema split | Define custom reference/binding validation and registry contract | AI sanitizer, UI save/load, standalone/custom export |
| P1 investigation | VIS-BOUNDS-001 overflow candidates | Reproduce in hosts with long fonts/legends and pointer resizing | Per-visual expected policy; no blanket hidden overflow |
| P2 | QA-BASELINE-001 existing failures | Classify contract drift vs actual output bugs | Do not weaken tests without behavior evidence |
| P2 | AI/UI schema duplication | Resolve every visible control to an operation and renderer key | Deterministic patch tests before schema consolidation |
| P2 | Placeholder visual semantics | Agree support labels for sankey/chord/sunburst/bump/heatmap | Preserve saved specs; no silent visual substitution |
| P2 | Persistence/undo/error UX | Run isolated save/reopen and failure scenarios | Define recovery and duplicate-name policy |
| P3 | Styling, control naming, docs polish | Consolidate only demonstrated duplicate concepts | Screenshot and UX acceptance |

Fix loop: reproduce → expected behavior → focused test → smallest fix → relevant tests → original runtime scenario → related visual regression → update bug evidence and status. Initial findings should be reviewed as a checkpoint; no approval request is needed for ordinary subsequent fixes already authorized by the user.


### Visibility follow-up priority
Eight reproduced issues were repaired in this pass: text pixel-size, text overflow, font-family parsing, live-token refresh, column/waterfall/Sunburst label clipping and navigation label loss. See visibility-status.md for exact evidence and scope. Next prioritize156 remaining clipping candidates by actual information loss, FORMAT-CARD-003 target/caption parity, and UX-TEXT-003 formatting state/accessibility. VIS-POINT-002 is an investigation, not a confirmed clipping defect. Do not interpret zero DOM candidates as canvas/formatting approval.
