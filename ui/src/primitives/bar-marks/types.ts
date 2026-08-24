export interface RefLine {
  val: number
  color: string
  label: string
  lineStyle?: 'solid' | 'dashed' | 'dotted'
}

export interface BarMarksProps {
  orientation?: 'horizontal' | 'vertical'
  colorScheme: string
  gradient?: boolean
  gradientTo?: string
  conditionalColor?: { threshold: number; above: string; below: string } | null
  rankOpacity?: boolean
  highlightMax?: boolean
  orderBy?: 'asc' | 'desc'
  showBackground?: boolean
  barRadius?: number
  maxBarSize?: number
  animEnabled?: boolean
  animDuration?: number
  showDataLabels?: boolean
  labelPosition?: 'auto' | 'right' | 'inside' | 'top'
  dataLabelColor?: string
  prefix?: string
  suffix?: string
  measureName?: string
  scrollThreshold?: number
  refLines?: RefLine[]

  // Stacking — when secondary data is provided, BarMarks emits a 2nd series
  // alongside the primary. With stacked=true, both series carry `stack:'total'`
  // so values accumulate visually (cumulative bars, like horizontal stacked bar).
  // Secondary series inherits the same per-item opacity (rankOpacity, highlightMax
  // border) as primary, just with a different base color — so the stacked bar
  // reads as one visually unified entity with two coloured sections.
  secondaryData?: number[]               // parallel to ctx.data.rows (one value per row)
  secondaryMeasureName?: string
  secondaryColor?: string                // empty/unset → falls back to scheme `p.mid`
  stacked?: boolean
  categoryColors?: Record<string, string> // per-category-name colour overrides (by _cat)
}
