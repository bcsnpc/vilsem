/**
 * publishCustomVisualFlow — publishes dashboards to Power BI using the
 * vilsem Renderer custom visual (instead of HTML Content).
 *
 * Approach (from CUSTOM_VISUAL_PUBLISH_BREAKTHROUGH.md — 2026-04-17):
 *   1. Pre-render HTML for each visual via htmlTemplates
 *   2. Inject _SemanticaHtml_<id> measures into dataset TMDL
 *   3. Embed CustomVisuals/<guid>/ parts from the bundled .pbiviz on disk
 *   4. Build legacy report.json format (NOT PBIR) with:
 *        - resourcePackage type: 0
 *        - visualType: base GUID (no _OrgStore suffix)
 *        - projections + prototypeQuery (not queryState)
 *   5. Create/update report via Fabric API
 */

import { renderVisualToHtml } from './htmlTemplates/index.js'
import { mergeTmdlPartsWithLiveDax } from './tmdlMeasureInjector.js'
import { buildLiveDax, buildDataOnlyDax, buildPrimitiveSpecJson, isPrimitiveCovered } from './daxTemplateBuilder.js'

// The vilsem Renderer custom visual GUID (from vilsem-renderer/pbiviz.json)
const VISUAL_GUID = 'semanticaRenderer4A7F2D9B8C3E1F5A6D4B2C8E9F1A3B7D'
const MEASURE_TABLE = '_SemanticaGenerated'

function parseDimensionString(dim) {
  if (!dim || typeof dim !== 'string') return null
  const m = dim.match(/^(.+?)\[(.+)\]$/)
  return m ? { table: m[1], column: m[2] } : null
}

/**
 * Load CustomVisuals/<guid>/ parts directly from the bundled .pbiviz on disk.
 * No scanning, no reference report needed — the visual binary ships with the app.
 */
async function loadBundledCustomVisualParts() {
  const result = await window.semantica.pbiGetCustomVisualParts()
  if (!result?.success) {
    throw new Error(result?.message || 'Failed to load bundled custom visual')
  }
  console.log('[publishCustomVisualFlow] loaded', result.parts.length, 'parts from', result.filename)
  return result.parts
}

/**
 * Build visualContainer config (legacy format) for a Semantica custom visual
 * bound to a single measure from _SemanticaGenerated table.
 */
