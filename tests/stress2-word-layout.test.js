import {describe,it,expect} from 'vitest'
import {instantiateVisual,validateTemplate} from '@vilsem/core/templates'
import {requiredRendererVersion} from '@vilsem/core/pbir'
const slots={text:{kind:'dimension'},weight:{kind:'measure'}}
const row=(text,weight)=>({_cat:text,_val:weight})
const template=words=>({meta:{id:'word-packing'},slots,transforms:[{words:{text:'text',weight:'weight',...words},as:'words'}],template:{result:'$calc.words'}})
const run=(rows,words={})=>instantiateVisual({rows,template:template(words)}).option.result
describe('bounded word-cloud layout without custom series',()=>{
 it('aggregates normalized terms once per contributing row and retains weights/source identities',()=>{
  const out=run([row('Mountain Mountain Bike',10),row('Road Bike',5),row('CAFÉ Café',2)])
  expect(out.data.find(d=>d.name==='bike').value[2]).toBe(15)
  expect(out.data.find(d=>d.name==='bike').rowIndexes).toEqual([0,1])
  expect(out.data.find(d=>d.name==='mountain').value[2]).toBe(10)
  expect(out.data.find(d=>d.name==='café').value[2]).toBe(2)
  expect(out.count).toBe(4)
 })
 it('packs deterministic conservative rectangles inside the declared plot with no overlaps',()=>{
  const rows=Array.from({length:24},(_,i)=>row(`Term${i} Bike`,i+1))
  const a=run(rows),b=run(rows);expect(a).toEqual(b)
  expect(a.count).toBe(24);expect(a.omittedCount).toBe(1)
  for(const [i,d] of a.data.entries()) {
   expect(d.value[0]-d.bounds.width/2).toBeGreaterThanOrEqual(0);expect(d.value[0]+d.bounds.width/2).toBeLessThanOrEqual(a.width)
   expect(d.value[1]-d.bounds.height/2).toBeGreaterThanOrEqual(0);expect(d.value[1]+d.bounds.height/2).toBeLessThanOrEqual(a.height)
   for(const old of a.data.slice(0,i))expect(Math.abs(d.value[0]-old.value[0])>=(d.bounds.width+old.bounds.width)/2||Math.abs(d.value[1]-old.value[1])>=(d.bounds.height+old.bounds.height)/2).toBe(true)
  }
 })
 it('handles blank/zero/Unicode and refuses negative/overflowing or impossible layouts',()=>{
  expect(run([row('',1),row('ignored',0),row('missing',null)]).data).toEqual([])
  expect(run([row('東京 東京',2)]).data[0].name).toBe('東京')
  expect(()=>run([row('word',-1)])).toThrow(/non-negative/)
  expect(()=>run([row('word',1e308),row('word',1e308)])).toThrow(/finite numeric/)
  expect(()=>run([row('a'.repeat(40),1)],{width:300,maxFont:80,minFont:40})).toThrow(/cannot fit/)
 })
 it('checks fixed dimensions and requires matching native renderer feature support',()=>{
  expect(validateTemplate(template({limit:10000})).errors.join()).toMatch(/1..100/)
  expect(validateTemplate(template({minFont:30,maxFont:10})).errors.join()).toMatch(/minFont/)
  expect(requiredRendererVersion({template:template({})})).toBe('4.31.0.0')
 })
})
