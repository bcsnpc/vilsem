import {it,expect} from 'vitest'
import {resolveVisualSpec} from '../packages/core/src/spec/resolve.js'
const spec=bubble=>({type:'custom',template:{meta:{id:'race-units',formatVersion:4},slots:{time:{kind:'time'},country:{kind:'dimension'},revenue:{kind:'measure'},margin:{kind:'measure'},orders:{kind:'measure'}},transforms:[{as:'race',race:{time:'time',category:'country',value:'revenue',...(bubble?{x:'revenue',y:'margin',size:'orders'}:{})}}],template:{baseOption:{timeline:{data:'$calc.race.timeLabels'},xAxis:{type:bubble?'value':'category'},yAxis:{type:'value'}},options:{repeat:'$calc.race.frames',template:{series:[{id:'race',type:bubble?'scatter':'bar',data:'$item.data'}]}}}}})
const rows=[{_cats:['2025-01-01','A'],_cat:'2025-01-01',_val:12.5,_val2:.2345,_val3:3},{_cats:['2025-02-01','A'],_cat:'2025-02-01',_val:14.5,_val2:.3,_val3:4}],context={measures:[{name:'Revenue',formatString:'$#,0.00'},{name:'Margin',formatString:'0.00%'},{name:'Orders',formatString:'#,0'}]}
it('formats model values and inherited axes on each timeline frame rather than only root series',()=>{
 const option=resolveVisualSpec(spec(false),rows,context),first=option.options[0].series[0],last=option.options[1].series[0]
 expect(first.label.formatter({value:12.5})).toBe('$12.50');expect(last.tooltip.valueFormatter(14.5)).toBe('$14.50');expect(option.options[0].yAxis.axisLabel.formatter(12.5)).toBe('$12.50');expect(option.options[0].xAxis.type).toBe('category')
})
it('keeps bubble currency, ratio and count units distinct across frames and native tooltip metadata',()=>{
 const option=resolveVisualSpec(spec(true),rows,context),series=option.options[0].series[0],format=series.tooltip.valueFormatter
 expect(format.vilsemTupleFields.map(f=>f.name)).toEqual(['Revenue','Margin','Orders','Revenue']);expect(format.vilsemTupleFormatters[1](.2345)).toBe('23.45%');expect(format.vilsemTupleFormatters[2](3)).toBe('3');expect(option.options[0].yAxis.axisLabel.formatter(.2345)).toBe('23.45%');expect(option.options[0].xAxis.axisLabel.formatter(12.5)).toBe('$12.50')
})
it('formats timeline morph states that bind directly to a slot without guessing transform units',()=>{
 const item=spec(false);delete item.template.transforms;item.template.template.baseOption.timeline.data=['Pie'];item.template.template.options=[{series:[{type:'pie',data:'$slot.revenue.pieData'}]}];const option=resolveVisualSpec(item,rows,context);expect(option.options[0].series[0].tooltip.valueFormatter(12.5)).toBe('$12.50')
})
it('applies manual pane labels and axis colours to every frame while preserving currency and ratio formats',()=>{
 const option=resolveVisualSpec(spec(true),rows,{...context,formatPaneOverrides:{labels:{fontSize:23,color:'#123456'},primaryAxis:{color:'#654321'}}})
 for(const frame of option.options){expect(frame.series[0].label.fontSize).toBe(23);expect(frame.series[0].label.color).toBe('#123456');expect(frame.yAxis.axisLabel.color).toBe('#654321');expect(frame.yAxis.axisLabel.formatter(.2345)).toBe('23.45%')}
})
it('inherits report foreground and palette in timeline base and frames while preserving authored font choices',()=>{
 const item=spec(false);item.template.template.baseOption.textStyle={fontFamily:'Arial'}
 const dark=resolveVisualSpec(item,rows,{...context,theme:'dark'}),light=resolveVisualSpec(item,rows,{...context,theme:'light'})
 expect(dark.baseOption.textStyle.color).not.toBe(light.baseOption.textStyle.color);expect(dark.options[0].series[0].label.color).toBe(dark.baseOption.textStyle.color);expect(dark.options[0].color).toEqual(dark.baseOption.color);expect(dark.options[0].textStyle.fontFamily).toBe('Arial');expect(dark.baseOption.backgroundColor).toBe('transparent')
})
it('keeps explicit unit-preserving scalar projections formatted without assigning currency to delta ratios',()=>{
 const item=spec(false);delete item.template.transforms;item.template.template={xAxis:{type:'category',data:['Total']},yAxis:{type:'value'},series:[{type:'bar',data:[{name:'Total',value:'$slot.revenue.sum'}]}]}
 const option=resolveVisualSpec(item,rows,context);expect(option.series[0].label.formatter({value:27})).toBe('$27.00')
 item.template.template.series[0].data=['$slot.revenue.deltaPct'];expect(resolveVisualSpec(item,rows,context).series[0].tooltip?.valueFormatter).toBeUndefined()
})
it('retains model axis formats when a timeline frame only changes dataZoom and inherits base series',()=>{
 const item={type:'custom',template:{meta:{id:'zoom-units',formatVersion:4},slots:{time:{kind:'time'},revenue:{kind:'measure'}},template:{baseOption:{timeline:{data:['First','Second']},xAxis:{type:'category',data:'$slot.time.categories'},yAxis:{type:'value'},series:[{type:'line',data:'$slot.revenue.values'}]},options:[{dataZoom:[{start:0,end:50}]},{dataZoom:[{start:50,end:100}]}]}}}
 const option=resolveVisualSpec(item,rows,context)
 expect(option.baseOption.yAxis.axisLabel.formatter(12.5)).toBe('$12.50')
 for(const frame of option.options)expect(frame.yAxis.axisLabel.formatter(12.5)).toBe('$12.50')
})
