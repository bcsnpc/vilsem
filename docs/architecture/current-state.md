# Semantica — Current State Architecture

**Purpose:** Factual snapshot of what exists today. Not a proposal.

**Historical snapshot:** This file describes April 2026, not the current extracted
renderer/primitive architecture. See [the September audit](../architecture.md) and
[current visual inventory](../visual-inventory.md) before relying on its file/line references.
**Last updated:** 2026-04-21.

This document describes the visual rendering and publish pipelines as they stand. Code citations use `file:line` form.

---

## 1. Visual structure — file layout, component shape, prop contracts

### 1.1 File layout

| File | Role | Approx. size |
|---|---|---|
| [`ui/src/appspec/AppSpecRenderer.jsx`](../../ui/src/appspec/AppSpecRenderer.jsx) | All chart components + all render paths + theme tokens + palettes + helpers | ~3200 lines |
| [`ui/src/appspec/CanvasEditor.jsx`](../../ui/src/appspec/CanvasEditor.jsx) | Freeform pixel-drag editor (standalone from AppSpecRenderer) | ~433 lines |
| [`ui/src/appspec/VisualInspector.jsx`](../../ui/src/appspec/VisualInspector.jsx) | Right-side inspector for selected visual | ~700 lines |
| [`ui/src/appspec/AxisSwitchPills.jsx`](../../ui/src/appspec/AxisSwitchPills.jsx) | Shared pill-switcher component | 82 lines |
| [`ui/src/appspec/schema.js`](../../ui/src/appspec/schema.js) | AppSpec JSON validator | ~150 lines |
| [`ui/src/appspec/getThemeTokens.ts`](../../ui/src/appspec/getThemeTokens.ts) | Theme token source of truth (TS interface + dark/light objects) | 159 lines |

All `Compact<Type>` components — **31 in total** — live in one file (`AppSpecRenderer.jsx`). No per-visual files yet.

### 1.2 Component shape

Every chart component follows the same signature:

```jsx
function Compact<Type>({ rows, config, loading, error, groupBy? }) { … }
```

- `rows` — normalized `[{ _cat?: string, _val: number, _val2?: number }, …]` (or `[{ _val: number, _val2?: number }]` for scalar KPI).
- `config` — the `chartConfig` object assembled by the render path.
- `loading`, `error` — booleans/strings; components short-circuit into `LoadingShimmer` or `EmptyState`.
- `groupBy` — optional, used by time-series types to resolve grain.

### 1.3 All Compact* components

