/**
 * reportBuilder_htmlcontent — STANDALONE PBIR builder for the HTML Content
 * publish path. Completely separate from reportBuilder.js (Semantica Renderer
 * org-library path). Nothing in this file is imported by the existing flow.
 *
 * Publish pipeline (wired in ReportEditor.jsx handlePublish with a rendererMode
 * flag):
 *   1. For each visual, render HTML via htmlTemplates/ (same as the other path)
 *   2. Generate measure names `_SemanticaHtml_<visualSlug>` via tmdlMeasureInjector
 *   3. Call pbismGetDefinition → inject _SemanticaGenerated.tmdl table →
 *      call pbismUpdateDefinition so the dataset now has one measure per visual
 *   4. Build PBIR report parts where each visual:
 *      - visualType = HTML Content visual's AppSource guid
 *      - projection = binds the _SemanticaHtml_<visualSlug> measure to the
 *        HTML Content visual's data role (typically named "values" or "content")
 *   5. Publish the report via the existing pbiCreateReport / pbiUpdateReportDefinition
 *
 * HTML Content visual reference:
 *   https://appsource.microsoft.com/en-us/product/power-bi-visuals/WA200001930
 *   GUID: htmlContent443BE3AD55E043BF878BED274D3A6865
 *   Data role (from dm-p's capabilities.json): "values"
 */

// ── Schema URLs (same versions as the original builder) ─────────────────────

const SCHEMA = {
  visual:    'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.7.0/schema.json',
  page:      'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json',
  pagesMeta: 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.0.0/schema.json',
  report:    'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/report/3.2.0/schema.json',
  version:   'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/versionMetadata/1.0.0/schema.json',
  pbir:      'https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/2.0.0/schema.json',
  platform:  'https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json',
}

// HTML Content (lite). GUID ends in 6855 (verified via getDefinition of a
// manually-configured reference report — I originally had a typo 6865).
const HTML_CONTENT_VISUAL_GUID = 'htmlContent443BE3AD55E043BF878BED274D3A6855'

// Semantica Renderer — our OWN custom visual (embedded binary). Used by the
// injector's real-renderer path so injected chart/primitive visuals render as
// live ECharts (reading objects.semantica.primitiveSpec) instead of the static
// HTML-Content visual. Must match pbiviz-semantica-renderer/pbiviz.json.
const SEMANTICA_RENDERER_GUID = 'semanticaRenderer4A7F2D9B8C3E1F5A6D4B2C8E9F1A3B7D'

// Role name is "content" (lowercase). Also verified from the reference
// extract. Neither "values" nor "Values" matched; the correct name is "content".
const HTML_CONTENT_ROLE_NAME = 'content'

// Table + column names used when binding measures from `_SemanticaGenerated`.
const SEMANTICA_GENERATED_TABLE = '_SemanticaGenerated'

// ── Public entry point ──────────────────────────────────────────────────────

/**
 * @param {Object} args
 * @param {Array<{path,content}>|null} args.originalParts
 * @param {Array}  args.pages
 * @param {string} args.datasetId
 * @param {string} args.reportName
 * @param {string} [args.workspaceName]
 * @param {string} [args.datasetName]
 * @param {Object<string,string>} args.measuresByVisualId  — visualId -> measure name in _SemanticaGenerated
 * @returns {Array<{path,content}>}
 */
export function buildHtmlContentReportParts({
  originalParts,
  pages,
  datasetId,
  reportName,
  workspaceName,
  datasetName,
  measuresByVisualId = {},
  tooltipMeasuresByVisualId = {},
}) {
  // Plan hidden tooltip pages: one per visual that has a tooltip measure.
  // Keys: visualId → tooltipPageName. Consumed by buildVisualJson to wire
  // tooltipInfo on each main visual and by the page builders to emit the
  // hidden pages themselves.
  const tooltipPageByVisualId = {}
  for (const visualId of Object.keys(tooltipMeasuresByVisualId || {})) {
    tooltipPageByVisualId[visualId] = `tooltip_${visualIdSlug(visualId)}`
  }

  const ctx = { measuresByVisualId, tooltipMeasuresByVisualId, tooltipPageByVisualId }

  const parts = (Array.isArray(originalParts) && originalParts.length > 0)
    ? buildExistingReportParts({ originalParts, pages, ctx })
    : buildNewReportParts({ pages, datasetId, reportName, workspaceName, datasetName, ctx })

  console.log('[HTMLContent Builder] PBIR parts:', parts.map((p) => p.path))
  const vjson = parts.find((p) => /\/visuals\/[^/]+\/visual\.json$/.test(p.path))
  if (vjson) {
    try {
      console.log('[HTMLContent Builder] sample visual.json:', JSON.stringify(JSON.parse(vjson.content), null, 2))
    } catch { /* ignore */ }
  }
  return parts
}

