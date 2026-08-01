export type FieldType =
  | 'boolean'   // toggle
  | 'number'    // numeric input
  | 'range'     // slider with min/max/step
  | 'color'     // color picker
  | 'select'    // dropdown with fixed options
  | 'text'      // free text input

export interface PrimitiveFieldDef {
  key: string
  label: string
  type: FieldType
  default: unknown
  min?: number
  max?: number
  step?: number
  options?: { label: string; value: unknown }[]
  group?: string
  description?: string
}
