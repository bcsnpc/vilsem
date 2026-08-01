import { describe, it, expect } from 'vitest'
import { LineMarks, schema } from './index'
import type { PrimitiveContext } from '../contract'

function makeCtx(rows: Array<Record<string, unknown>> = []): PrimitiveContext {
  return {
    data: { fields: [], rows },
    encoding: {},
    theme: {
      textMuted: '#888', textPrimary: '#fff',
      gridStroke: 'rgba(255,255,255,0.06)',
      tooltipBg: 'rgba(15,23,42,0.95)', tooltipBorder: 'rgba(255,255,255,0.08)',
    } as any,
    selection: { selectedCat: null },
    dimensions: { width: 400, height: 300 },
  }
}

const SAMPLE = [
  { _cat: 'Jan', _val: 100 },
  { _cat: 'Feb', _val: 150 },
  { _cat: 'Mar', _val: 120 },
  { _cat: 'Apr', _val: 200 },
  { _cat: 'May', _val: 180 },
]

const SECONDARY = [
  { _cat: 'Jan', _val: 100, _val2: 50 },
  { _cat: 'Feb', _val: 150, _val2: 80 },
  { _cat: 'Mar', _val: 120, _val2: 60 },
]

describe('LineMarks — line/area output', () => {
  it('output shape — has xAxis, yAxis, single line series by default', () => {
    const f = LineMarks({ colorScheme: 'teal' }, makeCtx(SAMPLE))
    const opt = f.option as any
    expect(opt.xAxis.type).toBe('category')
    expect(opt.yAxis.type).toBe('value')
    expect(opt.series).toHaveLength(1)
    expect(opt.series[0].type).toBe('line')
  })

  it('data maps _cat→xAxis.data, _val→series.data', () => {
    const f = LineMarks({ colorScheme: 'teal' }, makeCtx(SAMPLE))
    const opt = f.option as any
    expect(opt.xAxis.data).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May'])
    expect(opt.series[0].data).toEqual([100, 150, 120, 200, 180])
  })

  it('null _val passes through as null (gaps in line)', () => {
    const rows = [{ _cat: 'A', _val: 10 }, { _cat: 'B', _val: null }, { _cat: 'C', _val: 30 }]
    const f = LineMarks({ colorScheme: 'teal' }, makeCtx(rows))
    expect((f.option as any).series[0].data).toEqual([10, null, 30])
  })

  it('chartType=line — series has no areaStyle', () => {
    const f = LineMarks({ colorScheme: 'teal', chartType: 'line' }, makeCtx(SAMPLE))
    expect((f.option as any).series[0].areaStyle).toBeUndefined()
  })

  it('chartType=area — series gets areaStyle with linear gradient', () => {
    const f = LineMarks({ colorScheme: 'teal', chartType: 'area' }, makeCtx(SAMPLE))
    const areaStyle = (f.option as any).series[0].areaStyle
    expect(areaStyle).toBeDefined()
    expect(areaStyle.color.type).toBe('linear')
    expect(areaStyle.color.colorStops).toHaveLength(2)
  })

  it('smooth=true sets series.smooth=true (monotone curve)', () => {
    const f = LineMarks({ colorScheme: 'teal', smooth: true }, makeCtx(SAMPLE))
    expect((f.option as any).series[0].smooth).toBe(true)
  })

  it('smooth=false sets series.smooth=false (sharp polyline)', () => {
    const f = LineMarks({ colorScheme: 'teal', smooth: false }, makeCtx(SAMPLE))
    expect((f.option as any).series[0].smooth).toBe(false)
  })

  it('strokeWidth propagates to series.lineStyle.width', () => {
    const f = LineMarks({ colorScheme: 'teal', strokeWidth: 4 }, makeCtx(SAMPLE))
    expect((f.option as any).series[0].lineStyle.width).toBe(4)
  })
})

