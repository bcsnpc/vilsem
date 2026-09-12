# Runtime visual test matrix

After-fix update: all 41 types were rerun in editor and viewer, with **299/299 field-change checks** passing and **1,230 data/size cases** completed without unexpected console errors. The rows below retain before-fix property-probe counts. Current per-type field results are in evidence/data-audit-after.json; current geometry cases are in evidence/edge-audit-after.json. See fix-status.md for precise verification scope.

Updated 2026-09-07. Counts mean executed probes, not approved behavior. See [coverage limitations](audit-coverage-limitations.md). All 41 types have an isolated production persistence roundtrip; the actual authoring workflow covers Bar.

| Visual | Default host mounts | Settled edge cases | Inspector attempts | State updated (initial) | Valid Hex retests | Visual acceptance |
|---|---:|---:|---:|---:|---:|---|
| kpi | 2 | 30/30 | 130 | 128 | 2 | Pending |
| bar | 2 | 30/30 | 158 | 156 | 2 | Pending |
| stacked_bar | 2 | 30/30 | 150 | 148 | 2 | Pending |
| line | 2 | 30/30 | 142 | 140 | 2 | Pending |
| area | 2 | 30/30 | 144 | 142 | 2 | Pending |
| donut | 2 | 30/30 | 160 | 158 | 2 | Pending |
| pie | 2 | 30/30 | 156 | 154 | 2 | Pending |
| gauge | 2 | 30/30 | 130 | 128 | 2 | Pending |
| radar | 2 | 30/30 | 120 | 118 | 2 | Pending |
| scatter | 2 | 30/30 | 122 | 120 | 2 | Pending |
| bubble | 2 | 30/30 | 122 | 120 | 2 | Pending |
| treemap | 2 | 30/30 | 152 | 150 | 2 | Pending |
| funnel | 2 | 30/30 | 112 | 110 | 2 | Pending |
| sankey | 2 | 30/30 | 112 | 110 | 2 | Pending |
| table | 2 | 30/30 | 118 | 116 | 2 | Pending |
| column | 2 | 30/30 | 158 | 156 | 2 | Pending |
| waterfall | 2 | 30/30 | 112 | 110 | 2 | Pending |
| lollipop | 2 | 30/30 | 134 | 132 | 2 | Pending |
| bullet | 2 | 30/30 | 130 | 128 | 2 | Pending |
| progress | 2 | 30/30 | 130 | 128 | 2 | Pending |
| heatmap | 2 | 30/30 | 112 | 110 | 2 | Pending |
| ranked_list | 2 | 30/30 | 112 | 110 | 2 | Pending |
| stat_card | 2 | 30/30 | 130 | 128 | 2 | Pending |
| metric_tile | 2 | 30/30 | 130 | 128 | 2 | Pending |
| grouped_bar | 2 | 30/30 | 150 | 148 | 2 | Pending |
| stacked_area | 2 | 30/30 | 138 | 136 | 2 | Pending |
| sparkline_kpi | 2 | 30/30 | 130 | 128 | 2 | Pending |
| slope | 2 | 30/30 | 124 | 122 | 2 | Pending |
| bump | 2 | 30/30 | 138 | 136 | 2 | Pending |
| chord | 2 | 30/30 | 112 | 110 | 2 | Pending |
| sunburst | 2 | 30/30 | 112 | 110 | 2 | Pending |
| narrative | 2 | 30/30 | 112 | 110 | 2 | Pending |
| insight | 2 | 30/30 | 112 | 110 | 2 | Pending |
| waffle | 2 | 30/30 | 112 | 110 | 2 | Pending |
| bar_race | 2 | 30/30 | 134 | 132 | 2 | Pending |
| nav_button | 2 | 30/30 | 104 | 104 | 0 | Pending |
| text_box | 2 | 30/30 | 106 | 98 | 0 | Pending |
| shape | 2 | 30/30 | 100 | 100 | 0 | Pending |
| image | 2 | 30/30 | 94 | 94 | 0 | Pending |
| divider | 2 | 30/30 | 94 | 94 | 0 | Pending |
| custom | 2 | 30/30 | 130 | 128 | 2 | Pending |

Nine initial leaf scenarios per type are retained in renderer-smoke.json. Property coverage includes default and expanded Style/Text/Layout controls, with one alternative per select. Data-tab binding, active rich text, all conditional branches and per-visual interactions remain partial. All fifteen edge cases per host are listed in scripts/qa/edge-audit.cjs.
