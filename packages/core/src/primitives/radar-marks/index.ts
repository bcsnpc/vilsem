import { pal } from '../../shared/palettes.js'
import { fmtVal } from '../../shared/formatters.js'
import type { Primitive } from '../contract'
import type { PrimitiveFieldDef } from '../schema'
import type { RadarMarksProps } from './types'
import { escapeHtml } from '../escapeHtml'

export const schema: PrimitiveFieldDef[] = [
  { key: 'fillOpacity',   label: 'Fill opacity',     type: 'range',   default: 0.22, min: 0,  max: 1,  step: 0.01, group: 'Appearance' },
  { key: 'strokeWidth',   label: 'Stroke width',     type: 'range',   default: 2,    min: 1,  max: 6,  step: 0.5,  group: 'Appearance' },
  { key: 'showDots',      label: 'Show data points', type: 'boolean', default: false,                              group: 'Appearance' },
  { key: 'radarRadius',   label: 'Radar size (%)',   type: 'range',   default: 68,   min: 40, max: 90, step: 1,    group: 'Appearance' },
  { key: 'labelFontSize', label: 'Label font size',  type: 'range',   default: 9,    min: 7,  max: 14, step: 1,    group: 'Labels' },
]

// RadarMarks — emits both the ECharts `radar` config (web frame) and the
// radar series. These two are tightly coupled by indicator index, so they
// live in a single primitive rather than separate Frame + Marks.
// Reads ctx.data.rows as Array<{ _cat: string; _val: number }>.
export const RadarMarks: Primitive<RadarMarksProps> = (props, ctx) => {
  const {
    colorScheme,
    seriesName = '',
    fillOpacity = 0.22,
    strokeWidth = 2,
    showDots = false,
    radarRadius = 68,
    labelFontSize = 9,
    prefix,
    suffix,
    animEnabled = true,
  } = props

  const rows = ctx.data.rows as Array<{ _cat: unknown; _val: unknown }>
  const { theme: t } = ctx
  const p = pal(colorScheme)

  const indicators: Array<{ name: string; max?: number; axisLabel: { show: boolean } }> =
    rows.map(r => ({
      name: String(r._cat ?? ''),
      axisLabel: { show: false }, // silences ECharts "ticks may not be readable" warning
    }))

  const values = rows.map(r => Number(r._val) || 0)
  const maxVal = Math.max(...values, 0)
  if (maxVal > 0) {
    for (const ind of indicators) ind.max = maxVal
  }

  const gridColor  = t.gridStroke
  const labelColor = t.textMuted

  return {
    option: {
      animation: animEnabled,
      radar: {
        indicator: indicators,
        splitLine: { lineStyle: { color: gridColor } },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: gridColor } },
        axisName: { color: labelColor, fontSize: labelFontSize },
        center: ['50%', '50%'],
        radius: `${radarRadius}%`,
      },
      series: [{
        type: 'radar',
        symbol: showDots ? 'circle' : 'none',
        symbolSize: showDots ? 6 : 0,
        lineStyle: { color: p.start, width: strokeWidth },
        itemStyle: { color: p.start },
        areaStyle: { color: p.start, opacity: fillOpacity },
        data: [{ value: values, name: seriesName }],
      }] as any,
      tooltip: {
        trigger: 'item',
        confine: true,
        backgroundColor: 'transparent',
        borderWidth: 0,
        padding: 0,
        // Theme-aware: pulls bg/border/text/shadow from theme tokens so the radar's
        // multi-row tooltip matches the rest of the app's tooltips in both modes.
        formatter: Object.assign((params: any, modelFormatter?: any) => {
          const vals: number[] = Array.isArray(params.value) ? params.value : [params.value]
          const lines = vals.map((v, i) => {
            const name = indicators[i]?.name ?? ''
            const formatted = typeof modelFormatter==='function' && !prefix && !suffix ? modelFormatter(v) : fmtVal(v, prefix, suffix)
            return `<div style="display:flex;justify-content:space-between;gap:16px;font-size:11px;padding:2px 0">
              <span style="color:${t.echartsLegendText}">${escapeHtml(name)}</span>
              <span style="color:${p.start};font-weight:700">${escapeHtml(formatted)}</span>
            </div>`
          }).join('')
          const shadow = t.canvasBg && t.canvasBg.startsWith('#0') ? '0 12px 28px rgba(0,0,0,0.48)' : '0 8px 24px rgba(0,0,0,0.12)'
          return `<div style="background:${t.echartsTooltipBg};border:1px solid ${t.echartsTooltipBorder};border-radius:10px;padding:10px 13px;min-width:160px;box-shadow:${shadow};color:${t.echartsTooltipText}">${lines}</div>`
        }, { vilsemFormatter: true }),
      } as any,
    },
  }
}