describe('LineMarks — markers', () => {
  it('showDots=true with small dataset → series.symbol=circle', () => {
    const f = LineMarks({ colorScheme: 'teal', showDots: true }, makeCtx(SAMPLE))
    expect((f.option as any).series[0].symbol).toBe('circle')
  })

  it('showDots=false → series.symbol=none', () => {
    const f = LineMarks({ colorScheme: 'teal', showDots: false }, makeCtx(SAMPLE))
    expect((f.option as any).series[0].symbol).toBe('none')
  })

  it('dot visibility honors the showDots toggle regardless of row count', () => {
    // Auto-suppress for dense datasets was removed — user controls dot visibility
    // explicitly via the inspector toggle (dense lines may be noisy with dots,
    // but that's the user's call, not the primitive's).
    const big = Array.from({ length: 200 }, (_, i) => ({ _cat: `D${i}`, _val: i }))
    const onBig  = LineMarks({ colorScheme: 'teal', showDots: true  }, makeCtx(big))
    const offBig = LineMarks({ colorScheme: 'teal', showDots: false }, makeCtx(big))
    expect((onBig.option as any).series[0].symbol).toBe('circle')
    expect((offBig.option as any).series[0].symbol).toBe('none')
  })

  it('dotSize controls series.symbolSize (as diameter, ECharts convention)', () => {
    const f = LineMarks({ colorScheme: 'teal', showDots: true, dotSize: 5 }, makeCtx(SAMPLE))
    expect((f.option as any).series[0].symbolSize).toBe(10)   // 5 * 2 (radius → diameter)
  })
})

describe('LineMarks — secondary measure', () => {
  it('emits a 2nd series when any row has non-null _val2', () => {
    const f = LineMarks({ colorScheme: 'teal' }, makeCtx(SECONDARY))
    expect((f.option as any).series).toHaveLength(2)
  })

  it('secondary series uses dashed line style', () => {
    const f = LineMarks({ colorScheme: 'teal' }, makeCtx(SECONDARY))
    expect((f.option as any).series[1].lineStyle.type).toBe('dashed')
  })

  it('secondary series data maps from _val2', () => {
    const f = LineMarks({ colorScheme: 'teal' }, makeCtx(SECONDARY))
    expect((f.option as any).series[1].data).toEqual([50, 80, 60])
  })

  it('no secondary series when all _val2 are null/missing', () => {
    const f = LineMarks({ colorScheme: 'teal' }, makeCtx(SAMPLE))
    expect((f.option as any).series).toHaveLength(1)
  })

  it('stacked=true with secondary measure → both series get stack: "total"', () => {
    const f = LineMarks({ colorScheme: 'teal', stacked: true }, makeCtx(SECONDARY))
    const series = (f.option as any).series
    expect(series).toHaveLength(2)
    expect(series[0].stack).toBe('total')
    expect(series[1].stack).toBe('total')
  })

  it('stacked=false (or unset) → series.stack is undefined (no stacking)', () => {
    const off = LineMarks({ colorScheme: 'teal', stacked: false }, makeCtx(SECONDARY))
    const off2 = LineMarks({ colorScheme: 'teal' }, makeCtx(SECONDARY))   // default false
    expect((off.option as any).series[0].stack).toBeUndefined()
    expect((off.option as any).series[1].stack).toBeUndefined()
    expect((off2.option as any).series[0].stack).toBeUndefined()
  })

  it('stacked=true without secondary measure → primary still has no stack (nothing to stack against)', () => {
    const f = LineMarks({ colorScheme: 'teal', stacked: true }, makeCtx(SAMPLE))
    expect((f.option as any).series[0].stack).toBeUndefined()
  })

  it('stacked secondary uses solid stroke, not dashed (clearer reading of cumulative values)', () => {
    const stacked = LineMarks({ colorScheme: 'teal', stacked: true }, makeCtx(SECONDARY))
    const overlay = LineMarks({ colorScheme: 'teal', stacked: false }, makeCtx(SECONDARY))
    expect((stacked.option as any).series[1].lineStyle.type).toBeUndefined()  // solid (no `type`)
    expect((overlay.option as any).series[1].lineStyle.type).toBe('dashed')
  })
})

