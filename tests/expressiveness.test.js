import { describe,it,expect } from 'vitest'
import { instantiateVisual,shapeSlots,applyTransforms,makeFormatter,validateTemplate } from '@vilsem/core/templates'
import { resolveVisualSpec } from '@vilsem/core/spec/resolve'
const slots={a:{kind:'dimension'},b:{kind:'dimension'},c:{kind:'dimension'},v:{kind:'measure'}}
const rows=[{_cat:'A',_cats:['A','X','red'],_val:4},{_cat:'A',_cats:['A','Y','blue'],_val:2},{_cat:'A',_cats:['A','X','red'],_val:3},{_cat:'B',_cats:['B','X','red'],_val:1}]
const tpl=(transforms,body={series:[]})=>({meta:{id:'expressiveness-test'},slots,transforms,template:body})
const calc=(transforms,shaped=shapeSlots(rows,slots).shaped,cats=rows.map(r=>r._cat))=>applyTransforms(transforms,shaped,cats,{}).calc

describe('expressiveness declarative data shaping',()=>{
 it('keeps all six dimension levels, including the third, distinct',()=>{
  const shaped=shapeSlots([{_cats:['1','2','3','4','5','6'],_val:2}],Object.fromEntries(['a','b','c','d','e','f'].map(x=>[x,{kind:'dimension'}]))).shaped
  expect(Object.values(shaped).map(s=>s.values[0])).toEqual(['1','2','3','4','5','6'])
 })
 it('aggregates duplicate edge weights, namespaces equal labels and retains every contributing row',()=>{
  const flow=calc([{links:{source:'a',target:'b',value:'v'},as:'flow'}]).flow
  expect(flow.nodes).toHaveLength(4)
  expect(flow.links.map(e=>e.value)).toEqual([7,2,1])
  expect(flow.links[0].rowIndexes).toEqual([0,2])
  expect(flow.nodes.map(n=>n.name)).toHaveLength(new Set(flow.nodes.map(n=>n.name)).size)
 })
 it('builds a real three-level hierarchy without multiplying parent totals',()=>{
  const tree=calc([{hierarchy:{levels:['a','b','c'],value:'v'},as:'tree'}]).tree
  expect(tree.children[0].value).toBe(9)
  expect(tree.children[0].children[0].children[0]).toMatchObject({name:'red',value:7,rowIndexes:[0,2]})
  expect(tree.children.reduce((s,n)=>s+n.value,0)).toBe(10)
 })
 it('computes chronological cumulative totals and lag aligned to original row indexes',()=>{
  const shaped={v:{values:[-5,10,-20,4]},time:{values:['2026-02-01','2026-01-01','2026-03-01','2026-04-01']}}
  const c=calc([{window:{op:'sum',field:'v',orderBy:'time'},as:'running'},{window:{op:'lag',field:'running',orderBy:'time',default:0},as:'prior'}],shaped,[])
  expect(c.running.values).toEqual([5,10,-15,-11]);expect(c.prior.values).toEqual([10,0,5,-15])
 })
 it('partitions window calculations and preserves null when a previous observation is absent',()=>{
  const c=calc([{window:{op:'lag',field:'v',partitionBy:'group',orderBy:'time'},as:'prev'}],{v:{values:[10,20,15,25]},group:{values:['A','B','A','B']},time:{values:[1,1,2,2]}},[])
  expect(c.prev.values).toEqual([null,null,10,20])
 })
 it('computes percent-of-total without NaN or reaggregating non-additive model measures implicitly',()=>{
  expect(calc([{window:{op:'percentOfTotal',field:'v'},as:'share'}]).share.values).toEqual([0.4,0.2,0.3,0.1])
  expect(calc([{window:{op:'percentOfTotal',field:'v'},as:'share'}],{v:{values:[0,null]}},[]).share.values).toEqual([null,null])
 })
 it('parses ISO dates in UTC and calculates a bounded start/duration series',()=>{
  const shaped={start:{values:['2026-03-07','bad','2026-02-30']},end:{values:['2026-03-09','2026-03-10','2026-03-01']}}
  const c=calc([{date:{field:'start',take:2},as:'starts'},{date:{field:'end',take:2},as:'ends'},{calculate:'ends - starts',as:'duration'}],shaped,[])
  expect(c.duration.values).toEqual([2*86400000,null]);expect(c.starts.values).toHaveLength(2)
 })
 it('expands bounded facets into independent axes and series with the same category domain',()=>{
  const template=tpl([{facet:{by:'a',category:'b',value:'v',columns:2},as:'facets'}],{series:{repeat:'$calc.facets.panels',template:{type:'bar',name:'$item.name',xAxisIndex:'$item.index',data:'$item.data'}}})
  const {option,warnings}=instantiateVisual({template,rows})
  expect(warnings).toEqual([]);expect(option.series.map(s=>s.name)).toEqual(['A','B'])
  expect(option.series[0].data.map(d=>d.value)).toEqual([7,2]);expect(option.series[1].data.map(d=>d.value)).toEqual([1,null])
  expect(option.series[0].data[0].rowIndexes).toEqual([0,2])
 })
 it('refuses excess facets instead of silently dropping panels',()=>{
  expect(()=>calc([{facet:{by:'a',category:'b',value:'v',maxPanels:1},as:'facets'}])).toThrow(/maxPanels/)
 })
 it.each(['window','date','take','links','hierarchy','facet'])('has a defined empty-data contract for %s',op=>{
  const configs={window:{op:'sum',field:'v'},date:{field:'a'},take:{field:'a',count:2},links:{source:'a',target:'b',value:'v'},hierarchy:{levels:['a','b','c'],value:'v'},facet:{by:'a',category:'b',value:'v'}}
  const template=tpl([{[op]:configs[op],as:'result'}])
  expect(()=>resolveVisualSpec({template},[])).not.toThrow()
 })
 it('supports UTC date axis placeholders and human labels without evaluating code',()=>{
  expect(makeFormatter('{value:date}')('2026-01-02T03:00:00Z')).toBe('2026-01-02')
  expect(makeFormatter('{value:date}')(Date.UTC(2026,0,2))).toBe('2026-01-02')
  expect(makeFormatter('{label}')({data:{label:'Actual label'},name:'id'})).toBe('Actual label')
 })
 it.each([
  [{window:{op:'exec',field:'v'},as:'bad'},'unknown window'],
  [{calculate:'v + ghost',as:'bad'},'unknown field'],
  [{calculate:'fetch(v)',as:'bad'},'unknown function'],
  [{calculate:'v.constructor',as:'bad'},'invalid calculate'],
  [{links:{source:'ghost',target:'b',value:'v'},as:'bad'},'unknown field'],
  [{date:{field:'a'},as:'constructor'},'safe'],
  [{facet:{by:'a',category:'b',value:'v',columns:0},as:'bad'},'columns'],
 ])('rejects invalid transforms before data access', (t,message)=>expect(validateTemplate(tpl([t])).errors.join(' ')).toContain(message))
 it('rejects imperative callbacks and prototype keys without executing them',()=>{
  expect(()=>resolveVisualSpec({template:tpl([],{series:[{type:'custom',renderItem:'arbitrary code'}]})})).toThrow(/bounded expression AST/)
  expect(()=>resolveVisualSpec({template:tpl([],JSON.parse('{"__proto__":{"polluted":true}}'))})).toThrow(/unsafe/)
  expect({}).not.toHaveProperty('polluted')
 })
 it('enforces input and repeat expansion limits',()=>{
  expect(()=>instantiateVisual({template:tpl([]),rows:Array(10001).fill({_val:1})})).toThrow(/10000/)
  const template=tpl([],{series:{repeat:'$slot.a.values',template:{repeat:'$slot.a.values',template:{repeat:'$slot.a.values',template:{type:'bar'}}}}})
  expect(()=>instantiateVisual({template,rows:Array(30).fill({_cat:'a',_val:1})})).toThrow(/20000/)
 })
})


it('omits null reference annotations rather than crashing or inventing a zero target',()=>{
 const template=tpl([],{series:[{type:'line',data:'$slot.v.values',markLine:{data:[{yAxis:'$slot.v.last'}]}}]})
 expect(instantiateVisual({template,rows:[]}).option.series[0].markLine.data).toEqual([])
 expect(instantiateVisual({template,rows}).option.series[0].markLine.data).toEqual([{yAxis:1}])
})


it('validates repeat item tokens even before model data is available',()=>{
 const template=tpl([{facet:{by:'a',category:'b',value:'v'},as:'facets'}],{series:{repeat:'$calc.facets.panels',template:{name:'$item.misspelled'}}})
 expect(()=>resolveVisualSpec({template})).toThrow(/unknown repeat item field/)
 expect(()=>resolveVisualSpec({template:tpl([],{series:[{name:'$item.name'}]})})).toThrow(/unknown repeat item field/)
})


it('does not treat inherited property names as formatter, repeat schema or math functions',()=>{
 const template=tpl([],{series:{repeat:'$slot.a.constructor',template:{name:'$item.name'}}})
 expect(()=>resolveVisualSpec({template})).toThrow(/unknown repeat item field/)
})
