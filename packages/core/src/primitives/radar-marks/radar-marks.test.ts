import { describe, it, expect } from 'vitest'
import { RadarMarks, schema } from './index'
import type { PrimitiveContext } from '../contract'

function makeCtx(rows: Array<{ _cat: string; _val: number }> = []): PrimitiveContext {
  return {
    data: { fields: [], rows },
    encoding: {},
    theme: {
      textMuted: '#888', textSecondary: '#aaa', textPrimary: '#fff',
      gridStroke: 'rgba(255,255,255,0.1)',
    } as any,
    selection: { selectedCat: null },
    dimensions: { width: 400, height: 400 },
  }
}

const SAMPLE_ROWS = [
  { _cat: 'Speed',    _val: 80 },
  { _cat: 'Power',   _val: 60 },
  { _cat: 'Range',   _val: 45 },
  { _cat: 'Comfort', _val: 90 },
]

describe('RadarMarks', () => {
  it('output shape — has radar.indicator array and series[0].type radar', () => {
    const f = RadarMarks({ colorScheme: 'teal' }, makeCtx(SAMPLE_ROWS))
    const opt = f.option as any
    expect(Array.isArray(opt.radar.indicator)).toBe(true)
    expect(opt.series).toHaveLength(1)
    expect(opt.series[0].type).toBe('radar')
  })

  it('indicator count and values match rows', () => {
    const f = RadarMarks({ colorScheme: 'teal' }, makeCtx(SAMPLE_ROWS))
    const opt = f.option as any
    expect(opt.radar.indicator).toHaveLength(SAMPLE_ROWS.length)
    expect(opt.series[0].data[0].value).toHaveLength(SAMPLE_ROWS.length)
    expect(opt.radar.indicator[0].name).toBe('Speed')
    expect(opt.series[0].data[0].value[0]).toBe(80)
  })

  it('maxVal applied as max on all indicators', () => {
    const f = RadarMarks({ colorScheme: 'teal' }, makeCtx(SAMPLE_ROWS))
    const opt = f.option as any
    const maxVal = 90 // max of SAMPLE_ROWS
    opt.radar.indicator.forEach((ind: any) => {
      expect(ind.max).toBe(maxVal)
    })
  })

  it('showDots true → symbol circle; showDots false → symbol none', () => {
    const withDots = RadarMarks({ colorScheme: 'teal', showDots: true }, makeCtx(SAMPLE_ROWS))
    expect((withDots.option as any).series[0].symbol).toBe('circle')

    const noDots = RadarMarks({ colorScheme: 'teal', showDots: false }, makeCtx(SAMPLE_ROWS))
    expect((noDots.option as any).series[0].symbol).toBe('none')
  })

  it('radarRadius converts to percent string on radar.radius', () => {
    const f = RadarMarks({ colorScheme: 'teal', radarRadius: 75 }, makeCtx(SAMPLE_ROWS))
    expect((f.option as any).radar.radius).toBe('75%')
  })

  it('fillOpacity and strokeWidth propagate to series areaStyle and lineStyle', () => {
    const f = RadarMarks({ colorScheme: 'teal', fillOpacity: 0.5, strokeWidth: 3 }, makeCtx(SAMPLE_ROWS))
    const series = (f.option as any).series[0]
    expect(series.areaStyle.opacity).toBe(0.5)
    expect(series.lineStyle.width).toBe(3)
  })

  it('empty rows produce empty indicator array and zero-length value array', () => {
    const f = RadarMarks({ colorScheme: 'teal' }, makeCtx([]))
    const opt = f.option as any
    expect(opt.radar.indicator).toHaveLength(0)
    expect(opt.series[0].data[0].value).toHaveLength(0)
  })
})

describe('RadarMarks schema', () => {
  it('exports a schema array', () => {
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

  it('covers expected user-facing config keys', () => {
    const keys = new Set(schema.map(f => f.key))
    ;['fillOpacity', 'strokeWidth', 'showDots', 'radarRadius', 'labelFontSize'].forEach(k => {
      expect(keys.has(k), `schema missing key "${k}"`).toBe(true)
    })
  })
})
