export interface TooltipPrimitiveProps {
  prefix?: string
  suffix?: string
  measureName?: string
  accentColor?: string
  trigger?: 'item' | 'axis'
  // Optional explicit per-series colors for the swatches in axis-trigger tooltips.
  // When provided, swatch[i] uses seriesColors[i]. Falls back to ECharts'
  // params.color (which can show per-data-item alpha when rankOpacity is on).
  seriesColors?: string[]
}