// ── Existing report path ────────────────────────────────────────────────────

function buildExistingReportParts({ originalParts, pages, ctx }) {
  const reportJsonEntry = originalParts.find((p) => isReportJsonPath(p.path))
  let reportJson = reportJsonEntry ? safeParse(reportJsonEntry.content) : null
  if (!reportJson) reportJson = createDefaultReportJson()
  reportJson = ensureHtmlContentRegistered(reportJson)

  const semanticaPagesPartList = buildFullPagePartList({ pages, ctx })
  const pageOrder = semanticaPagesPartList.pageOrder

  const newPagesMetaPart = {
    path: 'definition/pages/pages.json',
    content: JSON.stringify({
      $schema:        SCHEMA.pagesMeta,
      pageOrder,
      activePageName: pageOrder[0] || 'ReportSection',
    }, null, 2),
  }

  const passThroughs = originalParts.filter((p) => {
    if (isReportJsonPath(p.path)) return false
    if (isPagesMetaPath(p.path))  return false
    if (semanticaPagesPartList.dropPaths.has(p.path)) return false
    return true
  }).map((p) => ({ path: p.path, content: p.content }))

  return [
    ...passThroughs,
    {
      path:    reportJsonEntry?.path || 'definition/report.json',
      content: JSON.stringify(reportJson, null, 2),
    },
    newPagesMetaPart,
    ...semanticaPagesPartList.parts,
  ]
}

function buildFullPagePartList({ pages, ctx }) {
  const parts = []
  const pageOrder = []

  pages.forEach((page, idx) => {
    const pageDir = pageDirName(page.id, idx)
    pageOrder.push(pageDir)
    parts.push({
      path:    `definition/pages/${pageDir}/page.json`,
      content: JSON.stringify(buildPageJson(page, pageDir), null, 2),
    })
    const renderable = (page.visuals || []).filter(visualHasMeasures)
    for (const visual of renderable) {
      parts.push({
        path:    `definition/pages/${pageDir}/visuals/${visualIdSlug(visual.id)}/visual.json`,
        content: JSON.stringify(buildVisualJson(visual, ctx), null, 2),
      })
    }
    for (const slicer of (page.slicers || [])) {
      parts.push({
        path:    `definition/pages/${pageDir}/visuals/${visualIdSlug(slicer.id)}/visual.json`,
        content: JSON.stringify(buildSlicerJson(slicer), null, 2),
      })
    }
  })

  // Phase 9a — Report Page Tooltips were attempted but HTML Content (lite)
  // visual does NOT support the PBI tooltip API (no "tooltips" declaration
  // in its capabilities.json, no tooltipService calls in its code). Tooltip
  // pages would be generated but never shown on hover. Removed to keep the
  // published report clean. Custom tooltips require either (a) a visual
  // that implements the tooltip API, or (b) cross-filter/live DAX measures
  // (Phase 9b deferred).

  return { parts, pageOrder, dropPaths: makeAllPagePathsDropper() }
}

// ── New report path ─────────────────────────────────────────────────────────

