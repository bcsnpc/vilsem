import type { Primitive } from '../contract'
import type { PrimitiveFieldDef } from '../schema'
import type { LegendPrimitiveProps } from './types'

// Legend position becomes user-configurable in Phase 4.5+ (multi-series visuals).
export const schema: PrimitiveFieldDef[] = []

// Legend — generates ECharts legend config from an explicit items list.
// CompactBar doesn't use a legend (single series), but this primitive is used
// by Phase 4 multi-series visuals (stacked bar, grouped bar, line+area, etc).
export const Legend: Primitive<LegendPrimitiveProps> = (props, ctx) => {
  const { show, position = 'top', items = [] } = props
  const { theme: t } = ctx

  const shouldShow = show ?? items.length > 0

  if (!shouldShow) {
    return { option: { legend: { show: false } } }
  }

  const positionMap: Record<string, Record<string, unknown>> = {
    top:    { top: 0, left: 'center', orient: 'horizontal' },
    bottom: { bottom: 0, left: 'center', orient: 'horizontal' },
    left:   { left: 0, top: 'center', orient: 'vertical' },
    right:  { right: 0, top: 'center', orient: 'vertical' },
  }

  return {
    option: {
      legend: {
        show: true,
        ...positionMap[position],
        textStyle: { color: t.textMuted, fontSize: 11 },
        data: items.map(item =>
          item.color ? { name: item.name, itemStyle: { color: item.color } } : item.name
        ),
      } as any,
    },
  }
}
