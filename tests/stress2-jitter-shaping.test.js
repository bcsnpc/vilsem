import {describe,it,expect} from 'vitest'
import {instantiateVisual,validateTemplate} from '@vilsem/core/templates'
import {requiredRendererVersion} from '@vilsem/core/pbir'
const spec=d=>({meta:{id:'collision-jitter'},slots:{group:{kind:'dimension'},value:{kind:'dimension'},quantity:{kind:'measure'}},transforms:[{jitter:{by:'group',field:'value',method:'collision',width:700,height:420,radius:3,...d},as:'j'}],template:{result:'$calc.j'}})
const row=(group,value)=>({_cats:[group,value],_val:1})
const run=(rows,d={})=>instantiateVisual({template:spec(d),rows}).option.result
function assertSeparated(out,width=700) {
 const positions=out.data.map(p=>[(p.value[0]-out.min)/(out.max-out.min)*width,p.value[1]])
 for(let i=0;i<positions.length;i++)for(let j=i+1;j<positions.length;j++)expect(Math.hypot(positions[i][0]-positions[j][0],positions[i][1]-positions[j][1])+1e-6).toBeGreaterThanOrEqual(out.symbolSize)
}
describe('bounded deterministic beeswarm shaping',()=>{
 it('keeps values and source identities exact with separated marks and stable output',()=>{
  const rows=[row('A',1),row('A',1),row('A',1.01),row('A',2),row('B',1),row('B',1)]
  const out=run(rows);assertSeparated(out)
  for(const point of out.data)expect(point.value[0]).toBe(rows[point.rowIndexes[0]]._cats[1])
  expect(new Set(out.data.flatMap(p=>p.rowIndexes)).size).toBe(6)
  expect(run(rows)).toEqual(out);expect(out.groups.map(g=>g.name)).toEqual(['A','B'])
 })
 it('reduces the returned symbol size within a dense band, without randomness or overlap',()=>{
  const out=run(Array.from({length:12},()=>row('A',0)),{height:100,radius:12})
  expect(out.symbolSize).toBeLessThan(24);expect(out.symbolSize).toBeGreaterThanOrEqual(2)
  expect(out.data.every(p=>p.value[1]>=out.symbolSize/2&&p.value[1]<=100-out.symbolSize/2)).toBe(true)
  assertSeparated(out)
 })
 it('handles empty input and refuses excessive or physically impossible layouts',()=>{
  expect(run([row('A',null)]).data).toEqual([])
  expect(()=>run(Array.from({length:2001},()=>row('A',1)))).toThrow(/2000 points/)
  expect(()=>run(Array.from({length:37},(_,i)=>row(String(i),1)))).toThrow(/36 groups/)
  expect(()=>run(Array.from({length:100},()=>row('A',1)),{height:100,radius:1})).toThrow(/too dense/)
 })
 it('validates method/viewport/radius and declares the renderer floor',()=>{
  for(const d of [{method:'custom'},{width:1},{height:Infinity},{radius:0}])expect(validateTemplate(spec(d)).errors.length).toBeGreaterThan(0)
  expect(requiredRendererVersion({template:spec({})})).toBe('4.28.0.0')
 })
})
