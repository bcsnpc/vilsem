import { truncateAxisLabel } from '../../appspec/shared/formatters.js'
import type { Primitive } from '../contract'
import type { PrimitiveFieldDef } from '../schema'
import type { CategoricalAxisProps } from './types'

// Category data and label truncation are data-driven, not user-configurable.
export const schema: PrimitiveFieldDef[] = []

// CategoricalAxis — configures one cartesian axis as type 'category'.
// Deep-merges into CartesianFrame's axis scaffold via composer.
//
// Category axis labels: every tick represents a distinct category, so ALL labels
// should remain visible (interval:0). When chart width is tight the labels would
// overlap horizontally — auto-rotate -30° once category count crosses a threshold.
// This differs from a date/time axis where alternating labels is the right call;
// callers using date data should pre-format _cat themselves and use this primitive
// only for true categorical axes (the wrapper's grain detection handles the split).
export const CategoricalAxis: Primitive<CategoricalAxisProps> = (props, ctx) => {
  const { axis, categories, show = true, labelMaxLength = 24, labelWidth } = props
  const { theme: t } = ctx

  const maxLen = Math.max(...categories.map(c => c.length), 0)
  const computedWidth = labelWidth ?? Math.min(Math.max(maxLen * 5.5, 60), 130)

  const isXAxis = axis === 'x'

  const axisLabel: Record<string, unknown> = {
    color: t.textSecondary,
    fontSize: 11,
  }
  if (isXAxis) {
    // Force every label to render — categorical ticks are distinct values, not a
    // continuum. When chart width is tight, wrap labels into multiple lines (via
    // overflow:'break' + a width budget) instead of rotating — wrapped text reads
    // upright and stays out of the chart area, where rotation tended to push the
    // tail of the label up behind the bars.
    axisLabel.interval   = 0
    axisLabel.overflow   = 'break'
    axisLabel.width      = 80
    axisLabel.lineHeight = 13
  } else {
    axisLabel.width    = computedWidth
    axisLabel.overflow = 'truncate'
  }

  const axisConfig: Record<string, unknown> = {
    type: 'category',
    data: categories.map(c => truncateAxisLabel(c, labelMaxLength)),
    show,
    axisLabel,
  }

  return { option: isXAxis ? { xAxis: axisConfig } : { yAxis: axisConfig } }
}
