import {describe,it,expect} from 'vitest'
import {instantiateVisual,validateTemplate} from '@vilsem/core/templates'
import {requiredRendererVersion} from '@vilsem/core/pbir'
import {intervalDate} from '../packages/core/src/templates/date-utils.js'
const stream={meta:{id:'stream'},slots:{date:{kind:'time'},country:{kind:'dimension'},revenue:{kind:'measure'}},transforms:[{stream:{by:'country',category:'date',value:'revenue',offset:'wiggle'},as:'s'}],template:{shaped:'$calc.s'}}
const resolve=(template,rows)=>instantiateVisual({template,rows}).option.shaped
const row=(date,country,revenue)=>({_cats:[date,country],_val:revenue})
describe('bounded trusted streamgraph shaping',()=>{
 it('produces a weighted-wiggle baseline, conserving values in inside-out order',()=>{
  const rows=[row('d1','A',1),row('d1','B',2),row('d2','A',3),row('d2','B',1),row('d3','A',1),row('d3','B',2)]
  const out=resolve(stream,rows)
  expect(out.panels.map(p=>p.name)).toEqual(['B','A'])
  expect(out.baseline[0].value).toBe(0)
  expect(out.baseline[1].value).toBeCloseTo(1/8)
  expect(out.baseline[2].value).toBeCloseTo(-5/24)
  expect(out.panels.map(p=>p.data.map(d=>d.value))).toEqual([[2,1,2],[1,3,1]])
  expect(out.baseline.map(d=>d.rowIndexes)).toEqual([[0,1],[2,3],[4,5]])
  expect(resolve(stream,rows)).toEqual(out)
 })
 it('aggregates duplicate cells, fills gaps without invented identities and supports silhouette',()=>{
  const rows=[row('d1','A',1),row('d1','A',2),row('d1','B',3),row('d2','B',4)]
  const out=resolve(stream,rows),a=out.panels.find(p=>p.name==='A')
  expect(a.data.map(d=>[d.value,d.rowIndexes])).toEqual([[3,[0,1]],[0,[]]])
  const centered={...stream,transforms:[{stream:{...stream.transforms[0].stream,offset:'silhouette'},as:'s'}]}
  expect(resolve(centered,rows).baseline.map(d=>d.value)).toEqual([-3,-2])
  expect(resolve(stream,[])).toEqual({categories:[],panels:[],baseline:[]})
 })
 it('handles zero/very large finite weights and refuses negative, overflowing or excessive expansion',()=>{
  expect(resolve(stream,[row('d1','A',0)]).baseline[0].value).toBe(0)
  const huge=resolve(stream,[row('d1','A',1e300),row('d1','B',2e300),row('d2','A',3e300),row('d2','B',1e300)])
  expect(huge.baseline.every(d=>Number.isFinite(d.value))).toBe(true)
  expect(()=>resolve(stream,[row('d1','A',-1)])).toThrow(/non-negative/)
  expect(()=>resolve(stream,[row('d1','A',1e308),row('d1','A',1e308)])).toThrow(/aggregate exceeds finite/)
  expect(()=>resolve(stream,[row('d1','A',1e308),row('d1','B',1e308)])).toThrow(/column total exceeds finite/)
  expect(()=>resolve(stream,Array.from({length:37},(_,i)=>row('d1',`g${i}`,1)))).toThrow(/36 layers/)
  expect(()=>resolve(stream,Array.from({length:1000},(_,i)=>row(`d${i}`,`g${i%36}`,1)))).toThrow(/20000 aligned cells/)
  expect(requiredRendererVersion({canvasTheme:'dark',template:stream})).toBe('4.25.0.0')
 })
})
const intervals={meta:{id:'intervals'},slots:{owner:{kind:'dimension'},task:{kind:'dimension'},start:{kind:'time'},end:{kind:'time'},amount:{kind:'measure'}},transforms:[{intervals:{group:'owner',category:'task',start:'start',end:'end',limit:3},as:'s'}],template:{shaped:'$calc.s'}}
const span=(owner,task,start='2020-01-01',end='2020-01-03')=>({_cats:[owner,task,start,end],_val:1})
describe('bounded grouped interval shaping',()=>{
 it('selects a balanced overview and retains original source identities and actual date durations',()=>{
  const rows=[...Array.from({length:5},(_,i)=>span('US',`task${i}`)),span('Canada','a'),span('France','b')]
  const out=resolve(intervals,rows)
  expect(out.duration.map(d=>d.rowIndexes)).toEqual([[5],[6],[0]])
  expect(out.duration.map(d=>d.value)).toEqual([172800000,172800000,172800000])
  expect(out.categories.map(s=>s.split(' / ')[0])).toEqual(['Canada','France','US'])
  expect(out).toMatchObject({total:7,shown:3,omitted:4,skipped:0,summary:'3 of 7 returned intervals shown'})
  expect(out.min).toBe(Date.parse('2020-01-01T00:00:00Z'))
  expect(out.max).toBe(Date.parse('2020-01-03T00:00:00Z'))
  expect(out.duration[0].label).toContain('(2 days)')
  expect(requiredRendererVersion({canvasTheme:'dark',template:intervals})).toBe('4.26.0.0')
 })
 it('preserves zero-duration milestones and handles missing dates and empty input explicitly',()=>{
  const out=resolve(intervals,[span('US','instant','1970-01-01','1970-01-01'),span('US','missing',null,null)])
  expect(out.duration[0].value).toBe(0)
  expect(out.milestones[0]).toMatchObject({value:[0,0],rowIndexes:[0]})
  expect(out).toMatchObject({min:-43200000,max:43200000,total:1,skipped:1})
  expect(resolve(intervals,[])).toMatchObject({categories:[],duration:[],milestones:[],min:null,max:null,shown:0})
  expect(intervalDate(0)).toBe(0)
 })
 it('uses zoned instants, refuses reversed/invalid dates and gives duplicate labels unique identities',()=>{
  const rows=[span('US','same','2020-01-01T08:00:00-06:00','2020-01-01T09:00:00-06:00'),span('US','same','2020-01-01T08:00:00-06:00','2020-01-01T09:00:00-06:00')]
  const out=resolve(intervals,rows)
  expect(out.base[0].value).toBe(Date.parse('2020-01-01T14:00:00Z'))
  expect(out.duration[0].value).toBe(3600000)
  expect(new Set(out.categories).size).toBe(2)
  expect(()=>resolve(intervals,[span('US','bad','2020-02-30','2020-03-02')])).toThrow(/ISO dates/)
  expect(()=>resolve(intervals,[span('US','bad','2020-01-03','2020-01-01')])).toThrow(/end precedes start/)
  expect(intervalDate('2020-01-01T08:00:00')).toBe(Date.UTC(2020,0,1,8))
  expect(intervalDate('2020-01-01T08:00:00.1234567')).toBe(Date.UTC(2020,0,1,8,0,0,123))
  for(const invalid of ['2020-01-01T24:00:00','2020-01-01T08:60:00','2020-01-01T08:00:60','2020-01-01T08:00:00+14:01'])expect(intervalDate(invalid)).toBe(null)
 })
 it('validates fields, offsets and output bounds before execution',()=>{
  expect(validateTemplate({...stream,transforms:[{stream:{by:'missing',category:'date',value:'revenue',offset:'code'},as:'s'}]}).errors.join()).toMatch(/unknown field/)
  expect(validateTemplate({...intervals,transforms:[{intervals:{...intervals.transforms[0].intervals,limit:1001},as:'s'}]}).errors.join()).toMatch(/1..1000/)
 })
})
