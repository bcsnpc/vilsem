import { describe, it, expect } from 'vitest'
import { mergeFragments } from './composer'
import type { PrimitiveFragment } from './contract'

describe('mergeFragments', () => {
  // C1: empty input
  it('C5: empty fragment array returns safe empty option', () => {
    expect(mergeFragments([])).toEqual({})
  })

  // C2: single fragment passthrough
  it('C1: single fragment — output equals fragment.option (no mutation)', () => {
    const f: PrimitiveFragment = {
      option: { animation: false, grid: [{ left: 10 }], tooltip: { trigger: 'axis' } },
    }
    const result = mergeFragments([f])
    expect(result).toEqual(f.option)
    // verify no mutation
    expect(f.option.animation).toBe(false)
  })

  // C3: two fragments deep-merge
  it('C2: two fragments — later wins on scalar conflict, earlier keys preserved', () => {
    const f1: PrimitiveFragment = {
      option: { xAxis: { show: true, axisLine: { show: false } } as any },
    }
    const f2: PrimitiveFragment = {
      option: { xAxis: { type: 'category', data: ['A', 'B', 'C'] } as any },
    }
    const result = mergeFragments([f1, f2]) as any
    expect(result.xAxis.type).toBe('category')
    expect(result.xAxis.data).toEqual(['A', 'B', 'C'])
    expect(result.xAxis.show).toBe(true)           // preserved from f1
    expect(result.xAxis.axisLine.show).toBe(false) // nested key preserved from f1
  })

  // C4: structural collision on grid
  it('C3: structural collision — two fragments both provide grid, later wins', () => {
    const f1: PrimitiveFragment = { option: { grid: [{ left: 40, top: 10 }] } }
    const f2: PrimitiveFragment = { option: { grid: [{ left: 80 }] } }
    const result = mergeFragments([f1, f2]) as any
    // arrays replaced by later fragment
    expect(result.grid[0].left).toBe(80)
    expect(result.grid[0].top).toBeUndefined() // f2 wins — f1's top is gone (array replaced)
  })

  // C5: scale contributions from two fragments
  it('C4: scale contributions from two fragments — min-of-mins, max-of-maxes on yAxis', () => {
    const f1: PrimitiveFragment = {
      option: { yAxis: { type: 'value' } as any },
      contributions: { scales: [{ axis: 'y', min: 0, max: 100 }] },
    }
    const f2: PrimitiveFragment = {
      option: { series: [{ type: 'bar', data: [] }] as any },
      contributions: { scales: [{ axis: 'y', min: -20, max: 200 }] },
    }
    const result = mergeFragments([f1, f2]) as any
    expect(result.yAxis.min).toBe(-20)  // min(0, -20)
    expect(result.yAxis.max).toBe(200)  // max(100, 200)
    expect(result.yAxis.type).toBe('value') // preserved from f1
  })

  // Bonus: series from multiple fragments are concatenated, not replaced
  it('series from multiple fragments are concatenated', () => {
    const f1: PrimitiveFragment = { option: { series: [{ type: 'bar', name: 'A' }] as any } }
    const f2: PrimitiveFragment = { option: { series: [{ type: 'bar', name: 'B' }] as any } }
    const result = mergeFragments([f1, f2]) as any
    expect(result.series).toHaveLength(2)
    expect(result.series[0].name).toBe('A')
    expect(result.series[1].name).toBe('B')
  })
})
