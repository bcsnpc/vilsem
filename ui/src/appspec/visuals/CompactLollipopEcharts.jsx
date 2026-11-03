import React, { useMemo, useCallback } from 'react'
import { pal, gridLineColor } from '@vilsem/core/palettes'
import { fmtVal } from '../shared/formatters.js'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import EChartsCanvas from '../shared/EChartsCanvas.jsx'
import { applyTooltipConfig } from '../shared/applyTooltipConfig.js'
import getThemeTokens from '../getThemeTokens'

// Lollipop customization schema — surfaced by the schema-driven VisualInspector.
// Lollipop is a dedicated ECharts composition: a thin bar (the stem) plus a
// scatter series (the dot) sharing the same value per category.
export const schema = [
  { key: 'orientation', label: 'Orientation', type: 'select',  default: 'horizontal',
    options: [{ label: 'Horizontal', value: 'horizontal' }, { label: 'Vertical', value: 'vertical' }], group: 'Appearance' },
  { key: 'dotSize',     label: 'Dot size',    type: 'range',   default: 6, min: 3, max: 16, step: 1, group: 'Appearance' },
  { key: 'lineWidth',   label: 'Stem width',  type: 'range',   default: 2, min: 1, max: 8,  step: 1, group: 'Appearance' },
  { key: 'gridLines',   label: 'Grid lines',  type: 'boolean', default: false,                      group: 'Appearance' },
  { key: 'dataLabels',  label: 'Show values', type: 'boolean', default: true,                       group: 'Labels' },
]

export default function CompactLollipopEcharts({ rows, config, loading, error }) {
  const handleClick = useCallback(params => {
    const cat = params?.value?.[config.orientation === 'vertical' ? 0 : 1]
    if (config._onBarClick && cat != null) config._onBarClick(String(cat), { ctrlKey: !!params?.event?.event?.ctrlKey, metaKey: !!params?.event?.event?.metaKey })
  }, [config._onBarClick, config.orientation])
  const t = config._T || getThemeTokens('dark')
  const p = pal(config.colorScheme)

  const option = useMemo(() => {
    const chartRows = (rows || [])
      .filter(r => r?._cat != null && r?._val != null)
      .slice(0, config.limit || 20)
    if (!chartRows.length) return null

    const orientation = config.orientation || 'horizontal'
    const isH         = orientation === 'horizontal'
    const dotSize     = config.dotSize ?? 6
    const lineWidth   = config.lineWidth ?? 2
    const showLabels  = config.dataLabels ?? true
    const showGrid    = config.gridLines ?? false
    const gridColor   = gridLineColor(config, t.gridStrokeOn)
    const color       = p.start
    const catColors   = config.categoryColors  // per-category colour overrides (by _cat)

    const categories = chartRows.map(r => String(r._cat))
    const vals       = chartRows.map(r => Number(r._val) || 0)
    const dataMin    = Math.min(0, ...vals)
    const dataMax    = Math.max(0, ...vals)

    const catAxis = {
      type: 'category',
      data: categories,
      inverse: isH,   // first row at top for horizontal lollipops
      axisLabel: { color: t.textMuted, fontSize: 9, ...(isH ? {} : { interval: 0, overflow: 'truncate', width: 70 }) },
      axisLine: { lineStyle: { color: t.gridStroke } },
      axisTick: { show: false },
    }
    const valAxis = {
      type: 'value',
      min: dataMin,
      max: dataMax,
      axisLabel: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: showGrid ? { show: true, lineStyle: { color: gridColor, type: 'dashed' } } : { show: false },
    }

    // Scatter points sit at (value, category). Orientation decides which axis is which.
    const scatterData = chartRows.map((r, i) => (isH ? [vals[i], categories[i]] : [categories[i], vals[i]]))

    // Per-category colour overrides: attach an itemStyle only to items the user coloured;
    // others keep the scheme colour. ECharts merges per-item itemStyle over the series one.
    const stemData = vals.map((v, i) => {
      const cc = catColors && catColors[categories[i]]
      return cc ? { value: v, itemStyle: { color: cc, opacity: 0.55 } } : v
    })
    const dotData = scatterData.map((pt, i) => {
      const cc = catColors && catColors[categories[i]]
      return cc ? { value: pt, itemStyle: { color: cc, shadowBlur: 6, shadowColor: `${cc}66` } } : pt
    })

    return {
      animation: config.animations !== false && config.animationEnabled !== false,
      grid: { left: 8, right: isH ? 44 : 12, top: 14, bottom: isH ? 8 : 28, containLabel: true },
      xAxis: isH ? valAxis : catAxis,
      yAxis: isH ? catAxis : valAxis,
      series: [
        { // stems
          type: 'bar',
          data: stemData,
          barWidth: lineWidth,
          itemStyle: { color, opacity: 0.55 },
          z: 1,
          silent: true,
        },
        { // dots
          type: 'scatter',
          data: dotData,
          symbolSize: dotSize * 2,
          itemStyle: { color, shadowBlur: 6, shadowColor: `${color}66` },
          z: 2,
          label: showLabels ? {
            show: true,
            position: isH ? 'right' : 'top',
            formatter: (pp) => fmtVal(isH ? pp.value[0] : pp.value[1], config.prefix, config.suffix),
            color: p.text || color,
            fontSize: 9,
            fontWeight: 600,
          } : { show: false },
        },
      ],
    }
  }, [
    rows, t, p.start, p.text,
    config.orientation, config.dotSize, config.lineWidth, config.dataLabels, config.gridLines,
    config.limit, config.prefix, config.suffix, config.colorScheme,
    config.animations, config.animationEnabled,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(config.categoryColors),
  ])

  if (loading) return <LoadingShimmer />
  if (error)   return <EmptyState error={error} />
  if (!option) return <EmptyState label={config.title || config.label} />

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <EChartsCanvas config={config} option={applyTooltipConfig(option, config)} onClick={config._onBarClick ? handleClick : undefined} />
    </div>
  )
}
