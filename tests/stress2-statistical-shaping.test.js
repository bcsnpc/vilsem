import {describe,it,expect} from 'vitest'
import {instantiateVisual,validateTemplate} from '@vilsem/core/templates'
import {requiredRendererVersion} from '@vilsem/core/pbir'
import {normalQuantile} from '../packages/core/src/templates/statistical-transforms.js'
const slots={group:{kind:'dimension'},x:{kind:'dimension'},y:{kind:'dimension'},date:{kind:'time'},value:{kind:'measure'},other:{kind:'measure'},first:{kind:'measure'}}
const row=(group,x,y,value=1,other=2,date='2026-01-01',first=20454)=>({_cats:[group,x,y,date],_vals:[value,other,first],_val:value,_val2:other,_val3:first})
const template=(op,d)=>({meta:{id:'statistics'},slots,transforms:[{[op]:d,as:'out'}],template:{result:'$calc.out'}})
const run=(op,d,rows)=>instantiateVisual({template:template(op,d),rows}).option.result
describe('bounded statistical operations for stress round 2',()=>{
 it('computes approximate normal QQ positions, preserves observations and original identities',()=>{
  expect(normalQuantile(.975)).toBeCloseTo(1.9599639845,5);expect(normalQuantile(.025)).toBeCloseTo(-1.9599639845,5);expect(normalQuantile(.5)).toBe(0)
  expect(()=>normalQuantile(0)).toThrow(/strictly/)
  const q=run('qq',{field:'x'},[row('A',3,0),row('A',null,0),row('A',1,0),row('A',2,0)])
  expect(q.data.map(d=>d.value[1])).toEqual([1,2,3]);expect(q.data.map(d=>d.rowIndexes)).toEqual([[2],[3],[0]]);expect(q.data[1].value[0]).toBe(0)
 })
 it('conserves all 2-D hexbin observations without losing negative positions or duplicate identities',()=>{
  const source=[row('A',-10,2),row('B',-10,2),row('C',10,8),row('D',null,3)]
  const out=run('hexbin',{x:'x',y:'y',bins:12},source)
  expect(out.data.reduce((s,d)=>s+d.value[2],0)).toBe(3)
  expect(out.data.flatMap(d=>d.rowIndexes).sort()).toEqual([0,1,2]);expect(out.data.every(d=>d.value.every(Number.isFinite))).toBe(true)
  expect(run('hexbin',{x:'x',y:'y'},[])).toEqual({data:[],max:0})
 })
 it('computes a finite nonnegative density grid with contributors and refuses excessive expansion',()=>{
  const source=Array.from({length:12},(_,i)=>row('A',i,i%3))
  const out=run('density2d',{x:'x',y:'y',bins:8},source)
  expect(out.data).toHaveLength(64);expect(out.max).toBeGreaterThan(0);expect(out.data.every(d=>d.value.every(Number.isFinite)&&d.value[2]>=0)).toBe(true)
  expect(out.cells).toHaveLength(64);expect(out.columns).toHaveLength(8);expect(out.rows).toHaveLength(8)
  expect(out.cells[0].value).toEqual([0,0,out.data[0].value[2]]);expect(out.cells.at(-1).value.slice(0,2)).toEqual([7,7])
  expect(run('density2d',{x:'x',y:'y'},[])).toEqual({data:[],max:0,cells:[],columns:[],rows:[]})
  expect(out.data.flatMap(d=>d.rowIndexes).every(i=>i>=0&&i<12)).toBe(true)
  expect(()=>run('density2d',{x:'x',y:'y',bins:64},Array.from({length:1000},(_,i)=>row('A',i,i)))).toThrow(/kernel evaluations/)
 })
 it('uses pairwise-complete Pearson correlations and null for a constant vector',()=>{
  const t=template('correlation',{fields:['value','other','y'],names:['Up','Down','Constant']})
  const out=instantiateVisual({template:t,rows:[row('A',0,5,1,3),row('B',0,5,2,2),row('C',0,5,3,1),row('D',0,5,null,4)]}).option.result
  expect(out.data.find(d=>d.value[0]===0&&d.value[1]===1).value[2]).toBeCloseTo(-1,12)
  expect(out.data.find(d=>d.value[0]===2&&d.value[1]===2).value[2]).toBeNull()
  expect(out.data[1].count).toBe(3)
 })
 it('pivots duplicate additive cells, distinguishes missing from zero, and preserves identities',()=>{
  const out=run('pivot',{row:'group',column:'x',value:'value'},[row('A','X',0,2),row('A','X',0,3),row('B','Y',0,0)])
  expect(out.rows).toEqual(['A','B']);expect(out.columns).toEqual(['X','Y'])
  expect(out.data.map(d=>d.value)).toEqual([[0,0,5],[1,0,null],[0,1,null],[1,1,0]])
  expect(out.data[0].rowIndexes).toEqual([0,1])
 })
 it('normalizes within each group, includes disclosed subtotals and refuses negative shares',()=>{
  const out=run('groupShare',{by:'group',category:'x',value:'value',subtotals:true},[row('A','X',0,2),row('A','Y',0,6),row('B','X',0,0)])
  expect(out.data.map(d=>d.value)).toEqual([.25,.75,1,null,null]);expect(out.data[2].subtotal).toBe(8)
  expect(()=>run('groupShare',{by:'group',category:'x',value:'value'},[row('A','X',0,-1)])).toThrow(/non-negative/)
 })
 it('rebases each ordered group independently and leaves zero-only groups blank',()=>{
  const out=run('rebase',{field:'value',partitionBy:'group',orderBy:'date'},[row('A',0,0,20,0,'2026-02-01'),row('A',0,0,10,0,'2026-01-01'),row('B',0,0,5,0,'2026-01-01'),row('B',0,0,10,0,'2026-02-01'),row('C',0,0,0)])
  expect(out.values).toEqual([200,100,100,200,null])
 })
 it('maps positive/negative/zero/null conditional styles and neutral empty labels',()=>{
  const out=run('conditional',{value:'value',condition:'other',label:'other',labelFormat:'percent'},[row('A',0,0,5,.1),row('B',0,0,6,-.2),row('C',0,0,7,0),row('D',0,0,8,null)])
  expect(out.data.map(d=>d.label)).toEqual(['10%','-20%','0%','']);expect(out.data.map(d=>d.itemStyle.color)).toEqual(['#2dd4bf','#f87171','#94a3b8','#94a3b8'])
 })
 it('counts the minimal ranked categories meeting Pareto threshold and handles zero totals',()=>{
  const d={category:'group',value:'value',threshold:.8};const out=run('pareto',d,[row('B',0,0,2),row('A',0,0,6),row('C',0,0,2)])
  expect(out.categories).toEqual(['A','B','C']);expect(out.cumulative).toEqual([.6,.8,1]);expect(out.thresholdCount).toBe(2)
  expect(run('pareto',{...d,threshold:0},[row('A',0,0,1)]).thresholdCount).toBe(0)
  expect(run('pareto',d,[row('A',0,0,0)]).thresholdCount).toBe(0)
 })
 it('deduplicates cohort entities per period, and uses declared full-history first-purchase day',()=>{
  const day=Date.UTC(2026,0,1)/86400000
  const out=run('cohort',{date:'date',entity:'group',value:'value',firstDay:'first'},[row('A',0,0,1,0,'2026-01-01',day),row('A',0,0,1,0,'2026-01-01',day),row('B',0,0,1,0,'2026-01-01',day),row('A',0,0,1,0,'2026-02-01',day)])
  expect(out.periods).toEqual([0,1]);expect(out.data.map(d=>d.value[2])).toEqual([1,.5]);expect(out.data[0].cohortSize).toBe(2)
 })
 it('validates bounds, source fields, and renderer compatibility before model access',()=>{
  expect(validateTemplate(template('correlation',{fields:['value','missing']})).errors.join()).toMatch(/unknown field/)
  expect(validateTemplate(template('density2d',{x:'x',y:'y',bins:1000})).errors.join()).toMatch(/4..64/)
  expect(validateTemplate(template('conditional',{value:'value',condition:'other',positive:'url(x)'})).errors.join()).toMatch(/hex colour/)
  expect(requiredRendererVersion({canvasTheme:'dark',template:template('qq',{field:'x'})})).toBe('4.29.0.0')
 })
 it('uses top countParam without changing literal count or Other behavior',()=>{
  const t=template('top',{category:'group',value:'value',countParam:'n'});t.params=[{name:'n',type:'number',default:1,min:1,max:5}]
  const out=instantiateVisual({template:t,params:{n:2},rows:[row('A',0,0,5),row('B',0,0,3),row('C',0,0,1)]}).option.result
  expect(out.values).toEqual([5,3,1]);expect(out.categories).toEqual(['A','B','Other'])
  expect(validateTemplate({...t,params:[]}).errors.join()).toMatch(/declared numeric parameter/)
  expect(()=>instantiateVisual({template:t,params:{n:1.5},rows:[row('A',0,0)]})).toThrow(/integer/)
 })
 it('refuses unavailable maps, GL, word cloud and imperative series before blank charts can be committed',()=>{
  for(const type of ['wordCloud','bar3D','surface','venn','custom']) {
   const t={meta:{id:'capability'},slots,template:{series:[{type,data:[]}]}}
   expect(validateTemplate(t).errors.join()).toMatch(type==='custom'?/bounded expression AST/:/not shipped/)
  }
  expect(validateTemplate({meta:{id:'geo'},slots,template:{geo:{map:'world'},series:[]}}).errors.join()).toMatch(/ships none/)
  const t={meta:{id:'dynamic'},slots,params:[{name:'seriesType',type:'string',default:'wordCloud'}],template:{series:[{type:'$param.seriesType',data:[]}]}}
  expect(()=>instantiateVisual({template:t})).toThrow(/not shipped/)
 })
 it('maps real category totals into explicit unique fixed tiles and refuses unmapped/duplicate cells',()=>{
  const d={category:'group',value:'value',positions:[{name:'A',x:0,y:1},{name:'B',x:1,y:0}]}
  const out=run('tiles',d,[row('A',0,0,2),row('A',0,0,3),row('B',0,0,1)])
  expect(out.data.map(d=>d.value)).toEqual([[0,1,5],[1,0,1]]);expect(out.data[0].rowIndexes).toEqual([0,1])
  expect(()=>run('tiles',d,[row('C',0,0)])).toThrow(/no position/)
  expect(validateTemplate(template('tiles',{...d,positions:[...d.positions,{name:'C',x:0,y:1}]})).errors.join()).toMatch(/unique/)
 })
 it('exposes opt-in partition label bounds matching an explicit fixed plot width',()=>{
  const t=template('hierarchy',{levels:['group','x'],value:'value',layout:'partition',size:700})
  t.template={nodes:'$calc.out.nodes',labels:{repeat:'$calc.out.nodes',template:{width:'$item.labelWidth',show:'$item.labelVisible'}}}
  const option=instantiateVisual({template:t,rows:[row('A','Large',0,999),row('A','Tiny',0,1)]}).option
  expect(option.nodes[0].pixelSpan).toBe(700);expect(option.labels[0]).toEqual({width:692,show:true})
  const small=option.nodes.find(n=>n.name==='Tiny');expect(small.labelWidth).toBe(0);expect(small.labelVisible).toBe(false)
  expect(requiredRendererVersion({canvasTheme:'dark',template:t})).toBe('4.30.0.0')
 })
})
