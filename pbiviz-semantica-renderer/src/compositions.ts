import { barValueDomain } from './primitives/bar-marks/domain'
// compositions.ts — pure-TS composition layer for the .pbiviz renderer.
//
// Mirrors per-visual composition logic from ui/src/appspec/visuals/Compact*Echarts.jsx
// without React/JSX. Each branch builds a minimal PrimitiveContext, calls the same
// primitives via mergeFragments, returns the merged ECharts option.
//
// React-only features (axis-switch pills, drag handles, click handlers, ResizeObserver-
// driven dims) are intentionally omitted — Phase 5.3+ concerns.

import {
  mergeFragments, CartesianFrame, CategoricalAxis, LinearAxis, BarMarks, LineMarks,
  PieMarks, PointMarks, TreemapMarks, RadarMarks, GaugeMarks, Tooltip, Legend,
  PrimitiveContext,
} from './primitives/index'
// fmtVal is mirrored into the pbiviz tree by scripts/copy-primitives.js (same file
// the primitives import). Used by the hand-built slope/lollipop options below.
import { fmtVal } from './appspec/shared/formatters.js'

// Inlined from ui/src/appspec/shared/formatters.js — pbiviz can't depend on ui/.
const BAR_SCROLL_THRESHOLD = 12

// Mirror of MULTI_COLORS in ui/src/appspec/shared/palettes.js — per-category line
// colors for the slope chart (kept inline to match this file's self-contained style).
const MULTI_COLORS = ['#14B8A6', '#3B82F6', '#A855F7', '#F59E0B', '#22C55E', '#F43F5E']

// Minimal pal() — only keys read by bar/stacked/grouped paths (start, mid, text).
const PALETTES: Record<string, { start: string; mid: string; text: string }> = {
  teal:   { start: '#14B8A6', mid: '#2DD4BF', text: '#14B8A6' },
  blue:   { start: '#3B82F6', mid: '#60A5FA', text: '#3B82F6' },
  gold:   { start: '#F59E0B', mid: '#FBBF24', text: '#F59E0B' },
  green:  { start: '#22C55E', mid: '#4ADE80', text: '#22C55E' },
  purple: { start: '#A855F7', mid: '#C084FC', text: '#A855F7' },
  violet: { start: '#8B5CF6', mid: '#A78BFA', text: '#8B5CF6' },
  rose:   { start: '#F43F5E', mid: '#FB7185', text: '#F43F5E' },
  red:    { start: '#EF4444', mid: '#F87171', text: '#EF4444' },
  orange: { start: '#F97316', mid: '#FB923C', text: '#F97316' },
  amber:  { start: '#F59E0B', mid: '#FCD34D', text: '#F59E0B' },
}
const HEX_RE = /^#([0-9a-fA-F]{3}){1,2}$/
function pal(scheme: any): { start: string; mid: string; text: string } {
  if (typeof scheme === 'string' && HEX_RE.test(scheme)) {
    const h = scheme.replace('#', '').padEnd(6, '0')
    const rgb = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) || 0)
    const lift = (c: number) => Math.min(255, Math.round(c + (255 - c) * 0.22))
    const mid = '#' + rgb.map(c => lift(c).toString(16).padStart(2, '0')).join('')
    return { start: scheme, mid, text: scheme }
  }
  return PALETTES[scheme] || PALETTES.teal
}

type Row = { _cat?: unknown; _val?: unknown; _val2?: unknown; _val3?: unknown }

function makeCtx(rows: Row[], theme: any): PrimitiveContext {
  return {
    data: { fields: [], rows: rows as Record<string, unknown>[] },
    encoding: {},
    theme,
    selection: { selectedCat: null },
    dimensions: { width: 0, height: 0 },
  }
}

const animDur = (c: any): number =>
  c.animationDuration === 'fast' ? 300 : c.animationDuration === 'slow' ? 800 : 500

