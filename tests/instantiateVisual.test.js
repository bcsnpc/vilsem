/**
 * Playground Spike — unit tests for the pure instantiation function.
 * Run: npm test -- instantiateVisual
 *
 * Covers: token resolution, slot data shaping (fixed row shape), param
 * injection + coercion, theme application, the whitelist formatter DSL, and
 * static template validation.
 */

import { describe, it, expect } from 'vitest'
import {
  instantiateVisual,
  shapeSlots,
  resolveParams,
  resolveToken,
  deepResolve,
  makeFormatter,
  buildThemeContext,
  validateTemplate,
  collectTokens,
  slotCount,
  paramsToSchema,
  evalExpr,
  applyTransforms,
  computeDateRange,
} from '@vilsem/core/templates'

// A representative multi-slot template (lollipop-ish: 1 dimension + 1 measure).
const lolliTemplate = {
  meta: { id: 'lolli', name: 'Lollipop' },
  slots: {
    category: { kind: 'dimension', count: 1 },
    value: { kind: 'measure', count: 1 },
  },
  params: [{ name: 'dotSize', type: 'number', default: 8 }],
  template: {
    xAxis: { type: 'category', data: '$slot.category.categories' },
    series: [
      { type: 'bar', data: '$slot.value.values', itemStyle: { color: '$theme.palette.0' } },
      { type: 'scatter', data: '$slot.value.pairs', symbolSize: '$param.dotSize',
        label: { show: true, formatterTemplate: '{value:thousands}' } },
    ],
  },
}

const rows = [
  { _cat: 'North', _val: 1200, _val2: 30, _val3: null },
  { _cat: 'South', _val: 3400.5, _val2: 55, _val3: null },
  { _cat: 'East', _val: 900, _val2: 12, _val3: null },
]

const theme = buildThemeContext({ textMuted: '#888', gridStroke: '#111' }, 'teal')

describe('shapeSlots — fixed row shape → named slots', () => {
  it('maps dimension slot to the category axis and measure slot to _val', () => {
    const { shaped, warnings } = shapeSlots(rows, lolliTemplate.slots)
    expect(warnings).toEqual([])
    expect(shaped.category.categories).toEqual(['North', 'South', 'East'])
    expect(shaped.value.values).toEqual([1200, 3400.5, 900])
    expect(shaped.value.pairs).toEqual([['North', 1200], ['South', 3400.5], ['East', 900]])
    expect(shaped.value.count).toBe(1)
  })

  it('assigns _val,_val2,_val3 across measure slots in declaration order', () => {
    const slots = {
      a: { kind: 'measure', count: 1 },
      b: { kind: 'measure', count: 1 },
    }
    const { shaped } = shapeSlots(rows, slots)
    expect(shaped.a.values).toEqual([1200, 3400.5, 900])
    expect(shaped.b.values).toEqual([30, 55, 12])
  })

  it('a range measure slot shapes multiple series (max)', () => {
    const slots = { m: { kind: 'measure', count: { min: 1, max: 2 } } }
    const { shaped } = shapeSlots(rows, slots)
    expect(shaped.m.count).toBe(2)
    expect(shaped.m.series[0]).toEqual([1200, 3400.5, 900]) // _val
    expect(shaped.m.series[1]).toEqual([30, 55, 12]) // _val2
  })

  it('warns (does not throw) when more than 3 measures are declared', () => {
    const slots = {
      a: { kind: 'measure', count: 2 },
      b: { kind: 'measure', count: 2 },
    }
    const { shaped, warnings } = shapeSlots(rows, slots)
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0]).toMatch(/exceeds what the bound data provides/)
    // 4th measure has no field → empty series, not a crash
    expect(shaped.b.series[1]).toEqual([])
  })

  it('warns on advisory maxCardinality but still shapes the data', () => {
    const slots = { d: { kind: 'dimension', count: 1, constraints: { maxCardinality: 2 } } }
    const { shaped, warnings } = shapeSlots(rows, slots)
    expect(shaped.d.categories).toHaveLength(3)
    expect(warnings[0]).toMatch(/exceeds advisory maxCardinality/)
  })

  it('coerces non-numeric measure cells to null', () => {
    const dirty = [{ _cat: 'X', _val: 'n/a' }, { _cat: 'Y', _val: 42 }]
    const { shaped } = shapeSlots(dirty, { v: { kind: 'measure', count: 1 } })
    expect(shaped.v.values).toEqual([null, 42])
  })

  it('exposes value-first pairsSwapped, heatmap cells, and pie objects', () => {
    const { shaped } = shapeSlots(rows, { value: { kind: 'measure', count: 1 } })
    const s = shaped.value
    expect(s.pairsSwapped).toEqual([[1200, 'North'], [3400.5, 'South'], [900, 'East']])
    expect(s.cells).toEqual([[0, 0, 1200], [1, 0, 3400.5], [2, 0, 900]])
    expect(s.pieData).toEqual([{ value: 1200, name: 'North' }, { value: 3400.5, name: 'South' }, { value: 900, name: 'East' }])
  })

  it('exposes scalar accessors (last/first/sum/avg/delta) + formatted labels', () => {
    const { shaped } = shapeSlots(rows, { value: { kind: 'measure', count: 1 } })
    const s = shaped.value
    expect(s.last).toBe(900)
    expect(s.first).toBe(1200)
    expect(s.min).toBe(900)
    expect(s.max).toBe(3400.5)
    expect(s.sum).toBe(5500.5)
    expect(s.delta).toBe(-300) // last - first
    expect(s.lastLabel).toBe('900')
    expect(s.sumLabel).toBe('5,500.5')
    expect(s.deltaLabel).toBe('-300')
  })
})

