import { describe, it, expect } from 'vitest'
import { schema as cartesianSchema }   from './cartesian-frame/index'
import { schema as categoricalSchema } from './categorical-axis/index'
import { schema as linearSchema }      from './linear-axis/index'
import { schema as barMarksSchema }    from './bar-marks/index'
import { schema as tooltipSchema }     from './tooltip/index'
import { schema as legendSchema }      from './legend/index'

const VALID_TYPES = new Set(['boolean', 'number', 'range', 'color', 'select', 'text'])

const allSchemas: [string, unknown[]][] = [
  ['CartesianFrame',  cartesianSchema],
  ['CategoricalAxis', categoricalSchema],
  ['LinearAxis',      linearSchema],
  ['BarMarks',        barMarksSchema],
  ['Tooltip',         tooltipSchema],
  ['Legend',          legendSchema],
]

describe('Primitive schema contracts', () => {
  allSchemas.forEach(([name, schema]) => {
    describe(name, () => {
      it('exports an array', () => {
        expect(Array.isArray(schema)).toBe(true)
      })

      it('every field has a non-empty key string', () => {
        schema.forEach((field: any) => {
          expect(typeof field.key, `${name}: key must be string`).toBe('string')
          expect(field.key.length, `${name}: key must be non-empty`).toBeGreaterThan(0)
        })
      })

      it('every field has a defined default value', () => {
        schema.forEach((field: any) => {
          expect('default' in field, `${name}.${field.key}: missing default`).toBe(true)
          expect(field.default, `${name}.${field.key}: default must not be undefined`).not.toBeUndefined()
        })
      })

      it('every field type is a valid FieldType', () => {
        schema.forEach((field: any) => {
          expect(VALID_TYPES.has(field.type), `${name}.${field.key}: invalid type "${field.type}"`).toBe(true)
        })
      })

      it('every select field has at least one option', () => {
        schema.filter((f: any) => f.type === 'select').forEach((field: any) => {
          expect(Array.isArray(field.options), `${name}.${field.key}: select must have options array`).toBe(true)
          expect(field.options.length, `${name}.${field.key}: options must not be empty`).toBeGreaterThan(0)
          field.options.forEach((opt: any) => {
            expect(typeof opt.label).toBe('string')
            expect('value' in opt).toBe(true)
          })
        })
      })

      it('every range field has min, max, step', () => {
        schema.filter((f: any) => f.type === 'range').forEach((field: any) => {
          expect(typeof field.min, `${name}.${field.key}: range must have min`).toBe('number')
          expect(typeof field.max, `${name}.${field.key}: range must have max`).toBe('number')
          expect(typeof field.step, `${name}.${field.key}: range must have step`).toBe('number')
          expect(field.min, `${name}.${field.key}: min must be < max`).toBeLessThan(field.max)
        })
      })
    })
  })

  describe('BarMarks schema coverage', () => {
    it('covers all user-facing bar config keys', () => {
      const keys = new Set(barMarksSchema.map((f: any) => f.key))
      const expected = [
        'barRadius', 'maxBarSize', 'showBarBackground', 'gradient', 'rankOpacity',
        'highlightMax', 'gridLines', 'gridStyle', 'dataLabels', 'labelPosition',
        'showAvgLine', 'avgLineColor', 'avgLineStyle',
      ]
      expected.forEach(k => {
        expect(keys.has(k), `BarMarks.schema missing key "${k}"`).toBe(true)
      })
    })

    it('has no duplicate keys', () => {
      const keys = barMarksSchema.map((f: any) => f.key)
      const unique = new Set(keys)
      expect(keys.length).toBe(unique.size)
    })
  })
})