// ─── bar / stacked_bar / grouped_bar ────────────────────────────────────────
function composeBarLike(rows: Row[], config: any, theme: any, variant: 'bar' | 'stacked_bar' | 'grouped_bar'): any {
  const p = pal(config.colorScheme)
  const isStacked = variant === 'stacked_bar'
  const isGrouped = variant === 'grouped_bar'
  const orientation    = config.orientation    || (isGrouped ? 'vertical' : 'horizontal')
  const barRadius      = config.barRadius      ?? (isGrouped ? 3 : 4)
  const barCategoryGap = config.barCategoryGap || (isGrouped ? '20%' : '15%')
  const showGrid       = config.gridLines      ?? isGrouped
  const showDataLabels = config.dataLabels     ?? !isGrouped
  const labelPosition  = config.labelPosition  || (isGrouped ? 'top' : 'right')
  const showXAxis      = config.showXAxis      ?? true
  const showYAxis      = config.showYAxis      ?? true
  const showBackground = config.showBarBackground ?? !isGrouped
  const rankOpacity    = config.rankOpacity    ?? !isGrouped
  const maxBarWidth    = config.maxBarSize     ?? (isGrouped ? 24 : 26)
  const animEnabled    = config.animations !== false && config.animationEnabled !== false
  const isHorizontal   = orientation === 'horizontal'
  const stacked        = isStacked ? (config.stacked ?? true) : isGrouped ? (config.stacked ?? false) : false
  const secondaryColor = config.secondaryColor || p.mid || '#3B82F6'

  const chartRows = (rows || [])
    .filter(r => r?._cat != null && r?._val != null)
    .slice(0, config.limit || 50)
  if (!chartRows.length) return null

  const categories    = chartRows.map(r => String(r._cat))
  const primaryVals   = chartRows.map(r => Number(r._val) || 0)
  // hasSecondary: true when secondary data is actually present in rows,
  // regardless of variant. A plain 'bar' with a second measure auto-groups.
  const hasSecondary  = chartRows.some(r => r._val2 != null)
  const isMulti       = isStacked || isGrouped || hasSecondary
  const secondaryVals = hasSecondary ? chartRows.map(r => Number(r._val2) || 0) : null
  const { dataMin, dataMax } = barValueDomain(primaryVals, secondaryVals, stacked)

  const refLines: any[] = []
  if (variant === 'bar') {
    if (config.showAvgLine) {
      refLines.push({
        val: primaryVals.reduce((a, b) => a + b, 0) / (primaryVals.length || 1),
        color: config.avgLineColor || '#F59E0B', label: 'Avg',
        lineStyle: config.avgLineStyle || 'dashed',
      })
    }
    if (config.targetLine != null) refLines.push({ val: config.targetLine, color: '#F43F5E', label: 'Target', lineStyle: 'dashed' })
  }

  const ctx = makeCtx(chartRows, theme)
  // Outside top labels need clearance for every vertical bar variant, not
  // only grouped bars. Keep the data domain unchanged.
  const margin = { left: 4, right: showDataLabels ? 60 : 16,
    top: (showDataLabels && labelPosition === 'top' && !isHorizontal) ? 28 : 4, bottom: 4 }


  const barProps: any = {
    orientation, colorScheme: config.colorScheme,
    gradient: config.gradient ?? false, gradientTo: config.gradientTo || p.mid || p.start,
    rankOpacity, highlightMax: config.highlightMax ?? false, orderBy: config.orderBy || 'desc',
    showBackground, barRadius, maxBarSize: maxBarWidth, animEnabled, animDuration: animDur(config),
    showDataLabels, labelPosition, dataLabelColor: config.dataLabelColor || 'auto',
    prefix: config.prefix, suffix: config.suffix, measureName: config.measureName,
    scrollThreshold: BAR_SCROLL_THRESHOLD,
  }
  if (variant === 'bar') {
    barProps.conditionalColor = config.conditionalColor || null
    barProps.refLines = refLines
  }
  if (isMulti) {
    barProps.secondaryData = secondaryVals || undefined
    barProps.secondaryMeasureName = config.secondaryMeasureName
    barProps.secondaryColor = secondaryColor
    barProps.stacked = stacked
  } else {
    // Per-category colours apply to single-series bar/column (parity with web canvas).
    barProps.categoryColors = config.categoryColors
  }

  const tooltipProps: any = {
    prefix: config.prefix, suffix: config.suffix, measureName: config.measureName,
    accentColor: p.text || p.start,
    // Tooltip content controls — parity with the web canvas.
    showTitle: config.tooltipShowTitle !== false,
    titleText: config.tooltipTitle || undefined,
    showName: config.tooltipShowName !== false,
    showValue: config.tooltipShowValue !== false,
    showSwatch: config.tooltipShowSwatch !== false,
  }
  if (isMulti) {
    tooltipProps.trigger = 'axis'
    tooltipProps.seriesColors = hasSecondary ? [p.start, secondaryColor] : [p.start]
  }

  const fragments: any[] = [
    CartesianFrame({ orientation, margin } as any, ctx),
    isHorizontal ? CategoricalAxis({ axis: 'y', categories, show: showYAxis } as any, ctx)
                 : CategoricalAxis({ axis: 'x', categories, show: showXAxis } as any, ctx),
    isHorizontal ? LinearAxis({ axis: 'x', dataMin, dataMax, show: showXAxis } as any, ctx)
                 : LinearAxis({ axis: 'y', dataMin, dataMax, show: showYAxis } as any, ctx),
    BarMarks(barProps, ctx),
    Tooltip(tooltipProps, ctx),
    Legend({
      show: config.showLegend !== false && isMulti && hasSecondary,
      position: config.legendPosition || 'top',
      items: hasSecondary ? [
        { name: config.measureName || 'Value', color: p.start },
        { name: config.secondaryMeasureName || 'Secondary', color: secondaryColor },
      ] : [],
      color: config.legendColor,
      fontSize: config.legendFontSize,
    } as any, ctx),
  ]
  if (showGrid) {
    const splitLine = {
      show: true,
      lineStyle: {
        color: config.gridLinesColor || theme?.gridStroke,
        type: config.gridStyle === 'solid' ? 'solid' : config.gridStyle === 'dotted' ? 'dotted' : 'dashed',
      },
    }
    fragments.push({ option: isHorizontal ? { xAxis: { splitLine } } : { yAxis: { splitLine } } })
  }

  const merged: any = mergeFragments(fragments)
  if (merged.series?.[0]) {
    merged.series[0].barCategoryGap = barCategoryGap
    if (isGrouped) merged.series[0].barGap = '10%'
  }

  return merged
}

