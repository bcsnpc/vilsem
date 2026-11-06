import {describe,it,expect} from 'vitest'
import {createRequire} from 'node:module'
import {resolveVisualSpec} from '../packages/core/src/spec/resolve.js'
import {validateSpecDetailed} from '../packages/core/src/spec/diagnostics.js'
import {requiredRendererVersion} from '../packages/core/src/pbir/rendererCompatibility.js'
import {instantiateVisual} from '../packages/core/src/templates/instantiate.js'
const echarts=createRequire(new URL('../ui/package.json',import.meta.url))('echarts')
const op=(op,...args)=>({op,args}),value=i=>op('value',i),coord=(x,y,i)=>op('at',op('coord',[x,y]),i)
function example(){return {type:'custom',params:{widthRatio:.6},template:{meta:{id:'expr-bar',formatVersion:4},params:[{name:'widthRatio',type:'number',default:.6}],slots:{category:{kind:'dimension'},value:{kind:'measure'}},template:{animation:false,xAxis:{type:'category',data:'$slot.category.categories'},yAxis:{type:'value'},series:[{type:'custom',data:'$slot.value.pairs',encode:{x:0,y:1},renderItem:{language:'vilsem-expression',version:1,root:{type:'group',children:[{type:'rect',shape:{x:op('sub',coord(value(0),0,0),op('mul',op('at',op('size',[1,0]),0),.3)),y:coord(value(0),value(1),1),width:op('mul',op('at',op('size',[1,0]),0),'$param.widthRatio'),height:op('abs',op('sub',coord(value(0),0,1),coord(value(0),value(1),1)))},style:{fill:op('visual','color')}},{type:'text',style:{text:op('formatNumber',value(1),op('literal','$#,0')),x:coord(value(0),0,0),y:op('sub',coord(value(0),value(1),1),12),align:'center',fill:'$theme.textPrimary',fontSize:12}}]}}}]}}}}
const rows=[{_cat:'A',_val:12},{_cat:'B',_val:3}]
describe('one expression resolver for native and SSR',()=>{
 it('compiles through the direct Playground/web/Fabric template entry point',()=>{
  const {option}=instantiateVisual({template:example().template,rows,theme:{textPrimary:'#111111'}})
  expect(typeof option.series[0].renderItem).toBe('function')
  const chart=echarts.init(null,null,{renderer:'svg',ssr:true,width:600,height:400})
  try{chart.setOption(option);expect(chart.renderToSVGString()).toContain('$12')}finally{chart.dispose()}
 })
 it('validates and paints real custom rectangles/text in the ECharts SVG renderer',()=>{
  const spec=example(),checked=validateSpecDetailed(spec);expect(checked.valid,JSON.stringify(checked.errors)).toBe(true)
  const option=resolveVisualSpec(spec,rows,{theme:'light'});expect(option.series[0].renderItem.vilsemExpression.version).toBe(1)
  const chart=echarts.init(null,null,{renderer:'svg',ssr:true,width:600,height:400})
  try{chart.setOption(option);const svg=chart.renderToSVGString();expect(svg).toContain('$12');expect(svg).toContain('$3');expect(svg).not.toContain('NaN');expect(svg).toContain('clipPath')}finally{chart.dispose()}
  expect(requiredRendererVersion(spec)).toBe('4.39.0.0')
 })
 it('applies manual formatting to custom text without enabling caller callbacks',()=>{
  const option=resolveVisualSpec(example(),rows,{formatPaneOverrides:{labels:{fontSize:18,format:'0.0%'}}})
  const render=option.series[0].renderItem
  const result=render({dataIndex:0},{value:i=>['A',.2345][i],coord:p=>[50,100-Number(p[1]||0)],size:()=>[20,20],visual:()=> '#123456',style:()=>({opacity:.25})})
  expect(result.children[1].style).toMatchObject({fontSize:18,text:'23.5%',opacity:.25})
 })
 it('escapes image/HTML-looking label strings instead of loading or executing them',()=>{
  const spec=example();spec.template.template.series[0].renderItem.root={type:'text',style:{text:'<img src="https://invalid.example" onerror="fetch(1)">',x:20,y:20,fill:'#000000'}}
  const chart=echarts.init(null,null,{renderer:'svg',ssr:true,width:600,height:400})
  try{chart.setOption(resolveVisualSpec(spec,rows));const svg=chart.renderToSVGString();expect(svg).toContain('&lt;img');expect(svg).not.toContain('<image');expect(svg).not.toContain('<img')}finally{chart.dispose()}
 })
 it('rejects executable callbacks, unknown AST operations and incorrect format versions with pointers',()=>{
  const invalid=example();invalid.template.template.series[0].renderItem.root.children[0].shape.width=op('fetch','https://invalid.example')
  const checked=validateSpecDetailed(invalid);expect(checked.valid).toBe(false);expect(checked.errors.some(e=>e.path.includes('/renderItem/root/children/0/shape/width/op'))).toBe(true)
  const old=example();old.template.meta.formatVersion=3;expect(validateSpecDetailed(old).valid).toBe(false)
  const callback=example();callback.template.template.series[0].renderItem='function(){return window}';expect(validateSpecDetailed(callback).valid).toBe(false)
 })
})
