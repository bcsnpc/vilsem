import { describe, expect, it } from 'vitest'
import { fmtAxisNumber } from '../ui/src/appspec/shared/formatters.js'

describe('Readable numeric axis ticks', () => {
  it.each([[1000,'1k'],[1200,'1.2k'],[1250,'1.25k'],[-1200,'-1.2k'],[1000000,'1M'],[1020000,'1.02M'],[1200000000,'1.2B']])('formats %s without whole-unit rounding', (value, expected) => {
    expect(fmtAxisNumber(value)).toBe(expected)
  })
  it('keeps small nonzero values visible', () => {
    expect(fmtAxisNumber(0.0001)).not.toBe(fmtAxisNumber(0))
    expect(fmtAxisNumber(-0.0001)).not.toBe(fmtAxisNumber(0))
  })
  it('keeps adjacent representative tick labels distinct', () => {
    for(const ticks of [[800,1000,1200],[1000000,1020000,1040000],[0,0.0001,0.0002]]) {
      expect(new Set(ticks.map(fmtAxisNumber)).size).toBe(ticks.length)
    }
  })
  it('retains safe invalid-value labels', () => {
    expect(fmtAxisNumber(Infinity)).toBe('--')
    expect(fmtAxisNumber('invalid')).toBe('--')
  })
})
