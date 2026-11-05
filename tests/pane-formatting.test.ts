import {describe,it,expect} from 'vitest'
import {readPaneObjects,applyPaneFormatting,PANE_GROUPS,paneCapabilities,paneFormattingCards,effectivePaneObjects,paneValidationErrors} from '../packages/core/src/shared/paneFormatting.js'
import {resolveReportTheme} from '../packages/core/src/shared/reportTheme.js'
import fs from 'node:fs'
import {resolveVisualSpec} from '../packages/core/src/spec/resolve.js'
describe('manual format-pane literal preservation and preview parity',()=>{
 it('decodes evaluated dataViews and PBIR literal properties into the same appearance',()=>{
  const literal=(Value:string)=>({expr:{Literal:{Value}}})
  const properties={
   useReportTheme:literal('true'),
   transparency:literal('25D'),
   backgroundColor:{solid:{color:literal("'#123456'")}},
  }
  const objects={appearance:[{properties}]}
  const evaluated={appearance:{useReportTheme:true,transparency:25,backgroundColor:{solid:{color:'#123456'}}}}
  expect(readPaneObjects(objects)).toEqual(evaluated);expect(applyPaneFormatting({},objects)).toEqual(applyPaneFormatting({},evaluated));expect(applyPaneFormatting({},objects).backgroundColor).toBe('rgba(18,52,86,0.75)')
 })
 it('does not apply selector-specific objects globally or invent unsupported expressions',()=>{
  const objects={appearance:[{selector:{id:'categoryA'},properties:{transparency:0}}]}
  expect(readPaneObjects(objects).appearance).toEqual({})
  expect(readPaneObjects({appearance:[{properties:{useReportTheme:{expr:{SomeCode:'evil()'}}}}]}).appearance.useReportTheme).not.toBe(true)
  const option={backgroundColor:'transparent'};expect(applyPaneFormatting(option,{})).toEqual(option)
 })
})

