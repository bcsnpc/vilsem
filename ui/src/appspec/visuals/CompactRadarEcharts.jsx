import React, { useMemo, useCallback, useRef } from 'react'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import EChartsCanvas from '../shared/EChartsCanvas.jsx'
import getThemeTokens from '../getThemeTokens'
import { mergeFragments, RadarMarks } from '../../primitives/index'
import { fmtVal } from '../shared/formatters.js'
import { pal } from '../shared/palettes.js'

export default function CompactRadarEcharts({ rows, config, loading, error }) {
  const t = config._T || getThemeTokens('dark')
  const hoveredIdxRef  = useRef(-1)
  const indicatorsRef  = useRef([])

  const option = useMemo(() => {
    const chartRows = (rows || []).filter(r => r?._cat != null && r?._val != null)
    if (!chartRows.length) return null

    const ctx = {
      data: { fields: [], rows: chartRows },
      encoding: {},
      theme: t,
      selection: { selectedCat: null },
      dimensions: { width: 0, height: 0 },
    }

    const base = mergeFragments([
      RadarMarks({
        colorScheme:   config.colorScheme,
        seriesName:    config.title || config.label || '',
        fillOpacity:   config.fillOpacity   ?? 0.22,
        strokeWidth:   config.strokeWidth   ?? 2,
        showDots:      config.showDots      ?? false,
        radarRadius:   config.radarRadius   ?? 68,
        labelFontSize: config.labelFontSize ?? 9,
        prefix:        config.prefix,
        suffix:        config.suffix,
        animEnabled:   config.animationEnabled !== false,
      }, ctx),
    ])

    // mergeFragments returns the raw ECharts option — no .option wrapper
    const indicators = base.radar?.indicator ?? []
    indicatorsRef.current = indicators

    // Override tooltip: show only the indicator nearest the cursor
    const p   = pal(config.colorScheme)
    const pre = config.prefix
    const suf = config.suffix
    const shadow = t.canvasBg?.startsWith('#0')
      ? '0 12px 28px rgba(0,0,0,0.48)'
      : '0 8px 24px rgba(0,0,0,0.12)'
    const wrap = (inner) =>
      `<div style="background:${t.echartsTooltipBg};border:1px solid ${t.echartsTooltipBorder};border-radius:10px;padding:10px 13px;min-width:140px;box-shadow:${shadow};color:${t.echartsTooltipText}">${inner}</div>`
    const mkRow = (name, v) =>
      `<div style="display:flex;justify-content:space-between;gap:16px;font-size:11px;padding:2px 0">` +
      `<span style="color:${t.echartsLegendText}">${name}</span>` +
      `<span style="color:${p.start};font-weight:700">${fmtVal(v, pre, suf)}</span></div>`

    base.tooltip = {
      ...(base.tooltip || {}),
      trigger: 'item',
      confine: true,
      backgroundColor: 'transparent',
      borderWidth: 0,
      padding: 0,
      formatter: (params) => {
        const vals = Array.isArray(params.value) ? params.value : [params.value]
        const inds = indicatorsRef.current
        const idx  = hoveredIdxRef.current
        if (idx >= 0 && idx < vals.length && inds[idx]) {
          return wrap(mkRow(inds[idx].name, vals[idx]))
        }
        return wrap(vals.map((v, i) => mkRow(inds[i]?.name ?? '', v)).join(''))
      },
    }

    return base
  }, [
    rows, t,
    config.colorScheme,
    config.fillOpacity, config.strokeWidth, config.showDots,
    config.radarRadius, config.labelFontSize,
    config.prefix, config.suffix, config.animationEnabled,
    config.title, config.label,
  ])

  // Wire up ZR mousemove to detect which axis (spoke) the cursor is nearest to.
  // ECharts radar: indicator 0 is at the top (90° in math coords), going clockwise.
  const handleChartReady = useCallback((chart) => {
    const zr = chart.getZr()
    zr.on('mousemove', (e) => {
      const inds = indicatorsRef.current
      const N = inds.length
      if (!N) { hoveredIdxRef.current = -1; return }
      const { clientWidth: W, clientHeight: H } = chart.getDom()
      const cx = W / 2, cy = H / 2
      const dx = e.offsetX - cx
      const dy = e.offsetY - cy
      if (Math.sqrt(dx * dx + dy * dy) < 12) { hoveredIdxRef.current = -1; return }
      // Angle in math coords (Y flipped vs screen)
      const mouseAngle = (((Math.atan2(-dy, dx) * 180 / Math.PI) % 360) + 360) % 360
      let closest = 0, minDiff = Infinity
      for (let i = 0; i < N; i++) {
        const iAngle = (((90 - (i / N) * 360) % 360) + 360) % 360
        let diff = Math.abs(mouseAngle - iAngle)
        if (diff > 180) diff = 360 - diff
        if (diff < minDiff) { minDiff = diff; closest = i }
      }
      hoveredIdxRef.current = closest
    })
    zr.on('mouseout', () => { hoveredIdxRef.current = -1 })
  }, [])

  const handleClick = useCallback((params) => {
    if (!config._onBarClick) return
    const cat = typeof params?.name === 'string' ? params.name : null
    if (cat) config._onBarClick(cat)
  }, [config._onBarClick])

  if (loading) return <LoadingShimmer />
  if (error)   return <EmptyState error={error} />
  if (!option) return <EmptyState label={config.title || config.label} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <EChartsCanvas
          option={option}
          onClick={config._onBarClick ? handleClick : undefined}
          onChartReady={handleChartReady}
        />
      </div>
    </div>
  )
}
