// Spec layout normalization. Pure function — takes an AppSpec and returns
// one with positions filled in (slicers on top, KPIs in a KPI row, charts
// below respecting original row intent). Verbatim extract from
// AppSpecRenderer.jsx (pre-Phase-1).

export function normalizeLayout(spec) {
  if (!spec?.visuals) return spec

  // Free-form mode: user has explicit positions, don't auto-arrange
  if (spec.layout?.freeform) return spec

  const cols = 12
  const slicers = spec.slicers || []
  const visuals = spec.visuals || []

  // Separate by type — ignore ALL AI y values, drop visuals with no measures
  const KPI_TYPES = new Set(['kpi', 'stat_card', 'metric_tile', 'sparkline_kpi', 'bullet', 'progress', 'gauge'])
  const kpis   = visuals.filter(v => KPI_TYPES.has(v.type) && v.data?.measures?.length > 0)
  const charts = visuals.filter(v => !KPI_TYPES.has(v.type) && v.data?.measures?.length > 0)

  let currentY = 0
  const placedSlicers = []
  const placedKpis    = []
  const placedCharts  = []

  // ── Slicers: one per row at top ────────────────
  for (const slicer of slicers) {
    placedSlicers.push({
      ...slicer,
      position: { x: 0, y: currentY, w: 4, h: 1 }
    })
    currentY += 1
  }

  // ── All KPIs: use AI-assigned widths if they fit, otherwise distribute evenly ───
  if (kpis.length > 0) {
    const aiTotalW = kpis.reduce((s, k) => s + (k.position?.w || 3), 0)
    const kpiH = Math.max(...kpis.map(k => k.position?.h || 2))
    if (aiTotalW <= cols && kpis.every(k => k.position?.w)) {
      let kx = 0
      kpis.forEach((kpi) => {
        const w = Math.min(kpi.position.w, cols - kx)
        const h = kpi.position?.h || 2
        placedKpis.push({ ...kpi, position: { x: kx, y: currentY, w, h } })
        kx += w
      })
    } else {
      const kpiW = Math.max(Math.floor(cols / kpis.length), 1)
      kpis.forEach((kpi, i) => {
        const h = kpi.position?.h || 2
        placedKpis.push({
          ...kpi,
          position: { x: i * kpiW, y: currentY, w: i === kpis.length - 1 ? cols - i * kpiW : kpiW, h }
        })
      })
    }
    currentY += kpiH
  }

  // ── Charts: preserve row intent (x/w/grouping by y) ─────────────────
  const chartsByY = new Map()
  for (const chart of charts) {
    const origY = Math.round(chart.position?.y ?? 0)
    if (!chartsByY.has(origY)) chartsByY.set(origY, [])
    chartsByY.get(origY).push(chart)
  }
  const chartRows = Array.from(chartsByY.entries())
    .sort(([ya], [yb]) => ya - yb)
    .map(([, row]) => [...row].sort((a, b) => (a.position?.x ?? 0) - (b.position?.x ?? 0)))

  for (const row of chartRows) {
    const rowH = Math.max(...row.map(v => Math.min(v.position?.h || 5, 6)))
    const totalW = row.reduce((s, v) => s + Math.min(Math.max(v.position?.w || 12, 1), cols), 0)
    let rowX = 0

    for (const chart of row) {
      let w = Math.min(Math.max(chart.position?.w || 12, 1), cols)
      const h = Math.min(chart.position?.h || 5, 6)
      if (totalW > cols) {
        w = Math.floor(cols / row.length)
        if (chart === row[row.length - 1]) w = cols - rowX
      }
      const x = Math.min(Math.max(rowX, 0), cols - 1)
      placedCharts.push({
        ...chart,
        position: { x, y: currentY, w: Math.min(w, cols - x), h }
      })
      rowX += w
    }
    currentY += rowH
  }

  return {
    ...spec,
    layout: { columns: cols, rowHeight: 80, gap: 8 },
    visuals: [...placedKpis, ...placedCharts],
    slicers: placedSlicers
  }
}