| Line | Component | Underlying rendering |
|---|---|---|
| [504](../../ui/src/appspec/AppSpecRenderer.jsx#L504) | `CompactKpi` | HTML + animated `useCountUp` + SVG sparkline |
| [692](../../ui/src/appspec/AppSpecRenderer.jsx#L692) | `CompactBar` | Recharts `BarChart` + `Bar` + `LabelList` + `Cell` per row |
| [911](../../ui/src/appspec/AppSpecRenderer.jsx#L911) | `CompactStackedBar` | Recharts `BarChart` (stacked) |
| [989](../../ui/src/appspec/AppSpecRenderer.jsx#L989) | `CompactLine` | Recharts `AreaChart` (also serves `area`) |
| [1115](../../ui/src/appspec/AppSpecRenderer.jsx#L1115) | `CompactDonut` | Recharts `PieChart`; single-value path renders a radial gauge |
| [1236](../../ui/src/appspec/AppSpecRenderer.jsx#L1236) | `CompactGauge` | Recharts `BarChart` (horizontal) + SVG arc math |
| [1289](../../ui/src/appspec/AppSpecRenderer.jsx#L1289) | `CompactRadar` | Recharts `RadarChart` |
| [1321](../../ui/src/appspec/AppSpecRenderer.jsx#L1321) | `CompactScatter` | Recharts `ScatterChart` |
| [1366](../../ui/src/appspec/AppSpecRenderer.jsx#L1366) | `CompactTreemap` | Recharts `Treemap` |
| [1416](../../ui/src/appspec/AppSpecRenderer.jsx#L1416) | `CompactFunnel` | Hand-rolled flex `<div>`s with proportional widths |
| [1469](../../ui/src/appspec/AppSpecRenderer.jsx#L1469) | `CompactTable` | HTML `<table>` |
| [1563](../../ui/src/appspec/AppSpecRenderer.jsx#L1563) | `CompactColumn` | Wraps `CompactBar` with `orientation: 'vertical'` |
| [1568](../../ui/src/appspec/AppSpecRenderer.jsx#L1568) | `CompactWaterfall` | SVG rects + cumulative line |
| [1626](../../ui/src/appspec/AppSpecRenderer.jsx#L1626) | `CompactLollipop` | SVG circle + line |
| [1664](../../ui/src/appspec/AppSpecRenderer.jsx#L1664) | `CompactBullet` | SVG segments (progress + target + zones) |
| [1703](../../ui/src/appspec/AppSpecRenderer.jsx#L1703) | `CompactProgressBar` | SVG rect + text |
| [1728](../../ui/src/appspec/AppSpecRenderer.jsx#L1728) | `CompactHeatmap` | CSS Grid of color-coded `<div>`s |
| [1765](../../ui/src/appspec/AppSpecRenderer.jsx#L1765) | `CompactBubble` | Delegates to `CompactScatter` with `dotSize/dotSizeMax` |
| [1770](../../ui/src/appspec/AppSpecRenderer.jsx#L1770) | `CompactPie` | Delegates to `CompactDonut` with `innerRadius=0` |
| [1775](../../ui/src/appspec/AppSpecRenderer.jsx#L1775) | `CompactRankedList` | HTML list + inline SVG bars |
| [1810](../../ui/src/appspec/AppSpecRenderer.jsx#L1810) | `CompactStatCard` | HTML + SVG accent |
| [1834](../../ui/src/appspec/AppSpecRenderer.jsx#L1834) | `CompactMetricTile` | SVG ring progress |
| [1861](../../ui/src/appspec/AppSpecRenderer.jsx#L1861) | `CompactGroupedBar` | Recharts `BarChart` (grouped) |
| [1890](../../ui/src/appspec/AppSpecRenderer.jsx#L1890) | `CompactStackedArea` | Recharts `AreaChart` (stacked) |
| [1896](../../ui/src/appspec/AppSpecRenderer.jsx#L1896) | `CompactSparklineKpi` | HTML + `SparklineSvg` helper |
| [1903](../../ui/src/appspec/AppSpecRenderer.jsx#L1903) | `CompactSlopeChart` | Hand-rolled SVG lines |
| [1964](../../ui/src/appspec/AppSpecRenderer.jsx#L1964) | `CompactBumpChart` | Recharts `LineChart` |
| [1995](../../ui/src/appspec/AppSpecRenderer.jsx#L1995) | `CompactChord` | Hand-rolled SVG arcs + paths (also used as `sankey`) |
| [2053](../../ui/src/appspec/AppSpecRenderer.jsx#L2053) | `CompactSunburst` | Hand-rolled SVG polar arcs |
| [2106](../../ui/src/appspec/AppSpecRenderer.jsx#L2106) | `CompactNarrative` | HTML text only |
| [2168](../../ui/src/appspec/AppSpecRenderer.jsx#L2168) | `CompactWaffle` | SVG 10×10 grid of squares |

`VISUAL_MAP` (near line 2231) maps `visual.type` strings → component references.

### 1.4 `chartConfig` prop contract

Assembled at three sites in [`AppSpecRenderer.jsx`](../../ui/src/appspec/AppSpecRenderer.jsx) (lines ~2913, ~3037, ~3204) and in [`CanvasEditor.jsx:358`](../../ui/src/appspec/CanvasEditor.jsx#L358). Shape is identical across sites:

```js
const chartConfig = {
  ...(v.config || {}),                    // user-authored config from the spec
  title: undefined, label: undefined,     // blanked out — the header owns title
  measureName:          v.data?.measures?.[0],
  secondaryMeasureName: v.data?.measures?.[1] || null,
  orderBy:              'asc' | 'desc',
  _T:               T,                    // resolved theme tokens
  _globalFilters:   { … },                // slicer + click-sourced filters
  _globalFiltersKey:'…',                  // serialized dep key
  _selectedCat:     string | null,        // for self-dim on click
  _onBarClick:      (cat) => handleBarClick(v, cat),
  _cardPixelHeight: number,               // KPI-only, for font-size scaling
}
```

Internal (underscore-prefixed) fields:

| Field | Purpose |
|---|---|
| `_T` | Full `ThemeTokens` object (see §6). Always set. |
| `_globalFilters` | Filters applied to this visual's query (slicer-sourced + cross-filter-sourced, minus the visual's own). |
| `_globalFiltersKey` | Serialized key used in effect deps to trigger re-fetch. |
| `_selectedCat` | Category value this visual sourced into `filterSources`; chart components dim non-matching rows. |
| `_onBarClick` | Callback to set cross-filter state on bar click. |
| `_cardPixelHeight` | Passed only to KPI-like visuals so they can scale fonts by card size. |

No schema enforcement or TypeScript type — the contract is by convention.

---

## 2. App Spec JSON schema — as defined today

### 2.1 Schema source

[`ui/src/appspec/schema.js`](../../ui/src/appspec/schema.js) defines `validateAppSpec(spec)` which returns `{ valid, errors, warnings }`. Version string is `'1.0'`.

```js
VISUAL_TYPES = [
  'kpi','bar','stacked_bar','grouped_bar','column','line','area','stacked_area',
  'donut','pie','gauge','radar','scatter','bubble','treemap','funnel','sankey',
  'table','waterfall','lollipop','bullet','progress','heatmap','ranked_list',
  'stat_card','metric_tile','sparkline_kpi','slope','bump','chord','sunburst',
  'narrative','insight','waffle',
]
SLICER_TYPES = ['dropdown','buttons','date_range']
```

`PAGE_SIZE_PRESETS` (~line 25): `'16:9' | '16:10' | '4:3' | 'tall' | 'square' | 'auto' | 'custom'`.

### 2.2 Top-level shape

```json
{
  "version": "1.0",
  "title": "string",
  "layout": { "freeform": false, "rowHeight": 80, "gap": 8, "pagePreset": "16:9", "pageWidth": 1280, "pageHeight": 720 },
  "visuals": [ … ],
  "slicers": [ … ],
  "connections": []
}
```

### 2.3 Visual shape

```json
{
  "id": "visual_1",                        // required, unique
  "type": "kpi | bar | line | …",          // required, must be in VISUAL_TYPES
  "position": { "x": 0, "y": 0, "w": 3, "h": 2 },
  "data": {
    "measures": ["Total Revenue"],         // required (except for table)
    "groupBy": { "table": "Product", "column": "Category" },  // optional
    "filters": {},
    "limit": 10,
    "orderBy": "desc"
  },
  "config": { … }                          // free-form per visual type
}
```

### 2.4 KPI example (scalar)

```json
{
  "id": "kpi_revenue",
  "type": "kpi",
  "position": { "x": 0, "y": 0, "w": 3, "h": 2 },
  "data":   { "measures": ["Total Revenue"], "filters": {} },
  "config": {
    "colorScheme": "teal",
    "cardStyle":   "minimal",
    "title":       "Total Revenue",
    "showSparkline": true,
    "sparklineAxis": "Calendar[Month]"
  }
}
```

### 2.5 Bar example (grouped)

```json
{
  "id": "bar_region",
  "type": "bar",
  "position": { "x": 0, "y": 2, "w": 12, "h": 5 },
  "data": {
    "measures": ["Total Revenue"],
    "groupBy":  { "table": "Territory Lookup", "column": "Region" },
    "limit": 10,
    "orderBy": "desc"
  },
  "config": {
    "colorScheme": "blue",
    "title":       "Total Revenue by Region",
    "dataLabels":  true,
    "gridLines":   false,
    "axisOptions": [
      { "label": "Region",  "groupBy": { "table": "Territory Lookup", "column": "Region"  } },
      { "label": "Country", "groupBy": { "table": "Territory Lookup", "column": "Country" } }
    ]
  }
}
```

### 2.6 Slicer shape

```json
{
  "id": "slicer_year",
  "type": "dropdown",
  "dimension": { "table": "Calendar", "column": "Year" },
  "position":  { "x": 0, "y": 0, "w": 3, "h": 1 }
}
```

---

## 3. Canvas rendering + positioning

[`AppSpecRenderer.jsx`](../../ui/src/appspec/AppSpecRenderer.jsx) has **four render paths**, each selected by a top-level conditional:

| # | Path | Conditional | Layout mechanism |
|---|---|---|---|
| A | GridLayout edit mode | `editMode && onLayoutChange && canvasWidth > 100 && editLayout` (~line 2844) | `react-grid-layout` with 12 cols, `rowHeight=80`, `margin=[gap,gap]`, drag handle `.ag-edit-handle`, resize handles `['se','e','s']` |
| B | View mode — freeform | `renderSpec.layout?.freeform` (~line 2995) | Each item `position: absolute` with `calc()` strings for pixel coords |
| C | View mode — section, KPI row | default path + `visibleKpis.length > 0` (~line 3115) | CSS Grid `repeat(12, minmax(0,1fr))` + `gridColumn: span w` |
| D | View mode — section, chart rows | default path + chart visuals grouped by `position.y` (~line 3164) | Same CSS Grid per logical row; row height = tallest card in group |

[`CanvasEditor.jsx`](../../ui/src/appspec/CanvasEditor.jsx) is a **separate** freeform editor used by AppGenerator's edit mode (not the GridLayout path above). It has its own drag/resize via pointer events and its own `visualData` fetch (lines ~138–184).

### 3.1 Position math

| Constant | Line | Value |
|---|---|---|
| `ROW_HEIGHT` | [AppSpecRenderer.jsx:2779](../../ui/src/appspec/AppSpecRenderer.jsx#L2779) | `renderSpec.layout?.rowHeight \|\| 80` |
| `GAP` | [AppSpecRenderer.jsx:2780](../../ui/src/appspec/AppSpecRenderer.jsx#L2780) | `renderSpec.layout?.gap \|\| 8` |
| Columns | hardcoded | 12 |
| `BAR_SCROLL_THRESHOLD` | [AppSpecRenderer.jsx:341](../../ui/src/appspec/AppSpecRenderer.jsx#L341) | 10 |
| `PX_PER_BAR_ROW` | [AppSpecRenderer.jsx:342](../../ui/src/appspec/AppSpecRenderer.jsx#L342) | 44 |

Conversion from grid units to pixels in **freeform view** (~line 3004–3013):

```
colW     = calc((100% - (12-1)*8px) / 12)
leftPx   = calc(pos.x * (colW + 8px))
topPx    = pos.y * (80 + 8)                  // pixels
widthPx  = calc(pos.w * colW + (pos.w-1)*8px)
heightPx = pos.h * 80 + max(pos.h-1, 0)*8    // pixels
```

In **section view** (~line 3199):

```
cellH = pos.h * ROW_HEIGHT + max(pos.h-1, 0) * GAP
```

Cards use `gridColumn: span pos.w`.

In **CanvasEditor** ([`CanvasEditor.jsx:15–37`](../../ui/src/appspec/CanvasEditor.jsx#L15)):

```
colW   = (containerW - GAP * (COLS-1)) / COLS
left   = pos.x * (colW + GAP)
top    = pos.y * (ROW_H + GAP)
width  = pos.w * colW + (pos.w-1) * GAP
height = pos.h * ROW_H + (pos.h-1) * GAP
```

### 3.2 State in the renderer

Main state in `AppSpecRenderer`:

- `visualData`, `visualLoading`, `visualErrors` — per-visual data fetch state.
- `slicerValues` — distinct values per slicer.
- `globalFilters` — merged filter state (slicer + cross-filter).
- `filterSources` — map of `filterKey → sourceVisualId` (for the source-visual-exempt cross-filter pattern).
- `axisOverrides` — `{ [visualId]: { table, column } }` set by AxisSwitchPills clicks.
- `editLayout` — react-grid-layout's layout array when in edit mode.
- `requestEpochRef` — stale-request guard.

---

## 4. Web export pipeline

Entry point: [`electron/ipc/exportPackage.js`](../../electron/ipc/exportPackage.js) — IPC handler `export-app-package`.

### 4.1 Output folder contents

| File | Source |
|---|---|
| `app-spec.json` | `JSON.stringify(spec, null, 2)` |
| `index.html` | Copy of `dist/app/standalone/standalone.html`, asset paths rewritten from `./assets/` → `./public/assets/` |
| `public/assets/*` | Copied from `dist/app/standalone/assets/` (Vite bundle) |
| `server.js` | Inline `SERVER_ENTRY` template (~line 32–72) — thin Fastify entry |
| `package.json` | Generated with dependencies (lines ~181–194) |
| `.env.example` | Always written, placeholders only |
| `.env` | **Only** if caller passed `credentials` with all five fields populated (lines ~208–225) |
| `README.md` | Quickstart guide |
| `.gitignore` | Ignores `.env` + `node_modules` |
| `src/auth/auth.js`, `src/fabric/client.js`, `src/fabric/translator.js`, `src/fabric/xmla.js`, `src/queue/limiter.js`, `src/routes/preview.js` | Copied verbatim from `BACKEND_FILES` list (~line 75–82) |

### 4.2 Folder name resolution (line ~88–92)

Priority: `exportFolderName` arg → `appName` arg → `spec.title` → `'app'`. Sanitized to alphanumeric + space + dash; spaces → dashes.

### 4.3 Standalone React runtime

[`ui/src/standalone/index.jsx`](../../ui/src/standalone/index.jsx) is the Vite entry for the standalone bundle. It polyfills `window.semantica` so that `AppSpecRenderer` renders unchanged in a browser:

```js
window.semantica = {
  query:           ({ measures, filters }) => POST /query-scalar
  queryTable:      ({ groupBy, measures, filters, limit, orderBy }) => POST /query-table
  getDistinctValues: ({ column, limit }) => POST /distinct-values
}
```

On load it fetches `/app-spec.json`, reads `theme.mode` from the spec, resolves `layout.pagePreset` (one of the 7 presets) + `layout.pageWidth/Height` to compute the canvas dimensions, and mounts `<AppSpecRenderer />`.

### 4.4 Web preview backend

[`src/routes/preview.js`](../../src/routes/preview.js) is a Fastify plugin shared between Semantica's dev preview and the exported app's `server.js`.

Routes exposed:

| Route | Purpose |
|---|---|
| `POST /preview-spec` | Stores spec in process memory |
| `GET /preview-spec` | Returns the stored spec |
| `POST /query-table` | `SUMMARIZECOLUMNS` DAX → Fabric (rate-limited) → rows |
| `POST /query-scalar` | Scalar DAX → Fabric → `{ data: { measureName: value } }` |
| `POST /distinct-values` | DISTINCT DAX → `{ values }` |
| `GET /preview` | Serves `dist/app/preview.html` (legacy) |

All call through the real `src/fabric/client.js` / `translator.js` / `queue/limiter.js` — same code path as Semantica's IPC handlers.

### 4.5 Auto-run

After the folder is written, [`exportPackage.js`](../../electron/ipc/exportPackage.js) IPC `run-web-preview` (~line 271) runs `npm install`, kills any orphan process on port 3000, launches `node server.js` in the background, tails stdout for `running at`, then opens the browser.

---

## 5. PBI publish pipeline — spec → PBIP JSON

### 5.1 Top-level flow

[`ui/src/pages/powerbi/publishCustomVisualFlow.js`](../../ui/src/pages/powerbi/publishCustomVisualFlow.js) — `publishCustomVisualFlow({ pages, workspaceId, datasetId, reportId, reportName, workspaceName, datasetName, canvasTheme, referenceReportId, onProgress })`.

Six-step flow (line ranges approximate):

1. **Pre-fetch & render HTML** (~238–370): query dataset via `window.semantica.queryTable`, call `renderVisualToHtml` per visual. Stored in `htmlByVisualId` as fallback.
2. **Fetch current TMDL** (~372): `window.semantica.pbismGetDefinition` to read dataset model.
3. **Build live DAX** (~377–412): `buildLiveDax(visual, canvasTheme)` per visual → DAX expression.
4. **Inject measures into TMDL** (~414–427): `rewriteTmdlPartsWithLiveDax` inserts a `_SemanticaGenerated` table with one measure per visual; pushed via `pbismUpdateDefinition`.
5. **Load custom-visual binary** (~429–431): `loadBundledCustomVisualParts` → the `.pbiviz` archive as PBIR parts.
6. **Create/update report** (~433–486): build legacy `report.json` via `buildLegacyReportJson`; push via Fabric REST.

### 5.2 AppSpec → page structure

[`ui/src/pages/AppSpecToPowerBI.js`](../../ui/src/pages/AppSpecToPowerBI.js) — `mapAppSpecToPages(appSpec)` is a pure transform. Output shape:

```js
[{
  id: 'page_1', name, width, height, preset,
  visuals: [{
    id, type, measures: string[], dimension: "Table[Column]" | null,
    x, y, width, height,        // pixels
    limit, orderBy, config, title
  }]
}]
```

Position: grid units × `colW` (where `colW = (contentWidth - gap*11) / 12`) + a 20px chrome pad.

### 5.3 Visual container (legacy report.json) — `buildVisualContainer`

For each visual (line ~47 of `publishCustomVisualFlow.js`):

```js
{
  config: JSON.stringify({
    name, layouts: [{ position: { x, y, z, width, height, tabOrder } }],
    singleVisual: {
      visualType: VISUAL_GUID,    // semanticaRenderer...
      projections: {
        content:  [{ queryRef: `${MEASURE_TABLE}.${measureName}` }],
        category: [{ queryRef: `${dimTable}.${dimColumn}`, active: true }]  // if bound
      },
      prototypeQuery: {
        Version: 2,
        From:    [{ Name, Entity, Type: 0 }],
        Select:  [{ Measure | Column, Name, NativeReferenceName }]
      },
      drillFilterOtherVisuals: true,
      vcObjects: {
        background: [transparent],   // hide PBI container chrome
        visualHeader: [hidden],
        border: [hidden], title: [hidden], lockAspect: [hidden]
      }
    }
  }),
  filters: '[]', height, width, x, y, z
}
```

### 5.4 Custom visual — the `.pbiviz`

[`pbiviz-semantica-renderer/`](../../pbiviz-semantica-renderer/) — single custom visual that handles every visual type.

- **GUID:** `semanticaRenderer4A7F2D9B8C3E1F5A6D4B2C8E9F1A3B7D`
- **Version:** `3.15.7.0` (see `pbiviz.json`)
- **API version:** `5.3.0`

[`capabilities.json`](../../pbiviz-semantica-renderer/capabilities.json) current state:

```json
{
  "privileges": [],
  "dataRoles": [
    { "name": "content",  "kind": "Measure",  "displayName": "Content" },
    { "name": "category", "kind": "Grouping", "displayName": "Category" }
  ],
  "dataViewMappings": [{
    "conditions": [{ "content": { "min": 1, "max": 1 }, "category": { "min": 0, "max": 1 } }],
    "categorical": {
      "categories": { "for": { "in": "category" }, "dataReductionAlgorithm": { "top": { "count": 30 } } },
      "values":     { "select": [ { "bind": { "to": "content" } } ] }
    }
  }],
  "objects": {},
  "supportsEmptyDataView": false,
  "suppressDefaultTitle": true
}
```

[`visual.ts`](../../pbiviz-semantica-renderer/src/visual.ts) — ~491 lines. Class fields:

- `root: HTMLElement`
- `host: IVisualHost`
- `selectionManager: ISelectionManager`
- `prevCountValues: Map<string, number>` — for count-up animation carry-over
- `rafHandles: number[]`
- `hasAppliedAxisFilter: boolean` (state flag, currently unused — see revert history)
- `tooltipEl: HTMLElement | null` — singleton floating tooltip

`update(options)` routes by measure shape (~lines 106–125):

```
const firstVal = cat?.values?.[0]?.values?.[0]
const looksLikeHtml = typeof firstVal === 'string' && firstVal.trimStart().startsWith('<')
if  (hasCategory && looksLikeHtml) renderHtmlWithSelection(...)
else if (hasCategory)              renderBarChart(...)
else                                renderHtml(...)
```

Three render modes:

- `renderHtml` (~line 353) — scalar/HTML measure, no category bound.
- `renderBarChart` (~line 381) — numeric measure + bound category; client-side bar render (legacy fallback).
- `renderHtmlWithSelection` (~line 181) — HTML measure + bound category; wires click handlers on `[data-sbar-cat]` and `[data-axis-section]`. Primary-axis clicks fire `selectionManager.select(selId, multi)`; non-primary-axis clicks do DOM-only opacity dim within that section.

`wireAxisPills()` (~line 134) toggles `[data-axis-section]` display on pill click.

`animateCountUp()` scans `[data-countup]` elements, respects `prefers-reduced-motion`, animates via `requestAnimationFrame` with ease-out-cubic.

### 5.5 DAX builders — `daxTemplateBuilder.js`

[`ui/src/pages/powerbi/daxTemplateBuilder.js`](../../ui/src/pages/powerbi/daxTemplateBuilder.js) exports one builder per visual type plus the dispatcher:

| Function | Line | Behavior |
|---|---|---|
| `buildKpiDax(visual, theme)` | 111 | Produces scalar DAX that evaluates to HTML (card chrome + value + optional sparkline/trend/progress). |
| `buildGaugeDax(visual, theme)` | 346 | Produces HTML with SVG arc. |
| `buildBarDax(visual, theme)` | 383 | Multi-axis bar: `axisList = [primary, …nonPrimary]`; per-axis `_rows${i}/_maxVal${i}/_avg${i}/_barHtml${i}` blocks; pills HTML + section wrappers. |
| `buildStackedBarDax(visual, theme)` | 754 | Stacked bar HTML. |
| `buildTableDax(visual, theme)` | 815 | HTML `<table>`. |
| `buildFunnelDax`, `buildDonutDax`, `buildLineDax`, `buildRadarDax`, `buildScatterDax`, `buildTreemapDax` | various | Currently all delegate to `buildBarDax`. |
| `buildLiveDax(visual, theme)` | 907 | Dispatcher via `DAX_BUILDERS` map; defaults to `buildKpiDax`. |

**`buildBarDax` specifics** (lines ~383–750):

- `axisList` construction (~413–424): primary = visual's dimension; non-primary = `config.axisOptions` minus the primary (deduped).
- `buildRowTemplate(axisDim, idx)` (~581–623): row DAX that uses `_maxVal${idx}`. For non-primary axes, the row's `_val = CALCULATE([measure], ALL('primary.table'[primary.column]))` to strip PBI's per-row primary filter.
- Per-axis block (~653–686):
  ```
  VAR _rows${idx}    = CALCULATETABLE(TOPN(limit, FILTER(VALUES(...), NOT ISBLANK(measure)), measure, DESC), ALLSELECTED(...)[, ALL('primary')])
  VAR _maxVal${idx}  = CALCULATE(MAXX(_rows${idx}, measure), …)
  VAR _avg${idx}     = CALCULATE(AVERAGEX(_rows${idx}, measure), …)
  VAR _barHtml${idx} = CONCATENATEX(_rows${idx}, buildRowTemplate(ax, idx), "", measure, DESC)
  ```
- Pills HTML (~688–719): `<button data-axis-idx data-active-bg/border/color data-inactive-bg/border/color>` — `visual.ts` swaps styles on click.
- Section wrappers (~721–731): `<div data-axis-section='N' data-axis-table='T' data-axis-column='C' style='display: flex | none'>`.
- Theme-aware branching via `isDark`: card bg, scrollbar colors, grid stroke, typography colors, tooltip bg/border/text.

### 5.6 TMDL measure injection

[`ui/src/pages/powerbi/tmdlMeasureInjector.js`](../../ui/src/pages/powerbi/tmdlMeasureInjector.js):

- `measureNameForVisual(visualId)` → `_SemanticaHtml_<clean>_<hash>`
- `tooltipMeasureNameForVisual(visualId)` → `_SemanticaTooltipHtml_<clean>_<hash>`
- `buildSemanticaGeneratedTableLiveDax(visuals)` emits a TMDL file for a `_SemanticaGenerated` table containing one measure per visual (DAX body wrapped in backtick-block) and a `mode: import` partition with a base64-compressed empty M query.
- `rewriteTmdlPartsWithLiveDax(originalParts, visuals)` drops any existing `_SemanticaGenerated.tmdl` in the parts, appends the fresh one, returns `{ parts, measuresByVisualId, tableName }`.

### 5.7 Bundled .pbiviz handling

[`electron/ipc/powerbi.js`](../../electron/ipc/powerbi.js):

- `getBundledPbiviz()` (~608) — scans `pbiviz-semantica-renderer/dist/*.pbiviz`, picks newest by `mtime`, unzips via `adm-zip`, returns `{ guid, name, version, pieces: { metadata, js, css, icon } }`.
- `getBundledCustomVisualParts()` (~716) — same scan + unzip, maps every entry to PBIR report parts under `CustomVisuals/<guid>/<path>` with `InlineBase64` payloads.
- Both cache keyed by `filename|mtime` — rebuilds of the `.pbiviz` are picked up without restarting Electron (fix added in current session).
- IPC handlers registered (~769–782): `pbi-get-bundled-pbiviz`, `pbi-get-custom-visual-parts`.

---

## 6. Theme / token system

Two copies exist:

1. **`ui/src/appspec/getThemeTokens.ts`** (159 lines) — TS interface `ThemeTokens` + `DARK_TOKENS` + `LIGHT_TOKENS` + `default` export `getThemeTokens(mode)`.
2. **Inline `getThemeTokens(theme)` in `AppSpecRenderer.jsx:28–85`** — JS-only replica.

The inline version is the one actually used by render paths (`AppSpecRenderer.jsx` does not import from the `.ts` file).

### 6.1 Token categories

| Token | Dark | Light |
|---|---|---|
| `CARD_BG` | `linear-gradient(180deg, rgba(20,20,34,0.98)…)` | `linear-gradient(180deg, #FFFFFF…)` |
| `CARD_BORDER` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.08)` |
| `CARD_SHADOW` | `0 16px 36px rgba(0,0,0,0.28)…` | `0 4px 16px rgba(0,0,0,0.06)…` |
| `textPrimary` | `rgba(255,255,255,0.92)` | `#1E293B` |
| `textSecondary` | `rgba(255,255,255,0.65)` | `#475569` |
| `textMuted` | `rgba(255,255,255,0.4)` | `#94A3B8` |
| `textFaint` | `rgba(255,255,255,0.18)` | `#CBD5E1` |
| `gridStroke` | rgba-on-white | rgba-on-black |
| `canvasBg` | `#0b0b12` | `#F1F5F9` |
| `dotGrid` | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.04)` |
| `TT_STYLE` | object with `background:'#0e0e1c'` | `background:'#FFFFFF'` |

Plus function tokens (color → style): `kpiBgFn`, `kpiBorderFn`, `kpiBorderTop`, `kpiShadowFn`, `kpiAccentFn`, `accentBgFn`, `chartBorderTop`.

### 6.2 Theme flow

- Top-level `theme` prop flows into `AppSpecRenderer` from AppGenerator + standalone entry ([`index.jsx:125`](../../ui/src/standalone/index.jsx#L125)).
- Inside `AppSpecRenderer`, `T = useMemo(() => getThemeTokens(theme), [theme])` is set and passed into every chartConfig as `_T`.
- Each `Compact<Type>` reads `config._T || getThemeTokens('dark')` as a fallback.
- PBI publish threads `canvasTheme` into `buildLiveDax(visual, canvasTheme)` → each DAX builder branches on `isDark = theme !== 'light'`.

### 6.3 Color palettes

[`AppSpecRenderer.jsx:13–24`](../../ui/src/appspec/AppSpecRenderer.jsx#L13) — `PALETTES`:

| Scheme | start | mid | text |
|---|---|---|---|
| `teal` | #14B8A6 | #2DD4BF | #14B8A6 |
| `blue` | #3B82F6 | #60A5FA | #3B82F6 |
| `gold` | #F59E0B | #FBBF24 | #F59E0B |
| `green` | #22C55E | #4ADE80 | #22C55E |
| `purple` | #A855F7 | #C084FC | #A855F7 |
| `violet` | #8B5CF6 | #A78BFA | #8B5CF6 |
| `rose` | #F43F5E | #FB7185 | #F43F5E |
| `red` | #EF4444 | #F87171 | #EF4444 |
| `orange` | #F97316 | #FB923C | #F97316 |
| `amber` | #F59E0B | #FCD34D | #F59E0B |

`MULTI_COLORS` (line 25): `['#14B8A6','#3B82F6','#A855F7','#F59E0B','#22C55E','#F43F5E']` for multi-series.

Helpers:

- `pal(scheme)` — returns palette object or `teal` fallback.
- `getColorValue(scheme)` — returns `pal(scheme).start`.

### 6.4 Card chrome helper

`getCardChromeStyle({ config, colorVal, T, isKpi, isSelected })` at [`AppSpecRenderer.jsx:206`](../../ui/src/appspec/AppSpecRenderer.jsx#L206) returns a style object. Six `cardStyle` variants: `filled`, `glass`, `glossy`, `accent`, `bordered`, `minimal` (default). Selection override applies a 2px `#818CF8` border + glow.

Consumed by all render paths (edit GridLayout, freeform view, section KPI row, section chart row) and by `CanvasEditor`.

---

## 7. Recharts — full import grep

**3 files import from `recharts`:**

### `ui/src/appspec/AppSpecRenderer.jsx` (lines 3–8)
```js
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ScatterChart, Scatter, ZAxis, Treemap, LabelList,
  PieChart, Pie, Cell,
} from 'recharts'
```

### `ui/src/pages/DashboardBuilder.jsx` (lines 4–10)
```js
import {
  BarChart, Bar, AreaChart, Area, CartesianGrid,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  LabelList,
} from 'recharts'
```

### `ui/src/pages/VisualBuilder.jsx` (lines 3–9)
```js
import {
  BarChart, Bar, AreaChart, Area, CartesianGrid,
  XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, LabelList,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter, ZAxis, Treemap,
  PieChart, Pie, FunnelChart, Funnel,
} from 'recharts'
```

`VisualBuilder.jsx` also imports from `d3-sankey` (line 10):
```js
import { sankey as d3sankey, sankeyLinkHorizontal } from 'd3-sankey'
```

### Recharts usage per Compact* component

| Component | Recharts primitives used |
|---|---|
| `CompactBar` | `ResponsiveContainer`, `BarChart`, `CartesianGrid`, `XAxis`, `YAxis`, `Tooltip`, `Bar`, `LabelList`, `Cell` (per row) |
| `CompactStackedBar` | `ResponsiveContainer`, `BarChart`, `XAxis`, `YAxis`, `Tooltip`, `Bar` |
| `CompactLine` | `ResponsiveContainer`, `AreaChart`, `CartesianGrid`, `XAxis`, `YAxis`, `Tooltip`, `Area` (primary + optional secondary), `LabelList` |
| `CompactDonut`, `CompactPie` | `ResponsiveContainer`, `PieChart`, `Pie`, `Cell`, `Tooltip` |
| `CompactRadar` | `ResponsiveContainer`, `RadarChart`, `PolarGrid`, `PolarAngleAxis`, `Radar`, `Tooltip` |
| `CompactScatter`, `CompactBubble` | `ResponsiveContainer`, `ScatterChart`, `CartesianGrid`, `XAxis`, `YAxis`, `ZAxis`, `Tooltip`, `Scatter`, `Cell` |
| `CompactTreemap` | `ResponsiveContainer`, `Treemap` |
| `CompactGauge` | `ResponsiveContainer`, `BarChart`, `Bar`, `Cell` (with SVG arc overlay) |
| `CompactGroupedBar` | `ResponsiveContainer`, `BarChart`, `Bar` × 2 |
| `CompactStackedArea` | `ResponsiveContainer`, `AreaChart`, `Area` × 2 |
| `CompactBumpChart` | `ResponsiveContainer`, `LineChart` |
| `CompactSunburst` | `ResponsiveContainer`, `PieChart`, `Pie` × N, `Cell`, `Tooltip` |

### Non-Recharts rendering

| Component | Rendering approach |
|---|---|
| `CompactFunnel` | CSS `<div>`s with proportional widths |
| `CompactTable` | HTML `<table>` |
| `CompactRankedList` | Flex column + inline SVG bars |
| `CompactHeatmap` | CSS Grid of color-coded `<div>`s |
| `CompactWaffle` | SVG 10×10 grid of squares |
| `CompactLollipop` | SVG circle + line |
| `CompactBullet` | SVG rect segments |
| `CompactProgressBar` | SVG rect + text |
| `CompactSlopeChart` | SVG lines |
| `CompactChord` (also `sankey`) | Hand-rolled SVG arcs + paths |
| `CompactWaterfall` | SVG rects + cumulative line |
| `CompactStatCard` | HTML + SVG accent |
| `CompactMetricTile` | SVG ring progress |
| `CompactSparklineKpi` | HTML + `SparklineSvg` helper |
| `CompactKpi` | HTML + animated counter + optional `SparklineSvg` |
| `CompactNarrative` | HTML text only |
| `SankeyPreview` (VisualBuilder only) | D3 sankey layout + SVG rects + paths |

---

## 8. Existing primitive-like abstractions

Anything that already looks reusable across visuals:

| Primitive | File : line | Shape |
|---|---|---|
| `getThemeTokens(theme)` | [AppSpecRenderer.jsx:28](../../ui/src/appspec/AppSpecRenderer.jsx#L28) (inline) + [getThemeTokens.ts:155](../../ui/src/appspec/getThemeTokens.ts) | `(theme) => ThemeTokens` |
| `PALETTES` / `pal(scheme)` / `getColorValue(scheme)` | [AppSpecRenderer.jsx:13–24](../../ui/src/appspec/AppSpecRenderer.jsx#L13) | Scheme name → hex triplet |
| `hexToRgb(hex)` | [AppSpecRenderer.jsx:56–59](../../ui/src/appspec/AppSpecRenderer.jsx#L56) | Hex string → `[r, g, b]` |
| `fmtVal(v, prefix, suffix)` | [AppSpecRenderer.jsx:47–54](../../ui/src/appspec/AppSpecRenderer.jsx#L47) | Number + affixes → formatted string (B/M/k abbreviation) |
| `fmtAxisNumber(v)` | [AppSpecRenderer.jsx:367–375](../../ui/src/appspec/AppSpecRenderer.jsx#L367) | Axis tick formatter |
| `truncateAxisLabel(label, maxLen)` | [AppSpecRenderer.jsx:376–379](../../ui/src/appspec/AppSpecRenderer.jsx#L376) | String truncation |
| `AppBarTooltip` | [AppSpecRenderer.jsx:381–403](../../ui/src/appspec/AppSpecRenderer.jsx#L381) | Recharts-compatible `<Tooltip content>` component |
| `LoadingShimmer` | [AppSpecRenderer.jsx:405–417](../../ui/src/appspec/AppSpecRenderer.jsx#L405) | 5-bar skeleton loader with `spec-pulse` keyframe |
| `EmptyState` | [AppSpecRenderer.jsx:419–432](../../ui/src/appspec/AppSpecRenderer.jsx#L419) | "No data" / error card |
| `SparklineSvg` | [AppSpecRenderer.jsx:436–468](../../ui/src/appspec/AppSpecRenderer.jsx#L436) | SVG polyline + optional gradient fill |
| `useCountUp(target)` | [AppSpecRenderer.jsx:470–500](../../ui/src/appspec/AppSpecRenderer.jsx#L470) | rAF animated counter, respects `prefers-reduced-motion` |
| `getCardChromeStyle({ config, colorVal, T, isKpi, isSelected })` | [AppSpecRenderer.jsx:206–276](../../ui/src/appspec/AppSpecRenderer.jsx#L206) | Card background/border/shadow for 6 `cardStyle` variants |
| `getCardAnimation(config)` | [AppSpecRenderer.jsx:2805–2817](../../ui/src/appspec/AppSpecRenderer.jsx#L2805) | CSS `animation` string from `animationPreset` / `animationDuration` / `animationDelay` |
| `getHoverHandlers(config)` | [AppSpecRenderer.jsx:2819–2828](../../ui/src/appspec/AppSpecRenderer.jsx#L2819) | `{ onMouseEnter, onMouseLeave }` for scale + shadow lift |
| `AxisSwitchPills` | [AxisSwitchPills.jsx](../../ui/src/appspec/AxisSwitchPills.jsx) | Shared pill-button switcher. Props: `visual, axisOverride, onPick, colorVal, mutedColor, borderColor, fontFamily, stopClickPropagation` |
| `getEffectiveGroupBy(visual, axisOverrides)` | [AxisSwitchPills.jsx:77](../../ui/src/appspec/AxisSwitchPills.jsx#L77) | Returns override or fallback `visual.data.groupBy` |
| `VISUAL_MAP` | [AppSpecRenderer.jsx](../../ui/src/appspec/AppSpecRenderer.jsx) (~line 2231) | `visual.type` → component reference |
| `buildAppliedFiltersForVisual(spec, visual, globalFilters, filterSources)` | [AppSpecRenderer.jsx:2357](../../ui/src/appspec/AppSpecRenderer.jsx#L2357) | Merges slicer-sourced filters with cross-filter state, excluding the filter sourced by `visual.id` itself |
| `getSourceSelectedCat(visual, globalFilters, filterSources)` | [AppSpecRenderer.jsx](../../ui/src/appspec/AppSpecRenderer.jsx) (near the above) | Returns the category this visual sourced (for self-dim) |
| `normalizeLayout(spec)` | [AppSpecRenderer.jsx](../../ui/src/appspec/AppSpecRenderer.jsx) | Normalizes `rowHeight`, fills missing positions, etc. |
| Shared cursor-following tooltip | [visual.ts:289–318](../../pbiviz-semantica-renderer/src/visual.ts#L289) | `ensureTooltipEl()` + `positionTooltip(el, e)` — singleton `<div class="semantica-cursor-tt">` with viewport-edge flip |
| `animateCountUp()` (PBI side) | [visual.ts:48–94](../../pbiviz-semantica-renderer/src/visual.ts#L48) | rAF counter animation; mirrors `useCountUp` for the DAX-HTML path |
| `buildRowTemplate(axisDim, idx)` | [daxTemplateBuilder.js:581–623](../../ui/src/pages/powerbi/daxTemplateBuilder.js#L581) | Per-axis DAX row template generator; referenced from within `buildBarDax` |
| `daxAbbrevFormat` (and sibling DAX string helpers) | [daxTemplateBuilder.js](../../ui/src/pages/powerbi/daxTemplateBuilder.js) | Emits DAX that formats scalars with B/M/k abbreviation — shared between `buildKpiDax` / `buildBarDax` / `buildTableDax` |
| `cleanAffix(x)` | [daxTemplateBuilder.js](../../ui/src/pages/powerbi/daxTemplateBuilder.js) | Normalizes prefix/suffix strings (empties `'null'` / `'undefined'` text) |

Inspector (not a visual primitive but adjacent):

- [`VisualInspector.jsx`](../../ui/src/appspec/VisualInspector.jsx) exposes `ToggleField`, `SelectField`, `ColorField`, `TextField`, `NumberField`, `FontField`, `ElementPanel`, plus `AxisSwitcherEditor` for editing `config.axisOptions`.

---

## 9. Key constants & magic numbers

| Constant | File:line | Value |
|---|---|---|
| `ROW_HEIGHT` default | AppSpecRenderer.jsx:2779 | 80 |
| `GAP` default | AppSpecRenderer.jsx:2780 | 8 |
| Grid columns | hardcoded | 12 |
| `BAR_SCROLL_THRESHOLD` | AppSpecRenderer.jsx:341 | 10 |
| `PX_PER_BAR_ROW` | AppSpecRenderer.jsx:342 | 44 |
| Recharts `Bar.maxBarSize` in `CompactBar` | AppSpecRenderer.jsx:~813 | 26 |
| PBI DAX bar `height` | daxTemplateBuilder.js:~563 | 26px (matches `maxBarSize`) |
| PBI DAX `catW` column | daxTemplateBuilder.js:~463 | 140px |
| Max axes in `config.axisOptions` | per `PATCH_SYSTEM_PROMPT` | 4 |
| `VISUAL_GUID` | publishCustomVisualFlow.js:~21 | `semanticaRenderer4A7F2D9B8C3E1F5A6D4B2C8E9F1A3B7D` |
| `MEASURE_TABLE` | publishCustomVisualFlow.js | `_SemanticaGenerated` |
