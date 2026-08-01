# Semantica — Migration Risks

**Purpose:** Document the concrete risks and surface area for five specific migrations being considered. Factual analysis based on [current-state.md](./current-state.md).
**Last updated:** 2026-04-21.

Each section describes what exists, what would break, and the size of the change. No decisions or recommendations — just the shape of each lift.

---

## 1. Splitting `AppSpecRenderer.jsx` into per-component files

### 1.1 Current file's public API

[`AppSpecRenderer.jsx`](../../ui/src/appspec/AppSpecRenderer.jsx) has three named/default exports:

| Line | Export | What it is |
|---|---|---|
| 206 | `getCardChromeStyle` (named) | Card chrome style builder |
| 2226 | `VISUAL_MAP` (named) | `visual.type` → component reference map |
| 2411 | `AppSpecRenderer` (default) | Main renderer component |

Everything else (31 Compact* components, `getThemeTokens`, `PALETTES`, `pal`, `getColorValue`, `hexToRgb`, `fmtVal`, `AppBarTooltip`, `LoadingShimmer`, `EmptyState`, `SparklineSvg`, `useCountUp`, `getCardAnimation`, `getHoverHandlers`, `normalizeLayout`, `buildAppliedFiltersForVisual`, `getSourceSelectedCat`) is file-scoped.

### 1.2 External importers (5 files)

```
ui/src/standalone/index.jsx:3
  import AppSpecRenderer from '../appspec/AppSpecRenderer.jsx'

ui/src/pages/AppGenerator.jsx:2
  import AppSpecRenderer from '../appspec/AppSpecRenderer.jsx'

ui/src/appspec/CanvasEditor.jsx:2
  import { VISUAL_MAP, getCardChromeStyle } from './AppSpecRenderer.jsx'

ui/src/pages/powerbi/InspectorPanel.jsx:4
  import { VISUAL_MAP } from '../../appspec/AppSpecRenderer'

ui/src/pages/powerbi/LiveCanvas.jsx:2
  import AppSpecRenderer from '../../appspec/AppSpecRenderer'
```

Total external import surface: **default export** + **`VISUAL_MAP`** + **`getCardChromeStyle`**. No other internal symbols leak.

### 1.3 What breaks

**Nothing breaks if the 3-symbol public API stays at the same import path.** The split can be purely internal. Two viable shapes:

**Option A — "facade" preserves import paths**
- Move each Compact* to `ui/src/appspec/visuals/Compact<Type>.jsx`
- Move shared primitives to `ui/src/appspec/shared/` (theme, palettes, helpers, hooks)
- `AppSpecRenderer.jsx` imports each Compact* and re-builds `VISUAL_MAP` locally
- Keeps `export { getCardChromeStyle, VISUAL_MAP }` + `export default AppSpecRenderer`
- Zero external import changes

**Option B — distribute the public API**
- Same internal split as Option A
- Move `VISUAL_MAP` to `ui/src/appspec/visuals/index.js`
- Move `getCardChromeStyle` to `ui/src/appspec/shared/chrome.js`
- Update 2 external files (`CanvasEditor.jsx`, `InspectorPanel.jsx`) to import from the new paths
- `AppSpecRenderer.jsx` still owns the main component

### 1.4 Imports that need updating

| Scope | Files touched | Updates needed |
|---|---|---|
| Option A (facade) | 0 external, ~32 internal | Each Compact* gains imports for shared helpers; `AppSpecRenderer.jsx` imports and re-exports |
| Option B (distributed) | 2 external + ~32 internal | Plus `CanvasEditor.jsx:2` and `InspectorPanel.jsx:4` |

### 1.5 Circular dependency risks

Low to none, **if layering is strict**:

```
shared/theme.js, shared/palettes.js, shared/chrome.js, shared/hooks.js, shared/atoms.js
    ↑
visuals/CompactKpi.jsx, CompactBar.jsx, …  (import from shared)
    ↑
visuals/index.js (VISUAL_MAP — imports every Compact*)
    ↑
AppSpecRenderer.jsx (imports VISUAL_MAP + shared — assembles render paths)
```

**Concrete risks:**

