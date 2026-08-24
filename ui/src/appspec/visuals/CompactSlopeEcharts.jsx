import React, { useMemo } from 'react'
import { MULTI_COLORS } from '../shared/palettes.js'
import { fmtVal } from '../shared/formatters.js'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import EChartsCanvas from '../shared/EChartsCanvas.jsx'
import { applyTooltipConfig } from '../shared/applyTooltipConfig.js'
import getThemeTokens from '../getThemeTokens'

// Slope chart customization schema — surfaced by the schema-driven VisualInspector.
// Slope is a dedicated ECharts composition (not a shared primitive): one line per
// category connecting two x-positions (left measure → right measure).
export const schema = [
  { key: 'leftLabel',  label: 'Left label',          type: 'text',    default: 'Start', group: 'Labels' },
  { key: 'rightLabel', label: 'Right label',         type: 'text',    default: 'End',   group: 'Labels' },
  { key: 'showValues', label: 'Show values',         type: 'boolean', default: true,                     group: 'Labels' },
  { key: 'showLegend', label: 'Show category names', type: 'boolean', default: true,                     group: 'Labels' },
  { key: 'lineWidth',  label: 'Line width',          type: 'range',   default: 2, min: 1, max: 6,  step: 0.5, group: 'Appearance' },
  { key: 'dotSize',    label: 'Dot size',            type: 'range',   default: 5, min: 2, max: 12, step: 1,   group: 'Appearance' },
]

// Slope (a.k.a. slopegraph) — each category is a line joining its start value
// (_val) at the left axis tick to its end value (_val2) at the right axis tick.
// Needs two measures; renders an empty-state prompt otherwise.
export default function CompactSlopeEcharts({ rows, config, loading, error }) {
  const t = config._T || getThemeTokens('dark')
  const colors = config.customColors || MULTI_COLORS

  const option = useMemo(() => {
    const items = (rows || [])
      .filter(r => r?._cat != null && r?._val != null && r?._val2 != null)
      .slice(0, config.limit || 12)
    if (!items.length) return null

    const leftLabel  = config.leftLabel  || 'Start'
    const rightLabel = config.rightLabel || 'End'
    const lineWidth  = config.lineWidth ?? 2
    const dotSize    = config.dotSize ?? 5
    const showValues = config.showValues ?? true
    const showLegend = config.showLegend ?? true

    const series = items.map((r, i) => {
      const color = colors[i % colors.length]
      return {
        type: 'line',
        name: String(r._cat),
        data: [Number(r._val) || 0, Number(r._val2) || 0],
        symbol: 'circle',
        symbolSize: dotSize * 2,
        lineStyle: { width: lineWidth, color, opacity: 0.85 },
        itemStyle: { color },
        emphasis: { focus: 'series' },
        // Category name trailing the right-hand point.
        endLabel: showLegend
          ? { show: true, formatter: () => String(r._cat).slice(0, 18), color: t.textMuted, fontSize: 9, fontWeight: 600, distance: 4 }
          : { show: false },
        // Value labels above each end point.
        label: showValues
          ? { show: true, position: 'top', formatter: (pp) => fmtVal(pp.value, config.prefix, config.suffix), color, fontSize: 9, fontWeight: 600 }
          : { show: false },
      }
    })

    return {
      grid: { left: 24, right: showLegend ? 96 : 32, top: 26, bottom: 22 },
      xAxis: {
        type: 'category',
        data: [leftLabel, rightLabel],
        boundaryGap: false,
        axisLabel: { color: t.textMuted, fontSize: 10, fontWeight: 600 },
        axisLine: { lineStyle: { color: t.gridStroke } },
        axisTick: { show: false },
      },
      yAxis: { type: 'value', show: false, scale: true },
      series,
    }
  }, [
    rows, t, colors,
    config.leftLabel, config.rightLabel, config.lineWidth, config.dotSize,
    config.showValues, config.showLegend, config.limit, config.prefix, config.suffix,
  ])

  if (loading) return <LoadingShimmer />
  if (error)   return <EmptyState error={error} />
  if (!option) return <EmptyState label={config.title || config.label || 'Need 2 measures'} />

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <EChartsCanvas option={applyTooltipConfig(option, config)} />
    </div>
  )
}
