import { describe, it, expect } from 'vitest'
import {
  drillHierarchy, resolveDrillQuery, drillCrumbs, pushDrill, popDrillTo, aggregateDrillLevel,
  drillStyleOf, expandLevels, shapeExpandInPlace,
} from '../ui/src/appspec/shared/drill.js'

const H3 = [
  { table: 'Product', column: 'Category' },
  { table: 'Product', column: 'Subcategory' },
  { table: 'Product', column: 'Product' },
]
const vis = (drill) => ({ id: 'v1', data: { measures: ['Sales'], groupBy: drill?.[0], drill } })

describe('drillHierarchy', () => {
  it('returns null without a drill array', () => {
    expect(drillHierarchy({ data: {} })).toBeNull()
    expect(drillHierarchy({ data: { drill: null } })).toBeNull()
  })
  it('returns null for a single valid level (that is just a groupBy, not a hierarchy)', () => {
    expect(drillHierarchy(vis([{ table: 'Product', column: 'Category' }]))).toBeNull()
  })
  it('drops malformed levels and requires >=2 valid ones', () => {
    expect(drillHierarchy(vis([{ table: 'Product', column: 'Category' }, { column: 'oops' }]))).toBeNull()
    const levels = drillHierarchy(vis(H3))
    expect(levels).toHaveLength(3)
    expect(levels[1]).toMatchObject({ table: 'Product', column: 'Subcategory', ref: 'Product[Subcategory]', label: 'Subcategory' })
  })
})

describe('resolveDrillQuery', () => {
  it('is null when there is no hierarchy', () => {
    expect(resolveDrillQuery(vis(null), [])).toBeNull()
  })
  it('depth 0 → groups by level 0, no ancestor filters', () => {
    const q = resolveDrillQuery(vis(H3), [])
    expect(q.depth).toBe(0)
    expect(q.groupBy).toEqual({ table: 'Product', column: 'Category' })
    expect(q.ancestorFilters).toEqual({})
    expect(q.atLeaf).toBe(false)
    expect(q.maxDepth).toBe(2)
  })
  it('depth 1 → groups by level 1, filters level 0', () => {
    const q = resolveDrillQuery(vis(H3), ['Bikes'])
    expect(q.depth).toBe(1)
    expect(q.groupBy).toEqual({ table: 'Product', column: 'Subcategory' })
    expect(q.ancestorFilters).toEqual({ 'Product[Category]': 'Bikes' })
  })
  it('depth 2 (leaf) → groups by level 2, filters levels 0 and 1', () => {
    const q = resolveDrillQuery(vis(H3), ['Bikes', 'Mountain Bikes'])
    expect(q.depth).toBe(2)
    expect(q.atLeaf).toBe(true)
    expect(q.groupBy).toEqual({ table: 'Product', column: 'Product' })
    expect(q.ancestorFilters).toEqual({ 'Product[Category]': 'Bikes', 'Product[Subcategory]': 'Mountain Bikes' })
  })
  it('caps depth at the last level even if the path is longer', () => {
    const q = resolveDrillQuery(vis(H3), ['Bikes', 'Mountain Bikes', 'X', 'Y'])
    expect(q.depth).toBe(2)
    expect(q.groupBy).toEqual({ table: 'Product', column: 'Product' })
  })
})

describe('drillCrumbs', () => {
  it('is empty without a hierarchy', () => {
    expect(drillCrumbs(vis(null), [])).toEqual([])
  })
  it('at depth 0 shows only the base level label', () => {
    const c = drillCrumbs(vis(H3), [])
    expect(c).toEqual([{ label: 'Category', toDepth: 0 }])
  })
  it('adds a crumb per drilled value, capped at the leaf', () => {
    expect(drillCrumbs(vis(H3), ['Bikes'])).toEqual([
      { label: 'Category', toDepth: 0 },
      { label: 'Bikes', toDepth: 1 },
    ])
    expect(drillCrumbs(vis(H3), ['Bikes', 'Mountain Bikes', 'extra'])).toEqual([
      { label: 'Category', toDepth: 0 },
      { label: 'Bikes', toDepth: 1 },
      { label: 'Mountain Bikes', toDepth: 2 },
    ])
  })
})