- `AppBarTooltip` (line 381) is passed to Recharts `<Tooltip content={…} />`. If moved to `shared/` and any Compact* imports from `visuals/index.js` for the MAP, that's a cycle. Mitigation: tooltip lives in `shared/`, never references MAP.
- `getCardChromeStyle` uses theme tokens. If the tokens file ever imports chrome, cycle. Mitigation: tokens are pure data — never reference chrome.
- `CompactBar` uses `AppBarTooltip`. No cycle (bar → shared).
- `CompactColumn` wraps `CompactBar` by calling it with a config override (line 1563). If both are in `visuals/`, sibling import — fine. Same for `CompactPie` → `CompactDonut`, `CompactBubble` → `CompactScatter`.
- `VISUAL_MAP` imports 31 Compact* files. Each Compact* imports from `shared/`. Shared imports nothing from `visuals/`. DAG is clean.

### 1.6 Runtime behavior change

Each Compact* becomes its own module — Vite will emit separate chunks by default. Bundle size totals stay identical (same code, different chunk boundaries). HMR granularity improves: editing `CompactBar.jsx` only re-imports that module instead of the 3,200-line monolith. Code-splitting opportunity opens (lazy-load rarely-used visual types) but is not automatic.

### 1.7 Side-effect surfaces to watch

- **Global CSS keyframes** (around line 2833–2841: `ag-fadeUp`, `ag-fadeIn`, `ag-scaleIn`, `spec-pulse`) are emitted inside `AppSpecRenderer`'s render tree. If a Compact* is rendered outside AppSpecRenderer (unlikely today), the animations are missing. After a split: either keep the keyframes with AppSpecRenderer (since it wraps all render paths) or move to a global CSS file.
- **`useCountUp` imports `useState`, `useEffect`, `useRef`** — plain React hook, no side effect.
- **No module-level side effects** in AppSpecRenderer.jsx (no event listeners attached at import time, no singleton state).

---

## 2. Deleting the inline `getThemeTokens`, replacing with the `.ts` import

### 2.1 Two implementations, token-by-token diff

| Token | Inline (AppSpecRenderer.jsx:29–85) | getThemeTokens.ts | Match? |
|---|---|---|---|
| `CARD_BG` / `CARD_BORDER` / `CARD_SHADOW` | ✓ | ✓ | byte-identical |
| `TT_STYLE` / `TT_LABEL` | ✓ | ✓ | byte-identical |
| `textPrimary` / `textSecondary` / `textMuted` / `textFaint` | ✓ | ✓ | byte-identical |
| `gridStroke` / `gridStrokeOn` / `axisTick` | ✓ | ✓ | byte-identical |
| `headerBorder` / `shimmerBg` / `shimmerBg2` / `rowAlt` / `rowHover` / `tableDivider` | ✓ | ✓ | byte-identical |
| `kpiBgFn` / `kpiBorderFn` / `kpiBorderTop` / `kpiShadowFn` / `kpiAccentFn` / `chartBorderTop` / `accentBgFn` | ✓ | ✓ | byte-identical |
| `axisLine` | **missing** | ✓ `'rgba(255,255,255,0.08)'` / `'rgba(0,0,0,0.1)'` | TS-only |
| `splitLine` | **missing** | ✓ `'rgba(255,255,255,0.04)'` / `'rgba(0,0,0,0.06)'` | TS-only |
| `canvasBg` | **missing** | ✓ `'#0b0b12'` / `'#F1F5F9'` | TS-only |
| `dotGrid` | **missing** | ✓ `'rgba(255,255,255,0.06)'` / `'rgba(0,0,0,0.04)'` | TS-only |
| `echartsBg` / `echartsTextColor` / `echartsAxisColor` / `echartsSplitColor` / `echartsTooltipBg` / `echartsTooltipBorder` / `echartsTooltipText` / `echartsLegendText` | **missing** | ✓ | TS-only |

### 2.2 Behavioral differences

**Zero for existing consumers.** Every token referenced by `AppSpecRenderer.jsx` today exists in the `.ts` version with the exact same value (hex strings, rgba strings, function bodies all identical character-for-character).

