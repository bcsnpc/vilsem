import { describe, it, expect } from 'vitest'
import { Tooltip } from './index'
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

describe('Tooltip', () => {
  it('formatter renders measureName and formatted value for a single data point', () => {
    const f = Tooltip({ measureName: 'Revenue', accentColor: '#5EEAD4' }, makeCtx())
    const opt = f.option as any
    expect(opt.tooltip).toBeDefined()
    const html = opt.tooltip.formatter({ name: 'Product A', value: 1234 })
    expect(html).toContain('Product A')
    expect(html).toContain('Revenue')
    expect(html).toContain('1.2k') // fmtVal formats 1234 as 1.2k (lowercase)
  })

  it('prefix and suffix applied to formatted value', () => {
    const f = Tooltip({ prefix: '$', suffix: 'K', measureName: 'Sales' }, makeCtx())
    const opt = f.option as any
    const html = opt.tooltip.formatter({ name: 'Cat', value: 500 })
    // fmtVal with prefix='$' suffix='K' on 500 → '$500K' or similar
    expect(html).toContain('$')
    expect(html).toContain('K')
  })

  it('tooltip styling — dark background and correct structure in HTML output', () => {
    const f = Tooltip({ accentColor: '#FF6B6B' }, makeCtx())
    const opt = f.option as any
    const html = opt.tooltip.formatter({ name: 'X', value: 42 })
    expect(html).toContain('background:#0e0e1c')
    expect(html).toContain('#FF6B6B') // accent color applied
  })
})
