import {describe,it,expect} from 'vitest'
import {instantiateVisual,validateTemplate} from '@vilsem/core/templates'
import {resolveVisualSpec} from '@vilsem/core/spec/resolve'
import {requiredRendererVersion} from '@vilsem/core/pbir'
const base={meta:{id:'point-repeat'},slots:{country:{kind:'dimension'},x:{kind:'measure'},y:{kind:'measure'}},transforms:[{points:{fields:['x','y'],numeric:['x','y'],name:'country'},as:'xy'}],template:{series:{repeat:'$calc.xy.data',template:{type:'scatter',name:'$item.name',data:['$item']}}}}
const rows=[{_cat:'US',_vals:[10,2]},{_cat:'Canada',_vals:[20,3]}]
describe('bounded normalized data record repetition',()=>{
 it('copies named point records with their original values and source identities',()=>{
  expect(validateTemplate(base).errors).toEqual([])
  const out=instantiateVisual({template:base,rows}).option
  expect(out.series[0]).toEqual({type:'scatter',name:'US',data:[{name:'US',value:[10,2],rowIndexes:[0]}]})
  expect(out.series[1].data[0]).toMatchObject({name:'Canada',value:[20,3],rowIndexes:[1]})
  expect(instantiateVisual({template:base,rows:[]}).option.series).toEqual([])
  expect(requiredRendererVersion({template:base})).toBe('4.25.0.0')
 })
 it('supports nested numeric tuples and rejects unknown/prototype paths',()=>{
  const template={...base,template:{series:{repeat:'$calc.xy.data',template:{name:'$item.name',data:[{value:[0,'$item.value.0'],rowIndexes:'$item.rowIndexes'},{value:[1,'$item.value.1'],rowIndexes:'$item.rowIndexes'}]}}}}
  expect(instantiateVisual({template,rows}).option.series[0].data).toEqual([{value:[0,10],rowIndexes:[0]},{value:[1,2],rowIndexes:[0]}])
  const spec=path=>({template:{...base,template:{series:{repeat:'$calc.xy.data',template:{name:path}}}}})
  expect(()=>resolveVisualSpec(spec('$item.missing'))).toThrow(/unknown repeat item field/)
  expect(()=>resolveVisualSpec(spec('$item.value.constructor'))).toThrow(/unsafe token path/)
  expect(()=>resolveVisualSpec(spec('$item.__proto__'))).toThrow(/unknown repeat item field|unsafe token path/)
 })
 it('samples the returned row window uniformly and retains the original endpoint identities',()=>{
  const template={...base,transforms:[{points:{fields:['x','y'],numeric:['x','y'],name:'country',sample:4},as:'xy'}],template:{data:'$calc.xy.data'}}
  const input=Array.from({length:10},(_,i)=>({_cat:`row${i}`,_vals:[i,2*i]}))
  const out=instantiateVisual({template,rows:input}).option.data
  expect(out.map(d=>d.rowIndexes)).toEqual([[0],[3],[6],[9]])
  expect(out.map(d=>d.value)).toEqual([[0,0],[3,6],[6,12],[9,18]])
  expect(instantiateVisual({template,rows:[]}).option.data).toEqual([])
  expect(instantiateVisual({template,rows:input.slice(0,1)}).option.data[0].rowIndexes).toEqual([0])
  expect(requiredRendererVersion({template})).toBe('4.25.0.0')
  expect(validateTemplate({...template,transforms:[{points:{fields:['x'],sample:0},as:'xy'}]}).errors.join()).toMatch(/sample count/)
 })
 it('does not manufacture phantom null points after all source fields were limited',()=>{
  const template={...base,transforms:[{take:{field:'x',count:1},as:'shortX'},{take:{field:'y',count:1},as:'shortY'},{points:{fields:['shortX','shortY'],numeric:['shortX','shortY']},as:'xy'}],template:{data:'$calc.xy.data'}}
  expect(instantiateVisual({template,rows}).option.data).toEqual([{name:'',value:[10,2],rowIndexes:[0]}])
 })
})
