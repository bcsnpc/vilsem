import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import GridLayout from 'react-grid-layout'
import AxisSwitchPills, { getEffectiveGroupBy } from './AxisSwitchPills.jsx'
import getThemeTokens from './getThemeTokens'
import './shared/animations.css'
import { getColorValue } from './shared/palettes.js'
import { getCardChromeStyle } from './shared/chrome.js'
import { getCardAnimation, getHoverHandlers } from './shared/animation.js'
import { getSourceSelectedCat, buildAppliedFiltersForVisual } from './shared/filters.js'
import { normalizeLayout } from './shared/layout.js'
import { drillHierarchy, resolveDrillQuery, pushDrill, popDrillTo, drillStyleOf, expandLevels, shapeExpandInPlace } from './shared/drill.js'
import DrillChrome from './shared/DrillChrome.jsx'
import VisualBoundary from './shared/VisualBoundary.jsx'
import {
  getScalarValue, sortFilterValues, resolveMeasureKey, resolveRowKey,
  normaliseRows, normaliseTableRows,
} from './shared/row-normalize.js'
import CompactKpi from './visuals/CompactKpi.jsx'
import { VISUAL_MAP } from './visuals/index.js'
import { SlicerDropdown, SlicerButtons, SlicerDateRange, SlicerMultiSelect } from './slicers/index.js'

// Re-export public API for downstream importers (CanvasEditor.jsx,
// InspectorPanel.jsx). Phase 1 moved the symbols into their respective
// modules; this façade keeps the import paths stable.
export { getCardChromeStyle, VISUAL_MAP }

// ── Main renderer ─────────────────────────────────────────────────────────────

