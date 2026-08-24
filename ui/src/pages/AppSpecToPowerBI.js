/**
 * AppSpec → Power BI pages mapper
 * ────────────────────────────────
 * Transforms an App Generator AppSpec (from generate-app-spec) into the
 * `pages[]` structure that publishHtmlContentFlow consumes.
 *
 * Both shapes represent the same conceptual thing (a dashboard of visuals),
 * just with different position conventions:
 *   • AppSpec: 12-column grid, `position: {x, y, w, h}` in grid units
 *   • Power BI pages: absolute pixel coords, `{x, y, width, height}`
 *
 * This is a pure transform — no IO, no side effects.
 */

import { DEFAULT_PAGE_SIZE, PAGE_SIZE_PRESETS, PAGE_SIZE_LIMITS, OBJECT_TYPES } from '../appspec/schema.js'

function clampDim(v, min, max) {
  if (!Number.isFinite(v)) return null
  return Math.max(min, Math.min(max, Math.round(v)))
}

/**
 * Resolve the effective page dimensions for an AppSpec.
 * Honors explicit width/height, preset name, or falls back to 16:9.
 * Height of `null` or preset='auto' means "compute from content".
 * `custom` preset reads layout.pageWidth / layout.pageHeight (clamped).
 */
export function resolvePageSize(appSpec) {
  const layout = appSpec?.layout || {}
  const lim    = PAGE_SIZE_LIMITS

  // Custom preset — explicit numeric width + height required
  if (layout.pagePreset === 'custom') {
    const w = clampDim(Number(layout.pageWidth),  lim.minWidth,  lim.maxWidth)  || 1280
    const h = clampDim(Number(layout.pageHeight), lim.minHeight, lim.maxHeight) || 720
    return { width: w, height: h, preset: 'custom' }
  }
  // Explicit numeric override without preset name
  if (typeof layout.pageWidth === 'number' && typeof layout.pageHeight === 'number') {
    return {
      width:  clampDim(layout.pageWidth,  lim.minWidth,  lim.maxWidth)  || DEFAULT_PAGE_SIZE.width,
      height: clampDim(layout.pageHeight, lim.minHeight, lim.maxHeight) || DEFAULT_PAGE_SIZE.height,
      preset: layout.pagePreset || null,
    }
  }
  // Preset name
  if (typeof layout.pagePreset === 'string' && PAGE_SIZE_PRESETS[layout.pagePreset]) {
    const p = PAGE_SIZE_PRESETS[layout.pagePreset]
    return { width: p.width, height: p.height, preset: layout.pagePreset }
  }
  // Fallback
  return { width: DEFAULT_PAGE_SIZE.width, height: DEFAULT_PAGE_SIZE.height, preset: '16:9' }
}

/**
 * Compute the pixel bounding box of all visuals: the y-coordinate just
 * below the lowest visual. Used for auto-fit page height.
 */
export function computeContentBottom(pagedVisuals) {
  if (!pagedVisuals.length) return 0
  return Math.max(...pagedVisuals.map((v) => (v.y || 0) + (v.height || 0)))
}

/**
 * Convert AppSpec.visuals[*] layout into Power BI-canvas pixel coords.
 *
 * The **column width** is derived from the effective page width so content
 * actually fills the published canvas. For the default 16:9 (1280×720):
 *   • 12 cols × ~100px = 1200px (leaves ~40px chrome margin each side)
 *
 * Grid mapping:
 *   • colWidth = (pageWidth - 40) / 12
 *   • rowHeight 80px from AppSpec (sanitizer enforces)
 *   • gap 8px between rows
 *
 * Returns pages[] with metadata: { id, name, width, height, visuals: [...] }
 * where width/height are page pixel dimensions for both the PBI page.json
 * and the AppSpecRenderer canvas sizing.
 */
