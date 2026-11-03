import { describe, it, expect } from 'vitest'
import { PointMarks, schema } from './index'
import type { PrimitiveContext } from '../contract'

function makeCtx(rows: Array<Record<string, unknown>> = []): PrimitiveContext {
  return {
    data: { fields: [], rows },
    encoding: {},
    theme: {
      textMuted: '#888', textPrimary: '#fff', gridStroke: 'rgba(255,255,255,0.1)',
    } as any,
    selection: { selectedCat: null },
    dimensions: { width: 400, height: 300 },
  }
}

const SAMPLE_ROWS = [
  { _cat: 'A', _val: 10, _val2: 20 },
  { _cat: 'B', _val: 30, _val2: 40 },
  { _cat: 'C', _val: 50, _val2: 60 },
]

const BUBBLE_ROWS = [
  { _cat: 'A', _val: 10, _val2: 20, _val3: 100 },
  { _cat: 'B', _val: 30, _val2: 40, _val3: 200 },
  { _cat: 'C', _val: 50, _val2: 60, _val3: 400 },
]

describe('PointMarks', () => {
  it('output shape — has xAxis, yAxis, scatter series', () => {
    const f = PointMarks({ colorScheme: 'teal' }, makeCtx(SAMPLE_ROWS))
    const opt = f.option as any
    expect(opt.xAxis.type).toBe('value')
    expect(opt.yAxis.type).toBe('value')
    expect(opt.series).toHaveLength(1)
    expect(opt.series[0].type).toBe('scatter')
  })

  it('data maps _val→x, _val2→y, _cat→name', () => {
    const f = PointMarks({ colorScheme: 'teal' }, makeCtx(SAMPLE_ROWS))
    const data = (f.option as any).series[0].data
    expect(data).toHaveLength(3)
    expect(data[0].value[0]).toBe(10)
    expect(data[0].value[1]).toBe(20)
    expect(data[0].name).toBe('A')
  })

  it('_val2 falls back to _val when missing', () => {
    const rows = [{ _cat: 'X', _val: 42 }]
    const f = PointMarks({ colorScheme: 'teal' }, makeCtx(rows))
    const data = (f.option as any).series[0].data
    expect(data[0].value[0]).toBe(42)
    expect(data[0].value[1]).toBe(42)
  })

  it('dotSize used as fixed symbolSize when no _val3', () => {
    const f = PointMarks({ colorScheme: 'teal', dotSize: 20 }, makeCtx(SAMPLE_ROWS))
    const opt = f.option as any
    expect(opt.series[0].symbolSize).toBe(20)
  })

  it('bubble rows → symbolSize is a function', () => {
    const f = PointMarks({ colorScheme: 'teal', dotSize: 8 }, makeCtx(BUBBLE_ROWS))
    const sz = (f.option as any).series[0].symbolSize
    expect(typeof sz).toBe('function')
    // largest z should yield larger symbol than smallest
    const sLarge = sz([0, 0, 400])
    const sSmall = sz([0, 0, 100])
    expect(sLarge).toBeGreaterThan(sSmall)
  })

  it('showXAxis false hides xAxis', () => {
    const f = PointMarks({ colorScheme: 'teal', showXAxis: false }, makeCtx(SAMPLE_ROWS))
    expect((f.option as any).xAxis.show).toBe(false)
  })

  it('showYAxis true shows yAxis', () => {
    const f = PointMarks({ colorScheme: 'teal', showYAxis: true }, makeCtx(SAMPLE_ROWS))
    expect((f.option as any).yAxis.show).toBe(true)
  })

  it('showLabels true enables series label', () => {
    const f = PointMarks({ colorScheme: 'teal', showLabels: true }, makeCtx(SAMPLE_ROWS))
    expect((f.option as any).series[0].label.show).toBe(true)
  })

  it('fillOpacity propagates to itemStyle', () => {
    const f = PointMarks({ colorScheme: 'teal', fillOpacity: 0.5 }, makeCtx(SAMPLE_ROWS))
    expect((f.option as any).series[0].itemStyle.opacity).toBe(0.5)
  })

  it('empty rows produce empty data array', () => {
    const f = PointMarks({ colorScheme: 'teal' }, makeCtx([]))
    expect((f.option as any).series[0].data).toHaveLength(0)
  })

  it('animation flag propagates', () => {
    const on = PointMarks({ colorScheme: 'teal', animEnabled: true }, makeCtx(SAMPLE_ROWS))
    expect((on.option as any).animation).toBe(true)
    const off = PointMarks({ colorScheme: 'teal', animEnabled: false }, makeCtx(SAMPLE_ROWS))
    expect((off.option as any).animation).toBe(false)
  })
})

describe('PointMarks schema', () => {
  it('exports a schema array', () => {
    expect(Array.isArray(schema)).toBe(true)
    expect(schema.length).toBeGreaterThan(0)
  })

  it('all fields have key and default', () => {
    schema.forEach(field => {
      expect(typeof field.key).toBe('string')
      expect(field.key.length).toBeGreaterThan(0)
      expect('default' in field).toBe(true)
      expect(field.default).not.toBeUndefined()
    })
  })

  it('covers expected user-facing config keys', () => {
    const keys = new Set(schema.map(f => f.key))
    ;['dotSize', 'fillOpacity', 'showGrid', 'showXAxis', 'showYAxis', 'showLabels'].forEach(k => {
      expect(keys.has(k), `schema missing key "${k}"`).toBe(true)
    })
  })
})
