# Visual test matrix

**Current execution counts:** [runtime matrix](runtime-test-matrix.md), [property-level results](property-runtime-results.csv), and [coverage limitations](audit-coverage-limitations.md). The table below records the earlier leaf-only checkpoint and is not the current host/UI coverage status.

Status: **Partially tested**. Nine automated leaf-renderer scenarios per ID (369 total): standard, empty, all-zero, mixed negative/tiny/large, null and 120 long Unicode categories at 480×320; standard at 80×60, 160×600, 800×100. State transitions reuse mounted components. Runtime console failures count even if error boundaries recover before measurement.

These checks establish execution and collect geometry, not data correctness or screenshot approval. Custom uses the shipped donut template; bar race gets _cats=[frame,category]. Images and navigation use default/unbound states. Other templates and valid object content need additional cases.

| Visual | Leaf scenarios | Creation/fields UI | Every formatting setting | Hover/select/filter | Save/reopen | Visual approval |
|---|---|---|---|---|---|---|
| kpi | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| bar | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| stacked_bar | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| line | 9 executed; hook errors | Not tested | Not tested | Not tested | Not tested | Pending |
| area | 9 executed; hook errors | Not tested | Not tested | Not tested | Not tested | Pending |
| donut | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| pie | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| gauge | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| radar | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| scatter | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| bubble | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| treemap | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| funnel | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| sankey | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| table | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| column | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| waterfall | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| lollipop | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| bullet | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| progress | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| heatmap | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| ranked_list | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| stat_card | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| metric_tile | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| grouped_bar | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| stacked_area | 9 executed; hook errors | Not tested | Not tested | Not tested | Not tested | Pending |
| sparkline_kpi | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| slope | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| bump | 9 executed; hook errors | Not tested | Not tested | Not tested | Not tested | Pending |
| chord | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| sunburst | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| narrative | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| insight | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| waffle | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| bar_race | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| nav_button | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| text_box | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| shape | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| image | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| divider | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |
| custom | 9 executed | Not tested | Not tested | Not tested | Not tested | Pending |

## Required cases per visual

1. Create through each supported menu; verify defaults and explicit empty state.
2. Bind, remove, replace and reorder dimensions/measures; invalid role combinations; scalar vs category query result.
3. Enumerate controls including conditional sections, dynamic template params, title/legend/axis typography and reset-to-default. Each exposed property requires one spec assertion and one observable rendering assertion. See property-coverage.csv; lexical discovery is incomplete until UI enumeration.
4. Resize via drag and numeric inputs at tiny/small/medium/large and extreme ratios, minimum limits and page boundaries; repeat with zoom.
5. Data: duplicates, empty/null, zeros, negatives, huge/tiny values, one category/point, dense Unicode labels, dates; no production data.
6. Hover at each viewport edge, click, Ctrl/Meta multi-select, deselect, cross-filter and source-chart retention where supported; drill/axis switching and page navigation.
7. Save, reload and reopen with all settings preserved; rename, duplicate, delete, recovery and failed-write behavior in a disposable profile.
8. Expected integrity: bounded marks; readable/truncated labels; scrollable legends/tables where intentional; accurate values; no neighboring panel overlap.
