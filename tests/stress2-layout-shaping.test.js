import {describe,it,expect} from 'vitest'
import {instantiateVisual,validateTemplate} from '@vilsem/core/templates'
const slots={cat:{kind:'dimension'},raw:{kind:'dimension'},value:{kind:'measure'}}
const rows=[['A','12',3],['B','7',2],['A',null,1],['C','bad',1]].map(([cat,raw,value])=>({_cat:cat,_cats:[cat,raw],_val:value}))
const resolve=(op,d,skeleton,source=rows)=>instantiateVisual({rows:source,template:{meta:{id:'bounded-layout'},slots,transforms:[{[op]:d,as:'s'}],template:skeleton}}).option
describe('bounded declarative layout shaping',()=>{
 it('allows a strict top-N list without an Other bucket while keeping the default backward compatible',()=>{
  const strict=resolve('top',{category:'cat',value:'value',count:1,other:false},{data:'$calc.s.pieData'}).data
  expect(strict).toEqual([{name:'A',value:4,rowIndexes:[0,2]}])
  expect(validateTemplate({meta:{id:'strict-top'},slots,transforms:[{top:{category:'cat',value:'value',count:1,other:false},as:'s'}],template:{data:'$calc.s.pieData'}}).errors).toEqual([])
 })
 it('projects aligned fields without aggregating detail rows and preserves source identities',()=>{
  const data=resolve('points',{fields:['raw','cat'],numeric:['raw'],name:'cat'},{series:[{data:'$calc.s.data'}]}).series[0].data
  expect(data).toEqual([{name:'A',value:[12,'A'],rowIndexes:[0]},{name:'B',value:[7,'B'],rowIndexes:[1]},{name:'A',value:[null,'A'],rowIndexes:[2]},{name:'C',value:[null,'C'],rowIndexes:[3]}])
 })
 it('wraps all aggregated categories into bounded panels without losing source rows',()=>{
  const data=resolve('chunk',{category:'cat',value:'value',size:2,columns:2},{grid:{repeat:'$calc.s.panels',template:{index:'$item.index',data:'$item.data',categories:'$item.categories'}}}).grid
  expect(data.map(p=>p.categories)).toEqual([['A','B'],['C']]);expect(data[0].data[0]).toEqual({name:'A',value:4,rowIndexes:[0,2]})
  expect(()=>resolve('chunk',{category:'cat',value:'value',size:1},{grid:'$calc.s.panels'},Array.from({length:37},(_,i)=>({_cat:String(i),_val:1})))).toThrow(/36 panels/)
 })
 it('groups top-N and Other deterministically and refuses a label collision',()=>{
  expect(resolve('top',{category:'cat',value:'value',count:1},{data:'$calc.s.pieData'}).data).toEqual([{name:'A',value:4,rowIndexes:[0,2]},{name:'Other',value:3,rowIndexes:[1,3]}])
  expect(()=>resolve('top',{category:'cat',value:'value',count:1,other:'A'},{data:'$calc.s.pieData'})).toThrow(/collides/)
 })
 for(const layout of ['grid','hemicycle'])it(`allocates exactly 100 proportional ${layout} marks using largest remainders`,()=>{
  const skeleton={series:{repeat:'$calc.s.groups',template:{name:'$item.name',seats:'$item.seats',data:'$item.data'}}}
  const option=resolve('allocate',{category:'cat',value:'value',total:100,layout},skeleton)
  expect(option.series.map(s=>s.seats)).toEqual([57,29,14]);expect(option.series.flatMap(s=>s.data)).toHaveLength(100)
  expect(option.series[0].data[0].rowIndexes).toEqual([0,2])
  expect(option.series.flatMap(s=>s.data).every(p=>p.value.every(Number.isFinite))).toBe(true)
  if(layout==='grid')expect(new Set(option.series.flatMap(s=>s.data).map(p=>p.value.join(','))).size).toBe(100)
  else expect(option.series.flatMap(s=>s.data).every(p=>p.value[1]>=0&&Math.hypot(...p.value)<=1.00001)).toBe(true)
  expect(()=>resolve('allocate',{category:'cat',value:'value',total:100,layout},skeleton,[{_cat:'A',_val:-1}])).toThrow(/non-negative/)
  expect(resolve('allocate',{category:'cat',value:'value',total:100,layout},skeleton,[{_cat:'A',_val:0}]).series).toEqual([])
 })
 it('bounds expansion and validates field references and integer parameters before data',()=>{
  for(const [op,d] of [['points',{fields:['missing']}],['chunk',{category:'cat',value:'value',size:0}],['top',{category:'cat',value:'value',count:0}],['allocate',{category:'cat',value:'value',layout:'evil',total:2001}]]) {
   expect(validateTemplate({meta:{id:'bad'},slots,transforms:[{[op]:d,as:'s'}],template:{series:[]}}).errors.length).toBeGreaterThan(0)
  }
  expect(()=>resolve('allocate',{category:'cat',value:'value',total:2000,layout:'grid'},{data:'$calc.s.groups'},Array.from({length:11},()=>({_cat:'A',_val:1})))).toThrow(/lineage/)
 })
})
