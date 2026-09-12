# All-visual continuation findings

Current repair status: [verified fixes and remaining work](fix-status.md). Reproduction descriptions below preserve before-fix behavior.

## DATA-ERROR-001

- **Status:** VERIFIED (local scope).
- **Fix and verification:** Propagate editor errors; retain viewer cards on empty/error. visual-fix-regressions.json passes. See [fix status](fix-status.md).

- Area/category/severity: Editor and viewer / Error recovery, UX / High (P1).
- Reproduce: In the mounted production hosts, change a line or Funnel query from populated to a returned `{error:'QA query failure'}`; also test an empty result.
- Expected: Keep the authored visual in place and show its empty/error state; recover when data returns.
- Actual: Editor normalizes error responses as empty data and always supplies error=null to renderers. Viewer explicitly removes non-KPI visuals on error/empty and recalculates layout, concealing the failure.
- Evidence: initial `visual-fix-regressions.json` failed error/empty assertions; CanvasEditor query branches and AppSpecRenderer hiddenVisualIds logic.
- Root cause: Editor lacks visual error state; viewer treats runtime empty/error results as AI over-generation.
- Regression: scripts/qa/visual-fix-regressions.cjs populated/empty/error/recovery in both hosts.

## VIS-RACE-001

- **Status:** VERIFIED (local scope).
- **Fix and verification:** Clear chart on empty/loading/error. data-audit-after.json passes. See [fix status](fix-status.md).

- Area/category/severity: Bar Race / Stale rendering / High (P1).
- Reproduce: Populate Bar Race with Category, Revenue and Date play axis; remove all measures in either host.
- Expected: No old marks remain behind the empty-state message.
- Actual: Old series values remain on the always-mounted ECharts canvas; the transparent empty overlay does not clear them.
- Evidence: data-audit-before.json, data-audit-after.json; two failures after shared query fixes. Old 25/75 and 15 bars remain in chart options.
- Root cause: Draw effect exits for zero frames without clearing chart; loading/error overlays are transparent.
- Regression: scripts/qa/data-audit.cjs measure-removal assertions across all visual IDs.

## VIS-GAUGE-001

- Area/category/severity: Gauge / Empty state, resize lifecycle / Medium (P2).
- Reproduce/input: Load Revenue in Gauge, then remove all measures in either host.
- Expected: Empty-state message, distinct from a valid measured zero.
- Actual before fix: Empty rows produced a zero gauge. The sizing observer also attached only on initial mount, when a loading return could omit its root.
- Root cause: GaugeMarks defaults empty data to zero and wrapper lacked an empty guard; observer root disappeared in loading/error states.
- Status: VERIFIED locally.
- Fix: Keep the observer root mounted and render loading/error/empty content inside it; mount chart only with rows.
- Evidence/regression: visual-fix-regressions.json Gauge empty checks and data-audit-after.json all-type removal; valid populated path remains exercised.
