import {RENDER_MODES} from './renderingSurface.js'
import {createModelFormatter} from './modelFormatting.js'
import {applyAnimation} from '../templates/animation.js'
import {inheritTimelineFrame} from '../templates/timeline.js'

const field=(name,displayName,type,value)=>({name,displayName,type,value})
export const PANE_GROUPS=[
 {name:'appearance',displayName:'Appearance',fields:[field('useReportTheme','Use report theme','bool',true),field('backgroundColor','Background colour','color','#ffffff'),field('transparency','Transparency (%)','number',100),field('renderMode','Render mode','enum','auto')]},
 {name:'motion',displayName:'Animation',fields:[field('enabled','Animation','bool',true),field('reduceMotion','Reduce motion','bool',false)]},
 {name:'title',displayName:'Title',fields:[field('show','Show title','bool',true),field('text','Title text','text',''),field('fontFamily','Font family','text','Segoe UI'),field('fontSize','Font size','number',17),field('color','Colour','color','#252423'),field('bold','Bold','bool',false),field('alignment','Alignment (left/center/right)','text','left')]},
 {name:'typography',displayName:'Chart text',fields:[field('fontFamily','Font family','text','Segoe UI'),field('fontSize','Font size','number',12),field('color','Colour','color','#252423')]},
 {name:'seriesColors',displayName:'Series colours',fields:[field('palette','Palette (comma-separated colours)','text','')]},
 {name:'labels',displayName:'Data labels',fields:[field('show','Show labels','bool',true),field('fontFamily','Font family','text','Segoe UI'),field('fontSize','Font size','number',12),field('color','Colour','color','#252423'),field('position','Position (inside/top/right/left/bottom)','text','top'),field('format','Number format','text','')]},
 {name:'legend',displayName:'Legend',fields:[field('show','Show legend','bool',true),field('position','Position (top/bottom/left/right)','text','bottom'),field('fontFamily','Font family','text','Segoe UI'),field('fontSize','Font size','number',12),field('color','Colour','color','#252423')]},
 ...['categoryAxis','primaryAxis','secondaryAxis'].map(name=>({name,displayName:{categoryAxis:'Category axis',primaryAxis:'Primary value axis',secondaryAxis:'Secondary value axis'}[name],fields:[field('show','Show axis','bool',true),field('title','Axis title','text',''),field('fontFamily','Label font family','text','Segoe UI'),field('fontSize','Label font size','number',12),field('color','Label colour','color','#252423'),field('titleColor','Title colour','color','#252423'),field('titleSize','Title font size','number',12),...(name==='categoryAxis'?[]:[field('autoMin','Automatic minimum','bool',true),field('min','Minimum','number',0),field('autoMax','Automatic maximum','bool',true),field('max','Maximum','number',100),field('format','Number format','text','')]),field('gridlines','Show gridlines','bool',true),field('gridColor','Gridline colour','color','#dddddd')]})),
 {name:'lines',displayName:'Lines',fields:[field('width','Width','number',2),field('style','Style (solid/dashed/dotted)','text','solid'),field('color','Colour','color','#118dff')]},
 {name:'border',displayName:'Border',fields:[field('show','Show border','bool',false),field('color','Colour','color','#cccccc'),field('width','Width','number',1),field('radius','Corner radius','number',0)]},
]

export function paneCapabilities(){return Object.fromEntries(PANE_GROUPS.map(g=>[g.name,{displayName:g.displayName,properties:Object.fromEntries(g.fields.map(f=>[f.name,{displayName:f.displayName,type:f.type==='bool'?{bool:true}:f.type==='number'?{numeric:true}:f.type==='color'?{fill:{solid:{color:true}}}:f.type==='enum'?{enumeration:RENDER_MODES}:{text:true}}]))}]))}

