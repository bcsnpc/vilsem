import { pal, MULTI_COLORS } from '../../shared/palettes.js'
import { fmtVal } from '../../shared/formatters.js'
import type { Primitive } from '../contract'
import type { PrimitiveFieldDef } from '../schema'
import type { PieMarksProps } from './types'
import { escapeHtml } from '../escapeHtml'

export const schema: PrimitiveFieldDef[] = [
  // Shape
  { key: 'innerRadius',     label: 'Inner radius',  type: 'range',   default: 52, min: 0,  max: 80, step: 1,  group: 'Shape' },
  { key: 'outerRadius',     label: 'Outer radius',  type: 'range',   default: 85, min: 50, max: 95, step: 1,  group: 'Shape' },
  { key: 'paddingAngle',    label: 'Segment gap',   type: 'range',   default: 2,  min: 0,  max: 10, step: 0.5, group: 'Shape' },
  { key: 'cornerRadius',    label: 'Corner radius', type: 'range',   default: 0,  min: 0,  max: 12, step: 1,  group: 'Shape' },

  // Legend
  { key: 'showLegend',      label: 'Legend',        type: 'boolean', default: true,                            group: 'Legend' },
  { key: 'legendPosition',  label: 'Position',      type: 'select',  default: 'right',
    options: [
      { value: 'top', label: 'Above chart' },
      { value: 'right',  label: 'Right of chart' },
      { value: 'bottom', label: 'Below chart' },
    ],                                                                                                          group: 'Legend' },
  { key: 'maxLegendItems',  label: 'Max items',     type: 'number',  default: 6,  min: 1, max: 50, step: 1,    group: 'Legend' },

  // Labels (on-slice + center text)
  { key: 'showLabels',      label: 'Slice labels',  type: 'boolean', default: false,                           group: 'Labels' },
  { key: 'labelStyle',      label: 'Label style',   type: 'select',  default: 'percent',
    options: [
      { value: 'percent', label: 'Percent (35%)' },
      { value: 'value',   label: 'Raw value' },
      { value: 'name',    label: 'Category name' },
    ],                                                                                                          group: 'Labels' },
  { key: 'showCenterText',  label: 'Center text',   type: 'boolean', default: true,                            group: 'Labels' },
  { key: 'centerFontSize',  label: 'Center size',   type: 'range',   default: 22, min: 12, max: 48, step: 1,   group: 'Labels' },
  { key: 'centerColor',     label: 'Center color',  type: 'color',   default: '',                              group: 'Labels' },
]

