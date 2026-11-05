import { pal } from '../../shared/palettes.js'
import { fmtVal } from '../../shared/formatters.js'
import type { Primitive } from '../contract'
import type { PrimitiveFieldDef } from '../schema'
import type { GaugeMarksProps } from './types'

export const schema: PrimitiveFieldDef[] = [
  { key: 'minValue',      label: 'Min value',       type: 'number',  default: 0,   group: 'Scale' },
  { key: 'maxValue',      label: 'Max value',       type: 'number',  default: 100, group: 'Scale' },
  { key: 'arcWidth',      label: 'Arc width (px)',  type: 'range',   default: 10,  min: 4, max: 30,  step: 1,  group: 'Appearance' },
  { key: 'gaugeSize',     label: 'Gauge size (%)',  type: 'range',   default: 80,  min: 30, max: 100, step: 5, group: 'Appearance' },
  { key: 'showMinMax',    label: 'Show min / max',  type: 'boolean', default: false,                           group: 'Labels' },
  { key: 'valueFontSize', label: 'Value font size', type: 'range',   default: 15,  min: 10, max: 28, step: 1,  group: 'Labels' },
]

// GaugeMarks — ECharts 5 gauge series. Reads ctx.data.rows[0]._val.
// Uses the ECharts 5 `progress` API (separate filled arc + plain track) to avoid
// the color-segment junction dot that appears with the axisLine segmentation approach.
// pointer and anchor explicitly hidden for a clean arc gauge (no needle).
// colorZones optionally overrides fillColor based on value range.
export const GaugeMarks: Primitive<GaugeMarksProps> = (props, ctx) => {
  const {
    colorScheme,
    min = 0,
    max = 100,
    arcWidth = 10,
    gaugeSize = 80,
    showMinMax = false,
    colorZones = null,
    valueFontSize = 15,
    valueFontWeight = 800,
    valueFontFamily,
    valueColor,
    prefix,
    suffix,
    animEnabled = true,
  } = props

  const rows = ctx.data.rows as Array<{ _val: unknown }>
  const { theme: t } = ctx
  const p = pal(colorScheme)

  const raw = rows[0]?._val
  const val = raw != null ? Number(raw) : null
  // Clamp display value to [min, max] — prevents arc overflow when clip:false and value>>max
  const displayVal = val != null ? Math.max(min, Math.min(max, val)) : 0

  // Determine fill color — zone override or scheme color
  let fillColor = p.start
  if (colorZones && val != null) {
    for (const zone of colorZones) {
      if (val >= zone.from && val <= zone.to) { fillColor = zone.color; break }
    }
  }

  const trackColor = t.shimmerBg

  // Compute pixel-exact center and radius so the arc never clips.
  // Arc passes through ±R from cx (9 o'clock and 3 o'clock), and
  // endpoints are at cy + 0.5R (lower-left and lower-right).
  // pad = half arcWidth + safety margin.  When dimensions are unknown,
  // fall back to conservative percentages.
  const { width: W, height: H } = ctx.dimensions
  let gaugeCenter: [string | number, string | number] = ['50%', '55%']
  let gaugeRadius: string | number = '45%'
  const fmtLabel = (v: number) => {
    const abs = Math.abs(v)
    if (abs >= 1e9) return (v / 1e9).toFixed(1).replace(/\.0$/, '') + 'B'
    if (abs >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'
    if (abs >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K'
    return String(v)
  }

  if (W > 0 && H > 0) {
    const pad = Math.ceil(arcWidth / 2) + 6
    // maxR ensures the arc fits horizontally and has at least `pad` margin top+bottom
    const maxR = Math.floor(Math.min(W / 2 - pad, (H - 2 * pad) / 1.5))
    const R = Math.floor(maxR * (gaugeSize / 100))
    if (R > 0) {
      // Arc top is at cy-R, arc bottom (endpoints) at cy+R/2.
      // Setting cy = H/2 + R/4 gives equal top and bottom margins.
      gaugeCenter = [Math.round(W / 2), Math.round(H / 2 + R / 4)]
      gaugeRadius = R
    }
  }

  return {
    option: {
      animation: animEnabled,
      series: [{
        type: 'gauge',
        startAngle: 210,
        endAngle: -30,
        min,
        max,
        radius: gaugeRadius,
        center: gaugeCenter,
        // ECharts 5 progress API — filled arc computed automatically from value.
        progress: {
          show: true,
          width: arcWidth,
          roundCap: false,
          clip: false,
          itemStyle: { color: fillColor, borderWidth: 0, borderColor: 'transparent' },
        },
        // axisLine = plain background track (single segment, no junction dot)
        axisLine: {
          roundCap: false,
          lineStyle: { width: arcWidth, color: [[1, trackColor]] },
        },
        pointer: { show: false, length: 0, width: 0 },
        // anchor: the center circle from which the pointer extends — explicitly kill it
        anchor: { show: false, showAbove: false, size: 0,
                  itemStyle: { color: 'transparent', borderWidth: 0 } },
        axisTick: { show: false },
        splitLine: { show: false },
        splitNumber: showMinMax ? 4 : 0,
        axisLabel: showMinMax ? {
          show: true,
          color: t.textMuted,
          fontSize: 9,
          distance: -(arcWidth + 22),
          formatter: Object.assign((v: number, modelFormatter?: any) => (v === min || v === max) ? (typeof modelFormatter==='function' && !prefix && !suffix ? modelFormatter(v) : fmtLabel(v)) : '', { vilsemFormatter: true }),
        } : { show: false },
        detail: {
          show: true,
          valueAnimation: animEnabled,
          fontSize: valueFontSize,
          fontWeight: valueFontWeight,
          ...(valueFontFamily ? { fontFamily: valueFontFamily } : {}),
          color: valueColor || fillColor,
          offsetCenter: [0, '15%'],
          formatter: Object.assign((_value: any, modelFormatter?: any) => typeof modelFormatter==='function' && !prefix && !suffix ? modelFormatter(val ?? displayVal) : fmtVal(val ?? displayVal, prefix, suffix), { vilsemFormatter: true }),
        },
        title: { show: false },
        data: [{ value: displayVal, name: val != null ? String(val) : '' }],
      }] as any,
    },
  }
}
