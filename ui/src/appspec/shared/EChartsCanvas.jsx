import { applyAxisTextConfig } from './axisTextConfig.js'
import { secondaryAxisMinimumWidth, scrollableChartTooltip } from './secondaryAxis.js'
import React, { useEffect, useRef, useMemo } from 'react'
import * as echarts from 'echarts/core'
import { RadarChart, BarChart, GaugeChart, ScatterChart, TreemapChart, PieChart, LineChart, HeatmapChart } from 'echarts/charts'
// Playground Spike: MarkArea (qualitative bands — the bullet needs it), MarkPoint
// (labeled max/min dots), Polar (radial bar / rose / nightingale) and VisualMap
// (declarative value-based coloring — the only no-JS way to color by data) are
// added so custom visuals can express novel, non-built-in shapes declaratively.
// Next-C: a broad family set so custom templates can reach chord/candlestick/
// sankey/graph/boxplot/parallel/themeRiver/pictogram/sunburst/tree/funnel/calendar.
import { PictorialBarChart, CandlestickChart, BoxplotChart, SankeyChart, GraphChart, ParallelChart, ThemeRiverChart, SunburstChart, TreeChart, FunnelChart, EffectScatterChart } from 'echarts/charts'
import { TooltipComponent, GridComponent, LegendComponent, DataZoomInsideComponent, MarkLineComponent, MarkAreaComponent, MarkPointComponent, GraphicComponent, TitleComponent, PolarComponent, VisualMapComponent, CalendarComponent, SingleAxisComponent, ParallelComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { LabelLayout } from 'echarts/features'
echarts.use([
  RadarChart, BarChart, GaugeChart, ScatterChart, TreemapChart, PieChart, LineChart, HeatmapChart,
  PictorialBarChart, CandlestickChart, BoxplotChart, SankeyChart, GraphChart, ParallelChart, ThemeRiverChart, SunburstChart, TreeChart, FunnelChart, EffectScatterChart,
  TooltipComponent, GridComponent, LegendComponent, DataZoomInsideComponent, MarkLineComponent, MarkAreaComponent, MarkPointComponent, GraphicComponent, TitleComponent, PolarComponent, VisualMapComponent, CalendarComponent, SingleAxisComponent, ParallelComponent,
  CanvasRenderer, LabelLayout,
])

// Dumb ECharts wrapper. Stays ECharts-shaped — forwards raw `params` from
// chart.on('click'). Per-visual translation to Semantica's click contract
// (e.g. params.name → _onBarClick(cat)) lives in the CompactXEcharts files.
//
// Lifecycle:
//   mount    → echarts.init(root)
//   update   → setOption(option, { notMerge: false, lazyUpdate: true })
//   resize   → ResizeObserver → rAF-coalesced chart.resize() (skips zero-dim)
//   click    → chart.on('click', params => onClick(params))
//   unmount  → chart.dispose() + observer disconnect
export default function EChartsCanvas({ option: sourceOption, config, onClick, onChartReady, style, allowSecondaryAxis = false }) {
  const option = useMemo(() => applyAxisTextConfig(sourceOption, allowSecondaryAxis ? config : { ...config, secondaryAxisEnabled: false }), [sourceOption, allowSecondaryAxis, config?.axisTickColor, config?.axisFontSize, config?.axisFontFamily, config?.xAxisLabelFamily, config?.xAxisLabelWidth, config?.xAxisLabelOverflow, config?.xAxisLabelHideOverlap, config?.yAxisLabelFamily, config?.yAxisLabelWidth, config?.yAxisLabelOverflow, config?.yAxisLabelHideOverlap, config?.xAxisLabelColor, config?.xAxisLabelSize, config?.xAxisLabelWeight, config?.xAxisLabelRotation, config?.xAxisLabelSpacing, config?.yAxisLabelColor, config?.yAxisLabelSize, config?.yAxisLabelWeight, config?.yAxisLabelRotation, config?.yAxisLabelSpacing, config?.secondaryAxisEnabled, config?.secondaryAxisVisible, config?.secondaryAxisTitle, config?.secondaryAxisTitleColor, config?.secondaryAxisTitleSize, config?.secondaryAxisTitleWeight, config?.secondaryAxisTitleGap, config?.secondaryAxisLabelColor, config?.secondaryAxisLabelSize, config?.secondaryAxisLabelFamily, config?.secondaryAxisLabelWeight, config?.secondaryAxisLabelRotation, config?.secondaryAxisLabelSpacing, config?.secondaryAxisLineColor, config?.secondaryAxisGrid, config?.secondaryAxisGridColor, config?.secondaryAxisPrefix, config?.secondaryAxisSuffix])
  const rootRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!rootRef.current) return
    const chart = echarts.init(rootRef.current)
    chartRef.current = chart
    onChartReady?.(chart)

    let rafId = 0
    const ro = new ResizeObserver(() => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        if (!chartRef.current) return
        const { clientWidth: w, clientHeight: h } = rootRef.current || {}
        if (!w || !h) return
        chartRef.current.resize()
      })
    })
    ro.observe(rootRef.current)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      ro.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !option) return
    const renderOption = secondaryAxisMinimumWidth(option, config) ? scrollableChartTooltip(option, rootRef.current) : option
    // universalTransition (expand-in-place morph, pattern 02) needs a full non-merge
    // apply so ECharts diffs old→new marks by groupId and animates the split/merge.
    // replaceMerge keeps the old series object and suppresses the transition.
    const hasUniversalTransition = Array.isArray(option.series) && option.series.some(s => s && s.universalTransition)
    if (hasUniversalTransition) {
      chart.setOption(renderOption, { notMerge: true, lazyUpdate: true })
      return
    }
    // replaceMerge series/xAxis/yAxis so sub-components that disappear between
    // renders are actually removed — not kept by ECharts' default deep-merge.
    // Without this, toggling OFF the average line (a series markLine) or grid
    // lines (an axis splitLine) leaves the old one on screen because the new
    // option simply omits it and merge preserves the prior value. dataZoom,
    // legend, radar, etc. stay merged (not listed) so their state is preserved.
    chart.setOption(renderOption, { notMerge: false, lazyUpdate: true, replaceMerge: ['series', 'xAxis', 'yAxis', 'tooltip'] })
  }, [option])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    if (!onClick) return
    const handler = (params) => onClick(params)
    chart.on('click', handler)
    return () => { chart.off('click', handler) }
  }, [onClick])

  const minWidth = secondaryAxisMinimumWidth(option, config)
  return <div tabIndex={minWidth ? 0 : undefined} aria-label={minWidth ? 'Chart; scroll horizontally to view both axes' : undefined} style={{ width: '100%', height: '100%', overflowX: minWidth ? 'auto' : undefined, ...style }}>
    <div ref={rootRef} style={{ width: '100%', height: '100%', minWidth: minWidth || undefined }} />
  </div>
}
