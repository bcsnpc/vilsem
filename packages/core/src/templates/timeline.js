// Visit only ECharts option containers, never arbitrary model data objects.
export function mapTimelineSeries(option,mapper,path=''){
 if(!option||typeof option!=='object'||Array.isArray(option))throw Error('Timeline option must be an object')
 const out={...option}
 if(option.series)out.series=Array.isArray(option.series)?option.series.map((s,i)=>mapper(s,`${path}/series/${i}`)):mapper(option.series,`${path}/series/0`)
 if(option.baseOption)out.baseOption=mapTimelineSeries(option.baseOption,mapper,path+'/baseOption')
 if(option.options){if(!Array.isArray(option.options)||option.options.length>120)throw Error('Timeline options require at most120 frames');out.options=option.options.map((frame,i)=>mapTimelineSeries(frame,mapper,`${path}/options/${i}`))}
 return out
}
export function collectTimelineSeries(option){const series=[];mapTimelineSeries(option,s=>{series.push(s);return s});return series}
export function inheritTimelineFrame(base,frame){
 const result={...frame};for(const key of ['xAxis','yAxis','parallelAxis'])if(base?.[key]){const axes=Array.isArray(base[key])?base[key]:[base[key]],own=frame[key]==null?[]:Array.isArray(frame[key])?frame[key]:[frame[key]],merged=axes.map((axis,i)=>({...axis,...own[i]}));for(let i=axes.length;i<own.length;i++)merged.push(own[i]);result[key]=Array.isArray(base[key])||Array.isArray(frame[key])?merged:merged[0]}
 if(!result.tooltip&&base?.tooltip)result.tooltip=base.tooltip;return result
}
export function preserveTimelineIndex(option,index){
 if(!Number.isInteger(index)||index<0||index>=option.options?.length)return option
 const set=timeline=>Array.isArray(timeline)?timeline.map(t=>({...t,currentIndex:index})):{...timeline,currentIndex:index}
 return option.baseOption?{...option,baseOption:{...option.baseOption,timeline:set(option.baseOption.timeline)}}:{...option,timeline:set(option.timeline)}
}