describe('shapeSlots — Next-D: two dimensions + matrix + >3 measures', () => {
  const rows2d = [
    { _cat: 'A', _cat2: 'X', _cats: ['A', 'X'], _vals: [1] },
    { _cat: 'A', _cat2: 'Y', _cats: ['A', 'Y'], _vals: [2] },
    { _cat: 'B', _cat2: 'X', _cats: ['B', 'X'], _vals: [3] },
  ]
  const slots2d = { xDim: { kind: 'dimension', count: 1 }, yDim: { kind: 'dimension', count: 1 }, value: { kind: 'measure', count: 1 } }
  it('maps 1st dim → _cat and 2nd dim → _cat2, with unique axis lists', () => {
    const { shaped } = shapeSlots(rows2d, slots2d)
    expect(shaped.xDim.categories).toEqual(['A', 'B'])
    expect(shaped.yDim.categories).toEqual(['X', 'Y'])
  })
  it('exposes a matrix accessor of [xIndex, yIndex, value] for a 2-D heatmap', () => {
    const { shaped } = shapeSlots(rows2d, slots2d)
    expect(shaped.value.matrix).toEqual([[0, 0, 1], [0, 1, 2], [1, 0, 3]])
  })
  it('reads a 4th measure from _vals[] beyond _val3', () => {
    const wide = [{ _cat: 'A', _vals: [10, 20, 30, 40] }]
    const { shaped } = shapeSlots(wide, { d: { kind: 'dimension', count: 1 }, m: { kind: 'measure', count: { min: 1, max: 4 } } })
    expect(shaped.m.series[3]).toEqual([40])
  })
  it('validateTemplate allows up to six dimensions and rejects seven', () => {
    const two = { meta: { id: 'h', name: 'H' }, slots: { x: { kind: 'dimension', count: 1 }, y: { kind: 'dimension', count: 1 }, v: { kind: 'measure', count: 1 } }, template: { series: [{ data: '$slot.v.matrix' }] } }
    expect(validateTemplate(two).errors).toEqual([])
    const three = { meta: { id: 'h', name: 'H' }, slots: { x: { kind: 'dimension', count: 1 }, y: { kind: 'time', count: 1 }, z: { kind: 'dimension', count: 1 }, v: { kind: 'measure', count: 1 } }, template: { series: [] } }
    expect(validateTemplate(three).errors).toEqual([])
    const seven={...three,slots:{...three.slots,...Object.fromEntries(['a','b','c','d'].map(n=>[n,{kind:'dimension'}]))}}
    expect(validateTemplate(seven).errors.some(e=>/at most six dimension/.test(e))).toBe(true)
  })
})

