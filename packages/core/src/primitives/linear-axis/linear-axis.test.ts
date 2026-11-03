import { describe, it, expect } from 'vitest'
import { LinearAxis } from './index'
import type { PrimitiveContext } from '../contract'

function makeCtx(): PrimitiveContext {
  return {
    data: { fields: [], rows: [] },
    encoding: {},
    theme: { textMuted: '#888', textSecondary: '#aaa', textPrimary: '#fff', gridStroke: '#333' } as any,
    selection: { selectedCat: null },
    dimensions: { width: 400, height: 300 },
  }
}

describe('LinearAxis', () => {
  it('forceZeroBaseline (default) — min clamped to 0 for positive-only data', () => {
    const f = LinearAxis({ axis: 'y', dataMin: 10, dataMax: 500 }, makeCtx())
    const opt = f.option as any
    expect(opt.yAxis.type).toBe('value')
    expect(opt.yAxis.min).toBe(0)   // clamped to zero despite dataMin = 10
    expect(opt.yAxis.max).toBe(500)
  })

  it('negative data — min is not clamped when data goes below zero', () => {
    const f = LinearAxis({ axis: 'y', dataMin: -50, dataMax: 200 }, makeCtx())
    const opt = f.option as any
    expect(opt.yAxis.min).toBe(-50) // forceZeroBaseline suppressed by hasNegative
    expect(opt.yAxis.max).toBe(200)
  })

  it('applied to xAxis — type: value on xAxis, yAxis untouched; custom max override propagates', () => {
    const f = LinearAxis({ axis: 'x', dataMin: 0, dataMax: 1000 }, makeCtx())
    const opt = f.option as any
    expect(opt.xAxis).toBeDefined()
    expect(opt.yAxis).toBeUndefined()
    expect(opt.xAxis.type).toBe('value')
    expect(opt.xAxis.max).toBe(1000)
  })
})