function buildNewReportParts({ pages, datasetId, reportName, workspaceName, datasetName, ctx }) {
  const parts = []

  parts.push({
    path:    '.platform',
    content: JSON.stringify({
      $schema: SCHEMA.platform,
      metadata: { type: 'Report', displayName: reportName },
      config:   { version: '2.0', logicalId: uuid() },
    }, null, 2),
  })

  const encodedWs = encodeURIComponent(workspaceName || '')
  const connectionString =
    `Data Source=powerbi://api.powerbi.com/v1.0/myorg/${encodedWs};` +
    `Initial Catalog=${datasetName || ''};` +
    `semanticModelId=${datasetId || ''};` +
    `Integrated Security=ClaimsToken`

  parts.push({
    path:    'definition.pbir',
    content: JSON.stringify({
      $schema: SCHEMA.pbir,
      version: '4.0',
      datasetReference: {
        byConnection: { connectionString },
      },
    }, null, 2),
  })

  parts.push({
    path:    'definition/version.json',
    content: JSON.stringify({ $schema: SCHEMA.version, version: '2.0.0' }, null, 2),
  })

  const reportJson = ensureHtmlContentRegistered(createDefaultReportJson())
  parts.push({
    path:    'definition/report.json',
    content: JSON.stringify(reportJson, null, 2),
  })

  const pageOrder = []
  pages.forEach((page, idx) => {
    const pageDir = pageDirName(page.id, idx)
    pageOrder.push(pageDir)
    parts.push({
      path:    `definition/pages/${pageDir}/page.json`,
      content: JSON.stringify(buildPageJson(page, pageDir), null, 2),
    })
    const renderable = (page.visuals || []).filter(visualHasMeasures)
    for (const visual of renderable) {
      parts.push({
        path:    `definition/pages/${pageDir}/visuals/${visualIdSlug(visual.id)}/visual.json`,
        content: JSON.stringify(buildVisualJson(visual, ctx), null, 2),
      })
    }
    for (const slicer of (page.slicers || [])) {
      parts.push({
        path:    `definition/pages/${pageDir}/visuals/${visualIdSlug(slicer.id)}/visual.json`,
        content: JSON.stringify(buildSlicerJson(slicer), null, 2),
      })
    }
  })

  parts.push({
    path:    'definition/pages/pages.json',
    content: JSON.stringify({
      $schema:        SCHEMA.pagesMeta,
      pageOrder,
      activePageName: pageOrder[0] || 'ReportSection',
    }, null, 2),
  })

  return parts
}

// ── Page / visual builders ──────────────────────────────────────────────────

function buildPageJson(page, pageDir) {
  // Honor page-level width/height if present (set by mapAppSpecToPages for
  // AppGenerator publishes). Defaults match Power BI's standard 16:9 page.
  const height = Number(page.height) > 0 ? Math.round(Number(page.height)) : 720
  const width  = Number(page.width)  > 0 ? Math.round(Number(page.width))  : 1280
  // Always FitToWidth — dashboards with multiple visual rows benefit from
  // fitting the page width to the viewport and scrolling vertically. FitToPage
  // shrinks everything to fit viewport height, making visuals tiny.
  const displayOption = 'FitToWidth'
  return {
    $schema:       SCHEMA.page,
    name:          pageDir,
    displayName:   page.name || page.displayName || 'Page',
    displayOption,
    height,
    width,
    objects:       buildPageObjects(page.background || (page.theme === 'light' ? '#FFFFFF' : '#0F1117')),
  }
}

function buildPageObjects(bg) {
  const colorLit = (c) => ({
    solid: { color: { expr: { Literal: { Value: `'${c}'` } } } },
  })
  return {
    background: [{
      properties: {
        color:        colorLit(bg),
        transparency: { expr: { Literal: { Value: '0' } } },
      },
    }],
    outspace: [{ properties: { color: colorLit(bg) } }],
  }
}

