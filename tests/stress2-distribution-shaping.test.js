import {describe,it,expect} from 'vitest'
import {instantiateVisual,validateTemplate} from '@vilsem/core/templates'
import {requiredRendererVersion} from '@vilsem/core/pbir'
import {stableStatistic} from '../packages/core/src/templates/distribution-transforms.js'
const slots={group:{kind:'dimension'},numeric:{kind:'dimension'},weight:{kind:'measure'}}
const row=(group,numeric)=>({_cats:[group,numeric],_val:1})
const template=(op,d)=>({meta:{id:'distribution-test'},slots,transforms:[{[op]:d,as:'d'}],template:{result:'$calc.d'}})
const run=(op,d,rows,params={},defs=[])=>instantiateVisual({template:{...template(op,d),params:defs},rows,params}).option.result
describe('bounded distribution shaping',()=>{
 it('bins every finite observation exactly once and retains original indexes',()=>{
  const out=run('histogram',{field:'numeric',bins:2},[row('A',0),row('A',1),row('A',2),row('B',3),row('B',4),row('B',null)])
  expect(out.count).toBe(5);expect(out.data.map(d=>d.value)).toEqual([2,3]);expect(out.data.flatMap(d=>d.rowIndexes)).toEqual([0,1,2,3,4])
  expect(out.data.map(d=>[d.lower,d.upper])).toEqual([[0,2],[2,4]])
  expect(run('histogram',{field:'numeric',bins:'auto'},[])).toEqual({categories:[],data:[],count:0})
 })
 it('uses the declared width parameter, handles constants and refuses excessive bin expansion',()=>{
  const out=run('histogram',{field:'numeric',widthParam:'width'},[row('A',0),row('A',5),row('B',10)],{width:5},[{name:'width',type:'number',default:2}])
  expect(out.data.map(d=>d.value)).toEqual([1,2])
  expect(run('histogram',{field:'numeric',bins:'auto'},[row('A',7),row('B',7)]).data[0].value).toBe(2)
  expect(()=>run('histogram',{field:'numeric',width:0.001},[row('A',0),row('A',1)])).toThrow(/200 bins/)
  expect(validateTemplate(template('histogram',{field:'numeric',widthParam:'missing'})).errors.join()).toContain('declared numeric parameter')
 })
 it('keeps automatic huge opposite-sign bins finite and conserves counts',()=>{
  const out=run('histogram',{field:'numeric',bins:4},[row('A',-1e308),row('B',0),row('C',1e308)])
  expect(out.data.reduce((s,d)=>s+d.value,0)).toBe(3)
  expect(out.data.every(d=>Number.isFinite(d.lower)&&Number.isFinite(d.upper))).toBe(true)
 })
 it('uses R7 quartiles and observed Tukey whiskers, with source-identified outliers',()=>{
  const out=run('boxplot',{by:'group',field:'numeric',whisker:1.5},[1,2,3,4,100].map(v=>row('A',v)).concat([row('B',0)]))
  expect(out.categories).toEqual(['A','B']);expect(out.boxes[0].value).toEqual([1,2,3,4,4])
  expect(out.outliers).toEqual([{name:'A',value:[0,100],rowIndexes:[4]}])
  expect(out.boxes[1].value).toEqual([0,0,0,0,0]);expect(out.boxes[0].rowIndexes).toEqual([0,1,2,3,4])
 })
 it('uses right-continuous cumulative fractions at ties without cumulative identity expansion',()=>{
  const out=run('ecdf',{field:'numeric'},[row('A',3),row('A',1),row('B',1),row('B',null)])
  expect(out.data.map(d=>d.value)).toEqual([[1,0],[1,2/3],[3,1]])
  expect(out.data.map(d=>d.rowIndexes)).toEqual([[],[1,2],[0]])
 })
 it('exposes one statistic record per group while preserving aligned row vectors',()=>{
  const out=run('stat',{field:'numeric',op:'mean',partitionBy:'group',records:true},[row('A',2),row('B',4),row('A',6),row('B',null)])
  expect(out.values).toEqual([4,4,4,4]);expect(out.data).toEqual([{name:'A',value:4,rowIndexes:[0,2]},{name:'B',value:4,rowIndexes:[1]}])
  expect(requiredRendererVersion({canvasTheme:'dark',template:template('stat',{field:'numeric',op:'mean',records:true})})).toBe('4.28.0.0')
 })
 it('computes huge finite means, quantiles and deviations without overflowing intermediate sums or differences',()=>{
  expect(stableStatistic([1e308,1e308],'mean')).toBe(1e308)
  expect(stableStatistic([-1e308,1e308],'median')).toBe(0)
  expect(stableStatistic([-1e308,1e308],'stddev')).toBe(1e308)
  expect(stableStatistic([0],'stddev',undefined,true)).toBe(null)
  expect(stableStatistic([-1e308,1,1e308],'sum')).toBeCloseTo(1)
  expect(()=>stableStatistic([1e308,1e308],'sum')).toThrow(/finite numeric range/)
 })
})
