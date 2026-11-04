import {describe,it,expect} from 'vitest'
import {instantiateVisual,validateTemplate} from '@vilsem/core/templates'
import {requiredRendererVersion} from '@vilsem/core/pbir'
const resolve=(template,rows)=>instantiateVisual({template,rows}).option.result
const conversion={meta:{id:'conversion-test'},slots:{stage:{kind:'dimension'},weight:{kind:'measure'}},transforms:[{conversion:{category:'stage',value:'weight'},as:'c'}],template:{result:'$calc.c'}}
const bands={meta:{id:'bands-test'},slots:{date:{kind:'time'},weight:{kind:'measure'}},transforms:[{dateBands:{field:'date',weekdays:[0,6]},as:'b'}],template:{result:'$calc.b'}}
const ewma={meta:{id:'ewma-test'},slots:{date:{kind:'dimension'},group:{kind:'dimension'},value:{kind:'measure'}},transforms:[{window:{field:'value',op:'ewma',alpha:0.5,orderBy:'date',partitionBy:'group'},as:'e'}],template:{result:'$calc.e.values'}}

describe('bounded conversion, calendar bands and smoothing',()=>{
 it('aggregates ordered stages with source identities and honest zero-prior labels',()=>{
  const out=resolve(conversion,[{_cat:'A',_val:60},{_cat:'B',_val:50},{_cat:'A',_val:40},{_cat:'C',_val:0},{_cat:'D',_val:5}]).data
  expect(out.map(d=>d.value)).toEqual([100,50,0,5])
  expect(out.map(d=>d.conversion)).toEqual([null,0.5,0,null])
  expect(out[0].rowIndexes).toEqual([0,2]);expect(out[1].label).toBe('B: 50% of prior');expect(out[3].label).toContain('zero prior')
  expect(resolve(conversion,[])).toEqual({data:[]})
 })
 it('refuses negative, overflowing and excessive stage inputs',()=>{
  expect(()=>resolve(conversion,[{_cat:'A',_val:-1}])).toThrow(/non-negative/)
  expect(()=>resolve(conversion,[{_cat:'A',_val:1e308},{_cat:'A',_val:1e308}])).toThrow(/aggregate exceeds/)
  expect(()=>resolve(conversion,[{_cat:'A',_val:1e-300},{_cat:'B',_val:1e300}])).toThrow(/ratio exceeds/)
  expect(()=>resolve(conversion,Array.from({length:2001},(_,i)=>({_cat:String(i),_val:1})))).toThrow(/2000 stages/)
 })
 it('coalesces adjacent UTC weekend dates including duplicate rows and ignores weekday/missing cells',()=>{
  const out=resolve(bands,[{_cat:'2026-10-31T00:00:00.0000000',_val:1},{_cat:'2026-11-01',_val:2},{_cat:'2026-10-31',_val:3},{_cat:'2026-11-02',_val:4},{_cat:null,_val:5}])
  expect(out.areas).toHaveLength(1)
  expect(out.areas[0].map(d=>d.xAxis)).toEqual([Date.UTC(2026,9,31),Date.UTC(2026,10,2)])
  expect(out.areas[0][0].rowIndexes).toEqual([0,2,1])
  expect(resolve(bands,[])).toEqual({areas:[]})
  expect(()=>resolve(bands,[{_cat:'2026-02-30'}])).toThrow(/row 0/)
 })
 it('seeds EWMA from first finite value, preserves missing gaps and row order per partition',()=>{
  const rows=[{_cats:['3','A'],_val:30},{_cats:['1','A'],_val:10},{_cats:['2','A'],_val:null},{_cats:['1','B'],_val:100},{_cats:['2','B'],_val:0}]
  expect(resolve(ewma,rows)).toEqual([20,10,null,100,50])
  expect(resolve(ewma,[])).toEqual([])
  const identity={...ewma,transforms:[{window:{...ewma.transforms[0].window,alpha:1},as:'e'}]}
  expect(resolve(identity,rows)).toEqual([30,10,null,100,0])
 })
 it('keeps finite EWMA for very large mixed-sign values without overflowing intermediate differences',()=>{
  expect(resolve(ewma,[{_cats:['1','A'],_val:1e308},{_cats:['2','A'],_val:-1e308}])).toEqual([1e308,0])
 })
 it('validates fields, weekdays, alpha and renderer floors',()=>{
  for(const alpha of [0,-1,1.1,NaN,'0.5'])expect(validateTemplate({...ewma,transforms:[{window:{...ewma.transforms[0].window,alpha},as:'e'}]}).errors.join()).toContain('alpha')
  expect(validateTemplate({...bands,transforms:[{dateBands:{field:'date',weekdays:[7]},as:'b'}]}).errors.join()).toContain('weekdays')
  expect(validateTemplate({...conversion,transforms:[{conversion:{category:'missing',value:'weight'},as:'c'}]}).errors.join()).toContain('unknown field')
  for(const template of [ewma,bands,conversion])expect(requiredRendererVersion({template})).toBe('4.27.0.0')
 })
})