function buildVisualJson(visual, ctx) {
  const {
    measuresByVisualId,
    secondaryMeasuresByVisualId = {},
    tertiaryMeasuresByVisualId = {},
    tableMeasureNamesByVisualId = {},
    specsByVisualId = {},
  } = ctx || {}
  const measureName   = measuresByVisualId?.[visual.id]
  const secondaryName = secondaryMeasuresByVisualId?.[visual.id]
  const tertiaryName  = tertiaryMeasuresByVisualId?.[visual.id]
  const tableMeasures = tableMeasureNamesByVisualId?.[visual.id]   // array (table primitive)
  const primitiveSpec = specsByVisualId?.[visual.id]               // JSON string → chart mode
  const isPrimitive   = !!primitiveSpec

  // Injector real-renderer path: chart/primitive visuals render via our embedded
  // Semantica Renderer (reads primitiveSpec) when ctx.rendererGuid is provided.
  // Otherwise — and for every baked-HTML visual — fall back to HTML-Content.
  // publishHtmlContentFlow never sets rendererGuid, so it is unaffected.
  const visualTypeGuid = (isPrimitive && ctx?.rendererGuid) ? ctx.rendererGuid : HTML_CONTENT_VISUAL_GUID

  const w = num(visual.width,  420)
  const h = num(visual.height, 280)
  const x = num(visual.x, 0)
  const y = num(visual.y, 0)
  // High z so injected visuals stack ON TOP of the existing native visuals.
  const z = 30000

  const measureProj = (name) => ({
    field:          { Measure: { Property: name, Expression: { SourceRef: { Entity: SEMANTICA_GENERATED_TABLE } } } },
    queryRef:       `${SEMANTICA_GENERATED_TABLE}.${name}`,
    nativeQueryRef: name,
  })
  const columnProj = (table, col) => ({
    field:          { Column: { Property: col, Expression: { SourceRef: { Entity: table } } } },
    queryRef:       `${table}.${col}`,
    nativeQueryRef: col,
  })
  const parseDim = (s) => { const m = /^(.+)\[(.+)\]$/.exec(String(s || '')); return m ? { table: m[1], column: m[2] } : null }

  const queryState = {}
  const contentProjs = (Array.isArray(tableMeasures) && tableMeasures.length)
    ? tableMeasures.map(measureProj)
    : (measureName ? [measureProj(measureName)] : [])
  if (contentProjs.length) queryState[HTML_CONTENT_ROLE_NAME] = { projections: contentProjs }
  if (secondaryName) queryState.secondary = { projections: [measureProj(secondaryName)] }
  if (tertiaryName)  queryState.tertiary  = { projections: [measureProj(tertiaryName)] }

  // Category role(s) — binding the group-by column gives the visual selection
  // identities so it cross-filters (both directions). Chart/primitive mode only.
  if (isPrimitive) {
    const dims = (Array.isArray(visual.dimensions) && visual.dimensions.length)
      ? visual.dimensions
      : (visual.dimension ? [visual.dimension] : [])
    const catRoles = ['category', 'category2', 'category3', 'category4', 'category5', 'category6']
    dims.slice(0, 6).forEach((d, i) => { const p = parseDim(d); if (p) queryState[catRoles[i]] = { projections: [columnProj(p.table, p.column)] } })
  }

  const queryBlock = Object.keys(queryState).length ? { queryState } : undefined

  // Chart mode carries the primitiveSpec (renderer draws from the live dataView);
  // HTML mode keeps contentFormatting (renderer shows the measure's HTML).
  const objects = isPrimitive
    ? { semantica: [{ properties: { primitiveSpec: { expr: { Literal: { Value: `'${String(primitiveSpec).replace(/'/g, "''")}'` } } } } }] }
    : { contentFormatting: [{ properties: {
          showRawHtml: { expr: { Literal: { Value: 'false' } } },
          hyperlinks:  { expr: { Literal: { Value: 'false' } } },
        } }] }

  return {
    $schema: SCHEMA.visual,
    name:    visualIdSlug(visual.id),
    position: { x, y, z, width: w, height: h, tabOrder: z },
    visual: {
      visualType: visualTypeGuid,
      ...(queryBlock ? { query: queryBlock } : {}),
      drillFilterOtherVisuals: true,
      objects,
      visualContainerObjects: {
        background:   [{ properties: { show: { expr: { Literal: { Value: 'false' } } } } }],
        visualHeader: [{ properties: { show: { expr: { Literal: { Value: 'false' } } } } }],
      },
    },
  }
}

// ── Native PBI slicer builder ───────────────────────────────────────────────

function buildSlicerJson(slicer) {
  const w = num(slicer.width,  300)
  const h = num(slicer.height,  80)
  const x = num(slicer.x, 0)
  const y = num(slicer.y, 0)
  const z = 30001   // injected slicers on top too (just above injected visuals)

  // Map Semantica slicer type → PBI slicer mode
  const pbiMode = slicer.type === 'date_range'    ? 'Between'
                : slicer.type === 'multi_select'   ? 'List'
                : slicer.type === 'buttons'        ? 'List'
                : 'Dropdown'

  const isMulti = slicer.type === 'multi_select' || slicer.type === 'buttons'

  const col = {
    Column: {
      Property:   slicer.column,
      Expression: { SourceRef: { Entity: slicer.table } },
    },
  }

  const slicerObjects = {
    data: [{ properties: { mode: { expr: { Literal: { Value: `'${pbiMode}'` } } } } }],
    ...(isMulti ? {
      selection: [{ properties: {
        singleSelect:             { expr: { Literal: { Value: 'false' } } },
        selectAllCheckboxEnabled: { expr: { Literal: { Value: 'true'  } } },
      } }],
    } : {}),
  }

  return {
    $schema: SCHEMA.visual,
    name:    visualIdSlug(slicer.id),
    position: { x, y, z, width: w, height: h, tabOrder: z },
    visual: {
      visualType: 'slicer',
      query: {
        queryState: {
          Values: {
            projections: [{
              field:          col,
              queryRef:       `${slicer.table}.${slicer.column}`,
              nativeQueryRef: slicer.column,
            }],
          },
        },
      },
      objects: slicerObjects,
      visualContainerObjects: {
        background: [{ properties: { show: { expr: { Literal: { Value: 'false' } } } } }],
        visualHeader: [{ properties: { show: { expr: { Literal: { Value: 'false' } } } } }],
      },
    },
  }
}

