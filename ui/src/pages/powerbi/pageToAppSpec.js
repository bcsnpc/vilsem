/**
 * pageToAppSpec — translate a Power BI Mode editor page into an AppSpec
 * that AppSpecRenderer can render with live Fabric data.
 *
 * The editor stores visuals with pixel coordinates (x: 40, y: 40, width: 420…)
 * which is incompatible with AppSpec's 12-column grid model. We use auto-layout
 * here: pixel coordinates are ignored and visuals are placed in row-major order
 * with sensible defaults per visual type. This matches AppGenerator's grid feel
 * and is good enough for live preview. Drag-resize editing comes in a follow-up
 * via AppSpecRenderer's GridLayout edit mode.
 *
 * Pure function — no React, no IPC. Safe to import anywhere.
 */

/**
 * @param {Object} page  — editor page from ReportEditor's `pages` state
 * @returns {Object}     — AppSpec consumed by AppSpecRenderer
 */
export function pageToAppSpec(page) {
  if (!page) return emptyAppSpec()

  const visuals = (page.visuals || [])
    .filter((v) => Array.isArray(v?.measures) && v.measures.length > 0)
    .map((v, idx) => editorVisualToAppSpecVisual(v, idx))

  return {
    version: '1.0',
    title:   page.name || page.displayName || 'Page',
    layout:  { columns: 12, rowHeight: 80, gap: 8 },
    visuals,
    slicers: [],
    connections: [],
    theme: { mode: 'dark' },
  }
}

function emptyAppSpec() {
  return {
    version: '1.0',
    title: 'Empty page',
    layout: { columns: 12, rowHeight: 80, gap: 8 },
    visuals: [],
    slicers: [],
    connections: [],
    theme: { mode: 'dark' },
  }
}

function editorVisualToAppSpecVisual(v, idx) {
  const dim = parseDimension(v.dimension)
  return {
    id:       v.id,
    type:     v.type,
    position: pixelsToGrid(v, idx),
    data: {
      measures: Array.isArray(v.measures) ? v.measures : [],
      groupBy:  dim ? { table: dim.table, column: dim.column } : null,
      // AppSpecRenderer expects filters as an ARRAY of {table, column, value}
      // entries that it iterates with for...of (see AppSpecRenderer.jsx:1174).
      // Editor visuals don't carry per-visual filters yet, so always emit [].
      filters:  Array.isArray(v.filters) ? v.filters : [],
      orderBy:  'desc',
      limit:    v.limit || 10,
    },
    config: {
      title:       v.title || prettyType(v.type),
      colorScheme: v.colorScheme || 'teal',
      dataLabels:  !!v.dataLabels,
      gridLines:   false,
    },
  }
}

/**
 * Auto-layout: place visuals in row-major order on the 12-column grid.
 * KPIs are 3×2 (4 per row), all other types are 6×4 (2 per row), with the
 * exception of `table` which gets the full 12 cols.
 */
function pixelsToGrid(v, idx) {
  if (v.type === 'kpi') {
    const w = 3, h = 2
    const perRow = 12 / w
    return { x: (idx % perRow) * w, y: Math.floor(idx / perRow) * h, w, h }
  }
  if (v.type === 'table') {
    return { x: 0, y: idx * 5, w: 12, h: 5 }
  }
  // Default chart layout: 6 cols × 4 rows, 2 per row
  const w = 6, h = 4
  const perRow = 12 / w
  return { x: (idx % perRow) * w, y: Math.floor(idx / perRow) * h, w, h }
}

function parseDimension(dim) {
  if (!dim || typeof dim !== 'string') return null
  const m = dim.match(/^(.+?)\[(.+)\]$/)
  if (!m) return null
  return { table: m[1], column: m[2] }
}

function prettyType(t) {
  if (!t) return ''
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
