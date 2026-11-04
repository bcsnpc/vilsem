import {describe,it,expect} from 'vitest'
import {instantiateVisual,validateTemplate} from '@vilsem/core/templates'
import {requiredRendererVersion} from '@vilsem/core/pbir'
const base={meta:{id:'flows'},slots:{a:{kind:'dimension'},b:{kind:'dimension'},c:{kind:'dimension'},v:{kind:'measure'}},transforms:[{flows:{levels:['a','b','c'],value:'v',order:'value'},as:'f'}],template:{nodes:'$calc.f.nodes',links:'$calc.f.links'}}
const run=(rows,change={})=>instantiateVisual({template:{...base,...change},rows}).option
describe('bounded multi-level flow shaping',()=>{
 it('conserves intermediate-node flow, scopes equal labels by depth, and sorts by weight',()=>{
  const out=run([{_cats:['x','x','z'],_val:2},{_cats:['y','x','w'],_val:5},{_cats:['x','q','z'],_val:1}])
  expect(out.nodes.filter(n=>n.label==='x')).toHaveLength(2)
  expect(out.nodes.filter(n=>n.depth===0).map(n=>n.label)).toEqual(['y','x'])
  const middle=out.nodes.find(n=>n.label==='x'&&n.depth===1)
  expect(middle.value).toBe(7)
  expect(middle.rowIndexes).toEqual([0,1])
  expect(out.links.filter(l=>l.source===middle.id).reduce((s,l)=>s+l.value,0)).toBe(7)
  expect(out.links.filter(l=>l.target===middle.id).reduce((s,l)=>s+l.value,0)).toBe(7)
  expect(out.links[0].label).toBe('x \u2192 x')
 })
 it('preserves identities and produces deterministic fixed graph coordinates and bounded sizes',()=>{
  const rows=[{_cats:['a','x','c'],_val:3},{_cats:['b','x','d'],_val:1}]
  const template={...base,transforms:[{flows:{levels:['a','b'],value:'v',layout:'bipartite'},as:'f'}],template:base.template}
  const out=run(rows,template)
  expect(run(rows,template)).toEqual(out)
  expect(out.nodes.filter(n=>n.depth===0).every(n=>n.x===0&&n.y>0&&n.y<400)).toBe(true)
  expect(out.nodes.find(n=>n.depth===1)).toMatchObject({x:600,value:4,rowIndexes:[0,1],symbolSize:42})
  expect(out.links.map(l=>l.rowIndexes)).toEqual([[0],[1]])
  const line=run(rows,{transforms:[{flows:{levels:['a','b'],value:'v',layout:'line'},as:'f'}]})
  expect(line.nodes.map(n=>[n.x,n.y])).toEqual([[0,0],[100,0],[200,0]])
 })
 it('handles empty/null/zero and refuses invalid/overflowing or unbounded weights',()=>{
  expect(run([])).toEqual({nodes:[],links:[]})
  expect(run([{_cats:['a','b','c'],_val:null},{_cats:['x','y','z'],_val:0}])).toEqual({nodes:[],links:[]})
  expect(()=>run([{_cats:['a','b','c'],_val:-1}])).toThrow(/non-negative/)
  expect(()=>run([{_cats:['a','b','c'],_val:1e308},{_cats:['a','b','c'],_val:1e308}])).toThrow(/finite numeric/)
  expect(()=>run(Array.from({length:4100},()=>({_cats:['a','b','c'],_val:1})))).toThrow(/20000 lineage/)
  const bad={...base,transforms:[{flows:{levels:['a','missing'],value:'v',layout:'code'},as:'f'}]}
  expect(validateTemplate(bad).errors.join()).toMatch(/unknown field/)
  expect(validateTemplate(bad).errors.join()).toMatch(/line\|bipartite/)
  expect(requiredRendererVersion({template:base})).toBe('4.22.0.0')
  expect(requiredRendererVersion({template:{template:{data:'$item.rowIndexes'}}})).toBe(null)
 })
 it('exposes facet numeric radar vectors while preserving the whole panel source identity',()=>{
  const t={...base,transforms:[{facet:{by:'a',category:'b',value:'v'},as:'p'}],template:{series:{repeat:'$calc.p.panels',template:{name:'$item.name',data:[{value:'$item.values',rowIndexes:'$item.rowIndexes'}]}}}}
  expect(validateTemplate(t).errors).toEqual([])
  const out=run([{_cats:['A','x'],_val:2},{_cats:['A','y'],_val:3},{_cats:['B','x'],_val:4}],t)
  expect(out.series[0].data[0]).toEqual({value:[2,3],rowIndexes:[0,1]})
  expect(out.series[1].data[0]).toEqual({value:[4,null],rowIndexes:[2]})
 })
 it('copies scalar repeat items for native radar indicators but refuses unscoped $item',()=>{
  const t={...base,transforms:[],template:{radar:{indicator:{repeat:'$slot.a.categories',template:{name:'$item'}}}}}
  expect(validateTemplate(t).errors).toEqual([])
  expect(run([{_cats:['United States','x'],_val:1},{_cats:['Canada','y'],_val:2}],t).radar.indicator).toEqual([{name:'United States'},{name:'Canada'}])
  expect(validateTemplate({...t,template:{name:'$item'}}).errors.join()).toMatch(/repeat scope/)
 })
 it('derives shared radar indicator domains in the same order as every facet vector',()=>{
  const t={...base,transforms:[{facet:{by:'a',category:'b',value:'v'},as:'p'}],template:{radar:{indicator:'$calc.p.indicators'},series:{repeat:'$calc.p.panels',template:{data:'$item.values'}}}}
  const out=run([{_cats:['US','Bikes'],_val:3},{_cats:['US','Clothing'],_val:2},{_cats:['Canada','Bikes'],_val:1},{_cats:['Canada','Clothing'],_val:4}],t)
  expect(out.radar.indicator).toEqual([{name:'Bikes',min:0,max:3},{name:'Clothing',min:0,max:4}])
  expect(out.series.map(s=>s.data)).toEqual([[3,2],[1,4]])
  expect(requiredRendererVersion({template:t})).toBe('4.24.0.0')
  expect(run([],t).radar.indicator).toEqual([])
  expect(run([{_cats:['US','Bikes'],_val:0}],t).radar.indicator).toEqual([{name:'Bikes',min:0,max:1}])
 })
 it('bounds the aligned facet cross-product before allocating empty cells',()=>{
  const t={...base,transforms:[{facet:{by:'a',category:'b',value:'v'},as:'p'}],template:{panels:'$calc.p.panels'}}
  expect(()=>run(Array.from({length:1000},(_,i)=>({_cats:[String(i%36),String(i)],_val:1})),t)).toThrow(/20000 aligned cells/)
  expect(()=>run([{_cats:['US','Bikes'],_val:1e308},{_cats:['US','Bikes'],_val:1e308}],t)).toThrow(/finite numeric range/)
 })
})
