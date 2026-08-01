import { describe, it, expect } from 'vitest'
import { PieMarks, schema } from './index'
import type { PrimitiveContext } from '../contract'

function makeCtx(rows: Array<Record<string, unknown>> = []): PrimitiveContext {
  return {
    data: { fields: [], rows },
    encoding: {},
    theme: {
      textPrimary: '#fff', textMuted: '#94A3B8',
      shimmerBg: 'rgba(255,255,255,0.05)',
      tooltipBg: 'rgba(15,23,42,0.95)', tooltipBorder: 'rgba(255,255,255,0.08)',
    } as any,
    selection: { selectedCat: null },
    dimensions: { width: 400, height: 300 },
  }
}

const MULTI_ROWS = [
  { _cat: 'Apparel',  _val: 400 },
  { _cat: 'Books',    _val: 200 },
  { _cat: 'Toys',     _val: 100 },
  { _cat: 'Home',     _val: 50 },
]

describe('PieMarks — multi-segment donut/pie mode', () => {
  it('output shape — single pie series, no axes', () => {
    const f = PieMarks({ colorScheme: 'teal' }, makeCtx(MULTI_ROWS))
    const opt = f.option as any
    expect(opt.series).toHaveLength(1)
    expect(opt.series[0].type).toBe('pie')
    expect(opt.xAxis).toBeUndefined()
    expect(opt.yAxis).toBeUndefined()
  })

  it('data maps _cat→name, _val→value (absolute, since pie requires positive segments)', () => {
    const rows = [{ _cat: 'A', _val: -100 }, { _cat: 'B', _val: 200 }]
    const f = PieMarks({ colorScheme: 'teal' }, makeCtx(rows))
    const data = (f.option as any).series[0].data
    expect(data[0].name).toBe('A')
    expect(data[0].value).toBe(100)        // abs of -100
    expect(data[1].value).toBe(200)
  })

  it('innerRadius and outerRadius drive series radius array', () => {
    const f = PieMarks({ colorScheme: 'teal', innerRadius: 40, outerRadius: 90 }, makeCtx(MULTI_ROWS))
    expect((f.option as any).series[0].radius).toEqual(['40%', '90%'])
  })

  it('innerRadius=0 produces a pie (radius starts at 0%)', () => {
    const f = PieMarks({ colorScheme: 'teal', innerRadius: 0 }, makeCtx(MULTI_ROWS))
    expect((f.option as any).series[0].radius[0]).toBe('0%')
  })

  it('paddingAngle and cornerRadius propagate', () => {
    const f = PieMarks({ colorScheme: 'teal', paddingAngle: 5, cornerRadius: 8 }, makeCtx(MULTI_ROWS))
    const series = (f.option as any).series[0]
    expect(series.padAngle).toBe(5)
    expect(series.itemStyle.borderRadius).toBe(8)
  })

  it('color palette uses MULTI_COLORS by default', () => {
    const f = PieMarks({ colorScheme: 'teal' }, makeCtx(MULTI_ROWS))
    const colors = (f.option as any).color
    expect(Array.isArray(colors)).toBe(true)
    expect(colors.length).toBeGreaterThanOrEqual(4)
  })

  it('customColors prop overrides default palette', () => {
    const f = PieMarks({ colorScheme: 'teal', customColors: ['#FF0000', '#00FF00', '#0000FF'] },
      makeCtx(MULTI_ROWS))
    expect((f.option as any).color).toEqual(['#FF0000', '#00FF00', '#0000FF'])
  })

  it('showLegend=false sets legend.show=false (block stays so ECharts merge clears the old legend)', () => {
    const f = PieMarks({ colorScheme: 'teal', showLegend: false }, makeCtx(MULTI_ROWS))
    expect((f.option as any).legend.show).toBe(false)
  })

  it('legendPosition=right → vertical orient on the right side', () => {
    const f = PieMarks({ colorScheme: 'teal', showLegend: true, legendPosition: 'right' }, makeCtx(MULTI_ROWS))
    const legend = (f.option as any).legend
    expect(legend.orient).toBe('vertical')
    expect(legend.right).toBeDefined()
    expect(legend.bottom).toBeUndefined()
  })

  it('legendPosition=bottom → horizontal orient at the bottom', () => {
    const f = PieMarks({ colorScheme: 'teal', showLegend: true, legendPosition: 'bottom' }, makeCtx(MULTI_ROWS))
    const legend = (f.option as any).legend
    expect(legend.orient).toBe('horizontal')
    expect(legend.bottom).toBeDefined()
  })

  it('maxLegendItems truncates legend.data (chart still shows all rows)', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ _cat: `Cat${i}`, _val: 10 }))
    const f = PieMarks({ colorScheme: 'teal', maxLegendItems: 4 }, makeCtx(rows))
    const opt = f.option as any
    expect(opt.legend.data).toHaveLength(4)            // legend truncated
    expect(opt.series[0].data).toHaveLength(10)        // chart unchanged
  })

  it('showLabels: false → series.label.show is false', () => {
    const f = PieMarks({ colorScheme: 'teal', showLabels: false }, makeCtx(MULTI_ROWS))
    expect((f.option as any).series[0].label.show).toBe(false)
  })

  it('labelStyle=percent → formatter returns percent of total', () => {
    const f = PieMarks({ colorScheme: 'teal', showLabels: true, labelStyle: 'percent' }, makeCtx(MULTI_ROWS))
    const formatter = (f.option as any).series[0].label.formatter
    // Apparel = 400 / (400+200+100+50=750) → ~53%
    expect(formatter({ name: 'Apparel', value: 400 })).toBe('53%')
  })

  it('labelStyle=value → formatter returns formatted raw value', () => {
    const f = PieMarks({ colorScheme: 'teal', showLabels: true, labelStyle: 'value' }, makeCtx(MULTI_ROWS))
    const out = (f.option as any).series[0].label.formatter({ name: 'Apparel', value: 400 })
    expect(out).toContain('400')
  })

  it('labelStyle=name → formatter returns the category name (truncated if long)', () => {
    const f = PieMarks({ colorScheme: 'teal', showLabels: true, labelStyle: 'name' }, makeCtx(MULTI_ROWS))
    const formatter = (f.option as any).series[0].label.formatter
    expect(formatter({ name: 'Apparel', value: 400 })).toBe('Apparel')
    expect(formatter({ name: 'AVeryLongCategoryName', value: 1 })).toBe('AVeryLong…')
  })

  it('showCenterText=true with donut innerRadius emits title.show=true with formatted total text', () => {
    const f = PieMarks({ colorScheme: 'teal', innerRadius: 60, showCenterText: true }, makeCtx(MULTI_ROWS))
    const title = (f.option as any).title
    expect(title.show).toBe(true)
    expect(title.text).toContain('750')   // sum of MULTI_ROWS values
    expect(title.textAlign).toBe('center')
    expect(title.textVerticalAlign).toBe('middle')
  })

  it('showCenterText=true with pie (innerRadius=0) sets title.show=false', () => {
    const f = PieMarks({ colorScheme: 'teal', innerRadius: 0, showCenterText: true }, makeCtx(MULTI_ROWS))
    expect((f.option as any).title.show).toBe(false)
  })

  it('animation flag controls option.animation', () => {
    const on  = PieMarks({ colorScheme: 'teal', animEnabled: true  }, makeCtx(MULTI_ROWS))
    const off = PieMarks({ colorScheme: 'teal', animEnabled: false }, makeCtx(MULTI_ROWS))
    expect((on.option as any).animation).toBe(true)
    expect((off.option as any).animation).toBe(false)
  })
})