function mapSinglePage(appSpec, rawVisuals, rawSlicers, pageMeta, pageIdPrefix = '') {
  const layout    = appSpec.layout || {}
  const rowHeight = Number(layout.rowHeight) || 80
  const gap       = Number(layout.gap)       || 8

  const page = resolvePageSize(appSpec)
  const chromePad = 40
  const effectiveWidth = page.width || DEFAULT_PAGE_SIZE.width
  const contentWidth = Math.max(effectiveWidth - chromePad, 400)
  const pad = chromePad / 2

  const COLS = 12
  const colW = (contentWidth - gap * (COLS - 1)) / COLS

  const gridToPx = (gx, gy, gw, gh) => ({
    leftPx:   gx * (colW + gap),
    topPx:    gy * (rowHeight + gap),
    widthPx:  gw * colW + Math.max(gw - 1, 0) * gap,
    heightPx: gh * rowHeight + Math.max(gh - 1, 0) * gap,
  })

  const visuals = Array.isArray(rawVisuals) ? rawVisuals : []
  const slicers = Array.isArray(rawSlicers) ? rawSlicers : []

  const pageVisuals = []
  for (const v of visuals) {
    // Skip nav_button + canvas objects (text/shape/image/divider) — non-data elements
    // that don't render in PBI yet. Excluding them keeps the publish clean (no empty
    // entries); full PBI object rendering (baked HTML) is a follow-up.
    if (v.type === 'nav_button' || OBJECT_TYPES.has(v.type)) continue
    const gx = Number(v.position?.x) || 0
    const gy = Number(v.position?.y) || 0
    const gw = Number(v.position?.w) || 3
    const gh = Number(v.position?.h) || 2
    const { leftPx, topPx, widthPx, heightPx } = gridToPx(gx, gy, gw, gh)

    let dimension = null
    let dimensions = []
    // Bar race (interaction · playback): bind [time frame, racing category] to
    // category1..2 so the .pbiviz gets 2-dim data to build frames + animate.
    // category[0] = play axis (time), category[1] = the racing category (groupBy).
    const raceTimeRaw = v.config?.playAxis || v.data?.frameBy
    const raceTimeRef = typeof raceTimeRaw === 'string'
      ? raceTimeRaw
      : (raceTimeRaw?.table && raceTimeRaw?.column ? `${raceTimeRaw.table}[${raceTimeRaw.column}]` : null)
    // Click-to-drill (interaction-plays): bind the WHOLE hierarchy to category1..N
    // so the .pbiviz has the finest-grain data to re-aggregate client-side on click.
    // Guarded — only when ≥2 valid levels; otherwise the binding is unchanged.
    const drillRefs = Array.isArray(v.data?.drill)
      ? v.data.drill.filter(d => d?.table && d?.column).map(d => `${d.table}[${d.column}]`)
      : []
    if (v.type === 'bar_race' && raceTimeRef && v.data?.groupBy?.table && v.data?.groupBy?.column) {
      const catRef = `${v.data.groupBy.table}[${v.data.groupBy.column}]`
      dimensions = [raceTimeRef, catRef]
      dimension = raceTimeRef
    } else if (drillRefs.length >= 2) {
      dimensions = drillRefs
      dimension = drillRefs[0]
    } else if (v.data?.groupBy?.table && v.data?.groupBy?.column) {
      dimension = `${v.data.groupBy.table}[${v.data.groupBy.column}]`
      dimensions = [dimension]
    } else if (v.type === 'table' && Array.isArray(v.data?.dimensions) && v.data.dimensions.length > 0) {
      dimensions = v.data.dimensions
        .filter(d => d?.table && d?.column)
        .map(d => `${d.table}[${d.column}]`)
      dimension = dimensions[0] || null
    }
    pageVisuals.push({
      // Prefix with page ID so cross-page visuals with identical LLM-generated IDs
      // (e.g. both page 1 and page 2 having "visual_1") get distinct TMDL measure names.
      id:        pageIdPrefix ? `${pageIdPrefix}_${v.id}` : v.id,
      type:      v.type,
      measures:  Array.isArray(v.data?.measures) ? v.data.measures : [],
      dimension,
      dimensions,
      // Carry the drill hierarchy through the mapping so buildPrimitiveSpec can
      // emit it (the mapped visual has no `data` block). Guarded to ≥2 levels.
      drill:     drillRefs.length >= 2 ? v.data.drill.filter(d => d?.table && d?.column).map(d => ({ table: d.table, column: d.column })) : null,
      x:      Math.round(pad + leftPx),
      y:      Math.round(pad + topPx),
      width:  Math.round(widthPx),
      height: Math.round(heightPx),
      limit:   v.data?.limit,
      orderBy: v.data?.orderBy,
      config:  v.config || {},
      title:   v.config?.title || v.config?.label || null,
    })
  }

  // Map slicers to native PBI slicer visuals (bind to column, not a measure).
  const pageSlicers = []
  for (const s of slicers) {
    if (!s.dimension?.table || !s.dimension?.column) continue
    const gx = Number(s.position?.x) || 0
    const gy = Number(s.position?.y) || 0
    const gw = Number(s.position?.w) || 4
    const { leftPx, topPx, widthPx } = gridToPx(gx, gy, gw, 1)
    pageSlicers.push({
      id:     s.id,
      type:   s.type || 'dropdown',
      table:  s.dimension.table,
      column: s.dimension.column,
      x:      Math.round(pad + leftPx),
      y:      Math.round(pad + topPx),
      width:  Math.round(widthPx),
      height: rowHeight,
      title:  s.config?.title || s.label || s.dimension.column,
    })
  }

  const contentBottom = computeContentBottom(pageVisuals)
  // Honor the chosen page height exactly (parity with the canvas page size); only the
  // 'auto' preset (or an unset height) grows to fit content. Previously max()'d the two,
  // so a fixed-height page silently grew past the size the user picked.
  const isAutoHeight  = page.preset === 'auto' || page.height == null
  const pageHeight    = isAutoHeight
    ? Math.max(contentBottom + chromePad, 320)
    : page.height

  return {
    id:      pageMeta?.id   || 'page_1',
    name:    pageMeta?.name || appSpec.title || 'Page 1',
    width:   page.width || DEFAULT_PAGE_SIZE.width,
    height:  pageHeight,
    preset:  page.preset,
    visuals: pageVisuals,
    slicers: pageSlicers,
  }
}

export function mapAppSpecToPages(appSpec) {
  if (!appSpec || typeof appSpec !== 'object') {
    throw new Error('mapAppSpecToPages: appSpec is required')
  }
  // Multi-page spec: map each page independently
  if (Array.isArray(appSpec.pages) && appSpec.pages.length > 0) {
    return appSpec.pages.map((page, idx) =>
      mapSinglePage(appSpec, page.visuals, page.slicers, { id: page.id, name: page.name },
        // Prefix visual IDs per-page so same-named LLM visuals (e.g. "visual_1" on
        // multiple pages) get distinct TMDL measure names in PBI publish.
        idx > 0 ? `pg${idx}` : '')
    )
  }
  // Single-page (flat) backward compat
  return [mapSinglePage(appSpec, appSpec.visuals, appSpec.slicers, null, '')]
}

/**
 * Filter out visuals that have no measures — those won't render in PBI.
 * Returns a new pages array with only renderable visuals.
 */
export function filterRenderablePages(pages) {
  return (pages || []).map((p) => ({
    ...p,
    visuals: (p.visuals || []).filter((v) => Array.isArray(v.measures) && v.measures.length > 0),
  }))
}
