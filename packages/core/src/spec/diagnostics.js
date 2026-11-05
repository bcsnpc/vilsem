import { resolveVisualSpec } from './resolve.js'
import { validateTemplate, instantiateVisual, buildThemeContext } from '../templates/instantiate.js'
import { getThemeTokens } from '../../dist/theme.js'
import types from './primitiveVisualTypes.json' with {type:'json'}
import {paneValidationErrors} from '../shared/paneFormatting.js'

const ptr=key=>String(key).replace(/~/g,'~0').replace(/\//g,'~1')
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)
const diagnostic=(path,message,expected,suggestion,correctedSnippet)=>({path,message,expected,suggestions:[suggestion],...(correctedSnippet===undefined?{}:{correctedSnippet})})
const pathNodes=(node,path='',out=[],depth=0)=>{
 if(depth>64)return out
 out.push({path,node})
 if(node&&typeof node==='object')for(const [key,value] of Object.entries(node))pathNodes(value,`${path}/${ptr(key)}`,out,depth+1)
 return out
}

/** Structured diagnostics wrap the SAME resolver/grammar used by the renderer.
 * They never repair a spec silently or evaluate supplied source code. */
export function validateSpecDetailed(spec){
 const errors=[]
 const add=(...args)=>errors.push(diagnostic(...args))
 if(!object(spec))return {valid:false,errors:[diagnostic('','spec must be an object','JSON object','Supply a composition or template spec.',{type:'bar'})],suggestions:['Use vilsem://docs/spec-format.']}
 errors.push(...paneValidationErrors(spec.formatting))
 if(spec.version!=null&&spec.version!==1)add('/version',`Unsupported spec version ${spec.version}`,{allowed:[1]},'Use the current renderer schema version.',1)
 if(spec.specVersion!=null&&!['0.1','0.2','0.3','0.4','0.5','0.6'].includes(spec.specVersion))add('/specVersion','Unsupported specVersion',{allowed:['0.1','0.2','0.3','0.4','0.5','0.6']},'Use a compatible reader; do not relabel a future spec to bypass validation.')
 if(spec.config!=null&&!object(spec.config))add('/config','config must be an object','JSON object','Replace the configuration with an object.',{})
 if(!spec.template&&(!types.includes(spec.type)))add('/type',`Visual type ${String(spec.type)} is not supported`,{allowed:types},'Choose a shipped composition type or supply a declarative template.')
 if(spec.template){
  const t=spec.template
  if(!object(t))add('/template','template must be an object','JSON object','Read the template skeleton in vilsem://docs/spec-format.')
  else{
   if(!object(t.meta)||typeof t.meta.id!=='string'||!t.meta.id)add('/template/meta/id','meta.id is required','Non-empty template identifier','Provide a stable identifier.', 'my-visual')
   if(t.meta?.formatVersion!=null&&![1,2,3].includes(t.meta.formatVersion))add('/template/meta/formatVersion','Unsupported template format version',{allowed:[1,2,3]},'Use a shipped template format version.',3)
   if(t.slots!=null&&!object(t.slots))add('/template/slots','slots must be an object','Object keyed by slot names','Declare dimension/time and measure slots.',{category:{kind:'dimension'},value:{kind:'measure'}})
   else for(const [name,slot] of Object.entries(t.slots||{}))if(!object(slot)||!['measure','dimension','time'].includes(slot.kind))add(`/template/slots/${ptr(name)}/kind`,'Invalid slot kind',{allowed:['measure','dimension','time']},'Choose the role this field actually represents.')
   if(!object(t.template))add('/template/template','ECharts skeleton is required','ECharts option object','Add a declarative option skeleton.',{series:[]})
   if(t.params!=null&&!Array.isArray(t.params))add('/template/params','params must be an array','Array of parameter declarations','Use named parameter declarations.',[])
   if(t.transforms!=null&&!Array.isArray(t.transforms))add('/template/transforms','transforms must be an array','Array of bounded transform definitions','Use named, ordered transforms.',[])
  }
 }
 const nodes=pathNodes(spec)
 // Locate a native validator's message in the original JSON rather than
 // inventing a path into the resolved ECharts option.
 function locate(message){
  const quoted=[...message.matchAll(/["`]([^"`]+)["`]/g)].map(m=>m[1])
  for(const token of quoted){const found=nodes.find(n=>n.node===token);if(found)return found.path}
  const formatter=nodes.find(n=>n.path.endsWith('/formatterTemplate')&&typeof n.node==='string'&&message.includes('formatter')&&[...n.node.matchAll(/\{([^{}]+)\}/g)].some(m=>message.includes(m[1])))
  if(formatter)return formatter.path
  const transform=quoted.map(name=>(spec.template?.transforms||[]).findIndex(t=>t?.as===name)).find(i=>i>=0)
  if(transform!==undefined)return `/template/transforms/${transform}`
  for(const key of ['renderItem','formatterEmptyText','__proto__','constructor','prototype'])if(message.includes(key)){const n=nodes.find(n=>n.path.endsWith('/'+ptr(key)));if(n)return n.path}
  if(message.includes('measure slot')||message.includes('dimension/time slots'))return '/template/slots'
  if(message.includes('measure'))return '/measures'
  return spec.template?'/template':'/type'
 }
 function convert(message){
  const path=locate(message)
  if(message.includes('formatter'))return diagnostic(path,message,'{value}, {value:thousands}, {value:percent}, {name}, {seriesName}, or a documented formatter token','Replace the unrecognized formatter with a supported token.','{value}')
  if(message.includes('token'))return diagnostic(path,message,'A declared plain $slot, $calc, $param, $theme or scoped $item path','Use a declared name and documented accessor; use a bounded transform for calculations.')
  if(message.includes('renderItem')||message.includes('executable')||message.includes('unsafe'))return diagnostic(path,message,'Declarative JSON without executable callbacks or prototype keys','Remove executable/prototype content; use shipped declarative operations.')
  return diagnostic(path,message,'The supported spec-format grammar','Read the named field contract in vilsem://docs/spec-format and correct this node.')
 }
 let option
 if(!errors.length)try{
  if(spec.template){const checked=validateTemplate(spec.template);errors.push(...checked.errors.map(convert))}
  if(!errors.length){
   option=resolveVisualSpec(spec)
   if(spec.template){
    const resolved=instantiateVisual({template:spec.template,rows:[],params:spec.params||{},theme:buildThemeContext(getThemeTokens('light'))})
    errors.push(...resolved.warnings.filter(w=>/token .*resolved to undefined/.test(w)&&!/[.]\d+(?:[.]|\b)/.test(w)).map(convert))
   }
  }
 }catch(error){errors.push(...String(error.message).split('\n').map(convert))}
 return {valid:errors.length===0,...(!errors.length?{option}:{}),errors,suggestions:[...new Set(errors.flatMap(e=>e.suggestions))]}
}