function buildVisualContainer(visualSlug, measureName, x, y, w, h, tabOrder, dimension, primitiveSpecJson = null, secondaryMeasureName = null, tertiaryMeasureName = null, dimension2 = null, dimension3 = null, dimension4 = null, dimension5 = null, dimension6 = null, tableMeasureNames = null) {
  // vcObjects.* properties hide the PBI visual container chrome (background,
  // header, border) so only our custom-visual HTML shows.
  const hideProp = { properties: { show: { expr: { Literal: { Value: 'false' } } } } }
  const transparentBg = {
    properties: {
      show:         { expr: { Literal: { Value: 'false' } } },
      color:        { solid: { color: { expr: { Literal: { Value: "'#000000'" } } } } },
      transparency: { expr: { Literal: { Value: '100D' } } },
    },
  }

  const fromClauses = [{ Name: '_', Entity: MEASURE_TABLE, Type: 0 }]
  const projections = {}
  const selectItems = []

  // Table visuals: bind all N _M0.._MN-1 measures to the content role.
  // Non-table visuals: bind the single primary measure to content.
  if (tableMeasureNames && tableMeasureNames.length > 0) {
    projections.content = tableMeasureNames.map(name => ({ queryRef: `${MEASURE_TABLE}.${name}` }))
    for (const name of tableMeasureNames) {
      selectItems.push({
        Measure: { Expression: { SourceRef: { Source: '_' } }, Property: name },
        Name: `${MEASURE_TABLE}.${name}`,
        NativeReferenceName: name,
      })
    }
  } else {
    projections.content = [{ queryRef: `${MEASURE_TABLE}.${measureName}` }]
    selectItems.push({
      Measure: { Expression: { SourceRef: { Source: '_' } }, Property: measureName },
      Name: `${MEASURE_TABLE}.${measureName}`,
      NativeReferenceName: measureName,
    })
  }

  // Phase 5.3 — secondary/tertiary measure projection. capabilities.json declared
  // the data roles in Phase 5.2; here we actually bind additional measures onto
  // them so multi-measure visuals (stacked/grouped bar, scatter+secondary, bubble)
  // get _val2 / _val3 in the dataView. Each secondary/tertiary references the
  // SAME _SemanticaGenerated table, just a different measure column.
  if (secondaryMeasureName) {
    projections.secondary = [{ queryRef: `${MEASURE_TABLE}.${secondaryMeasureName}` }]
    selectItems.push({
      Measure: { Expression: { SourceRef: { Source: '_' } }, Property: secondaryMeasureName },
      Name: `${MEASURE_TABLE}.${secondaryMeasureName}`,
      NativeReferenceName: secondaryMeasureName,
    })
  }
  if (tertiaryMeasureName) {
    projections.tertiary = [{ queryRef: `${MEASURE_TABLE}.${tertiaryMeasureName}` }]
    selectItems.push({
      Measure: { Expression: { SourceRef: { Source: '_' } }, Property: tertiaryMeasureName },
      Name: `${MEASURE_TABLE}.${tertiaryMeasureName}`,
      NativeReferenceName: tertiaryMeasureName,
    })
  }

  // Dimension columns: category through category6, each with a distinct source alias.
  // The renderer reads dv.categorical.categories[] dynamically so all bound columns appear.
  const dimBindings = [
    [dimension,  'category',  'd'],
    [dimension2, 'category2', 'd2'],
    [dimension3, 'category3', 'd3'],
    [dimension4, 'category4', 'd4'],
    [dimension5, 'category5', 'd5'],
    [dimension6, 'category6', 'd6'],
  ]
  for (const [dim, role, alias] of dimBindings) {
    const parsed = parseDimensionString(dim)
    if (!parsed) continue
    const ref = `${parsed.table}.${parsed.column}`
    projections[role] = [{ queryRef: ref, active: true }]
    selectItems.push({
      Column: { Expression: { SourceRef: { Source: alias } }, Property: parsed.column },
      Name: ref, NativeReferenceName: parsed.column,
    })
    fromClauses.push({ Name: alias, Entity: parsed.table, Type: 0 })
  }

  const config = {
    name: visualSlug,
    layouts: [{ id: 0, position: { x, y, z: tabOrder, width: w, height: h, tabOrder } }],
    singleVisual: {
      visualType: VISUAL_GUID,
      projections,
      prototypeQuery: {
        Version: 2,
        From: fromClauses,
        Select: selectItems,
      },
      drillFilterOtherVisuals: true,
      vcObjects: {
        background:   [transparentBg],
        visualHeader: [hideProp],
        border:       [hideProp],
        title:        [hideProp],
        lockAspect:   [hideProp],
        general:      [{ properties: { keepLayerOrder: { expr: { Literal: { Value: 'true' } } } } }],
      },
      // Phase 5.2/5.3 — primitive spec carrier. capabilities.json declares
      // `objects.semantica.primitiveSpec` (NOT vcObjects), so PBI only routes
      // it to `dataView.metadata.objects.semantica.primitiveSpec` when it sits
      // here at the singleVisual level. Putting it under vcObjects silently
      // drops it (vcObjects is for container chrome only).
      ...(primitiveSpecJson ? {
        objects: {
          semantica: [{
            properties: {
              primitiveSpec: { expr: { Literal: { Value: `'${primitiveSpecJson.replace(/'/g, "''")}'` } } },
            },
          }],
        },
      } : {}),
    },
  }
  return {
    config: JSON.stringify(config),
    filters: '[]',
    height: h,
    width: w,
    x,
    y,
    z: tabOrder,
  }
}

/**
 * Build a legacy-format native PBI slicer visual container.
 * Slicers bind to a real column in the semantic model — no _SemanticaGenerated
 * measure needed. The `type` field maps to PBI slicer data mode.
 */
