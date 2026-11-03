import type { ThemeTokens } from '../shared/theme'
import type { EChartsOption } from 'echarts'

export interface FieldMeta {
  name: string
  type: 'string' | 'number' | 'date'
}

export interface FieldRef {
  field: string
}

export interface ScaleContribution {
  axis: 'x' | 'y'
  min: number
  max: number
}

export interface TooltipEntry {
  label: string
  value: string | number
  color?: string
}

export interface LegendItem {
  name: string
  color?: string
}

export interface PrimitiveContext {
  data: { fields: FieldMeta[]; rows: Record<string, unknown>[] }
  encoding: { x?: FieldRef; y?: FieldRef | FieldRef[]; color?: FieldRef }
  theme: ThemeTokens
  selection: { selectedCat: string | string[] | null }
  dimensions: { width: number; height: number }
}

export interface PrimitiveFragment {
  option: Partial<EChartsOption>
  contributions?: {
    scales?: ScaleContribution[]
    tooltipEntries?: TooltipEntry[]
    legendItems?: LegendItem[]
  }
  z?: number
}

export type Primitive<Props> = (props: Props, ctx: PrimitiveContext) => PrimitiveFragment
