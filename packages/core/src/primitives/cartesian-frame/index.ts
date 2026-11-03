import type { Primitive } from '../contract'
import type { PrimitiveFieldDef } from '../schema'
import type { CartesianFrameProps } from './types'

// Margins and orientation are structural (determined by chart type), not user-configurable.
export const schema: PrimitiveFieldDef[] = []

// CartesianFrame — owns grid layout and axis scaffolding (show/hide, axisLine,
// axisTick). Does NOT set axis type or data — those belong to CategoricalAxis
// and LinearAxis so they can be applied independently via composer.
export const CartesianFrame: Primitive<CartesianFrameProps> = (props) => {
  const { orientation = 'horizontal', margin = {} } = props
  const { left = 4, right = 16, top = 4, bottom = 4 } = margin

  const baseAxis = {
    show: true,
    axisLine: { show: false },
    axisTick: { show: false },
  }
  // Value axis: hide split lines on category axis, show on value axis.
  const valueAxis = { ...baseAxis, splitLine: { show: false } }
  const categoryAxis = { ...baseAxis, splitLine: { show: false } }

  const xAxis = orientation === 'vertical' ? categoryAxis : valueAxis
  // inverse: true so horizontal bars render top-to-bottom (first category at top),
  // matching Recharts default. ECharts yAxis is bottom-to-top by default.
  const yAxis = orientation === 'vertical'
    ? valueAxis
    : { ...categoryAxis, inverse: true }

  return {
    option: {
      grid: [{ left, right, top, bottom, containLabel: true }],
      xAxis,
      yAxis,
    },
  }
}