describe('resolveParams — defaults + coercion', () => {
  it('uses declared defaults when not provided', () => {
    expect(resolveParams([{ name: 'x', type: 'number', default: 5 }], {})).toEqual({ x: 5 })
  })
  it('provided values override defaults and coerce by type', () => {
    const defs = [
      { name: 'n', type: 'number', default: 0 },
      { name: 'b', type: 'boolean', default: false },
      { name: 's', type: 'string', default: 'a' },
    ]
    expect(resolveParams(defs, { n: '12', b: 1, s: 'hi' })).toEqual({ n: 12, b: true, s: 'hi' })
  })
  it('falls back to default when a number param is non-numeric', () => {
    expect(resolveParams([{ name: 'n', type: 'number', default: 7 }], { n: 'abc' })).toEqual({ n: 7 })
  })
})

describe('resolveToken', () => {
  const ctx = {
    slots: { value: { values: [1, 2], series: [[1, 2], [3, 4]], categories: ['a', 'b'], pairs: [['a', 1]] } },
    params: { target: 100 },
    theme: { palette: ['#111', '#222'], font: 'Inter', textMuted: '#888' },
  }
  it('resolves slot fields and indexed series', () => {
    expect(resolveToken('$slot.value.values', ctx)).toEqual([1, 2])
    expect(resolveToken('$slot.value.series.1', ctx)).toEqual([3, 4])
    expect(resolveToken('$slot.value.categories', ctx)).toEqual(['a', 'b'])
  })
  it('resolves params and theme (including palette index)', () => {
    expect(resolveToken('$param.target', ctx)).toBe(100)
    expect(resolveToken('$theme.palette.0', ctx)).toBe('#111')
    expect(resolveToken('$theme.font', ctx)).toBe('Inter')
  })
  it('throws on unknown slot and unknown root', () => {
    expect(() => resolveToken('$slot.nope.values', ctx)).toThrow(/unknown slot/)
    expect(() => resolveToken('$bogus.x', ctx)).toThrow(/unknown token root/)
  })
})

describe('makeFormatter — whitelist DSL only, no eval', () => {
  it('formats value/thousands/percent/name/seriesName', () => {
    expect(makeFormatter('{value}')({ value: 42 })).toBe('42')
    expect(makeFormatter('{value:thousands}')({ value: 1234567 })).toBe('1,234,567')
    expect(makeFormatter('{value:thousands}')({ value: 3400.5 })).toBe('3,400.5')
    expect(makeFormatter('{value:percent}')({ value: 0.1234 })).toBe('12.3%')
    expect(makeFormatter('{name}: {value}')({ name: 'North', value: 5 })).toBe('North: 5')
    expect(makeFormatter('{seriesName}')({ seriesName: 'Rev' })).toBe('Rev')
  })
  it('takes the last element when ECharts passes an array value', () => {
    expect(makeFormatter('{value:thousands}')({ value: ['North', 2500] })).toBe('2,500')
  })
  it('leaves unknown tokens literal (never executes them)', () => {
    expect(makeFormatter('{__proto__}')({})).toBe('{__proto__}')
    expect(makeFormatter('{foo:bar}')({})).toBe('{foo:bar}')
  })
  it('accepts ECharts-native aliases {c}=value {b}=name {a}=seriesName {d}=percent', () => {
    expect(makeFormatter('{c}')({ value: 42 })).toBe('42')
    expect(makeFormatter('{c:thousands}')({ value: 1234567 })).toBe('1,234,567')
    expect(makeFormatter('{b}')({ name: 'North' })).toBe('North')
    expect(makeFormatter('{a}')({ seriesName: 'Rev' })).toBe('Rev')
    expect(makeFormatter('{b}: {d}%')({ name: 'Central', percent: 23.4 })).toBe('Central: 23.4%')
  })
})

describe('deepResolve — whole-token replacement + formatterTemplate rewrite', () => {
  const ctx = {
    slots: { v: { values: [1, 2, 3] } },
    params: { size: 9 },
    theme: { palette: ['#abc'] },
  }
  it('replaces token strings and converts formatterTemplate to a function', () => {
    const skeleton = {
      series: [{ data: '$slot.v.values', symbolSize: '$param.size', color: '$theme.palette.0',
        label: { formatterTemplate: '{value}' }, plain: 'kept' }],
    }
    const warnings = []
    const out = deepResolve(skeleton, ctx, warnings)
    expect(out.series[0].data).toEqual([1, 2, 3])
    expect(out.series[0].symbolSize).toBe(9)
    expect(out.series[0].color).toBe('#abc')
    expect(out.series[0].plain).toBe('kept')
    expect(typeof out.series[0].label.formatter).toBe('function')
    expect(out.series[0].label.formatterTemplate).toBeUndefined()
    expect(out.series[0].label.formatter({ value: 7 })).toBe('7')
    expect(warnings).toEqual([])
  })
  it('records a warning and yields null for a bad token, without throwing', () => {
    const warnings = []
    const out = deepResolve({ x: '$slot.missing.values' }, ctx, warnings)
    expect(out.x).toBeNull()
    expect(warnings[0]).toMatch(/unknown slot/)
  })
})