describe('every declared common pane property has a render contract',()=>{
 const option=()=>({backgroundColor:'transparent',title:{text:'Original'},legend:{show:true},xAxis:{type:'category'},yAxis:[{type:'value'},{type:'value'}],series:[{type:'line',data:[12]}]})
 const get=(value,path)=>path.split('.').reduce((v,k)=>v?.[k],value)
 const fields=PANE_GROUPS.flatMap(g=>g.fields.map(f=>({group:g.name,...f})))
 const outputs={title:{show:'title.show',text:'title.text',fontFamily:'title.textStyle.fontFamily',fontSize:'title.textStyle.fontSize',color:'title.textStyle.color',bold:'title.textStyle.fontWeight',alignment:'title.left'},typography:{fontFamily:'textStyle.fontFamily',fontSize:'textStyle.fontSize',color:'textStyle.color'},labels:{show:'series.0.label.show',fontFamily:'series.0.label.fontFamily',fontSize:'series.0.label.fontSize',color:'series.0.label.color',position:'series.0.label.position',format:'series.0.label.formatter'},legend:{show:'legend.show',fontFamily:'legend.textStyle.fontFamily',fontSize:'legend.textStyle.fontSize',color:'legend.textStyle.color',position:'legend.left'},lines:{width:'series.0.lineStyle.width',style:'series.0.lineStyle.type',color:'series.0.lineStyle.color'},border:{show:'graphic.0.type',color:'graphic.0.style.stroke',width:'graphic.0.style.lineWidth',radius:'graphic.0.shape.r'},seriesColors:{palette:'color.0'}}
 for(const f of fields)it(`${f.group}.${f.name} reaches its documented rendering surface`,()=>{
  let v=f.type==='bool'?false:f.type==='number'?23:f.type==='color'?{solid:{color:'#123456'}}:'Example'
  if(f.name==='format')v='0.00%'
  if(f.name==='position')v=f.group==='legend'?'right':'inside'
  if(f.name==='alignment')v='center'
  if(f.name==='style')v='dashed'
  if(f.name==='palette')v='#123456,#abcdef'
  if(f.group==='border'&&f.name==='show')v=true
  if(f.group==='motion'&&f.name==='reduceMotion')v=true
  const pane={[f.group]:{...(f.group==='border'?{show:true}:{}),[f.name]:v}}
  const out=applyPaneFormatting(option(),pane,{width:300,height:200})
  if(f.group==='motion'){expect(out.animation).toBe(false);return}
  if(['autoMin','autoMax'].includes(f.name)){
   const index=f.group==='primaryAxis'?0:1,key=f.name==='autoMin'?'min':'max',base=option();base.yAxis[index][key]=23
   expect(applyPaneFormatting(base,{[f.group]:{[f.name]:true,[key]:23}}).yAxis[index][key]).toBeUndefined()
   expect(applyPaneFormatting(base,{[f.group]:{[f.name]:false,[key]:23}}).yAxis[index][key]).toBe(23)
   return
  }
  let path=outputs[f.group]?.[f.name],expected=f.type==='color'?'#123456':v
  if(['categoryAxis','primaryAxis','secondaryAxis'].includes(f.group)){
   const base=f.group==='categoryAxis'?'xAxis':f.group==='primaryAxis'?'yAxis.0':'yAxis.1'
   path=base+'.'+({show:'show',title:'name',fontFamily:'axisLabel.fontFamily',fontSize:'axisLabel.fontSize',color:'axisLabel.color',titleColor:'nameTextStyle.color',titleSize:'nameTextStyle.fontSize',min:'min',max:'max',format:'axisLabel.formatter',gridlines:'splitLine.show',gridColor:'splitLine.lineStyle.color'}[f.name])
  }
  if(f.group==='appearance'){
   if(f.name==='useReportTheme'){expect(resolveReportTheme({canvasTheme:'dark'},{theme:'light',useReportTheme:true}).mode).toBe('light');return}
   const applied=applyPaneFormatting(option(),{appearance:{backgroundColor:{solid:{color:'#123456'}},transparency:23}})
   expect(applied.backgroundColor).toBe('rgba(18,52,86,0.77)');return
  }
  if(f.group==='title'&&f.name==='bold')expected='normal'
  if(f.group==='border'&&f.name==='show')expected='rect'
  if(f.group==='seriesColors')expected='#123456'
  if(f.name==='format'){expect(get(out,path)(f.group==='labels'?{value:.2345}:.2345)).toBe('23.45%');return}
  expect(path).toBeTruthy();expect(get(out,path)).toEqual(expected)
 })
 it('keeps actual capabilities, controls and declared property contracts in sync',()=>{
  const caps=JSON.parse(fs.readFileSync('vilsem-renderer/capabilities.json','utf8'))
  const {semantica,...common}=caps.objects;expect(common).toEqual(paneCapabilities())
  const cards=paneFormattingCards({});expect(cards.flatMap(c=>c.groups.flatMap(g=>g.slices))).toHaveLength(fields.length)
  expect(paneFormattingCards({}, {dom:true}).map(c=>c.displayName)).toEqual(['Appearance','Animation','Title','Border'])
 })
 it('changes a secondary axis without overwriting primary currency formatting',()=>{
  const base=option();base.yAxis[0].axisLabel={formatter:()=>'$12'}
  const result=applyPaneFormatting(base,{secondaryAxis:{format:'0%',color:{solid:{color:'#ff0000'}}}})
  expect(result.yAxis[0].axisLabel.formatter()).toBe('$12');expect(result.yAxis[1].axisLabel.formatter(.25)).toBe('25%');expect(result.yAxis[1].axisLabel.color).toBe('#ff0000')
 })
 it('merges manual properties over the authored spec without erasing sibling settings',()=>{
  expect(effectivePaneObjects({formatting:{labels:{fontSize:18,show:true,color:'#123456'}}},{labels:{fontSize:24}})).toEqual({labels:{fontSize:24,show:true,color:'#123456'}})
  expect(paneValidationErrors({unknown:{}})[0]).toMatchObject({path:'/formatting/unknown',expected:{allowed:expect.any(Array)}})
  expect(paneValidationErrors({labels:{fontSize:'huge'}})[0].path).toBe('/formatting/labels/fontSize')
 })
 it('keeps category names while applying an authored numeric-label format over model defaults',()=>{
  const spec={formatting:{labels:{format:'0.0%'}},template:{meta:{id:'named-format'},slots:{category:{kind:'dimension'},value:{kind:'measure'}},template:{series:[{type:'pie',data:'$slot.value.pieData',label:{formatterTemplate:'{name}: {value}'}}]}}}
  const result=resolveVisualSpec(spec,[{_cat:'Margin',_val:.2345}],{measures:[{name:'Margin',formatString:'0.00%'}]})
  expect(result.series[0].label.formatter({name:'Margin',value:.2345})).toBe('Margin: 23.5%')
  const again=applyPaneFormatting(result,{labels:{format:'0.0%'}})
  expect(again.series[0].label.formatter({name:'Margin',value:.2345})).toBe('Margin: 23.5%')
 })
 it('does not convert Sankey semantic string labels into ECharts style objects',()=>{
  const spec={formatting:{labels:{fontSize:14,format:'$#,0,,.0"M"'}},template:{meta:{id:'sankey-label'},slots:{value:{kind:'measure'}},template:{series:[{type:'sankey',data:[{name:'0:Bikes',label:'Bikes',value:23642495},{name:'1:Road Bikes',label:'Road Bikes',value:23642495}],links:[{source:'0:Bikes',target:'1:Road Bikes',value:23642495}],label:{formatterTemplate:'{label}: {value}'}}]}}}
  const result=resolveVisualSpec(spec,[],{measures:[{name:'Revenue',formatString:'$#,0.00'}]})
  const node=result.series[0].data[0]
  expect(node.label).toBe('Bikes');expect(result.series[0].label.fontSize).toBe(14)
  expect(result.series[0].label.formatter({name:node.name,value:node.value,data:node})).toBe('Bikes: $23.6M')
 })
 it('shows authored resolved values and disables numeric bounds while automatic',()=>{
  const cards=paneFormattingCards({}, {option:{series:[{label:{fontSize:18}}],yAxis:[{type:'value',min:10}]}})
  const slice=(group,name)=>cards.find(c=>c.uid==='vilsem-'+group).groups[0].slices.find(s=>s.control.properties.descriptor.propertyName===name)
  expect(slice('labels','fontSize').control.properties.value).toBe(18)
  expect(slice('primaryAxis','autoMin').control.properties.value).toBe(false)
  expect(slice('primaryAxis','min').control.properties.value).toBe(10)
  expect(slice('primaryAxis','max').disabled).toBe(true)
 })
})