function buildSlicerContainer(slicer, tabOrder, canvasTheme = 'dark') {
  const isDark = canvasTheme !== 'light'
  const pbiMode = slicer.type === 'date_range'  ? 'Between'
                : slicer.type === 'multi_select' ? 'List'
                : slicer.type === 'buttons'      ? 'List'
                : 'Dropdown'
  const isMulti = slicer.type === 'multi_select' || slicer.type === 'buttons'

  const alias = 'sc'
  const queryRef = `${slicer.table}.${slicer.column}`
  const slug = `sl_${String(slicer.id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`

  // Theme-matched colors
  const headerBg   = isDark ? '#0F172A' : '#F8FAFC'
  const headerText = isDark ? '#94A3B8' : '#475569'
  const itemBg     = isDark ? '#1E293B' : '#FFFFFF'
  const itemText   = isDark ? '#E2E8F0' : '#1E293B'
  const borderCol  = isDark ? '#334155' : '#CBD5E1'

  const colorLit = (c) => ({ solid: { color: { expr: { Literal: { Value: `'${c}'` } } } } })
  const lit      = (v)  => ({ expr: { Literal: { Value: v } } })

  const slicerObjects = {
    data: [{ properties: { mode: lit(`'${pbiMode}'`) } }],
    header: [{ properties: {
      show:       lit('true'),
      fontColor:  colorLit(headerText),
      background: colorLit(headerBg),
      outline:    lit("'None'"),
      textSize:   lit('11D'),
    } }],
    items: [{ properties: {
      fontColor:  colorLit(itemText),
      background: colorLit(itemBg),
      outline:    lit("'None'"),
      textSize:   lit('11D'),
    } }],
    general: [{ properties: {
      outlineColor: colorLit(borderCol),
      outlineWeight: lit('1D'),
    } }],
    ...(isMulti ? {
      selection: [{ properties: {
        singleSelect:             lit('false'),
        selectAllCheckboxEnabled: lit('true'),
      } }],
    } : {}),
    ...(slicer.type === 'date_range' ? {
      date: [{ properties: {
        fontColor: colorLit(itemText),
        background: colorLit(itemBg),
      } }],
    } : {}),
  }

  const config = {
    name: slug,
    layouts: [{ id: 0, position: {
      x: Number(slicer.x) || 0,
      y: Number(slicer.y) || 0,
      z: tabOrder,
      width:    Number(slicer.width)  || 300,
      height:   Number(slicer.height) || 80,
      tabOrder,
    } }],
    singleVisual: {
      visualType: 'slicer',
      projections: {
        Values: [{ queryRef, active: true }],
      },
      prototypeQuery: {
        Version: 2,
        From: [{ Name: alias, Entity: slicer.table, Type: 0 }],
        Select: [{
          Column: {
            Expression: { SourceRef: { Source: alias } },
            Property: slicer.column,
          },
          Name: queryRef,
          NativeReferenceName: slicer.column,
        }],
      },
      objects: slicerObjects,
      vcObjects: {
        background:   [{ properties: { show: lit('false') } }],
        visualHeader: [{ properties: { show: lit('false') } }],
      },
    },
  }

  return {
    config: JSON.stringify(config),
    filters: '[]',
    height: Number(slicer.height) || 80,
    width:  Number(slicer.width)  || 300,
    x: Number(slicer.x) || 0,
    y: Number(slicer.y) || 0,
    z: tabOrder,
  }
}

/**
 * Build the full legacy report.json.
 */
