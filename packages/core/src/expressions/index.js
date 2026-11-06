// A closed JSON grammar, not a JavaScript sandbox. The calling agent supplies
// data; only this trusted interpreter invokes the small ECharts API allowlist.
import {createModelFormatter} from '../shared/modelFormatting.js'
import {isJsonDataContainer} from '../spec/jsonBoundary.js'

export const EXPRESSION_LIMITS=Object.freeze({depth:32,nodes:16000,elementsPerItem:2000,totalElements:50000,stepsPerItem:50000,totalSteps:2000000,stringLength:8192,textLength:2048,pathLength:8192,pathCommands:512,arrayLength:256,coordinate:1000000})
const blocked=new Set(['__proto__','prototype','constructor'])
const own=(o,k)=>Object.hasOwn(o,k)
const scalar=['number','string','boolean','null','unknown']
const signatures={
 literal:[1,1,'unknown'],
 add:[2,16,'number'],sub:[2,2,'number'],mul:[2,16,'number'],div:[2,2,'number'],mod:[2,2,'number'],pow:[2,2,'number'],neg:[1,1,'number'],abs:[1,1,'number'],sqrt:[1,1,'number'],floor:[1,1,'number'],ceil:[1,1,'number'],round:[1,1,'number'],sin:[1,1,'number'],cos:[1,1,'number'],min:[1,16,'number'],max:[1,16,'number'],clamp:[3,3,'number'],
 eq:[2,2,'boolean'],ne:[2,2,'boolean'],lt:[2,2,'boolean'],lte:[2,2,'boolean'],gt:[2,2,'boolean'],gte:[2,2,'boolean'],and:[2,16,'boolean'],or:[2,16,'boolean'],not:[1,1,'boolean'],if:[3,3,'unknown'],coalesce:[2,8,'unknown'],
 concat:[1,32,'string'],string:[1,1,'string'],number:[1,1,'number'],length:[1,1,'number'],at:[2,2,'unknown'],format:[2,2,'string'],formatNumber:[2,2,'string'],formatDate:[2,2,'string'],colorInterpolate:[3,3,'string'],colorScale:[4,4,'string'],
 dataIndex:[0,0,'number'],viewportWidth:[0,0,'number'],viewportHeight:[0,0,'number'],value:[1,1,'unknown'],coord:[1,1,'array'],size:[1,2,'array'],visual:[1,1,'string'],style:[0,0,'style'],
}
const shapes={rect:{x:'number',y:'number',width:'number',height:'number',r:'number'},circle:{cx:'number',cy:'number',r:'number'},polygon:{points:'array'},polyline:{points:'array',smooth:'number'},path:{pathData:'string',x:'number',y:'number',width:'number',height:'number'},text:{},group:{}}
const styles={fill:'string',stroke:'string',lineWidth:'number',strokeNoScale:'boolean',opacity:'number',fontFamily:'string',fontSize:'number',fontWeight:'scalar',text:'scalar',x:'number',y:'number',width:'number',height:'number',lineHeight:'number',align:'string',verticalAlign:'string',overflow:'string',backgroundColor:'string',lineDash:'array',lineCap:'string',lineJoin:'string'}
const common={x:'number',y:'number',scaleX:'number',scaleY:'number',originX:'number',originY:'number',rotation:'number',z2:'number',silent:'boolean',invisible:'boolean',ignore:'boolean',id:'scalar',name:'string',when:'boolean'}
const pointer=k=>String(k).replace(/~/g,'~0').replace(/\//g,'~1')
const error=(path,message,expected)=>({path,message,expected,suggestions:['Use the bounded grammar in vilsem://docs/expression-language.']})
function plain(value){return !Array.isArray(value)&&isJsonDataContainer(value)}
function jsonTree(value,path){
 const errors=[],seen=new WeakSet();let nodes=0,characters=0
 function visit(v,p,depth){
  if(errors.length)return
  if(++nodes>EXPRESSION_LIMITS.nodes||depth>EXPRESSION_LIMITS.depth){errors.push(error(p,'JSON AST size/depth budget exceeded','Bounded JSON tree'));return}
  if(v===null||typeof v==='boolean')return
  if(typeof v==='number'){if(!Number.isFinite(v))errors.push(error(p,'JSON numbers must be finite','Finite number'));return}
  if(typeof v==='string'){characters+=v.length;if(v.length>EXPRESSION_LIMITS.stringLength||characters>1048576)errors.push(error(p,'JSON AST string budget exceeded','Bounded strings'));return}
  if(!v||typeof v!=='object'){errors.push(error(p,'Only JSON data is accepted','JSON value'));return}
  if(seen.has(v)){errors.push(error(p,'Cyclic references are not a JSON tree','JSON tree'));return}seen.add(v)
  if(!isJsonDataContainer(v)){errors.push(error(p,'Non-JSON prototype','Plain JSON data'));return}
  if(Array.isArray(v)&&v.length>2000){errors.push(error(p,'JSON array budget exceeded',2000));return}
  for(const k of Object.keys(v)){
   characters+=k.length
   if(k.length>128||characters>1048576){errors.push(error(p,'JSON key/string budget exceeded','Bounded JSON keys and strings'));return}
   if(blocked.has(k)||Array.isArray(v)&&(!/^\d+$/.test(k)||Number(k)>=v.length)){errors.push(error(p+'/'+pointer(k),'Prototype/custom array members are forbidden','JSON data'));return}
   const descriptor=Object.getOwnPropertyDescriptor(v,k)
   if(!descriptor||descriptor.get||descriptor.set){errors.push(error(p+'/'+pointer(k),'Accessors are forbidden','JSON value'));return}
   visit(descriptor.value,p+'/'+pointer(k),depth+1)
   if(errors.length)return
  }
  seen.delete(v)
 }
 visit(value,path,0);return errors
}

export function validateExpression(ast,{path='/renderItem',resolved=false}={}){
 const jsonErrors=jsonTree(ast,path)
 if(jsonErrors.length)return {valid:false,errors:jsonErrors,maxElements:0,estimatedSteps:0,nodes:0}
 const errors=[];let nodes=0,elements=0,cost=0
 const fail=(p,m,e)=>{if(errors.length<50)errors.push(error(p,m,e))}
 const guard=(v,p,depth)=>{
  if(++nodes>EXPRESSION_LIMITS.nodes){fail(p,'Expression AST node limit exceeded',EXPRESSION_LIMITS.nodes);return false}
  cost++
  if(depth>EXPRESSION_LIMITS.depth){fail(p,'Expression nesting limit exceeded',EXPRESSION_LIMITS.depth);return false}
  if(v&&typeof v==='object'){
   if(!Array.isArray(v)&&!plain(v)){fail(p,'Non-JSON object prototype','Plain JSON object');return false}
   for(const k of Object.keys(v)){if(blocked.has(k)){fail(p+'/'+pointer(k),'Prototype paths are forbidden','JSON data keys');return false}const d=Object.getOwnPropertyDescriptor(v,k);if(d?.get||d?.set){fail(p+'/'+pointer(k),'Accessors are forbidden','JSON data values');return false}}
  }
  return errors.length<50&&nodes<=EXPRESSION_LIMITS.nodes
 }
 const expect=(type,wanted,p)=>{if(type!=='unknown'&&!(wanted==='scalar'?scalar.includes(type):wanted===type))fail(p,`Expected ${wanted}, received ${type}`,wanted)}
 function expr(v,p,depth){
  if(!guard(v,p,depth))return 'unknown'
  if(v===null)return 'null'
  if(typeof v==='number'){if(!Number.isFinite(v))fail(p,'Numbers must be finite','Finite number');return 'number'}
  if(typeof v==='boolean')return 'boolean'
  if(typeof v==='string'){
   if(v.length>EXPRESSION_LIMITS.stringLength)fail(p,'String limit exceeded',EXPRESSION_LIMITS.stringLength)
   cost+=Math.ceil(v.length/32)
   if(v.startsWith('$')){
    if(resolved||!/^\$(param|theme)(\.[A-Za-z0-9_]+)+$/.test(v)||v.split('.').some(s=>blocked.has(s)))fail(p,'Invalid/unresolved expression token','Declared $param or $theme path')
    return 'unknown'
   }
   return 'string'
  }
  if(Array.isArray(v)){if(v.length>EXPRESSION_LIMITS.arrayLength)fail(p,'Array limit exceeded',EXPRESSION_LIMITS.arrayLength);for(let i=0;i<Math.min(v.length,EXPRESSION_LIMITS.arrayLength);i++)expr(v[i],p+'/'+i,depth+1);return 'array'}
  if(!v||typeof v!=='object'){fail(p,'Executable/undefined values are not expressions','JSON literal or operation');return 'unknown'}
  for(const k of Object.keys(v))if(!['op','args'].includes(k))fail(p+'/'+pointer(k),'Unknown expression member',{allowed:['op','args']})
  const signature=own(v,'op')&&typeof v.op==='string'&&own(signatures,v.op)?signatures[v.op]:null
  if(!signature){fail(p+'/op',`Unknown operation ${typeof v.op==='string'?v.op:typeof v.op}`,{allowed:Object.keys(signatures)});return 'unknown'}
  const args=v.args??[]
  if(!Array.isArray(args)){fail(p+'/args','args must be an array','Array');return signature[2]}
  if(args.length<signature[0]||args.length>signature[1])fail(p+'/args','Wrong operation arity',`${signature[0]}..${signature[1]} arguments`)
  if(v.op==='literal'){
   const value=args[0],type=value===null?'null':typeof value
   if(!['number','boolean','string','null'].includes(type))fail(p+'/args/0','literal only wraps a scalar','JSON scalar')
   cost+=1+(typeof value==='string'?Math.ceil(value.length/32):0)
   return type
  }
  const types=args.slice(0,32).map((a,i)=>expr(a,p+'/args/'+i,depth+1)),op=v.op
  const numeric=['add','sub','mul','div','mod','pow','neg','abs','sqrt','floor','ceil','round','sin','cos','min','max','clamp','lt','lte','gt','gte']
  if(numeric.includes(op))types.forEach((t,i)=>expect(t,'number',p+'/args/'+i))
  if(['and','or','not'].includes(op))types.forEach((t,i)=>expect(t,'boolean',p+'/args/'+i))
  if(['eq','ne','concat','string','number'].includes(op))types.forEach((t,i)=>expect(t,'scalar',p+'/args/'+i))
  if(op==='if'){
   expect(types[0],'boolean',p+'/args/0');const distinct=[...new Set(types.slice(1).filter(t=>!['null','unknown'].includes(t)))];if(distinct.length>1)fail(p+'/args','Conditional branches must have compatible types','Same type, optionally null');return distinct[0]||'unknown'
  }
  if(op==='coalesce'){const distinct=[...new Set(types.filter(t=>!['null','unknown'].includes(t)))];if(distinct.length>1)fail(p+'/args','coalesce requires compatible types','Same type, optionally null');return distinct[0]||'unknown'}
  if(op==='value'){expect(types[0],'number',p+'/args/0');if(typeof args[0]==='number'&&(!Number.isInteger(args[0])||args[0]<0||args[0]>255))fail(p+'/args/0','Invalid data dimension','Integer0..255')}
  if(['coord','size'].includes(op)){types.forEach((t,i)=>expect(t,'array',p+'/args/'+i));for(const [i,pair] of args.entries())if(Array.isArray(pair)&&pair.length!==2)fail(p+'/args/'+i,'Coordinate/size needs a pair','[x,y]')}
  if(op==='visual'&&args[0]!=='color')fail(p+'/args/0','Only api.visual(color) is exposed','"color"')
  if(op==='at'){expect(types[0],'array',p+'/args/0');expect(types[1],'number',p+'/args/1');if(typeof args[1]==='number'&&(!Number.isInteger(args[1])||args[1]<0||args[1]>255))fail(p+'/args/1','Array indexes must be bounded integers','Integer0..255');if(Array.isArray(args[0])&&typeof args[1]==='number')return typeof args[0][args[1]]==='number'?'number':'unknown'}
  if(op==='length'&&!['array','string','unknown'].includes(types[0]))fail(p+'/args/0','length requires an array or string','Array/string')
  if(['format','formatNumber','formatDate'].includes(op)){expect(types[0],'scalar',p+'/args/0');expect(types[1],'string',p+'/args/1');const pattern=args[1]?.op==='literal'?args[1].args?.[0]:args[1];if(typeof pattern!=='string'||pattern.length>200)fail(p+'/args/1','Format must be a bounded literal/parameter string','Format string, max200characters')}
  if(op==='colorInterpolate'){expect(types[0],'string',p+'/args/0');expect(types[1],'string',p+'/args/1');expect(types[2],'number',p+'/args/2')}
  if(op==='colorScale'){types.slice(0,3).forEach((t,i)=>expect(t,'number',p+'/args/'+i));expect(types[3],'array',p+'/args/3')}
  return signature[2]
 }
 function element(v,p,depth){
  if(!guard(v,p,depth))return
  if(!v||typeof v!=='object'||Array.isArray(v)||!own(v,'type')||typeof v.type!=='string'||!own(shapes,v.type)){fail(p+'/type','Unknown graphic element',{allowed:Object.keys(shapes)});return}
  if(++elements>EXPRESSION_LIMITS.elementsPerItem){fail(p,'Per-item graphic element limit exceeded',EXPRESSION_LIMITS.elementsPerItem);return}
  if(v.type==='path')cost+=EXPRESSION_LIMITS.pathCommands
  if(v.type==='text')cost+=Math.ceil(EXPRESSION_LIMITS.textLength/32)
  const allowed=['type','shape','style','children','clipPath','role',...Object.keys(common)]
  for(const k of Object.keys(v))if(!allowed.includes(k))fail(p+'/'+pointer(k),'Unknown graphic property',{allowed})
  if(v.role!==undefined&&!['label','title','annotation','mark'].includes(v.role))fail(p+'/role','Unknown formatting role',{allowed:['label','title','annotation','mark']})
  for(const [k,type] of Object.entries(common))if(own(v,k))expect(expr(v[k],p+'/'+k,depth+1),type,p+'/'+k)
  if(v.shape!==undefined){
   if(!v.shape||typeof v.shape!=='object'||Array.isArray(v.shape)||!guard(v.shape,p+'/shape',depth+1))fail(p+'/shape','shape must be a JSON object','Shape property object')
   else for(const [k,value] of Object.entries(v.shape)){const type=shapes[v.type][k];if(!type){fail(p+'/shape/'+pointer(k),'Unknown shape property',{allowed:Object.keys(shapes[v.type])});continue}expect(expr(value,p+'/shape/'+pointer(k),depth+2),type,p+'/shape/'+pointer(k));if(typeof value==='number'&&(Math.abs(value)>EXPRESSION_LIMITS.coordinate||['width','height','r'].includes(k)&&value<0))fail(p+'/shape/'+pointer(k),'Invalid literal shape bounds','Finite nonnegative sizes and bounded coordinates');if(k==='pathData'&&typeof value==='string'&&!value.startsWith('$'))try{pathData(value,p+'/shape/pathData')}catch(e){fail(p+'/shape/pathData',e.message,'Bounded SVG path commands/numbers')}}
  }
  const required={rect:['x','y','width','height'],circle:['cx','cy','r'],polygon:['points'],polyline:['points'],path:['pathData']}[v.type]||[]
  for(const key of required)if(!v.shape||!own(v.shape,key))fail(p+'/shape/'+key,'Required shape property is missing',shapes[v.type][key])
  if(v.style!==undefined){
   if(v.style?.op){expect(expr(v.style,p+'/style',depth+1),'style',p+'/style')}
   else if(!v.style||typeof v.style!=='object'||Array.isArray(v.style)||!guard(v.style,p+'/style',depth+1))fail(p+'/style','style must be an object or api.style expression','Style object')
   else for(const [k,value] of Object.entries(v.style)){const type=k==='base'?'style':styles[k];if(!type){fail(p+'/style/'+pointer(k),'Unknown/unsafe style property',{allowed:['base',...Object.keys(styles)]});continue}expect(expr(value,p+'/style/'+pointer(k),depth+2),type,p+'/style/'+pointer(k));if(['fill','stroke','backgroundColor'].includes(k)&&typeof value==='string'&&!value.startsWith('$'))try{color(value,p+'/style/'+k)}catch(e){fail(p+'/style/'+k,e.message,'CSS colour without URLs')}}
  }
  if(v.children!==undefined){if(v.type!=='group'||!Array.isArray(v.children)||v.children.length>2000)fail(p+'/children','Only groups have bounded child arrays','Array of at most2000elements');else v.children.forEach((child,i)=>element(child,p+'/children/'+i,depth+1))}
  if(v.clipPath!==undefined){if(!v.clipPath||!['rect','circle','polygon','path'].includes(v.clipPath.type))fail(p+'/clipPath','Clip paths must be bounded shapes','rect/circle/polygon/path');else element(v.clipPath,p+'/clipPath',depth+1)}
 }
 if(!ast||typeof ast!=='object'||Array.isArray(ast)||!guard(ast,path,0))fail(path,'Expression renderer requires a JSON object','{language:"vilsem-expression",version:1,root:{...}}')
 else{
  for(const k of Object.keys(ast))if(!['language','version','root'].includes(k))fail(path+'/'+pointer(k),'Unknown renderer member',{allowed:['language','version','root']})
  if(ast.language!=='vilsem-expression')fail(path+'/language','Unsupported expression language','vilsem-expression')
  if(ast.version!==1)fail(path+'/version','Unsupported expression version',1)
  element(ast.root,path+'/root',1)
 }
 return {valid:errors.length===0,errors,maxElements:elements,estimatedSteps:cost,nodes}
}

function rgba(value){
 const hex=typeof value==='string'&&/^#([\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.exec(value)
 if(hex){const h=hex[1].length===3?[...hex[1]].map(c=>c+c).join(''):hex[1];return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)).concat(h.length===8?parseInt(h.slice(6),16)/255:1)}
 const match=typeof value==='string'&&/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(value)
 if(match){const a=match.slice(1,4).map(Number).concat(match[4]==null?1:Number(match[4]));if(a.slice(0,3).every(n=>n>=0&&n<=255)&&a[3]>=0&&a[3]<=1)return a}
 throw Error('Colour interpolation requires hex/rgb/rgba colours')
}
function interpolate(a,b,t){const x=rgba(a),y=rgba(b),v=x.map((n,i)=>n+(y[i]-n)*Math.max(0,Math.min(1,t)));return `rgba(${v.slice(0,3).map(Math.round).join(',')},${Math.round(v[3]*10000)/10000})`}
const number=(v,p)=>{if(typeof v!=='number'||!Number.isFinite(v))throw Error(p+': expected a finite number');return v}
const boolean=(v,p)=>{if(typeof v!=='boolean')throw Error(p+': expected a boolean');return v}
function text(v,p){if(v!==null&&!['number','string','boolean'].includes(typeof v))throw Error(p+': expected scalar text');const s=v==null?'':String(v);if(s.length>EXPRESSION_LIMITS.stringLength)throw Error(p+': string limit exceeded');return s}
function color(v,p){if(typeof v!=='string'||v.length>100||!(/^(?:#[\da-f]{3,8}|[a-z]{1,24}|rgba?\([\d.,\s]+\))$/i.test(v)))throw Error(p+': invalid colour (URLs are forbidden)');return v}
function pathData(v,p){
 const s=text(v,p),tokens=s.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g)||[]
 if(!s||s.length>EXPRESSION_LIMITS.pathLength||s.replace(/[,\s]/g,'')!==tokens.join('')||!['M','m'].includes(tokens[0]))throw Error(p+': invalid/bounded SVG path')
 const arity={M:2,L:2,H:1,V:1,C:6,S:4,Q:4,T:2,A:7,Z:0};let i=0,commands=0,numbers=0
 while(i<tokens.length){
  const command=tokens[i++].toUpperCase(),size=arity[command]
  if(size===undefined||++commands>EXPRESSION_LIMITS.pathCommands)throw Error(p+': SVG path command budget exceeded')
  if(!size)continue
  const start=i
  while(i<tokens.length&&!/^[A-Za-z]$/.test(tokens[i]))i++
  if(i===start||(i-start)%size)throw Error(p+': incomplete SVG path command')
  const values=tokens.slice(start,i).map(Number);numbers+=values.length
  if(numbers>2048||values.some(n=>!Number.isFinite(n)||Math.abs(n)>EXPRESSION_LIMITS.coordinate))throw Error(p+': SVG path coordinate budget exceeded')
  if(command==='A')for(let k=0;k<values.length;k+=7)if(values[k]<0||values[k+1]<0||![0,1].includes(values[k+3])||![0,1].includes(values[k+4]))throw Error(p+': invalid SVG arc arguments')
 }
 return s
}

export function createExpressionRenderer(ast,{path='/renderItem',locale='en-US',formatting={},textDefaults={},stepBudget=EXPRESSION_LIMITS.stepsPerItem}={}){
 if(!Number.isInteger(stepBudget)||stepBudget<1||stepBudget>EXPRESSION_LIMITS.stepsPerItem)throw Error(path+': stepBudget may only lower the fixed execution ceiling')
 const checked=validateExpression(ast,{path,resolved:true})
 if(!checked.valid){const e=Error(checked.errors.map(e=>`${e.path}: ${e.message}`).join('\n'));e.diagnostics=checked.errors;throw e}
 // Never retain a caller-mutable AST after validation.
 ast=structuredClone(ast)
 const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v};freeze(ast)
 const formats=new Map()
 const formatter=pattern=>{if(!formats.has(pattern)){if(formats.size>=64)throw Error('Formatter cache limit exceeded');formats.set(pattern,createModelFormatter(pattern,{locale}))}return formats.get(pattern)}
 const renderer=(params,api)=>{
  let steps=0,count=0
  const tick=p=>{if(++steps>stepBudget)throw Error(p+': expression step budget exceeded')}
  const baseStyle={};const inherited=typeof api.style==='function'?api.style():{}
  for(const k of Object.keys(styles))if(own(inherited||{},k)&&['string','number','boolean'].includes(typeof inherited[k]))baseStyle[k]=inherited[k]
  const inheritedOpacity=typeof baseStyle.opacity==='number'?Math.max(0,Math.min(1,baseStyle.opacity)):1
  function evaluate(v,p,role){
   tick(p)
   if(v===null||['string','boolean','number'].includes(typeof v))return v
   if(Array.isArray(v))return v.map((x,i)=>evaluate(x,p+'/'+i,role))
   const op=v.op,args=v.args||[],arg=i=>evaluate(args[i],p+'/args/'+i,role),n=i=>number(arg(i),p+'/args/'+i)
   if(op==='literal')return args[0]
   if(op==='if')return boolean(arg(0),p)?arg(1):arg(2)
   if(op==='coalesce'){for(let i=0;i<args.length;i++){const value=arg(i);if(value!=null)return value}return null}
   if(op==='and'){for(let i=0;i<args.length;i++)if(!boolean(arg(i),p))return false;return true}
   if(op==='or'){for(let i=0;i<args.length;i++)if(boolean(arg(i),p))return true;return false}
   if(op==='not')return !boolean(arg(0),p)
   if(op==='dataIndex')return number(params.dataIndex,p)
   if(op==='viewportWidth'||op==='viewportHeight'){
    const getter=op==='viewportWidth'?'getWidth':'getHeight'
    if(typeof api[getter]!=='function')throw Error(p+': viewport dimensions are unavailable')
    const value=number(api[getter](),p)
    if(value<0||value>EXPRESSION_LIMITS.coordinate)throw Error(p+': viewport dimension outside0..'+EXPRESSION_LIMITS.coordinate)
    return value
   }
   if(op==='value'){const index=n(0);if(!Number.isInteger(index)||index<0||index>255)throw Error(p+': invalid data dimension');return api.value(index)}
   if(op==='visual')return color(api.visual('color'),p)
   if(op==='style')return {...baseStyle}
   if(op==='coord'||op==='size'){const input=arg(0);if(!Array.isArray(input)||input.length!==2||input.some(x=>!['string','number'].includes(typeof x)))throw Error(p+': expected a coordinate pair');if(op==='size')input.forEach(x=>number(x,p));const anchor=args.length===2?arg(1):undefined;if(anchor!==undefined&&(!Array.isArray(anchor)||anchor.length!==2||anchor.some(x=>!['string','number'].includes(typeof x))))throw Error(p+': invalid size anchor');const result=op==='coord'?api.coord(input):api.size(input,anchor);if(!Array.isArray(result)||result.length<2)throw Error(p+': API returned invalid coordinates');return result.slice(0,2).map(x=>number(x,p))}
   if(op==='at'){const a=arg(0),i=n(1);if(!Array.isArray(a)||!Number.isInteger(i)||i<0||i>=a.length||i>255)throw Error(p+': invalid bounded array index');return a[i]}
   if(op==='length'){const a=arg(0);if(!Array.isArray(a)&&typeof a!=='string')throw Error(p+': length requires array/string');return a.length}
   if(op==='string')return text(arg(0),p)
   if(op==='number'){const value=arg(0);return value==null||value===''?null:number(Number(text(value,p)),p)}
   if(op==='concat')return text(args.map((_v,i)=>text(arg(i),p)).join(''),p)
   if(['format','formatNumber','formatDate'].includes(op)){const value=arg(0),pattern=role==='label'&&op!=='formatDate'&&formatting.labels?.format?formatting.labels.format:arg(1);return text(formatter(pattern)(value),p)}
   if(op==='colorInterpolate')return interpolate(arg(0),arg(1),n(2))
   if(op==='colorScale'){const value=n(0),lo=n(1),hi=n(2),palette=arg(3);if(lo>hi||!Array.isArray(palette)||!palette.length||palette.length>32)throw Error(p+': invalid colour scale');const position=Math.max(0,Math.min(1,hi===lo?.5:(value-lo)/(hi-lo)))*(palette.length-1),i=Math.floor(position);return interpolate(palette[i],palette[Math.min(palette.length-1,i+1)],position-i)}
   if(op==='eq'||op==='ne')return op==='eq'?arg(0)===arg(1):arg(0)!==arg(1)
   if(op==='lt')return n(0)<n(1);if(op==='lte')return n(0)<=n(1);if(op==='gt')return n(0)>n(1);if(op==='gte')return n(0)>=n(1)
   let result
   if(op==='add')result=args.reduce((sum,_x,i)=>sum+n(i),0)
   else if(op==='mul')result=args.reduce((sum,_x,i)=>sum*n(i),1)
   else if(op==='sub')result=n(0)-n(1)
   else if(op==='div'){const a=n(0),b=n(1);if(b===0)throw Error(p+': division by zero');result=a/b}
   else if(op==='mod'){const a=n(0),b=n(1);if(b===0)throw Error(p+': remainder by zero');result=a%b}
   else if(op==='pow'){const a=n(0),b=n(1);if(Math.abs(b)>32)throw Error(p+': exponent budget exceeded');result=a**b}
   else if(op==='min'||op==='max')result=(op==='min'?Math.min:Math.max)(...args.map((_x,i)=>n(i)))
   else if(op==='clamp'){const a=n(0),lo=n(1),hi=n(2);if(lo>hi)throw Error(p+': invalid clamp bounds');result=Math.max(lo,Math.min(hi,a))}
   else if(op==='neg')result=-n(0)
   else {const functions={abs:Math.abs,sqrt:Math.sqrt,floor:Math.floor,ceil:Math.ceil,round:Math.round,sin:Math.sin,cos:Math.cos};if(!own(functions,op))throw Error(p+': unsupported operation');result=functions[op](n(0))}
   return number(result,p)
  }
  function render(node,p){
   tick(p);if(++count>EXPRESSION_LIMITS.elementsPerItem)throw Error(p+': per-item graphic budget exceeded')
   const role=node.role||(node.type==='text'?'label':'mark')
   if(node.when!==undefined&&!boolean(evaluate(node.when,p+'/when',role),p))return null
   if(node.type==='text'&&role==='label'&&formatting.labels?.show===false)return null
   const out={type:node.type}
   for(const [key,type] of Object.entries(common))if(key!=='when'&&own(node,key)){
    const value=evaluate(node[key],p+'/'+key,role)
    if(type==='number'){number(value,p+'/'+key);if(Math.abs(value)>EXPRESSION_LIMITS.coordinate)throw Error(p+'/'+key+': coordinate budget exceeded')}
    if(type==='boolean')boolean(value,p+'/'+key)
    if(type==='string'||type==='scalar')out[key]=text(value,p+'/'+key);else out[key]=value
   }
   if(node.shape){out.shape={};for(const [key,v] of Object.entries(node.shape)){
    let value=evaluate(v,p+'/shape/'+key,role)
    if(key==='pathData'){steps+=typeof value==='string'?Math.ceil(value.length/16):1;tick(p);value=pathData(value,p+'/shape/pathData')}
    else if(key==='points'){if(!Array.isArray(value)||value.length>256||value.some(pair=>!Array.isArray(pair)||pair.length!==2||pair.some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>EXPRESSION_LIMITS.coordinate)))throw Error(p+'/shape/points: invalid bounded polygon')}
    else {number(value,p+'/shape/'+key);if(Math.abs(value)>EXPRESSION_LIMITS.coordinate||['width','height','r'].includes(key)&&value<0)throw Error(p+'/shape/'+key+': shape bounds exceeded')}
    out.shape[key]=value
   }}
   if(node.type!=='group'){
    let style={...baseStyle,strokeNoScale:true,...(node.type==='text'?{...(textDefaults.color?{fill:textDefaults.color}:{}),...(textDefaults.fontFamily?{fontFamily:textDefaults.fontFamily}:{}),...(textDefaults.fontSize?{fontSize:textDefaults.fontSize}:{})}:{})},ownStyle=node.style?.op?evaluate(node.style,p+'/style',role):{}
    if(node.style&&!node.style.op){if(node.style.base)ownStyle=evaluate(node.style.base,p+'/style/base',role);for(const [key,v] of Object.entries(node.style))if(key!=='base')ownStyle[key]=evaluate(v,p+'/style/'+key,role)}
    style={...style,...ownStyle}
    const label=role==='title'?formatting.title:role==='label'?formatting.labels:null,typography=formatting.typography||{}
    if(node.type==='text'){
     for(const key of ['fontFamily','fontSize','color']){const value=label?.[key]??typography[key];if(value!==undefined)style[key==='color'?'fill':key]=typeof value==='string'?value:value?.solid?.color??value}
     if(label?.bold!==undefined)style.fontWeight=label.bold?'bold':'normal'
    }else {if(formatting.lines?.width!==undefined)style.lineWidth=formatting.lines.width;if(formatting.lines?.color)style.stroke=typeof formatting.lines.color==='string'?formatting.lines.color:formatting.lines.color.solid?.color}
    for(const [key,v] of Object.entries(style)){
     if(['fill','stroke','backgroundColor','shadowColor'].includes(key))color(v,p+'/style/'+key)
     else if(key==='text'){style.text=text(v,p+'/style/text');if(style.text.length>EXPRESSION_LIMITS.textLength)throw Error(p+'/style/text: label length exceeded')}
     else if(styles[key]==='boolean')boolean(v,p+'/style/'+key)
     else if(styles[key]==='number'){number(v,p+'/style/'+key);if(Math.abs(v)>EXPRESSION_LIMITS.coordinate||['width','height','lineWidth'].includes(key)&&v<0||key==='fontSize'&&(v<1||v>200)||key==='lineHeight'&&(v<1||v>1000))throw Error(p+'/style/'+key+': style bound exceeded')}
     else if(key==='lineDash'){if(!Array.isArray(v)||v.length>16||v.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>1000))throw Error(p+'/style/lineDash: invalid dash pattern')}
     else if(key==='fontWeight'&&!(typeof v==='number'&&Number.isInteger(v)&&v>=100&&v<=900||['normal','bold','bolder','lighter'].includes(v)))throw Error(p+'/style/fontWeight: invalid font weight')
     else if(styles[key]==='string'&&/url\(|javascript:|[;{}<>]/i.test(text(v,p)))throw Error(p+'/style/'+key+': unsafe style string')
    }
    const explicitOpacity=!node.style?.op&&own(node.style||{},'opacity')?ownStyle.opacity:1
    // Noninteractive annotations are visual chrome, not the synthetic row used
    // to invoke renderItem. Preserve their authored opacity during selection.
    const selectionOpacity=role==='annotation'&&out.silent===true?1:inheritedOpacity
    style.opacity=selectionOpacity*Math.max(0,Math.min(1,number(explicitOpacity,p+'/style/opacity')))
    out.style=style
   }
   if(node.children)out.children=node.children.map((c,i)=>render(c,p+'/children/'+i)).filter(Boolean)
   if(node.clipPath)out.clipPath=render(node.clipPath,p+'/clipPath')
   return out
  }
  return render(ast.root,path+'/root')
 }
 renderer.vilsemExpression=Object.freeze({version:1,ast,limits:EXPRESSION_LIMITS,maxElements:checked.maxElements,estimatedSteps:checked.estimatedSteps,formatting})
 return renderer
}

/** Resolve only declared theme/parameter tokens. Explicit literal operations
 * keep leading-dollar currency/text inert instead of becoming token paths. */
export function resolveExpressionTokens(ast,resolve){
 const checked=validateExpression(ast)
 if(!checked.valid){const e=Error(checked.errors.map(e=>`${e.path}: ${e.message}`).join('\n'));e.diagnostics=checked.errors;throw e}
 const visit=v=>{
  if(typeof v==='string'&&v.startsWith('$'))return resolve(v)
  if(Array.isArray(v))return v.map(visit)
  if(v&&typeof v==='object'){if(v.op==='literal')return structuredClone(v);return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,visit(x)]))}
  return v
 }
 return visit(ast)
}

