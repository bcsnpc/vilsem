// Expected-behavior regressions discovered by the audit. Failures are intentionally
// visible until their linked defects are fixed; these are not copied implementations.
import { describe, it, expect } from 'vitest'
import { validateAppSpec } from '../ui/src/appspec/schema.js'
import { normalizeLayout } from '../ui/src/appspec/shared/layout.js'
import { buildAppliedFiltersForVisual } from '../ui/src/appspec/shared/filters.js'
import { Tooltip } from '../ui/src/primitives/tooltip/index.ts'
import { normaliseRows, normaliseTableRows } from '../ui/src/appspec/shared/row-normalize.js'

const visual = (type='bar')=>({id:'qa',type,position:{x:0,y:0,w:6,h:4},data:{measures:['Revenue'],groupBy:{table:'QA',column:'Category'}},config:{title:'QA'}})
const spec = v=>({version:'1.0',title:'QA',visuals:[v],slicers:[]})

describe('Audit expected behavior — unresolved issues remain red',()=>{
  it('SPEC-CUSTOM-001 accepts a registered custom visual with its template',()=>{
    const v={...visual('custom'),customTemplateId:'qa-template'}
    const s={...spec(v),customVisuals:{'qa-template':{meta:{id:'qa-template',name:'QA',version:'1.0.0'},slots:{value:{kind:'measure',count:1}},params:[],template:{series:[{type:'bar',data:'$slot.value.values'}]}}}}
    expect(validateAppSpec(s).valid).toBe(true)
  })
  it('VIS-TABLE-001 preserves a dimension-only table during normalization',()=>{
    const v={...visual('table'),data:{measures:[],dimensions:[{table:'QA',column:'Category'}]}}
    expect(validateAppSpec(spec(v)).valid).toBe(true)
    expect(normalizeLayout(spec(v)).visuals.map(v=>v.id)).toEqual(['qa'])
  })
  it('SPEC-SLICER-001 accepts runtime multi_select slicers',()=>{
    const s={...spec(visual()),slicers:[{id:'s',type:'multi_select',dimension:{table:'QA',column:'Category'},position:{x:0,y:0,w:4,h:1}}]}
    expect(validateAppSpec(s).valid).toBe(true)
  })
  it('SPEC-INPUT-001 reports invalid null visual instead of throwing',()=>{
    expect(()=>validateAppSpec(spec(null))).not.toThrow()
    expect(validateAppSpec(spec(null)).valid).toBe(false)
  })
  it('SPEC-INPUT-002 validates slicers on nested pages',()=>{
    const s={version:'1.0',title:'QA',pages:[{id:'p',name:'P',visuals:[visual()],slicers:[{id:'broken',type:'unknown'}]}]}
    expect(validateAppSpec(s).valid).toBe(false)
  })
  it('FILTER-001 excludes a visual outside slicer affects',()=>{
    const s={slicers:[{id:'s',dimension:{table:'QA',column:'Category'},affects:['included']}]}
    expect(buildAppliedFiltersForVisual(s,{id:'excluded'},{'QA[Category]':'North'},{})).toEqual({})
  })
  it('LAYOUT-001 wraps more than twelve KPI cards without nonpositive widths',()=>{
    const s={version:'1.0',title:'QA',visuals:Array.from({length:14},(_,i)=>({...visual('kpi'),id:`k${i}`}))}
    const result=normalizeLayout(s)
    expect(result.visuals.every(v=>v.position.w>=1&&v.position.x+v.position.w<=12)).toBe(true)
  })
  it('TOOLTIP-001 escapes category and measure markup',()=>{
    const {option}=Tooltip({measureName:'Revenue'},{theme:{},data:{rows:[],fields:[]},encoding:{},dimensions:{width:480,height:320},selection:{}})
    const html=option.tooltip.formatter({name:'<b>North</b>',seriesName:'<i>Revenue</i>',value:25,color:'#14b8a6'})
    expect(html).not.toContain('<b>North</b>')
    expect(html).not.toContain('<i>Revenue</i>')
    expect(html).toContain('&lt;b&gt;North&lt;/b&gt;')
  })
})

describe('Audit data and filter contracts — supported behavior',()=>{
  it('preserves zero, negative, decimal and null measure values',()=>{
    const values=[0,-10,0.00001,null]
    const rows=values.map((v,i)=>({'QA[Category]':`C${i}`,'[Revenue]':v}))
    expect(normaliseRows(rows,'QA[Category]',['Revenue']).map(r=>r._val)).toEqual(values)
  })
  it('preserves Unicode and duplicate categories without implicit aggregation',()=>{
    const rows=[{'QA[Category]':'日本語 & <x>',Revenue:1},{'QA[Category]':'日本語 & <x>',Revenue:2}]
    expect(normaliseRows(rows,'QA[Category]',['Revenue'])).toHaveLength(2)
    expect(normaliseRows(rows,'QA[Category]',['Revenue'])[0]._cat).toBe('日本語 & <x>')
  })
  it('table normalization retains multiple measures and dimensions',()=>{
    const rows=[{'QA[Category]':'North','QA[Product]':'P','[Revenue]':100,'[Cost]':40}]
    const result=normaliseTableRows(rows,['QA[Category]','QA[Product]'],['Revenue','Cost'])
    expect(result[0]._cats).toEqual(['North','P']);expect(result[0]._vals).toEqual([100,40])
  })
  it('ordinary mark-sourced cross-filter excludes source and applies to peers',()=>{
    const filters={'QA[Category]':'North'},sources={'QA[Category]':'a'}
    expect(buildAppliedFiltersForVisual({}, {id:'a'},filters,sources)).toEqual({})
    expect(buildAppliedFiltersForVisual({}, {id:'b'},filters,sources)).toEqual(filters)
  })
})
