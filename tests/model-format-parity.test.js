import {describe,it,expect} from 'vitest'
import {resolveVisualSpec} from '../packages/core/src/spec/resolve.js'
import {createRequire} from 'node:module'
const echarts=createRequire(new URL('../vilsem-renderer/package.json',import.meta.url))('echarts')
const context={measures:[{name:'Revenue',formatString:'$#,0.00'},{name:'Margin',formatString:'0.00%'}]}
describe('model formatting preserves visual semantics',()=>{
 it.each([900,300])('keeps full currency labels inside a %spx horizontal bar without changing the domain',width=>{
  const value=23642495.0952
  const option=resolveVisualSpec({type:'bar'},[{_cat:'Bikes',_val:value}],{width,measures:[{name:'Revenue',formatString:'$#,0'}],measureText:(text,font)=>echarts.format.getTextRect(text,font).width})
  const chart=echarts.init(null,null,{renderer:'svg',ssr:true,width,height:300})
  try {
   chart.setOption({...option,animation:false})
   const labels=chart.getZr().storage.getDisplayList().filter(el=>el.type==='tspan' && el.style.text==='$23,642,495')
   expect(labels.length).toBeGreaterThan(0)
   for(const label of labels){
    const bounds=label.getBoundingRect().clone();bounds.applyTransform(label.getComputedTransform())
    expect(bounds.x+bounds.width).toBeLessThanOrEqual(width-4)
   }
   expect(option.xAxis.max).toBe(value)
   expect(option.series[0].data[0].value).toBe(value)
  } finally {chart.dispose()}
 })
 it('uses explicit ellipsis when a full currency label cannot fit a narrow container',()=>{
  const value=23642495.0952
  const option=resolveVisualSpec({type:'bar'},[{_cat:'Bikes',_val:value}],{width:100,measures:[{name:'Revenue',formatString:'$#,0'}]})
  expect(option.series[0].data[0].label.overflow).toBe('truncate')
  expect(option.series[0].data[0].label.width).toBeLessThan(45)
  expect(option.series[0].tooltip.valueFormatter(value)).toBe('$23,642,495')
  expect(option.series[0].data[0].value).toBe(value)
 })
 it('formats a secondary tuple even when the primary measure uses General',()=>{
  const option=resolveVisualSpec({type:'scatter',config:{showLabels:true}},[{_cat:'Bikes',_val:1200,_val2:.2345}],{measures:[{name:'Revenue'},{name:'Margin',formatString:'0.00%'}]})
  const format=option.series[0].tooltip.valueFormatter
  expect(format.vilsemTupleFields[0].format(1200)).toBe('1200')
  expect(format.vilsemTupleFields[1].format(.2345)).toBe('23.45%')
  expect(option.series[0].label.formatter({name:'Bikes',value:[1200,.2345]})).toBe('Bikes')
 })
 it('parallel coordinates retain independent model units and raw numeric tuples',()=>{
  const spec={template:{meta:{id:'parallel-units'},slots:{revenue:{kind:'measure'},margin:{kind:'measure'}},transforms:[{as:'coords',points:{fields:['revenue','margin'],numeric:['revenue','margin']}}],template:{parallelAxis:[{dim:0},{dim:1}],series:[{type:'parallel',data:'$calc.coords.data'}]}}}
  const rows=[{_val:1200,_val2:.2345}]
  const original=structuredClone(rows)
  const option=resolveVisualSpec(spec,rows,context)
  expect(option.parallelAxis[0].axisLabel.formatter(1200)).toBe('$1,200.00')
  expect(option.parallelAxis[1].axisLabel.formatter(.2345)).toBe('23.45%')
  expect(option.series[0].data[0].value).toEqual([1200,.2345])
  expect(option.series[0].tooltip.valueFormatter.vilsemTupleFields[1].format(.2345)).toBe('23.45%')
  expect(rows).toEqual(original)
 })
 it('expanded facet series inherit the aggregate unit without pretending to be one bound row',()=>{
  const spec={template:{meta:{id:'facet-units'},slots:{group:{kind:'dimension'},category:{kind:'dimension'},revenue:{kind:'measure'}},transforms:[{as:'panels',facet:{by:'group',category:'category',value:'revenue'}}],template:{xAxis:{type:'category'},yAxis:{type:'value'},series:{repeat:'$calc.panels.panels',template:{type:'bar',data:'$item.data',label:{show:true}}}}}}
  const option=resolveVisualSpec(spec,[{_cats:['A','Bikes'],_val:100},{_cats:['B','Bikes'],_val:200}],context)
  expect(option.series).toHaveLength(2)
  for(const s of option.series){expect(s.label.formatter({value:1200})).toBe('$1,200.00');expect(s.tooltip.valueFormatter.vilsemDirectBinding).toBe(false)}
  expect(option.yAxis.axisLabel.formatter(1200)).toBe('$1,200.00')
 })
 it.each(['sum','lag','ewma','percentOfTotal','count'])('propagates only unit-preserving %s transforms',op=>{
  const transform=op==='count'?{stat:{field:'revenue',op}}:{window:{field:'revenue',op,...(op==='ewma'?{alpha:.5}:{})}}
  const spec={template:{meta:{id:'derived-units'},slots:{revenue:{kind:'measure'}},transforms:[{as:'derived',...transform}],template:{yAxis:{type:'value'},series:[{type:'bar',data:'$calc.derived.values'}]}}}
  const option=resolveVisualSpec(spec,[{_val:100},{_val:200}],context)
  if(['count','percentOfTotal'].includes(op)){
   expect(option.series[0].tooltip?.valueFormatter).toBeUndefined()
   expect(option.yAxis.axisLabel.formatter(2)).toBe('2')
  } else expect(option.series[0].label.formatter({value:1200})).toBe('$1,200.00')
 })
 it.each(['scatter','bubble'])('%s keeps category labels and formats the two measure axes independently',type=>{
  const option=resolveVisualSpec({type,config:{showLabels:true}},[{_cat:'Bikes',_val:1200,_val2:.2345,_val3:9}],context)
  expect(option.xAxis.axisLabel.formatter(1200)).toBe('$1,200.00')
  expect(option.yAxis.axisLabel.formatter(.2345)).toBe('23.45%')
  expect(option.series[0].label.formatter({name:'Bikes',value:[1200,.2345,9]})).toBe('Bikes')
 })
 it.each(['percent','name','value'])('pie retains %s label meaning',labelStyle=>{
  const option=resolveVisualSpec({type:'pie',config:{showLabels:true,labelStyle}},[{_cat:'Bikes',_val:20},{_cat:'Clothing',_val:30}],context)
  expect(option.series[0].label.formatter({name:'Bikes',value:20})).toBe(labelStyle==='percent'?'40%':labelStyle==='name'?'Bikes':'$20.00')
 })
 it('treemap retains category text and the signed raw value independently of area',()=>{
  const option=resolveVisualSpec({type:'treemap',config:{showLabels:true,showValues:true}},[{_cat:'Bikes',_val:-.2345}],{measures:[{name:'Margin',formatString:'0.00%'}]})
  const datum=option.series[0].data[0]
  expect(datum.value).toBe(.2345)
  expect(option.series[0].label.formatter({name:'Bikes',value:datum.value,data:datum})).toBe('{name|Bikes}\n{value|-23.45%}')
 })
 it('gauge formats its detail without replacing the real value with the clamped arc value',()=>{
  const ratio=resolveVisualSpec({type:'gauge'},[{_val:.2345}],{measures:[{name:'Margin',formatString:'0.00%'}]})
  expect(ratio.series[0].detail.formatter(.2345)).toBe('23.45%')
  const over=resolveVisualSpec({type:'gauge'},[{_val:150}],{measures:[{name:'Revenue',formatString:'$#,0.00'}]})
  expect(over.series[0].detail.formatter(100)).toBe('$150.00')
  expect(over.series[0].data[0].value).toBe(100)
 })
 it('donut formats the aggregate centre while preserving percentage slice labels',()=>{
  const option=resolveVisualSpec({type:'donut',config:{showLabels:true}},[{_cat:'Bikes',_val:20},{_cat:'Clothing',_val:30}],context)
  expect(option.title.text).toBe('$50.00')
  expect(option.series[0].label.formatter({name:'Bikes',value:20})).toBe('40%')
 })
 it('slope formats endpoints by measure, never by category series number',()=>{
  const option=resolveVisualSpec({type:'slope'},[{_cat:'Bikes',_val:1200,_val2:.2345},{_cat:'Clothing',_val:1500,_val2:.5}],context)
  for(const series of option.series){
   expect(series.label.formatter({value:1200,dataIndex:0})).toBe('$1,200.00')
   expect(series.label.formatter({value:.2345,dataIndex:1})).toBe('23.45%')
  }
 })
 it('lollipop formats the numeric coordinate, not the category coordinate',()=>{
  const option=resolveVisualSpec({type:'lollipop',config:{showValues:true}},[{_cat:'Bikes',_val:.2345}],{measures:[{name:'Margin',formatString:'0.00%'}]})
  const points=option.series.find(s=>s.type==='scatter')
  expect(points.label.formatter({value:[.2345,'Bikes'],name:'Bikes'})).toBe('23.45%')
 })
 it('paired templates apply model units only to the measure component',()=>{
  const spec={template:{meta:{id:'swapped-format'},slots:{category:{kind:'dimension'},margin:{kind:'measure'}},template:{xAxis:{type:'value'},yAxis:{type:'category',data:'$slot.category.categories'},series:[{type:'scatter',data:'$slot.margin.pairsSwapped',label:{show:true,formatterTemplate:'{value.0} ({value.1})'}}]}}}
  const option=resolveVisualSpec(spec,[{_cat:'Bikes',_val:.2345}],{measures:[{name:'Margin',formatString:'0.00%'}]})
  expect(option.series[0].label.formatter({value:[.2345,'Bikes']})).toBe('23.45% (Bikes)')
 })
 it('trusted tooltips retain names and format numeric fields without introducing HTML injection',()=>{
  const scatter=resolveVisualSpec({type:'scatter'},[{_cat:'Bikes',_val:1200,_val2:.2345}],context)
  const tooltip=scatter.series[0].tooltip.formatter({name:'<img>',value:[1200,.2345]})
  expect(tooltip).toContain('$1,200.00');expect(tooltip).toContain('23.45%');expect(tooltip).not.toContain('<img>')
  const radar=resolveVisualSpec({type:'radar'},[{_cat:'A',_val:.2345},{_cat:'B',_val:.5}],{measures:[{name:'Margin',formatString:'0.00%'}]})
  expect(radar.series[0].tooltip.formatter({value:[.2345,.5]})).toContain('23.45%')
 })
 it('keeps explicitly authored prefix/suffix formatting intact',()=>{
  const gauge=resolveVisualSpec({type:'gauge',config:{prefix:'Points ',suffix:' score'}},[{_val:50}],context)
  expect(gauge.series[0].detail.formatter(50)).toBe('Points 50 score')
 })
})
