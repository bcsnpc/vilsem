// Exact set membership from observed joint rows, never from independent
// marginal totals. Diagram areas are deliberately NOT proportional to counts.
export function validateSetOverlaps(d,field,errors,label){
 field(d.value)
 if(!Array.isArray(d.sets)||d.sets.length<2||d.sets.length>3){errors.push(`${label}: setOverlaps requires2..3 named sets`);return}
 const names=new Set()
 for(const s of d.sets){
  if(!s||typeof s.name!=='string'||!s.name.trim()||s.name.length>80||names.has(s.name)){errors.push(`${label}: sets require unique names up to80 characters`);continue}
  names.add(s.name);field(s.field)
  if(typeof s.equals!=='string'||s.equals.length>200)errors.push(`${label}: set equals must be an exact text value up to200 characters`)
 }
}
export function deriveSetOverlaps(d,get,n){
 const weights=get(d.value),fields=d.sets.map(s=>get(s.field)),regions=Array.from({length:1<<d.sets.length},(_,mask)=>({mask,count:0,rowIndexes:[]})),sets=d.sets.map((s,i)=>({name:s.name,index:i,count:0,rowIndexes:[]}));let total=0
 for(let i=0;i<n;i++){
  const raw=weights[i];if(raw==null||raw==='')continue
  const weight=Number(raw);if(!Number.isFinite(weight)||weight<0)throw Error('setOverlaps requires finite non-negative joint additive weights');if(!weight)continue
  let mask=0;d.sets.forEach((set,j)=>{if(String(fields[j][i]??'')===set.equals)mask|=1<<j})
  const region=regions[mask];region.count+=weight;region.rowIndexes.push(i);total+=weight
  if(!Number.isFinite(total))throw Error('setOverlaps total exceeds finite range')
  sets.forEach((set,j)=>{if(mask&(1<<j)){set.count+=weight;set.rowIndexes.push(i)}})
 }
 const centres=d.sets.length===3?[[.38,.48],[.62,.48],[.5,.68]]:[[.4,.5],[.6,.5]],positions=d.sets.length===3?[[.08,.06],[.24,.46],[.76,.46],[.5,.32],[.5,.84],[.36,.65],[.64,.65],[.5,.54]]:[[.08,.06],[.28,.5],[.72,.5],[.5,.5]]
 const data=sets.map((s,i)=>({name:s.name,rowIndexes:s.rowIndexes,value:[0,i,s.count,...centres[i],.25,s.name]}))
 for(const region of regions){const names=d.sets.filter((_,i)=>region.mask&(1<<i)).map(s=>s.name),name=region.mask?`${names.join(' ∩ ')}${names.length===d.sets.length?'':' only'}`:'Outside all sets';data.push({name,rowIndexes:region.rowIndexes,value:[1,region.mask,region.count,...positions[region.mask],0,name]})}
 return {data,sets,regions,total,union:total-regions[0].count,outside:regions[0].count,areaEncoding:'not proportional; exact observed membership counts/weights only'}
}
