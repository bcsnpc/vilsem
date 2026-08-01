import type { ThemeTokens } from '../getThemeTokens'

/**
 * Runtime-only context fields injected by AppSpecRenderer into every visual's
 * `chartConfig` before it reaches the Compact* components. All are
 * underscore-prefixed to separate them from user-authored App Spec config.
 *
 * See docs/architecture/current-state.md §1.4 for the assembly sites.
 */
export interface ChartContext {
  /** Resolved theme tokens (dark or light) for the current canvas. */
  _T?: ThemeTokens
  /** Slicer + cross-filter filters currently applied to this visual. */
  _globalFilters?: Record<string, unknown>
  /** Serialized dep key for `_globalFilters` — use in useEffect deps. */
  _globalFiltersKey?: string
  /** Category value this visual sourced via cross-filter (for self-dim). */
  _selectedCat?: string | null
  /** Fires on bar click to update cross-filter state. */
  _onBarClick?: (cat: string) => void
  /** KPI-only: pixel height of the card, used for font-size scaling. */
  _cardPixelHeight?: number
}

/**
 * The prop passed as `config` to every Compact* visual component. Extends
 * ChartContext with public (user-authored) config fields from the App Spec's
 * `visual.config`. Strictly-typed fields below are the most common ones used
 * across visuals; visual-specific fields (e.g. Donut-only `innerRadius`,
 * Waffle-only `cellSize`) fall through the index signature.
 */
export interface ChartConfig extends ChartContext {
  // Identity / labels
  title?: string
  label?: string
  subtitle?: string
  measureName?: string
  secondaryMeasureName?: string | null

  // Color
  colorScheme?: string
  customColors?: string[]

  // Value formatting
  prefix?: string
  suffix?: string
  orderBy?: 'asc' | 'desc'
  limit?: number

  // Card chrome (see shared/chrome.ts)
  cardStyle?: 'minimal' | 'filled' | 'glass' | 'glossy' | 'accent' | 'bordered'
  bgOpacity?: number
  cardOpacity?: number
  borderRadius?: number

  // Animation (see shared/animation.ts)
  animations?: boolean
  animationEnabled?: boolean
  animationPreset?: 'none' | 'fadeUp' | 'fadeIn' | 'scaleIn'
  animationDuration?: 'fast' | 'medium' | 'slow' | number
  animationDelay?: 'none' | 'short' | 'medium'
  hoverEffect?: 'off' | 'subtle' | 'medium'

  // Common bar/line flags
  dataLabels?: boolean
  gridLines?: boolean

  // Axis switcher (see AxisSwitchPills)
  axisOptions?: Array<{
    label: string
    groupBy: { table: string; column: string }
  }>

  /** Visual-specific config fields fall through without ceremony. */
  [key: string]: unknown
}
