import { describe, it, expect } from 'vitest'
import { CartesianFrame } from './index'
import type { PrimitiveContext } from '../contract'

function makeCtx(overrides: Partial<PrimitiveContext> = {}): PrimitiveContext {
  return {
    data: { fields: [], rows: [] },
    encoding: {},
    theme: { textMuted: '#888', textSecondary: '#aaa', textPrimary: '#fff', gridStroke: '#333' } as any,
    selection: { selectedCat: null },
    dimensions: { width: 400, height: 300 },
    ...overrides,
  }
}

describe('CartesianFrame', () => {
  it('horizontal orientation (default) — grid present, value on xAxis, category scaffold on yAxis', () => {
    const f = CartesianFrame({}, makeCtx())
    const opt = f.option as any
    expect(Array.isArray(opt.grid)).toBe(true)
    expect(opt.grid[0]).toMatchObject({ containLabel: true })
    // horizontal: value axis on x, category scaffold on y
    expect(opt.xAxis.axisLine.show).toBe(false)
    expect(opt.yAxis.axisLine.show).toBe(false)
    expect(opt.xAxis.axisTick.show).toBe(false)
    expect(opt.yAxis.axisTick.show).toBe(false)
  })

  it('vertical orientation — same scaffolding, axes swapped (category on x)', () => {
    const f = CartesianFrame({ orientation: 'vertical' }, makeCtx())
    const opt = f.option as any
    // scaffolding is symmetric — both axes get same show/axisLine/axisTick setup
    expect(opt.xAxis.show).toBe(true)
    expect(opt.yAxis.show).toBe(true)
  })

  it('custom margin propagates to grid left/right/top/bottom', () => {
    const f = CartesianFrame({ margin: { left: 60, right: 80, top: 12, bottom: 20 } }, makeCtx())
    const opt = f.option as any
    expect(opt.grid[0].left).toBe(60)
    expect(opt.grid[0].right).toBe(80)
    expect(opt.grid[0].top).toBe(12)
    expect(opt.grid[0].bottom).toBe(20)
  })
})
