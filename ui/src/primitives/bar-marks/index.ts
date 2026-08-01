import { pal, hexToRgb } from '../../appspec/shared/palettes.js'
import { fmtVal } from '../../appspec/shared/formatters.js'
import type { Primitive } from '../contract'
import type { PrimitiveFieldDef } from '../schema'
import type { BarMarksProps, RefLine } from './types'

// Config keys mirror visual.config fields read by CompactBarEcharts.
export const schema: PrimitiveFieldDef[] = [
  { key: 'barRadius',         label: 'Corner radius',        type: 'range',   default: 4,       min: 0, max: 20, step: 1, group: 'Appearance' },
  { key: 'maxBarSize',        label: 'Max bar width (px)',   type: 'range',   default: 26,      min: 8, max: 80, step: 2, group: 'Appearance' },
  { key: 'showBarBackground', label: 'Bar background',       type: 'boolean', default: true,                              group: 'Appearance' },
  { key: 'gradient',          label: 'Gradient fill',        type: 'boolean', default: false,                             group: 'Appearance' },
  { key: 'rankOpacity',       label: 'Rank opacity',         type: 'boolean', default: true,                              group: 'Appearance' },
  { key: 'highlightMax',      label: 'Highlight max bar',    type: 'boolean', default: false,                             group: 'Appearance' },
  { key: 'gridLines',         label: 'Grid lines',           type: 'boolean', default: false,                             group: 'Appearance' },
  { key: 'gridStyle',         label: 'Grid style',           type: 'select',  default: 'dashed',
    options: [{ label: 'Dashed', value: 'dashed' }, { label: 'Solid', value: 'solid' }, { label: 'Dotted', value: 'dotted' }], group: 'Appearance' },
  { key: 'stacked',           label: 'Stack series',         type: 'boolean', default: false,                             group: 'Appearance' },
  { key: 'secondaryColor',    label: 'Secondary color',      type: 'color',   default: '',                                group: 'Appearance' },
  { key: 'dataLabels',        label: 'Show labels',          type: 'boolean', default: true,                              group: 'Labels' },
  { key: 'labelPosition',     label: 'Label position',       type: 'select',  default: 'right',
    options: [{ label: 'Right', value: 'right' }, { label: 'Inside', value: 'inside' }, { label: 'Top', value: 'top' }, { label: 'Auto', value: 'auto' }], group: 'Labels' },
  { key: 'showAvgLine',       label: 'Average line',         type: 'boolean', default: false,                             group: 'Lines' },
  { key: 'avgLineColor',      label: 'Avg line color',       type: 'color',   default: '#F59E0B',                         group: 'Lines' },
  { key: 'avgLineStyle',      label: 'Avg line style',       type: 'select',  default: 'dashed',
    options: [{ label: 'Dashed', value: 'dashed' }, { label: 'Solid', value: 'solid' }, { label: 'Dotted', value: 'dotted' }], group: 'Lines' },
]

function buildGradient(startColor: string, endColor: string, horizontal: boolean) {
  const [x2, y2] = horizontal ? [1, 0] : [0, 1]
  return {
    type: 'linear' as const,
    x: 0, y: 0, x2, y2,
    colorStops: [
      { offset: 0, color: startColor },
      { offset: 1, color: endColor },
    ],
  }
}

function buildMarkLine(refLines: RefLine[], horizontal: boolean) {
  if (!refLines.length) return undefined
  return {
    silent: true,
    symbol: 'none',
    data: refLines.map(ref => ({
      ...(horizontal ? { xAxis: ref.val } : { yAxis: ref.val }),
      lineStyle: { color: ref.color, type: ref.lineStyle ?? 'dashed' as const, width: 1.5 },
      label: { show: true, formatter: ref.label, position: 'insideEndTop' as const, color: ref.color, fontSize: 10, rotate: 0 },
    })),
  }
}

