import { describe, it, expect } from 'vitest'
import { buildLocalReportParts } from '../ui/src/pages/powerbi/localReportBuilder.js'
const bundle={success:true,guid:'renderer',parts:[{path:'CustomVisuals/renderer/resources/renderer.pbiviz.json',content:'{}'}]}
const measures=[{name:'Sales',table:'Measures'}]
const visual={id:'bar1',type:'bar',data:{measures:['Sales'],groupBy:{table:'Products',column:'Category'}},position:{x:0,y:0,w:6,h:3},config:{title:'Sales'}}
const spec={title:'New report',visuals:[visual]}
const build=s=>buildLocalReportParts({spec:s,measures,bundle})
describe('new enhanced Power BI report',()=>{
  it.each(['shape','divider'])('exports %s without creating a measure binding',type=>{
    const parts=build({...spec,visuals:[{...visual,type,data:{},config:{shape:'triangle'}}]})
    const v=JSON.parse(parts.find(p=>p.path.endsWith('/visual.json')).content)
    expect(v.visual.query.queryState).toEqual({})
    expect(JSON.stringify(v)).toContain(type)
  })
  it('rejects a bar race without both playback and category fields',()=>{
    expect(()=>build({...spec,visuals:[{...visual,type:'bar_race'}]})).toThrow(/playback/i)
  })
  it('binds playback and category fields for a valid bar race',()=>{
    const parts=build({...spec,visuals:[{...visual,type:'bar_race',config:{playAxis:'Calendar[Year]'}}]})
    const v=JSON.parse(parts.find(p=>p.path.endsWith('/visual.json')).content)
    expect(v.visual.query.queryState.category.projections[0].field.Column.Property).toBe('Year')
    expect(v.visual.query.queryState.category2.projections[0].field.Column.Property).toBe('Category')
  })
  it('binds existing fields directly and embeds a private renderer',()=>{
    const parts=build(spec),v=JSON.parse(parts.find(p=>p.path.endsWith('/visual.json')).content)
    expect(v.visual.query.queryState.content.projections[0].field.Measure.Property).toBe('Sales')
    expect(v.visual.query.queryState.category.projections[0].field.Column.Property).toBe('Category')
    expect(JSON.stringify(parts)).not.toContain('_SemanticaGenerated')
    const report=JSON.parse(parts.find(p=>p.path==='definition/report.json').content)
    expect(report.resourcePackages[0].type).toBe('CustomVisual')
    expect(report.resourcePackages[0].items[0].path).toBe('renderer.pbiviz.json')
    expect(report.themeCollection).toBeDefined()
  })
  it.each(['text_box','custom'])('rejects unsupported %s instead of silently dropping it',type=>{
    expect(()=>build({...spec,visuals:[visual,{...visual,id:'other',type}]})).toThrow('does not yet support')
  })
  it('rejects missing measure metadata',()=>{
    expect(()=>buildLocalReportParts({spec,measures:[],bundle})).toThrow('could not be resolved')
  })
  it('rejects unimplemented slicers',()=>expect(()=>build({...spec,slicers:[{id:'s'}]})).toThrow('slicer'))
  it('does not modify the input spec',()=>{
    const before=JSON.stringify(spec);build(spec);expect(JSON.stringify(spec)).toBe(before)
  })
})


describe('Power BI canvas theme parity',()=>{
  it.each([['dark','#0b0b12'],['light','#FFFFFF'],[undefined,'#0b0b12']])('preserves %s page and visual mode',(mode,expected)=>{
    const parts=build({...spec,theme:{mode},pages:[{id:'a',name:'First',visuals:[visual]},{id:'b',name:'Second',visuals:[visual]}]})
    const pages=parts.filter(p=>p.path.endsWith('/page.json')).map(p=>JSON.parse(p.content))
    expect(pages).toHaveLength(2)
    for(const page of pages){
      expect(page.objects.background[0].properties.color.solid.color.expr.Literal.Value).toBe(`'${expected}'`)
      expect(page.objects.background[0].properties.transparency.expr.Literal.Value).toBe('0D')
      expect(page.objects.outspace[0].properties.color.solid.color.expr.Literal.Value).toBe(`'${expected}'`)
    }
    for(const p of parts.filter(p=>p.path.endsWith('/visual.json'))){
      const v=JSON.parse(p.content).visual
      const encoded=v.objects.semantica[0].properties.primitiveSpec.expr.Literal.Value
      const primitive=JSON.parse(encoded.slice(1,-1).replace(/''/g,"'"))
      expect(primitive.canvasTheme).toBe(mode==='light'?'light':'dark')
      expect(v.visualContainerObjects.background[0].properties.show.expr.Literal.Value).toBe('false')
    }
  })
})


describe('full-page export coverage',()=>{
  it('retains nine distinct visuals inside the chosen page bounds',()=>{
    const types=['bar','column','line','area','donut','pie','treemap','radar','table']
    const parts=build({...spec,layout:{pagePreset:'custom',pageWidth:1440,pageHeight:1000,rowHeight:96,gap:12},visuals:types.map((type,i)=>({...visual,id:type,type,position:{x:i%3*4,y:Math.floor(i/3)*3,w:4,h:3}}))})
    const visuals=parts.filter(p=>p.path.endsWith('/visual.json')).map(p=>JSON.parse(p.content))
    expect(visuals).toHaveLength(types.length)
    expect(new Set(visuals.map(v=>v.name)).size).toBe(types.length)
    for(const v of visuals){expect(v.position.x+v.position.width).toBeLessThanOrEqual(1440);expect(v.position.y+v.position.height).toBeLessThanOrEqual(1000)}
  })
})
