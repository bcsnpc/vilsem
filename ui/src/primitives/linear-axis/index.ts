import { fmtAxisNumber } from '../../appspec/shared/formatters.js'
import type { Primitive } from '../contract'
import type { PrimitiveFieldDef } from '../schema'
import type { LinearAxisProps } from './types'

// Axis range and baseline are data-driven, not user-configurable.
export const schema: PrimitiveFieldDef[] = []

// LinearAxis — configures one cartesian axis as type 'value'.
// forceZeroBaseline: clamp min to 0 unless data contains negatives.
// Deep-merges into CartesianFrame's axis scaffold via composer.
export const LinearAxis: Primitive<LinearAxisProps> = (props, ctx) => {
  const { axis, dataMin = 0, dataMax = 100, forceZeroBaseline = true, show = true } = props
  const { theme: t } = ctx

  const hasNegative = dataMin < 0
  const min = forceZeroBaseline && !hasNegative ? 0 : dataMin

  const axisConfig: Record<string, unknown> = {
    type: 'value',
    min,
    max: dataMax,
    show,
    axisLabel: {
      color: t.textMuted,
      fontSize: 10,
      formatter: fmtAxisNumber,
    },
  }

  return { option: axis === 'x' ? { xAxis: axisConfig } : { yAxis: axisConfig } }
}
