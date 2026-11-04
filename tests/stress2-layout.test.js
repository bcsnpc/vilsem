import {describe,it,expect} from 'vitest'
import {instantiateVisual,validateTemplate} from '@vilsem/core/templates'
import {makeVisualContainer,validateVisualContainer} from '@vilsem/core/pbir'
import {normaliseRows,rowsFromCategorical} from '@vilsem/core/dax'
describe('stress2 data and layout contract',()=>{
 it('carries all six host/SSR measure values to named slots and PBIR roles',async()=>{
  const names=Array.from({length:6},(_,i)=>'M'+i)
  const raw=[Object.fromEntries([['T[C]','A'],...names.map((n,i)=>['['+n+']',i])])]
  const ssr=normaliseRows(raw,'T[C]',names)
  const runtime=rowsFromCategorical({categories:[{values:['A']}],values:names.map((_,i)=>({values:[i]}))})
  const template={meta:{id:'six'},slots:{cat:{kind:'dimension'},...Object.fromEntries(names.map(n=>[n,{kind:'measure'}]))},template:{series:names.map(n=>({type:'line',data:`$slot.${n}.values`}))}}
  expect(instantiateVisual({template,rows:ssr}).option).toEqual(instantiateVisual({template,rows:runtime}).option)
  expect(instantiateVisual({template,rows:runtime}).option.series[5].data).toEqual([5])
  const visual=makeVisualContainer({visualName:'six',spec:{template},bindings:{dimensions:[{table:'T',column:'C'}],measures:names.map(name=>({table:'T',name}))}})
  expect(Object.keys(visual.visual.query.queryState)).toContain('senary')
  await expect(validateVisualContainer(visual)).resolves.toBe(true)
 })
 it('explicitly concatenates repeated layers without flattening point coordinates',()=>{
  const template={meta:{id:'layers'},slots:{cat:{kind:'dimension'},value:{kind:'measure'}},template:{series:{concat:[[{type:'bar',data:'$slot.value.values'}],[{type:'scatter',data:'$slot.value.pairs'}]]}}}
  const option=instantiateVisual({template,rows:[{_cat:'A',_val:7}]}).option
  expect(option.series).toHaveLength(2);expect(option.series[1].data).toEqual([['A',7]])
  template.template.series={concat:['$slot.value.sum']}
  expect(()=>instantiateVisual({template})).toThrow(/concat members/)
 })
 it('rejects seven measures rather than silently rendering missing series',()=>{
  expect(validateTemplate({meta:{id:'seven'},slots:{value:{kind:'measure',count:7}},template:{series:[]}}).errors.join(' ')).toContain('at most six')
 })
 it('allows arithmetic after a relational facet without treating panels as a numeric vector',()=>{
  const template={meta:{id:'horizon'},slots:{cat:{kind:'dimension'},group:{kind:'dimension'},value:{kind:'measure'}},transforms:[{facet:{by:'group',category:'cat',value:'value'},as:'panels'},{calculate:'value/2',as:'half'}],template:{series:[{type:'line',data:'$calc.half.values'}]}}
  expect(instantiateVisual({template,rows:[{_cat:'A',_cats:['A','X'],_val:12}]}).option.series[0].data).toEqual([6])
 })
 it('computes bounded group statistics without treating null as zero',()=>{
  const slots={cat:{kind:'dimension'},group:{kind:'dimension'},value:{kind:'measure'}}
  const rows=[1,2,3,4,null].map((value,i)=>({_cat:String(i),_cats:[String(i),'A'],_val:value}))
  const optionFor=stat=>instantiateVisual({template:{meta:{id:'stat'},slots,transforms:[{stat:{field:'value',...stat},as:'s'}],template:{series:[{type:'line',data:'$calc.s.values'}]}},rows}).option
  expect(optionFor({op:'median'}).series[0].data).toEqual([2.5,2.5,2.5,2.5,2.5])
  expect(optionFor({op:'quantile',q:0.25}).series[0].data[0]).toBe(1.75)
  expect(optionFor({op:'stddev',sample:true}).series[0].data[0]).toBeCloseTo(Math.sqrt(5/3))
  const template={meta:{id:'group-stat'},slots,transforms:[{stat:{field:'value',op:'mean',partitionBy:'group'},as:'s'}],template:{series:[{data:'$calc.s.values'}]}}
  expect(instantiateVisual({template,rows:[{_cat:'1',_cats:['1','A'],_val:4},{_cat:'2',_cats:['2','B'],_val:10}]}).option.series[0].data).toEqual([4,10])
  template.transforms[0].stat={field:'value',op:'quantile',q:2}
  expect(()=>instantiateVisual({template,rows})).toThrow(/q must be/)
 })
 it('exposes per-facet KPI summaries from each facet data rather than the whole chart',()=>{
  const template={meta:{id:'facet-kpi'},slots:{date:{kind:'time'},group:{kind:'dimension'},value:{kind:'measure'}},transforms:[{facet:{by:'group',category:'date',value:'value'},as:'f'}],template:{graphic:{repeat:'$calc.f.panels',template:{name:'$item.name',latest:'$item.last',total:'$item.sum'}}}}
  const rows=[{_cat:'2026-01-01',_cats:['2026-01-01','A'],_val:2},{_cat:'2026-02-01',_cats:['2026-02-01','A'],_val:3},{_cat:'2026-01-01',_cats:['2026-01-01','B'],_val:10}]
  expect(instantiateVisual({template,rows}).option.graphic).toEqual([{name:'A',latest:3,total:5},{name:'B',latest:10,total:10}])
 })
})