describe('PieMarks — single-measure radial progress mode', () => {
  it('triggers when rows.length === 1', () => {
    const f = PieMarks({ colorScheme: 'teal' }, makeCtx([{ _cat: '', _val: 50 }]))
    const series = (f.option as any).series[0]
    expect(series.silent).toBe(true)
    expect(series.data).toHaveLength(2)         // [filled, remainder]
  })

  it('fill ratio = value / maxValue (clamped to 1)', () => {
    const f = PieMarks({ colorScheme: 'teal', maxValue: 100 }, makeCtx([{ _val: 25 }]))
    const data = (f.option as any).series[0].data
    expect(data[0].value).toBe(0.25)
    expect(data[1].value).toBe(0.75)
  })

  it('clamps fill at 1 when value exceeds maxValue', () => {
    const f = PieMarks({ colorScheme: 'teal', maxValue: 100 }, makeCtx([{ _val: 250 }]))
    const data = (f.option as any).series[0].data
    expect(data[0].value).toBe(1)
    expect(data[1].value).toBe(0)
  })

  it('center text shows the formatted raw value when showCenterText=true', () => {
    const f = PieMarks({
      colorScheme: 'teal', maxValue: 100, showCenterText: true, prefix: '$',
    }, makeCtx([{ _val: 42 }]))
    const title = (f.option as any).title
    expect(title.show).toBe(true)
    expect(title.text).toContain('42')
  })

  it('showCenterText=false sets title.show=false', () => {
    const f = PieMarks({ colorScheme: 'teal', showCenterText: false }, makeCtx([{ _val: 42 }]))
    expect((f.option as any).title.show).toBe(false)
  })

  it('no legend in radial progress mode (single-measure mode never emits legend)', () => {
    const f = PieMarks({ colorScheme: 'teal', showLegend: true }, makeCtx([{ _val: 42 }]))
    // Radial progress mode skips the multi-segment branch entirely, so legend block isn't emitted.
    expect((f.option as any).legend).toBeUndefined()
  })
})

describe('PieMarks — schema', () => {
  it('schema is complete — every PieMarksProps customization key has a schema entry', () => {
    const keys = new Set(schema.map(f => f.key))
    ;['innerRadius', 'outerRadius', 'paddingAngle', 'cornerRadius',
      'showLegend', 'legendPosition', 'maxLegendItems',
      'showLabels', 'labelStyle', 'showCenterText'].forEach(k => {
      expect(keys.has(k), `schema missing key "${k}"`).toBe(true)
    })
  })

  it('schema fields each declare a default and group', () => {
    schema.forEach(f => {
      expect(f.default).toBeDefined()
      expect(typeof f.group).toBe('string')
    })
  })

  it('legendPosition options match the two documented positions', () => {
    const field = schema.find(f => f.key === 'legendPosition')
    expect(field?.options).toBeDefined()
    const values = (field!.options as any[]).map(o => o.value)
    expect(values).toEqual(['right', 'bottom'])
  })

  it('labelStyle options match the three documented styles', () => {
    const field = schema.find(f => f.key === 'labelStyle')
    const values = (field!.options as any[]).map(o => o.value)
    expect(values).toEqual(['percent', 'value', 'name'])
  })

  it('handles empty rows without throwing', () => {
    const f = PieMarks({ colorScheme: 'teal' }, makeCtx([]))
    expect((f.option as any).series[0].data).toHaveLength(0)
  })
})
