import { createModelFormatter, scopedMeasureFormat } from './modelFormatting.js'
import { slotCount } from '../templates/instantiate.js'
import { formatProvenance } from './formatProvenance.js'
import {inheritTimelineFrame} from '../templates/timeline.js'

export function applyModelFormats(option, spec, measures = [], options = {}) {
  if (!option) return option
  if(option.baseOption||Array.isArray(option.options)){
    const {baseOption,options:frames,...root}=option,sourceTree=options.sourceTree
    const formatted=applyModelFormats(root,spec,measures,{...options,sourceTree:undefined,seriesSources:sourceTree?.seriesSources??options.seriesSources})
    const inheritAxes=frame=>inheritTimelineFrame(baseOption,frame)
    return {...formatted,...(baseOption?{baseOption:applyModelFormats(baseOption,spec,measures,{...options,sourceTree:sourceTree?.baseOption,seriesSources:sourceTree?.baseOption?.seriesSources??[]})}:{}),...(Array.isArray(frames)?{options:frames.map((frame,i)=>applyModelFormats(inheritAxes(frame),spec,measures,{...options,sourceTree:sourceTree?.options?.[i],seriesSources:sourceTree?.options?.[i]?.seriesSources??[]}))}:{})}
  }
  // Explicit axis bounds can contain ordinary binary floating-point noise.
  // Use the same bounded General formatter as model values when no author or
  // model format exists; never infer a percentage from a fractional value.
  const general=createModelFormatter(undefined,options)
  const base={...option}
  for(const key of ['xAxis','yAxis'])if(option[key]) {
    const axes=Array.isArray(option[key])?option[key]:[option[key]]
    const formatted=axes.map(axis=>axis.type==='value'&&axis.axisLabel?.formatter==null
      ? {...axis,axisLabel:{...axis.axisLabel,formatter:general}} : axis)
    base[key]=Array.isArray(option[key])?formatted:formatted[0]
  }
  option=base
  if (!Array.isArray(measures) || !measures.length) return option
  const formats = measures.map(m => scopedMeasureFormat(spec,m.name) ?? m.formatString ?? m.format)
  if (!formats.some(f=>typeof f==='string'&&f.length)) return option
  const formatters = formats.map((f,i)=>Object.assign(createModelFormatter(f,options),{vilsemMeasureName:measures[i].name}))
  const slots=new Map();let offset=0
  for(const [name,slot] of Object.entries(spec.template?.slots || {}))if(slot.kind==='measure'){slots.set(name,offset);offset+=slotCount(slot.count)}
  const rawSeries=spec.template?.template?.series
  const sources=options.seriesSources || (Array.isArray(rawSeries)?rawSeries:rawSeries?[rawSeries]:[])
  const provenance=formatProvenance(spec.template,slots)
  const seriesFormats=[]
  const axesOf=(key,index)=>Array.isArray(option[key])?option[key][index || 0]:option[key]
  const explicitAffixes=!spec.template && (spec.config?.prefix || spec.config?.suffix)
  const wrap=(original,format,choose)=>Object.assign(p=>{
    const selected=choose?.(p) || format
    if(original?.vilsemFormatter)return original(p,selected)
    if(explicitAffixes && typeof original==='function')return original(p)
    const raw=p && typeof p==='object' ? p.value : p
    return selected(Array.isArray(raw)?raw[selected.vilsemValueIndex ?? raw.length-1]:raw)
  },{vilsemOriginalFormatter:original})
  const series=(Array.isArray(option.series)?option.series:[]).map((s,i)=>{
    let index=Math.min(i,formatters.length-1),component,tupleUnits,axisUnits={},directBinding=true
    if(spec.template) {
      const source=provenance(sources[i])
      if(source?.index==null || !formatters[source.index])return s
      index=source.index;directBinding=source.direct
      const projection=source.projection
      if(projection==='points'){
        tupleUnits=source.tupleUnits
        component=tupleUnits.findIndex(unit=>unit!=null)
        if(s.type!=='parallel')axisUnits={xAxis:tupleUnits[0]==null?[]:[tupleUnits[0]],yAxis:tupleUnits[1]==null?[]:[tupleUnits[1]]}
      }
      else if(projection==='pairs'){component=1;tupleUnits=[null,index];axisUnits={yAxis:[index]}}
      else if(projection==='pairsSwapped'){component=0;tupleUnits=[index,null];axisUnits={xAxis:[index]}}
      else if(projection==='matrix'){component=2;tupleUnits=[null,null,index]}
      else if(projection!=='pieData' && projection!=='radar') {
        const horizontal=axesOf('yAxis',s.yAxisIndex)?.type==='category' && axesOf('xAxis',s.xAxisIndex)?.type==='value'
        axisUnits=horizontal?{xAxis:[index]}:{yAxis:[index]}
      }
    } else if(['scatter','bubble'].includes(spec.type)) {
      index=0;component=1;tupleUnits=[0,formatters.length>1?1:0,formatters.length>2?2:null]
      axisUnits={xAxis:[0],yAxis:[formatters.length>1?1:0]}
    } else if(spec.type==='slope') {
      index=0;axisUnits={yAxis:[0,Math.min(1,formatters.length-1)]}
    } else if(spec.type==='lollipop') {
      index=0
      const horizontal=spec.config?.orientation!=='vertical'
      component=i===1?(horizontal?0:1):undefined
      tupleUnits=i===1?(horizontal?[0,null]:[null,0]):undefined
      axisUnits=horizontal?{xAxis:[0]}:{yAxis:[0]}
    } else if(['pie','donut','treemap','radar','gauge'].includes(spec.type))index=0
    else {
      const horizontal=axesOf('yAxis',s.yAxisIndex)?.type==='category' && axesOf('xAxis',s.xAxisIndex)?.type==='value'
      axisUnits=horizontal?{xAxis:[index]}:{yAxis:[index]}
    }
    seriesFormats[i]={index,string:formats[index],axisUnits,tupleUnits}
    // A General primary measure must not suppress a formatted secondary tuple
    // coordinate. Its trusted formatter already supplies a bounded default.
    const format=Object.assign(value=>formatters[index](value),{
      vilsemMeasureName:measures[index].name,vilsemValueIndex:component,vilsemDirectBinding:directBinding,
      vilsemTupleFormatters:tupleUnits?.map(unit=>unit==null?null:formatters[unit]),
      vilsemTupleFields:tupleUnits?.map(unit=>unit==null?null:{name:measures[unit].name,format:formatters[unit]}),
    })
    const choose=spec.type==='slope' && !spec.template ? p=>formatters[p?.dataIndex===1?Math.min(1,formatters.length-1):0] : undefined
    const label={...s.label,formatter:wrap(s.label?.formatter,format,choose)}
    const tooltip={...s.tooltip,valueFormatter:format}
    const original=s.tooltip?.formatter || option.tooltip?.formatter
    if(original?.vilsemFormatter)tooltip.formatter=p=>original(p,format)
    const data=Array.isArray(s.data)?s.data.map(d=>d&&typeof d==='object'&&!Array.isArray(d)&&d.label&&typeof d.label==='object'&&!Array.isArray(d.label)?{...d,label:{...d.label,formatter:wrap(d.label.formatter || s.label?.formatter,format,choose)}}:d):s.data
    const detail=s.type==='gauge' && s.detail ? {...s.detail,formatter:wrap(s.detail.formatter,format)} : s.detail
    const axisLabel=s.type==='gauge' && s.axisLabel?.formatter?.vilsemFormatter ? {...s.axisLabel,formatter:wrap(s.axisLabel.formatter,format)} : s.axisLabel
    return {...s,label,tooltip,data,...(detail?{detail}:{}),...(axisLabel?{axisLabel}:{})}
  })
  const out={...option,series}
  if(option.parallelAxis) {
    const axes=Array.isArray(option.parallelAxis)?option.parallelAxis:[option.parallelAxis]
    const formatted=axes.map((axis,dim)=>{
      if(axis.type==='category')return axis
      const units=seriesFormats.flatMap((entry,i)=>series[i].type==='parallel' && entry?.tupleUnits?.[axis.dim ?? dim]!=null?[entry.tupleUnits[axis.dim ?? dim]]:[])
      return units.length && units.every(unit=>formats[unit] && formats[unit]===formats[units[0]])
        ? {...axis,axisLabel:{...axis.axisLabel,formatter:formatters[units[0]]}}:axis
    })
    out.parallelAxis=Array.isArray(option.parallelAxis)?formatted:formatted[0]
  }
  for(const key of ['xAxis','yAxis'])if(option[key]) {
    const axes=Array.isArray(option[key])?option[key]:[option[key]]
    const formatted=axes.map((axis,axisIndex)=>{
      if(axis.type!=='value'&&axis.type!=null)return axis
      if(!spec.template && key==='yAxis' && axisIndex===1 && (spec.config?.secondaryAxisPrefix || spec.config?.secondaryAxisSuffix))return axis
      const matching=seriesFormats.flatMap((entry,i)=>entry && (series[i][key+'Index']||0)===axisIndex ? (entry.axisUnits[key] || []) : [])
      if(!matching.length || matching.some(index=>!formats[index]) || new Set(matching.map(index=>formats[index])).size!==1)return axis
      return {...axis,axisLabel:{...axis.axisLabel,formatter:formatters[matching[0]]}}
    })
    out[key]=Array.isArray(option[key])?formatted:formatted[0]
  }
  // The centre is an aggregate or the original radial-progress value, not the
  // clamped arc remainder. Keep the composition's layout and explicit affixes.
  if(!spec.template && ['pie','donut'].includes(spec.type) && out.title && formats[0] && !explicitAffixes && Array.isArray(options.rows)) {
    const rows=options.rows
    const value=rows.length===1 && rows[0]._cat===undefined ? Number(rows[0]._val ?? 0) : rows.reduce((sum,row)=>sum+Math.abs(Number(row._val ?? 0)),0)
    out.title={...out.title,text:formatters[0](value)}
  }
  return reserveModelBarLabelSpace(out,spec,options)
}