// ─── line / area / stacked_area / bump ──────────────────────────────────────
function composeLineLike(rows: Row[], config: any, theme: any, visualType: string): any {
  if (!rows?.length) return null
  let cfg: any = config
  if (visualType === 'stacked_area') cfg = { chartType: 'area', stacked: true, ...config }
  else if (visualType === 'bump') cfg = {
    ...config,
    chartType: config.chartType ?? 'line',
    invertY:   config.invertY   ?? true,
    showDots:  config.showDots  ?? true,
    showYAxis: config.showYAxis ?? true,
    smooth:    config.smooth    ?? false,
  }
  const effChart = cfg.chartType || (cfg.type === 'area' || visualType === 'area' ? 'area' : 'line')
  return mergeFragments([
    LineMarks({
      colorScheme: cfg.colorScheme, chartType: effChart, stacked: cfg.stacked === true,
      smooth: cfg.smooth === true, strokeWidth: cfg.strokeWidth ?? 2.5,
      fillOpacity: cfg.fillOpacity ?? 0.28, showDots: cfg.showDots ?? true, dotSize: cfg.dotSize ?? 2.5,
      showDataLabels: cfg.dataLabels ?? false, showGrid: cfg.gridLines ?? false,
      showXAxis: cfg.showXAxis ?? true, showYAxis: cfg.showYAxis ?? false,
      invertY: cfg.invertY ?? false, showAvgLine: cfg.showAvgLine ?? false,
      targetLine: typeof cfg.targetLine === 'number' ? cfg.targetLine : null,
      animEnabled: cfg.animations !== false && cfg.animationEnabled !== false,
      prefix: cfg.prefix, suffix: cfg.suffix, measureName: cfg.measureName,
      secondaryMeasureName: cfg.secondaryMeasureName,
      primaryColor: cfg.primaryColor, secondaryColor: cfg.secondaryColor,
    } as any, makeCtx(rows, theme)),
  ])
}

