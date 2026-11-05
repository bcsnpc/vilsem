import { pal, MULTI_COLORS } from '../../shared/palettes.js'
import { fmtVal } from '../../shared/formatters.js'
import type { Primitive } from '../contract'
import type { PrimitiveFieldDef } from '../schema'
import type { TreemapMarksProps } from './types'
import { escapeHtml } from '../escapeHtml'

export const schema: PrimitiveFieldDef[] = [
  { key: 'showLabels',    label: 'Tile labels',    type: 'boolean', default: true,                                  group: 'Labels' },
  { key: 'labelColor',    label: 'Label color',    type: 'color',   default: '#FFFFFF',                             group: 'Labels' },
  { key: 'labelFontSize', label: 'Label size',     type: 'range',   default: 10,   min: 8,  max: 18, step: 1,       group: 'Labels' },
  { key: 'showValues',    label: 'Tile values',    type: 'boolean', default: false,                                 group: 'Labels' },
  { key: 'valueColor',    label: 'Value color',    type: 'color',   default: '#94A3B8',                             group: 'Labels' },
  { key: 'valueFontSize', label: 'Value size',     type: 'range',   default: 9,    min: 7,  max: 16, step: 1,       group: 'Labels' },
  { key: 'colorMode',     label: 'Color mode',     type: 'select',  default: 'single',
    options: [
      { value: 'single',   label: 'Single (scheme color)' },
      { value: 'gradient', label: 'Gradient (opacity by value)' },
      { value: 'multi',    label: 'Multi (rotating palette)' },
    ],                                                                                                               group: 'Appearance' },
  { key: 'borderRadius',  label: 'Border radius',  type: 'range',   default: 0,    min: 0,  max: 12, step: 1,        group: 'Appearance' },
  { key: 'borderWidth',   label: 'Border width',   type: 'range',   default: 1,    min: 0,  max: 4,  step: 0.5,      group: 'Appearance' },
  { key: 'padding',       label: 'Outer padding',  type: 'range',   default: 0,    min: 0,  max: 24, step: 1,        group: 'Appearance' },
]

// TreemapMarks — flat ECharts treemap series (no hierarchy/drill-down).
// Reads `_cat` (tile name) and `_val` (tile size) from ctx.data.rows.
// Tile color/opacity rules per `colorMode`:
//   - single   → scheme primary, fixed opacity 0.8
//   - gradient → scheme primary, opacity 0.4 + (value/maxValue) * 0.5
//   - multi    → rotating MULTI_COLORS palette (or `customColors` prop), fixed opacity 0.8
export const TreemapMarks: Primitive<TreemapMarksProps> = (props, ctx) => {
  const {
    colorScheme,
    showLabels    = true,
    showValues    = false,
    colorMode     = 'single',
    borderColor   = 'rgba(0,0,0,0.3)',
    borderWidth   = 1,
    borderRadius  = 0,
    customColors,
    animEnabled   = true,
    prefix        = null,
    suffix        = null,
    labelColor    = '#FFFFFF',
    valueColor    = '#94A3B8',
    labelFontSize = 10,
    valueFontSize = 9,
    padding       = 0,
    categoryColors,
  } = props

  const rows = ctx.data.rows as Array<{ _cat?: unknown; _val?: unknown }>
  const { theme: t } = ctx
  const p = pal(colorScheme)
  const palette = customColors && customColors.length > 0 ? customColors : MULTI_COLORS

  const sizes = rows.map(r => Math.abs(Number(r._val ?? 0)))
  const maxSize = sizes.length > 0 ? Math.max(...sizes, 1) : 1

  const data = rows.map((r, i) => {
    const value = Number(r._val ?? 0)
    const size = Math.abs(value)
    const catName = String(r._cat ?? '')
    const catColor = categoryColors ? categoryColors[catName] : undefined
    const cellColor = catColor || (colorMode === 'multi' ? palette[i % palette.length] : p.start)
    const opacity = colorMode === 'gradient' ? 0.4 + (size / maxSize) * 0.5 : 0.8
    return {
      name: String(r._cat ?? ''),
      value: size,                     // ECharts treemap uses `value` for tile size
      _rawValue: value,                // preserve original (may be negative) for tooltip/labels
      itemStyle: {
        color: cellColor,
        opacity,
        borderColor,
        borderWidth,
        borderRadius,
      },
    }
  })

  // Rich-text formatter — emits {name|...} and {value|...} segments so the
  // ECharts label.rich block can apply different colors/sizes per segment.
  const labelFormatter = Object.assign((params: any, modelFormatter?: any): string => {
    const lines: string[] = []
    if (showLabels) lines.push(`{name|${params.name || ''}}`)
    if (showValues) {
      const value=params.data?._rawValue ?? params.value
      lines.push(`{value|${typeof modelFormatter==='function' && !prefix && !suffix ? modelFormatter(value) : fmtVal(value, prefix, suffix)}}`)
    }
    return lines.join('\n')
  }, { vilsemFormatter: true })

  return {
    option: {
      animation: animEnabled,
      tooltip: {
        show: true,
        backgroundColor: t.echartsTooltipBg,
        borderColor: t.echartsTooltipBorder,
        textStyle: { color: t.echartsTooltipText, fontSize: 12 },
        formatter: Object.assign((params: any, modelFormatter?: any) => {
          const name = params.name || ''
          const v = params.data?._rawValue ?? params.value
          return `${escapeHtml(name)}<br/>${escapeHtml(typeof modelFormatter==='function' && !prefix && !suffix ? modelFormatter(v) : fmtVal(v, prefix, suffix))}`
        }, { vilsemFormatter: true }),
      },
      series: [{
        type: 'treemap',
        data,
        // Fill the container by default — ECharts treemap defaults leave a margin
        // for breadcrumb/header that we don't use. `padding` prop overrides if set.
        top: padding,
        bottom: padding,
        left: padding,
        right: padding,
        width: undefined,                // let top/bottom/left/right drive sizing
        height: undefined,
        roam: false,                    // disable pan/zoom — flat treemap, no drill
        nodeClick: false,
        breadcrumb: { show: false },
        label: {
          show: showLabels || showValues,
          formatter: labelFormatter,
          overflow: 'truncate',
          // Rich-text segments give labels and values separate styling
          rich: {
            name:  { color: labelColor, fontSize: labelFontSize, fontWeight: 600, lineHeight: labelFontSize + 4 },
            value: { color: valueColor, fontSize: valueFontSize, fontWeight: 500, lineHeight: valueFontSize + 3 },
          },
        },
        itemStyle: {
          // Tile-level itemStyle is per-data-item; this is the series default fallback
          borderColor,
          borderWidth,
          borderRadius,
        },
        // Disable visual cues that imply drill-down (we render flat)
        upperLabel: { show: false },
        levels: [{ itemStyle: { borderColor, borderWidth, borderRadius } }],
      }] as any,
    },
  }
}
