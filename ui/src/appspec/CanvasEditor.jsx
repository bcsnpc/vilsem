import { chartTitleStyle } from './shared/chartTitle.js'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { VISUAL_MAP, getCardChromeStyle } from './AppSpecRenderer.jsx'
import { getThemeTokens } from './getThemeTokens.ts'
import { isObjectType, isBareVisual } from './schema.js'
import AxisSwitchPills, { getEffectiveGroupBy } from './AxisSwitchPills.jsx'
import { normaliseRows, normaliseTableRows, resolveRowKey, getScalarValue } from '@vilsem/core/dax/rows'
import { setPreview } from '../vilsem/dataPreviewStore.js'
import { buildTablePreviewDax, buildScalarPreviewDax } from '@vilsem/core/dax/preview'
import { drillHierarchy, drillStyleOf, expandLevels, shapeExpandInPlace, resolveDrillQuery, pushDrill, popDrillTo } from './shared/drill.js'
import DrillChrome from './shared/DrillChrome.jsx'
import VisualBoundary from './shared/VisualBoundary.jsx'

// ── Grid constants ───────────────────────────────────────────────────────────
const COLS = 12
const ROW_H = 80
const GAP = 8

// Same set CompactKpi uses — any of these types render using the KPI chrome
const KPI_TYPES = new Set(['kpi', 'stat_card', 'metric_tile', 'sparkline_kpi', 'bullet', 'progress', 'gauge'])

// Convert grid position to pixel position
function gridToPx(pos, containerW) {
  const colW = (containerW - GAP * (COLS - 1)) / COLS
  return {
    left:   pos.x * (colW + GAP),
    top:    pos.y * (ROW_H + GAP),
    width:  pos.w * colW + (pos.w - 1) * GAP,
    height: pos.h * ROW_H + (pos.h - 1) * GAP,
  }
}

// Convert pixel position back to grid (fractional — allows pixel-perfect positioning)
function pxToGrid(px, containerW) {
  const colW = (containerW - GAP * (COLS - 1)) / COLS
  const step = colW + GAP
  // Round to 1 decimal = ~10px precision in a 12-col 1200px canvas
  const round = (n) => Math.round(n * 10) / 10
  const w = Math.max(1, Math.min(COLS, round((px.width + GAP) / step)))
  return {
    x: Math.max(0, Math.min(COLS - w, round(px.left / step))),
    y: Math.max(0, round(px.top / (ROW_H + GAP))),
    w,
    h: Math.max(1, round((px.height + GAP) / (ROW_H + GAP))),
  }
}

// ── Color palette ────────────────────────────────────────────────────────────
const COLORS = {
  teal:'#14B8A6', blue:'#3B82F6', gold:'#F59E0B', green:'#22C55E',
  purple:'#A855F7', violet:'#8B5CF6', rose:'#F43F5E', red:'#EF4444',
  orange:'#F97316', amber:'#F59E0B',
}
function getColor(scheme) { return COLORS[scheme] || '#14B8A6' }

function fmtVal(v) {
  if (v == null) return '—'
  if (Math.abs(v) >= 1e9)       return (v / 1e9).toFixed(1) + 'B'
  if (Math.abs(v) >= 1e6)       return (v / 1e6).toFixed(1) + 'M'
  if (Math.abs(v) >= 1e3)       return (v / 1e3).toFixed(1) + 'k'
  if (Number.isInteger(v))      return v.toLocaleString()
  return parseFloat(v.toFixed(2)).toLocaleString()
}

function hexToRgb(hex) {
  const h = (hex || '').replace('#', '').padEnd(6, '0')
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) || 0)
}