describe('LineMarks — reference lines', () => {
  it('showAvgLine=true emits a markLine entry at the mean of _val', () => {
    const f = LineMarks({ colorScheme: 'teal', showAvgLine: true }, makeCtx(SAMPLE))
    const data = (f.option as any).series[0].markLine.data
    expect(data).toHaveLength(1)
    // Mean of [100,150,120,200,180] = 150
    expect(data[0].yAxis).toBe(150)
  })

  it('targetLine=number emits a markLine entry at that value', () => {
    const f = LineMarks({ colorScheme: 'teal', targetLine: 175 }, makeCtx(SAMPLE))
    const data = (f.option as any).series[0].markLine.data
    expect(data).toHaveLength(1)
    expect(data[0].yAxis).toBe(175)
  })

  it('showAvgLine + targetLine emits both entries', () => {
    const f = LineMarks({ colorScheme: 'teal', showAvgLine: true, targetLine: 200 }, makeCtx(SAMPLE))
    expect((f.option as any).series[0].markLine.data).toHaveLength(2)
  })

  it('targetLine=0 or null is treated as no target (avoids accidental zero line)', () => {
    const f = LineMarks({ colorScheme: 'teal', targetLine: 0 }, makeCtx(SAMPLE))
    const f2 = LineMarks({ colorScheme: 'teal', targetLine: null }, makeCtx(SAMPLE))
    expect((f.option as any).series[0].markLine.data).toHaveLength(0)
    expect((f2.option as any).series[0].markLine.data).toHaveLength(0)
  })
})

describe('LineMarks — axes + animation + edge cases', () => {
  it('showXAxis=false sets xAxis.show=false', () => {
    const f = LineMarks({ colorScheme: 'teal', showXAxis: false }, makeCtx(SAMPLE))
    expect((f.option as any).xAxis.show).toBe(false)
  })

  it('showYAxis=true sets yAxis.show=true', () => {
    const f = LineMarks({ colorScheme: 'teal', showYAxis: true }, makeCtx(SAMPLE))
    expect((f.option as any).yAxis.show).toBe(true)
  })

  it('showGrid=true → yAxis.splitLine.show=true (horizontal gridlines)', () => {
    const f = LineMarks({ colorScheme: 'teal', showGrid: true }, makeCtx(SAMPLE))
    expect((f.option as any).yAxis.splitLine.show).toBe(true)
  })

  it('invertY=true sets yAxis.inverse=true (rank 1 at top — bump chart use case)', () => {
    const on  = LineMarks({ colorScheme: 'teal', invertY: true  }, makeCtx(SAMPLE))
    const off = LineMarks({ colorScheme: 'teal', invertY: false }, makeCtx(SAMPLE))
    expect((on.option as any).yAxis.inverse).toBe(true)
    expect((off.option as any).yAxis.inverse).toBe(false)
  })

  it('animation flag propagates to top-level option.animation', () => {
    const on  = LineMarks({ colorScheme: 'teal', animEnabled: true  }, makeCtx(SAMPLE))
    const off = LineMarks({ colorScheme: 'teal', animEnabled: false }, makeCtx(SAMPLE))
    expect((on.option as any).animation).toBe(true)
    expect((off.option as any).animation).toBe(false)
  })

  it('handles empty rows without throwing', () => {
    const f = LineMarks({ colorScheme: 'teal' }, makeCtx([]))
    const opt = f.option as any
    expect(opt.xAxis.data).toEqual([])
    expect(opt.series[0].data).toEqual([])
  })
})

describe('LineMarks — schema', () => {
  it('schema is complete — every customization key has a schema entry', () => {
    const keys = new Set(schema.map(f => f.key))
    ;['chartType', 'smooth', 'strokeWidth', 'fillOpacity',
      'showDots', 'dotSize', 'showGrid', 'showXAxis', 'showYAxis',
      'showAvgLine', 'targetLine'].forEach(k => {
      expect(keys.has(k), `schema missing key "${k}"`).toBe(true)
    })
  })

  it('chartType options are line + area only', () => {
    const field = schema.find(f => f.key === 'chartType')
    const values = (field!.options as any[]).map(o => o.value)
    expect(values).toEqual(['line', 'area'])
  })

  it('schema fields each declare a default and group', () => {
    schema.forEach(f => {
      expect(f.default).toBeDefined()
      expect(typeof f.group).toBe('string')
    })
  })
})
