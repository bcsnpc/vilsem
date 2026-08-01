import { describe, it, expect } from 'vitest'
import { Legend } from './index'
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

describe('Legend', () => {
  it('legend.data populated from items array', () => {
    const items = [{ name: 'Series A', color: '#5EEAD4' }, { name: 'Series B', color: '#F59E0B' }]
    const f = Legend({ items }, makeCtx())
    const opt = f.option as any
    expect(opt.legend.show).toBe(true)
    expect(opt.legend.data).toHaveLength(2)
    expect(opt.legend.data[0]).toMatchObject({ name: 'Series A', itemStyle: { color: '#5EEAD4' } })
  })

  it('empty items → legend.show: false', () => {
    const f = Legend({ items: [] }, makeCtx())
    const opt = f.option as any
    expect(opt.legend.show).toBe(false)
  })

  it('position option propagates — bottom positions legend at bottom center', () => {
    const f = Legend({ position: 'bottom', items: [{ name: 'A' }] }, makeCtx())
    const opt = f.option as any
    expect(opt.legend.bottom).toBe(0)
    expect(opt.legend.left).toBe('center')
  })
})