export default function AppSpecRenderer({ spec, availableMeasures, canvasWidth, theme = 'dark', editMode = false, selectedVisualId = null, onSelectVisual = null, onLayoutChange = null, onNavigatePage = null }) {
  const T = useMemo(() => getThemeTokens(theme), [theme])
  // Pass 1: normalize all visuals (filters no-measure visuals, places slicers/KPIs/charts)
  const preNormalizedSpec = useMemo(() => normalizeLayout(spec), [spec])
  const [visualData,    setVisualData]    = useState({})
  const [visualLoading, setVisualLoading] = useState({})
  const [visualErrors,  setVisualErrors]  = useState({})
  const [slicerValues,  setSlicerValues]  = useState({})
  const [globalFilters, setGlobalFilters] = useState({})
  // Tracks which visual set each filter (for click-to-filter). A filter is
  // applied to every OTHER visual but not the one that produced it, so a
  // clicked bar chart stays showing all categories while it highlights the
  // selected one.
  const [filterSources, setFilterSources] = useState({})
  const [axisOverrides, setAxisOverrides] = useState({})   // { [visualId]: { table, column } }
  // Click-to-drill — per-visual stack of clicked category values. At depth N the
  // visual groups by its drill hierarchy's level N and filters by the ancestors.
  const [drillPaths, setDrillPaths]     = useState({})     // { [visualId]: ['Bikes','Mountain Bikes'] }
  // Detail-panel drill (pattern 01) — separate from drillPaths so the main chart
  // stays at the base level while a side drawer shows the clicked value's children.
  const [panelState, setPanelState]     = useState({})     // { [visualId]: { value, rows, loading } }
  const [editLayout, setEditLayout]     = useState(null)   // RGL layout array for edit mode
  const editSpecIdRef = useRef(null)                      // tracks which spec initialized editLayout
  const requestEpochRef = useRef(0)
  const pendingFilterResetRef = useRef(false)
  // Fallback measure for slicer queryTable path.
  // Priority: (1) availableMeasures prop, (2) first measure found in the spec itself,
  // (3) empty string. This makes the fallback work even when the registry is empty.
  const fallbackMeasureName = useMemo(() => {
    const fromRegistry = availableMeasures?.[0]?.name
    if (fromRegistry) return fromRegistry
    for (const v of (preNormalizedSpec?.visuals || [])) {
      const m = v.data?.measures?.[0]
      if (m) return m
    }
    return ''
  }, [availableMeasures, preNormalizedSpec])

  // ── Load slicer distinct values ─────────────────────────────────────────
  const loadSlicerValues = useCallback(async (slicer, requestEpoch = requestEpochRef.current) => {
    const dim = slicer.dimension
    if (!dim?.table || !dim?.column) return
    if (slicer.type === 'date_range') return

    const groupByRef = `${dim.table}[${dim.column}]`
    let values = []
    let primaryFailed = false

    // Path A: getDistinctValues (preferred)
    if (window.semantica?.getDistinctValues) {
      try {
        const result = await window.semantica.getDistinctValues({ column: groupByRef, limit: 100 })
        if (result?.error) throw new Error(result.message || result.error)
        values = result?.values || []
      } catch (e) {
        console.warn('[AppSpec] getDistinctValues failed for', slicer.id, '—', e.message)
        primaryFailed = true
      }
    } else {
      primaryFailed = true
    }

    // Path B: queryTable fallback — used when primary threw OR returned nothing
    if ((primaryFailed || !values.length) && !fallbackMeasureName) {
      console.warn('[AppSpec] slicer fallback skipped — no fallback measure available for', slicer.id, groupByRef)
    }
    if ((primaryFailed || !values.length) && window.semantica?.queryTable && fallbackMeasureName) {
      try {
        const result = await window.semantica.queryTable({
          groupBy: [groupByRef],
          measures: [fallbackMeasureName],
          filters: {},
          limit: 100,
        })
        if (result?.error) throw new Error(result.message || result.error)
        values = (result?.rows || [])
          .map(r => r[groupByRef] ?? r[dim.column] ?? Object.values(r)[0])
      } catch (e) {
        console.warn('[AppSpec] queryTable fallback failed for', slicer.id, '—', e.message)
      }
    }

    if (requestEpochRef.current !== requestEpoch) return

    // Deduplicate, drop nulls/empties, then sort
    const seen = new Set()
    const unique = values.filter(v => {
      if (v == null || v === '') return false
      const k = String(v)
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })

    if (!unique.length) {
      console.warn('[AppSpec] No values found for slicer', slicer.id, groupByRef)
    }

    setSlicerValues(prev => ({ ...prev, [slicer.id]: sortFilterValues(unique) }))
  }, [fallbackMeasureName])

  // ── Load visual data ────────────────────────────────────────────────────
  const loadVisualData = useCallback(async (visual, currentFilters, requestEpoch = requestEpochRef.current, groupByOverride = null, drillCtx = null) => {
    if (!visual.data?.measures?.length) return
    if (!window.semantica) return

    setVisualLoading(prev => ({ ...prev, [visual.id]: true }))
    setVisualErrors(prev => ({ ...prev, [visual.id]: null }))

    try {
      const measures  = visual.data.measures
      // Axis-switch override takes priority over spec groupBy
      const specGroupBy = (visual.data.groupBy?.table && visual.data.groupBy?.column)
        ? visual.data.groupBy : null
      const groupBy = (groupByOverride?.table && groupByOverride?.column)
        ? groupByOverride : specGroupBy
      const specFilters = {}

      for (const f of (visual.data.filters || [])) {
        if (f?.table && f?.column && f?.value != null) {
          specFilters[`${f.table}[${f.column}]`] = f.value
        }
      }

      const mergedFilters = { ...specFilters, ...currentFilters }

      let result
      // Expand-in-place (drill): one 2-dim (parent,child) query, shaped to mixed
      // grain — the expanded parent becomes its children, siblings stay summed.
      // Same live query as the axis-switch/drill paths, just grouped by two levels.
      if (drillCtx?.style === 'expand' && drillCtx.parent && drillCtx.child) {
        const groupByRefs = [drillCtx.parent.ref, drillCtx.child.ref]
        const limit = Math.max(visual.data.limit || 0, 200)
        result = await window.semantica.queryTable({ groupBy: groupByRefs, measures, filters: mergedFilters, limit, orderBy: 'desc' })
        if (result?.error) throw new Error(result.message || result.error)
        const rows2 = normaliseTableRows(result?.rows, groupByRefs, measures)
        const shaped = shapeExpandInPlace(rows2, drillCtx.expandedValue)
        if (requestEpochRef.current !== requestEpoch) return
        setVisualData(prev => ({ ...prev, [visual.id]: shaped }))
        return
      }
      // Compat: table with old-style groupBy but no dimensions[] → promote to dimensions[0]
      const visualData = (visual.type === 'table' && !Array.isArray(visual.data?.dimensions) && visual.data?.groupBy?.table && visual.data?.groupBy?.column)
        ? { ...visual.data, dimensions: [visual.data.groupBy] }
        : visual.data
      // Table with explicit dimensions[] array — multi-dim path
      if (visual.type === 'table' && Array.isArray(visualData?.dimensions) && visualData.dimensions.length > 0) {
        const dims = visualData.dimensions
        const groupByRefs = dims.map(d => `${d.table}[${d.column}]`)
        const limit = visualData.limit || 100
        const orderBy = typeof visualData.orderBy === 'string' ? visualData.orderBy : 'desc'
        result = await window.semantica.queryTable({ groupBy: groupByRefs, measures, filters: mergedFilters, limit, orderBy })
        if (result?.error) throw new Error(result.message || result.error)
        const tableRows = normaliseTableRows(result?.rows, groupByRefs, measures)
        if (requestEpochRef.current !== requestEpoch) return
        setVisualData(prev => ({ ...prev, [visual.id]: tableRows }))
        return
      }
      // Bar race (interaction · playback) — a 2-dim query (time frame × category);
      // the component pivots the rows into frames and animates the rank changes.
      if (visual.type === 'bar_race') {
        const cat = groupBy
        const playRaw = visual.config?.playAxis || visual.data?.frameBy
        const frameRef = typeof playRaw === 'string'
          ? playRaw
          : (playRaw?.table && playRaw?.column ? `${playRaw.table}[${playRaw.column}]` : null)
        if (cat?.table && cat?.column && frameRef) {
          const categoryRef = `${cat.table}[${cat.column}]`
          result = await window.semantica.queryTable({ groupBy: [frameRef, categoryRef], measures, filters: mergedFilters, limit: Math.max(visual.data.limit || 0, 2000), orderBy: 'desc' })
          if (result?.error) throw new Error(result.message || result.error)
          const raceRows = normaliseTableRows(result?.rows, [frameRef, categoryRef], measures)
          if (requestEpochRef.current !== requestEpoch) return
          setVisualData(prev => ({ ...prev, [visual.id]: raceRows }))
        } else {
          // Missing category or play axis → clear so the component shows its hint.
          if (requestEpochRef.current !== requestEpoch) return
          setVisualData(prev => ({ ...prev, [visual.id]: [] }))
        }
        return
      }
      if (groupBy) {
        const groupByRef = `${groupBy.table}[${groupBy.column}]`
        // Line/area override — see matching comment in CanvasEditor.jsx for rationale.
        const isLineLike = visual.type === 'line' || visual.type === 'area'
        const limit   = isLineLike ? Math.max(visual.data.limit || 0, 2000) : (visual.data.limit || 10)
        const orderBy = isLineLike ? 'asc' : ((typeof visual.data.orderBy === 'string' ? visual.data.orderBy : visual.data?.orderBy?.dir) || 'desc')
        result = await window.semantica.queryTable({
          groupBy: [groupByRef],
          measures,
          filters: mergedFilters,
          limit,
          orderBy,
        })
        if (result?.error) throw new Error(result.message || result.error)
        const resolvedKey = resolveRowKey(result?.rows, groupByRef)
        const rows = normaliseRows(result?.rows, resolvedKey, measures)
        if (requestEpochRef.current !== requestEpoch) return
        setVisualData(prev => ({ ...prev, [visual.id]: rows }))
      } else {
        result = await window.semantica.query({ measures, filters: mergedFilters })
        if (result?.error) throw new Error(result.message || result.error)
        // Handle both { data: { 'Measure': 123 } } and { rows: [{ 'Measure': 123 }] }
        const val  = getScalarValue(result, measures[0])
        const val2 = measures[1] ? getScalarValue(result, measures[1]) : null
        if (requestEpochRef.current !== requestEpoch) return
        setVisualData(prev => ({ ...prev, [visual.id]: [{ _val: val, _val2: val2 }] }))
      }
    } catch (e) {
      if (requestEpochRef.current !== requestEpoch) return
      console.error(`[AppSpec ${visual.id}] error:`, e.message)
      setVisualErrors(prev => ({ ...prev, [visual.id]: e.message }))
      setVisualData(prev => ({ ...prev, [visual.id]: null }))
    } finally {
      if (requestEpochRef.current !== requestEpoch) return
      setVisualLoading(prev => ({ ...prev, [visual.id]: false }))
    }
  }, [])

  // ── Slicer change handler ───────────────────────────────────────────────
  const handleSlicerChange = useCallback((slicer, value) => {
    const dim = slicer.dimension
    if (!dim?.table || !dim?.column) return
    const filterKey = `${dim.table}[${dim.column}]`
    setGlobalFilters(prev => {
      const next = { ...prev }
      const isEmptyRange = typeof value === 'object' && value != null && !Array.isArray(value) &&
        !value.from && !value.to
      if (value == null || value === '' || value === 'All' || isEmptyRange) delete next[filterKey]
      else next[filterKey] = value
      return next
    })
  }, [])

  // Detail-panel drill (pattern 01): fetch the clicked value's children (one level
  // deeper, filtered to it) into a side drawer. The main chart stays at base level.
  const loadPanelData = useCallback(async (visual, value) => {
    const lv = expandLevels(visual)
    if (!lv || !window.semantica?.queryTable) return
    setPanelState(prev => ({ ...prev, [visual.id]: { value, rows: [], loading: true } }))
    try {
      const measures = visual.data.measures
      const specFilters = {}
      for (const f of (visual.data.filters || [])) {
        if (f?.table && f?.column && f?.value != null) specFilters[`${f.table}[${f.column}]`] = f.value
      }
      const applied = buildAppliedFiltersForVisual(preNormalizedSpec, visual, globalFilters, filterSources)
      const filters = { ...specFilters, ...applied, [lv.parent.ref]: value }
      const res = await window.semantica.queryTable({ groupBy: [lv.child.ref], measures, filters, limit: Math.max(visual.data.limit || 0, 50), orderBy: 'desc' })
      const key = resolveRowKey(res?.rows, lv.child.ref)
      const rows = normaliseRows(res?.rows, key, measures)
      setPanelState(prev => (prev[visual.id]?.value === value ? { ...prev, [visual.id]: { value, rows, loading: false } } : prev))
    } catch {
      setPanelState(prev => (prev[visual.id]?.value === value ? { ...prev, [visual.id]: { value, rows: [], loading: false } } : prev))
    }
  }, [preNormalizedSpec, globalFilters, filterSources])

  const closePanel = useCallback((visualId) => {
    setPanelState(prev => { if (!(visualId in prev)) return prev; const n = { ...prev }; delete n[visualId]; return n })
  }, [])

  // Bar / chart click-to-filter: sets a filter for the visual's groupBy
  // column → propagates through globalFilters → KPIs and other charts
  // re-evaluate. Clicking the same category again toggles the filter off.
  // Never affects slicers (one-way interaction per user requirement).
  const handleBarClick = useCallback((visual, categoryValue) => {
    // Click-to-drill takes priority over cross-filter: a visual with a declared
    // drill hierarchy drills on click rather than filtering its siblings. Only in
    // view/present — in edit mode a click selects.
    const levels = drillHierarchy(visual)
    const style = drillStyleOf(visual)
    if (!editMode && levels && style !== 'off') {
      if (style === 'panel') {
        // Detail panel: toggle the drawer for the clicked value; main chart unchanged.
        if (categoryValue == null) return
        if (panelState[visual.id]?.value === String(categoryValue)) closePanel(visual.id)
        else loadPanelData(visual, String(categoryValue))
        return
      }
      if (style === 'expand') {
        // Expand-in-place: click a collapsed sibling to split it into its children.
        // While already expanded, clicks are ignored (use the Collapse control).
        setDrillPaths(prev => {
          const cur = prev[visual.id] || []
          if (cur.length > 0) return prev
          if (categoryValue == null) return prev
          return { ...prev, [visual.id]: [String(categoryValue)] }
        })
        return
      }
      // 'replace' (and other level-deepening styles): push onto the path.
      setDrillPaths(prev => {
        const cur = prev[visual.id] || []
        const next = pushDrill(cur, categoryValue, levels)
        return next === cur ? prev : { ...prev, [visual.id]: next }
      })
      return
    }
    // Respect the axis-switch override so clicking a Country bar filters
    // by Country, not the visual's original Region groupBy.
    const override = axisOverrides[visual?.id]
    const gb = (override?.table && override?.column) ? override : visual?.data?.groupBy
    if (!gb?.table || !gb?.column || categoryValue == null) return
    const filterKey = `${gb.table}[${gb.column}]`
    setGlobalFilters(prev => {
      const next = { ...prev }
      if (next[filterKey] === categoryValue) delete next[filterKey]
      else next[filterKey] = categoryValue
      return next
    })
    setFilterSources(prev => {
      const next = { ...prev }
      if (globalFilters[filterKey] === categoryValue) delete next[filterKey]
      else next[filterKey] = visual.id
      return next
    })
  }, [globalFilters, axisOverrides, editMode, panelState, loadPanelData, closePanel])

  // Breadcrumb / Collapse — pop the drill path back to a shallower depth.
  const handleDrillTo = useCallback((visualId, depth) => {
    setDrillPaths(prev => {
      const cur = prev[visualId] || []
      const next = popDrillTo(cur, depth)
      return next === cur ? prev : { ...prev, [visualId]: next }
    })
  }, [])

  // Expand-in-place context for the bar. Present for EVERY expand-style visual
  // (even collapsed, expandedValue: null) so the bar uses the morphing builder in
  // both states and universalTransition animates the split/reassemble.
  const expandConfigFor = useCallback((v) => {
    if (drillStyleOf(v) !== 'expand') return null
    const ev = (drillPaths[v.id] || [])[0]
    const lv = expandLevels(v)
    return { expandedValue: ev == null ? null : String(ev), childLabel: lv?.child?.label || '' }
  }, [drillPaths])

  // Charts that finished loading with no chartable rows OR an error are hidden (AI over-generation)
  // "chartable" means at least one row has a non-null _val (mirrors what chart components check)
  const hiddenVisualIds = useMemo(() => new Set(
    (preNormalizedSpec?.visuals || []).filter(v => {
      const KPI_LIKE = new Set(['kpi','stat_card','metric_tile','sparkline_kpi','bullet','progress','gauge'])
      if (KPI_LIKE.has(v.type)) return false
      const loaded = !visualLoading[v.id] && v.id in visualData
      if (!loaded) return false
      if (visualErrors[v.id]) return true
      const rows = visualData[v.id] || []
      const hasChartableData = rows.some(r => r?._val != null)
      return !hasChartableData
    }).map(v => v.id)
  ), [preNormalizedSpec, visualLoading, visualData, visualErrors])

  // Pass 2: re-run normalizeLayout with hidden visuals removed so positions are gap-free
  const renderSpec = useMemo(() => {
    if (!preNormalizedSpec || hiddenVisualIds.size === 0) return preNormalizedSpec
    return normalizeLayout({
      ...preNormalizedSpec,
      visuals: (preNormalizedSpec.visuals || []).filter(v => !hiddenVisualIds.has(v.id))
    })
  }, [preNormalizedSpec, hiddenVisualIds])

  // ── Build stable edit layout from raw spec (edit mode only) ──────────────
  // Only rebuilds when the spec structure actually changes (new generation/load),
  // NOT when positions are updated by drag/resize (which only changes position values).
  const specStructureId = useMemo(() => {
    if (!spec?.visuals) return null
    const vIds = spec.visuals.map(v => v.id).sort().join(',')
    const sIds = (spec.slicers || []).map(s => s.id).sort().join(',')
    return `${spec.title}|${vIds}|${sIds}`
  }, [spec])

  useEffect(() => {
    if (!editMode || !spec?.visuals) { setEditLayout(null); return }
    // Skip rebuild if we already initialized for this spec structure
    if (editSpecIdRef.current === specStructureId && editLayout) return
    editSpecIdRef.current = specStructureId
    const cols = 12
    const slicers = (spec.slicers || []).filter(s => s.id)
    const KPI_EDIT_TYPES = new Set(['kpi','stat_card','metric_tile','sparkline_kpi','bullet','progress','gauge'])
    const kpis    = spec.visuals.filter(v => KPI_EDIT_TYPES.has(v.type) && v.id)
    const charts  = spec.visuals.filter(v => v.type !== 'kpi' && v.id)
    const items = []
    let y = 0

    // Slicers: single row each
    for (const s of slicers) {
      items.push({ i: s.id, x: s.position?.x ?? 0, y, w: Math.min(s.position?.w ?? 4, cols), h: 1, minW: 2, minH: 1, _kind: 'slicer' })
      y += 1
    }
    // Freeform: respect spec positions directly
    if (spec.layout?.freeform) {
      for (const v of [...kpis, ...charts]) {
        const pos = v.position || { x: 0, y: 0, w: 4, h: 2 }
        items.push({ i: v.id, x: Math.round(pos.x || 0), y: Math.round(pos.y || 0), w: Math.max(1, Math.round(pos.w || 4)), h: Math.max(1, Math.round(pos.h || 2)), minW: 1, minH: 1, _kind: 'visual' })
      }
    } else {
      // KPIs: respect AI widths if present and fit in 12 cols, otherwise distribute evenly
      if (kpis.length > 0) {
        const aiTotalW = kpis.reduce((s, k) => s + (k.position?.w || 3), 0)
        if (aiTotalW <= cols && kpis.every(k => k.position?.w)) {
          let kx = 0
          kpis.forEach(v => {
            const w = Math.min(v.position.w, cols - kx)
            items.push({ i: v.id, x: kx, y, w, h: v.position?.h || 2, minW: 1, minH: 1, _kind: 'visual' })
            kx += w
          })
        } else {
          const kpiW = Math.floor(cols / kpis.length)
          kpis.forEach((v, i) => {
            items.push({ i: v.id, x: i * kpiW, y, w: i === kpis.length - 1 ? cols - i * kpiW : kpiW, h: 2, minW: 1, minH: 1, _kind: 'visual' })
          })
        }
        y += Math.max(...kpis.map(k => k.position?.h || 2))
      }
      // Charts: group by original y to preserve side-by-side pairs
      const chartsByY = new Map()
      for (const v of charts) {
        const oy = Math.round(v.position?.y ?? 0)
        if (!chartsByY.has(oy)) chartsByY.set(oy, [])
        chartsByY.get(oy).push(v)
      }
      const sortedRows = Array.from(chartsByY.entries()).sort(([a], [b]) => a - b)
      for (const [, row] of sortedRows) {
        row.sort((a, b) => (a.position?.x ?? 0) - (b.position?.x ?? 0))
        const rowH = Math.max(...row.map(v => Math.min(v.position?.h ?? 5, 8)))
        let rx = 0
        for (const v of row) {
          const w = Math.min(Math.max(v.position?.w ?? 12, 2), cols)
          items.push({ i: v.id, x: rx, y, w, h: Math.min(v.position?.h ?? 5, 8), minW: 1, minH: 1, _kind: 'visual' })
          rx += w
        }
        y += rowH
      }
    }
    setEditLayout(items)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, specStructureId])

  // ── Initial load: visuals + slicer values ───────────────────────────────
  useEffect(() => {
    if (!preNormalizedSpec?.visuals) return
    requestEpochRef.current += 1
    pendingFilterResetRef.current = true
    const requestEpoch = requestEpochRef.current
    setGlobalFilters({})
    setFilterSources({})
    setAxisOverrides({})
    setDrillPaths({})
    setPanelState({})
    setVisualData({})
    setVisualLoading({})
    setVisualErrors({})
    setSlicerValues({})
    for (const s of (preNormalizedSpec.slicers || [])) loadSlicerValues(s, requestEpoch)
  }, [preNormalizedSpec, loadSlicerValues])

  // Stable serialized keys — prevent the filter-change effect from re-firing
  // when setGlobalFilters({}) or setAxisOverrides({}) creates a new {} reference
  // with the same content. Without this, the effect re-fires and bumps the epoch,
  // which causes in-flight slicer value loads to be discarded.
  const globalFiltersKey = useMemo(() => JSON.stringify(globalFilters), [globalFilters])
  // Serialize filterSources so the visual-data effect re-fires when cross-
  // filter source changes (not just values — source affects who's self-filtered).
  const filterSourcesKey = useMemo(() => JSON.stringify(filterSources), [filterSources])
  const axisOverridesKey = useMemo(() => JSON.stringify(axisOverrides), [axisOverrides])
  // Re-query a visual when its drill depth changes (deeper level = new groupBy + ancestor filters).
  const drillPathsKey = useMemo(() => JSON.stringify(drillPaths), [drillPaths])

  // ── Re-load when filters change ─────────────────────────────────────────
  useEffect(() => {
    if (!preNormalizedSpec?.visuals) return
    if (pendingFilterResetRef.current && Object.keys(globalFilters).length > 0) return

    // Capture BEFORE clearing: true means this is the very first visual-load pass
    // after a spec change (triggered by the spec-change effect's setGlobalFilters({})).
    const isInitialLoad = !!pendingFilterResetRef.current
    if (pendingFilterResetRef.current && Object.keys(globalFilters).length === 0) {
      pendingFilterResetRef.current = false
    }

    // Only increment the epoch for real user-driven filter changes.
    // On the initial pass we reuse the epoch the spec-change effect already set,
    // so slicer value loads started there share the same epoch and are not discarded.
    if (!isInitialLoad) {
      requestEpochRef.current += 1
    }
    const requestEpoch = requestEpochRef.current

    // Pre-compute each visual's filter set using the robust slicer helper, then
    // fold in drill state: a drilled visual groups by its current hierarchy level
    // and gains a filter for every ancestor value the user clicked into.
    const work = preNormalizedSpec.visuals.map(v => {
      const baseFilters = buildAppliedFiltersForVisual(preNormalizedSpec, v, globalFilters, filterSources)
      const levels = drillHierarchy(v)
      const style = levels ? drillStyleOf(v) : null
      const path = drillPaths[v.id] || []
      if (style === 'expand') {
        // Expand-in-place: collapsed → normal base-level query; expanded → a 2-dim
        // (parent,child) query that loadVisualData shapes to mixed grain.
        const lv = expandLevels(v)
        const expandedValue = path[0] ?? null
        return {
          visual: v, filters: baseFilters,
          groupByOverride: lv?.parent ? { table: lv.parent.table, column: lv.parent.column } : (axisOverrides[v.id] || null),
          drillCtx: expandedValue && lv ? { style: 'expand', parent: lv.parent, child: lv.child, expandedValue } : null,
        }
      }
      const dq = (style === 'replace') ? resolveDrillQuery(v, path) : null
      return dq
        ? { visual: v, filters: { ...baseFilters, ...dq.ancestorFilters }, groupByOverride: dq.groupBy }
        : { visual: v, filters: baseFilters, groupByOverride: axisOverrides[v.id] || null }
    })

    // Batch all affected visuals into loading state in a single synchronous update
    // so the UI enters the shimmer state together rather than one-by-one.
    const loadingPatch = {}
    const errorPatch   = {}
    for (const { visual } of work) {
      loadingPatch[visual.id] = true
      errorPatch[visual.id]   = null
    }
    setVisualLoading(prev => ({ ...prev, ...loadingPatch }))
    setVisualErrors(prev =>   ({ ...prev, ...errorPatch }))

    // Fire individual async queries; each will bail out if epoch has moved on.
    for (const { visual, filters, groupByOverride, drillCtx } of work) {
      loadVisualData(visual, filters, requestEpoch, groupByOverride, drillCtx)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preNormalizedSpec, globalFiltersKey, filterSourcesKey, axisOverridesKey, drillPathsKey, loadVisualData])

  if (!renderSpec) return null

  const ROW_HEIGHT = renderSpec.layout?.rowHeight || 80
  const GAP        = renderSpec.layout?.gap       || 8

  // Page size — either explicit in layout or resolved from preset name.
  // Drives the maxWidth of the dashboard so editor canvas ↔ PBI publish
  // share the same visual scale.
  const PAGE_PRESETS_LOCAL = {
    '16:9':   { width: 1280, height: 720  },
    '16:10':  { width: 1280, height: 800  },
    '4:3':    { width: 1024, height: 768  },
    'tall':   { width: 1280, height: 1920 },
    'square': { width: 1024, height: 1024 },
    'auto':   { width: 1280, height: null },
  }
  const _layout = renderSpec.layout || {}
  const _pagePreset = _layout.pagePreset
  let PAGE_W = _layout.pageWidth || PAGE_PRESETS_LOCAL[_pagePreset]?.width || 1280

  const visibleSlicers = renderSpec.slicers || []
  const KPI_VIEW_TYPES = new Set(['kpi','stat_card','metric_tile','sparkline_kpi','bullet','progress','gauge'])
  const visibleKpis    = (renderSpec.visuals || []).filter(v => KPI_VIEW_TYPES.has(v.type))
  const visibleCharts  = (renderSpec.visuals || []).filter(v => !KPI_VIEW_TYPES.has(v.type))
  const KPI_H    = 2 * ROW_HEIGHT + GAP  // 168px
  const SLICER_H = ROW_HEIGHT            // 80px

  return (
    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
    <div style={{ width: '100%', maxWidth: PAGE_W, boxSizing: 'border-box' }}>
      {/* Keyframes (spec-pulse, ag-fadeUp, ag-fadeIn, ag-scaleIn, spin, pulse,
          bounce) now live in ./shared/animations.css, imported at module load. */}

      {/* ═══ EDIT MODE: stable GridLayout canvas ═══ */}
      {editMode && onLayoutChange && canvasWidth > 100 && editLayout ? (
        <div>
          <GridLayout
            layout={editLayout}
            cols={12}
            rowHeight={ROW_HEIGHT}
            width={canvasWidth}
            margin={[GAP, GAP]}
            containerPadding={[0, 0]}
            compactType={null}
            isDraggable={true}
            isResizable={true}
            draggableHandle=".ag-edit-handle"
            resizeHandles={['se', 'e', 's']}
            onLayoutChange={(newLayout) => setEditLayout(newLayout)}
            onDragStop={(newLayout) => {
              setEditLayout(newLayout)
              onLayoutChange(newLayout.map(item => ({
                id: item.i, x: item.x, y: item.y, w: item.w, h: item.h,
              })))
            }}
            onResizeStop={(newLayout) => {
              setEditLayout(newLayout)
              onLayoutChange(newLayout.map(item => ({
                id: item.i, x: item.x, y: item.y, w: item.w, h: item.h,
              })))
            }}
          >
            {editLayout.map(layoutItem => {
              // Find the source data — check slicers first, then visuals
              const slicer = (spec?.slicers || []).find(s => s.id === layoutItem.i)
              const visual = slicer ? null : (spec?.visuals || []).find(v => v.id === layoutItem.i)
              const isSelected = selectedVisualId === layoutItem.i

              // ── Slicer edit card ──
              if (slicer) {
                return (
                  <div key={slicer.id} onClick={onSelectVisual ? (e) => { e.stopPropagation(); onSelectVisual(slicer.id) } : undefined}>
                    <div style={{
                      height: '100%',
                      background: T.CARD_BG,
                      border: isSelected ? '2px solid #818CF8' : `1px solid ${T.CARD_BORDER}`,
                      boxShadow: isSelected ? '0 0 0 3px rgba(129,140,248,0.25)' : T.CARD_SHADOW,
                      borderRadius: 10, overflow: 'hidden', display: 'flex', alignItems: 'center',
                      padding: '0 12px', gap: 8, position: 'relative', cursor: 'pointer',
                    }}>
                      <div className="ag-edit-handle" style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1,
                        cursor: 'grab', borderRadius: 10,
                      }} />
                      {(slicer.config?.title || slicer.label) && <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, whiteSpace: 'nowrap', flexShrink: 0, zIndex: 2, pointerEvents: 'none' }}>{slicer.config?.title || slicer.label}</span>}
                      <div style={{ flex: 1, zIndex: 2, pointerEvents: 'auto' }}>
                        {slicer.type === 'date_range' ? <SlicerDateRange slicer={slicer} onChange={handleSlicerChange} globalFilters={globalFilters} theme={theme} />
                         : slicer.type === 'buttons' ? <SlicerButtons slicer={slicer} values={slicerValues[slicer.id] || []} onChange={handleSlicerChange} globalFilters={globalFilters} theme={theme} />
                         : slicer.type === 'multi_select' ? <SlicerMultiSelect slicer={slicer} values={slicerValues[slicer.id] || []} onChange={handleSlicerChange} globalFilters={globalFilters} theme={theme} />
                         : <SlicerDropdown slicer={slicer} values={slicerValues[slicer.id] || []} onChange={handleSlicerChange} globalFilters={globalFilters} theme={theme} />}
                      </div>
                    </div>
                  </div>
                )
              }

              // ── Visual edit card ──
              if (!visual) return <div key={layoutItem.i} />
              const v = visual
              const Component   = VISUAL_MAP[v.type] || CompactKpi
              const colorVal    = getColorValue(v.config?.colorScheme)
              const isKpi       = new Set(['kpi','stat_card','metric_tile','sparkline_kpi','bullet','progress','gauge']).has(v.type)
              const headerH     = isKpi ? 0 : 36
              const isLoading   = !!visualLoading[v.id] || !(v.id in visualData)
              const effectiveGroupBy = getEffectiveGroupBy(v, axisOverrides)
              const activeAxis = axisOverrides[v.id] || null
              const chartConfig = {
                ...(v.config || {}),
                title: undefined, label: undefined,
                measureName: v.data?.measures?.[0],
                secondaryMeasureName: v.data?.measures?.[1] || null,
                orderBy: typeof v.data?.orderBy === 'string'
                  ? v.data.orderBy : (v.data?.orderBy?.dir || 'desc'),
                _T: T,
                _globalFilters: buildAppliedFiltersForVisual(preNormalizedSpec, v, globalFilters, filterSources),
                _globalFiltersKey: globalFiltersKey,
                _selectedCat: getSourceSelectedCat(v, globalFilters, filterSources),
                _onBarClick: (cat) => handleBarClick(v, cat),
                _expand: expandConfigFor(v),
                _onNavigatePage: onNavigatePage,
                _dimensionLabels: Array.isArray(v.data?.dimensions)
                  ? v.data.dimensions.map(d => d.column)
                  : (v.data?.groupBy?.column ? [v.data.groupBy.column] : []),
                _measureNames: v.data?.measures || [],
                // Playground Spike: custom visuals carry their declarative template
                // (from spec.customVisuals, or inline on the visual for preview).
                _customTemplate: v.type === 'custom'
                  ? (spec?.customVisuals?.[v.customTemplateId] || v.customTemplate || null)
                  : undefined,
              }

              return (
                <div key={v.id} onClick={onSelectVisual ? (e) => { e.stopPropagation(); onSelectVisual(v.id) } : undefined}>
                  <div style={{
                    height: '100%',
                    ...getCardChromeStyle({ config: v.config, colorVal, T, isKpi, isSelected }),
                    overflow: 'hidden',
                    display: 'flex', flexDirection: 'column',
                    position: 'relative', cursor: 'pointer',
                    transition: 'box-shadow 0.15s',
                  }}>
                    {/* Drag handle overlay */}
                    <div className="ag-edit-handle" style={{
                      position: 'absolute', top: 0, left: 0, right: 0, height: isKpi ? 24 : headerH || 24, zIndex: 2,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'grab', background: 'transparent', borderRadius: '14px 14px 0 0',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = isSelected ? 'rgba(129,140,248,0.1)' : 'rgba(128,128,128,0.08)'; e.currentTarget.querySelector('.ag-grip').style.opacity = '1' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.querySelector('.ag-grip').style.opacity = isSelected ? '0.6' : '0' }}
                    >
                      <span className="ag-grip" style={{ fontSize: 8, color: isSelected ? '#818CF8' : T.textMuted, letterSpacing: '0.15em', opacity: isSelected ? 0.6 : 0, transition: 'opacity 0.15s' }}>⠿⠿⠿</span>
                    </div>
                    {/* Left accent — zIndex 3 so it sits above the drag handle
                        overlay (zIndex 2) that covers the top 24/36px of the card */}
                    {v.config?.showAccentStrip !== false && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderRadius: '14px 0 0 14px', background: isKpi ? T.kpiAccentFn(colorVal) : T.accentBgFn(colorVal), zIndex: 3, pointerEvents: 'none' }} />}

                    {/* Chart header (non-KPI only) */}
                    {!isKpi && headerH > 0 && (
                      <div style={{
                        height: headerH, flexShrink: 0, display: 'flex', alignItems: 'center',
                        padding: '0 14px', borderBottom: `1px solid ${T.headerBorder}`, gap: 8,
                        zIndex: 3, position: 'relative',
                      }}>
                        <span style={{ fontSize: v.config?.titleFontSize || 12, fontWeight: 600, color: v.config?.titleColor || T.textPrimary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: v.config?.titleFontFamily || 'inherit' }}>
                          {v.config?.title || v.config?.label || ''}
                        </span>
                        <AxisSwitchPills
                          visual={v}
                          axisOverride={activeAxis}
                          onPick={(gb) => setAxisOverrides(prev => ({ ...prev, [v.id]: gb }))}
                          colorVal={colorVal}
                          mutedColor={T.textMuted}
                          borderColor={T.headerBorder}
                          fontFamily={v.config?.titleFontFamily}
                          stopClickPropagation
                        />
                        {isLoading && (
                          <div style={{ width: 5, height: 5, borderRadius: '50%', background: colorVal, animation: 'spec-pulse 0.9s ease-in-out infinite', flexShrink: 0 }} />
                        )}
                      </div>
                    )}

                    {/* Visual content */}
                    <div style={{ flex: 1, padding: isKpi ? 0 : '6px 12px 10px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                      <Component
                        rows={visualData[v.id]}
                        config={isKpi ? { ...(v.config || {}), _T: T, measureName: v.data?.measures?.[0], _cardPixelHeight: (v.position?.h || 2) * ROW_HEIGHT + Math.max((v.position?.h || 2) - 1, 0) * GAP, _globalFilters: buildAppliedFiltersForVisual(preNormalizedSpec, v, globalFilters, filterSources), _globalFiltersKey: globalFiltersKey } : chartConfig}
                        loading={isLoading}
                        error={visualErrors[v.id]}
                        groupBy={effectiveGroupBy}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </GridLayout>
        </div>
      ) : renderSpec.layout?.freeform ? (

      /* ═══ VIEW MODE: freeform — absolute positions from spec ═══ */
      (() => {
        const allItems = [
          ...(renderSpec.slicers || []).map(s => ({ ...s, _kind: 'slicer' })),
          ...(renderSpec.visuals || []).map(v => ({ ...v, _kind: 'visual' })),
        ]
        const canvasCols = 12
        const colW = `calc((100% - ${(canvasCols - 1) * GAP}px) / ${canvasCols})`
        const maxBottom = Math.max(...allItems.map(it => ((it.position?.y || 0) + (it.position?.h || 2))), 8)
        return (
          <div style={{ position: 'relative', width: '100%', height: maxBottom * ROW_HEIGHT + (maxBottom - 1) * GAP }}>
            {allItems.map(item => {
              const pos = item.position || { x: 0, y: 0, w: 4, h: 2 }
              const leftPx  = `calc(${pos.x} * (${colW} + ${GAP}px))`
              const widthPx = `calc(${pos.w} * ${colW} + ${Math.max(pos.w - 1, 0)} * ${GAP}px)`
              const topPx   = pos.y * (ROW_HEIGHT + GAP)
              const heightPx = pos.h * ROW_HEIGHT + Math.max(pos.h - 1, 0) * GAP

              if (item._kind === 'slicer') {
                const slcTitle = item.config?.title || item.label
                return (
                  <div key={item.id} style={{
                    position: 'absolute', left: leftPx, top: topPx, width: widthPx, height: heightPx,
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: T.CARD_BG, border: `1px solid ${T.CARD_BORDER}`,
                    borderRadius: 8, padding: '0 12px', boxSizing: 'border-box',
                  }}>
                    {slcTitle && <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, whiteSpace: 'nowrap', flexShrink: 0 }}>{slcTitle}</span>}
                    {item.type === 'date_range' ? (
                      <SlicerDateRange slicer={item} onChange={handleSlicerChange} globalFilters={globalFilters} theme={theme} />
                    ) : item.type === 'buttons' ? (
                      <SlicerButtons slicer={item} values={slicerValues[item.id] || []} onChange={handleSlicerChange} globalFilters={globalFilters} theme={theme} />
                    ) : item.type === 'multi_select' ? (
                      <SlicerMultiSelect slicer={item} values={slicerValues[item.id] || []} onChange={handleSlicerChange} globalFilters={globalFilters} theme={theme} />
                    ) : (
                      <SlicerDropdown slicer={item} values={slicerValues[item.id] || []} onChange={handleSlicerChange} globalFilters={globalFilters} theme={theme} />
                    )}
                  </div>
                )
              }

              const v = item
              const Component = VISUAL_MAP[v.type] || CompactKpi
              const colorVal  = getColorValue(v.config?.colorScheme)
              const isLoading = !!visualLoading[v.id] || !(v.id in visualData)
              const activeAxis = axisOverrides[v.id] || null
              const effectiveGroupBy = getEffectiveGroupBy(v, axisOverrides)
              const hasAxisOpts = Array.isArray(v.config?.axisOptions) && v.config.axisOptions.filter(o => o?.groupBy?.table && o?.groupBy?.column).length >= 2
              const chartConfig = {
                ...(v.config || {}),
                title: undefined, label: undefined,
                measureName: v.data?.measures?.[0],
                secondaryMeasureName: v.data?.measures?.[1] || null,
                orderBy: typeof v.data?.orderBy === 'string' ? v.data.orderBy : (v.data?.orderBy?.dir || 'desc'),
                _T: T,
                _globalFilters: buildAppliedFiltersForVisual(preNormalizedSpec, v, globalFilters, filterSources),
                _globalFiltersKey: globalFiltersKey,
                _selectedCat: getSourceSelectedCat(v, globalFilters, filterSources),
                _onBarClick: (cat) => handleBarClick(v, cat),
                _expand: expandConfigFor(v),
                _onNavigatePage: onNavigatePage,
                // Playground Spike: custom-visual template (view / standalone-export path).
                _customTemplate: v.type === 'custom'
                  ? (spec?.customVisuals?.[v.customTemplateId] || v.customTemplate || null)
                  : undefined,
              }
              const isKpi = new Set(['kpi','stat_card','metric_tile','sparkline_kpi','bullet','progress','gauge']).has(v.type)
              // Content rendering uses strict 'kpi' check — matches CanvasEditor behavior so
              // gauge/stat_card/etc. can show a title header and get chart padding in view mode.
              const isKpiContent = v.type === 'kpi'

              return (
                <div key={v.id} style={{
                  position: 'absolute', left: leftPx, top: topPx, width: widthPx, height: heightPx,
                  ...getCardChromeStyle({ config: v.config, colorVal, T, isKpi }),
                  overflow: 'hidden', display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
                }}>
                  {/* Left accent strip — matches GridLayout edit mode + section view mode + PBI DAX */}
                  {v.config?.showAccentStrip !== false && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderRadius: '14px 0 0 14px', background: isKpi ? T.kpiAccentFn(colorVal) : T.accentBgFn(colorVal) }} />}
                  {!isKpiContent && (v.config?.title || v.config?.label || hasAxisOpts) && (
                    <div style={{ height: 36, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 14px', borderBottom: `1px solid ${T.headerBorder}`, gap: 8, position: 'relative', zIndex: 2 }}>
                      {v.config?.showAccentStrip !== false && <div style={{ position: 'absolute', left: 0, top: 9, bottom: 9, width: 2.5, borderRadius: 2, background: T.accentBgFn(colorVal) }} />}
                      <span style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v.config?.title || v.config?.label || ''}
                      </span>
                      <AxisSwitchPills
                        visual={v}
                        axisOverride={activeAxis}
                        onPick={(gb) => setAxisOverrides(prev => ({ ...prev, [v.id]: gb }))}
                        colorVal={colorVal}
                        mutedColor={T.textMuted}
                        borderColor={T.headerBorder}
                        fontFamily={v.config?.titleFontFamily}
                      />
                    </div>
                  )}
                  <div style={{ flex: 1, minHeight: 0, padding: isKpiContent ? 0 : '6px 12px 10px', display: 'flex', flexDirection: 'column' }}>
                    <VisualBoundary resetKey={visualData[v.id]}>
                    {isKpiContent ? (
                      <Component rows={visualData[v.id]} config={{ ...(v.config || {}), _T: T, measureName: v.data?.measures?.[0], _cardPixelHeight: (v.position?.h || 2) * ROW_HEIGHT + Math.max((v.position?.h || 2) - 1, 0) * GAP, _globalFilters: buildAppliedFiltersForVisual(preNormalizedSpec, v, globalFilters, filterSources), _globalFiltersKey: globalFiltersKey }} loading={isLoading} error={visualErrors[v.id]} groupBy={effectiveGroupBy} />
                    ) : (
                      <DrillChrome visual={v} path={drillPaths[v.id]} panel={panelState[v.id]}
                        onDrillTo={handleDrillTo} onPanelClose={() => closePanel(v.id)}
                        muted={T.textMuted} primary={T.textPrimary} border={T.headerBorder} surface={T.CARD_BG} accent={T.accentBgFn(colorVal)}>
                        <Component rows={visualData[v.id]} config={{ ...chartConfig, _selectedCat: panelState[v.id]?.value ?? chartConfig._selectedCat }} loading={isLoading} error={visualErrors[v.id]} groupBy={effectiveGroupBy} />
                      </DrillChrome>
                    )}
                    </VisualBoundary>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()

      ) : (

      /* ═══ VIEW MODE: current section-based layout ═══ */
      <div style={{ display: 'flex', flexDirection: 'column', gap: GAP, width: '100%' }}>

        {/* ── Filter bar — all slicers in one horizontal row, evenly spaced ── */}
        {visibleSlicers.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(visibleSlicers.length, 3)}, 1fr)`, gap: GAP, height: SLICER_H }}>
            {visibleSlicers.map(s => {
              const slcTitle = s.config?.title || s.label
              return (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, height: '100%',
                  background: T.CARD_BG, border: `1px solid ${T.CARD_BORDER}`,
                  borderRadius: 8, padding: '0 12px', boxSizing: 'border-box',
                }}>
                  {slcTitle && (
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, whiteSpace: 'nowrap', flexShrink: 0 }}>{slcTitle}</span>
                  )}
                  {s.type === 'date_range' ? (
                    <SlicerDateRange slicer={s} onChange={handleSlicerChange} globalFilters={globalFilters} theme={theme} />
                  ) : s.type === 'buttons' ? (
                    <SlicerButtons slicer={s} values={slicerValues[s.id] || []} onChange={handleSlicerChange} globalFilters={globalFilters} theme={theme} />
                  ) : s.type === 'multi_select' ? (
                    <SlicerMultiSelect slicer={s} values={slicerValues[s.id] || []} onChange={handleSlicerChange} globalFilters={globalFilters} theme={theme} />
                  ) : (
                    <SlicerDropdown slicer={s} values={slicerValues[s.id] || []} onChange={handleSlicerChange} globalFilters={globalFilters} theme={theme} />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── All visuals — unified grid grouped by y position ── */}
        {(() => {
          const allVisuals = [...visibleKpis, ...visibleCharts]
          const rowMap = new Map()
          for (const v of allVisuals) {
            const y = Math.round(v.position?.y ?? 0)
            if (!rowMap.has(y)) rowMap.set(y, [])
            rowMap.get(y).push(v)
          }
          const rows = Array.from(rowMap.entries())
            .sort(([ya], [yb]) => ya - yb)
            .map(([, rowVisuals]) =>
              [...rowVisuals].sort((a, b) => (a.position?.x ?? 0) - (b.position?.x ?? 0))
            )

          return rows.map((rowVisuals, rowIdx) => {
            const rowH = Math.max(...rowVisuals.map(v => {
              const h = v.position?.h || 2
              return h * ROW_HEIGHT + Math.max(h - 1, 0) * GAP
            }))

            return (
              <div key={rowIdx} style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
                gap: GAP,
                height: rowH,
              }}>
                {rowVisuals.map(v => {
                  const Component   = VISUAL_MAP[v.type] || CompactKpi
                  const colorVal    = getColorValue(v.config?.colorScheme)
                  const pos         = v.position || { x: 0, y: 0, w: 4, h: 2 }
                  // CSS grid-column span must be an integer — a fractional w (e.g. 6.8
                  // from a resize/slider) yields `span 6.8`, which is invalid and
                  // collapses the cell to 1 column. Round w and x to whole columns.
                  const colSpan     = Math.min(Math.max(Math.round(pos.w) || 4, 1), 12)
                  const colStart    = Math.min(Math.max(Math.round(pos.x ?? 0), 0), 11)
                  const cellH       = pos.h * ROW_HEIGHT + Math.max(pos.h - 1, 0) * GAP
                  const isKpi       = KPI_VIEW_TYPES.has(v.type)
                  const isLoading   = !!visualLoading[v.id] || !(v.id in visualData)
                  const activeAxis  = axisOverrides[v.id] || null
                  const effectiveGroupBy = getEffectiveGroupBy(v, axisOverrides)
                  const isSelected  = editMode && selectedVisualId === v.id
                  const hoverH      = getHoverHandlers(v.config)
                  const kpiConfig   = { ...(v.config || {}), _T: T, measureName: v.data?.measures?.[0], _cardPixelHeight: cellH, _globalFilters: buildAppliedFiltersForVisual(preNormalizedSpec, v, globalFilters, filterSources), _globalFiltersKey: globalFiltersKey }
                  const chartConfig = {
                    ...(v.config || {}),
                    title: undefined, label: undefined,
                    measureName: v.data?.measures?.[0],
                    secondaryMeasureName: v.data?.measures?.[1] || null,
                    orderBy: typeof v.data?.orderBy === 'string' ? v.data.orderBy : (v.data?.orderBy?.dir || 'desc'),
                    _T: T,
                    _globalFilters: buildAppliedFiltersForVisual(preNormalizedSpec, v, globalFilters, filterSources),
                    _globalFiltersKey: globalFiltersKey,
                    _selectedCat: getSourceSelectedCat(v, globalFilters, filterSources),
                    _onBarClick: (cat) => handleBarClick(v, cat),
                _expand: expandConfigFor(v),
                    _onNavigatePage: onNavigatePage,
                  }

                  return (
                    <div key={v.id}
                      onClick={onSelectVisual ? (e) => { e.stopPropagation(); onSelectVisual(v.id) } : undefined}
                      {...hoverH}
                      style={{
                      gridColumn: `${colStart + 1} / span ${colSpan}`,
                      ...getCardChromeStyle({ config: v.config, colorVal, T, isKpi, isSelected }),
                      cursor: editMode ? 'pointer' : 'default',
                      transition: 'box-shadow 0.25s, border 0.15s, transform 0.25s',
                      ...getCardAnimation(v.config),
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      boxSizing: 'border-box',
                      height: cellH,
                      minWidth: 0,
                      position: 'relative',
                    }}>
                      {v.config?.showAccentStrip !== false && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderRadius: '14px 0 0 14px', background: isKpi ? T.kpiAccentFn(colorVal) : T.accentBgFn(colorVal), zIndex: 1 }} />}
                      {isKpi ? (
                        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                          <Component
                            rows={visualData[v.id]}
                            config={kpiConfig}
                            loading={isLoading}
                            error={visualErrors[v.id]}
                          />
                        </div>
                      ) : (
                        <>
                          {(v.config?.title || v.config?.label) && (
                            <div style={{ height: 36, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 14px', borderBottom: `1px solid ${T.headerBorder}`, gap: 8, position: 'relative' }}>
                              <span style={{ fontSize: v.config?.titleFontSize || 12, fontWeight: 600, color: v.config?.titleColor || T.textPrimary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: v.config?.titleFontFamily || 'inherit' }}>
                                {v.config?.title || v.config?.label || ''}
                              </span>
                              <AxisSwitchPills visual={v} axisOverride={activeAxis} onPick={(gb) => setAxisOverrides(prev => ({ ...prev, [v.id]: gb }))} colorVal={colorVal} mutedColor={T.textMuted} borderColor={T.headerBorder} fontFamily={v.config?.titleFontFamily} />
                              {isLoading && <div style={{ width: 5, height: 5, borderRadius: '50%', background: colorVal, animation: 'spec-pulse 0.9s ease-in-out infinite', flexShrink: 0 }} />}
                            </div>
                          )}
                          <div style={{ flex: 1, padding: '6px 12px 10px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                            <VisualBoundary resetKey={visualData[v.id]}>
                            <DrillChrome visual={v} path={drillPaths[v.id]} panel={panelState[v.id]}
                              onDrillTo={handleDrillTo} onPanelClose={() => closePanel(v.id)}
                              muted={T.textMuted} primary={T.textPrimary} border={T.headerBorder} surface={T.CARD_BG} accent={T.accentBgFn(colorVal)}>
                              <Component rows={visualData[v.id]} config={{ ...chartConfig, _selectedCat: panelState[v.id]?.value ?? chartConfig._selectedCat }} loading={isLoading} error={visualErrors[v.id]} groupBy={effectiveGroupBy} />
                            </DrillChrome>
                            </VisualBoundary>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })
        })()}

      </div>
      )}
    </div>
    </div>
  )
}

