export interface LineMarksProps {
  colorScheme: string

  // Shape
  chartType?: 'line' | 'area'        // 'area' adds gradient fill beneath the line; default 'line'
  smooth?: boolean                   // monotone-style curve when true; sharp polyline when false
  strokeWidth?: number               // primary series stroke width (px)
  fillOpacity?: number               // 0–1, only meaningful in area mode
  stacked?: boolean                  // when true and a secondary measure exists, both series get
                                     // `stack: 'total'` so values accumulate visually (cumulative areas)

  // Markers
  showDots?: boolean
  dotSize?: number                   // radius (px) of data-point markers

  // Data labels (value next to each point)
  showDataLabels?: boolean

  // Axes
  showGrid?: boolean
  showXAxis?: boolean
  showYAxis?: boolean
  invertY?: boolean                  // when true, yAxis renders inverted (low values at top — used by bump charts where y is rank, rank 1 belongs at top)

  // Reference lines
  showAvgLine?: boolean              // emits a horizontal markLine at the mean of _val
  targetLine?: number | null         // emits a horizontal markLine at this exact value if set

  // Animation
  animEnabled?: boolean

  // Value formatting
  prefix?: string | null
  suffix?: string | null

  // Series names — surfaced in tooltip and (later) legend. Wrapper passes
  // config.measureName / config.secondaryMeasureName so users see
  // "Total Revenue" instead of the internal "primary".
  measureName?: string
  secondaryMeasureName?: string

  // Per-series color overrides. When unset, both series fall back to the
  // active color scheme (primary = scheme.start, secondary = scheme.mid).
  // Setting these lets users pick independent colors per measure (e.g.
  // green for Revenue, gold for Profit).
  primaryColor?: string
  secondaryColor?: string
}
