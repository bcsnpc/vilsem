/** Protect parser entry points before cloning/enumeration can invoke getters.
 * The wire contract is JSON data, not arbitrary JavaScript objects/proxies. */
const functionSource=Function.prototype.toString
function nativePrototype(proto,name){
 if(!proto)return false
 const ctor=Object.getOwnPropertyDescriptor(proto,'constructor')?.value
 return typeof ctor==='function'&&Object.getOwnPropertyDescriptor(ctor,'prototype')?.value===proto&&new RegExp(`^function ${name}\\(\\) \\{\\s*\\[native code\\]\\s*\\}$`).test(functionSource.call(ctor))
}
export function isJsonDataContainer(value){
 const proto=Object.getPrototypeOf(value)
 return Array.isArray(value)?proto===Array.prototype||nativePrototype(proto,'Array'):proto===Object.prototype||proto===null||nativePrototype(proto,'Object')
}
export function assertSpecJson(spec){
 const seen=new WeakSet();let nodes=0,characters=0
 const fail=(path,message)=>{const error=Error(`${path||'/'}: ${message}`);error.path=path;throw error}
 function visit(value,path,depth){
  if(++nodes>100000||depth>64)fail(path,'Spec JSON node/depth budget exceeded')
  if(value==null||typeof value==='boolean')return
  if(typeof value==='string'){characters+=value.length;if(characters>8388608)fail(path,'Spec JSON string budget exceeded');return}
  if(typeof value==='number'){if(!Number.isFinite(value))fail(path,'Spec JSON numbers must be finite');return}
  if(typeof value!=='object')fail(path,'Spec JSON cannot contain executable functions or non-JSON values')
  const proto=Object.getPrototypeOf(value)
  // Dates in historical in-memory config are structured-clone-safe leaves.
  // The separate expression grammar still refuses Date objects in an AST.
  if(proto===Date.prototype||nativePrototype(proto,'Date')){Date.prototype.getTime.call(value);return}
  if(!isJsonDataContainer(value))fail(path,'Spec JSON requires plain data objects')
  if(seen.has(value))fail(path,'Spec JSON cannot contain cycles');seen.add(value)
  for(const key of Reflect.ownKeys(value)){
   if(typeof key!=='string')fail(path,'Spec JSON cannot contain symbol keys')
   characters+=key.length
   if(key.length>2048||characters>8388608)fail(path,'Spec JSON key/string budget exceeded')
   const next=path+'/'+key.replace(/~/g,'~0').replace(/\//g,'~1'),descriptor=Object.getOwnPropertyDescriptor(value,key)
   if(descriptor.get||descriptor.set)fail(next,'Spec JSON accessors are not supported')
   if(['__proto__','prototype','constructor'].includes(key))fail(next,'unsafe Spec JSON prototype key')
   if(Array.isArray(value)&&key==='length')continue
   visit(descriptor.value,next,depth+1)
  }
  seen.delete(value)
 }
 visit(spec,'',0)
}
