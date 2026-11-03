export interface GaugeMarksProps {
  colorScheme: string
  min?: number
  max?: number
  arcWidth?: number
  gaugeSize?: number
  showMinMax?: boolean
  colorZones?: { from: number; to: number; color: string }[] | null
  valueFontSize?: number
  valueFontWeight?: number
  valueFontFamily?: string
  valueColor?: string
  prefix?: string
  suffix?: string
  animEnabled?: boolean
}
