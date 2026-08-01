// Pure, React-free helpers for editing an AppSpec — mirrors the proven logic in
// AppGenerator.jsx (editSpec, page management, add visual/slicer) so the PBI
// Injector can reuse the exact same authoring behaviour WITHOUT importing or
// modifying AppGenerator. AppGenerator may adopt this module later.

export const VISUAL_PALETTE = [
  { type: 'kpi',         label: 'KPI',          w: 3, h: 2 },
  { type: 'gauge',       label: 'Gauge',        w: 3, h: 2 },
  { type: 'bar',         label: 'Bar',          w: 6, h: 4 },
  { type: 'line',        label: 'Line',         w: 6, h: 4 },
  { type: 'area',        label: 'Area',         w: 6, h: 4 },
  { type: 'donut',       label: 'Donut',        w: 4, h: 4 },
  { type: 'scatter',     label: 'Scatter',      w: 6, h: 5 },
  { type: 'table',       label: 'Table',        w: 6, h: 4 },
  { type: 'waterfall',   label: 'Waterfall',    w: 6, h: 4 },
  { type: 'treemap',     label: 'Treemap',      w: 6, h: 4 },
  { type: 'grouped_bar', label: 'Grouped Bar',  w: 6, h: 4 },
  { type: 'stacked_bar', label: 'Stacked Bar',  w: 6, h: 4 },
  { type: 'stacked_area',label: 'Stacked Area', w: 6, h: 4 },
  { type: 'lollipop',    label: 'Lollipop',     w: 6, h: 4 },
  { type: 'radar',       label: 'Radar',        w: 5, h: 4 },
]

// ── Page accessors ──────────────────────────────────────────────────────────
export function getPages(spec) {
  if (!spec) return []
  if (Array.isArray(spec.pages) && spec.pages.length > 0) return spec.pages
  return [{ id: 'page_1', name: spec.title || 'Page 1', visuals: spec.visuals || [], slicers: spec.slicers || [] }]
}

export function getCurrentPage(spec, pageId) {
  const pages = getPages(spec)
  return pages.find(p => p.id === pageId) || pages[0] || null
}

export function ensurePages(spec) {
  if (!spec) return spec
  if (Array.isArray(spec.pages) && spec.pages.length > 0) return spec
  return { ...spec, pages: [{ id: 'page_1', name: spec.title || 'Page 1', visuals: spec.visuals || [], slicers: spec.slicers || [] }], visuals: undefined, slicers: undefined }
}

export function mergePageResult(fullSpec, pageId, resultSpec) {
  const pages = getPages(fullSpec).map(p =>
    p.id === pageId
      ? { ...p, visuals: resultSpec.visuals || [], slicers: resultSpec.slicers || [] }
      : p
  )
  return { ...fullSpec, pages, visuals: undefined, slicers: undefined, theme: resultSpec.theme || fullSpec.theme }
}

// Flat single-page view {...spec, visuals, slicers} — what CanvasEditor /
// VisualInspector / AppSpecRenderer consume. Memoize the result in React on
// [spec, pageId] so its identity is stable across renders (avoids re-query).
export function flatPageView(spec, pageId) {
  const p = getCurrentPage(spec, pageId)
  return p ? { ...spec, visuals: p.visuals || [], slicers: p.slicers || [] } : spec
}

// ── Page mutations (return new spec; never mutate input) ────────────────────
export function addPageToSpec(spec, { name } = {}) {
  const pages = getPages(spec)
  const newId = `page_${Date.now().toString(36)}`
  const newPage = { id: newId, name: name || `Page ${pages.length + 1}`, visuals: [], slicers: [] }
  return { spec: ensurePages({ ...spec, pages: [...pages, newPage] }), newPageId: newId }
}

export function deletePageFromSpec(spec, pageId) {
  const pages = getPages(spec).filter(p => p.id !== pageId)
  if (!pages.length) return { spec, removed: false }
  return { spec: { ...spec, pages, visuals: undefined, slicers: undefined }, removed: true }
}

export function renamePageInSpec(spec, pageId, newName) {
  if (!newName?.trim()) return spec
  const pages = getPages(spec).map(p => p.id === pageId ? { ...p, name: newName.trim() } : p)
  return { ...spec, pages, visuals: undefined, slicers: undefined }
}

