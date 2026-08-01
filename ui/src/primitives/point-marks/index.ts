import { pal } from '../../appspec/shared/palettes.js'
import { fmtAxisNumber } from '../../appspec/shared/formatters.js'
import type { Primitive } from '../contract'
import type { PrimitiveFieldDef } from '../schema'
import type { PointMarksProps } from './types'

export const schema: PrimitiveFieldDef[] = [
  { key: 'dotSize',     label: 'Dot size',      type: 'range',   default: 16,   min: 4,  max: 60,  step: 1,  group: 'Appearance' },
  { key: 'fillOpacity', label: 'Fill opacity',  type: 'range',   default: 0.75, min: 0.1, max: 1,   step: 0.05, group: 'Appearance' },
  { key: 'showGrid',    label: 'Grid lines',    type: 'boolean', default: true,                                group: 'Axes' },
  { key: 'showXAxis',   label: 'X axis',        type: 'boolean', default: true,                                group: 'Axes' },
  { key: 'showYAxis',   label: 'Y axis',        type: 'boolean', default: true,                                group: 'Axes' },
  { key: 'showLabels',  label: 'Point labels',  type: 'boolean', default: false,                               group: 'Labels' },
]

// PointMarks — ECharts scatter series.
// Reads _val (x), _val2 (y, falls back to _val), _val3 (z for bubble sizing), _cat (label).
// symbolSize scales proportionally between dotSize and sqrt(dotSizeMax/π)*2 when _val3 varies.
export const PointMarks: Primitive<PointMarksProps> = (props, ctx) => {
  const {
    colorScheme,
    dotSize = 16,
    dotSizeMax = 100,
    fillOpacity = 0.75,
    showGrid = true,
    showXAxis = true,
    showYAxis = true,
    showLabels = false,
    animEnabled = true,
    xLabel,
    yLabel,
  } = props

  const rows = ctx.data.rows as Array<{ _val: unknown; _val2?: unknown; _val3?: unknown; _cat?: unknown }>
  const { theme: t } = ctx
  const p = pal(colorScheme)

  const hasZ = rows.some(r => r._val3 != null)
  const zVals = hasZ ? rows.map(r => Number(r._val3)) : []
  const zMin = hasZ ? Math.min(...zVals) : 0
  const zMax = hasZ ? Math.max(...zVals, 1) : 1
  const sizeMax = Math.sqrt(dotSizeMax / Math.PI) * 2

  const symbolSize = hasZ
    ? (val: number[]) => {
        if (zMax === zMin) return dotSize
        const norm = (val[2] - zMin) / (zMax - zMin)
        return Math.round(dotSize + norm * (sizeMax - dotSize))
      }
    : dotSize

  const data = rows.map(r => ({
    value: [Number(r._val), Number(r._val2 ?? r._val), hasZ ? Number(r._val3) : 1],
    name: String(r._cat ?? ''),
  }))

  const axisLabelStyle = { color: t.textMuted, fontSize: 9 }
  const gridStroke = t.gridStroke

  return {
    option: {
      animation: animEnabled,
      grid: {
        top: 8,
        right: 16,
        bottom: showXAxis ? 28 : 8,
        left: showYAxis ? 8 : 8,
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        show: showXAxis,
        splitLine: { show: showGrid, lineStyle: { color: gridStroke } },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { ...axisLabelStyle, formatter: fmtAxisNumber },
      },
      yAxis: {
        type: 'value',
        show: showYAxis,
        splitLine: { show: showGrid, lineStyle: { color: gridStroke } },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { ...axisLabelStyle, formatter: fmtAxisNumber, width: 36 },
      },
      tooltip: {
        show: true,
        backgroundColor: t.echartsTooltipBg,
        borderColor: t.echartsTooltipBorder,
        textStyle: { color: t.echartsTooltipText, fontSize: 12 },
        formatter: (params: any) => {
          const [x, y] = params.value as number[]
          const name = params.name || ''
          const xStr = `${xLabel || 'X'}: ${fmtAxisNumber(x)}`
          const yStr = `${yLabel || 'Y'}: ${fmtAxisNumber(y)}`
          return name ? `${name}<br/>${xStr}<br/>${yStr}` : `${xStr}<br/>${yStr}`
        },
      },
      series: [{
        type: 'scatter',
        data,
        symbolSize,
        itemStyle: { color: p.start, opacity: fillOpacity },
        label: showLabels ? {
          show: true,
          formatter: (params: any) => params.name || '',
          position: 'top',
          color: t.textMuted,
          fontSize: 9,
        } : { show: false },
      }] as any,
    },
  }
}