// Card chrome — visually distinct card styles
function getCardChrome(style, colorVal, isDark, bgOpacity) {
  const [cr, cg, cb] = hexToRgb(colorVal)
  const bo = bgOpacity
  const defaultBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const defaultShadow = isDark ? '0 4px 16px rgba(0,0,0,0.25)' : '0 2px 8px rgba(0,0,0,0.06)'

  switch (style) {
    case 'filled':
      return {
        background: `linear-gradient(135deg, rgba(${cr},${cg},${cb},${bo ?? 1}) 0%, rgba(${cr},${cg},${cb},${bo ?? 0.65}) 100%)`,
        border: `1px solid ${colorVal}`,
        borderTop: `2px solid ${colorVal}`,
        boxShadow: `0 8px 24px rgba(${cr},${cg},${cb},0.3)`,
      }
    case 'glass':
      return {
        background: `rgba(${cr},${cg},${cb},${bo ?? 0.08})`,
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid rgba(${cr},${cg},${cb},0.2)`,
        boxShadow: `0 8px 32px rgba(${cr},${cg},${cb},0.1), inset 0 1px 0 rgba(255,255,255,0.05)`,
      }
    case 'glossy':
      return {
        background: `linear-gradient(145deg, rgba(${cr},${cg},${cb},${bo ?? 0.25}) 0%, rgba(${cr},${cg},${cb},${bo ?? 0.08}) 45%, rgba(${cr},${cg},${cb},${bo ?? 0.2}) 100%)`,
        border: `1px solid rgba(${cr},${cg},${cb},0.35)`,
        boxShadow: `0 10px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.1)`,
      }
    case 'accent':
      return {
        background: isDark ? 'linear-gradient(180deg, rgba(20,20,34,0.98) 0%, rgba(11,11,20,0.99) 100%)' : 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
        border: `1px solid ${defaultBorder}`,
        borderLeft: `4px solid ${colorVal}`,
        boxShadow: defaultShadow,
      }
    case 'bordered':
      return {
        background: 'transparent',
        border: `2px solid rgba(${cr},${cg},${cb},0.5)`,
      }
    case 'minimal':
      return {
        background: 'transparent',
        border: `1px solid ${defaultBorder}`,
      }
    default: // default tinted gradient
      return {
        background: isDark
          ? `linear-gradient(150deg, rgba(${cr},${cg},${cb},0.1) 0%, rgba(10,10,18,0.96) 55%)`
          : `linear-gradient(150deg, rgba(${cr},${cg},${cb},0.04) 0%, #FFFFFF 55%)`,
        border: `1px solid ${defaultBorder}`,
        borderTop: `2px solid ${colorVal}40`,
        boxShadow: defaultShadow,
      }
  }
}

// ── Canvas Editor ────────────────────────────────────────────────────────────

