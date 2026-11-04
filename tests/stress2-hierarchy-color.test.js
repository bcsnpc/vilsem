import {describe,it,expect} from 'vitest'
import {instantiateVisual,validateTemplate} from '@vilsem/core/templates'
const template={meta:{id:'hierarchy-color'},slots:{parent:{kind:'dimension'},child:{kind:'dimension'},size:{kind:'measure'},profit:{kind:'measure'}},transforms:[{hierarchy:{levels:['parent','child'],value:'size',color:'profit'},as:'tree'}],template:{series:[{type:'treemap',data:'$calc.tree.children'}]}}
describe('hierarchy secondary colour measure',()=>{
 it('aggregates independent additive size/color values and retains source row identities',()=>{
  const rows=[{_cats:['A','x'],_vals:[10,-2]},{_cats:['A','x'],_vals:[20,4]},{_cats:['A','y'],_vals:[5,null]}]
  const tree=instantiateVisual({template,rows}).option.series[0].data
  expect(tree[0].value).toEqual([35,2])
  expect(tree[0].children[0].value).toEqual([30,2])
  expect(tree[0].children[0].rowIndexes).toEqual([0,1])
  expect(tree[0].children[1].value).toEqual([5,0])
 })
 it('rejects an unknown colour field and non-finite aggregate',()=>{
  const invalid={...template,transforms:[{hierarchy:{levels:['parent','child'],value:'size',color:'missing'},as:'tree'}]}
  expect(validateTemplate(invalid).errors.join()).toMatch(/unknown field/)
  expect(()=>instantiateVisual({template,rows:[{_cats:['A','x'],_vals:[1e308,1]},{_cats:['A','x'],_vals:[1e308,1]}]})).toThrow(/finite numeric range/)
 })
 it('partitions additive leaf weights without double counting parents',()=>{
  const t={...template,transforms:[{hierarchy:{levels:['parent','child'],value:'size',layout:'partition'},as:'tree'}],template:{nodes:'$calc.tree.nodes'}}
  const rows=[{_cats:['A','x'],_val:3},{_cats:['A','y'],_val:1},{_cats:['B','z'],_val:4}]
  const nodes=instantiateVisual({template:t,rows}).option.nodes
  expect(nodes.find(n=>n.name==='A').span).toBe(0.5)
  expect(nodes.find(n=>n.name==='x').span).toBe(0.375)
  expect(nodes.find(n=>n.name==='z').offset).toBe(0.5)
  expect(nodes.find(n=>n.name==='A').rowIndexes).toEqual([0,1])
  expect(nodes.find(n=>n.name==='A').data.map(d=>d.value)).toEqual([0.5,null])
  expect(nodes.find(n=>n.name==='x').data.map(d=>d.value)).toEqual([null,0.375])
 })
 it('packs nested circles deterministically, containing children without sibling overlap',()=>{
  const t={...template,transforms:[{hierarchy:{levels:['parent','child'],value:'size',layout:'pack',size:400},as:'tree'}],template:{nodes:'$calc.tree.nodes'}}
  const rows=[{_cats:['A','x'],_val:3},{_cats:['A','y'],_val:1},{_cats:['B','z'],_val:4}]
  const resolve=()=>instantiateVisual({template:t,rows}).option.nodes
  const nodes=resolve(),a=nodes.find(n=>n.name==='A'),x=nodes.find(n=>n.name==='x'),y=nodes.find(n=>n.name==='y')
  expect(resolve()).toEqual(nodes)
  expect(Math.hypot(a.cx-x.cx,a.cy-x.cy)+x.radius).toBeLessThanOrEqual(a.radius+1e-8)
  expect(Math.hypot(x.cx-y.cx,x.cy-y.cy)).toBeGreaterThanOrEqual(x.radius+y.radius-1e-8)
  expect(nodes.every(n=>n.cx-n.radius>=-1e-8&&n.cx+n.radius<=400+1e-8)).toBe(true)
  expect(instantiateVisual({template:t,rows:[]}).option.nodes).toEqual([])
  const repeated={...t,template:{series:{repeat:'$calc.tree.nodes',template:{name:'$item.name',data:['$item.data'],z:'$item.depth'}}}}
  expect(validateTemplate(repeated).errors).toEqual([])
  expect(instantiateVisual({template:repeated,rows}).option.series[0].data[0].symbolSize).toBeGreaterThan(0)
 })
})
