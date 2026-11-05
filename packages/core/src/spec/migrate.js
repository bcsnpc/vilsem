import{assertSpecJson}from'./jsonBoundary.js'
export const CURRENT_SPEC_VERSION='0.7'
export const SUPPORTED_SPEC_VERSIONS=Object.freeze(['0.1','0.2','0.3','0.4','0.5','0.6','0.7'])
const versions=SUPPORTED_SPEC_VERSIONS
// The app's original primitive envelope used measures for field display-name
// metadata. It is NOT the round2 query-scoped DAX block. Preserve it byte-for-
// value, especially table labels consumed as strings by historical renderers.
export function isLegacyMeasureBindings(spec){
 const m=spec?.measures
 if(!m||typeof m!=='object'||Array.isArray(m))return false
 if(Array.isArray(m.all))return true
 const keys=Object.keys(m),legacy=['primary','secondary','tertiary','all']
 return keys.length>0&&keys.every(k=>legacy.includes(k))&&!Object.values(m).some(v=>v&&typeof v==='object'&&Object.hasOwn(v,'expression'))&&(spec.type==='table'||Object.values(m).some(v=>v&&typeof v==='object'&&typeof v.table==='string'))
}
export const scopedMeasuresOf=spec=>isLegacyMeasureBindings(spec)?{}:spec?.measures || {}
// Existing specs before0.6 had no specVersion. Their version:1 is the wire
// envelope version, not a semantic format version; keep it unchanged.
export const migrationRegistry=Object.freeze({
 '0.1':spec=>spec,
 '0.2':spec=>spec,
 '0.3':spec=>{
  if(!isLegacyMeasureBindings(spec)&&spec.measures&&typeof spec.measures==='object'&&!Array.isArray(spec.measures))for(const [name,value] of Object.entries(spec.measures))if(typeof value==='string')spec.measures[name]={expression:value}
  return spec
 },
 '0.4':spec=>spec,
 '0.5':spec=>spec,
 '0.6':spec=>spec,
})

/** Forward-only, pure migration. No data/model writes, callbacks or inferred
 * business calculations. Unknown future formats fail instead of degrading. */
export function migrate(spec,fromVersion,toVersion=CURRENT_SPEC_VERSION){
 assertSpecJson(spec)
 fromVersion??=spec?.specVersion??'0.1'
 if(!spec||typeof spec!=='object'||Array.isArray(spec))throw Error('spec must be an object')
 if(spec.version!=null&&spec.version!==1)throw Error(`Unsupported spec version ${spec.version}; current wire version is1`)
 const from=versions.indexOf(String(fromVersion)),to=versions.indexOf(String(toVersion))
 if(from<0)throw Error(`Unsupported specVersion ${fromVersion}; readable versions:${versions.join(', ')}`)
 if(to<0||to<from)throw Error('Spec migrations are forward-only to a supported version')
 let result=structuredClone(spec)
 for(let i=from;i<to;i++)result=migrationRegistry[versions[i]](result)
 // Be tolerant of string measures authored under any earlier reader version.
 if(!isLegacyMeasureBindings(result)&&result.measures&&typeof result.measures==='object'&&!Array.isArray(result.measures))for(const [name,value] of Object.entries(result.measures))if(typeof value==='string')result.measures[name]={expression:value}
 result.specVersion=versions[to]
 return result
}
