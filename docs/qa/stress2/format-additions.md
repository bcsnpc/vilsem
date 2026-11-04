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