// containLabel protects axis text, not series data labels. Model currency/date
// strings can be wider than the composition's compact-number gutter. Measure
// the final plain label in the host/SSR engine without changing the data domain.
function reserveModelBarLabelSpace(option,spec,options) {
  if(spec.template || !['bar','column','stacked_bar','grouped_bar'].includes(spec.type))return option
  const x=Array.isArray(option.xAxis)?option.xAxis[0]:option.xAxis
  const y=Array.isArray(option.yAxis)?option.yAxis[0]:option.yAxis
  if(x?.type!=='value' || y?.type!=='category')return option
  const grids=Array.isArray(option.grid)?option.grid:[option.grid]
  if(!grids[0] || typeof grids[0].right!=='number')return option
  const budget=Number.isFinite(options.width)&&options.width>0 ? Math.max(16,options.width*.45) : Infinity
  let needed=0
  const fit=(label,datum,index)=>{
    if(label?.show!==true || label.position!=='right')return label
    const value=datum && typeof datum==='object' ? datum.value : datum
    const text=typeof label.formatter==='function' ? label.formatter({value,data:datum,dataIndex:index,name:y.data?.[index]}) : value
    if(typeof text!=='string' || /[{}]/.test(text))return label
    const size=Number(label.fontSize || option.textStyle?.fontSize || 10)
    const font=`${label.fontStyle || 'normal'} ${label.fontWeight || 'normal'} ${size}px ${label.fontFamily || option.textStyle?.fontFamily || 'sans-serif'}`
    const measured=options.measureText?.(text,font)
    const width=Number.isFinite(measured)?measured:[...text].length*size
    const distance=Number(label.distance ?? 5)
    needed=Math.max(needed,width+distance+8)
    return width+distance+8>budget ? {...label,width:Math.max(1,budget-distance-8),overflow:'truncate'} : label
  }
  const series=option.series.map(s=>{
    if(s.type!=='bar' || !Array.isArray(s.data))return s
    const data=s.data.map((d,i)=>{
      const label=fit({...s.label,...(d?.label || {})},d,i)
      return label?.overflow==='truncate' ? (d && typeof d==='object' ? {...d,label} : {value:d,label}) : d
    })
    return {...s,data}
  })
  if(!needed)return option
  const grid={...grids[0],right:Math.max(grids[0].right,Math.min(needed,budget))}
  return {...option,series,grid:Array.isArray(option.grid)?[grid,...grids.slice(1)]:grid}
}
