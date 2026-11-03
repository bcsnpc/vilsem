/**
 * Playground Spike — the three starter visuals validate + instantiate purely
 * as templates (no per-visual code). This is the "no per-visual code" DoD item,
 * verified: each example is JSON that resolves to a valid ECharts option through
 * the single pure instantiateVisual().
 */

import { describe, it, expect } from 'vitest'
import { EXAMPLE_TEMPLATES } from '@vilsem/core/templates/examples'
import { instantiateVisual, validateTemplate, buildThemeContext } from '@vilsem/core/templates'

const theme = buildThemeContext({ textPrimary: '#fff', textMuted: '#888', gridStroke: '#222' }, 'teal')

// time+measure / dim+measure rows share the same normalized shape
const rows = [
  { _cat: 'Jan', _val: 120 },
  { _cat: 'Feb', _val: 180 },
  { _cat: 'Mar', _val: 90 },
  { _cat: 'Apr', _val: 240 },
]

describe('example templates — all three validate clean', () => {
  for (const tpl of EXAMPLE_TEMPLATES) {
    it(`${tpl.meta.name} passes validateTemplate with no errors`, () => {
      const { errors } = validateTemplate(tpl)
      expect(errors).toEqual([])
    })
  }
})

describe('example templates — all three instantiate to valid ECharts options', () => {
  for (const tpl of EXAMPLE_TEMPLATES) {
    it(`${tpl.meta.name} resolves to a renderable option, no unresolved tokens`, () => {
      // dim+measure rows for chart types; +_val2 so 2-measure slots (dumbbell) shape
      const shaped = rows.map((r, i) => ({ ...r, _val2: r._val * 0.6 }))
      const { option, warnings } = instantiateVisual({ template: tpl, rows: shaped, params: {}, theme })
      // series-bearing OR graphic-only (KPI cards)
      const renderable = (Array.isArray(option.series) && option.series.length > 0) || !!option.graphic
      expect(renderable).toBe(true)
      // no leftover $tokens anywhere in the resolved option
      const dump = JSON.stringify(option)
      expect(dump.includes('"$slot')).toBe(false)
      expect(dump.includes('"$param')).toBe(false)
      expect(dump.includes('"$theme')).toBe(false)
      // slot-related warnings should be empty for correctly-shaped input
      expect(warnings.filter(w => /undeclared|unknown slot|more measures/.test(w))).toEqual([])
    })
  }
})

describe('KPI + Sparkline — latest value + trend', () => {
  const tpl = EXAMPLE_TEMPLATES.find(t => t.meta.id === 'kpi_sparkline')
  it('shows the last value as formatted title text and the full series as the sparkline', () => {
    const { option } = instantiateVisual({ template: tpl, rows, params: { caption: 'YTD' }, theme })
    expect(option.title.text).toBe('240') // last value, formatted
    expect(option.title.subtext).toBe('YTD') // param
    expect(option.series[0].type).toBe('line')
    expect(option.series[0].data).toEqual([120, 180, 90, 240])
    expect(option.xAxis.data).toEqual(['Jan', 'Feb', 'Mar', 'Apr'])
  })
})

describe('Bullet — measure vs target + bands', () => {
  const tpl = EXAMPLE_TEMPLATES.find(t => t.meta.id === 'bullet')
  it('binds the latest value as the bar and injects target/band params', () => {
    const { option } = instantiateVisual({ template: tpl, rows, params: { target: 200, poor: 80, good: 160, max: 260 }, theme })
    expect(option.series[0].data).toEqual([240]) // last value
    expect(option.xAxis.max).toBe(260) // param
    expect(option.series[0].markLine.data[0].xAxis).toBe(200) // target param
    // three qualitative bands from params
    const bands = option.series[0].markArea.data
    expect(bands[0][1].xAxis).toBe(80)
    expect(bands[1][1].xAxis).toBe(160)
    expect(bands[2][1].xAxis).toBe(260)
  })
})

describe('Lollipop — stems + dots + value labels', () => {
  const tpl = EXAMPLE_TEMPLATES.find(t => t.meta.id === 'lollipop')
  it('renders stem bar + scatter dots at [cat, value] with a thousands label formatter', () => {
    const { option } = instantiateVisual({ template: tpl, rows, params: { dotSize: 18 }, theme })
    expect(option.series[0].type).toBe('bar') // stems
    expect(option.series[0].data).toEqual([120, 180, 90, 240])
    expect(option.series[1].type).toBe('scatter') // dots
    expect(option.series[1].data).toEqual([['Jan', 120], ['Feb', 180], ['Mar', 90], ['Apr', 240]])
    expect(option.series[1].symbolSize).toBe(18) // param
    // formatterTemplate became a real function taking the value (last elem)
    expect(typeof option.series[1].label.formatter).toBe('function')
    expect(option.series[1].label.formatter({ value: ['Feb', 1800] })).toBe('1,800')
  })
})