export default function CanvasEditor({
  spec,
  onSpecChange,
  onBindField,
  onCreateFromField,
  onConfigChange,      // (id, patch) → merge patch into a visual's config (in-place edits)
  selectedId,
  onSelect,
  theme = 'dark',
  zoom = 1,
}) {
  const containerRef = useRef(null)
  const [containerW, setContainerW] = useState(900)
  const [editingId, setEditingId] = useState(null)   // object being in-place edited (drag suspended)
  const [dragState, setDragState] = useState(null) // { id, type:'move'|'resize', startMouse, startPx }
  const [liveOffset, setLiveOffset] = useState(null) // { id, left, top, width, height } during drag
  const [visualData, setVisualData] = useState({})
  const [visualErrors, setVisualErrors] = useState({})
  const [dropTargetId, setDropTargetId] = useState(null) // visual highlighted during a field drag-over
  // Click-to-drill in the edit canvas (same behaviour as view/present). Per-visual
  // stack of clicked values; expand-in-place splits a bar into its children.
  const [drillPaths, setDrillPaths] = useState({})
  const [panelState, setPanelState] = useState({}) // detail-panel drill (pattern 01)

  const loadPanelData = useCallback(async (item, value) => {
    const lv = expandLevels(item)
    if (!lv || !window.semantica?.queryTable) return
    setPanelState(prev => ({ ...prev, [item.id]: { value, rows: [], loading: true } }))
    try {
      const measures = item.data.measures
      const filters = {}
      for (const f of (item.data.filters || [])) {
        if (f?.table && f?.column && f?.value != null) filters[`${f.table}[${f.column}]`] = f.value
      }
      filters[lv.parent.ref] = value
      const res = await window.semantica.queryTable({ groupBy: [lv.child.ref], measures, filters, limit: Math.max(item.data.limit || 0, 50), orderBy: 'desc' })
      const key = resolveRowKey(res?.rows, lv.child.ref)
      const rows = normaliseRows(res?.rows, key, measures)
      setPanelState(prev => (prev[item.id]?.value === value ? { ...prev, [item.id]: { value, rows, loading: false } } : prev))
    } catch {
      setPanelState(prev => (prev[item.id]?.value === value ? { ...prev, [item.id]: { value, rows: [], loading: false } } : prev))
    }
  }, [])

  const closePanel = useCallback((visualId) => {
    setPanelState(prev => { if (!(visualId in prev)) return prev; const n = { ...prev }; delete n[visualId]; return n })
  }, [])

  const handleBarClick = useCallback((item, cat) => {
    const levels = drillHierarchy(item)
    const style = drillStyleOf(item)
    if (!levels || style === 'off' || cat == null) return
    if (style === 'panel') {
      if (panelState[item.id]?.value === String(cat)) closePanel(item.id)
      else loadPanelData(item, String(cat))
      return
    }
    if (style === 'expand') {
      setDrillPaths(prev => {
        const cur = prev[item.id] || []
        if (cur.length > 0) return prev
        return { ...prev, [item.id]: [String(cat)] }
      })
      return
    }
    setDrillPaths(prev => {
      const cur = prev[item.id] || []
      const next = pushDrill(cur, cat, levels)
      return next === cur ? prev : { ...prev, [item.id]: next }
    })
  }, [panelState, loadPanelData, closePanel])

  const handleDrillTo = useCallback((visualId, depth) => {
    setDrillPaths(prev => {
      const cur = prev[visualId] || []
      const next = popDrillTo(cur, depth)
      return next === cur ? prev : { ...prev, [visualId]: next }
    })
  }, [])

  const expandConfigFor = useCallback((item) => {
    if (drillStyleOf(item) !== 'expand') return null
    const ev = (drillPaths[item.id] || [])[0]
    const lv = expandLevels(item)
    return { expandedValue: ev == null ? null : String(ev), childLabel: lv?.child?.label || '' }
  }, [drillPaths])
  // Per-visual axis override from axis-switch pill clicks. { [visualId]: { table, column } }
  const [axisOverrides, setAxisOverrides] = useState({})
  // Tracks last fetched axis per visual to avoid refetching when unchanged.
  const fetchedAxisRef = useRef({})

  // Load live data for each visual
  useEffect(() => {
    if (!spec?.visuals) return
    let cancelled = false
    const load = async () => {
      for (const v of spec.visuals) {
        const dimensionOnlyTable = v.type === 'table' && (v.data?.dimensions?.length || v.data?.groupBy?.column)
        if (!v.data?.measures?.length && !dimensionOnlyTable) {
          // Measures removed → clear stale value + reset the fetch guard so re-adding
          // a measure refetches (instead of showing the previous measure's data).
          setVisualData(d => (Array.isArray(d[v.id]) && d[v.id].length === 0 ? d : { ...d, [v.id]: [] }))
          setVisualErrors(e => e[v.id] ? { ...e, [v.id]: null } : e)
          fetchedAxisRef.current[v.id] = ''
          continue
        }
        const override = axisOverrides[v.id]
        // Drill state: expand-in-place uses a 2-dim query; replace deepens the
        // groupBy + adds ancestor filters. Both re-fetch via the drill-tagged key.
        const dLevels = drillHierarchy(v)
        const dStyle = dLevels ? drillStyleOf(v) : null
        const dPath = drillPaths[v.id] || []
        const expandedValue = (dStyle === 'expand' && dPath.length > 0) ? String(dPath[0]) : null
        const replaceQ = (dStyle === 'replace') ? resolveDrillQuery(v, dPath) : null
        let effectiveGroupBy = (override?.table && override?.column) ? override : v.data.groupBy
        if (replaceQ) effectiveGroupBy = replaceQ.groupBy
        const drillTag = expandedValue ? `exp:${expandedValue}` : (replaceQ && dPath.length ? `rep:${dPath.join('>')}` : '')
        // Bar race also re-fetches when its play axis (time dimension) changes, not
        // just its groupBy — otherwise editing the play axis wouldn't reload.
        const playTag = v.type === 'bar_race'
          ? `|play:${v.config?.playAxis || (v.data?.frameBy?.table ? `${v.data.frameBy.table}[${v.data.frameBy.column}]` : '')}`
          : ''
        // Include orderBy + limit so changing the Query panel (Order / Row limit) busts
        // the dedup and actually re-queries — otherwise the bars keep their old order/count.
        const axisKey = JSON.stringify([v.type, v.data, effectiveGroupBy, drillTag, playTag])
        if (fetchedAxisRef.current[v.id] === axisKey) continue // all query inputs unchanged
        setVisualErrors(e => e[v.id] ? { ...e, [v.id]: null } : e)
        const measures = v.data.measures || []
        const groupBy = effectiveGroupBy
        // Build filters object the same way AppSpecRenderer does — spec stores
        // filters as an array of {table, column, value}; backend expects a keyed object
        const filters = {}
        for (const f of (v.data.filters || [])) {
          if (f?.table && f?.column && f?.value != null) {
            filters[`${f.table}[${f.column}]`] = f.value
          }
        }
        // Replace-style drill: filter by every ancestor value the user drilled into.
        if (replaceQ) Object.assign(filters, replaceQ.ancestorFilters)
        try {
          // Expand-in-place (drill): 2-dim query shaped to mixed grain. Same as
          // AppSpecRenderer so normal (edit) and present modes drill identically.
          if (expandedValue) {
            const lv = expandLevels(v)
            const groupByRefs = [lv.parent.ref, lv.child.ref]
            const limit = Math.max(v.data.limit || 0, 200)
            const res = await window.semantica?.queryTable?.({ groupBy: groupByRefs, measures, filters, limit, orderBy: 'desc' })
            if (cancelled) return
            if (res?.error) throw new Error(res.message || res.error)
            const rows2 = normaliseTableRows(res?.rows, groupByRefs, measures)
            setVisualData(d => ({ ...d, [v.id]: shapeExpandInPlace(rows2, expandedValue) }))
            fetchedAxisRef.current[v.id] = axisKey
            continue
          }
          // Bar race (interaction · playback): 2-dim query (time frame × racing
          // category); the component pivots the rows into frames. Mirrors the
          // AppSpecRenderer bar_race branch so edit mode matches view/present/export.
          if (v.type === 'bar_race') {
            const playRaw = v.config?.playAxis || v.data?.frameBy
            const frameRef = typeof playRaw === 'string'
              ? playRaw
              : (playRaw?.table && playRaw?.column ? `${playRaw.table}[${playRaw.column}]` : null)
            if (groupBy?.table && groupBy?.column && frameRef) {
              const categoryRef = `${groupBy.table}[${groupBy.column}]`
              const groupByRefs = [frameRef, categoryRef]
              const limit = Math.max(v.data.limit || 0, 2000)
              const t0 = Date.now()
              const res = await window.semantica?.queryTable?.({ groupBy: groupByRefs, measures, filters, limit, orderBy: 'desc' })
              if (cancelled) return
            if (res?.error) throw new Error(res.message || res.error)
              const elapsedMs = Date.now() - t0
              const rows = normaliseTableRows(res?.rows, groupByRefs, measures)
              setVisualData(d => ({ ...d, [v.id]: rows }))
              setPreview(v.id, { type: v.type, title: v.config?.title || v.type, measures, dimensions: null, groupBy: effectiveGroupBy, filters, limit, orderBy: 'desc', dax: buildTablePreviewDax(groupByRefs, measures, filters, limit, 'desc'), rows, rowCount: res?.total ?? rows.length, elapsedMs, error: res?.error ? (res.message || res.error) : null })
            } else {
              // Missing racing category or play axis → clear so the component hints.
              setVisualData(d => ({ ...d, [v.id]: [] }))
            }
            fetchedAxisRef.current[v.id] = axisKey
            continue
          }
          // Multi-dim path: any visual with dimensions[] (tables, and Playground-
          // Spike custom visuals with 2 dimensions). Compat: a table promotes its
          // groupBy → dimensions[0].
          const tableDims = (Array.isArray(v.data.dimensions) && v.data.dimensions.length > 0)
            ? v.data.dimensions
            : (v.type === 'table' && v.data.groupBy?.table && v.data.groupBy?.column ? [v.data.groupBy] : null)
          if (tableDims) {
            const groupByRefs = tableDims.map(d => `${d.table}[${d.column}]`)
            const limit = v.data.limit || 100
            const orderBy = typeof v.data.orderBy === 'string' ? v.data.orderBy : 'desc'
            const t0 = Date.now()
            const res = await window.semantica?.queryTable?.({ groupBy: groupByRefs, measures, filters, limit, orderBy })
            if (cancelled) return
            if (res?.error) throw new Error(res.message || res.error)
            const elapsedMs = Date.now() - t0
            const rows = normaliseTableRows(res?.rows, groupByRefs, measures)
            setVisualData(d => ({ ...d, [v.id]: rows }))
            setPreview(v.id, { type: v.type, title: v.config?.title || v.type, measures, dimensions: tableDims, groupBy: null, filters, limit, orderBy, dax: buildTablePreviewDax(groupByRefs, measures, filters, limit, orderBy), rows, rowCount: res?.total ?? rows.length, elapsedMs, error: res?.error ? (res.message || res.error) : null })
            fetchedAxisRef.current[v.id] = axisKey
          } else if (!groupBy?.table || !groupBy?.column) {
            // Scalar KPI
            const t0 = Date.now()
            const res = await window.semantica?.query?.({ measures, filters })
            if (cancelled) return
            if (res?.error) throw new Error(res.message || res.error)
            const elapsedMs = Date.now() - t0
            const row = {
              _val:  getScalarValue(res, measures[0]),
              _val2: measures[1] ? getScalarValue(res, measures[1]) : null,
            }
            setVisualData(d => ({ ...d, [v.id]: [row] }))
            setPreview(v.id, { type: v.type, title: v.config?.title || v.type, measures, groupBy: null, dimensions: null, filters, dax: buildScalarPreviewDax(measures, filters), rows: [row], rowCount: 1, elapsedMs, error: res?.error ? (res.message || res.error) : null })
            fetchedAxisRef.current[v.id] = axisKey
          } else {
            const ref = `${groupBy.table}[${groupBy.column}]`
            // Line/area are time-series — force ascending date order and a generous
            // limit so the full series renders. Older specs with desc + limit:10
            // (top-N ranking semantics) used to produce sparse cherry-picked lines;
            // overriding here auto-corrects existing dashboards on the next render.
            const isLineLike = v.type === 'line' || v.type === 'area'
            const limit   = isLineLike ? Math.max(v.data.limit || 0, 2000) : (v.data.limit || 10)
            const orderBy = isLineLike ? 'asc' : ((typeof v.data.orderBy === 'string' ? v.data.orderBy : v.data?.orderBy?.dir) || 'desc')
            const t0 = Date.now()
            const res = await window.semantica?.queryTable?.({
              groupBy: [ref], measures, filters,
              limit, orderBy,
            })
            if (cancelled) return
            if (res?.error) throw new Error(res.message || res.error)
            const elapsedMs = Date.now() - t0
            const resolvedKey = resolveRowKey(res?.rows, ref)
            const rows = normaliseRows(res?.rows, resolvedKey, measures)
            setVisualData(d => ({ ...d, [v.id]: rows }))
            setPreview(v.id, { type: v.type, title: v.config?.title || v.type, measures, groupBy: effectiveGroupBy, dimensions: null, filters, limit, orderBy, dax: buildTablePreviewDax([ref], measures, filters, limit, orderBy), rows, rowCount: res?.total ?? rows.length, elapsedMs, error: res?.error ? (res.message || res.error) : null })
            fetchedAxisRef.current[v.id] = axisKey
          }
        } catch (error) {
          if (cancelled) return
          const message = error.message || 'Query failed'
          setVisualErrors(e => ({ ...e, [v.id]: message }))
          setVisualData(d => ({ ...d, [v.id]: [] }))
          setPreview(v.id, { type: v.type, title: v.config?.title || v.type, measures, filters, rows: [], rowCount: 0, error: message })
        }
      }
    }
    load()
    return () => { cancelled = true }
    // Full `v.data` hash so ANY data-shape change triggers refetch (measures,
    // groupBy, filters, limit, orderBy). Previously only id+measures were in
    // deps, so AI refines that changed groupBy/limit didn't hit the fetch loop
    // and the edit-mode canvas stayed stale.
    // playAxis lives in config (bar race), so include it or editing the play axis
    // wouldn't re-trigger the fetch (data is unchanged).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify((spec?.visuals || []).map(v => ({ id: v.id, type: v.type, data: v.data, playAxis: v.config?.playAxis || v.data?.frameBy || null }))), JSON.stringify(axisOverrides), JSON.stringify(drillPaths)])

  // Measure container
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect?.width
      if (w > 0) setContainerW(w)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // All items: slicers + visuals
  const allItems = useMemo(() => {
    const slicers = (spec?.slicers || []).map(s => ({ ...s, _kind: 'slicer' }))
    const visuals = (spec?.visuals || []).map(v => ({ ...v, _kind: 'visual' }))
    return [...slicers, ...visuals]
  }, [spec])

  // Total canvas height
  const canvasH = useMemo(() => {
    let maxBottom = 400
    for (const item of allItems) {
      const pos = item.position || { x: 0, y: 0, w: 4, h: 3 }
      const bottom = (pos.y + pos.h) * (ROW_H + GAP)
      if (bottom > maxBottom) maxBottom = bottom
    }
    return maxBottom + 120 // extra space at bottom
  }, [allItems])

  // ── Drag/resize handlers ─────────────────────────────────────────────────
  const handlePointerDown = useCallback((e, id, type) => {
    e.preventDefault()
    e.stopPropagation()
    const item = allItems.find(it => it.id === id)
    if (!item?.position) return
    const px = gridToPx(item.position, containerW)
    setDragState({ id, type, startMouse: { x: e.clientX, y: e.clientY }, startPx: px })
    setLiveOffset(null)
  }, [allItems, containerW])

  useEffect(() => {
    if (!dragState) return
    const onMove = (e) => {
      // Screen-pixel deltas → canvas-layout deltas: divide by the display zoom so a
      // scaled canvas still drags/resizes 1:1 with the cursor.
      const dx = (e.clientX - dragState.startMouse.x) / (zoom || 1)
      const dy = (e.clientY - dragState.startMouse.y) / (zoom || 1)
      if (dragState.type === 'move') {
        setLiveOffset({
          id: dragState.id,
          left: dragState.startPx.left + dx,
          top: Math.max(0, dragState.startPx.top + dy),
          width: dragState.startPx.width,
          height: dragState.startPx.height,
        })
      } else { // resize
        setLiveOffset({
          id: dragState.id,
          left: dragState.startPx.left,
          top: dragState.startPx.top,
          width: Math.max(60, dragState.startPx.width + dx),
          height: Math.max(40, dragState.startPx.height + dy),
        })
      }
    }
    const onUp = () => {
      if (liveOffset) {
        const gridPos = pxToGrid(liveOffset, containerW)
        // Clamp x+w to grid
        if (gridPos.x + gridPos.w > COLS) gridPos.w = COLS - gridPos.x
        onSpecChange(dragState.id, gridPos)
      }
      setDragState(null)
      setLiveOffset(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [dragState, liveOffset, containerW, onSpecChange, zoom])

  const isDark = theme === 'dark'

  // ── Grid background ────────────────────────────────────────────────────────
  const colW = (containerW - GAP * (COLS - 1)) / COLS

  return (
    <div ref={containerRef} style={{
      position: 'relative',
      width: '100%',
      height: canvasH,
      minHeight: '100%',
    }}
    onClick={(e) => { if (e.target === e.currentTarget) onSelect(null) }}
    onDragOver={onCreateFromField ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' } : undefined}
    onDrop={onCreateFromField ? (e) => {
      // Drop a model field on the empty canvas → create a new visual there.
      // (Drops on an existing visual stopPropagation, so they bind instead.)
      e.preventDefault()
      try {
        const f = JSON.parse(e.dataTransfer.getData('application/x-vilsem-field') || e.dataTransfer.getData('text/plain') || '{}')
        if (!f.kind) return
        const rect = containerRef.current?.getBoundingClientRect()
        // getBoundingClientRect is post-transform (scaled), so convert the drop point
        // back into canvas-layout coords by dividing the offset by zoom.
        const z = zoom || 1
        const px = { left: (e.clientX - (rect?.left || 0)) / z, top: (e.clientY - (rect?.top || 0)) / z, width: 4 * (colW + GAP), height: 3 * (ROW_H + GAP) }
        onCreateFromField(f, pxToGrid(px, containerW))
      } catch { /* ignore malformed drops */ }
    } : undefined}
    >
      {/* Grid column guides */}
      {Array.from({ length: COLS }, (_, i) => (
        <div key={`col-${i}`} style={{
          position: 'absolute',
          left: i * (colW + GAP),
          top: 0, bottom: 0,
          width: colW,
          background: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)',
          borderRadius: 4,
          pointerEvents: 'none',
        }} />
      ))}

      {/* Render each item */}
      {allItems.map(item => {
        const pos = item.position || { x: 0, y: 0, w: 4, h: 3 }
        const basePx = gridToPx(pos, containerW)
        const isLive = liveOffset?.id === item.id
        const px = isLive ? liveOffset : basePx
        const isSelected = selectedId === item.id
        const isDragging = dragState?.id === item.id
        const isSlicer = item._kind === 'slicer'
        const colorVal = getColor(item.config?.colorScheme)
        const isKpi = item.type === 'kpi'
        const isObject = isBareVisual(item.type)   // objects + nav button — bare render, full-surface handle

        return (
          <div
            key={item.id}
            style={{
              position: 'absolute',
              left: px.left,
              top: px.top,
              width: px.width,
              height: px.height,
              zIndex: isDragging ? 100 : (isSelected ? 10 : 1),
              transition: isDragging ? 'none' : 'left 0.15s, top 0.15s, width 0.15s, height 0.15s',
              opacity: isDragging ? 0.9 : 1,
              outline: dropTargetId === item.id ? '2px dashed #58AECB' : 'none',
              outlineOffset: 3,
            }}
            onClick={(e) => { e.stopPropagation(); onSelect(item.id) }}
            onDragOver={onBindField && !isSlicer ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; if (dropTargetId !== item.id) setDropTargetId(item.id) } : undefined}
            onDragLeave={onBindField ? () => setDropTargetId(t => (t === item.id ? null : t)) : undefined}
            onDrop={onBindField && !isSlicer ? (e) => {
              e.preventDefault(); e.stopPropagation(); setDropTargetId(null)
              try {
                const raw = e.dataTransfer.getData('application/x-vilsem-field') || e.dataTransfer.getData('text/plain') || '{}'
                const payload = JSON.parse(raw)
                if (payload && payload.kind) onBindField(item.id, payload)
              } catch { /* ignore malformed drops */ }
            } : undefined}
          >
            <div style={{
              width: '100%', height: '100%',
              // Canvas objects render bare (no data-card chrome); just a selection ring in
              // edit mode so they're still pickable.
              ...(isObject
                ? { outline: isSelected ? '2px solid #818CF8' : 'none', outlineOffset: 1, borderRadius: item.config?.borderRadius ?? 0 }
                : {
                    ...getCardChromeStyle({
                      config: item.config, colorVal,
                      T: getThemeTokens(isDark ? 'dark' : 'light'),
                      isKpi: KPI_TYPES.has(item.type),
                      isSelected,
                    }),
                    borderRadius: isSlicer ? 10 : (item.config?.borderRadius ?? 14),
                  }),
              overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              position: 'relative',
              cursor: isDragging ? 'grabbing' : 'pointer',
            }}>
              {/* Drag handle — KPI/slicer/object get a full-surface handle (no chart
                  header to grab). Chart drag is wired on the header div below. */}
              {(isKpi || isSlicer || isObject) && editingId !== item.id && (
                <div
                  onPointerDown={(e) => handlePointerDown(e, item.id, 'move')}
                  onDoubleClick={item.type === 'text_box' ? (e) => { e.stopPropagation(); onSelect(item.id); setEditingId(item.id) } : undefined}
                  title={item.type === 'text_box' ? 'Double-click to edit text' : undefined}
                  style={{
                    position: 'absolute', top: 0, left: 0, right: 0,
                    height: (isSlicer || isObject) ? '100%' : 28,
                    zIndex: 3, cursor: isDragging ? 'grabbing' : 'grab',
                  }}
                />
              )}

              {/* Left accent — honors config.showAccentStrip (default true).
                  zIndex 3 + pointerEvents none so it paints above the drag
                  handle overlay (also zIndex 3) that covers the top 28/36px. */}
              {!isSlicer && !isObject && item.config?.showAccentStrip !== false && !item.config?.flat && (
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                  borderRadius: '14px 0 0 14px',
                  background: `linear-gradient(180deg, ${colorVal}cc 0%, ${colorVal}22 100%)`,
                  zIndex: 3, pointerEvents: 'none',
                }} />
              )}

              {/* Content */}
              {isSlicer ? (
                // Static placeholder — no interactive components in edit mode to avoid
                // native date pickers and dropdown state fighting with the drag system.
                <div style={{ display: 'flex', alignItems: 'center', height: '100%', padding: '0 12px', gap: 8 }}>
                  {(item.config?.title || item.label) && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#94A3B8' : '#64748B', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {item.config?.title || item.label}
                    </span>
                  )}
                  {item.type === 'date_range' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                      <div style={{ flex: 1, padding: '4px 8px', borderRadius: 5, fontSize: 11, background: isDark ? '#1E293B' : '#F1F5F9', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0'}`, color: isDark ? '#475569' : '#94A3B8' }}>From</div>
                      <span style={{ color: isDark ? '#475569' : '#CBD5E1', fontSize: 11, flexShrink: 0 }}>–</span>
                      <div style={{ flex: 1, padding: '4px 8px', borderRadius: 5, fontSize: 11, background: isDark ? '#1E293B' : '#F1F5F9', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0'}`, color: isDark ? '#475569' : '#94A3B8' }}>To</div>
                    </div>
                  ) : item.type === 'buttons' ? (
                    <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                      {['All', 'Option A', 'Option B'].map(l => (
                        <div key={l} style={{ padding: '3px 9px', borderRadius: 4, fontSize: 10, border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#CBD5E1'}`, background: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC', color: isDark ? '#64748B' : '#94A3B8' }}>{l}</div>
                      ))}
                    </div>
                  ) : item.type === 'multi_select' ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 10px', borderRadius: 6, background: isDark ? '#1E293B' : '#F1F5F9', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0'}`, fontSize: 11, color: isDark ? '#64748B' : '#94A3B8' }}>
                      <span>All</span><span style={{ fontSize: 9 }}>▾</span>
                    </div>
                  ) : (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 10px', borderRadius: 6, background: isDark ? '#1E293B' : '#F1F5F9', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0'}`, fontSize: 11, color: isDark ? '#64748B' : '#94A3B8' }}>
                      <span>All</span><span style={{ fontSize: 9 }}>▾</span>
                    </div>
                  )}
                </div>
              ) : (() => {
                // Render the live visual component with real data
                const Component = VISUAL_MAP[item.type] || VISUAL_MAP.kpi
                const data = visualData[item.id]
                const activeAxis = axisOverrides[item.id] || null
                const effectiveGroupBy = getEffectiveGroupBy(item, axisOverrides)
                const hasAxisOpts = Array.isArray(item.config?.axisOptions) && item.config.axisOptions.filter(o => o?.groupBy?.table && o?.groupBy?.column).length >= 2
                const chartConfig = {
                  ...(item.config || {}),
                  // The editor already draws the shared header for these cards.
                  ...(['stat_card', 'metric_tile'].includes(item.type) ? { title: undefined, label: undefined } : {}),
                  measureName: item.data?.measures?.[0],
                  secondaryMeasureName: item.data?.measures?.[1] || null,
                  orderBy: typeof item.data?.orderBy === 'string' ? item.data.orderBy : 'desc',
                  // Playground Spike — custom visuals need their declarative template + theme.
                  _T: getThemeTokens(isDark ? 'dark' : 'light'),
                  _customTemplate: item.type === 'custom'
                    ? (spec?.customVisuals?.[item.customTemplateId] || item.customTemplate || null)
                    : undefined,
                  // Click-to-drill in the edit canvas (same contract as the view renderer).
                  _onBarClick: (cat) => handleBarClick(item, cat),
                  _expand: expandConfigFor(item),
                  _selectedCat: panelState[item.id]?.value ?? undefined,
                  // In-place editing (text box): CanvasEditor toggles editingId (double-
                  // click the handle); while editing the drag handle hides so the
                  // contentEditable is interactive. Live measure tokens react to filters.
                  _editable: isObjectType(item.type),
                  _editing: editingId === item.id,
                  _onConfigPatch: onConfigChange ? (patch) => onConfigChange(item.id, patch) : undefined,
                  _stopEditing: () => setEditingId(null),
                }
                if (isKpi) {
                  return (
                    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                      <VisualBoundary resetKey={data}>
                        <Component rows={data} config={chartConfig} loading={!data} error={visualErrors[item.id]} />
                      </VisualBoundary>
                    </div>
                  )
                }
                return (
                  <>
                    {((item.config?.showTitle !== false && (item.config?.title || item.config?.label)) || hasAxisOpts) && (
                      <div
                        onPointerDown={(e) => handlePointerDown(e, item.id, 'move')}
                        style={{ height: 36, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 14px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`, gap: 8, zIndex: 4, position: 'relative', cursor: isDragging ? 'grabbing' : 'grab' }}>
                        <span data-chart-title style={{ ...chartTitleStyle(item.config, isDark ? 'rgba(255,255,255,0.86)' : '#1E293B'), pointerEvents: 'none' }}>
                          {item.config?.title || item.config?.label || ''}
                        </span>
                        <div onPointerDown={(e) => e.stopPropagation()}>
                          <AxisSwitchPills
                            visual={item}
                            axisOverride={activeAxis}
                            onPick={(gb) => setAxisOverrides(prev => ({ ...prev, [item.id]: gb }))}
                            colorVal={colorVal}
                            mutedColor={isDark ? '#94A3B8' : '#64748B'}
                            borderColor={isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0'}
                            fontFamily={item.config?.titleFontFamily}
                            stopClickPropagation
                          />
                        </div>
                      </div>
                    )}
                    <div style={{ flex: 1, minHeight: 0, padding: '6px 12px 10px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      <VisualBoundary resetKey={data}>
                      <DrillChrome visual={item} path={drillPaths[item.id]} panel={panelState[item.id]}
                        onDrillTo={handleDrillTo} onPanelClose={() => closePanel(item.id)}
                        muted={isDark ? '#94A3B8' : '#64748B'} primary={isDark ? 'rgba(255,255,255,0.86)' : '#1E293B'}
                        border={isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0'} surface={isDark ? '#161A1F' : '#FFFFFF'} accent={colorVal}>
                        <Component rows={data} config={chartConfig} loading={!data} error={visualErrors[item.id]} groupBy={effectiveGroupBy} />
                      </DrillChrome>
                      </VisualBoundary>
                    </div>
                  </>
                )
              })()}

              {/* Resize handle — bottom-right corner */}
              <div
                onPointerDown={(e) => handlePointerDown(e, item.id, 'resize')}
                style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 16, height: 16, cursor: 'nwse-resize', zIndex: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="8" height="8" viewBox="0 0 8 8" style={{ opacity: isSelected ? 0.5 : 0.15 }}>
                  <path d="M7 1L1 7M7 4L4 7M7 7L7 7" stroke={isDark ? '#fff' : '#000'} strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