describe('instantiateVisual — end to end', () => {
  it('produces a resolved ECharts option from template + rows + params + theme', () => {
    const { option, warnings } = instantiateVisual({
      template: lolliTemplate, rows, params: { dotSize: 14 }, theme,
    })
    expect(warnings).toEqual([])
    expect(option.xAxis.data).toEqual(['North', 'South', 'East'])
    expect(option.series[0].type).toBe('bar')
    expect(option.series[0].data).toEqual([1200, 3400.5, 900])
    expect(option.series[0].itemStyle.color).toBe(theme.palette[0])
    expect(option.series[1].symbolSize).toBe(14) // param override
    expect(option.series[1].data).toEqual([['North', 1200], ['South', 3400.5], ['East', 900]])
    expect(typeof option.series[1].label.formatter).toBe('function')
    expect(option.series[1].label.formatter({ value: [null, 3400.5] })).toBe('3,400.5')
  })

  it('uses the param default when none is provided', () => {
    const { option } = instantiateVisual({ template: lolliTemplate, rows, theme })
    expect(option.series[1].symbolSize).toBe(8) // default
  })

  it('the SAME template renders DIFFERENT fields (slot contract, not instance)', () => {
    const otherRows = [
      { _cat: 'Alpha', _val: 10 },
      { _cat: 'Beta', _val: 20 },
    ]
    const { option } = instantiateVisual({ template: lolliTemplate, rows: otherRows, theme })
    expect(option.xAxis.data).toEqual(['Alpha', 'Beta'])
    expect(option.series[0].data).toEqual([10, 20])
  })

  it('serialized template carries no functions (functions appear only after instantiation)', () => {
    // The template that rides inside app-spec.json must be JSON-serializable.
    const json = JSON.stringify(lolliTemplate)
    const roundTrip = JSON.parse(json)
    expect(roundTrip).toEqual(lolliTemplate) // no functions lost = none present
    // functions only exist on the instantiated option, in-memory
    const { option } = instantiateVisual({ template: roundTrip, rows, theme })
    expect(typeof option.series[1].label.formatter).toBe('function')
  })
})

describe('validateTemplate — static checks for the editor', () => {
  it('passes a well-formed template', () => {
    const { errors } = validateTemplate(lolliTemplate)
    expect(errors).toEqual([])
  })
  it('flags a token that references an undeclared slot', () => {
    const bad = { ...lolliTemplate, template: { series: [{ data: '$slot.ghost.values' }] } }
    const { errors } = validateTemplate(bad)
    expect(errors.some(e => /undeclared slot "ghost"/.test(e))).toBe(true)
  })
  it('rejects an expression / ternary token (the KPI-delta failure class)', () => {
    const bad = { ...lolliTemplate, template: { series: [{ itemStyle: { color: "$slot.value.deltaPct > 0 ? '#0f0' : '#f00'" } }] } }
    const { errors } = validateTemplate(bad)
    expect(errors.some(e => /not a plain path/.test(e))).toBe(true)
  })
  it('accepts legit dotted paths with numeric + new accessors', () => {
    const ok = { ...lolliTemplate, template: { series: [{ data: '$slot.value.pairsSwapped', c: '$slot.value.cells', s: '$slot.value.series.0', t: '$theme.palette.0' }] } }
    const { errors } = validateTemplate(ok)
    expect(errors).toEqual([])
  })
  it('requires meta.id, a valid slot kind, and a template body', () => {
    const { errors } = validateTemplate({ slots: { x: { kind: 'nope' } } })
    expect(errors.some(e => /meta.id is required/.test(e))).toBe(true)
    expect(errors.some(e => /kind must be measure/.test(e))).toBe(true)
    expect(errors.some(e => /ECharts skeleton.*required/.test(e))).toBe(true)
  })
  it('accepts four through six measures and rejects more than six', () => {
    const heavy = {
      meta: { id: 'h', name: 'H' },
      slots: { a: { kind: 'measure', count: 2 }, b: { kind: 'measure', count: 2 } },
      template: { series: [] },
    }
    const { errors, warnings } = validateTemplate(heavy)
    expect(errors).toEqual([])
    expect(warnings).toEqual([])
    heavy.slots.b.count=5
    expect(validateTemplate(heavy).errors.join(' ')).toContain('at most six')
  })
  it('collectTokens finds every $-token in the skeleton', () => {
    expect(collectTokens(lolliTemplate.template).sort()).toEqual(
      ['$param.dotSize', '$slot.category.categories', '$slot.value.pairs', '$slot.value.values', '$theme.palette.0'].sort()
    )
  })
})