The `.ts` version is strictly additive:
- 4 extra base tokens (`axisLine`, `splitLine`, `canvasBg`, `dotGrid`) that the inline forgot
- 8 ECharts-specific tokens reserved for future ECharts visuals
- A TypeScript `ThemeTokens` interface for type safety when consuming from `.ts`/`.tsx` files

### 2.3 Mechanical swap

In `AppSpecRenderer.jsx`:

```diff
+ import getThemeTokens from './getThemeTokens'
- function getThemeTokens(theme) {
-   if (theme === 'light') return { … }   // 27 lines
-   return { … }                           // 27 lines
- }
```

Vite's TypeScript loader resolves `./getThemeTokens` → `./getThemeTokens.ts` with no config change.

### 2.4 Risks

| Risk | Assessment |
|---|---|
| Existing render differs after swap | None — all current tokens byte-identical |
| Code paths that use `axisLine`/`splitLine`/`canvasBg`/`dotGrid` start to render differently | Low — those tokens aren't read anywhere today (`grep` confirms) |
| Bundle size | Identical; both definitions are the same ~55 lines |
| TS compile issues | None — `.ts` file already compiles (it's referenced by ECharts-adjacent code elsewhere) |
| Test updates | None — no tests assert the inline's content |

---

## 3. PBI fidelity gap — visuals "broken" in PBI today

### 3.1 Dispatch table

[`daxTemplateBuilder.js:883–897`](../../ui/src/pages/powerbi/daxTemplateBuilder.js#L883) — `DAX_BUILDERS`:

```js
const DAX_BUILDERS = {
  kpi: buildKpiDax,  gauge: buildGaugeDax,  bar: buildBarDax,
  stacked_bar: buildStackedBarDax,  funnel: buildFunnelDax,  table: buildTableDax,
  donut: buildDonutDax,  line: buildLineDax,  area: buildLineDax,
  radar: buildRadarDax,  scatter: buildScatterDax,  treemap: buildTreemapDax,
  sankey: buildFunnelDax,
}
// Line 907–911: builders NOT in the map fall through to buildKpiDax.
```

Unique PBI renderings today: **5** (kpi, gauge, bar, stacked_bar, table). Every other type routes to one of these five.

### 3.2 Per-visual gap vs. the React renderer

| Visual type | React component | PBI DAX builder | PBI fidelity |
|---|---|---|---|
| `kpi` | CompactKpi | `buildKpiDax` (dedicated) | ✓ matches |
| `bar` | CompactBar | `buildBarDax` (dedicated) | ✓ matches (axis switcher included) |
| `stacked_bar` | CompactStackedBar | `buildStackedBarDax` (dedicated) | ✓ matches |
| `gauge` | CompactGauge | `buildGaugeDax` (dedicated) | ✓ matches |
| `table` | CompactTable | `buildTableDax` (dedicated) | ✓ matches |
| `line` | CompactLine | `buildLineDax → buildBarDax` | ✗ renders as horizontal bars |
| `area` | CompactLine | `buildLineDax → buildBarDax` | ✗ renders as horizontal bars |
| `donut` | CompactDonut | `buildDonutDax → buildBarDax` | ✗ renders as horizontal bars |
| `pie` | CompactPie (→ Donut) | **unmapped → `buildKpiDax`** | ✗ renders as KPI |
| `radar` | CompactRadar | `buildRadarDax → buildBarDax` | ✗ renders as horizontal bars |
| `scatter` | CompactScatter | `buildScatterDax → buildBarDax` | ✗ renders as horizontal bars |
| `bubble` | CompactBubble | **unmapped → `buildKpiDax`** | ✗ renders as KPI |
| `treemap` | CompactTreemap | `buildTreemapDax → buildBarDax` | ✗ renders as horizontal bars |
| `funnel` | CompactFunnel | `buildFunnelDax → buildBarDax` | ~ close to original (both bar-style) |
| `sankey` | CompactChord | `buildFunnelDax → buildBarDax` | ✗ no flow paths |
| `column` | CompactColumn | **unmapped → `buildKpiDax`** | ✗ renders as KPI |
| `waterfall` | CompactWaterfall | **unmapped → `buildKpiDax`** | ✗ renders as KPI |
| `lollipop` | CompactLollipop | **unmapped → `buildKpiDax`** | ✗ renders as KPI |
| `bullet` | CompactBullet | **unmapped → `buildKpiDax`** | ✗ renders as KPI |
| `progress` | CompactProgressBar | **unmapped → `buildKpiDax`** | ~ KPI shows the value, loses bar shape |
| `heatmap` | CompactHeatmap | **unmapped → `buildKpiDax`** | ✗ renders as KPI |
| `ranked_list` | CompactRankedList | **unmapped → `buildKpiDax`** | ✗ renders as KPI |
| `stat_card` | CompactStatCard | **unmapped → `buildKpiDax`** | ~ similar chrome, different layout |
| `metric_tile` | CompactMetricTile | **unmapped → `buildKpiDax`** | ~ similar, missing ring progress |
| `sparkline_kpi` | CompactSparklineKpi | **unmapped → `buildKpiDax`** | ~ KPI renders but loses sparkline |
| `grouped_bar` | CompactGroupedBar | **unmapped → `buildKpiDax`** | ✗ renders as KPI |
| `stacked_area` | CompactStackedArea | **unmapped → `buildKpiDax`** | ✗ renders as KPI |
| `slope` | CompactSlopeChart | **unmapped → `buildKpiDax`** | ✗ renders as KPI |
| `bump` | CompactBumpChart | **unmapped → `buildKpiDax`** | ✗ renders as KPI |
| `chord` | CompactChord | **unmapped → `buildKpiDax`** | ✗ renders as KPI |
| `sunburst` | CompactSunburst | **unmapped → `buildKpiDax`** | ✗ renders as KPI |
| `narrative` | CompactNarrative | **unmapped → `buildKpiDax`** | ~ text in a KPI card; acceptable |
| `insight` | CompactNarrative | **unmapped → `buildKpiDax`** | ~ same as narrative |
| `waffle` | CompactWaffle | **unmapped → `buildKpiDax`** | ✗ renders as KPI |

### 3.3 Counts

- **Matching today:** 5 types (kpi, bar, stacked_bar, gauge, table)
- **Render as bar chart instead of intended shape:** 7 types (line, area, donut, radar, scatter, treemap, sankey)
- **Render as KPI card instead of intended shape:** 22 types (column, waterfall, lollipop, bullet, progress, heatmap, ranked_list, stat_card, metric_tile, sparkline_kpi, grouped_bar, stacked_area, slope, bump, chord, sunburst, waffle, pie, bubble, narrative, insight) — with varying degrees of acceptability
- **Acceptably close despite fallback:** ~5 types (funnel→bar, progress→kpi, stat_card→kpi, metric_tile→kpi, sparkline_kpi→kpi, narrative→kpi, insight→kpi)

### 3.4 Scope to close the gap (HTML-DAX approach — current direction)

Each missing builder = a new `buildXxxDax(visual, theme)` function producing a DAX expression that concatenates HTML matching the corresponding React Compact* component.

| Builder | Approximate size (ref: existing) | Notes |
|---|---|---|
| Bar-family (line/area/donut/radar/scatter/treemap/funnel/sankey) | ~150–300 lines each | 8 × new; currently aliased. Most complex: line (SVG polyline in DAX string math), donut (SVG arcs), sankey/chord (flow paths — hardest) |
| KPI-fallback types (column, waterfall, lollipop, bullet, progress, heatmap, ranked_list, stat_card, metric_tile, sparkline_kpi, grouped_bar, stacked_area, slope, bump, chord, sunburst, waffle, pie, bubble) | ~100–250 lines each | 19 × new |
| Pass-through types (narrative, insight) | ~60 lines | Thin DAX returning the spec's text |

**Total new DAX code:** ~23 builders × ~170 lines average ≈ **3,900 lines** of DAX-string assembly, plus test coverage and theme-aware branching for each.

### 3.5 Scope to close the gap (ECharts alternative)

If PBI rendering switches from DAX-HTML to ECharts-client-side:
- `visual.ts` gains a new render mode: receives raw `DataView` rows, calls `echarts.init(root).setOption(option)`
- Each visual type needs an option-builder: `option = buildLineOption(rows, config, tokens)`, etc.
- Each option-builder is ~30–80 lines of pure JS (no DAX-string escaping)
- The DAX side becomes trivial: a standard categorical dataView query — no HTML string assembly
- `.pbiviz` bundle size grows by ~400–800KB (ECharts)

**Total new code for ECharts path:** ~23 builders × ~50 lines average ≈ **1,150 lines**, plus one-time visual.ts branch (~50 lines). About **⅓ the code** of the DAX-HTML path.

---

## 4. Versioning / rollout for `.pbiviz` at v3.15.7.0

### 4.1 What's fixed by the GUID

[`pbiviz.json:5`](../../pbiviz-semantica-renderer/pbiviz.json#L5) — `"guid": "semanticaRenderer4A7F2D9B8C3E1F5A6D4B2C8E9F1A3B7D"`.

This GUID is used in [`publishCustomVisualFlow.js`](../../ui/src/pages/powerbi/publishCustomVisualFlow.js) as `VISUAL_GUID`. It identifies the visual type within PBI. As long as the GUID is unchanged, PBI treats every new `.pbiviz` build as a new version of the same visual.

### 4.2 What changes per build

- `version` in [`pbiviz.json:7`](../../pbiviz-semantica-renderer/pbiviz.json#L7) (manual bump)
- `dist/*.pbiviz` artifact filename (contains version in the filename)
- JS bundle inside the archive

### 4.3 Selection mechanism in Semantica

[`electron/ipc/powerbi.js:608`](../../electron/ipc/powerbi.js#L608) — `getBundledPbiviz()` scans `pbiviz-semantica-renderer/dist/*.pbiviz` and picks the one with the newest `mtime`. Cache is mtime-keyed, so rebuilds are picked up without restart.

**Implication:** at any time, the "current" bundle is whichever `.pbiviz` has the newest `mtime` on disk. All older `.pbiviz` files coexist in `dist/` but are effectively dead.

### 4.4 PBI Service caching behavior

PBI Service embeds the custom visual binary **per-report at first publish**. Republishing an existing report (`reportId` supplied) sends a new report definition but **does not refresh the visual binary** unless the GUID changes.

- Fresh report name → new `.pbiviz` is embedded
- Same report name + same GUID + bumped version → old bundle stays
- Workaround: remove + re-add the visual in Desktop, or publish under a new report name

### 4.5 Rollout options for replacing the rendering approach

| Approach | GUID | Affected reports | Migration path |
|---|---|---|---|
| **Bump version, keep GUID** | unchanged | Only fresh reports pick up the new rendering. Existing reports keep the old bundle indefinitely unless user re-adds the visual. | Silent; assumes users will republish to fresh report names. |
| **Change GUID** | new | Existing reports keep using the old visual (both bundles coexist if old is kept in `dist/`). New reports use new visual. | Two visuals side-by-side during transition; users opt in. |
| **Dual-bundle** | two GUIDs | Both shipped in `dist/`; publish flow chooses based on spec flag. | Per-spec opt-in. Cleanest but doubles bundle storage. |
| **Runtime feature flag** | unchanged | Single bundle with both code paths; `visual.ts` picks path from config or capability. | Safest rollback: flip a flag in config to revert. |

### 4.6 Other version-adjacent considerations

- **Side-by-side `.pbiviz` coexistence in `dist/`**: current behavior is "newest mtime wins." If we want controlled rollout, we'd either (a) move older versions out of `dist/`, (b) add a manifest that pins which version Semantica picks, or (c) rename the bundle selection logic to honor a version pin in `pbiviz-semantica-renderer/.pin`.
- **Semantic meaning of the version number**: the current scheme (3.15.7.0) has no documented semantics — it's been incremented for fixes, capability additions, and rollbacks alike. A formal scheme (major = rendering approach, minor = capabilities, patch = bug fix) doesn't exist yet.
- **Rollback story**: if a new version ships broken, delete the newer `.pbiviz` from `dist/`, restart Semantica → picks the older one by mtime. But republishes to existing reports still cache the broken bundle until user re-adds the visual.
- **Report-level bundle invalidation**: there's no Fabric API call in the current publish flow that forces PBI to refresh the embedded visual binary. Investigation item if true hot-swap is needed.

---

## 5. Recharts → ECharts migration difficulty per component

### 5.1 Rating rubric

- **1** — trivial: direct 1:1 ECharts primitive with default options
- **2** — easy: native ECharts option with config transfer, no custom logic
- **3** — moderate: requires option composition and data transform
- **4** — complex: many custom logic branches, interaction handlers, conditional rendering
- **5** — hard: needs custom ECharts components or fundamental rethink

### 5.2 Per-component ratings

| # | Component | Line | Recharts primitives used | Features beyond stock | Rating | Notes |
|---|---|---|---|---|---|---|
| 1 | `CompactBar` | 692 | `BarChart`, `Bar`, `CartesianGrid`, `XAxis`, `YAxis`, `Tooltip`, `LabelList`, `Cell` per row | scroll threshold, gradient, labelPosition auto/right/inside/top, rankOpacity, highlightMax, conditionalColor (rules/gradient/fromField), reference lines (avg/target), custom tooltip, click-to-filter, `_selectedCat` dim | **4** | Most logic-heavy. ECharts `series.type: 'bar'` + `markLine` for avg/target + `itemStyle.color` functions for per-bar logic. Lots of option composition. |
| 2 | `CompactStackedBar` | 911 | `BarChart` (stacked), `XAxis`, `YAxis`, `Tooltip`, `Bar` | 2-measure stacking, shared tooltip | **3** | ECharts `stack: 'total'` + two series. Straightforward but needs careful tooltip wiring. |
| 3 | `CompactLine` | 989 | `AreaChart`, `Area` (primary + optional secondary), `CartesianGrid`, `XAxis`, `YAxis`, `Tooltip`, `LabelList` | grain-aware x-axis (year/month/date), gradient fill, period toggle | **3** | ECharts `series.type: 'line'` + `areaStyle`. Grain detection code ports unchanged. |
| 4 | `CompactDonut` | 1115 | `PieChart`, `Pie`, `Cell` per slice, `Tooltip` | single-measure radial gauge variant, multi-segment with legend | **3** | ECharts `series.type: 'pie'` + `radius: ['60%','80%']`. Single-value path needs a separate gauge-like option. |
| 5 | `CompactGauge` | 1236 | `BarChart`, `Bar`, `Cell` + SVG arc overlay | color zones, target marker, min/max labels | **2** | ECharts has native `series.type: 'gauge'` — direct 1:1 mapping. Probably the easiest migration win. |
| 6 | `CompactRadar` | 1289 | `RadarChart`, `PolarGrid`, `PolarAngleAxis`, `Radar`, `Tooltip` | standard | **2** | ECharts `series.type: 'radar'` native. |
| 7 | `CompactScatter` | 1321 | `ScatterChart`, `Scatter`, `Cell`, `CartesianGrid`, `XAxis`, `YAxis`, `ZAxis`, `Tooltip` | `dotSize`, `dotSizeMax`, optional coloring | **2** | ECharts `series.type: 'scatter'`. `ZAxis` (size) maps to `symbolSize` function. |
| 8 | `CompactTreemap` | 1366 | `Treemap` | palette, labels | **2** | ECharts `series.type: 'treemap'` native and actually richer than Recharts' version. |
| 9 | `CompactBubble` | 1765 | Delegates to `CompactScatter` | `dotSize: 8, dotSizeMax: 200` | **2** | Same as Scatter; just wire `symbolSize` to second measure. |
| 10 | `CompactPie` | 1770 | Delegates to `CompactDonut` with `innerRadius: 0` | — | **2** | Same as Donut with `radius: '70%'` (no hole). |
| 11 | `CompactGroupedBar` | 1861 | `BarChart`, `Bar` × 2 | 2-measure grouping | **3** | ECharts: two series, no `stack` key. |
| 12 | `CompactStackedArea` | 1890 | `AreaChart`, `Area` × 2 | 2-measure stacking, grain awareness | **3** | Same as stacked bar, but `type: 'line'` + `stack: 'total'` + `areaStyle`. |
| 13 | `CompactBumpChart` | 1964 | `LineChart` | smooth ranking over time, dots | **3** | ECharts line chart, reversed y-axis for rank. Custom label logic for each point. |

### 5.3 Non-Recharts visuals (out of scope for this question)

These are hand-rolled SVG/CSS today and don't use Recharts at all. For completeness, their ECharts-migration difficulty:

| Component | Current approach | If migrating to ECharts | Rating |
|---|---|---|---|
| `CompactFunnel` | CSS divs with proportional widths | ECharts `series.type: 'funnel'` native | 2 |
| `CompactTable` | HTML `<table>` | No equivalent in ECharts — would stay as HTML | N/A |
| `CompactRankedList` | Flex + inline SVG bars | Stays as custom (not a chart) | N/A |
| `CompactHeatmap` | CSS Grid colored divs | ECharts `series.type: 'heatmap'` native | 2 |
| `CompactWaffle` | SVG 10×10 grid | No native ECharts — custom option with `pictorialBar` or stays SVG | 4 |
| `CompactLollipop` | SVG circle + line | ECharts `series.type: 'scatter'` + `markLine` for stems | 3 |
| `CompactBullet` | SVG rects | No native ECharts bullet — construct with `bar` + `markLine` | 4 |
| `CompactProgressBar` | SVG rect + text | Stays as custom SVG or ECharts `bar` single | 2 |
| `CompactSlopeChart` | SVG lines | ECharts line with 2 x-points | 3 |
| `CompactChord` (also `sankey`) | Hand-rolled SVG arcs | ECharts `series.type: 'sankey'` (not chord natively) | 4 |
| `CompactWaterfall` | SVG rects + cumulative line | ECharts stacked bar with `itemStyle.color` per segment | 4 |
| `CompactSunburst` | SVG polar arcs | ECharts `series.type: 'sunburst'` native | 2 |
| `CompactKpi` | HTML + counter + sparkline | Text widget, not a chart — stays as HTML (sparkline could use ECharts mini-chart) | N/A |
| `CompactStatCard` / `CompactMetricTile` / `CompactSparklineKpi` | HTML/SVG | Stays as HTML | N/A |
| `CompactNarrative` | HTML text | Stays as HTML | N/A |

### 5.4 Cross-cutting migration concerns (not per-component)

- **Tooltip parity**: ECharts `tooltip.formatter` is a function receiving `params`. Recharts uses a React component (`AppBarTooltip`). Can be ported to a formatter but loses JSX templating — all tooltips across all 13 components need the equivalent of `AppBarTooltip` re-expressed as an HTML-string formatter.
- **Click-to-filter**: ECharts `chart.on('click', handler)`. Recharts uses `<Bar onClick={…}>`. Per-component: each migrated visual needs to wire its own click handler that calls `config._onBarClick(cat)`.
- **Dim-on-select (`_selectedCat`)**: Recharts uses Cells with `fillOpacity`. ECharts uses `itemStyle.color` as a function per data point. Per-component work: re-implement the per-row dim logic inside an ECharts callback.
- **Theme switching**: ECharts supports `chart.setOption({...}, { notMerge: false })`. Theme tokens (`echartsBg`, `echartsTextColor`, etc.) already exist in `getThemeTokens.ts` for this purpose.
- **Bundle size delta**: +400–800KB minified/gzipped depending on which modules are tree-shaken. Adds to the web-export bundle and the `.pbiviz` bundle.
- **`ResponsiveContainer` replacement**: ECharts needs manual resize via `chart.resize()` on container size change. Can be wrapped once in a reusable `EChartsCanvas` component.
- **Animation parity**: Recharts' animation is automatic per-`<Bar>`/`<Area>`. ECharts has `animation*` options that are per-series — similar capability, different API surface.

### 5.5 Summary

Of 13 Recharts-based components:
- **4 are rated 2 (easy)**: CompactGauge, CompactRadar, CompactScatter, CompactTreemap, CompactBubble, CompactPie (6 if counting the two delegates)
- **6 are rated 3 (moderate)**: CompactStackedBar, CompactLine, CompactDonut, CompactGroupedBar, CompactStackedArea, CompactBumpChart
- **1 is rated 4 (complex)**: CompactBar — the biggest single migration unit
- **0 are rated 5**: nothing requires an ECharts-custom-component or a fundamental redesign

Average difficulty across 13 Recharts components: ~2.8. The work is front-loaded on `CompactBar` — it alone carries roughly as much customization logic as all other chart types combined.