export function compileExpressionSeries(option,context={}){
 let totalElements=0,totalSteps=0
 const visit=(option,base='/template/template')=>{
 const series=Array.isArray(option.series)?option.series:option.series?[option.series]:[]
 const compiled=series.map((s,i)=>{
  if(s.type!=='custom')return s
  const ast=typeof s.renderItem==='function'&&s.renderItem.vilsemExpression?s.renderItem.vilsemExpression.ast:s.renderItem
  const path=`${base}/series/${i}/renderItem`,checked=validateExpression(ast,{path,resolved:true})
  if(!checked.valid){const e=Error(checked.errors.map(e=>`${e.path}: ${e.message}`).join('\n'));e.diagnostics=checked.errors;throw e}
  if(!Array.isArray(s.data))throw Error(`${base}/series/${i}/data: expression series require a bounded explicit data array`)
  totalElements+=checked.maxElements*s.data.length;totalSteps+=checked.estimatedSteps*s.data.length
  if(totalElements>EXPRESSION_LIMITS.totalElements||totalSteps>EXPRESSION_LIMITS.totalSteps)throw Error(`${path}: conservative whole-visual element/step budget exceeded; reduce rows or AST complexity`)
  return {...s,clip:s.clip!==false,renderItem:createExpressionRenderer(ast,{...context,path})}
 })
 if(option.options!=null&&(!Array.isArray(option.options)||option.options.length>120))throw Error(`${base}/options: timeline requires at most120 option frames`)
 return {...option,...(option.series?{series:Array.isArray(option.series)?compiled:compiled[0]}:{}),...(option.baseOption?{baseOption:visit(option.baseOption,base+'/baseOption')}:{}),...(option.options?{options:option.options.map((frame,i)=>visit(frame,base+'/options/'+i))}:{})}
 }
 return visit(option)
}