describe('pushDrill / popDrillTo', () => {
  const levels = drillHierarchy(vis(H3))
  it('appends a clicked value', () => {
    expect(pushDrill([], 'Bikes', levels)).toEqual(['Bikes'])
    expect(pushDrill(['Bikes'], 'Mountain Bikes', levels)).toEqual(['Bikes', 'Mountain Bikes'])
  })
  it('is a no-op at the leaf (returns same reference)', () => {
    const atLeaf = ['Bikes', 'Mountain Bikes']
    expect(pushDrill(atLeaf, 'anything', levels)).toBe(atLeaf)
  })
  it('is a no-op for a null value', () => {
    const cur = ['Bikes']
    expect(pushDrill(cur, null, levels)).toBe(cur)
  })
  it('coerces the pushed value to a string', () => {
    expect(pushDrill([], 2020, levels)).toEqual(['2020'])
  })
  it('pops back to a shallower depth', () => {
    expect(popDrillTo(['Bikes', 'Mountain Bikes'], 1)).toEqual(['Bikes'])
    expect(popDrillTo(['Bikes', 'Mountain Bikes'], 0)).toEqual([])
  })
  it('pop is a no-op (same reference) when depth >= current length', () => {
    const cur = ['Bikes']
    expect(popDrillTo(cur, 1)).toBe(cur)
    expect(popDrillTo(cur, 5)).toBe(cur)
  })
})

describe('drillStyleOf', () => {
  it('is null when there is no hierarchy and no explicit style', () => {
    expect(drillStyleOf(vis(null))).toBeNull()
    expect(drillStyleOf({ data: {} })).toBeNull()
  })
  it('defaults to expand when a hierarchy exists and no style set', () => {
    expect(drillStyleOf(vis(H3))).toBe('expand')
  })
  it('honours an explicit style', () => {
    expect(drillStyleOf({ ...vis(H3), config: { drillStyle: 'replace' } })).toBe('replace')
    expect(drillStyleOf({ ...vis(H3), config: { drillStyle: 'off' } })).toBe('off')
  })
})

describe('expandLevels', () => {
  it('is null without a hierarchy', () => {
    expect(expandLevels(vis(null))).toBeNull()
  })
  it('returns base + its immediate child', () => {
    const lv = expandLevels(vis(H3))
    expect(lv.parent).toMatchObject({ column: 'Category' })
    expect(lv.child).toMatchObject({ column: 'Subcategory' })
  })
})

describe('shapeExpandInPlace', () => {
  // 2-dim result: parent=_cat, child=_cat2, measure=_val
  const rows = [
    { _cat: 'North', _cat2: 'Contoso', _val: 210 },
    { _cat: 'North', _cat2: 'Fabrikam', _val: 180 },
    { _cat: 'South', _cat2: 'Tailspin', _val: 170 },
    { _cat: 'South', _cat2: 'Wide World', _val: 150 },
    { _cat: 'East', _cat2: 'Blue Yonder', _val: 160 },
  ]
  it('collapses every parent when nothing is expanded', () => {
    expect(shapeExpandInPlace(rows, null)).toEqual([
      { _cat: 'North', _val: 390, _group: 'North', _child: false },
      { _cat: 'South', _val: 320, _group: 'South', _child: false },
      { _cat: 'East', _val: 160, _group: 'East', _child: false },
    ])
  })
  it('splits only the expanded parent into its children, siblings stay summed, order preserved', () => {
    expect(shapeExpandInPlace(rows, 'North')).toEqual([
      { _cat: 'Contoso', _val: 210, _group: 'North', _child: true },
      { _cat: 'Fabrikam', _val: 180, _group: 'North', _child: true },
      { _cat: 'South', _val: 320, _group: 'South', _child: false },
      { _cat: 'East', _val: 160, _group: 'East', _child: false },
    ])
  })
})

describe('aggregateDrillLevel (client-side, PBI path)', () => {
  const levels = drillHierarchy(vis(H3))
  // finest-grain rows: every level column + a measure
  const rows = [
    { Category: 'Bikes', Subcategory: 'Mountain Bikes', Product: 'M1', _val: 10 },
    { Category: 'Bikes', Subcategory: 'Mountain Bikes', Product: 'M2', _val: 15 },
    { Category: 'Bikes', Subcategory: 'Road Bikes', Product: 'R1', _val: 20 },
    { Category: 'Accessories', Subcategory: 'Tires', Product: 'T1', _val: 5 },
  ]
  const colOf = (r, lvl) => r[lvl.column]

  it('depth 0 → sums by Category across all rows', () => {
    const out = aggregateDrillLevel(rows, levels, [], ['_val'], colOf)
    expect(out).toEqual([{ _cat: 'Bikes', _val: 45 }, { _cat: 'Accessories', _val: 5 }])
  })
  it('depth 1 (Bikes) → filters to Bikes, sums by Subcategory', () => {
    const out = aggregateDrillLevel(rows, levels, ['Bikes'], ['_val'], colOf)
    expect(out).toEqual([{ _cat: 'Mountain Bikes', _val: 25 }, { _cat: 'Road Bikes', _val: 20 }])
  })
  it('depth 2 (Bikes → Mountain Bikes) → filters both, groups by Product', () => {
    const out = aggregateDrillLevel(rows, levels, ['Bikes', 'Mountain Bikes'], ['_val'], colOf)
    expect(out).toEqual([{ _cat: 'M1', _val: 10 }, { _cat: 'M2', _val: 15 }])
  })
})