// PieMarks — ECharts pie/donut series with two modes:
//   1. Scalar donut radial progress (one row without a category): renders a 2-segment
//      pie acting as a circular progress arc — filled portion = value/maxValue,
//      remainder rendered with a faint background color. Center text shows the value.
//   2. Categorical donut/pie: standard pie with one segment per row, including one row.
//      Pie when innerRadius=0, donut when innerRadius>0. Optional legend, on-slice
//      labels (percent/value/name), center text showing the total.
export const PieMarks: Primitive<PieMarksProps> = (props, ctx) => {
  const {
    colorScheme,
    innerRadius     = 52,
    outerRadius     = 85,
    paddingAngle    = 2,
    cornerRadius    = 0,
    customColors,
    strokeColor     = 'transparent',
    strokeWidth     = 0,
    showLegend      = true,
    legendPosition  = 'right',
    legendColor,
    legendFontSize,
    maxLegendItems  = 6,
    showLabels      = false,
    labelStyle      = 'percent',
    showCenterText  = true,
    centerColor,
    centerFontSize  = 22,
    maxValue        = 100,
    animEnabled     = true,
    prefix          = null,
    suffix          = null,
    categoryColors,
  } = props

  const rows = ctx.data.rows as Array<{ _cat?: unknown; _val?: unknown }>
  const { theme: t } = ctx
  const p = pal(colorScheme)
  const palette = (customColors && customColors.length > 0) ? customColors : MULTI_COLORS

  const isRadialProgress = rows.length === 1 && rows[0]._cat === undefined && innerRadius > 0
  const isBottomLegend   = legendPosition === 'bottom'
  const isTopLegend = legendPosition === 'top'

  // ── Mode 1: Single-measure radial progress ─────────────────────────────────
  if (isRadialProgress) {
    const value = Number(rows[0]?._val ?? 0)
    const pct = Math.min(Math.abs(value) / Math.max(maxValue, 1), 1)
    const remainderColor = t.shimmerBg

    return {
      option: {
        animation: animEnabled,
        // Legend is merged independently of series in the app host. Clear the
        // previous category names when field assignment switches to a scalar.
        legend: { show: false, data: [] },
        series: [{
          type: 'pie',
          left: 0, right: 0, top: 0, bottom: 0,
          radius: [`${Math.max(innerRadius - 8, 30)}%`, `${Math.min(outerRadius - 25, 50)}%`],
          center: ['50%', '50%'],
          startAngle: 90,
          // ECharts pie defaults to clockwise from startAngle, so this naturally
          // matches Recharts' startAngle:90 endAngle:-270 (full sweep clockwise from top)
          data: [
            { name: 'filled',    value: pct,     itemStyle: { color: p.start } },
            { name: 'remainder', value: 1 - pct, itemStyle: { color: remainderColor } },
          ],
          label: { show: false },
          labelLine: { show: false },
          silent: true,                      // disable hover lift on radial progress
          itemStyle: { borderRadius: cornerRadius, borderColor: 'transparent', borderWidth: 0 },
        }] as any,
        // ECharts title — placed at chart center, with built-in alignment that
        // works reliably across re-renders (graphic.elements positioning was offset).
        title: {
          show: showCenterText,
          text: fmtVal(value, prefix, suffix),
          left: 'center',
          top: 'middle',
          textAlign: 'center',
          textVerticalAlign: 'middle',
          textStyle: {
            color: centerColor || p.text || p.start,
            fontSize: centerFontSize,
            fontWeight: 800,
            textShadowBlur: 18,
            textShadowColor: `${p.start}66`,
          },
        },
        // Explicitly clear any leftover graphic.elements from earlier renders —
        // ECharts setOption merges by default and we previously used graphic.elements
        // for center text, which would otherwise stick around as a duplicate.
        graphic: { elements: [] },
      },
    }
  }

  // ── Mode 2: Multi-segment donut/pie ────────────────────────────────────────
  const data = rows.map(r => {
    const name = String(r._cat ?? '')
    const catColor = categoryColors ? categoryColors[name] : undefined
    return {
      name,
      value: Math.abs(Number(r._val ?? 0)),
      // Per-category override wins over the ordered `color: palette` on the series.
      ...(catColor ? { itemStyle: { color: catColor } } : {}),
    }
  })

  const total = data.reduce((s, d) => s + d.value, 0)

  // Truncate legend items to maxLegendItems (chart still shows all segments)
  const legendData = data.slice(0, maxLegendItems).map(d => d.name)

  // Pie center shifts based on legend position so chart and legend don't overlap
  const center: [string, string] = !showLegend
    ? ['50%', '50%']
    : isBottomLegend
      ? ['50%', '40%']                       // chart upper-half, legend bottom
      : isTopLegend ? ['50%', '55%'] : ['35%', '50%']                       // chart left-leaning, legend right

  // Radius percentages must use the space available beside the legend, not
  // the full canvas. Keep the existing visual/title center while sizing the
  // circle inside that rectangle. Explicit zeroes also reset merged options.
  const chartBounds = {
    left: 0,
    right: showLegend && !isBottomLegend && !isTopLegend ? '30%' : 0,
    top: showLegend && isTopLegend ? '10%' : 0,
    bottom: showLegend && isBottomLegend ? '20%' : 0,
  }

  const labelFormatter = Object.assign((params: any, modelFormatter?: any): string => {
    if (labelStyle === 'percent') {
      const pct = total > 0 ? (params.value / total) * 100 : 0
      return `${pct.toFixed(0)}%`
    }
    if (labelStyle === 'value') return typeof modelFormatter==='function' && !prefix && !suffix ? modelFormatter(params.value) : fmtVal(params.value, prefix, suffix)
    const name = String(params.name || '')
    return name.length > 10 ? name.slice(0, 9) + '…' : name
  }, { vilsemFormatter: true })

  return {
    option: {
      animation: animEnabled,
      color: palette,                         // applied to series in order
      tooltip: {
        show: true,
        trigger: 'item',
        backgroundColor: t.echartsTooltipBg,
        borderColor: t.echartsTooltipBorder,
        textStyle: { color: t.echartsTooltipText, fontSize: 12 },
        formatter: Object.assign((params: any, modelFormatter?: any) => {
          const pct = total > 0 ? (params.value / total) * 100 : 0
          return `${escapeHtml(params.name)}<br/>${escapeHtml(typeof modelFormatter==='function' && !prefix && !suffix ? modelFormatter(params.value) : fmtVal(params.value, prefix, suffix))} (${pct.toFixed(1)}%)`
        }, { vilsemFormatter: true }),
      },
      // Always emit the legend block with explicit `show` flag — ECharts setOption
      // merges by default, so toggling `legend: undefined` would leave the old legend
      // visible from the previous render. `show: false` properly hides it on re-render.
      legend: {
        show: showLegend,
        type: 'scroll',
        orient: isBottomLegend || isTopLegend ? 'horizontal' : 'vertical',
        ...(isBottomLegend ? { bottom: 4, left: 'center' } : isTopLegend ? { top: 4, left: 'center' } : { right: 8, top: 'middle' }),
        data: legendData,
        textStyle: { color: legendColor || t.echartsLegendText, fontSize: legendFontSize || 11 },
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 6,
        pageIconColor: t.textMuted,
        pageTextStyle: { color: t.textMuted, fontSize: 10 },
      },
      series: [{
        type: 'pie',
        radius: [`${innerRadius}%`, `${outerRadius}%`],
        ...chartBounds,
        center: ['50%', '50%'],
        startAngle: 90,
        padAngle: paddingAngle,
        data,
        label: showLabels ? {
          show: true,
          position: 'inside',
          formatter: labelFormatter,
          color: '#FFFFFF',
          fontSize: 10,
          fontWeight: 600,
        } : { show: false },
        labelLine: { show: false },
        itemStyle: {
          borderRadius: cornerRadius,
          borderColor: strokeColor,
          borderWidth: strokeWidth,
        },
        emphasis: {
          scale: true,
          scaleSize: 4,
        },
      }] as any,
      // Center text — total of all segments. Uses ECharts `title` (top-level
      // component) which has reliable centering vs graphic.elements (which
      // got drift through ECharts merge between re-renders). `title.left/top`
      // position the title's bounding box, and textAlign/textVerticalAlign
      // anchor the text within that box, so the rendered text sits centered
      // on the (left, top) point regardless of font size or label content.
      title: {
        show: showCenterText && innerRadius > 30 && total > 0,
        text: fmtVal(total, prefix, suffix),
        left: center[0],
        top: center[1],
        textAlign: 'center',
        textVerticalAlign: 'middle',
        textStyle: {
          color: centerColor || p.text || t.textPrimary,
          fontSize: centerFontSize,
          fontWeight: 800,
          textShadowBlur: 18,
          textShadowColor: `${p.start}66`,
        },
      },
      // Explicitly clear any leftover graphic.elements from earlier renders —
      // see same comment in the radial-progress branch above.
      graphic: { elements: [] },
    },
  }
}