describe('paramsToSchema — template params become inspector controls', () => {
  it('maps each param type to the correct schema-field control', () => {
    const tpl = { params: [
      { name: 'target', type: 'number', default: 100 },
      { name: 'good', type: 'color', default: '#0f0' },
      { name: 'showLabels', type: 'boolean', default: true },
      { name: 'caption', type: 'string', default: 'x' },
    ] }
    const s = paramsToSchema(tpl)
    expect(s.map(f => [f.key, f.type])).toEqual([
      ['target', 'number'], ['good', 'color'], ['showLabels', 'boolean'], ['caption', 'text'],
    ])
    expect(s.every(f => f.group === 'Custom visual')).toBe(true)
    expect(s[0].default).toBe(100)
  })
  it('is safe on empty/missing params', () => {
    expect(paramsToSchema({})).toEqual([])
    expect(paramsToSchema(null)).toEqual([])
  })
})

describe('buildThemeContext — font + per-section palette override', () => {
  it('uses the provided font, else the default Inter stack', () => {
    expect(buildThemeContext({}, 'teal', 'Plus Jakarta Sans').font).toMatch(/Plus Jakarta Sans/)
    expect(buildThemeContext({}, 'teal').font).toMatch(/Inter/)
  })
  it('a paletteOverride replaces the scheme palette (section colours)', () => {
    const over = ['#111', '#222', '#333']
    const t = buildThemeContext({}, 'teal', null, over)
    expect(t.palette).toEqual(over)
    expect(t.accent).toBe('#111')
    // empty/absent override falls back to the scheme palette
    expect(buildThemeContext({}, 'teal', null, []).palette[0]).not.toBe('#111')
    expect(buildThemeContext({}, 'teal').palette.length).toBeGreaterThan(1)
  })
})

describe('computeDateRange — auto-fit a calendar to its data', () => {
  it('returns [min, max] date-only across ISO date categories', () => {
    expect(computeDateRange(['2022-06-01T00:00:00', '2020-11-15', '2021-03-02'])).toEqual(['2020-11-15', '2022-06-01'])
  })
  it('is empty for non-date categories', () => {
    expect(computeDateRange(['North', 'South'])).toEqual([])
    expect(computeDateRange([])).toEqual([])
  })
  it('shapeValues + dim slots expose dateRange', () => {
    const { shaped } = shapeSlots(
      [{ _cat: '2021-01-01', _val: 5 }, { _cat: '2023-09-09', _val: 8 }],
      { t: { kind: 'time', count: 1 }, v: { kind: 'measure', count: 1 } })
    expect(shaped.t.dateRange).toEqual(['2021-01-01', '2023-09-09'])
    expect(shaped.v.dateRange).toEqual(['2021-01-01', '2023-09-09'])
  })
})

describe('evalExpr — safe arithmetic, never eval', () => {
  it('respects precedence, parens, unary, modulo', () => {
    expect(evalExpr('2 + 3 * 4')).toBe(14)
    expect(evalExpr('(2 + 3) * 4')).toBe(20)
    expect(evalExpr('-5 + 2')).toBe(-3)
    expect(evalExpr('10 % 3')).toBe(1)
  })
  it('resolves identifiers from scope; unknowns and divide-by-zero → 0', () => {
    expect(evalExpr('high - low', { high: 10, low: 3 })).toBe(7)
    expect(evalExpr('missing * 2', {})).toBe(0)
    expect(evalExpr('5 / 0')).toBe(0)
  })
  it('supports the whitelisted math functions only', () => {
    expect(evalExpr('abs(-4)')).toBe(4)
    expect(evalExpr('max(1, 9, 3)')).toBe(9)
    expect(evalExpr('round(3.6)')).toBe(4)
  })
  it('cannot reach JS internals — prototype names resolve to 0, no property access', () => {
    expect(evalExpr('constructor', {})).toBe(0) // Object.prototype.constructor is not a number
    expect(evalExpr('a.b', { a: 5 })).toBe(5)   // reads `a`; the .b is not property access, just unparsed
  })
})