export function paneFormattingCards(objects={}, {dom=false,canvasTheme,option,config={}}={}){
 if(option?.baseOption){const index=option.baseOption.timeline?.currentIndex??option.timeline?.currentIndex??0;option={...option,...option.baseOption,...inheritTimelineFrame(option.baseOption,option.options?.[index]??{})}}
 const pane=readPaneObjects(objects)
 const axisValues=option?['yAxis','xAxis'].flatMap(key=>list(option[key])).filter(a=>a.type!=='category'):[]
 const axisCategory=option?['xAxis','yAxis'].flatMap(key=>list(option[key])).find(a=>a.type==='category'):null
 const axisDefaults=a=>a?{show:a.show!==false,title:a.name,...a.axisLabel,fontSize:a.axisLabel?.fontSize,color:a.axisLabel?.color,titleColor:a.nameTextStyle?.color,titleSize:a.nameTextStyle?.fontSize,min:typeof a.min==='number'?a.min:undefined,max:typeof a.max==='number'?a.max:undefined,gridlines:a.type==='category'?a.splitLine?.show===true:a.splitLine?.show!==false,gridColor:a.splitLine?.lineStyle?.color}:{}
 const title=list(option?.title)[0]||{},legend=list(option?.legend)[0]||{},series=list(option?.series)[0]||{}
 const resolved={motion:{enabled:option?.animation!==false,reduceMotion:false},typography:option?.textStyle||{},title:{show:title.show??config.showTitle??true,text:title.text??config.title,...title.textStyle,fontSize:title.textStyle?.fontSize??config.titleFontSize,fontFamily:title.textStyle?.fontFamily??config.titleFontFamily,color:title.textStyle?.color??config.titleColor,bold:title.textStyle?.fontWeight==='bold'||Number(title.textStyle?.fontWeight??config.titleFontWeight)>=600,alignment:title.left??config.titleAlign},labels:series.label||{},lines:{...series.lineStyle,style:series.lineStyle?.type},legend:{...legend.textStyle,show:legend.show!==false,position:['left','right'].includes(legend.left)?legend.left:legend.top===0?'top':legend.bottom===0?'bottom':undefined},seriesColors:{palette:Array.isArray(option?.color)?option.color.join(','):undefined},categoryAxis:axisDefaults(axisCategory),primaryAxis:axisDefaults(axisValues[0]),secondaryAxis:axisDefaults(axisValues[1])}
 return PANE_GROUPS.filter(g=>!dom||['appearance','motion','title','border'].includes(g.name)).map(g=>{
  const descriptor=propertyName=>({objectName:g.name,propertyName})
  const shown={...resolved[g.name],...pane[g.name]}
  return {uid:`vilsem-${g.name}`,displayName:g.displayName,groups:[{uid:`vilsem-${g.name}-settings`,displayName:g.displayName,slices:g.fields.filter(f=>!dom||f.name!=='renderMode').map(f=>{
   const automatic=f.name==='autoMin'?shown.min===undefined:f.name==='autoMax'?shown.max===undefined:undefined
   let value=shown[f.name]??automatic??(g.name==='appearance'&&f.name==='useReportTheme'?!['light','dark'].includes(canvasTheme):f.value)
   if(f.type==='enum'&&!RENDER_MODES.some(mode=>mode.value===value))value=f.value
   if(f.type==='text'&&typeof value!=='string'||f.type==='number'&&(typeof value!=='number'||!Number.isFinite(value))||f.type==='bool'&&typeof value!=='boolean'||f.type==='color'&&typeof colorValue(value)!=='string')value=f.value
   return {uid:`${g.name}-${f.name}`,displayName:f.displayName,...(['min','max'].includes(f.name)?{disabled:shown[f.name==='min'?'autoMin':'autoMax']??shown[f.name]===undefined}:{}),control:{type:{bool:'ToggleSwitch',number:'NumUpDown',text:'TextInput',color:'ColorPicker',enum:'Dropdown'}[f.type],properties:{descriptor:descriptor(f.name),...(f.type==='enum'?{items:RENDER_MODES}:{}),value:f.type==='color'?{value:value?.solid?.color || value}:f.type==='enum'?RENDER_MODES.find(mode=>mode.value===value):value}}}
  })}],revertToDefaultDescriptors:g.fields.map(f=>descriptor(f.name))}
 })
}

