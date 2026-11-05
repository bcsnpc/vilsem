# Native number-format acceptance

Status: **Verified for the two percentage fixtures below**, not an exhaustive format or interaction acceptance.

On 2026-11-03, Power BI Desktop `AdventureWorks Report_FINAL`, private Round3 QA copy, page `Stress3 Checks`, renderer 4.33.0.0:

| Fixture | Model/query value | Label | Value axis | Power BI host tooltip |
| --- | --- | --- | --- | --- |
| Query-scoped exact-percent fixture | 0.2345 | 23.45% | 23.45% upper tick | 23.45% |
| Actual profit / revenue, Accessories | Real scoped DIVIDE([Total Profit], [Total Revenue]) | 62.84% | Percentage ticks | 62.84% |

`format-first-native.png` records labels and axes through the official Desktop report bridge. The native tooltip popups were directly observed through Computer Use on both bars; those window captures are tool observations, not saved PNG artifacts. The tooltip currently captions the template result as `Details`; bound-field caption improvements remain open. Do not mistake the exact-percent engine fixture for a business ratio.

The actual MCP validate/explain/preview/commit records are under the private `D:/vilsem-mcp/test-results/stress3/` directory. Original supplied PBIP is untouched. The private QA model integrity baseline remains `cache/round3-model-hashes.json` and must be checked again after closing Desktop before release.

Not yet verified here: native card cross-filter, Ctrl multi-select, native slicer, incoming native cross-highlight, configured drill-through, report-page tooltip, bookmark recall and Edit interactions None. These have separate Group A gates.


2026-11-04 additional heatmap check: `Stress3 Theme Light`, page
`Format conformance`, native renderer33. A query-scoped calibration measure
returns0.2345; every cell label and the actual Power BI host tooltip displays
23.45%. A second heatmap uses real scoped profit/revenue ratios and shows
percentage labels. Evidence: `matrix-native-tooltip.png` (native tooltip crop;
provenance JSON retained), `theme-native/stress3_matrix_fixture.png` and
`theme-native/stress3_matrix_actual.png` (official bridge chart captures).
These do not yet verify the new renderer34 candidate. Interaction results live
in `../interactions/round3-status.md`; the earlier pending list above is historical.