// ─── donut / pie ────────────────────────────────────────────────────────────
function composeDonut(rows: Row[], config: any, theme: any, isPie: boolean): any {
  if (!rows?.length) return null
  const cfg: any = isPie ? { ...config, innerRadius: 0, showCenterText: false } : config
  return mergeFragments([
    PieMarks({
      colorScheme: cfg.colorScheme,
      innerRadius: cfg.innerRadius ?? 52, outerRadius: cfg.outerRadius ?? 85,
      paddingAngle: cfg.paddingAngle ?? 2, cornerRadius: cfg.cornerRadius ?? 0,
      customColors: cfg.customColors, strokeColor: cfg.strokeColor ?? 'transparent',
      strokeWidth: cfg.strokeWidth ?? 0,
      showLegend: cfg.showLegend ?? true, legendPosition: cfg.legendPosition ?? 'right',
      legendColor: cfg.legendColor, legendFontSize: cfg.legendFontSize,
      maxLegendItems: cfg.maxLegendItems ?? 6,
      showLabels: cfg.showLabels ?? false, labelStyle: cfg.labelStyle ?? 'percent',
      showCenterText: cfg.showCenterText ?? true, centerColor: cfg.centerColor || undefined,
      centerFontSize: cfg.centerFontSize ?? (rows.length === 1 && rows[0]._cat === undefined ? (cfg.valueFontSize || 32) : 22),
      maxValue: cfg.maxValue ?? 100,
      animEnabled: cfg.animationEnabled !== false,
      prefix: cfg.prefix, suffix: cfg.suffix,
      categoryColors: cfg.categoryColors,
    } as any, makeCtx(rows, theme)),
  ])
}

// ─── scatter / bubble ───────────────────────────────────────────────────────
function composeScatter(rows: Row[], config: any, theme: any, isBubble: boolean): any {
  if (!rows?.length) return null
  const cfg: any = isBubble ? { dotSize: 8, dotSizeMax: 200, ...config } : config
  return mergeFragments([
    PointMarks({
      colorScheme: cfg.colorScheme,
      dotSize: cfg.dotSize ?? 16, dotSizeMax: cfg.dotSizeMax ?? 100,
      fillOpacity: cfg.fillOpacity ?? 0.75,
      showGrid: cfg.gridLines ?? true, showXAxis: cfg.showXAxis ?? true, showYAxis: cfg.showYAxis ?? true,
      showLabels: cfg.showLabels ?? false, animEnabled: cfg.animationEnabled !== false,
      xLabel: cfg.measureName, yLabel: cfg.secondaryMeasureName,
    } as any, makeCtx(rows, theme)),
  ])
}

