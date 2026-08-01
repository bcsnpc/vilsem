import { describe, it, expect } from 'vitest'
import { buildVisualDax } from '../electron/fabric/dax.js'
import { pickTargetVisual, buildEchartsOptionSource } from '../electron/fabric/generateProject.js'

// Deploy-to-Fabric spike — pure-logic guards (DAX emit + project generation).

describe('fabric dax emit (mirrors vilsem buildTableDAX)', () => {
  it('grouped bar → EVALUATE SUMMARIZECOLUMNS + TOPN', () => {
    const v = { type: 'bar', data: { measures: ['Total Revenue'], groupBy: { table: 'Product', column: 'Category' }, limit: 10, orderBy: 'desc' } }
    const dax = buildVisualDax(v)
    expect(dax).toContain('SUMMARIZECOLUMNS')
    expect(dax).toContain("'Product'[Category]")
    expect(dax).toContain('"Total Revenue", [Total Revenue]')
    expect(dax).toContain('TOPN(10')
    expect(dax.startsWith('EVALUATE')).toBe(true)
  })
  it('scalar KPI (no groupBy) → SUMMARIZECOLUMNS, no TOPN', () => {
    const dax = buildVisualDax({ type: 'kpi', data: { measures: ['Total Revenue'] } })
    expect(dax).toContain('SUMMARIZECOLUMNS')
    expect(dax).not.toContain('TOPN')
  })
  it('applies a filter as FILTER(...)', () => {
    const v = { type: 'bar', data: { measures: ['Sales'], groupBy: { table: 'P', column: 'C' }, filters: [{ table: 'Date', column: 'Year', value: 2024 }] } }
    expect(buildVisualDax(v)).toContain("FILTER('Date', 'Date'[Year] = 2024)")
  })
})

describe('fabric project generation', () => {
  it('picks the first chartable visual (skips KPI)', () => {
    const spec = { visuals: [{ id: 'k', type: 'kpi', data: { measures: ['x'] } }, { id: 'bar1', type: 'bar', data: { measures: ['Sales'], groupBy: { table: 'P', column: 'C' } } }] }
    expect(pickTargetVisual(spec).id).toBe('bar1')
  })
  it('collects visuals from multi-page specs', () => {
    const spec = { pages: [{ visuals: [{ id: 'p1', type: 'bar', data: { measures: ['S'], groupBy: { table: 'P', column: 'C' } } }] }] }
    expect(pickTargetVisual(spec).id).toBe('p1')
  })
  it('ECharts option source references runtime-derived cats/vals (keys come from data.table.columns)', () => {
    const src = buildEchartsOptionSource({ type: 'bar', data: { measures: ['Sales'], groupBy: { table: 'P', column: 'Category' } } })
    expect(src).toContain('data: cats')
    expect(src).toContain('data: vals')
    expect(src).toContain("type: 'bar'")
  })
  it('pie option maps cats/vals to {name,value}', () => {
    const src = buildEchartsOptionSource({ type: 'donut', data: { measures: ['Sales'], groupBy: { table: 'P', column: 'C' } } })
    expect(src).toContain("type: 'pie'")
    expect(src).toContain('cats.map')
  })
})