// ── Tooltip page + visual builders (Phase 9a) ──────────────────────────────

/**
 * Produce a list of { pageDir, parts[] } for each hidden tooltip page.
 * One page per visual that has a tooltip measure in ctx.
 */
function buildTooltipPageParts(ctx) {
  const { tooltipMeasuresByVisualId, tooltipPageByVisualId } = ctx || {}
  if (!tooltipMeasuresByVisualId || !tooltipPageByVisualId) return []

  const out = []
  for (const visualId of Object.keys(tooltipMeasuresByVisualId)) {
    const pageDir      = tooltipPageByVisualId[visualId]
    const tooltipMName = tooltipMeasuresByVisualId[visualId]
    if (!pageDir || !tooltipMName) continue

    // "Allow use as tooltip" is controlled by pageInformation.pageInformationType
    // in the page's formatting objects. The pageBinding with type:'Tooltip' is
    // also needed. Together they tell PBI this page is a tooltip page.
    const tooltipPageObjects = buildPageObjects('#0B0B14')
    tooltipPageObjects.pageInformation = [{
      properties: {
        pageInformationType: { expr: { Literal: { Value: '1' } } },
      },
    }]

    const page = {
      $schema:       SCHEMA.page,
      name:          pageDir,
      displayName:   `Tooltip ${visualIdSlug(visualId).slice(0, 6)}`,
      displayOption: 'ActualSize',
      height:        200,
      width:         320,
      visibility:    'HiddenInViewMode',
      pageBinding: {
        name: `${pageDir}_binding`,
        type: 'Tooltip',
      },
      objects: tooltipPageObjects,
    }

    const visualJson = buildTooltipVisualJson(visualId, tooltipMName)

    out.push({
      pageDir,
      parts: [
        {
          path:    `definition/pages/${pageDir}/page.json`,
          content: JSON.stringify(page, null, 2),
        },
        {
          path:    `definition/pages/${pageDir}/visuals/${visualIdSlug(visualId)}_tt/visual.json`,
          content: JSON.stringify(visualJson, null, 2),
        },
      ],
    })
  }
  return out
}

function buildTooltipVisualJson(visualId, tooltipMeasureName) {
  const slug = visualIdSlug(visualId) + '_tt'
  return {
    $schema: SCHEMA.visual,
    name:    slug,
    position: { x: 0, y: 0, z: 1000, width: 320, height: 200, tabOrder: 1000 },
    visual: {
      visualType: HTML_CONTENT_VISUAL_GUID,
      query: {
        queryState: {
          [HTML_CONTENT_ROLE_NAME]: {
            projections: [{
              field: {
                Measure: {
                  Property:   tooltipMeasureName,
                  Expression: { SourceRef: { Entity: SEMANTICA_GENERATED_TABLE } },
                },
              },
              queryRef:       `${SEMANTICA_GENERATED_TABLE}.${tooltipMeasureName}`,
              nativeQueryRef: tooltipMeasureName,
            }],
          },
        },
      },
      drillFilterOtherVisuals: true,
      objects: {
        contentFormatting: [{
          properties: {
            showRawHtml: { expr: { Literal: { Value: 'false' } } },
            hyperlinks:  { expr: { Literal: { Value: 'false' } } },
          },
        }],
      },
      visualContainerObjects: {
        background: [{
          properties: { show: { expr: { Literal: { Value: 'false' } } } },
        }],
      },
    },
  }
}

// ── report.json + registration ──────────────────────────────────────────────