// ─── treemap / radar / gauge ────────────────────────────────────────────────
function composeTreemap(rows: Row[], config: any, theme: any): any {
  if (!rows?.length) return null
  return mergeFragments([
    TreemapMarks({
      colorScheme: config.colorScheme,
      showLabels: config.showLabels ?? true, showValues: config.showValues ?? false,
      colorMode: config.colorMode ?? 'single',
      borderColor: config.borderColor ?? theme?.canvasBg,
      borderWidth: config.borderWidth ?? 1, borderRadius: config.borderRadius ?? 0,
      customColors: config.customColors, animEnabled: config.animationEnabled !== false,
      prefix: config.prefix, suffix: config.suffix,
      labelColor: config.labelColor ?? '#FFFFFF', valueColor: config.valueColor ?? '#94A3B8',
      labelFontSize: config.labelFontSize ?? 10, valueFontSize: config.valueFontSize ?? 9,
      padding: config.padding ?? 0,
      categoryColors: config.categoryColors,
    } as any, makeCtx(rows, theme)),
  ])
}

function composeRadar(rows: Row[], config: any, theme: any): any {
  const chartRows = (rows || []).filter(r => r?._cat != null && r?._val != null)
  if (!chartRows.length) return null
  return mergeFragments([
    RadarMarks({
      colorScheme: config.colorScheme,
      seriesName: config.title || config.label || '',
      fillOpacity: config.fillOpacity ?? 0.22, strokeWidth: config.strokeWidth ?? 2,
      showDots: config.showDots ?? false, radarRadius: config.radarRadius ?? 68,
      labelFontSize: config.labelFontSize ?? 9,
      prefix: config.prefix, suffix: config.suffix,
      animEnabled: config.animationEnabled !== false,
    } as any, makeCtx(chartRows, theme)),
  ])
}

function composeGauge(rows: Row[], config: any, theme: any): any {
  return mergeFragments([
    GaugeMarks({
      colorScheme: config.colorScheme,
      min: config.minValue ?? 0, max: config.maxValue ?? 100,
      arcWidth: config.arcWidth ?? 10, gaugeSize: config.gaugeSize ?? 80,
      showMinMax: config.showMinMax ?? false, colorZones: config.colorZones ?? null,
      valueFontSize: config.valueFontSize ?? 15,
      prefix: config.prefix, suffix: config.suffix,
      animEnabled: config.animationEnabled !== false,
    } as any, makeCtx(rows || [], theme)),
  ])
}

// ─── slope ──────────────────────────────────────────────────────────────────
// Mirror of ui/src/appspec/visuals/CompactSlopeEcharts.jsx. One line per category
// joining two x-positions (left measure _val → right measure _val2). Needs both
// measures; returns null otherwise (caller renders an empty state).
function composeSlope(rows: Row[], config: any, theme: any): any {
  const items = (rows || [])
    .filter(r => r?._cat != null && r?._val != null && r?._val2 != null)
    .slice(0, config.limit || 12)
  if (!items.length) return null

  const colors     = config.customColors || MULTI_COLORS
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
      labelLayout: { hideOverlap: true },
      endLabel: showLegend
        ? { show: true, formatter: () => String(r._cat).slice(0, 18), color: theme?.textMuted, fontSize: 9, fontWeight: 600, distance: 4 }
        : { show: false },
      label: showValues
        ? { show: true, position: 'top', formatter: (pp: any) => fmtVal(pp.value, config.prefix, config.suffix), color, fontSize: 9, fontWeight: 600 }
        : { show: false },
    }
  })

  return {
    animation: config.animations !== false && config.animationEnabled !== false,
    grid: { left: 24, right: showLegend ? 96 : 32, top: 26, bottom: 22 },
    xAxis: {
      type: 'category', data: [leftLabel, rightLabel], boundaryGap: false,
      axisLabel: { color: theme?.textMuted, fontSize: 10, fontWeight: 600 },
      axisLine: { lineStyle: { color: theme?.gridStroke } }, axisTick: { show: false },
    },
    yAxis: { type: 'value', show: false, scale: true },
    series,
  }
}

