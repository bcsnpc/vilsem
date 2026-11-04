// Fixed trusted temporal algorithms. Templates never provide executable logic.
import {stack,stackOffsetWiggle,stackOffsetSilhouette,stackOrderInsideOut} from 'd3-shape'
import {intervalDate} from './date-utils.js'
const finite=value=>value!=null&&value!==''&&Number.isFinite(Number(value))?Number(value):null
export const TEMPORAL_OPS=['stream','intervals']
export function validateTemporal(op,d,field,errors,label) {
  field(d.category)
  if(op==='stream') {
    field(d.by);field(d.value)
    if(d.offset!=null&&!['wiggle','silhouette'].includes(d.offset))errors.push(`${label}: stream offset must be wiggle|silhouette`)
  } else {
    field(d.start);field(d.end)
    if(d.group!=null)field(d.group)
    if(d.limit!=null&&(!Number.isInteger(d.limit)||d.limit<1||d.limit>1000))errors.push(`${label}: interval limit must be 1..1000`)
  }
}
export function deriveTemporal(op,d,get,n) {
  if(op==='stream')return stream(d,get,n)
  return intervals(d,get,n)
}
function stream(d,get,n) {
  const groups=new Map(),categories=[],seen=new Set(),by=get(d.by),category=get(d.category),weights=get(d.value)
  let maximum=0
  for(let i=0;i<n;i++) {
    const value=finite(weights[i]);if(value==null)continue
    if(value<0)throw Error('stream requires non-negative additive weights')
    const name=String(by[i]??'(Blank)'),key=String(category[i]??'(Blank)')
    if(!seen.has(key)){seen.add(key);categories.push(key)}
    if(!groups.has(name))groups.set(name,new Map())
    const cells=groups.get(name)
    if(!cells.has(key))cells.set(key,{value:0,rowIndexes:[]})
    const cell=cells.get(key);cell.value+=value;cell.rowIndexes.push(i)
    if(!Number.isFinite(cell.value))throw Error('stream aggregate exceeds finite numeric range; rescale the input')
    maximum=Math.max(maximum,cell.value)
    if(groups.size>36||groups.size*categories.length>20000)throw Error('stream exceeds 36 layers or 20000 aligned cells; filter the input')
  }
  if(!categories.length)return {categories:[],panels:[],baseline:[]}
  const keys=[...groups.keys()]
  const rows=categories.map(category=>{
    let total=0
    const values=new Map(keys.map(key=>{
      const value=groups.get(key).get(category)?.value??0;total+=value
      return [key,maximum?value/maximum:0]
    }))
    if(!Number.isFinite(total))throw Error('stream column total exceeds finite numeric range; rescale the input')
    return {values}
  })
  // Normalize before wiggle's weighted products to avoid intermediate overflow.
  const layers=stack().keys(keys).value((row,key)=>row.values.get(key)).order(stackOrderInsideOut).offset(d.offset==='silhouette'?stackOffsetSilhouette:stackOffsetWiggle)(rows).sort((a,b)=>a.index-b.index)
  for(const layer of layers)for(const point of layer)if(!point.every(value=>Number.isFinite(value*maximum)))throw Error('stream layout exceeds finite numeric range; rescale the input')
  const baseline=categories.map((category,index)=>({name:category,value:maximum?layers[0][index][0]*maximum:0,rowIndexes:keys.flatMap(key=>groups.get(key).get(category)?.rowIndexes??[])}))
  const panels=layers.map((layer,index)=>({name:layer.key,index,data:categories.map(category=>({name:category,value:groups.get(layer.key).get(category)?.value??0,rowIndexes:[...(groups.get(layer.key).get(category)?.rowIndexes??[])]}))}))
  const lineage=baseline.reduce((s,d)=>s+d.rowIndexes.length,0)+panels.reduce((s,p)=>s+p.data.reduce((s,d)=>s+d.rowIndexes.length,0),0)
  if(lineage>20000)throw Error('stream exceeds 20000 lineage entries; filter the input')
  return {categories,panels,baseline}
}
function intervals(d,get,n) {
  const categories=get(d.category),groups=d.group?get(d.group):[],starts=get(d.start),ends=get(d.end),all=[],byGroup=new Map()
  let skipped=0
  for(let i=0;i<n;i++) {
    if(starts[i]==null||starts[i]===''||ends[i]==null||ends[i]===''){skipped++;continue}
    const start=intervalDate(starts[i]),end=intervalDate(ends[i])
    if(start==null||end==null)throw Error(`intervals requires ISO dates/zoned timestamps or finite epoch milliseconds at row ${i}`)
    if(end<start)throw Error(`intervals end precedes start at row ${i}`)
    const group=String(groups[i]??''),name=String(categories[i]??'(Blank)')
    const record={group,name,start,end,index:i}
    all.push(record)
    if(!byGroup.has(group))byGroup.set(group,[])
    byGroup.get(group).push(record)
  }
  const compare=(a,b)=>a.start-b.start||a.name.localeCompare(b.name,'en',{numeric:true})||a.index-b.index
  const grouped=[...byGroup].sort(([a],[b])=>a.localeCompare(b,'en',{numeric:true})).map(([,rows])=>rows.sort(compare))
  // Balanced bounded overview, then group ordering for the vertical axis.
  const chosen=[],limit=d.limit??1000
  for(let offset=0;chosen.length<Math.min(limit,all.length);offset++)for(const group of grouped)if(group[offset]&&chosen.length<limit)chosen.push(group[offset])
  chosen.sort((a,b)=>a.group.localeCompare(b.group,'en',{numeric:true})||compare(a,b))
  const result={categories:[],base:[],duration:[],milestones:[],min:null,max:null,total:all.length,shown:chosen.length,skipped,omitted:all.length-chosen.length,summary:`${chosen.length} of ${all.length} returned intervals shown`}
  const names=new Set()
  chosen.forEach((record,index)=>{
    const from=new Date(record.start).toISOString(),to=new Date(record.end).toISOString(),days=Math.round((record.end-record.start)/864000)/100
    let name=`${record.group?record.group+' / ':''}${record.name} [${from.slice(0,10)}]`
    if(names.has(name))name+=` #${record.index+1}`
    names.add(name)
    const label=`${name}: ${from} to ${to} (${days} days)`,rowIndexes=[record.index]
    result.categories.push(name)
    result.base.push({name,label,value:record.start,rowIndexes})
    result.duration.push({name,label,value:record.end-record.start,rowIndexes})
    if(record.end===record.start)result.milestones.push({name,label,value:[record.start,index],rowIndexes})
    result.min=result.min==null?record.start:Math.min(result.min,record.start)
    result.max=result.max==null?record.end:Math.max(result.max,record.end)
  })
  if(result.min!=null&&result.min===result.max){result.min=Math.max(-8640000000000000,result.min-43200000);result.max=Math.min(8640000000000000,result.max+43200000)}
  return result
}
