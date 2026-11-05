import{it,expect}from'vitest'
import{expressionGeometry}from'../packages/core/src/templates/expressionGeometry.js'
import{resolveVisualSpec}from'../packages/core/src/spec/resolve.js'
import{createRequire}from'node:module'
const echarts=createRequire(new URL('../ui/package.json',import.meta.url))('echarts')
it('normalizes real numeric outlines into bounded paths with exact source lineage',()=>{
 const result=expressionGeometry([{name:'A',data:[{value:[0,0],rowIndexes:[1]},{value:[1,2],rowIndexes:[2]},{value:[2,0],rowIndexes:[1]}]}],{xMin:0,xMax:2,yMin:0,yMax:2,closed:true})
 expect(result.geometryData[0]).toEqual({name:'A',rowIndexes:[1,2],value:[0,2,2,2,0,'M0 1 L0.5 0 L1 1 Z']})
})
it('does not silently invent missing geometry, rescale invalid domains or expose unbounded paths',()=>{
 for(const points of[[{value:[NaN,0]},{value:[1,1]}],Array.from({length:257},()=>({value:[0,0]}))])expect(()=>expressionGeometry([{data:points}],{xMin:0,xMax:1,yMin:0,yMax:1})).toThrow()
 expect(()=>expressionGeometry([],{xMin:0,xMax:0,yMin:0,yMax:1})).toThrow(/domains/)
 expect(()=>expressionGeometry([{data:[{value:[0,0]},{value:[1,1]}],rowIndexes:[-1]}],{xMin:0,xMax:1,yMin:0,yMax:1})).toThrow(/identities/)
})
it.each(['violin','ridgeline'])('renders an actual %s outline through the shared expression interpreter',layout=>{
 const op=(op,...args)=>({op,args}),v=i=>op('value',i),origin=i=>op('at',op('coord',[v(0),v(1)]),i),size=i=>op('abs',op('at',op('size',[v(2),v(3)]),i))
 const spec={type:'custom',template:{meta:{id:'density-expression',formatVersion:4},slots:{group:{kind:'dimension'},price:{kind:'dimension'},presence:{kind:'measure'}},transforms:[{as:'curve',density:{by:'group',field:'price',layout,samples:32,expressionGeometry:true}}],template:{animation:false,xAxis:{type:'value',min:'$calc.curve.geometryXMin',max:'$calc.curve.geometryXMax'},yAxis:{type:'value',min:'$calc.curve.geometryYMin',max:'$calc.curve.geometryYMax'},series:[{type:'custom',dimensions:['left','top','width','height','group',{name:'outline',type:'ordinal'}],encode:{x:[0,2],y:[1,3]},data:'$calc.curve.geometryData',renderItem:{language:'vilsem-expression',version:1,root:{type:'path',shape:{pathData:v(5)},x:origin(0),y:origin(1),scaleX:size(0),scaleY:size(1),style:{fill:layout==='violin'?'#118DFF':'none',stroke:'#118DFF',lineWidth:2}}}}]}}}
 const rows=Array.from({length:20},(_,i)=>({_cats:[i<10?'A':'B',String(10+i%10)],_val:1})),option=resolveVisualSpec(spec,rows)
 expect(option.series[0].data).toHaveLength(2)
 const renderer=option.series[0].renderItem;option.series[0].renderItem=(params,api)=>{expect(api.value(5)).toBe(option.series[0].data[params.dataIndex].value[5]);return renderer(params,api)}
 const chart=echarts.init(null,null,{renderer:'svg',ssr:true,width:600,height:400})
 try{chart.setOption(option);const svg=chart.renderToSVGString();expect(svg).not.toContain('NaN');expect(svg).toContain('#118DFF');const data=chart.getModel().getSeriesByIndex(0).getData(),boxOf=i=>{const el=data.getItemGraphicEl(i);const box=el.getBoundingRect().clone();box.applyTransform(el.getComputedTransform());return box},box=boxOf(0),other=boxOf(1);expect(box.width).toBeGreaterThan(50);expect(box.height).toBeGreaterThan(50);expect(box.width).toBeLessThan(550);expect(box.height).toBeLessThan(300);expect(Math.abs((layout==='violin'?box.x:box.y)-(layout==='violin'?other.x:other.y))).toBeGreaterThan(50)}finally{chart.dispose()}
})
