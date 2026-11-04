import {describe,it,expect} from 'vitest'
import {instantiateVisual,validateTemplate} from '@vilsem/core/templates'
const resolve=(slots,rows,transform,skeleton)=>instantiateVisual({rows,template:{meta:{id:'sequence'},slots,transforms:[{...transform,as:'s'}],template:skeleton}}).option
describe('bounded financial sequences',()=>{
 it('builds a signed bridge with start/end totals, connectors and source identities',()=>{
  const o=resolve({cat:{kind:'dimension'},delta:{kind:'measure'},start:{kind:'measure'}},[{_cat:'A',_val:-15,_val2:10},{_cat:'B',_val:7,_val2:10}],{waterfall:{category:'cat',value:'delta',start:'start',total:true}},{categories:'$calc.s.categories',base:'$calc.s.base',gain:'$calc.s.positive',loss:'$calc.s.negative',totals:'$calc.s.totals',endpoints:'$calc.s.endpoints'})
  expect(o.categories).toEqual(['Start','A','B','Total'])
  expect(o.base.map(p=>p.value)).toEqual([0,-5,-5,0]);expect(o.loss[1].value).toBe(15);expect(o.gain[2].value).toBe(7)
  expect(o.totals.map(p=>p.value)).toEqual([10,0,0,2]);expect(o.endpoints.map(p=>p.value)).toEqual([10,-5,2,2])
  expect(o.totals[3].rowIndexes).toEqual([0,1])
 })
 it('groups interleaved categories and inserts explicitly cumulative boundary subtotals',()=>{
  const o=resolve({group:{kind:'dimension'},detail:{kind:'dimension'},value:{kind:'measure'}},[{_cat:'A',_cats:['A','x'],_val:3},{_cat:'B',_cats:['B','x'],_val:2},{_cat:'A',_cats:['A','y'],_val:4}],{waterfall:{category:'group',detail:'detail',value:'value',subtotals:true}},{categories:'$calc.s.categories',totals:'$calc.s.totals'})
  expect(o.categories).toEqual(['A · x','A · y','A · cumulative','B · x','B · cumulative'])
  expect(o.totals.map(p=>p.value)).toEqual([0,0,7,0,9]);expect(o.totals.at(-1).rowIndexes).toEqual([0,2,1])
 })
 it('rejects inconsistent start values and numeric overflow rather than inventing a baseline',()=>{
  const slots={cat:{kind:'dimension'},value:{kind:'measure'},start:{kind:'measure'}},t={waterfall:{category:'cat',value:'value',start:'start'}}
  expect(()=>resolve(slots,[{_cat:'A',_val:1,_val2:2},{_cat:'B',_val:1,_val2:3}],t,{data:'$calc.s.base'})).toThrow(/constant/)
  expect(()=>resolve(slots,[{_cat:'A',_val:1e308,_val2:1e308}],t,{data:'$calc.s.base'})).toThrow(/overflow/)
 })
 it('computes recursive Heikin-Ashi from ordered real OHLC values and resets after a null gap',()=>{
  const slots={date:{kind:'time'},open:{kind:'measure'},close:{kind:'measure'},low:{kind:'measure'},high:{kind:'measure'}}
  const rows=[[10,14,8,16],[14,18,12,20],[null,null,null,null],[20,24,18,26]].map((v,i)=>({_cat:`2026-01-0${i+1}`,_vals:v}))
  const o=resolve(slots,rows,{heikinAshi:{open:'open',close:'close',low:'low',high:'high'}},{data:'$calc.s.data'})
  expect(o.data.map(p=>p.value)).toEqual([[12,12,8,16],[12,16,12,20],[null,null,null,null],[22,22,18,26]])
  expect(o.data[1].rowIndexes).toEqual([1])
  expect(()=>resolve(slots,[{_cat:'x',_vals:[10,14,11,16]}],{heikinAshi:{open:'open',close:'close',low:'low',high:'high'}},{data:'$calc.s.data'})).toThrow(/OHLC/)
 })
 it('validates unknown sequence fields without accepting executable custom logic',()=>{
  expect(validateTemplate({meta:{id:'bad'},slots:{v:{kind:'measure'}},transforms:[{heikinAshi:{open:'v',close:'missing',low:'v',high:'v'},as:'s'}],template:{series:[]}}).errors.join(' ')).toContain('missing')
 })
 it('bounds cumulative identity expansion and handles empty sequences and extreme finite candles',()=>{
  const slots={cat:{kind:'dimension'},value:{kind:'measure'}}
  const t={waterfall:{category:'cat',value:'value',subtotals:true}}
  expect(()=>resolve(slots,Array.from({length:201},(_,i)=>({_cat:String(i),_val:1})),t,{data:'$calc.s.totals'})).toThrow(/expansion/)
  expect(resolve(slots,[{_cat:'A',_val:null}],t,{data:'$calc.s.categories'}).data).toEqual([])
  const o=resolve({date:{kind:'time'},open:{kind:'measure'},close:{kind:'measure'},low:{kind:'measure'},high:{kind:'measure'}},[{_cat:'2026-01-01',_vals:[1e308,-1e308,-1e308,1e308]}],{heikinAshi:{open:'open',close:'close',low:'low',high:'high'}},{data:'$calc.s.data'})
  expect(o.data[0].value).toEqual([0,0,-1e308,1e308])
 })
})
