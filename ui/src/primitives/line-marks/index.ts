import { pal } from '../../appspec/shared/palettes.js'
import { fmtAxisNumber, fmtVal } from '../../appspec/shared/formatters.js'
import type { Primitive } from '../contract'
import type { PrimitiveFieldDef } from '../schema'
import type { LineMarksProps } from './types'

export const schema: PrimitiveFieldDef[] = [
  // Shape
  { key: 'chartType',    label: 'Chart type',    type: 'select',  default: 'line',
    options: [
      { value: 'line', label: 'Line only' },
      { value: 'area', label: 'Area (line + fill)' },
    ],                                                                                                              group: 'Shape' },
  { key: 'smooth',       label: 'Smooth curve',  type: 'boolean', default: false,                                 group: 'Shape' },
  { key: 'strokeWidth',  label: 'Stroke width',  type: 'range',   default: 2.5, min: 1, max: 6,  step: 0.5,       group: 'Shape' },
  { key: 'fillOpacity',  label: 'Fill opacity',  type: 'range',   default: 0.28, min: 0, max: 1, step: 0.02,      group: 'Shape' },
  { key: 'stacked',      label: 'Stack series',  type: 'boolean', default: false,                                 group: 'Shape' },

  // Per-series color overrides — empty string falls back to scheme colors.
  { key: 'primaryColor',   label: 'Primary color',   type: 'color', default: '',                                  group: 'Colors' },
  { key: 'secondaryColor', label: 'Secondary color', type: 'color', default: '',                                  group: 'Colors' },

  // Markers
  { key: 'showDots',     label: 'Data dots',     type: 'boolean', default: true,                                  group: 'Markers' },
  { key: 'dotSize',      label: 'Dot size',      type: 'range',   default: 2.5, min: 1, max: 8,  step: 0.5,       group: 'Markers' },

  // Axes
  { key: 'showGrid',     label: 'Grid lines',    type: 'boolean', default: false,                                 group: 'Axes' },
  { key: 'showXAxis',    label: 'X axis',        type: 'boolean', default: true,                                  group: 'Axes' },
  { key: 'showYAxis',    label: 'Y axis',        type: 'boolean', default: false,                                 group: 'Axes' },
  { key: 'invertY',      label: 'Invert Y axis', type: 'boolean', default: false,                                 group: 'Axes' },

  // Reference lines
  { key: 'showAvgLine',  label: 'Average line',  type: 'boolean', default: false,                                 group: 'Reference' },
  { key: 'targetLine',   label: 'Target value',  type: 'number',  default: 0,    min: 0, max: 999999, step: 1,    group: 'Reference' },
]

