import { describe, it, expect } from 'vitest'
import { allocateWaffleCells } from '../ui/src/appspec/shared/waffleAllocation.js'
describe('Waffle 100-cell allocation', () => {
  it('distributes rounding remainder deterministically', () => {
    expect(allocateWaffleCells([1,1,1])).toEqual([34,33,33])
    expect(allocateWaffleCells([1,1,1,1,1,1])).toEqual([17,17,17,17,16,16])
  })
  it('keeps zero, null and invalid values finite without invented cells', () => {
    expect(allocateWaffleCells([0,null,NaN,Infinity])).toEqual([0,0,0,0])
    expect(allocateWaffleCells([])).toEqual([])
  })
  it('preserves exact shares and existing negative magnitude semantics', () => {
    expect(allocateWaffleCells([25,50,75,100])).toEqual([10,20,30,40])
    expect(allocateWaffleCells([-1,3])).toEqual([25,75])
  })
  it('handles huge and tiny magnitudes without total overflow', () => {
    expect(allocateWaffleCells([1e308,1e308])).toEqual([50,50])
    expect(allocateWaffleCells([1e-300,1e-300])).toEqual([50,50])
  })
  it('allocates only 100 cells across dense categories', () => {
    const counts = allocateWaffleCells(Array(120).fill(1))
    expect(counts.reduce((a,b)=>a+b,0)).toBe(100)
    expect(counts.slice(0,100).every(c=>c===1)).toBe(true)
    expect(counts.slice(100)).toEqual(Array(20).fill(0))
  })
})
