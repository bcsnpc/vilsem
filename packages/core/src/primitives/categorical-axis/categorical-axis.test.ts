import { describe, it, expect } from 'vitest'
import { CategoricalAxis } from './index'
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

describe('CategoricalAxis', () => {
  it('applied to xAxis — type: category, data array set on xAxis', () => {
    const f = CategoricalAxis({ axis: 'x', categories: ['A', 'B', 'C'] }, makeCtx())
    const opt = f.option as any
    expect(opt.xAxis).toBeDefined()
    expect(opt.yAxis).toBeUndefined()
    expect(opt.xAxis.type).toBe('category')
    expect(opt.xAxis.data).toEqual(['A', 'B', 'C'])
  })

  it('applied to yAxis — type: category on yAxis, xAxis untouched', () => {
    const f = CategoricalAxis({ axis: 'y', categories: ['X', 'Y', 'Z'] }, makeCtx())
    const opt = f.option as any
    expect(opt.yAxis).toBeDefined()
    expect(opt.xAxis).toBeUndefined()
    expect(opt.yAxis.type).toBe('category')
    expect(opt.yAxis.data).toEqual(['X', 'Y', 'Z'])
  })

  it('label truncation applied — categories longer than labelMaxLength are truncated', () => {
    const longCat = 'Abcdefghijklmnopqrstuvwxyz' // 26 chars
    const f = CategoricalAxis({ axis: 'y', categories: [longCat], labelMaxLength: 12 }, makeCtx())
    const opt = f.option as any
    // truncateAxisLabel should have shortened it
    expect(opt.yAxis.data[0].length).toBeLessThanOrEqual(15) // truncated + ellipsis
    expect(opt.yAxis.data[0]).not.toBe(longCat)
  })
})