// ─── lollipop ─────────────────────────────────────────────────────────────────
// Mirror of ui/src/appspec/visuals/CompactLollipopEcharts.jsx. Thin bar stem +
// scatter dot per value. Single measure (_val).
function composeLollipop(rows: Row[], config: any, theme: any): any {
  const chartRows = (rows || [])
    .filter(r => r?._cat != null && r?._val != null)
    .slice(0, config.limit || 20)
  if (!chartRows.length) return null

  const p           = pal(config.colorScheme)
  const orientation = config.orientation || 'horizontal'
  const isH         = orientation === 'horizontal'
  const dotSize     = config.dotSize ?? 6
  const lineWidth   = config.lineWidth ?? 2
  const showLabels  = config.dataLabels ?? true
  const showGrid    = config.gridLines ?? false
  const color       = p.start

  const categories = chartRows.map(r => String(r._cat))
  const vals       = chartRows.map(r => Number(r._val) || 0)
  const dataMin    = Math.min(0, ...vals)
  const dataMax    = Math.max(0, ...vals)

  const catAxis: any = {
    type: 'category', data: categories, inverse: isH,
    axisLabel: { color: theme?.textMuted, fontSize: 9, ...(isH ? {} : { interval: 0, overflow: 'truncate', width: 70 }) },
    axisLine: { lineStyle: { color: theme?.gridStroke } }, axisTick: { show: false },
  }
  const valAxis: any = {
    type: 'value', min: dataMin, max: dataMax,
    axisLabel: { show: false }, axisLine: { show: false }, axisTick: { show: false },
    splitLine: showGrid ? { show: true, lineStyle: { color: theme?.gridStroke, type: 'dashed' } } : { show: false },
  }
  const scatterData = chartRows.map((r, i) => (isH ? [vals[i], categories[i]] : [categories[i], vals[i]]))

  return {
    animation: config.animations !== false && config.animationEnabled !== false,
    grid: { left: 8, right: isH ? 44 : 12, top: 14, bottom: isH ? 8 : 28, containLabel: true },
    xAxis: isH ? valAxis : catAxis,
    yAxis: isH ? catAxis : valAxis,
    series: [
      { type: 'bar', data: vals, barWidth: lineWidth, itemStyle: { color, opacity: 0.55 }, z: 1, silent: true },
      {
        type: 'scatter', data: scatterData, symbolSize: dotSize * 2,
        itemStyle: { color, shadowBlur: 6, shadowColor: `${color}66` }, z: 2,
        label: showLabels
          ? { show: true, position: isH ? 'right' : 'top', formatter: (pp: any) => fmtVal(isH ? pp.value[0] : pp.value[1], config.prefix, config.suffix), color: p.text || color, fontSize: 9, fontWeight: 600 }
          : { show: false },
      },
    ],
  }
}

// ─── public dispatch ────────────────────────────────────────────────────────
export function composeOption(
  visualType: string, rows: Row[], config: Record<string, any>, theme: any,
): any {
  const t = visualType || 'bar'
  switch (t) {
    case 'bar':         return composeBarLike(rows, config, theme, 'bar')
    case 'column':      return composeBarLike(rows, { ...config, orientation: config.orientation || 'vertical', labelPosition: config.labelPosition || 'top' }, theme, 'bar')
    case 'stacked_bar': return composeBarLike(rows, config, theme, 'stacked_bar')
    case 'grouped_bar': return composeBarLike(rows, config, theme, 'grouped_bar')
    case 'line': case 'area': case 'stacked_area': case 'bump':
                        return composeLineLike(rows, config, theme, t)
    case 'donut':       return composeDonut(rows, config, theme, false)
    case 'pie':         return composeDonut(rows, config, theme, true)
    case 'scatter':     return composeScatter(rows, config, theme, false)
    case 'bubble':      return composeScatter(rows, config, theme, true)
    case 'treemap':     return composeTreemap(rows, config, theme)
    case 'radar':       return composeRadar(rows, config, theme)
    case 'gauge':       return composeGauge(rows, config, theme)
    case 'slope':       return composeSlope(rows, config, theme)
    case 'lollipop':    return composeLollipop(rows, config, theme)
    default:            return composeBarLike(rows, config, theme, 'bar')
  }
}
