export interface LegendPrimitiveProps {
  show?: boolean
  position?: 'top' | 'bottom' | 'left' | 'right'
  items?: Array<{ name: string; color?: string }>
}
