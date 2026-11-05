import {describe,it,expect} from 'vitest'
import {instantiateVisual,validateTemplate} from '@vilsem/core/templates'
import {requiredRendererVersion} from '@vilsem/core/pbir'
const slots={group:{kind:'dimension'},value:{kind:'dimension'},count:{kind:'measure'}}
const spec=d=>({meta:{id:'density-shaping'},slots,transforms:[{density:{by:'group',field:'value',samples:65,...d},as:'d'}],template:{result:'$calc.d'}})
const resolve=(d,rows)=>instantiateVisual({template:spec(d),rows}).option.result
const row=(group,value)=>({_cats:[group,value],_val:1})
describe('bounded deterministic density series',()=>{
 it('matches a single-point Gaussian with explicit bandwidth and exactly closed violin ends',()=>{
  const out=resolve({layout:'violin',bandwidth:1},[row('A',0)]),data=out.panels[0].data
  expect(out.min).toBe(-4);expect(out.max).toBe(4);expect(data).toHaveLength(130)
  expect(data[32].density).toBeCloseTo(1/(Math.sqrt(2*Math.PI)*0.9999366575163338),12)
  expect(data[0].value).toEqual(data.at(-1).value);expect(data[0].density).toBe(0)
  expect(data[32].rowIndexes).toEqual([0]);expect(data[0].rowIndexes).toEqual([])
  for(let i=0;i<65;i++)expect(data[i].value[0]+data[129-i].value[0]).toBeCloseTo(0)
 })
 it('keeps stable group order, positive automatic bandwidth and ridges relative to each group baseline',()=>{
  const rows=[row('B',5),row('A',0),row('A',1),row('B',5)]
  const out=resolve({layout:'ridgeline'},rows)
  expect(out.categories).toEqual(['B','A']);expect(out.panels.every(p=>p.bandwidth>0)).toBe(true)
  expect(out.panels[0].data[0].value[1]).toBe(0);expect(out.panels[1].data[0].value[1]).toBe(1)
  expect(out.panels[1].data.every(p=>p.value[1]>=1&&p.value[1]<=1.8)).toBe(true)
  expect(resolve({layout:'ridgeline'},rows)).toEqual(out)
 })
 it('handles empty/missing input and refuses resource/range overflow before unbounded expansion',()=>{
  expect(resolve({layout:'violin'},[row('A',null)])).toEqual({panels:[],categories:[],min:null,max:null,groupMax:null})
  expect(()=>resolve({layout:'violin'},Array.from({length:37},(_,i)=>row(String(i),i)))).toThrow(/36 groups/)
  expect(()=>resolve({layout:'violin'},Array.from({length:1000},()=>row('A',0)))).toThrow(/20000 contributor/)
  expect(()=>resolve({layout:'ridgeline',bandwidth:1e308},[row('A',1e308)])).toThrow(/rescale/)
 })
 it('validates samples, fields, bandwidth, layout and compatibility floor',()=>{
  for(const d of [{samples:1},{samples:257},{bandwidth:0},{bandwidth:Infinity},{layout:'custom'}])expect(validateTemplate(spec({layout:'violin',...d})).errors.length).toBeGreaterThan(0)
  expect(requiredRendererVersion({canvasTheme:'dark',template:spec({layout:'violin'})})).toBe('4.28.0.0')
 })
})
