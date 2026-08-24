export interface PieMarksProps {
  colorScheme: string

  // Shape
  innerRadius?: number          // % — 0 = pie, 50+ = donut. Default 52.
  outerRadius?: number          // %. Default 85.
  paddingAngle?: number         // degrees of gap between segments. Default 2.
  cornerRadius?: number         // px. Default 0.

  // Colors
  customColors?: string[]       // overrides default MULTI_COLORS palette
  strokeColor?: string          // border color between segments
  strokeWidth?: number          // border width

  // Legend
  showLegend?: boolean
  legendPosition?: 'right' | 'bottom'
  legendColor?: string
  legendFontSize?: number
  maxLegendItems?: number       // truncate to first N (overflow scrolls)

  // Labels (multi-segment mode only — on-slice labels)
  showLabels?: boolean
  labelStyle?: 'percent' | 'value' | 'name'

  // Center text (donut mode + radial progress mode)
  showCenterText?: boolean
  centerColor?: string          // override center text color (default: scheme primary)
  centerFontSize?: number

  // Single-measure radial progress mode (used when ctx.data.rows.length === 1)
  maxValue?: number             // denominator for percent fill

  // Animation
  animEnabled?: boolean

  // Value formatting (for tooltip / labels / center text)
  prefix?: string | null
  suffix?: string | null
  categoryColors?: Record<string, string>  // per-slice colour overrides (by category name)
}
