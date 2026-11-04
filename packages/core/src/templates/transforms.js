// Bounded, declarative data shaping. No source code, callbacks or model writes.
// Relational sums are opt-in: use additive measures for links/hierarchies/facets.
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key)
export const SAFE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/
export const BLOCKED = new Set(['__proto__', 'constructor', 'prototype'])
import {LAYOUT_OPS, validateLayout, deriveLayout} from './layout-transforms.js'
import {SEQUENCE_OPS, validateSequence, deriveSequence} from './sequence-transforms.js'
import {hierarchy as d3Hierarchy, pack as d3Pack, partition as d3Partition} from 'd3-hierarchy'
import {validateFlows, deriveFlows} from './flow-transforms.js'
import {TEMPORAL_OPS,validateTemporal,deriveTemporal} from './temporal-transforms.js'
import {ANALYTIC_OPS,validateAnalytic,deriveAnalytic} from './analytic-transforms.js'
import {DISTRIBUTION_OPS,validateDistribution,deriveDistribution,stableStatistic} from './distribution-transforms.js'
import {validateDensity,deriveDensity} from './density-transforms.js'
import {validateJitter,deriveJitter} from './jitter-transform.js'
import {STATISTICAL_OPS,validateStatistical,deriveStatistical} from './statistical-transforms.js'
import {validateWords,deriveWords} from './word-layout.js'
import {isoDate} from './date-utils.js'
export {isoDate} from './date-utils.js'
const OPS = ['window', 'date', 'take', 'links', 'flows', 'hierarchy', 'facet', 'stat', 'density', 'jitter', 'words', ...LAYOUT_OPS, ...SEQUENCE_OPS, ...TEMPORAL_OPS, ...ANALYTIC_OPS, ...DISTRIBUTION_OPS, ...STATISTICAL_OPS]
const finite = value => value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null
export function validateTransforms(transforms, slots, params = []) {
  const errors = [], names = new Set(), known = new Set(Object.keys(slots || {}))
  if(params==null)params=[]
  if(!Array.isArray(params)){errors.push('template.params must be an array');params=[]}
  const safeName = name => typeof name === 'string' && SAFE_NAME.test(name) && !BLOCKED.has(name)
  if(transforms.length>128)errors.push('transform limit is 128')
  for(const p of params)if(!safeName(p?.name))errors.push('params require safe names')
  for (const name of known) if (!safeName(name)) errors.push(`unsafe slot name "${name}"`)
  for (const t of transforms || []) {
    if (!t || !safeName(t.as) || names.has(t.as) || known.has(t.as)) { errors.push('each transform needs a unique safe "as" name'); continue }
    const keys = ['calculate', ...OPS].filter(key => own(t,key))
    if (keys.length !== 1) { errors.push(`transform "${t.as}": exactly one supported operation is required (calculate, ${OPS.join(', ')})`); continue }
    const op=keys[0], d=t[op]
    const field = name => { if(!safeName(name) || !known.has(name)) errors.push(`transform "${t.as}": unknown field "${name}"; use a slot or earlier transform`) }
    if(op==='calculate') {
      if(typeof d!=='string' || d.length>2048 || /[^A-Za-z0-9_+*/%().,\s-]/.test(d) || /[A-Za-z_]\w*\s*\./.test(d)) errors.push(`transform "${t.as}": invalid calculate expression`)
      else for(const match of d.matchAll(/[A-Za-z_]\w*/g)) {
        const id=match[0], fn=/^\s*\(/.test(d.slice(match.index+id.length))
        if(fn ? !['abs','min','max','round','floor','ceil','sqrt'].includes(id) : !known.has(id) && !params.some(p=>p.name===id)) errors.push(`transform "${t.as}": unknown ${fn?'function':'field'} "${id}"`)
      }
    } else if(!d || typeof d!=='object' || Array.isArray(d)) errors.push(`transform "${t.as}": ${op} requires an object`)
    else if(LAYOUT_OPS.includes(op)) validateLayout(op,d,field,errors,`transform "${t.as}"`,params)
    else if(STATISTICAL_OPS.includes(op))validateStatistical(op,d,field,errors,`transform "${t.as}"`)
    else if(SEQUENCE_OPS.includes(op)) validateSequence(op,d,field,errors,`transform "${t.as}"`)
    else if(TEMPORAL_OPS.includes(op)) validateTemporal(op,d,field,errors,`transform "${t.as}"`)
    else if(ANALYTIC_OPS.includes(op)) validateAnalytic(op,d,field,errors,`transform "${t.as}"`)
    else if(DISTRIBUTION_OPS.includes(op)) validateDistribution(op,d,field,params,errors,`transform "${t.as}"`)
    else if(op==='density')validateDensity(d,field,errors,`transform "${t.as}"`)
    else if(op==='jitter')validateJitter(d,field,errors,`transform "${t.as}"`)
    else if(op==='words')validateWords(d,field,errors,`transform "${t.as}"`)
    else if(op==='hierarchy') {
      if(!Array.isArray(d.levels) || d.levels.length<2 || d.levels.length>6) errors.push(`transform "${t.as}": hierarchy needs 2..6 levels`)
      else d.levels.forEach(field)
      field(d.value)
      if(d.color!=null)field(d.color)
      if(d.layout!=null && !['partition','pack'].includes(d.layout))errors.push(`transform "${t.as}": hierarchy layout must be partition|pack`)
      if(d.size!=null && (typeof d.size!=='number'||!Number.isFinite(d.size)||d.size<1||d.size>2000))errors.push(`transform "${t.as}": hierarchy size must be 1..2000`)
    } else if(op==='flows') validateFlows(d,field,errors,`transform "${t.as}"`)
    else if(op==='links') { field(d.source);field(d.target);field(d.value) }
    else if(op==='facet') {
      field(d.by);field(d.category);field(d.value)
      if(d.columns!=null && (!Number.isInteger(d.columns)||d.columns<1||d.columns>6)) errors.push(`transform "${t.as}": facet columns must be 1..6`)
      if(d.maxPanels!=null && (!Number.isInteger(d.maxPanels)||d.maxPanels<1||d.maxPanels>36)) errors.push(`transform "${t.as}": maxPanels must be 1..36`)
    } else {
      field(d.field)
      if(op==='stat') {
        if(!['min','max','sum','mean','median','quantile','stddev','count'].includes(d.op))errors.push(`transform "${t.as}": unknown stat op "${d.op}"`)
        if(d.partitionBy)field(d.partitionBy)
        if(d.op==='quantile' && (typeof d.q!=='number'||!Number.isFinite(d.q)||d.q<0||d.q>1))errors.push(`transform "${t.as}": quantile q must be 0..1`)
        if(d.sample!=null && typeof d.sample!=='boolean')errors.push(`transform "${t.as}": sample must be boolean`)
        if(d.records!=null && typeof d.records!=='boolean')errors.push(`transform "${t.as}": records must be boolean`)
      }
      if(op==='window') {
        if(!['sum','lag','percentOfTotal','ewma'].includes(d.op)) errors.push(`transform "${t.as}": unknown window op "${d.op}"`)
        if(d.op==='ewma'&&(typeof d.alpha!=='number'||!Number.isFinite(d.alpha)||d.alpha<=0||d.alpha>1))errors.push(`transform "${t.as}": ewma alpha must be greater than 0 and at most 1`)
        if(d.orderBy)field(d.orderBy)
        if(d.partitionBy)field(d.partitionBy)
        if(d.offset!=null && (!Number.isInteger(d.offset)||d.offset<1||d.offset>10000))errors.push(`transform "${t.as}": lag offset must be 1..10000`)
      }
      if(op==='take' && (!Number.isInteger(d.count)||d.count<1||d.count>10000))errors.push(`transform "${t.as}": take count must be 1..10000`)
      if(op==='date' && d.take!=null && (!Number.isInteger(d.take)||d.take<1||d.take>10000))errors.push(`transform "${t.as}": date take must be 1..10000`)
    }
    names.add(t.as);known.add(t.as)
  }
  return {errors,names}
}
export function derive(t, shaped, calc, cats, shapeValues,params={}) {
  const get = name => (own(calc,name)?calc[name]:shaped[name])?.values || []
  const n=Math.max(0,...Object.values(shaped).map(s=>s.values?.length||0))
  if(n>10000)throw Error('Template data limit is 10000 rows')
  if(t.flows)return deriveFlows(t.flows,get,n)
  for (const op of LAYOUT_OPS) if (t[op]) return deriveLayout(op,t[op],get,n,params)
  for (const op of STATISTICAL_OPS) if(t[op])return deriveStatistical(op,t[op],get,n,shapeValues,cats)
  for (const op of SEQUENCE_OPS) if (t[op]) return deriveSequence(op,t[op],get,n,cats)
  for (const op of TEMPORAL_OPS) if (t[op]) return deriveTemporal(op,t[op],get,n)
  for (const op of ANALYTIC_OPS) if (t[op]) return deriveAnalytic(op,t[op],get,n)
  for (const op of DISTRIBUTION_OPS) if (t[op]) return deriveDistribution(op,t[op],get,n,params)
  if(t.density)return deriveDensity(t.density,get,n)
  if(t.jitter)return deriveJitter(t.jitter,get,n)
  if(t.words)return deriveWords(t.words,get,n)
  if(t.date) { const d=t.date; return shapeValues(get(d.field).slice(0,d.take??10000).map(isoDate),cats.slice(0,d.take??10000)) }
  if(t.take) { const values=get(t.take.field).slice(0,t.take.count);return shapeValues(values,values) }
  if(t.stat) {
    const d=t.stat,values=get(d.field),part=d.partitionBy?get(d.partitionBy):[],groups=new Map(),out=Array(values.length).fill(null),data=[]
    values.forEach((_,i)=>{const key=part[i]??'';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i)})
    for(const [name,indexes] of groups) {
      const nums=indexes.map(i=>finite(values[i])).filter(v=>v!=null).sort((a,b)=>a-b)
      const result=stableStatistic(nums,d.op,d.q,d.sample)
      for(const i of indexes)out[i]=result
      if(d.records)data.push({name:String(name),value:result,rowIndexes:indexes.filter(i=>finite(values[i])!=null)})
    }
    return {...shapeValues(out,cats),...(d.records?{data}:{})}
  }
  if(t.window) {
    const d=t.window,values=get(d.field),order=d.orderBy?get(d.orderBy):[],part=d.partitionBy?get(d.partitionBy):[]
    const groups=new Map(), out=Array(values.length).fill(null)
    values.forEach((_,i)=>{const key=part[i]??'';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i)})
    for(const indexes of groups.values()) {
      if(d.orderBy)indexes.sort((a,b)=>String(order[a]??'').localeCompare(String(order[b]??''),'en',{numeric:true}) || a-b)
      let running=0,average=null;const total=indexes.reduce((s,i)=>s+(finite(values[i])??0),0)
      indexes.forEach((i,j)=>{const v=finite(values[i]); if(d.op==='ewma'){if(v!=null){average=average==null?v:(1-d.alpha)*average+d.alpha*v;if(!Number.isFinite(average))throw Error('ewma exceeds finite numeric range');out[i]=average}}else if(d.op==='sum'){running+=v??0;out[i]=running}else if(d.op==='lag')out[i]=j>=(d.offset||1)?finite(values[indexes[j-(d.offset||1)]]):d.default??null;else out[i]=v==null||total===0?null:v/total})
    }
    return shapeValues(out,cats)
  }
  if(t.links) {
    const d=t.links,sources=get(d.source),targets=get(d.target),weights=get(d.value),nodes=new Map(),links=new Map()
    for(let i=0;i<n;i++) {
      const v=finite(weights[i]);if(v==null)continue;if(v<0)throw Error('links requires non-negative weights')
      const source=JSON.stringify([d.source,sources[i]??'']),target=JSON.stringify([d.target,targets[i]??''])
      for(const [id,label,category] of [[source,sources[i],0],[target,targets[i],1]]) {
        if(!nodes.has(id))nodes.set(id,{id,name:id,category,label:String(label??'(Blank)'),value:0,rowIndexes:[]})
        const node=nodes.get(id);node.value+=v;node.rowIndexes.push(i)
      }
      const key=JSON.stringify([source,target]);if(!links.has(key))links.set(key,{source,target,value:0,rowIndexes:[]})
      links.get(key).value+=v;links.get(key).rowIndexes.push(i)
    }
    return {nodes:[...nodes.values()],links:[...links.values()]}
  }
  if(t.hierarchy) {
    const d=t.hierarchy,levels=d.levels.map(get),weights=get(d.value),colors=d.color?get(d.color):null,roots=[]
    for(let i=0;i<n;i++) {
      const value=finite(weights[i]);if(value==null)continue;if(value<0)throw Error('hierarchy requires non-negative weights')
      let children=roots,path=[]
      for(let depth=0;depth<levels.length;depth++) {
        const name=String(levels[depth][i]??'(Blank)');path.push(name)
        let node=children.find(c=>c.name===name)
        if(!node){node={id:JSON.stringify(path),name,value:colors?[0,0]:0,rowIndexes:[],children:[]};children.push(node)}
        if(colors){node.value[0]+=value;node.value[1]+=finite(colors[i])??0;if(!node.value.every(Number.isFinite))throw Error('hierarchy aggregate exceeds finite numeric range')}
        else {node.value+=value;if(!Number.isFinite(node.value))throw Error('hierarchy aggregate exceeds finite numeric range')}
        node.rowIndexes.push(i);children=node.children
      }
    }
    if(!d.layout)return {children:roots}
    // Sum leaves only: the hierarchy's internal values already include children.
    const root=d3Hierarchy({children:roots}).sum(node=>node.children?.length?0:(Array.isArray(node.value)?node.value[0]:node.value)||0)
    if(root.descendants().length>2000)throw Error('hierarchy layout exceeds 2000 nodes; filter the input')
    if(!Number.isFinite(root.value))throw Error('hierarchy aggregate exceeds finite numeric range')
    if(!root.value)return {children:roots,nodes:[]}
    if(d.layout==='partition')d3Partition().size([1,d.levels.length+1])(root)
    else d3Pack().size([d.size??400,d.size??400]).padding(2)(root)
    const nodes=root.descendants().slice(1).map(node=>{
      const depth=node.depth-1,record={id:node.data.id,name:node.data.name,value:node.value,depth,rowIndexes:node.data.rowIndexes}
      if(d.layout==='pack')return {...record,cx:node.x,cy:node.y,radius:node.r,diameter:2*node.r,data:{name:record.name,value:[node.x,node.y,node.value],symbolSize:2*node.r,rowIndexes:record.rowIndexes}}
      const base=Array(d.levels.length).fill(0),span=Array(d.levels.length).fill(0)
      base[depth]=node.x0;span[depth]=node.x1-node.x0
      // A node occupies one depth. Null at other depths prevents ECharts from
      // creating spurious labels for zero-height marks on unrelated rows.
      const pixelSpan=(node.x1-node.x0)*(d.size??400),labelWidth=Math.max(0,pixelSpan-8)
      return {...record,offset:node.x0,span:node.x1-node.x0,pixelSpan,labelWidth,labelVisible:labelWidth>=32,base,data:span.map((value,index)=>({value:index===depth?value:null,rowIndexes:record.rowIndexes}))}
    })
    if(nodes.reduce((n,node)=>n+node.rowIndexes.length,0)>20000)throw Error('hierarchy layout exceeds 20000 lineage entries')
    return {children:roots,nodes}
  }
  if(t.facet) {
    const d=t.facet,by=get(d.by),category=get(d.category),weight=get(d.value),panels=new Map(),categories=[...new Set(category)]
    for(let i=0;i<n;i++) {
      const key=String(by[i]??'(Blank)');if(!panels.has(key))panels.set(key,new Map())
      const p=panels.get(key),c=category[i]??'',v=finite(weight[i]);if(v==null)continue
      if(!p.has(c))p.set(c,{name:c,value:0,rowIndexes:[]});p.get(c).value+=v;p.get(c).rowIndexes.push(i)
      if(!Number.isFinite(p.get(c).value))throw Error('facet aggregate exceeds finite numeric range; rescale the input')
    }
    if(panels.size>(d.maxPanels??36))throw Error(`facet has ${panels.size} panels; maxPanels=${d.maxPanels??36}. Filter or raise the explicit limit.`)
    if(panels.size*categories.length>20000)throw Error('facet exceeds 20000 aligned cells; filter the input')
    const columns=Math.min(d.columns??3,Math.max(1,panels.size)),rows=Math.ceil(panels.size/columns),width=86/columns,height=72/Math.max(1,rows)
    const out=[...panels].map(([name,data],index)=>{
      const records=categories.map(c=>data.get(c)??{name:c,value:null,rowIndexes:[]})
      const summary=shapeValues(records.map(r=>r.value),categories)
      return {name,index,categories,values:records.map(r=>r.value),rowIndexes:records.flatMap(r=>r.rowIndexes),data:records,last:summary.last,lastLabel:summary.lastLabel,sum:summary.sum,max:summary.max,avg:summary.avg,left:`${7+(index%columns)*width}%`,top:`${17+Math.floor(index/columns)*height}%`,width:`${width-4}%`,height:`${height-9}%`}
    })
    const indicators=categories.map((category,index)=>{
      const values=out.map(panel=>panel.data[index].value).filter(value=>value!=null)
      const min=Math.min(0,...values),max=Math.max(0,...values)
      return {name:String(category),min,max:max===min?max+1:max}
    })
    return {panels:out,indicators,max:Math.max(0,...out.flatMap(p=>p.data.map(d=>d.value??0)))}
  }
  throw Error(`Unsupported transform "${t.as}"`)
}
