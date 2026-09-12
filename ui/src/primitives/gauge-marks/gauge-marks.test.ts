import { describe, it, expect } from 'vitest'
import { GaugeMarks, schema } from './index'
import type { PrimitiveContext } from '../contract'

function makeCtx(val: number | null = null): PrimitiveContext {
  return {
    data: { fields: [], rows: val != null ? [{ _val: val }] : [] },
    encoding: {},
    theme: {
      textMuted: '#888', textSecondary: '#aaa', textPrimary: '#fff',
      gridStroke: 'rgba(255,255,255,0.1)',
      shimmerBg: 'rgba(255,255,255,0.08)',
    } as any,
    selection: { selectedCat: null },
    dimensions: { width: 300, height: 200 },
  }
}

describe('GaugeMarks', () => {
  it('output shape — gauge type, progress shown, no pointer/anchor/ticks', () => {
    const f = GaugeMarks({ colorScheme: 'teal' }, makeCtx(42))
    const series = (f.option as any).series[0]
    expect(series.type).toBe('gauge')
    expect(series.progress.show).toBe(true)
    expect(series.pointer.show).toBe(false)
    expect(series.anchor.show).toBe(false)
    expect(series.axisTick.show).toBe(false)
    expect(series.splitLine.show).toBe(false)
  })

  it('value propagates to series.data[0].value', () => {
    const f = GaugeMarks({ colorScheme: 'teal' }, makeCtx(75))
    expect((f.option as any).series[0].data[0].value).toBe(75)
  })

  it('null value (empty rows) → data value 0', () => {
    const f = GaugeMarks({ colorScheme: 'teal' }, makeCtx(null))
    expect((f.option as any).series[0].data[0].value).toBe(0)
  })

  it('arcWidth propagates to progress.width and axisLine.lineStyle.width', () => {
    const f = GaugeMarks({ colorScheme: 'teal', arcWidth: 20 }, makeCtx(50))
    const series = (f.option as any).series[0]
    expect(series.progress.width).toBe(20)
    expect(series.axisLine.lineStyle.width).toBe(20)
  })

  it('min/max propagate to series min and max', () => {
    const f = GaugeMarks({ colorScheme: 'teal', min: 10, max: 200 }, makeCtx(100))
    const series = (f.option as any).series[0]
    expect(series.min).toBe(10)
    expect(series.max).toBe(200)
  })

  it('colorZones — progress.itemStyle.color overridden by matching zone', () => {
    const zones = [
      { from: 0,  to: 40,  color: '#F43F5E' },
      { from: 41, to: 100, color: '#22C55E' },
    ]
    const red   = GaugeMarks({ colorScheme: 'teal', colorZones: zones }, makeCtx(30))
    const green = GaugeMarks({ colorScheme: 'teal', colorZones: zones }, makeCtx(60))
    expect((red.option   as any).series[0].progress.itemStyle.color).toBe('#F43F5E')
    expect((green.option as any).series[0].progress.itemStyle.color).toBe('#22C55E')
  })

  it('axisLine background is a single plain track color segment', () => {
    const f = GaugeMarks({ colorScheme: 'teal' }, makeCtx(50))
    const segments = (f.option as any).series[0].axisLine.lineStyle.color
    expect(segments).toHaveLength(1)
    expect(segments[0][0]).toBe(1)
  })

  it('showMinMax true → axisLabel.show true', () => {
    const f = GaugeMarks({ colorScheme: 'teal', showMinMax: true }, makeCtx(50))
    expect((f.option as any).series[0].axisLabel.show).toBe(true)
  })

  it('detail formatter uses fmtVal (prefix/suffix applied)', () => {
    const f = GaugeMarks({ colorScheme: 'teal', prefix: '$', suffix: 'M' }, makeCtx(7.4))
    const detail = (f.option as any).series[0].detail
    expect(detail.show).toBe(true)
    expect(typeof detail.formatter).toBe('function')
    // formatter wraps fmtVal — spot-check it returns a string
    expect(typeof detail.formatter(7.4)).toBe('string')
  })
})

describe('GaugeMarks schema', () => {
  it('exports a non-empty schema array', () => {
    expect(Array.isArray(schema)).toBe(true)
    expect(schema.length).toBeGreaterThan(0)
  })

  it('all fields have key and default', () => {
    schema.forEach(field => {
      expect(typeof field.key).toBe('string')
      expect(field.key.length).toBeGreaterThan(0)
      expect('default' in field).toBe(true)
      expect(field.default).not.toBeUndefined()
    })
  })

  it('covers expected config keys', () => {
    const keys = new Set(schema.map(f => f.key))
    ;['minValue', 'maxValue', 'arcWidth', 'showMinMax', 'valueFontSize'].forEach(k => {
      expect(keys.has(k), `schema missing key "${k}"`).toBe(true)
    })
  })
})


it('explicit value typography preserves the arc and unclamped formatted value', () => {
  const base = (GaugeMarks({ colorScheme: 'teal', max: 100, prefix: '$', suffix: ' USD' }, makeCtx(250)).option as any).series[0]
  const styled = (GaugeMarks({ colorScheme: 'teal', max: 100, prefix: '$', suffix: ' USD', valueColor: '#d946ef', valueFontSize: 40, valueFontWeight: 500, valueFontFamily: 'Sora' }, makeCtx(250)).option as any).series[0]
  expect(styled.detail).toMatchObject({ color: '#d946ef', fontSize: 40, fontWeight: 500, fontFamily: 'Sora' })
  expect(styled.detail.formatter()).toBe('$250 USD')
  expect(styled.data).toEqual(base.data)
  expect(styled.progress).toEqual(base.progress)
})
