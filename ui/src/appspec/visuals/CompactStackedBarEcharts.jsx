import { barValueDomain } from '../../primitives/bar-marks/domain'
import React, { useMemo, useCallback } from 'react'
import { pal, gridLineColor } from '../shared/palettes.js'
import { BAR_SCROLL_THRESHOLD } from '../shared/formatters.js'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import EChartsCanvas from '../shared/EChartsCanvas.jsx'
import { applyTooltipConfig } from '../shared/applyTooltipConfig.js'
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

// Stacked bar — two measures stacked into a single horizontal bar per category.
// Same fragment composition as CompactBarEcharts; the difference is BarMarks
// receives `secondaryData` and `stacked: true` so it emits a 2nd series with
// `stack: 'total'`. Per-bar opacity (rankOpacity / highlightMax border) is
// shared across both slices via BarMarks' internal logic.
export default function CompactStackedBarEcharts({ rows, config, loading, error }) {
  const p = pal(config.colorScheme)
  const t = config._T || getThemeTokens('dark')

  const orientation    = config.orientation    || 'horizontal'
  const barRadius      = config.barRadius      ?? 4
  const barCategoryGap = config.barCategoryGap || '15%'
  const gradient       = config.gradient       ?? false
  const gradientTo     = config.gradientTo     || p.mid || p.start
  const showGrid       = config.gridLines      ?? false
  const gridStyle      = config.gridStyle      || 'dashed'
  const gridColor      = gridLineColor(config, t.gridStrokeOn)
  const showDataLabels = config.dataLabels     ?? true
  const labelPosition  = config.labelPosition  || 'right'
  const showXAxis      = config.showXAxis      ?? true
  const showYAxis      = config.showYAxis      ?? true
  const showBackground = config.showBarBackground ?? true
  const rankOpacity    = config.rankOpacity    ?? true
  const highlightMax   = config.highlightMax   ?? false
  const animDuration   = config.animationDuration === 'fast' ? 300 : config.animationDuration === 'slow' ? 800 : 500
  const animEnabled    = config.animations !== false && config.animationEnabled !== false
  const maxBarWidth    = config.maxBarSize     ?? 26
  const orderBy        = config.orderBy        || 'desc'
  const isHorizontal   = orientation === 'horizontal'
  const selectedCat    = config._selectedCat   ?? null

  // Stacked-bar-specific defaults
  const stacked        = config.stacked        ?? true                    // default ON for stacked_bar visual type
  const secondaryColor = config.secondaryColor || p.mid || '#3B82F6'

  const option = useMemo(() => {
    const chartRows = [...(rows || [])]
      .filter(r => r?._cat != null && r?._val != null)
      .slice(0, config.limit || 50)

    if (!chartRows.length) return null

    // Expand-in-place (drill pattern 02): while drilled, a stacked bar collapses to
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
    const { dataMin, dataMax } = barValueDomain(primaryVals, secondaryVals, stacked)

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
        margin: { left: 4, right: showDataLabels ? 60 : 16, top: 4, bottom: 4 },
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
        stacked,
      }, ctx),

      Tooltip({
        // 'axis' trigger groups both series at the hover y-position into one tooltip
        // — the tooltip primitive iterates params and renders a row per series so
        // both measure names show up, not just the primary.
        trigger: 'axis',
        prefix: config.prefix,
        suffix: config.suffix,
        measureName: config.measureName,
        accentColor: p.text || p.start,
        // Explicit base colors so the tooltip swatches stay full-alpha and match
        // their respective series, rather than fading with rankOpacity.
        seriesColors: hasSecondary ? [p.start, secondaryColor] : [p.start],
        showTitle: config.tooltipShowTitle !== false,
        titleText: config.tooltipTitle || undefined,
        showName: config.tooltipShowName !== false,
        showValue: config.tooltipShowValue !== false,
        showSwatch: config.tooltipShowSwatch !== false,
      }, ctx),

      // Native ECharts legend — useful for stacked bars so users can match colours
      // to measure names. Uses the two measure names + their series colours.
      Legend({
        show: config.showLegend !== false && hasSecondary,
        position: config.legendPosition || 'top',
        items: [
          { name: config.measureName || 'Value', color: p.start },
          { name: config.secondaryMeasureName || 'Secondary', color: secondaryColor },
        ],
        color: config.legendColor,
        fontSize: config.legendFontSize,
      }, ctx),
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
    }

    return merged
  }, [
    rows, t, selectedCat, orientation, config._expand?.expandedValue ?? null, showDataLabels, showXAxis, showYAxis,
    showGrid, gridStyle, gridColor, gradient, gradientTo, rankOpacity, highlightMax, orderBy,
    showBackground, barRadius, maxBarWidth, animEnabled, animDuration,
    labelPosition, barCategoryGap, stacked, secondaryColor, p.mid, p.start, p.text,
    config.colorScheme, config.limit, config.prefix, config.suffix,
    config.measureName, config.secondaryMeasureName, config.dataLabelColor,
    config.showLegend, config.legendPosition, config.legendColor, config.legendFontSize,
  ])

  const handleClick = useCallback((params) => {
    const cat = params?.name
    if (config._onBarClick && cat != null) config._onBarClick(String(cat), { ctrlKey: !!params?.event?.event?.ctrlKey, metaKey: !!params?.event?.event?.metaKey })
  }, [config._onBarClick])

  if (loading && !(rows && rows.length)) return <LoadingShimmer />
  if (error)   return <EmptyState error={error} />
  if (!option) return <EmptyState label={config.title || config.label} />

  return (
    <div style={{ height: '100%', overflow: 'hidden', borderRadius: 12 }}>
      <EChartsCanvas config={config} option={applyTooltipConfig(option, config)} onClick={config._onBarClick ? handleClick : undefined} />
    </div>
  )
}