function buildLegacyReportJson({
  pages,
  measuresByVisualId,
  secondaryMeasuresByVisualId = {},
  tertiaryMeasuresByVisualId = {},
  tableMeasureNamesByVisualId = {},
  specsByVisualId = {},
  canvasTheme = 'dark',
}) {
  const isDark = canvasTheme !== 'light'
  const pageBg = isDark ? '#0b0b12' : '#FFFFFF'
  // Page-level background: dark or light to match Semantica canvas
  const sectionConfig = JSON.stringify({
    objects: {
      background: [{
        properties: {
          color: { solid: { color: { expr: { Literal: { Value: `'${pageBg}'` } } } } },
          transparency: { expr: { Literal: { Value: '0D' } } },
        },
      }],
    },
  })
  const reportConfig = {
    version: '5.72',
    themeCollection: {
      baseTheme: {
        name: 'CY24SU06',
        version: { visual: '1.8.79', report: '2.0.79', page: '1.3.79' },
        type: 2,
      },
    },
    activeSectionIndex: 0,
    defaultDrillFilterOtherVisuals: true,
    settings: {
      useNewFilterPaneExperience: true,
      allowChangeFilterTypes: true,
      useStylableVisualContainerHeader: true,
      useEnhancedTooltips: true,
      exportDataMode: 1,
      useDefaultAggregateDisplayName: true,
    },
  }

  const sections = pages.map((page, pageIdx) => {
    const visualContainers = []
    let tabOrder = 1000
    for (const visual of page.visuals || []) {
      const measureName = measuresByVisualId[visual.id]
      const tableNames = tableMeasureNamesByVisualId[visual.id]
      // Table visuals use tableNames[] bound to content; all others use a single measureName.
      if (!measureName && !(tableNames && tableNames.length > 0)) continue
      const slug = `v${visualContainers.length + 1}_${String(visual.id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`
      visualContainers.push(buildVisualContainer(
        slug, measureName || tableNames[0],
        Number(visual.x) || 0,
        Number(visual.y) || 0,
        Number(visual.width) || 240,
        Number(visual.height) || 168,
        tabOrder,
        visual.dimension,
        specsByVisualId[visual.id] || null,
        secondaryMeasuresByVisualId[visual.id] || null,
        tertiaryMeasuresByVisualId[visual.id]  || null,
        (visual.dimensions?.[1]) || null,
        (visual.dimensions?.[2]) || null,
        (visual.dimensions?.[3]) || null,
        (visual.dimensions?.[4]) || null,
        (visual.dimensions?.[5]) || null,
        tableMeasureNamesByVisualId[visual.id]  || null,
      ))
      tabOrder += 10
    }
    for (const slicer of page.slicers || []) {
      if (!slicer.table || !slicer.column) continue
      visualContainers.push(buildSlicerContainer(slicer, tabOrder, canvasTheme))
      tabOrder += 10
    }
    return {
      config: sectionConfig,
      displayName: page.name || `Page ${pageIdx + 1}`,
      displayOption: 1, // FitToPage
      filters: '[]',
      height: Number(page.height) || 720,
      width: Number(page.width) || 1280,
      name: `Page${pageIdx + 1}`,
      visualContainers,
    }
  })

  return {
    config: JSON.stringify(reportConfig),
    layoutOptimization: 0,
    resourcePackages: [
      {
        resourcePackage: {
          disabled: false,
          name: 'SharedResources',
          type: 2,
          items: [{ name: 'CY24SU06', path: 'BaseThemes/CY24SU06.json', type: 202 }],
        },
      },
      {
        resourcePackage: {
          disabled: false,
          name: VISUAL_GUID,
          type: 0,
          items: [{
            name: `${VISUAL_GUID}.pbiviz.json`,
            path: `${VISUAL_GUID}.pbiviz.json`,
            type: 5,
          }],
        },
      },
    ],
    sections,
  }
}

/**
 * @param {Object} args
 * @param {Array}  args.pages              — [{ id, name, width, height, visuals: [...] }]
 * @param {string} args.workspaceId
 * @param {string} args.datasetId
 * @param {string|null} args.reportId     — update existing or null to create new
 * @param {string} args.reportName
 * @param {string} [args.workspaceName]
 * @param {string} [args.datasetName]
 * @param {string} [args.canvasTheme]
 * @param {string} [args.referenceReportId] — optional; which report to clone CustomVisuals/ parts from
 * @param {Function} [args.onProgress]
 *
 * @returns {Promise<{ success, reportId, reportName, measuresByVisualId, tableName }>}
 */
