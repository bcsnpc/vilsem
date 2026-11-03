import { describe, it, expect } from 'vitest'
import { TreemapMarks, schema } from './index'
import type { PrimitiveContext } from '../contract'

function makeCtx(rows: Array<Record<string, unknown>> = []): PrimitiveContext {
  return {
    data: { fields: [], rows },
    encoding: {},
    theme: {
      textMuted: '#888', textPrimary: '#fff',
      tooltipBg: 'rgba(15,23,42,0.95)', tooltipBorder: 'rgba(255,255,255,0.08)',
    } as any,
    selection: { selectedCat: null },
    dimensions: { width: 400, height: 300 },
  }
}

const SAMPLE_ROWS = [
  { _cat: 'Alpha',   _val: 100 },
  { _cat: 'Beta',    _val: 200 },
  { _cat: 'Gamma',   _val: 50 },
]

describe('TreemapMarks', () => {
  it('output shape — single treemap series, no axes', () => {
    const f = TreemapMarks({ colorScheme: 'teal' }, makeCtx(SAMPLE_ROWS))
    const opt = f.option as any
    expect(opt.series).toHaveLength(1)
    expect(opt.series[0].type).toBe('treemap')
    // Treemap doesn't use xAxis/yAxis — confirm we're not emitting them
    expect(opt.xAxis).toBeUndefined()
    expect(opt.yAxis).toBeUndefined()
  })

  it('data maps _cat→name, _val→value (absolute, since treemap requires positive sizes)', () => {
    const rows = [{ _cat: 'A', _val: -100 }, { _cat: 'B', _val: 200 }]
    const f = TreemapMarks({ colorScheme: 'teal' }, makeCtx(rows))
    const data = (f.option as any).series[0].data
    expect(data[0].name).toBe('A')
    expect(data[0].value).toBe(100)        // abs of -100
    expect(data[0]._rawValue).toBe(-100)   // original preserved
    expect(data[1].value).toBe(200)
  })

  it('colorMode: single — all tiles use scheme primary at fixed opacity 0.8', () => {
    const f = TreemapMarks({ colorScheme: 'teal', colorMode: 'single' }, makeCtx(SAMPLE_ROWS))
    const data = (f.option as any).series[0].data
    const colors = new Set(data.map((d: any) => d.itemStyle.color))
    expect(colors.size).toBe(1)            // all the same color
    data.forEach((d: any) => expect(d.itemStyle.opacity).toBe(0.8))
  })

  it('colorMode: gradient — tiles share a single color but opacity scales with value', () => {
    const f = TreemapMarks({ colorScheme: 'teal', colorMode: 'gradient' }, makeCtx(SAMPLE_ROWS))
    const data = (f.option as any).series[0].data
    const colors = new Set(data.map((d: any) => d.itemStyle.color))
    expect(colors.size).toBe(1)
    // Largest value (200) should have highest opacity; smallest (50) lowest
    const beta  = data.find((d: any) => d.name === 'Beta')
    const gamma = data.find((d: any) => d.name === 'Gamma')
    expect(beta.itemStyle.opacity).toBeGreaterThan(gamma.itemStyle.opacity)
    expect(beta.itemStyle.opacity).toBeLessThanOrEqual(0.9)
    expect(gamma.itemStyle.opacity).toBeGreaterThanOrEqual(0.4)
  })

  it('colorMode: multi — tiles rotate through MULTI_COLORS palette, fixed opacity 0.8', () => {
    const f = TreemapMarks({ colorScheme: 'teal', colorMode: 'multi' }, makeCtx(SAMPLE_ROWS))
    const data = (f.option as any).series[0].data
    const colors = new Set(data.map((d: any) => d.itemStyle.color))
    expect(colors.size).toBe(3)            // 3 distinct colors for 3 tiles
    data.forEach((d: any) => expect(d.itemStyle.opacity).toBe(0.8))
  })

  it('colorMode: multi — customColors prop overrides default palette', () => {
    const f = TreemapMarks({ colorScheme: 'teal', colorMode: 'multi', customColors: ['#FF0000', '#00FF00'] },
      makeCtx(SAMPLE_ROWS))
    const data = (f.option as any).series[0].data
    expect(data[0].itemStyle.color).toBe('#FF0000')
    expect(data[1].itemStyle.color).toBe('#00FF00')
    expect(data[2].itemStyle.color).toBe('#FF0000')   // wraps via i % palette.length
  })

  it('borderRadius / borderWidth / borderColor propagate to tile itemStyle', () => {
    const f = TreemapMarks({
      colorScheme: 'teal', borderRadius: 6, borderWidth: 2, borderColor: '#FF00FF',
    }, makeCtx(SAMPLE_ROWS))
    const data = (f.option as any).series[0].data
    data.forEach((d: any) => {
      expect(d.itemStyle.borderRadius).toBe(6)
      expect(d.itemStyle.borderWidth).toBe(2)
      expect(d.itemStyle.borderColor).toBe('#FF00FF')
    })
  })

  it('label visibility — series.label.show is true when showLabels OR showValues is true', () => {
    const noLabels = TreemapMarks({ colorScheme: 'teal', showLabels: false, showValues: false },
      makeCtx(SAMPLE_ROWS))
    const onlyValues = TreemapMarks({ colorScheme: 'teal', showLabels: false, showValues: true },
      makeCtx(SAMPLE_ROWS))
    const onlyLabels = TreemapMarks({ colorScheme: 'teal', showLabels: true, showValues: false },
      makeCtx(SAMPLE_ROWS))
    expect((noLabels.option as any).series[0].label.show).toBe(false)
    expect((onlyValues.option as any).series[0].label.show).toBe(true)
    expect((onlyLabels.option as any).series[0].label.show).toBe(true)
  })

  it('animation flag controls option.animation', () => {
    const on  = TreemapMarks({ colorScheme: 'teal', animEnabled: true  }, makeCtx(SAMPLE_ROWS))
    const off = TreemapMarks({ colorScheme: 'teal', animEnabled: false }, makeCtx(SAMPLE_ROWS))
    expect((on.option as any).animation).toBe(true)
    expect((off.option as any).animation).toBe(false)
  })

  it('handles empty rows without throwing', () => {
    const f = TreemapMarks({ colorScheme: 'teal' }, makeCtx([]))
    const opt = f.option as any
    expect(opt.series[0].data).toHaveLength(0)
  })

  it('series disables drill-down (roam, nodeClick, breadcrumb all off)', () => {
    const f = TreemapMarks({ colorScheme: 'teal' }, makeCtx(SAMPLE_ROWS))
    const series = (f.option as any).series[0]
    expect(series.roam).toBe(false)
    expect(series.nodeClick).toBe(false)
    expect(series.breadcrumb.show).toBe(false)
  })

  it('schema is complete — every TreemapMarksProps customization key has a schema entry', () => {
    const keys = new Set(schema.map(f => f.key))
    ;['showLabels', 'showValues', 'colorMode', 'borderRadius', 'borderWidth',
      'labelColor', 'valueColor', 'labelFontSize', 'valueFontSize', 'padding'].forEach(k => {
      expect(keys.has(k), `schema missing key "${k}"`).toBe(true)
    })
  })

  it('label rich-text — labelColor and valueColor propagate to series.label.rich', () => {
    const f = TreemapMarks({
      colorScheme: 'teal', labelColor: '#FF0000', valueColor: '#00FF00',
      labelFontSize: 14, valueFontSize: 11,
    }, makeCtx(SAMPLE_ROWS))
    const label = (f.option as any).series[0].label
    expect(label.rich.name.color).toBe('#FF0000')
    expect(label.rich.name.fontSize).toBe(14)
    expect(label.rich.value.color).toBe('#00FF00')
    expect(label.rich.value.fontSize).toBe(11)
  })

  it('label formatter emits rich-text segments {name|...} and {value|...}', () => {
    const f = TreemapMarks({ colorScheme: 'teal', showLabels: true, showValues: true },
      makeCtx(SAMPLE_ROWS))
    const formatter = (f.option as any).series[0].label.formatter
    const out = formatter({ name: 'Alpha', value: 100, data: { _rawValue: 100 } })
    expect(out).toContain('{name|Alpha}')
    expect(out).toContain('{value|')
  })

  it('padding prop sets series top/bottom/left/right (default 0 fills container)', () => {
    const noPad = TreemapMarks({ colorScheme: 'teal' }, makeCtx(SAMPLE_ROWS))
    const withPad = TreemapMarks({ colorScheme: 'teal', padding: 12 }, makeCtx(SAMPLE_ROWS))
    const a = (noPad.option as any).series[0]
    const b = (withPad.option as any).series[0]
    expect(a.top).toBe(0)
    expect(a.bottom).toBe(0)
    expect(a.left).toBe(0)
    expect(a.right).toBe(0)
    expect(b.top).toBe(12)
    expect(b.bottom).toBe(12)
    expect(b.left).toBe(12)
    expect(b.right).toBe(12)
  })

  it('schema fields each declare a default and group', () => {
    schema.forEach(f => {
      expect(f.default).toBeDefined()
      expect(typeof f.group).toBe('string')
    })
  })

  it('colorMode select options match the three documented modes', () => {
    const colorModeField = schema.find(f => f.key === 'colorMode')
    expect(colorModeField?.options).toBeDefined()
    const values = (colorModeField!.options as any[]).map(o => o.value)
    expect(values).toEqual(['single', 'gradient', 'multi'])
  })
})
