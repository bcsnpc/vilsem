# Visual review findings

Current repair status: [verified fixes and remaining work](fix-status.md). Reproduction descriptions below preserve before-fix behavior.

All 41 standard editor screenshots from the settled v3 run were visually inspected. This is standard-state review, not approval of every data/size state. Sunburst was recaptured after animation completion; its earlier blank capture is superseded. Screenshots expose additional issues beyond DOM text metrics.

## VIS-STACKED-AREA-001

- **Status:** VERIFIED (local scope).
- **Fix and verification:** Forward stacked to LineMarks; shared stack and opt-out verified. See [fix status](fix-status.md).

- Area/category/severity: Stacked Area / Rendering, data semantics / High (P1).
- Reproduce/input: Create stacked_area with QA Category and Revenue/Cost values 25/15, 50/30, 75/45, 100/60, default config.
- Expected: Both series share a stack; the cumulative endpoint is 160 for West. A deliberately disabled stacking setting may opt out.
- Actual: Second series is dashed at 60, primary at 100; areas overlap independently. Default stacked=true never reaches the primitive.
- Evidence: `evidence/screenshots/stacked_area-editor-standard.png`; `evidence/review-audit.json` actual series options in both hosts.
- Root cause: `CompactStackedAreaEcharts.jsx` supplies stacked:true, but `CompactLineEcharts.jsx` omits `stacked` from the LineMarks argument; primitive defaults false.

## VIS-COLUMN-001

- Area/category/severity: Column / Labels, clipping / Medium (P2).
- Reproduce/input: Default Column with four categories and 25/50/75/100 in a 480×320 card.
- Expected: Enabled maximum-value label remains readable above or inside its mark.
- Actual: Top of the 100 label is cut at the chart's upper boundary.
- Evidence: `evidence/screenshots/column-editor-standard.png`; settled editor/viewer captures in review-audit.
- Suspected root cause: Vertical BarMarks outside-label position with insufficient Cartesian top/domain headroom. Confirm exact grid/label contract before changing shared margins.
- Status: Verified for the reproduced standard case in both hosts. Fix: reserve outside-label headroom for column/waterfall; position sunburst percentages inside the ring and fit available height. Evidence: evidence/clipping-fixes-after.json (6/6) and visually inspected after screenshots. Extreme size/large-font acceptance remains tracked separately. Regression: settled screenshot plus eventual ECharts label bounding assertion; DOM Range sweep cannot measure this canvas label.

## VIS-WATERFALL-001

- Area/category/severity: Waterfall / Labels, clipping / Medium (P2).
- Reproduce/input: Default Waterfall with four positive values 25/50/75/100 and total enabled, 480×320.
- Expected: Maximum cumulative stage and total labels are readable inside the visual.
- Actual: Highest labels render into/cross the header boundary and are cut.
- Evidence: `evidence/screenshots/waterfall-editor-standard.png`; settled host captures from review-audit.
- Root cause: `CompactWaterfall.jsx` places labels at bottom + height + 1 percent; maximum mark already occupies the full plot height, without a label gutter.
- Status: Verified for the reproduced standard case in both hosts. Fix: reserve outside-label headroom for column/waterfall; position sunburst percentages inside the ring and fit available height. Evidence: evidence/clipping-fixes-after.json (6/6) and visually inspected after screenshots. Extreme size/large-font acceptance remains tracked separately. Regression: retain maximum-stage/total fixture and assert label bounds after the eventual layout fix.

## VIS-NARRATIVE-001

- **Status:** VERIFIED (local scope).
- **Fix and verification:** Name comparison measure and handle zero denominator. Component and mounted tests pass. See [fix status](fix-status.md).

- Area/category/severity: Narrative and Insight / Data interpretation / High (P1).
- Reproduce/input: Bind Revenue and Cost to a category visual; first row North has Revenue=25 and Cost=15; no date or previous-period role is assigned.
- Expected: Generated text names the actual compared measures or requires an explicit previous-period binding before describing temporal change.
- Actual: Auto narrative states Revenue is up 66.7% compared to the previous period, treating Cost as historical Revenue. It also labels the first row as top category, independent of validated sort semantics.
- Evidence: `evidence/screenshots/narrative-editor-standard.png` and `insight-editor-standard.png`; `CompactNarrative.jsx` constructs the sentence from `_val2` without a period-role check.
- Root cause: Generic second-measure normalization is interpreted as a previous-period value in prose.

## Standard-state consistency observations

KPI places title beneath value; stat/metric/bullet/progress cards combine host headers and internal titles. Chord and Sankey show identical donut-style arcs; Sunburst shows one ring; Bump inverts numeric Y instead of tracking ranks. These are recorded capability/UX gaps, not silent proposals to rewrite their engines. Line and Area lack a default visible series legend in this fixture while grouped/stacked bars show one; measure-role/legend acceptance needs an explicit contract.

Ranked List and Table preserve adapter row order. The synthetic adapter does not implement backend sort/aggregation, so screenshots must not be used to infer a production sorting bug. Sparkline KPI standard fixture has no sparkline-axis binding; missing sparkline in that screenshot is an unbound state, not proof of renderer failure.
