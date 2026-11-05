// Templates have text tooltips, not a model-data-to-HTML execution surface.
// Compositions keep their separately escaped, trusted tooltip implementation.
export function applyTemplateTooltipPolicy(option,path='/template/template'){
 if(!option||typeof option!=='object')return option
 const out={...option}
 const tooltip=(value,p)=>{
  if(Array.isArray(value))return value.map((t,i)=>tooltip(t,p+'/'+i))
  if(!value||typeof value!=='object')return value
  if(value.renderMode!=null&&!['richText','auto'].includes(value.renderMode))throw Error(p+'/renderMode: templates support text-only richText tooltips; HTML rendering is not allowed')
  return {...value,renderMode:'richText'}
 }
 if(out.tooltip)out.tooltip=tooltip(out.tooltip,path+'/tooltip')
 if(Array.isArray(out.series))out.series=out.series.map((s,i)=>s?.tooltip?{...s,tooltip:tooltip(s.tooltip,path+'/series/'+i+'/tooltip')}:s)
 if(out.baseOption)out.baseOption=applyTemplateTooltipPolicy(out.baseOption,path+'/baseOption')
 if(Array.isArray(out.options))out.options=out.options.map((o,i)=>applyTemplateTooltipPolicy(o,path+'/options/'+i))
 return out
}
