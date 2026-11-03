import { describe, it, expect } from 'vitest'
import { BarMarks } from './index'
import type { PrimitiveContext } from '../contract'

function makeCtx(rows: Array<{ _cat: string; _val: number }> = [], selectedCat: string | string[] | null = null): PrimitiveContext {
  return {
    data: { fields: [], rows },
    encoding: {},
    theme: {
      textMuted: '#888', textSecondary: '#aaa', textPrimary: '#fff', gridStroke: '#333',
    } as any,
    selection: { selectedCat },
    dimensions: { width: 400, height: 300 },
  }
}

const SAMPLE_ROWS = [
  { _cat: 'Alpha', _val: 100 },
  { _cat: 'Beta',  _val: 60  },
  { _cat: 'Gamma', _val: 30  },
]

describe('BarMarks', () => {
  it('basic output shape — series.type bar, data array length matches rows', () => {
    const f = BarMarks({ colorScheme: 'teal' }, makeCtx(SAMPLE_ROWS))
    const opt = f.option as any
    expect(opt.series).toHaveLength(1)
    expect(opt.series[0].type).toBe('bar')
    expect(opt.series[0].data).toHaveLength(SAMPLE_ROWS.length)
    SAMPLE_ROWS.forEach((row, i) => {
      expect(opt.series[0].data[i].value).toBe(row._val)
    })
  })

  it('rankOpacity — per-item itemStyle.color set as rgba string with varying opacity', () => {
    const f = BarMarks({ colorScheme: 'teal', rankOpacity: true, gradient: false }, makeCtx(SAMPLE_ROWS))
    const opt = f.option as any
    const colors = opt.series[0].data.map((d: any) => d.itemStyle.color)
    // All should be rgba strings
    colors.forEach((c: string) => expect(c).toMatch(/^rgba/))
    // First bar (highest, desc order) should have higher opacity than last
    const opacityOf = (c: string) => parseFloat(c.split(',')[3])
    expect(opacityOf(colors[0])).toBeGreaterThan(opacityOf(colors[2]))
  })

  it('markLine for avg reference line — data entry at correct value with dashed style', () => {
    const avgLine = { val: 63, color: '#F59E0B', label: 'Avg', dash: '4 4' }
    const f = BarMarks({ colorScheme: 'teal', refLines: [avgLine] }, makeCtx(SAMPLE_ROWS))
    const opt = f.option as any
    expect(opt.series[0].markLine).toBeDefined()
    const lineData = opt.series[0].markLine.data
    expect(lineData).toHaveLength(1)
    // single-point format: each entry is an object (not a two-point array)
    expect(lineData[0].xAxis).toBe(63)
    expect(lineData[0].lineStyle.color).toBe('#F59E0B')
  })

  it('markLine for target reference line — separate entry, different color', () => {
    const targetLine = { val: 80, color: '#F43F5E', label: 'Target', dash: '6 3' }
    const f = BarMarks({ colorScheme: 'teal', refLines: [targetLine] }, makeCtx(SAMPLE_ROWS))
    const opt = f.option as any
    const lineData = opt.series[0].markLine.data
    expect(lineData[0].xAxis).toBe(80)
    expect(lineData[0].lineStyle.color).toBe('#F43F5E')
  })

  it('secondaryData — emits a 2nd bar series with values from secondaryData array', () => {
    const f = BarMarks({
      colorScheme: 'teal',
      secondaryData: [40, 30, 20],
      secondaryMeasureName: 'Profit',
    }, makeCtx(SAMPLE_ROWS))
    const opt = f.option as any
    expect(opt.series).toHaveLength(2)
    expect(opt.series[1].type).toBe('bar')
    expect(opt.series[1].name).toBe('Profit')
    expect(opt.series[1].data.map((d: any) => d.value)).toEqual([40, 30, 20])
  })

  it('no 2nd series when secondaryData is missing/empty', () => {
    const f1 = BarMarks({ colorScheme: 'teal' }, makeCtx(SAMPLE_ROWS))
    const f2 = BarMarks({ colorScheme: 'teal', secondaryData: [] }, makeCtx(SAMPLE_ROWS))
    expect((f1.option as any).series).toHaveLength(1)
    expect((f2.option as any).series).toHaveLength(1)
  })

  it('stacked=true with secondary — both series get stack:"total"', () => {
    const f = BarMarks({
      colorScheme: 'teal', stacked: true,
      secondaryData: [40, 30, 20],
    }, makeCtx(SAMPLE_ROWS))
    const series = (f.option as any).series
    expect(series[0].stack).toBe('total')
    expect(series[1].stack).toBe('total')
  })

  it('stacked=false (or unset) → series.stack undefined (no stacking)', () => {
    const off = BarMarks({
      colorScheme: 'teal', stacked: false,
      secondaryData: [40, 30, 20],
    }, makeCtx(SAMPLE_ROWS))
    expect((off.option as any).series[0].stack).toBeUndefined()
    expect((off.option as any).series[1].stack).toBeUndefined()
  })

  it('stacked=true without secondary → primary still has no stack (nothing to stack against)', () => {
    const f = BarMarks({ colorScheme: 'teal', stacked: true }, makeCtx(SAMPLE_ROWS))
    expect((f.option as any).series[0].stack).toBeUndefined()
  })

  it('secondaryColor overrides scheme p.mid for the 2nd series base color', () => {
    const f = BarMarks({
      colorScheme: 'teal',
      secondaryData: [40, 30, 20],
      secondaryColor: '#FF00FF',
      rankOpacity: false,
    }, makeCtx(SAMPLE_ROWS))
    const series = (f.option as any).series
    // Without rankOpacity the alpha is 0.80, and secondary uses secondaryColor as base.
    // hexToRgb(#FF00FF) = [255, 0, 255]
    series[1].data.forEach((d: any) => {
      expect(d.itemStyle.color).toMatch(/^rgba\(255,0,255,/)
    })
  })

  it('secondary inherits per-bar opacity from primary (rankOpacity unifies the stacked bar visually)', () => {
    const f = BarMarks({
      colorScheme: 'teal',
      secondaryData: [40, 30, 20],
      rankOpacity: true,
      gradient: false,
    }, makeCtx(SAMPLE_ROWS))
    const series = (f.option as any).series
    // Pull alpha from each primary bar's color and verify secondary mirrors it
    const alphaOf = (rgba: string) => parseFloat(rgba.split(',')[3])
    for (let i = 0; i < SAMPLE_ROWS.length; i++) {
      const primaryAlpha   = alphaOf(series[0].data[i].itemStyle.color)
      const secondaryAlpha = alphaOf(series[1].data[i].itemStyle.color)
      expect(secondaryAlpha).toBeCloseTo(primaryAlpha, 2)
    }
  })
})

it('keeps both selected categories emphasized', () => {
 const f = BarMarks({},makeCtx(SAMPLE_ROWS,['Alpha','Beta']))
 const data = (f.option.series as any[])[0].data
 expect(data[0].itemStyle.opacity).not.toBe(0.25)
 expect(data[1].itemStyle.opacity).not.toBe(0.25)
 expect(data[2].itemStyle.opacity).toBe(0.25)
})
