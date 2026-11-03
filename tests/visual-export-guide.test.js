import { describe, expect, it } from 'vitest'
import { bindingGuideFor, specForExport } from '../ui/src/pages/powerbi/exportVisualPbiviz.js'
import supportedTypes from '@vilsem/core/spec/types'

describe('Power BI custom visual binding guide', () => {
  it.each(['kpi','sparkline_kpi','nav_button','text_box','image','custom','unknown'])('rejects unsupported %s instead of saving a different chart', type => {
    expect(() => specForExport({type,data:{measures:['Sales']}})).toThrow(/not supported/i)
  })
  it.each(supportedTypes)('retains the supported %s export type', type => {
    expect(JSON.parse(specForExport({type,data:{measures:['Sales']}})).type).toBe(type)
  })
  it('guides all drill levels in hierarchy order instead of only the base dimension', () => {
    const drill = [{ table: 'Region', column: 'Name' }, { table: 'Product', column: 'Name' }, { table: 'Product', column: 'SKU' }]
    const visual = { type: 'grouped_bar', data: { measures: ['Sales'], groupBy: drill[0], drill }, config: { drillStyle: 'replace' } }
    const guide = bindingGuideFor(visual)
    expect(guide.dims).toEqual(['Region[Name]', 'Product[Name]', 'Product[SKU]'])
    expect(guide.wells.slice(1).map(w => w.well)).toEqual(['Category', 'Category 2', 'Category 3'])
    expect(JSON.parse(specForExport(visual)).drill).toEqual(drill)
  })

  it.each([['line', 4], ['table', 11]])('rejects %s exports that exceed measure field-well capacity', (type, count) => {
    expect(() => specForExport({ type, data: { measures: Array.from({ length: count }, (_, i) => `M${i}`) } })).toThrow(/measure/i)
  })
  it('rejects exports that exceed category field-well capacity', () => {
    expect(() => specForExport({ type: 'table', data: { measures: ['Sales'], dimensions: Array.from({ length: 7 }, (_, i) => ({ table: 'Product', column: `C${i}` })) } })).toThrow(/category/i)
  })

  it('lists every table measure in the Content well in authored order', () => {
    const measures = Array.from({ length: 10 }, (_, i) => `Measure ${i + 1}`)
    const visual = { type: 'table', data: { measures, groupBy: { table: 'Product', column: 'Category' } } }
    expect(bindingGuideFor(visual).wells).toEqual([
      ...measures.map(field => ({ well: 'Content', field })),
      { well: 'Category', field: 'Product[Category]' },
    ])
    expect(JSON.parse(specForExport(visual)).measures.all).toEqual(measures)
  })
  it('keeps scatter measure roles distinct', () => {
    expect(bindingGuideFor({ type: 'scatter', data: { measures: ['X', 'Y', 'Size'] } }).wells)
      .toEqual([{ well: 'Content', field: 'X' }, { well: 'Secondary', field: 'Y' }, { well: 'Tertiary', field: 'Size' }])
  })
})
