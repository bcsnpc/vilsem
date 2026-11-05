import {describe,it,expect} from 'vitest'
import {validateSpecDetailed} from '../packages/core/src/spec/diagnostics.js'
const template=()=>({meta:{id:'diagnostics'},slots:{category:{kind:'dimension'},value:{kind:'measure'}},template:{xAxis:{type:'category',data:'$slot.category.categories'},yAxis:{},series:[{type:'bar',data:'$slot.value.values'}]}})
const broken=(edit)=>{const spec={template:template()};edit(spec);return spec}
describe('precise declarative spec diagnostics',()=>{
 const cases=[
  [{type:'nativeBar'},'/type'],
  [{type:'bar',version:99},'/version'],
  [{type:'bar',config:[]},'/config'],
  [broken(s=>delete s.template.meta.id),'/template/meta/id'],
  [broken(s=>s.template.meta.formatVersion=99),'/template/meta/formatVersion'],
  [broken(s=>s.template.slots=[]),'/template/slots'],
  [broken(s=>s.template.slots.category.kind='category'),'/template/slots/category/kind'],
  [broken(s=>delete s.template.template),'/template/template'],
  [broken(s=>s.template.params={}),'/template/params'],
  [broken(s=>s.template.transforms={}),'/template/transforms'],
  [broken(s=>s.template.template.series[0].data='$slot.missing.values'),'/template/template/series/0/data'],
  [broken(s=>s.template.template.series[0].data='$slot.value.noAccessor'),'/template/template/series/0/data'],
  [broken(s=>s.template.template.series[0].data='$javascript.run'),'/template/template/series/0/data'],
  [broken(s=>s.template.template.series[0].label={formatterTemplate:'{value:evil}'}),'/template/template/series/0/label/formatterTemplate'],
  [broken(s=>s.template.template.series[0].renderItem='function(){}'),'/template/template/series/0/renderItem'],
 ]
 it.each(cases.map(([spec,path],i)=>[i+1,spec,path]))('explains broken fixture%s with a pointer and fix',(_i,spec,path)=>{
  const result=validateSpecDetailed(spec);expect(result.valid).toBe(false)
  const error=result.errors.find(e=>e.path===path);expect(error).toBeDefined();expect(error.expected).toBeTruthy();expect(error.suggestions[0].length).toBeGreaterThan(10);expect(result.suggestions.length).toBeGreaterThan(0)
 })
 it('returns the actual resolved option for valid templates and compositions',()=>{for(const spec of [{type:'bar'},{template:template()}]){const r=validateSpecDetailed(spec);expect(r.valid).toBe(true);expect(r.errors).toEqual([]);expect(r.option.series).toBeDefined()}})
 it('escapes JSON pointer names without mutating the source',()=>{const s=broken(s=>s.template.slots['a/b~c']={kind:'wrong'});const before=JSON.stringify(s);expect(validateSpecDetailed(s).errors.some(e=>e.path==='/template/slots/a~1b~0c/kind')).toBe(true);expect(JSON.stringify(s)).toBe(before)})
})