// ── Visual / slicer mutations ───────────────────────────────────────────────
export function addVisualToSpec(spec, pageId, { type, w, h }) {
  const activeId = pageId || getPages(spec)[0]?.id
  const cur = getCurrentPage(spec, activeId)
  const nextY = (cur?.visuals || []).reduce((m, v) => Math.max(m, (v.position?.y ?? 0) + (v.position?.h ?? 0)), 0)
  const id = `v_${Date.now().toString(36)}`
  const newVisual = { id, type, position: { x: 0, y: nextY, w, h }, data: { measures: [], groupBy: null, orderBy: 'desc', limit: 10 }, config: { title: `New ${type}` } }
  const pages = getPages(spec).map(p =>
    p.id === activeId ? { ...p, visuals: [...(p.visuals || []), newVisual] } : p
  )
  return { spec: { ...spec, pages, visuals: undefined, slicers: undefined }, newVisualId: id }
}

export function addSlicerToSpec(spec, pageId, { table, column, dataType }) {
  const activeId = pageId || getPages(spec)[0]?.id
  const id = `s_${Date.now().toString(36)}`
  const isDate = dataType && (dataType.toLowerCase().includes('date') || dataType.toLowerCase().includes('datetime'))
  const DEFAULT_W = 4
  const pages = getPages(spec).map(p => {
    if (p.id !== activeId) return p
    const existingSlicers = p.slicers || []
    let newX = 0, newY = 0
    if (existingSlicers.length > 0) {
      const maxY = Math.max(...existingSlicers.map(s => s.position?.y ?? 0))
      const onLastRow = existingSlicers.filter(s => (s.position?.y ?? 0) === maxY)
      const rightEdge = Math.max(...onLastRow.map(s => (s.position?.x ?? 0) + (s.position?.w ?? DEFAULT_W)))
      if (rightEdge + DEFAULT_W <= 12) { newX = rightEdge; newY = maxY }
      else { newX = 0; newY = maxY + 1 }
    }
    const newSlicer = { id, type: isDate ? 'date_range' : 'dropdown', dimension: { table, column }, position: { x: newX, y: newY, w: DEFAULT_W, h: 1 }, config: { title: column } }
    const prevRows = existingSlicers.length === 0 ? 0 : Math.max(...existingSlicers.map(s => s.position?.y ?? 0)) + 1
    const rowsAdded = Math.max(0, (newY + 1) - prevRows)
    return {
      ...p,
      slicers: [...existingSlicers, newSlicer],
      visuals: rowsAdded > 0
        ? (p.visuals || []).map(v => ({ ...v, position: { ...v.position, y: (v.position?.y ?? 0) + rowsAdded } }))
        : (p.visuals || []),
    }
  })
  return { spec: { ...spec, pages, visuals: undefined, slicers: undefined }, newSlicerId: id }
}

// Build an editSpec(mutatorFn) bound to the active page — identical semantics to
// AppGenerator.jsx:849-865. mutatorFn receives a deep-cloned flat page view
// {visuals, slicers, ...} and mutates it in place.
export function makeEditSpec(spec, pageId, setSpec) {
  return function editSpec(mutateFn) {
    if (!spec) return
    const activeId = pageId || getPages(spec)[0]?.id
    const pages = getPages(spec).map(p => {
      if (p.id !== activeId) return p
      const flat = JSON.parse(JSON.stringify({ ...spec, visuals: p.visuals || [], slicers: p.slicers || [] }))
      mutateFn(flat)
      return { ...p, visuals: flat.visuals, slicers: flat.slicers }
    })
    setSpec({ ...spec, pages, visuals: undefined, slicers: undefined })
  }
}

// Flat list of slicer-eligible dimension columns (text/date, visible, non-key).
export function slicerColumnOptionsFrom(dimensions) {
  const opts = []
  for (const tbl of (dimensions || [])) {
    if (tbl.tableType === 'measure_group') continue
    for (const col of (tbl.columns || [])) {
      if (col.isHidden || col.isKey) continue
      const dt = (col.dataType || '').toLowerCase()
      if (dt === 'string' || dt.startsWith('str') || col.isCategory || col.isDate || dt.includes('date')) {
        const isDate = col.isDate || dt.includes('date') || dt.includes('datetime')
        opts.push({ table: tbl.name, column: col.name, dataType: col.dataType, isDate, label: `${tbl.name} › ${col.name}` })
      }
    }
  }
  return opts
}