describe('applyTransforms — calculate → $calc.<as>', () => {
  const shaped = { low: { values: [10, 20, 30] }, high: { values: [15, 50, 35] } }
  it('computes a derived per-row array with the full accessor set', () => {
    const { calc } = applyTransforms([{ calculate: 'high - low', as: 'span' }], shaped, ['A', 'B', 'C'], {})
    expect(calc.span.values).toEqual([5, 30, 5])
    expect(calc.span.pairs).toEqual([['A', 5], ['B', 30], ['C', 5]])
    expect(calc.span.sum).toBe(40)
  })
  it('references params and chains earlier calcs', () => {
    const { calc } = applyTransforms(
      [{ calculate: 'high * factor', as: 'scaled' }, { calculate: 'scaled - low', as: 'gap' }],
      shaped, ['A', 'B', 'C'], { factor: 2 })
    expect(calc.scaled.values).toEqual([30, 100, 70])
    expect(calc.gap.values).toEqual([20, 80, 40])
  })
})

describe('instantiateVisual + validateTemplate — transforms end to end', () => {
  it('resolves $calc tokens from a calculate transform (the floating-range trick)', () => {
    const tpl = {
      meta: { id: 'range', name: 'Range' },
      slots: { low: { kind: 'measure', count: 1 }, high: { kind: 'measure', count: 1 } },
      transforms: [{ calculate: 'high - low', as: 'span' }],
      template: { series: [{ type: 'bar', data: '$slot.low.values' }, { type: 'bar', data: '$calc.span.values' }] },
    }
    const rows = [{ _cat: 'A', _val: 10, _val2: 15 }, { _cat: 'B', _val: 20, _val2: 50 }]
    const { option, warnings } = instantiateVisual({ template: tpl, rows, theme })
    expect(option.series[0].data).toEqual([10, 20]) // low base
    expect(option.series[1].data).toEqual([5, 30])  // span = high - low
    expect(warnings).toEqual([])
  })
  it('validateTemplate accepts a declared calc and rejects an undeclared one', () => {
    const ok = { meta: { id: 'r', name: 'R' }, slots: { v: { kind: 'measure', count: 1 } },
      transforms: [{ calculate: 'v * 2', as: 'dbl' }], template: { series: [{ data: '$calc.dbl.values' }] } }
    expect(validateTemplate(ok).errors).toEqual([])
    const bad = { meta: { id: 'r', name: 'R' }, slots: { v: { kind: 'measure', count: 1 } },
      template: { series: [{ data: '$calc.ghost.values' }] } }
    expect(validateTemplate(bad).errors.some(e => /undeclared calc "ghost"/.test(e))).toBe(true)
  })
})

describe('slotCount', () => {
  it('handles number, range, and missing counts', () => {
    expect(slotCount(1)).toBe(1)
    expect(slotCount(3)).toBe(3)
    expect(slotCount({ min: 1, max: 2 })).toBe(2)
    expect(slotCount({ min: 2 })).toBe(2)
    expect(slotCount(undefined)).toBe(1)
  })
})

it('omits empty-data mark areas while retaining complete bound rectangles',()=>{
  const template={meta:{id:'annotation-area-gap'},slots:{cat:{kind:'dimension'},v:{kind:'measure'}},template:{series:[{type:'bar',data:'$slot.v.values',markArea:{data:[[{xAxis:0,yAxis:'$slot.v.min'},{xAxis:1,yAxis:'$slot.v.max'}]]}}]}}
  expect(instantiateVisual({template,rows:[]}).option.series[0].markArea.data).toEqual([])
  expect(instantiateVisual({template,rows:[{_cat:'A',_val:2}]}).option.series[0].markArea.data).toEqual([[{xAxis:0,yAxis:2},{xAxis:1,yAxis:2}]])
})