// PBIR stores expressions; dataViews expose evaluated values. Decode only
// literals, never arbitrary expressions or executable text. Keep raw objects
// separately when editing so selector-specific overrides survive unchanged.
function decode(value){
 if(Array.isArray(value))return value.map(decode)
 if(!value||typeof value!=='object')return value
 if(value.expr?.Literal){
  const v=value.expr.Literal.Value
  if(typeof v!=='string')return undefined
  if(v.startsWith("'")&&v.endsWith("'"))return v.slice(1,-1).replace(/''/g,"'")
  if(v==='true'||v==='false')return v==='true'
  if(/^-?\d+(?:\.\d+)?(?:[dDlLmM])?$/.test(v))return Number(v.replace(/[dDlLmM]$/,''))
  return undefined
 }
 return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,decode(v)]))
}
export function readPaneObjects(objects={}){
 return Object.fromEntries(Object.entries(objects).filter(([key])=>key!=='semantica').map(([key,value])=>[key,Array.isArray(value)?decode(value.find(entry=>!entry.selector)?.properties || {}):decode(value)]))
}
export function effectivePaneObjects(spec={},objects={}){
 const author=readPaneObjects(spec.formatting || {}),manual=readPaneObjects(objects)
 return Object.fromEntries([...new Set([...Object.keys(author),...Object.keys(manual)])].map(key=>[key,{...author[key],...manual[key]}]))
}
export function paneValidationErrors(formatting){
 if(formatting===undefined)return []
 if(!formatting||typeof formatting!=='object'||Array.isArray(formatting))return [{path:'/formatting',message:'formatting must be an object',expected:'Object keyed by common formatting groups',suggestions:['Use the formatting contract in vilsem://docs/spec-format.']}]
 const errors=[]
 for(const [group,properties] of Object.entries(formatting)){
  const contract=PANE_GROUPS.find(g=>g.name===group),base='/formatting/'+group.replace(/~/g,'~0').replace(/\//g,'~1')
  if(!contract){errors.push({path:base,message:'Unknown formatting group',expected:{allowed:PANE_GROUPS.map(g=>g.name)},suggestions:['Use a documented common formatting group.']});continue}
  if(!properties||typeof properties!=='object'||Array.isArray(properties)){errors.push({path:base,message:'Formatting group must be an object',expected:'Property-value object',suggestions:['Supply only the overrides that should change.']});continue}
  for(const [name,value] of Object.entries(properties)){
   const field=contract.fields.find(f=>f.name===name),path=base+'/'+name.replace(/~/g,'~0').replace(/\//g,'~1')
   if(field?.type==='enum'&&!RENDER_MODES.some(mode=>mode.value===value)){errors.push({path,message:'Render mode must be auto, canvas or svg',expected:{allowed:RENDER_MODES.map(m=>m.value)},suggestions:['Use a supported render mode.']});continue}
   if(!field){errors.push({path,message:'Unknown formatting property',expected:{allowed:contract.fields.map(f=>f.name)},suggestions:['Use a supported property; arbitrary settings are never executed.']});continue}
   const valid=field.type==='enum'?RENDER_MODES.some(mode=>mode.value===value):field.type==='bool'?typeof value==='boolean':field.type==='number'?typeof value==='number'&&Number.isFinite(value):field.type==='text'?typeof value==='string'&&value.length<=2000:typeof colorValue(value)==='string'
   if(!valid)errors.push({path,message:'Invalid formatting value',expected:field.type,suggestions:[`Supply a ${field.type} value.`]})
   if(valid&&name==='format'&&value)try{createModelFormatter(value)}catch(error){errors.push({path,message:error.message,expected:'Supported model/Excel number format',suggestions:['Use a format such as0.00%, #,0 or$#,0.00.']})}
  }
 }
 return errors
}
const list=v=>v==null?[]:Array.isArray(v)?v:[v]
const setList=(out,key,original,values)=>{if(values.length)out[key]=Array.isArray(original)?values:values[0]}
const color=v=>typeof v==='string'?v:v?.solid?.color
const size=v=>typeof v==='number'&&Number.isFinite(v)?Math.min(200,Math.max(1,v)):undefined
function textStyle(p={}){return {...(p.fontFamily?{fontFamily:p.fontFamily}:{}),...(size(p.fontSize)!==undefined?{fontSize:size(p.fontSize)}:{}),...(color(p.color)?{color:color(p.color)}:{})}}
export function paneTitleConfig(config={},objects={}){
 const p=readPaneObjects(objects).title || {}
 return {...config,...(p.show!==undefined?{showTitle:p.show}:{}),...(p.text!==undefined?{title:p.text}:{}),...(p.fontFamily?{titleFontFamily:p.fontFamily}:{}),...(size(p.fontSize)?{titleFontSize:size(p.fontSize)}:{}),...(color(p.color)?{titleColor:color(p.color)}:{}),...(p.bold!==undefined?{titleFontWeight:p.bold?700:400}:{}),...(['left','center','right'].includes(p.alignment)?{titleAlign:p.alignment}:{})}
}
export function applyPaneFormatting(option,objects={},context={}){
 if(option?.baseOption||Array.isArray(option?.options)){
  const {baseOption,options:frames,...root}=option
  return {...applyPaneFormatting(root,objects,context),...(baseOption?{baseOption:applyPaneFormatting(baseOption,objects,context)}:{}),...(Array.isArray(frames)?{options:frames.map(frame=>applyPaneFormatting(inheritTimelineFrame(baseOption,frame),objects,context))}:{})}
 }
 const pane=readPaneObjects(objects),appearance=pane.appearance || {},out={...option}
 if(pane.motion?.enabled!==undefined)out.animation=pane.motion.enabled
 if(pane.motion?.enabled===false||pane.motion?.reduceMotion===true||context.reduceMotion===true)Object.assign(out,applyAnimation(out,null,{enabled:pane.motion?.enabled,reduceMotion:pane.motion?.reduceMotion===true||context.reduceMotion===true}))
 const color=appearance.backgroundColor?.solid?.color
 if(typeof color==='string'&&/^#[\da-f]{6}$/i.test(color)){
  const transparency=Math.min(100,Math.max(0,Number(appearance.transparency??100)))
  if(Number.isFinite(transparency))out.backgroundColor=transparency===100?'transparent':`rgba(${[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)).join(',')},${1-transparency/100})`
 }
 if(!Object.entries(pane).some(([key,value])=>key!=='appearance'&&value&&Object.keys(value).length))return out
 const typography=pane.typography||{},labels=pane.labels||{},lines=pane.lines||{}
 out.textStyle={...option.textStyle,...textStyle(typography)}
 const title=pane.title||{}
 if(!context.skipTitle&&Object.keys(title).length)setList(out,'title',option.title,list(option.title||{}).map(t=>({...t,...(title.show!==undefined?{show:title.show}:{}),...(title.text!==undefined?{text:title.text}:{}),...(['left','center','right'].includes(title.alignment)?{left:title.alignment}:{}),textStyle:{...t.textStyle,...textStyle(typography),...textStyle(title),...(title.bold!==undefined?{fontWeight:title.bold?'bold':'normal'}:{})}})))
 const legend=pane.legend||{}
 if(Object.keys(legend).length)setList(out,'legend',option.legend,list(option.legend||{}).map(l=>({...l,...(legend.show!==undefined?{show:legend.show}:{}),...(['left','right'].includes(legend.position)?{orient:'vertical',left:legend.position,top:'middle',bottom:undefined,right:undefined}:['top','bottom'].includes(legend.position)?{orient:'horizontal',left:'center',top:legend.position==='top'?0:undefined,bottom:legend.position==='bottom'?0:undefined,right:undefined}:{}),textStyle:{...l.textStyle,...textStyle(typography),...textStyle(legend)}})))
 const palette=typeof pane.seriesColors?.palette==='string'?pane.seriesColors.palette.split(',').map(s=>s.trim()).filter(s=>/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(s)):[]
 if(palette.length)out.color=palette
 if(option.series)out.series=list(option.series).map((s,i)=>{
  const label={...s.label,...textStyle(typography),...textStyle(labels),...(labels.show!==undefined?{show:labels.show}:{}),...(typeof labels.position==='string'&&labels.position?{position:labels.position}:{})}
  if(labels.format){
   const format=createModelFormatter(labels.format,{locale:context.locale}),original=s.label?.formatter?.vilsemOriginalFormatter || s.label?.formatter
   label.formatter=Object.assign(p=>original?.vilsemFormatter?original(p,format):format(Array.isArray(p.value)?p.value.at(-1):p.value),{vilsemOriginalFormatter:original})
  }
  if(label.rich)label.rich=Object.fromEntries(Object.entries(label.rich).map(([k,v])=>[k,{...v,...textStyle(labels)}]))
  const lineStyle={...s.lineStyle,...(size(lines.width)?{width:size(lines.width)}:{}),...(['solid','dashed','dotted'].includes(lines.style)?{type:lines.style}:{}),...(colorValue(lines.color)?{color:colorValue(lines.color)}:{})}
  let data=s.data
  if(Array.isArray(data))data=data.map((d,index)=>d&&typeof d==='object'&&!Array.isArray(d)?{...d,...(d.label&&typeof d.label==='object'&&!Array.isArray(d.label)?{label:{...d.label,...textStyle(labels),...(labels.show!==undefined?{show:labels.show}:{}),...(labels.format?{formatter:label.formatter}:{})}}:{}),...(palette.length&&['pie','sankey','graph','treemap','sunburst','funnel'].includes(s.type)?{itemStyle:{...d.itemStyle,color:palette[index%palette.length]}}:{})}:d)
  return {...s,label,lineStyle,data,...(palette.length?{itemStyle:{...s.itemStyle,color:palette[i%palette.length]}}:{})}
 })
 let primary=false
 for(const key of ['yAxis','xAxis'])setList(out,key,option[key],list(option[key]).map((a,i)=>{
  const category=a.type==='category',name=category?'categoryAxis':primary?'secondaryAxis':'primaryAxis'
  if(!category)primary=true
  const p=pane[name] || {},axis={...a,...(p.show!==undefined?{show:p.show}:{}),...(p.title!==undefined?{name:p.title}:{}),axisLabel:{...a.axisLabel,...textStyle(typography),...textStyle(p)},nameTextStyle:{...a.nameTextStyle,...(colorValue(p.titleColor)?{color:colorValue(p.titleColor)}:{}),...(size(p.titleSize)?{fontSize:size(p.titleSize)}:{})},splitLine:{...a.splitLine,...(p.gridlines!==undefined?{show:p.gridlines}:{}),lineStyle:{...a.splitLine?.lineStyle,...(colorValue(p.gridColor)?{color:colorValue(p.gridColor)}:{})}}}
  if(!category){for(const k of ['min','max']){const automatic=p[k==='min'?'autoMin':'autoMax'];if(automatic===true)delete axis[k];else if(typeof p[k]==='number'&&Number.isFinite(p[k]))axis[k]=p[k];else if(automatic===false)axis[k]=k==='min'?0:100}if(p.format)axis.axisLabel.formatter=createModelFormatter(p.format,{locale:context.locale})}
  return axis
 }))
 const border=pane.border||{}
 if(!context.skipBorder&&border.show&&Number.isFinite(context.width)&&Number.isFinite(context.height))out.graphic=[...list(option.graphic).filter(g=>g.id!=='vilsem-pane-border'),{id:'vilsem-pane-border',type:'rect',silent:true,z:10000,shape:{x:1,y:1,width:Math.max(0,context.width-2),height:Math.max(0,context.height-2),r:Math.min(100,Math.max(0,border.radius||0))},style:{fill:'transparent',stroke:colorValue(border.color)||'#cccccc',lineWidth:size(border.width)||1}}]
 return out
}
// Separate name avoids the background colour local used above.
const colorValue=color