export async function publishCustomVisualFlow({
  pages, workspaceId, datasetId, reportId, reportName,
  workspaceName, datasetName, canvasTheme = 'dark',
  referenceReportId, onProgress,
}) {
  const progress = (pct, stage) => { if (onProgress) onProgress(pct, stage) }

  // ── 1. Pre-fetch data for every visual, then render HTML ───────────
  progress(5, 'Fetching visual data…')
  const htmlByVisualId = {}
  const totalVisuals = pages.reduce((n, p) => n + (p.visuals?.length || 0), 0)
  let done = 0

  // Cache model context once for sparkline auto-detection
  let modelCtxCache = null
  const getModelCtx = async () => {
    if (modelCtxCache !== null) return modelCtxCache
    try { modelCtxCache = await window.semantica.getModelContext() }
    catch { modelCtxCache = {} }
    return modelCtxCache
  }

  const KPI_TYPES = new Set(['kpi', 'stat_card', 'metric_tile', 'sparkline_kpi', 'bullet', 'progress', 'gauge'])

  async function fetchSparklineData(visual) {
    const cfg = visual.config || {}
    const measure = visual.measures?.[0]
    if (!measure) return null
    const axis = cfg.sparklineAxis
    const dateCols = []
    if (axis) {
      dateCols.push(axis)
    } else {
      const ctx = await getModelCtx()
      for (const table of (ctx?.tables || [])) {
        const isDateTable = table.type === 'date' || /calendar|date|time/i.test(table.name)
        if (!isDateTable) continue
        const cols = table.columns || []
        const month = cols.find(c => /month/i.test(c.name) && /start|date/i.test(c.name)) || cols.find(c => /^month$/i.test(c.name))
        if (month) dateCols.push(`${table.name}[${month.name}]`)
        const quarter = cols.find(c => /quarter/i.test(c.name) && /start|date/i.test(c.name))
        if (quarter) dateCols.push(`${table.name}[${quarter.name}]`)
        const year = cols.find(c => /^year$/i.test(c.name)) || cols.find(c => /year/i.test(c.name))
        if (year) dateCols.push(`${table.name}[${year.name}]`)
      }
    }
    for (const col of dateCols) {
      try {
        const res = await window.semantica.queryTable({
          groupBy: [col], measures: [measure], filters: {}, limit: 500, orderBy: 'asc',
        })
        if (res?.rows?.length > 2) {
          const pts = res.rows
            .map(r => r[measure] ?? Object.values(r).find(x => typeof x === 'number'))
            .filter(v => typeof v === 'number')
          if (pts.length > 2) return pts
        }
      } catch { /* try next */ }
    }
    return null
  }

  for (const page of pages) {
    for (const visual of page.visuals || []) {
      if (!Array.isArray(visual.measures) || visual.measures.length === 0) {
        done++; continue
      }
      let queryResult = null
      try {
        const dim = parseDimensionString(visual.dimension)
        queryResult = dim
          ? await window.semantica.queryTable({
              groupBy: [visual.dimension],
              measures: visual.measures,
              filters: {},
              limit:   visual.limit || 25,
              orderBy: visual.orderBy || 'desc',
            })
          : await window.semantica.query({
              measures: visual.measures,
              filters: {},
            })
      } catch (e) {
        console.warn('[publishCustomVisualFlow] data fetch failed for', visual.id, e?.message)
      }

      // Pin font sizes from card pixel height — same formula used by
      // Semantica CompactKpi so both platforms render identically.
      if (KPI_TYPES.has(visual.type)) {
        visual.config = visual.config || {}
        const h = Number(visual.height) || 168
        if (visual.config.valueFontSize == null) {
          visual.config.valueFontSize = Math.round(Math.max(22, Math.min(40, h * 0.2)))
        }
        if (visual.config.titleFontSize == null) {
          visual.config.titleFontSize = Math.round(Math.max(10, Math.min(14, h * 0.07)))
        }
      }

      // Normalize sparklineAxis — LLMs sometimes emit {table, column} instead
      // of the canonical "Table[Column]" string. Coerce before auto-detect fallback.
      if (visual.config?.sparklineAxis && typeof visual.config.sparklineAxis === 'object') {
        const a = visual.config.sparklineAxis
        visual.config.sparklineAxis = (a.table && a.column) ? `${a.table}[${a.column}]` : null
      }

      // Resolve sparkline axis column so live-DAX can generate SVG that
      // re-evaluates with filter context. Mutates visual.config.sparklineAxis
      // when auto-detection finds a date column.
      let sparkData = null
      if (KPI_TYPES.has(visual.type) && visual.config?.showSparkline) {
        if (!visual.config.sparklineAxis) {
          const ctx = await getModelCtx()
          for (const table of (ctx?.tables || [])) {
            const isDateTable = table.type === 'date' || /calendar|date|time/i.test(table.name)
            if (!isDateTable) continue
            const cols = table.columns || []
            const best = cols.find(c => /month/i.test(c.name) && /start|date/i.test(c.name))
              || cols.find(c => /^month$/i.test(c.name))
              || cols.find(c => /quarter/i.test(c.name) && /start|date/i.test(c.name))
              || cols.find(c => /^year$/i.test(c.name))
            if (best) { visual.config.sparklineAxis = `${table.name}[${best.name}]`; break }
          }
        }
        // Optionally also pre-fetch data for the static HTML fallback
        try { sparkData = await fetchSparklineData(visual) }
        catch (e) { console.warn('[publishCustomVisualFlow] sparkline fetch failed for', visual.id, e?.message) }
      }

      try {
        const enriched = sparkData ? { ...visual, _sparkData: sparkData } : visual
        const html = renderVisualToHtml(enriched, queryResult, canvasTheme)
        htmlByVisualId[visual.id] = html
      } catch (e) {
        console.warn('[publishCustomVisualFlow] render failed for', visual.id, e?.message)
      }
      done++
      progress(5 + Math.round((done / Math.max(totalVisuals, 1)) * 10), 'Rendering visual HTML…')
    }
  }

  // ── 2. Fetch current dataset TMDL ──────────────────────────────────
  progress(15, 'Fetching dataset model…')
  const tmdl = await window.semantica.pbismGetDefinition({ workspaceId, datasetId })
  const tmdlParts = tmdl?.parts || tmdl?.definition?.parts || []

  // ── 3. Build LIVE DAX measures + inject ────────────────────────────
  // Live DAX expressions interpolate measure values into HTML at query time,
  // so slicer/filter context flows through to the custom visual output.
  // Falls back to static HTML when a visual type has no DAX builder yet.
  progress(30, 'Building live-DAX measures…')
  const daxByVisualId = {}
  // Phase 5.2: primitive-covered visuals also collect a JSON spec that's
  // embedded on the visual container as `objects.semantica.primitiveSpec`.
  const specsByVisualId = {}
  // Phase 5.3: multi-measure visuals (stacked/grouped bar, scatter+secondary,
  // bubble) emit secondary/tertiary measure DAX too. Each gets a separate TMDL
  // measure (named via secondary/tertiaryMeasureNameForVisual) and a separate
  // data-role binding in the visual container.
  const secondaryDaxByVisualId = {}
  const tertiaryDaxByVisualId = {}
  // Table visuals: all N measures bound to content role (_M0.._MN-1).
  // {visualId: [dax0, dax1, ..., daxN]} — one DAX body per measure index.
  const tableMeasureListsByVisualId = {}
  for (const page of pages) {
    for (const visual of page.visuals || []) {
      if (!Array.isArray(visual.measures) || visual.measures.length === 0) continue
      const cfg = visual.config || {}
      // Dump the FULL config so we can see every override end-to-end
      console.log('[publishCustomVisualFlow] visual', visual.id, 'FULL CONFIG:')
      console.log(JSON.stringify(cfg, null, 2))
      // Phase 5.2: primitive-covered visuals use a different DAX path (raw data
      // measure body, no HTML) AND get a JSON spec embedded on the visual
      // container so the .pbiviz can compose the chart at render time.
      // Specialized hand-rolled types (chord/sunburst/waffle/etc.) stay on the
      // legacy live-DAX HTML path — no behavior change for those.
      // Axis-switcher bars: the primitive ECharts path can only bind one category
      // at a time, so axis pills (pre-computed DAX for all axes) can't work there.
      // Fall back to the legacy HTML path which embeds all axis data and wires
      // the pill buttons in renderHtmlWithSelection → wireAxisPills().
      const hasAxisSwitcher = Array.isArray(cfg.axisOptions) &&
        cfg.axisOptions.some(o => o?.groupBy?.table && o?.groupBy?.column)

      if (isPrimitiveCovered(visual.type) && !hasAxisSwitcher) {
        try {
          // Table: bind ALL N measures to the content role so PBI returns them
          // all as separate value columns (dv.categorical.values[0..N-1]).
          // Chart visuals keep the content/secondary/tertiary 3-slot pattern.
          if (visual.type === 'table') {
            const allDax = visual.measures
              .map((_, i) => buildDataOnlyDax(visual, i))
              .filter(Boolean)
            if (allDax.length > 0) {
              tableMeasureListsByVisualId[visual.id] = allDax
              specsByVisualId[visual.id] = buildPrimitiveSpecJson(visual, canvasTheme)
              console.log('  → table primitive path:', allDax.length, 'measures')
              continue
            }
          } else {
            const dax = buildDataOnlyDax(visual, 0)
            if (dax && dax.trim()) {
              daxByVisualId[visual.id] = dax
              specsByVisualId[visual.id] = buildPrimitiveSpecJson(visual, canvasTheme)
              // Phase 5.3 — multi-measure visuals: emit secondary/tertiary measure
              // bodies too. The renderer reads them from dataView roles and the
              // primitive composer projects them into _val2 / _val3.
              const dax2 = buildDataOnlyDax(visual, 1)
              if (dax2 && dax2.trim()) secondaryDaxByVisualId[visual.id] = dax2
              const dax3 = buildDataOnlyDax(visual, 2)
              if (dax3 && dax3.trim()) tertiaryDaxByVisualId[visual.id] = dax3
              console.log('  → primitive path:', visual.type, '— spec bytes:', specsByVisualId[visual.id].length,
                dax2 ? '(+secondary)' : '', dax3 ? '(+tertiary)' : '')
              continue
            }
          }
        } catch (e) {
          console.warn('[publishCustomVisualFlow] primitive DAX build failed for', visual.id, e?.message)
        }
        // If primitive build failed, fall through to legacy path below
      }

      try {
        const dax = buildLiveDax(visual, canvasTheme)
        // Dump full DAX for anything with a non-default cardStyle so we can
        // inspect value/spark/progress colors
        if (cfg.cardStyle && cfg.cardStyle !== 'minimal') {
          console.log('  FULL DAX:\n', dax)
        } else {
          const bgMatch = dax.match(/background:([^;]+);/)
          if (bgMatch) console.log('  → DAX bg:', bgMatch[1].substring(0, 120))
        }
        if (dax && dax.trim()) {
          daxByVisualId[visual.id] = dax
          continue
        }
      } catch (e) {
        console.warn('[publishCustomVisualFlow] DAX build failed for', visual.id, e?.message)
      }
      // Fallback: wrap the static HTML as a DAX string literal so the measure
      // still returns something (no filter-reactivity for that visual)
      const staticHtml = htmlByVisualId[visual.id] || ''
      daxByVisualId[visual.id] = `"${staticHtml.replace(/"/g, '""')}"`
    }
  }

  progress(40, 'Injecting measures…')
  // MERGE (not replace) so measures other already-published reports on this dataset
  // reference are preserved — replacing wiped them and broke those reports.
  const injectionResult = mergeTmdlPartsWithLiveDax(
    tmdlParts, daxByVisualId, secondaryDaxByVisualId, tertiaryDaxByVisualId, tableMeasureListsByVisualId
  )
  const newTmdlParts = injectionResult.parts
  const measuresByVisualId            = injectionResult.measuresByVisualId
  const secondaryMeasuresByVisualId   = injectionResult.secondaryMeasuresByVisualId   || {}
  const tertiaryMeasuresByVisualId    = injectionResult.tertiaryMeasuresByVisualId    || {}
  const tableMeasureNamesByVisualId   = injectionResult.tableMeasureNamesByVisualId   || {}

  progress(45, 'Updating dataset…')
  const tmdlResult = await window.semantica.pbismUpdateDefinition({
    workspaceId, datasetId,
    parts: newTmdlParts.map(p => ({
      path: p.path,
      payload: btoa(unescape(encodeURIComponent(p.content || ''))),
      payloadType: 'InlineBase64',
    })),
  })
  if (tmdlResult && tmdlResult.success === false) {
    throw new Error(`Dataset update failed: ${tmdlResult.message || 'TMDL write rejected by Fabric'}. Try publishing again.`)
  }

  // ── 4. Load custom visual binary from bundled .pbiviz on disk ──────
  progress(55, 'Loading custom visual binary…')
  const customVisualParts = await loadBundledCustomVisualParts()

  // ── 5. Build legacy report.json ────────────────────────────────────
  progress(70, 'Building report…')
  const reportJson = buildLegacyReportJson({
    pages,
    measuresByVisualId,
    secondaryMeasuresByVisualId,
    tertiaryMeasuresByVisualId,
    tableMeasureNamesByVisualId,
    specsByVisualId,
    canvasTheme,
  })

  const wsName = workspaceName || ''
  const encodedWs = encodeURIComponent(wsName)
  const connectionString =
    `Data Source=powerbi://api.powerbi.com/v1.0/myorg/${encodedWs};` +
    `Initial Catalog=${datasetName || ''};` +
    `semanticModelId=${datasetId};` +
    `Integrated Security=ClaimsToken`

  const reportParts = [
    {
      path: '.platform',
      payload: btoa(unescape(encodeURIComponent(JSON.stringify({
        $schema: 'https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json',
        metadata: { type: 'Report', displayName: reportName },
        config: { version: '2.0', logicalId: crypto.randomUUID() },
      })))),
      payloadType: 'InlineBase64',
    },
    {
      path: 'definition.pbir',
      payload: btoa(unescape(encodeURIComponent(JSON.stringify({
        $schema: 'https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/2.0.0/schema.json',
        version: '4.0',
        datasetReference: { byConnection: { connectionString } },
      })))),
      payloadType: 'InlineBase64',
    },
    {
      path: 'report.json',
      payload: btoa(unescape(encodeURIComponent(JSON.stringify(reportJson)))),
      payloadType: 'InlineBase64',
    },
    ...customVisualParts,
  ]

  // ── 6. Create or update report ─────────────────────────────────────
  progress(85, reportId ? 'Updating report…' : 'Creating report…')
  let resultReportId = reportId
  let resultReportName = reportName
  if (reportId) {
    const upd = await window.semantica.pbiUpdateReportDefinition({
      workspaceId, reportId, parts: reportParts,
    })
    // Surface a real failure instead of silently reporting "Done".
    if (upd && upd.success === false) {
      throw new Error(`Report update failed: ${upd.message || upd.error?.message || 'Fabric rejected the report definition'}.`)
    }
  } else {
    const created = await window.semantica.pbiCreateReport({
      workspaceId, reportName, parts: reportParts,
    })
    // createReport resolves with { success:false, message } on LRO/permission/
    // payload failures — don't treat that as a successful publish.
    if (!created || created.success === false) {
      throw new Error(`Report creation failed: ${created?.message || created?.error?.message || 'Fabric rejected the report'}.`)
    }
    resultReportId   = created.reportId || created.id || null
    resultReportName = created.reportName || reportName
    // Some Fabric create LROs succeed without returning the new id in the
    // operation result. Recover it by name so the "Open in Power BI" link works
    // (and to confirm the report actually landed in the workspace).
    if (!resultReportId) {
      try {
        const listRes = await window.semantica.pbiListReports?.({ workspaceId, datasetId, force: true })
        const found = listRes?.reports?.find(r => r.name === reportName)
        if (found) resultReportId = found.id
      } catch { /* best-effort id recovery */ }
    }
  }

  progress(100, 'Done')
  return {
    success: true,
    reportId: resultReportId,
    reportName: resultReportName,
    measuresByVisualId,
    tableName: MEASURE_TABLE,
  }
}
