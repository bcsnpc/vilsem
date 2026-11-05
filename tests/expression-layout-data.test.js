import{it,expect}from'vitest'
import{deriveJitter}from'../packages/core/src/templates/jitter-transform.js'
import{deriveWords}from'../packages/core/src/templates/word-layout.js'
import{applyTransforms,shapeSlots}from'../packages/core/src/templates/instantiate.js'
it('exposes the actual reduced collision radius without changing legacy jitter point tuples',()=>{
 const source={group:['A','A'],price:[10,11]},result=deriveJitter({by:'group',field:'price',method:'collision',expressionGeometry:true},key=>source[key],2)
 expect(result.data[0].value).toHaveLength(2);expect(result.expressionData[0].value[2]).toBe(result.symbolSize/2);expect(result.expressionData[0].rowIndexes).toEqual(result.data[0].rowIndexes)
})
it('carries measured word packing fonts and safe text in unused expression dimensions',()=>{
 const source={text:['Blue bicycle','Red bicycle'],weight:[3,2]},result=deriveWords({text:'text',weight:'weight',expressionGeometry:true},key=>source[key],2)
 for(let i=0;i<result.data.length;i++){expect(result.data[i].value).toHaveLength(3);expect(result.expressionData[i].value[3]).toBe(result.data[i].label.fontSize);expect(result.expressionData[i].value[4]).toBe(result.data[i].name);expect(result.expressionData[i].itemStyle?.opacity).not.toBe(0)}
})
it('exposes real hierarchy rectangles with source lineage, not imaginary stacked series',()=>{
 const rows=[{_cats:['A','B','P'],_val:3},{_cats:['A','B','Q'],_val:1}],{shaped}=shapeSlots(rows,{a:{kind:'dimension'},b:{kind:'dimension'},c:{kind:'dimension'},weight:{kind:'measure'}})
 const {calc}=applyTransforms([{as:'h',hierarchy:{levels:['a','b','c'],value:'weight',layout:'partition',expressionGeometry:true}}],shaped,[],{})
 expect(calc.h.expressionData).toHaveLength(4);expect(calc.h.expressionData[0]).toMatchObject({name:'A',rowIndexes:[0,1],value:[0,0,1,4,'A']})
 const leaves=calc.h.expressionData.filter(d=>d.value[1]===2);expect(leaves.reduce((sum,d)=>sum+d.value[2],0)).toBe(1)
})
