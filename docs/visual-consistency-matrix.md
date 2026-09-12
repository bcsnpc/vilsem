# Visual consistency matrix

Runtime follow-up: [all-type execution matrix](qa/runtime-test-matrix.md), [property results](qa/property-runtime-results.csv), [clipping review](qa/clipping-review.md), and [standard visual review](qa/visual-review-findings.md). Equivalent controls do not imply equivalent rendering: shared headers ignore title weight, Area misses type context, Stacked Area drops stacking, and Heatmap/Sunburst use incompatible label/size assumptions. Initial source references below are retained for traceability.

Initial source evidence, not pass/fail certification. “Ref” means a source reference was found; absence may reflect host-owned behavior. All visuals share a host position/config contract, but chrome, axes, tooltip and marks do not share one universal implementation. Compare with [visual architecture](visual-architecture.md).

| ID | Engine | Schema fields | Shared primitives | Click ref | Tooltip ref | Overflow candidates / 9 |
|---|---|---:|---|---|---|---:|
| kpi | DOM/CSS | 0 | — | — | — | 0 |
| bar | ECharts Canvas | 15 | CartesianFrame, CategoricalAxis, LinearAxis, BarMarks, Tooltip, Legend | Ref | Ref | 0 |
| stacked_bar | ECharts Canvas | 15 | CartesianFrame, CategoricalAxis, LinearAxis, BarMarks, Tooltip, Legend | Ref | Ref | 0 |
| line | ECharts Canvas | 15 | LineMarks | Ref | Ref | 0 |
| area | ECharts Canvas | 15 | LineMarks | Ref | Ref | 0 |
| donut | ECharts Canvas | 12 | PieMarks | Ref | Ref | 0 |
| pie | ECharts Canvas | 12 | PieMarks | Ref | Ref | 0 |
| gauge | ECharts Canvas | 6 | GaugeMarks | — | Ref | 0 |
| radar | ECharts Canvas | 5 | RadarMarks | Ref | Ref | 0 |
| scatter | ECharts Canvas | 6 | PointMarks | — | Ref | 0 |
| bubble | ECharts Canvas | 6 | PointMarks | — | Ref | 0 |
| treemap | ECharts Canvas | 10 | TreemapMarks | Ref | Ref | 0 |
| funnel | DOM/CSS | 0 | — | — | — | 2 |
| sankey | DOM + SVG | 0 | — | — | — | 2 |
| table | DOM/CSS | 0 | — | — | — | 0 |
| column | ECharts Canvas | 15 | CartesianFrame, CategoricalAxis, LinearAxis, BarMarks, Tooltip, Legend | Ref | Ref | 0 |
| waterfall | DOM/CSS | 0 | — | — | — | 1 |
| lollipop | ECharts Canvas | 5 | — | — | Ref | 0 |
| bullet | DOM/CSS | 0 | — | — | — | 1 |
| progress | DOM/CSS | 5 | — | — | — | 1 |
| heatmap | DOM/CSS | 0 | — | — | Ref | 7 |
| ranked_list | DOM/CSS | 0 | — | — | — | 0 |
| stat_card | DOM/CSS | 0 | — | — | — | 1 |
| metric_tile | DOM + SVG | 0 | — | — | — | 1 |
| grouped_bar | ECharts Canvas | 15 | CartesianFrame, CategoricalAxis, LinearAxis, BarMarks, Tooltip, Legend | Ref | Ref | 0 |
| stacked_area | ECharts Canvas | 15 | LineMarks | Ref | Ref | 0 |
| sparkline_kpi | DOM/CSS | 0 | — | — | — | 1 |
| slope | ECharts Canvas | 6 | — | — | Ref | 0 |
| bump | ECharts Canvas | 15 | LineMarks | Ref | Ref | 0 |
| chord | DOM + SVG | 0 | — | — | — | 2 |
| sunburst | Recharts SVG | 0 | — | — | Ref | 2 |
| narrative | DOM/CSS | 0 | — | — | — | 1 |
| insight | DOM/CSS | 0 | — | — | — | 1 |
| waffle | DOM/CSS | 0 | — | — | — | 4 |
| bar_race | ECharts Canvas | 9 | — | — | Ref | 2 |
| nav_button | DOM/CSS | 0 | — | — | — | 0 |
| text_box | DOM/CSS | 6 | — | — | — | 0 |
| shape | DOM + SVG | 6 | — | — | — | 0 |
| image | DOM/CSS | 5 | — | — | — | 1 |
| divider | DOM/CSS | 4 | — | — | — | 0 |
| custom | ECharts Canvas | 0 | — | — | Ref | 0 |

## Cross-cutting gaps to validate

- **Container:** CanvasEditor uses hard minimum drag sizes and nested overflow:hidden; leaf DOM renderers may exceed them. ECharts has ResizeObserver; DOM/SVG components often use fixed font/shape sizes. No universal minimum readable plot policy.
- **Title:** Host headers and KPI-family body titles differ. CanvasEditor header hardcodes fontWeight 600; defaults resolver reports 500. Explicit alignment/weight propagation needs control-by-control validation.
- **Legend:** ECharts Legend primitive, dedicated DOM legend and Recharts tooltip/legend paths coexist. Max-items behavior differs; chord truncates to eight legend entries.
- **Axes:** Primitive-based Cartesian charts vs standalone visual options vs no axes. `gridLines` and `showGrid` names both exist across UI/AI schemas.
- **Marks/labels:** Shared marks schemas coexist with manual cards and custom template params. Defaults and hidden fields have a separate per-type map.
- **Tooltip:** ECharts overrides cover enabled/trigger, but content is built in several places. Heatmap uses native title; sunburst uses Recharts. Confine is not proof of readable edge behavior.
- **Selection:** _onBarClick references are partial evidence only. Host click/deselect and cross-filter differ from editor selection and Power BI host selection IDs.
- **Errors:** Funnel and several cards do not consume the error prop. Line-family transitions log hook failures.

Every supported title/font, axis/tick/grid, mark/stroke, label, legend and tooltip setting needs an explicit UI→spec→render assertion before marking parity PASS.
