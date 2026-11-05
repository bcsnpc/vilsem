# Format changes from stress round2

The authoritative API and bounds are in the MCP [spec-format reference](https://github.com/bcsnpc/vilsem-mcp/blob/main/docs/spec-format.md).
These operations are trusted core code. Templates cannot supply executable callbacks.

| Area | Additions | Main implementation |
| --- | --- | --- |
| Query-only measures | `spec.measures`, schema/reference/cycle/name guards, engine validation, `DEFINE MEASURE` preview and inline `NativeMeasure` report bindings; no TMDL writes | `packages/core/src/dax/scopedMeasures.js`, `bindings.js`, `pbir/injectVisual.js`; MCP `server.ts` |
| Data/host roles | All six measure/category roles retained through SSR and categorical host normalization; original row identities survive sorting/aggregation | `dax/row-normalize.js`, renderer capabilities/selection routing |
| Declarative structure | `concat`, bounded record repeats, bare `$item`, safe nested field/index access, source `rowIndexes`, more precise unsupported-series/geo refusals | `templates/instantiate.js` |
| Accessors/formatters | `{label}`, indexed tuple values0..5, date/percent/thousands aliases, per-facet values/summaries, current-row `lastRowValue/lastRowLabel`, literal `formatterEmptyText`; format3 | `templates/instantiate.js` |
| Bounded layouts | `points`/deterministic sampling, `chunk`, parameterized/strict `top` with optional Other, integer `allocate` grid/hemicycle, explicit `tiles` | `layout-transforms.js` |
| Sequences | Signed/all-zero-crossing waterfalls, start/end/subtotal/connector geometry; Heikin-Ashi from valid OHLC | `sequence-transforms.js` |
| Hierarchies/flows | Partition/icicle and packing geometry with optional second-measure colour,2..6-stage flows, graph layouts/source-identified links; fixed-width partition label bounds | `transforms.js`, `flow-transforms.js` |
| Temporal | UTC calendar/ADOMD DateTime conversion, balanced grouped intervals/milestones, normalized inside-out wiggle/silhouette stream layout | `date-utils.js`, `temporal-transforms.js` |
| Analytics | Stage conversion, calendar date bands, EWMA; grouped median/quantile/count/stddev/statistic records | `analytic-transforms.js`, `transforms.js` |
| Distributions | Auto/fixed/width-parameter histograms, R7/Tukey boxes and observed outliers, exact-tie right-continuous ECDF, compensated/normalized statistics | `distribution-transforms.js` |
| Density/collision | Bounded Gaussian violin/ridgeline paths and2-D density cells; fixed-size deterministic non-overlap swarm | `density-transforms.js`, `jitter-transform.js`, `statistical-transforms.js` |
| Derived/relational | Normal Q-Q positions, axial hexbin counts, grouped shares/subtotals, conditional data styling, per-group rebase, long-to-wide pivot, pairwise-complete Pearson matrix, observed-membership cohorts, Pareto threshold counts | `statistical-transforms.js` |
| Word cloud | Unicode weighted terms, conservative fixed-font rectangle packing, bounded deterministic placement as standard graph labels; no wordCloud/custom-series plugin | `word-layout.js` |
| Compatibility | Per-feature renderer floors; latest packaged renderer4.31. Existing GUID/property key remain unchanged; an old report's resource is never silently upgraded by commit | `pbir/rendererCompatibility.js` |
| Native behaviour | Expanded native modules, transformed tooltip/selection/edge identity routing, tree collapse and hierarchy navigation restoration, author-opacity-preserving selection/label dimming | `vilsem-renderer/src/visual.ts` |
| Preview failure isolation | Resvg runs in a bounded child worker; rasterizer failure does not terminate MCP | MCP `preview.ts`, `rasterize.cjs` |

Native rendering acceptance uses real model queries and saved screenshots at900x600.
Fixed-size swarm/word geometry must match its declared plot dimensions. A density
estimate is not an observation count; correlation uses pairwise-complete rows;
the CI fixture explicitly assumes independent monthly observations. The cohort
fixture selects real customer keys11000..11049 to fit complete histories in both
query windows (91 returned rows,12 periods). Do not infer population membership
outside a filtered/truncated query window.

Every passing authored example is shipped in `vilsem-mcp/templates/`.
The nine unresolved capabilities and exact refusals are in the MCP
[gap report](https://github.com/bcsnpc/vilsem-mcp/blob/main/docs/expressiveness-gaps.md).
They are not implemented or shipped as working examples.

## Item-level format provenance (Round 3 reconstruction)

Reconstructed from the shipped passing specs and the core changes since `core-v0.3.0` (public commits `67944f9`, `331ce7f`, `2078a89`, `2730bc0`). The old matrix retains only one explicit `(b)` classification, so it cannot substantiate an exact historical count of 25 fallbacks. This table covers **every transform actually used by all 111 passing examples**, including derived approaches; it does not relabel those cases or infer missing historical classifications.

| Feature | Stress2 item numbers | Regression suite | Complete shipped example |
| --- | --- | --- | --- |
| `allocate` | 23, 24 | `tests/stress2-layout-shaping.test.js` | [stress2-023-waffle-share.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-023-waffle-share.vilsem-visual.json) |
| `boxplot` | 91 | `tests/stress2-distribution-shaping.test.js` | [stress2-091-box-detail-prices.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-091-box-detail-prices.vilsem-visual.json) |
| `calculate` | 4, 5, 6, 14, 28, 29, 32, 33, 36, 59, 67, 74, 75, 79 | `tests/instantiateVisual.test.js` | [stress2-004-confidence-band.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-004-confidence-band.vilsem-visual.json) |
| `chunk` | 15 | `tests/stress2-layout-shaping.test.js` | [stress2-015-wrapped-bar.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-015-wrapped-bar.vilsem-visual.json) |
| `cohort` | 105 | `tests/stress2-statistical-shaping.test.js` | [stress2-105-cohort-retention.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-105-cohort-retention.vilsem-visual.json) |
| `conditional` | 102 | `tests/stress2-statistical-shaping.test.js` | [stress2-102-yoy-variance.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-102-yoy-variance.vilsem-visual.json) |
| `conversion` | 73 | `tests/stress2-analytic-shaping.test.js` | [stress2-073-funnel-conversion.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-073-funnel-conversion.vilsem-visual.json) |
| `correlation` | 107 | `tests/stress2-statistical-shaping.test.js` | [stress2-107-pearson-six.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-107-pearson-six.vilsem-visual.json) |
| `date` | 72, 77 | `tests/instantiateVisual.test.js` | [stress2-072-event-timeline.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-072-event-timeline.vilsem-visual.json) |
| `dateBands` | 77 | `tests/stress2-analytic-shaping.test.js` | [stress2-077-weekend-bands.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-077-weekend-bands.vilsem-visual.json) |
| `density` | 92, 96 | `tests/stress2-density-shaping.test.js` | [stress2-092-violin-density.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-092-violin-density.vilsem-visual.json) |
| `density2d` | 99 | `tests/stress2-statistical-shaping.test.js` | [stress2-099-density2d-price-cost.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-099-density2d-price-cost.vilsem-visual.json) |
| `ecdf` | 95 | `tests/stress2-distribution-shaping.test.js` | [stress2-095-ecdf.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-095-ecdf.vilsem-visual.json) |
| `facet` | 6, 7, 59, 60, 66, 69, 70, 83, 84, 103 | `tests/instantiateVisual.test.js` | [stress2-006-horizon.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-006-horizon.vilsem-visual.json) |
| `flows` | 49, 50, 51, 52, 53, 54, 55, 56, 58 | `tests/stress2-flow-shaping.test.js` | [stress2-049-sankey-two-levels.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-049-sankey-two-levels.vilsem-visual.json) |
| `groupShare` | 101 | `tests/stress2-statistical-shaping.test.js` | [stress2-101-group-percent-subtotals.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-101-group-percent-subtotals.vilsem-visual.json) |
| `heikinAshi` | 35 | `tests/stress2-sequence-shaping.test.js` | [stress2-035-heikin-ashi.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-035-heikin-ashi.vilsem-visual.json) |
| `hexbin` | 98 | `tests/stress2-statistical-shaping.test.js` | [stress2-098-hexbin-price-cost.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-098-hexbin-price-cost.vilsem-visual.json) |
| `hierarchy` | 20, 40, 41, 42, 43, 44, 45, 46, 47, 48, 118 | `tests/stress2-hierarchy-color.test.js` | [stress2-020-nested-donut.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-020-nested-donut.vilsem-visual.json) |
| `histogram` | 89, 90, 110 | `tests/stress2-distribution-shaping.test.js` | [stress2-089-histogram-auto.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-089-histogram-auto.vilsem-visual.json) |
| `intervals` | 71 | `tests/stress2-temporal-shaping.test.js` | [stress2-071-gantt-country.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-071-gantt-country.vilsem-visual.json) |
| `jitter` | 93 | `tests/stress2-jitter-shaping.test.js` | [stress2-093-beeswarm.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-093-beeswarm.vilsem-visual.json) |
| `pareto` | 108 | `tests/stress2-statistical-shaping.test.js` | [stress2-108-pareto-count.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-108-pareto-count.vilsem-visual.json) |
| `pivot` | 106 | `tests/stress2-statistical-shaping.test.js` | [stress2-106-pivot-heatmap.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-106-pivot-heatmap.vilsem-visual.json) |
| `points` | 16, 25, 34, 61, 62, 63, 64, 65, 67, 72, 75, 77, 78, 81, 82, 94 | `tests/stress2-layout-shaping.test.js` | [stress2-016-revenue-strip.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-016-revenue-strip.vilsem-visual.json) |
| `qq` | 97 | `tests/stress2-statistical-shaping.test.js` | [stress2-097-normal-qq.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-097-normal-qq.vilsem-visual.json) |
| `rebase` | 103 | `tests/stress2-statistical-shaping.test.js` | [stress2-103-rebase-index.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-103-rebase-index.vilsem-visual.json) |
| `stat` | 6, 36, 62, 75, 79, 94 | `tests/instantiateVisual.test.js` | [stress2-006-horizon.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-006-horizon.vilsem-visual.json) |
| `stream` | 68 | `tests/stress2-temporal-shaping.test.js` | [stress2-068-wiggle-streamgraph.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-068-wiggle-streamgraph.vilsem-visual.json) |
| `tiles` | 115 | `tests/stress2-statistical-shaping.test.js` | [stress2-115-country-tile-grid.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-115-country-tile-grid.vilsem-visual.json) |
| `top` | 21, 86, 100 | `tests/stress2-layout-shaping.test.js` | [stress2-021-pie-top-other.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-021-pie-top-other.vilsem-visual.json) |
| `waterfall` | 31, 33 | `tests/stress2-sequence-shaping.test.js` | [stress2-031-waterfall-subtotals.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-031-waterfall-subtotals.vilsem-visual.json) |
| `window` | 30, 32, 69, 70, 80 | `tests/instantiateVisual.test.js` | [stress2-030-pareto.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-030-pareto.vilsem-visual.json) |
| `words` | 116 | `tests/stress2-word-layout.test.js` | [stress2-116-word-cloud.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-116-word-cloud.vilsem-visual.json) |

### Structural, token and query features

| Feature | Stress2 item numbers | Regression suite | Complete example |
| --- | --- | --- | --- |
| `concat` | 6, 43, 59, 68, 78, 81, 82, 94, 118 | `tests/stress2-repeat-data.test.js` | [stress2-006-horizon.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-006-horizon.vilsem-visual.json) |
| `formatterEmptyText` | 85 | `tests/stress2-kpi-accessors.test.js` | [stress2-085-kpi-sparkline.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-085-kpi-sparkline.vilsem-visual.json) |
| `formatterTemplate` | 1, 2, 3, 4, 5, 8, 9, 11, 12, 13, 14, 15, 17, 22, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 38, 39, 40, 43, 44, 45, 46, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 106, 107, 108, 109, 115, 116, 118 | `tests/stress2-native-tooltip.test.js` | [stress2-001-step-line.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-001-step-line.vilsem-visual.json) |
| `lastRowValue/lastRowLabel` | 85 | `tests/stress2-kpi-accessors.test.js` | [stress2-085-kpi-sparkline.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-085-kpi-sparkline.vilsem-visual.json) |
| `repeat/$item` | 6, 7, 15, 23, 24, 43, 44, 59, 60, 65, 66, 67, 68, 69, 70, 78, 81, 82, 83, 84, 92, 93, 94, 96, 103, 118 | `tests/stress2-repeat-data.test.js` | [stress2-006-horizon.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-006-horizon.vilsem-visual.json) |
| `visual-scoped measures` | 1, 3, 4, 5, 7, 8, 9, 10, 11, 19, 25, 26, 27, 29, 33, 34, 35, 36, 37, 55, 57, 66, 67, 74, 75, 78, 79, 81, 82, 85, 102, 104, 105 | `tests/scoped-measures.test.js` | [stress2-001-step-line.vilsem-visual](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-001-step-line.vilsem-visual.json) |