// LineMarks — ECharts line series with optional area fill, optional secondary
// measure (auto-detected when rows have non-null `_val2`), optional avg/target
// reference lines via markLine, and configurable smoothing/dots.
//
// Reads `_cat` (x-axis category, expected to be pre-formatted by the wrapper),
// `_val` (primary y), and optional `_val2` (secondary y, dashed lighter line).
export const LineMarks: Primitive<LineMarksProps> = (props, ctx) => {
  const {
    colorScheme,
    chartType    = 'line',
    smooth       = false,
    strokeWidth  = 2.5,
    fillOpacity  = 0.28,
    stacked      = false,
    showDots     = true,
    dotSize      = 2.5,
    showDataLabels = false,
    showGrid     = false,
    showXAxis    = true,
    showYAxis    = false,
    invertY      = false,
    showAvgLine  = false,
    targetLine   = null,
    animEnabled  = true,
    prefix       = null,
    suffix       = null,
    measureName,
    secondaryMeasureName,
    primaryColor,
    secondaryColor,
  } = props

  const rows = ctx.data.rows as Array<{ _cat?: unknown; _val?: unknown; _val2?: unknown }>
  const { theme: t } = ctx
  const p = pal(colorScheme)

  // Resolve effective per-series colors. Empty string → fall back to scheme color.
  const primaryStroke   = primaryColor   || p.start
  const secondaryStroke = secondaryColor || p.mid || '#3B82F6'

  const isArea       = chartType === 'area'
  const hasSecondary = rows.some(r => r._val2 != null)

  const categories = rows.map(r => String(r._cat ?? ''))
  const primary    = rows.map(r => r._val == null ? null : Number(r._val))
  const secondary  = hasSecondary ? rows.map(r => r._val2 == null ? null : Number(r._val2)) : []

  // User-controlled dot visibility — no implicit row-count suppression.
  // Dense series (hundreds of points) may look noisy with dots, but that's
  // a deliberate user choice via the toggle, not the primitive's call.
  const dotsVisible = showDots

  // markLine builders for avg + target reference lines on the primary series.
  const validVals = primary.filter((v): v is number => typeof v === 'number' && !isNaN(v))
  const avg = validVals.length > 0 ? validVals.reduce((s, v) => s + v, 0) / validVals.length : 0
  const markLineData: any[] = []
  if (showAvgLine && validVals.length > 0) {
    markLineData.push({
      yAxis: avg,
      label: { show: true, position: 'end', formatter: `Avg ${fmtVal(avg, prefix, suffix)}`, color: '#F59E0B', fontSize: 9 },
      lineStyle: { color: '#F59E0B', type: 'dashed', width: 1.5 },
    })
  }
  if (typeof targetLine === 'number' && targetLine > 0) {
    markLineData.push({
      yAxis: targetLine,
      label: { show: true, position: 'end', formatter: `Target ${fmtVal(targetLine, prefix, suffix)}`, color: '#F43F5E', fontSize: 9 },
      lineStyle: { color: '#F43F5E', type: 'dashed', width: 1.5 },
    })
  }

  const buildMarkLine = () => markLineData.length > 0
    ? { silent: true, symbol: 'none', data: markLineData }
    : { silent: true, symbol: 'none', data: [] }

  // Stacking applies only when there's a secondary series to stack against.
  // When `stack` is set on a series, ECharts accumulates values along its sibling
  // series sharing the same stack name — for stacked area, both series carry
  // `stack: 'total'`. Solo line/area visuals leave stack undefined (no-op).
  const stackKey = (stacked && hasSecondary) ? 'total' : undefined

  const series: any[] = [
    {
      type: 'line',
      name: measureName || 'Value',
      data: primary,
      smooth,
      stack: stackKey,
      lineStyle: { color: primaryStroke, width: strokeWidth },
      itemStyle: { color: primaryStroke },
      symbol: dotsVisible ? 'circle' : 'none',
      symbolSize: dotSize * 2,                     // ECharts symbolSize is diameter; dotSize is radius
      label: {
        show: showDataLabels,
        position: 'top',
        formatter: (params: any) => fmtVal(params.value, prefix, suffix),
        color: t.textMuted,
        fontSize: 9,
        distance: 8,
      },
      areaStyle: isArea ? {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0,    color: `${primaryStroke}${Math.round(fillOpacity * 255).toString(16).padStart(2, '0')}` },
            { offset: 0.92, color: `${primaryStroke}00` },
          ],
        },
      } : undefined,
      markLine: buildMarkLine(),
      animation: animEnabled,
    },
  ]

  if (hasSecondary) {
    series.push({
      type: 'line',
      name: secondaryMeasureName || 'Secondary',
      data: secondary,
      smooth,
      stack: stackKey,
      // When stacked, secondary becomes a solid line (not dashed) — dashed strokes
      // on stacked areas read as "this is auxiliary" which is misleading once the
      // values cumulate. Solid stroke matches PBI/typical stacked-area conventions.
      lineStyle: stackKey
        ? { color: secondaryStroke, width: strokeWidth * 0.8 }
        : { color: secondaryStroke, width: strokeWidth * 0.8, type: 'dashed' },
      itemStyle: { color: secondaryStroke },
      symbol: 'none',
      areaStyle: isArea ? {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0,    color: `${secondaryStroke}${Math.round(fillOpacity * 0.6 * 255).toString(16).padStart(2, '0')}` },
            { offset: 0.92, color: `${secondaryStroke}00` },
          ],
        },
      } : undefined,
      animation: animEnabled,
    })
  }

  const axisLabelStyle = { color: t.textMuted, fontSize: 9 }
  const gridStroke = t.gridStroke

  return {
    option: {
      animation: animEnabled,
      grid: {
        top: 8,
        // Right margin large enough to fit a long month/category label (e.g. "September"
        // is ~60-70px at 9px font). containLabel auto-fits but for category axes with
        // boundaryGap:false the edge label often pokes past the grid — this explicit
        // padding prevents truncation in the worst case.
        right: 60,
        bottom: showXAxis ? 28 : 8,
        left: showYAxis ? 8 : 4,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: categories,
        show: showXAxis,
        boundaryGap: false,                        // line should start at axis edge
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { ...axisLabelStyle, hideOverlap: true },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        show: showYAxis,
        // `inverse: true` flips the axis so the smallest value is at top — used by
        // bump charts where _val is a rank (1 = best should sit at the top).
        inverse: invertY,
        splitLine: { show: showGrid, lineStyle: { color: gridStroke, type: 'dashed' } },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { ...axisLabelStyle, formatter: fmtAxisNumber, width: 36 },
      },
      // Scroll/zoom via mouse wheel + drag for dense time-series. Inside-type
      // means it activates inside the chart area (no separate slider bar — keeps
      // the visual clean and the drawable area maximal).
      dataZoom: rows.length > 30 ? [{
        type: 'inside',
        xAxisIndex: 0,
        zoomLock: false,
        // Start with 100% range visible; user can zoom in by scroll/drag.
        start: 0,
        end: 100,
      }] : [],
      tooltip: {
        show: true,
        trigger: 'axis',
        backgroundColor: t.echartsTooltipBg,
        borderColor: t.echartsTooltipBorder,
        textStyle: { color: t.echartsTooltipText, fontSize: 12 },
        formatter: (params: any) => {
          const arr = Array.isArray(params) ? params : [params]
          const cat = arr[0]?.name || ''
          const lines = arr.map((s) => `${s.marker} ${s.seriesName}: ${fmtVal(s.value, prefix, suffix)}`).join('<br/>')
          return cat ? `${cat}<br/>${lines}` : lines
        },
      },
      series,
    },
  }
}
