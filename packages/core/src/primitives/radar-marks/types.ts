export interface RadarMarksProps {
  colorScheme: string
  seriesName?: string
  fillOpacity?: number
  strokeWidth?: number
  showDots?: boolean
  radarRadius?: number   // numeric %, converted to '68%' internally
  labelFontSize?: number
  prefix?: string
  suffix?: string
  animEnabled?: boolean
}
