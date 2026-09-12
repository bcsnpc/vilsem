# Formatting control acceptance

The requested scope is every exposed control. This pass establishes a traceable inventory and adds semantic assertions; it does **not** certify every control.

[Control acceptance matrix](control-acceptance-matrix.csv): 2,115 visual/config pairs,148 distinct keys across41 visuals, derived from prior inspector discovery. The inventory is not exhaustive of conditional/custom/AI branches. PENDING_CONSOLIDATION means a dedicated semantic result is not linked here; earlier title/text/primitive tests may exist separately. VERIFIED_TEST_VALUE means the tested values passed, not every possible input or combination.

| Current suite | Applicable pass | Excluded / missing oracle | Evidence |
|---|---:|---:|---|
| Axis text and legend color/size, apply and reset |188|126 absent visible ECharts element cases|evidence/format-semantics-after.json|
| Value prefix/suffix and color/size/weight/family |98|0|evidence/value-format-semantics-after.json|
| Every offered legend position and show/hide |40|0|evidence/legend-control-semantics-after.json|

The axis/legend suite mounts all41 visual types in both editor and viewer.126 exclusions are applicability-review entries, not passes. Value testing covers KPI, gauge, bullet, progress, stat card, metric tile and sparkline KPI in both hosts, with standard250, zero and negative250 values. Prefix/suffix and typography are changed using actual inspector controls; rendered DOM styles or ECharts options/display-list text establish the effect. Legend positions use actual dropdowns; show/hide uses the supported config update path. The font tested here is Sora; earlier active rich-text testing covers every offered font and size.

## Repairs

- FORMAT-AXIS-004: explicit axis text color, size and family now reach Cartesian renderers; scale/formatter/visibility preserved. Defaults/reset checked.
- FORMAT-LEGEND-005: grouped/stacked bar editor no longer retains stale legend options.
- FORMAT-VALUE-006: five value-card renderers honor explicit value typography; arc/series values remain unchanged.
- FORMAT-LEGEND-007: Pie/Donut Top legend position is implemented and typed consistently with the inspector.

Unit tests explicitly protect option immutability, domains, formatting functions, default identity, non-Cartesian options, gauge arc/value data and pie slice data. The old two-position schema assertion was updated to the three positions already offered by the inspector, rather than removed.

## Coverage still required

This pass is not blanket color/format acceptance. Palette choices, gradients, opacity, conditional colors, header backgrounds/accents, every data-label path, trend/progress/icon styling, tooltip variants, all custom templates, formatting combinations, dark/light contrast and font glyph availability remain to be consolidated and tested semantically. Controls exposed on unrelated visuals need applicability decisions. Large fonts may uncover additional clipping; the previous156 clipping candidates were not rerun as part of this formatting pass.

Earlier rich-text50/50 and text-box24/24 evidence remains in text-controls-after.json /text-format-after.json; those suites were not rerun for these unrelated chart changes. Field-change299/299 and focused runtime52/52 were rerun after the axis/value/cache fixes, before the isolated pie-top mapping change; pie data preservation and legend UI tests cover that last change.

Harness corrections: the initial font probe used Georgia, which is not an offered inspector option; final runs use Sora. Gauge text is measured from canvas, not DOM-only. Legend edge padding is allowed to differ by renderer. Interrupted exploratory runs are superseded by complete final evidence; no product failure is inferred from those harness errors.

Final verification:455 unit tests pass, same4 baseline failures (`evidence/format-final-suite.json`). Main UI/standalone/Fabric builds passed in isolated cache/qa-build/*-format-final outputs (54.51s/46.65s/39.54s); existing toolchain/chunk warnings remain. Source diff whitespace and new QA script syntax checks passed. Current control CSV links97 visual/config pairs to tested values, marks63 for applicability review and1955 pending consolidation; these are control-pair counts, not runtime assertion counts or overall product approval.
