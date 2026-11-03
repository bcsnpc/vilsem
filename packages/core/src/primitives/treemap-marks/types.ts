export interface TreemapMarksProps {
  colorScheme: string
  showLabels?: boolean
  showValues?: boolean
  colorMode?: 'single' | 'gradient' | 'multi'
  borderColor?: string
  borderWidth?: number
  borderRadius?: number
  customColors?: string[]
  categoryColors?: Record<string, string>  // per-tile colour overrides (by category name)
  animEnabled?: boolean
  prefix?: string | null
  suffix?: string | null
  labelColor?: string
  valueColor?: string
  labelFontSize?: number
  valueFontSize?: number
  padding?: number       // distance (px) from treemap to container edges; default 0 fills the container
}
