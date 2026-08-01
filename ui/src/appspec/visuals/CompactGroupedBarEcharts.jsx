import React, { useMemo, useCallback } from 'react'
import { pal, gridLineColor } from '../shared/palettes.js'
import { BAR_SCROLL_THRESHOLD } from '../shared/formatters.js'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import EChartsCanvas from '../shared/EChartsCanvas.jsx'
import { buildExpandBarOption } from '../shared/expandBarOption.js'
import getThemeTokens from '../getThemeTokens'
import {
  mergeFragments,
  CartesianFrame,
  CategoricalAxis,
  LinearAxis,
  BarMarks,
  Tooltip,
  Legend,
} from '../../primitives/index'

// Grouped bar — two measures side-by-side per category. Same fragment composition
// as CompactStackedBarEcharts, just with `stacked: false` so ECharts auto-groups
// the two series next to each other instead of cumulating them. Default orientation
// is 'vertical' (bars going up, categories on x-axis) to match the legacy Recharts
// implementation; user can flip via inspector.
export default function CompactGroupedBarEcharts({ rows, config, loading, error }) {
  const p = pal(config.colorScheme)
  const t = config._T || getThemeTokens('dark')

  const orientation    = config.orientation    || 'vertical'
  const barRadius      = config.barRadius      ?? 3
  const barCategoryGap = config.barCategoryGap || '20%'
  const gradient       = config.gradient       ?? false
  const gradientTo     = config.gradientTo     || p.mid || p.start
  const showGrid       = config.gridLines      ?? true                     // grouped bars commonly show horizontal gridlines (legacy default)
  const gridStyle      = config.gridStyle      || 'dashed'
  const gridColor      = gridLineColor(config, t.gridStrokeOn)
  const showDataLabels = config.dataLabels     ?? false
  const labelPosition  = config.labelPosition  || 'top'                    // top is the natural fit for vertical grouped bars
  const showXAxis      = config.showXAxis      ?? true
  const showYAxis      = config.showYAxis      ?? true
  const showBackground = config.showBarBackground ?? false
  const rankOpacity    = config.rankOpacity    ?? false                    // off by default — grouped bars compare measures, not rank a single one
  const highlightMax   = config.highlightMax   ?? false
  const animDuration   = config.animationDuration === 'fast' ? 300 : config.animationDuration === 'slow' ? 800 : 500
  const animEnabled    = config.animations !== false && config.animationEnabled !== false
  const maxBarWidth    = config.maxBarSize     ?? 24
  const orderBy        = config.orderBy        || 'desc'
  const isHorizontal   = orientation === 'horizontal'
  const selectedCat    = config._selectedCat   ?? null

  // Grouped-bar-specific defaults — user can flip stack on in inspector to convert
  // the visual to a stacked bar without changing visual.type.
  const stacked        = config.stacked        ?? false
  const secondaryColor = config.secondaryColor || p.mid || '#3B82F6'

  const option = useMemo(() => {
    const chartRows = [...(rows || [])]
      .filter(r => r?._cat != null && r?._val != null)
      .slice(0, config.limit || 50)

    if (!chartRows.length) return null

    // Expand-in-place (drill pattern 02): while drilled, a grouped bar collapses to
    // its primary measure and morphs like a single-series bar (shared builder).
    if (config._expand) {
      return buildExpandBarOption(chartRows, {
        isHorizontal, palStart: p.start, t, maxBarWidth, showDataLabels,
        expandedValue: config._expand.expandedValue,
      })
    }

    const categories     = chartRows.map(r => String(r._cat))
    const primaryVals    = chartRows.map(r => Number(r._val) || 0)
    const hasSecondary   = chartRows.some(r => r._val2 != null)
    const secondaryVals  = hasSecondary ? chartRows.map(r => Number(r._val2) || 0) : null
    const dataMin = Math.min(0, ...primaryVals, ...(secondaryVals || []))
    // Grouped (not stacked) → max is the larger of the two measures, not the sum.
    const dataMax = (stacked && hasSecondary && secondaryVals)
      ? Math.max(...primaryVals.map((v, i) => v + (secondaryVals[i] || 0)), 0)
      : Math.max(...primaryVals, ...(secondaryVals || [0]))

    const ctx = {
      data: { fields: [], rows: chartRows },
      encoding: {},
      theme: t,
      selection: { selectedCat },
      dimensions: { width: 0, height: 0 },
    }

    const fragments = [
      CartesianFrame({
        orientation,
        // Top margin needs ~24px breathing room when labels sit above the tallest bar
        // (labelPosition='top' on a vertical grouped bar). Without it, the value label
        // on the max bar gets clipped by the card edge. Bump only when both conditions
        // apply — saves vertical space when labels aren't above bars.
        margin: {
          left: 4,
          right: showDataLabels ? 60 : 16,
          top: (showDataLabels && labelPosition === 'top' && !isHorizontal) ? 28 : 4,
          bottom: 4,
        },
      }, ctx),

      isHorizontal
        ? CategoricalAxis({ axis: 'y', categories, show: showYAxis }, ctx)
        : CategoricalAxis({ axis: 'x', categories, show: showXAxis }, ctx),

      isHorizontal
        ? LinearAxis({ axis: 'x', dataMin, dataMax, show: showXAxis }, ctx)
        : LinearAxis({ axis: 'y', dataMin, dataMax, show: showYAxis }, ctx),

      BarMarks({
        orientation,
        colorScheme: config.colorScheme,
        gradient,
        gradientTo,
        rankOpacity,
        highlightMax,
        orderBy,
        showBackground,
        barRadius,
        maxBarSize: maxBarWidth,
        animEnabled,
        animDuration,
        showDataLabels,
        labelPosition,
        dataLabelColor: config.dataLabelColor || 'auto',
        prefix: config.prefix,
        suffix: config.suffix,
        measureName: config.measureName,
        scrollThreshold: BAR_SCROLL_THRESHOLD,
        secondaryData: secondaryVals || undefined,
        secondaryMeasureName: config.secondaryMeasureName,
        secondaryColor,
        stacked,                           // false for grouped → ECharts auto-arranges series side-by-side
      }, ctx),

      Tooltip({
        trigger: 'axis',
        prefix: config.prefix,
        suffix: config.suffix,
        measureName: config.measureName,
        accentColor: p.text || p.start,
        seriesColors: hasSecondary ? [p.start, secondaryColor] : [p.start],
      }, ctx),

      Legend({ show: hasSecondary }, ctx),
    ]

    if (showGrid) {
      const splitLine = {
        show: true,
        lineStyle: {
          color: gridColor,
          type: gridStyle === 'solid' ? 'solid' : gridStyle === 'dotted' ? 'dotted' : 'dashed',
        },
      }
      fragments.push({
        option: isHorizontal
          ? { xAxis: { splitLine } }
          : { yAxis: { splitLine } },
      })
    }

    const merged = mergeFragments(fragments)

    if (merged.series?.[0]) {
      merged.series[0].barCategoryGap = barCategoryGap
      // barGap controls spacing BETWEEN series within the same category — small
      // positive value gives a clean visual gap between primary and secondary bars.
      merged.series[0].barGap = '10%'
    }

    return merged
  }, [
    rows, t, selectedCat, orientation, config._expand?.expandedValue ?? null, showDataLabels, showXAxis, showYAxis,
    showGrid, gridStyle, gridColor, gradient, gradientTo, rankOpacity, highlightMax, orderBy,
    showBackground, barRadius, maxBarWidth, animEnabled, animDuration,
    labelPosition, barCategoryGap, stacked, secondaryColor, p.mid, p.start, p.text,
    config.colorScheme, config.limit, config.prefix, config.suffix,
    config.measureName, config.secondaryMeasureName, config.dataLabelColor,
  ])

  const handleClick = useCallback((params) => {
    const cat = params?.name
    if (config._onBarClick && cat != null) config._onBarClick(String(cat))
  }, [config._onBarClick])

  if (loading && !(rows && rows.length)) return <LoadingShimmer />
  if (error)   return <EmptyState error={error} />
  if (!option) return <EmptyState label={config.title || config.label} />

  return (
    <div style={{ height: '100%', overflow: 'hidden', borderRadius: 12 }}>
      <EChartsCanvas option={option} onClick={config._onBarClick ? handleClick : undefined} />
    </div>
  )
}