function createDefaultReportJson() {
  return {
    $schema: SCHEMA.report,
    themeCollection: {
      baseTheme: {
        name: 'CY24SU06',
        reportVersionAtImport: { visual: '1.8.79', report: '2.0.79', page: '1.3.79' },
        type: 'SharedResources',
      },
    },
    objects: {
      section: [{
        properties: { verticalAlignment: { expr: { Literal: { Value: "'Top'" } } } },
      }],
    },
    publicCustomVisuals: [],
    resourcePackages: [{
      name: 'SharedResources',
      type: 'SharedResources',
      items: [{ name: 'CY24SU06', path: 'BaseThemes/CY24SU06.json', type: 'BaseTheme' }],
    }],
    settings: {
      useStylableVisualContainerHeader: true,
      exportDataMode:                   'AllowSummarized',
      defaultDrillFilterOtherVisuals:   true,
      allowChangeFilterTypes:           true,
      useEnhancedTooltips:              true,
      useDefaultAggregateDisplayName:   true,
    },
  }
}

function ensureHtmlContentRegistered(reportJson) {
  if (!Array.isArray(reportJson.publicCustomVisuals)) {
    reportJson.publicCustomVisuals = []
  }
  if (!reportJson.publicCustomVisuals.includes(HTML_CONTENT_VISUAL_GUID)) {
    reportJson.publicCustomVisuals.push(HTML_CONTENT_VISUAL_GUID)
  }
  return reportJson
}

// Register our embedded custom-visual GUID in publicCustomVisuals (idempotent).
// Paired with dropping the CustomVisuals/<guid>/ binary parts into the report.
function ensureSemanticaRendererRegistered(reportJson, guid) {
  if (!guid) return reportJson
  if (!Array.isArray(reportJson.publicCustomVisuals)) {
    reportJson.publicCustomVisuals = []
  }
  if (!reportJson.publicCustomVisuals.includes(guid)) {
    reportJson.publicCustomVisuals.push(guid)
  }
  return reportJson
}

// ── Reusable exports (consumed by the PBI Injector) ─────────────────────────
//
// The injector builds 1-2 visuals against an EXISTING report rather than
// rebuilding the whole report. It needs the same per-visual builder, the
// HTML Content registration helper, and the path/id helpers — but not the
// full buildHtmlContentReportParts orchestration. Exporting individual
// pieces avoids duplicating ~50 lines of subtle PBIR detail.

export {
  buildVisualJson,
  buildSlicerJson,
  ensureHtmlContentRegistered,
  ensureSemanticaRendererRegistered,
  isReportJsonPath,
  visualIdSlug,
  pageDirName,
  safeParse,
  HTML_CONTENT_VISUAL_GUID,
  HTML_CONTENT_ROLE_NAME,
  SEMANTICA_RENDERER_GUID,
  SEMANTICA_GENERATED_TABLE,
  SCHEMA,
}

// ── Path / id helpers (copied from reportBuilder.js) ───────────────────────

function isReportJsonPath(path) {
  if (!path) return false
  return /(^|\/)report\.json$/i.test(path) && !/\/pages\/.*\/report\.json$/i.test(path)
}
function isPagesMetaPath(path) {
  if (!path) return false
  return /\/?definition\/pages\/pages\.json$/i.test(path)
}
function makeAllPagePathsDropper() {
  return { has: (path) => /\/?definition\/pages\/[^/]+\/(page\.json|visuals\/.+)/i.test(path) }
}
function pageDirName(pageId, fallbackIdx) {
  if (!pageId) return `ReportSection${fallbackIdx > 0 ? fallbackIdx : ''}`
  const cleaned = String(pageId).replace(/-/g, '').replace(/[^A-Za-z0-9]/g, '')
  if (!cleaned) return `ReportSection${fallbackIdx > 0 ? fallbackIdx : ''}`
  return /^[A-Za-z]/.test(cleaned) ? cleaned : `s${cleaned}`
}
function visualIdSlug(visualId) {
  if (!visualId) return `v${Math.random().toString(36).slice(2, 10)}`
  return String(visualId).replace(/-/g, '').replace(/[^A-Za-z0-9]/g, '')
}
function visualHasMeasures(v) {
  return Array.isArray(v?.measures) && v.measures.length > 0
}
function safeParse(text) {
  if (typeof text !== 'string' || !text.trim()) return null
  try { return JSON.parse(text) } catch { return null }
}
function num(v, fallback) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}
function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}
