import React, { useMemo, useCallback } from 'react'
import { pal, gridLineColor } from '../shared/palettes.js'
import { BAR_SCROLL_THRESHOLD } from '../shared/formatters.js'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import EChartsCanvas from '../shared/EChartsCanvas.jsx'
import { applyTooltipConfig } from '../shared/applyTooltipConfig.js'
import getThemeTokens from '../getThemeTokens'
import { buildExpandBarOption } from '../shared/expandBarOption.js'
import {
  mergeFragments,
  CartesianFrame,
  CategoricalAxis,
  LinearAxis,
  BarMarks,
  Tooltip,
  Legend,
} from '../../primitives/index'

// ECharts bar visual. Same prop contract as CompactBarRecharts: { rows, config, loading, error }.
// Built entirely from primitives via mergeFragments. All ECharts-params → Semantica-contract
// translation happens here; EChartsCanvas stays dumb and forwards raw params.
export default function CompactBarEcharts({ rows, config, loading, error }) {
  const p = pal(config.colorScheme)
  const t = config._T || getThemeTokens('dark')

  // Extract config fields (mirrors CompactBarRecharts 1-to-1)
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
  const showAvgLine    = config.showAvgLine    ?? false
  const avgLineColor   = config.avgLineColor   || '#F59E0B'
  const avgLineStyle   = config.avgLineStyle   || 'dashed'
  const targetLine     = config.targetLine     ?? null
  const conditionalColor = config.conditionalColor || null
  const animDuration   = config.animationDuration === 'fast' ? 300 : config.animationDuration === 'slow' ? 800 : 500
  const animEnabled    = config.animations !== false && config.animationEnabled !== false
  const maxBarWidth    = config.maxBarSize     ?? 26
  const orderBy        = config.orderBy        || 'desc'
  const isHorizontal   = orientation === 'horizontal'
  const selectedCat    = config._selectedCat   ?? null

  // All hooks before any conditional return (React rules of hooks)
  const option = useMemo(() => {
    const chartRows = [...(rows || [])]
      .filter(r => r?._cat != null && r?._val != null)
      // The query already applies data.limit (the "Row limit" control); this is just a
      // safety cap. Keep it high so a Row limit above 50 isn't silently truncated here.
      .slice(0, config.limit || 1000)

    if (!chartRows.length) return null

    // Expand-in-place (drill pattern 02): the renderer shaped `rows` to mixed grain
    // (expanded parent's children beside greyed siblings). One shared builder so
    // bar/column/grouped/stacked all morph identically. Orientation-aware.
    if (config._expand) {
      return buildExpandBarOption(chartRows, {
        isHorizontal, palStart: p.start, t, maxBarWidth, showDataLabels,
        expandedValue: config._expand.expandedValue,
      })
    }

    const categories = chartRows.map(r => String(r._cat))
    const vals       = chartRows.map(r => Number(r._val) || 0)
    const dataMin    = Math.min(...vals, 0)
    const dataMax    = Math.max(...vals, 0)
    const avgVal     = vals.reduce((a, b) => a + b, 0) / (vals.length || 1)

    const refLines = []
    if (showAvgLine) refLines.push({ val: avgVal, color: avgLineColor, label: 'Avg', lineStyle: avgLineStyle })
    if (targetLine != null) refLines.push({ val: targetLine, color: '#F43F5E', label: 'Target', lineStyle: 'dashed' })

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
        margin: { left: 4, right: showDataLabels ? 60 : 16, top: showDataLabels && labelPosition === 'top' ? 20 : 4, bottom: 4 },
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
        conditionalColor,
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
        refLines,
        categoryColors: config.categoryColors,
      }, ctx),

      Tooltip({
        prefix: config.prefix,
        suffix: config.suffix,
        measureName: config.measureName,
        accentColor: p.text || p.start,
        showTitle: config.tooltipShowTitle !== false,
        titleText: config.tooltipTitle || undefined,
        showName: config.tooltipShowName !== false,
        showValue: config.tooltipShowValue !== false,
        showSwatch: config.tooltipShowSwatch !== false,
      }, ctx),

      Legend({ show: false }, ctx),
    ]

    // Ad-hoc grid lines fragment (not a primitive — single-consumer config)
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

    // Apply series-level config not expressible via primitives
    if (merged.series?.[0]) {
      merged.series[0].barCategoryGap = barCategoryGap
    }

    return merged
  }, [
    rows,
    t,
    selectedCat,
    orientation,
    config._expand?.expandedValue ?? null,
    showDataLabels,
    showXAxis,
    showYAxis,
    showGrid,
    gridStyle,
    gridColor,
    gradient,
    gradientTo,
    rankOpacity,
    highlightMax,
    orderBy,
    showBackground,
    barRadius,
    maxBarWidth,
    animEnabled,
    animDuration,
    labelPosition,
    showAvgLine,
    avgLineColor,
    avgLineStyle,
    targetLine,
    barCategoryGap,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(conditionalColor),
    config.colorScheme,
    config.limit,
    config.prefix,
    config.suffix,
    config.measureName,
    config.dataLabelColor,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(config.categoryColors),
  ])

  const handleClick = useCallback((params) => {
    if (!config._onBarClick) return
    // Bar click: params.name is the category label (from axis data, matched by index)
    const cat = params?.name
    if (cat != null) config._onBarClick(String(cat), { ctrlKey: !!params?.event?.event?.ctrlKey, metaKey: !!params?.event?.event?.metaKey })
  }, [config._onBarClick])

  // Keep the chart mounted during a re-query if we already have data — otherwise
  // the shimmer disposes/recreates the ECharts instance and the expand-in-place
  // morph (universalTransition) can't play in view/present mode.
  if (loading && !(rows && rows.length)) return <LoadingShimmer />
  if (error)   return <EmptyState error={error} />
  if (!option) return <EmptyState label={config.title || config.label} />

  return (
    <div style={{ height: '100%', overflow: 'hidden', borderRadius: 12 }}>
      <EChartsCanvas config={config}
        option={applyTooltipConfig(option, config)}
        onClick={config._onBarClick ? handleClick : undefined}
      />
    </div>
  )
}