// BarMarks — builds a bar series from ctx.data.rows (expects _cat / _val fields).
// Handles: per-item coloring (dim, conditional, highlightMax, rankOpacity, gradient),
// data labels, reference lines, scroll via dataZoom, animation.
export const BarMarks: Primitive<BarMarksProps> = (props, ctx) => {
  const {
    orientation = 'horizontal',
    colorScheme,
    gradient = false,
    gradientTo,
    conditionalColor = null,
    rankOpacity = true,
    highlightMax = false,
    orderBy = 'desc',
    showBackground = true,
    barRadius = 4,
    maxBarSize = 26,
    animEnabled = true,
    animDuration = 500,
    showDataLabels = true,
    labelPosition = 'right',
    dataLabelColor = 'auto',
    prefix,
    suffix,
    measureName,
    scrollThreshold = 10,
    refLines = [],
    secondaryData,
    secondaryMeasureName,
    secondaryColor,
    stacked = false,
  } = props

  const rows = ctx.data.rows as Array<{ _cat: unknown; _val: unknown }>
  const selectedCat = ctx.selection.selectedCat
  const { theme: t } = ctx

  const p = pal(colorScheme)
  const [cr, cg, cb] = hexToRgb(p.start)
  const actualGradientTo = gradientTo || p.mid || p.start
  const n = rows.length
  const maxVal = Math.max(...rows.map(r => Math.abs(Number(r._val) || 0)), 0)
  const horizontal = orientation === 'horizontal'
  const isAsc = orderBy === 'asc'

  const insideColor = dataLabelColor === 'auto' ? '#FFFFFF' : dataLabelColor
  const outsideColor = dataLabelColor === 'auto' ? t.textPrimary : dataLabelColor

  // Radius: top-right + bottom-right for horizontal, top-left + top-right for vertical
  const radius = horizontal ? [0, barRadius, barRadius, 0] : [barRadius, barRadius, 0, 0]

  const data = rows.map((row, index) => {
    const val = Number(row._val) || 0
    const hasSelection = selectedCat != null
    const isSelected = hasSelection && String(row._cat) === String(selectedCat)
    const isDimmed = hasSelection && !isSelected

    const baseColor = gradient
      ? buildGradient(p.start, actualGradientTo, horizontal)
      : `rgba(${cr},${cg},${cb},0.80)`

    let itemStyle: Record<string, unknown>
    if (isDimmed) {
      itemStyle = { color: p.start, opacity: 0.25, borderColor: t.axisLine, borderWidth: 1 }
    } else if (conditionalColor && conditionalColor.threshold != null) {
      const color = val >= conditionalColor.threshold
        ? (conditionalColor.above || p.start)
        : (conditionalColor.below || '#F43F5E')
      itemStyle = { color, borderColor: t.axisLine, borderWidth: 1 }
    } else if (highlightMax && val === maxVal) {
      itemStyle = { color: p.start, borderColor: p.start, borderWidth: 2 }
    } else if (rankOpacity) {
      const ratio = isAsc ? index / Math.max(n - 1, 1) : (n - 1 - index) / Math.max(n - 1, 1)
      const opacity = isSelected ? '1.00' : (0.35 + ratio * 0.55).toFixed(2)
      const color = gradient ? buildGradient(p.start, actualGradientTo, horizontal) : `rgba(${cr},${cg},${cb},${opacity})`
      itemStyle = { color, borderColor: t.axisLine, borderWidth: 1 }
    } else {
      itemStyle = { color: baseColor, borderColor: t.axisLine, borderWidth: 1 }
    }
    if (isSelected) {
      itemStyle = { ...itemStyle, borderColor: p.start, borderWidth: 2, opacity: 1 }
    }

    // Per-item label position for 'auto' mode
    let label: Record<string, unknown> | undefined
    if (showDataLabels && labelPosition === 'auto') {
      const isInside = maxVal > 0 && val / maxVal > 0.35
      label = {
        show: true,
        position: isInside ? 'insideRight' : 'right',
        color: isInside ? insideColor : outsideColor,
        fontSize: 10,
        fontWeight: 600,
        formatter: () => fmtVal(val, prefix, suffix),
      }
    }

    return { value: val, itemStyle, ...(label ? { label } : {}) }
  })

  // Series-level label for fixed positions (right / inside / top)
  const seriesLabel = (() => {
    if (!showDataLabels || labelPosition === 'auto') return { show: false }
    const posMap: Record<string, string> = {
      right: 'right',
      inside: 'insideRight',
      top: horizontal ? 'right' : 'top',
    }
    return {
      show: true,
      position: posMap[labelPosition] ?? 'right',
      color: labelPosition === 'inside' ? insideColor : outsideColor,
      fontSize: 10,
      fontWeight: 600,
      formatter: (params: { value: number }) => fmtVal(params.value, prefix, suffix),
    }
  })()

  const needsScroll = n >= scrollThreshold
  // Cast `orient` because ECharts types it as a strict 'horizontal' | 'vertical'
  // literal union; without the cast TS widens `horizontal ? ... : ...` to `string`.
  const dataZoom = needsScroll
    ? [{ type: 'inside' as const, orient: (horizontal ? 'vertical' : 'horizontal') as 'horizontal' | 'vertical', zoomLock: true }]
    : undefined

  const markLine = buildMarkLine(refLines, horizontal)

  // Secondary series — only when secondaryData is provided. Inherits the per-item
  // OPACITY (alpha channel) from the primary's itemStyle so rankOpacity/highlightMax
  // visual emphasis stays unified across both slices of a stacked bar; only the base
  // color differs. conditionalColor stays primary-only (semantically ambiguous when
  // there are two measures).
  const hasSecondary = Array.isArray(secondaryData) && secondaryData.length > 0
  const stackKey = (stacked && hasSecondary) ? 'total' : undefined
  const resolvedSecondaryColor = secondaryColor || p.mid || '#3B82F6'

  const secondaryDataItems = hasSecondary
    ? secondaryData!.map((rawVal, index) => {
        const val = Number(rawVal) || 0
        const primaryItem = data[index]?.itemStyle as Record<string, unknown> | undefined

        // Pull alpha from primary's resolved color (handles rgba strings and gradient objects).
        // Gradient on secondary: skip — we want a single solid color to read as a distinct slice.
        let opacity = 1
        const primaryColor = primaryItem?.color
        if (typeof primaryColor === 'string') {
          const m = primaryColor.match(/rgba?\([^,]+,[^,]+,[^,]+,([^)]+)\)/)
          if (m) opacity = parseFloat(m[1]) || 1
        }

        const [sr, sg, sb] = hexToRgb(resolvedSecondaryColor)
        return {
          value: val,
          itemStyle: {
            color: `rgba(${sr},${sg},${sb},${opacity})`,
            borderColor: primaryItem?.borderColor || t.axisLine,
            borderWidth: primaryItem?.borderWidth || 1,
          },
        }
      })
    : []

  // Stacked bars want the "outer" radius on the END slice (secondary in stacked mode).
  // Primary gets a flat-end radius when stacking; secondary keeps the rounded end.
  const primaryRadius  = stackKey ? (horizontal ? [0, 0, 0, 0] : [0, 0, 0, 0]) : radius
  const secondaryRadius = horizontal ? [0, barRadius, barRadius, 0] : [barRadius, barRadius, 0, 0]

  const series: Record<string, unknown> = {
    type: 'bar',
    name: measureName || 'value',
    data,
    stack: stackKey,
    barMaxWidth: maxBarSize,
    itemStyle: { borderRadius: primaryRadius },
    showBackground,
    backgroundStyle: showBackground ? { color: t.shimmerBg } : undefined,
    label: seriesLabel,
    animationDuration: animEnabled ? animDuration : 0,
    animationEasing: 'cubicOut',
    ...(markLine ? { markLine } : {}),
  }

  const seriesArr: Record<string, unknown>[] = [series]
  if (hasSecondary) {
    seriesArr.push({
      type: 'bar',
      name: secondaryMeasureName || 'secondary',
      data: secondaryDataItems,
      stack: stackKey,
      barMaxWidth: maxBarSize,
      itemStyle: { borderRadius: secondaryRadius },
      // Use the same label config as primary so both slices show value labels
      // when dataLabels is enabled. For 'right' position on stacked bars the
      // secondary label sits at the bar's outer end (total) and the primary's
      // sits inside the primary slice — readable, no overlap.
      label: seriesLabel,
      animationDuration: animEnabled ? animDuration : 0,
      animationEasing: 'cubicOut',
    })
  }

  return {
    option: {
      series: seriesArr as any,
      ...(dataZoom ? { dataZoom } : {}),
    },
  }
}
