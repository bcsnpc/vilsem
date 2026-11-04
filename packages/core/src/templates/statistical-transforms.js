// Fixed bounded statistical/relational operations. No evaluated caller code.
import {stableStatistic} from './distribution-transforms.js'
import {isoDate} from './date-utils.js'
export const STATISTICAL_OPS=['qq','hexbin','density2d','groupShare','conditional','rebase','cohort','pivot','correlation','pareto']
const finite=v=>v!=null&&v!==''&&Number.isFinite(Number(v))?Number(v):null
const name=v=>String(v??'(Blank)')
const bounded=(v,lo,hi)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi
export function validateStatistical(op,d,field,errors,label) {
 const fields={qq:['field'],hexbin:['x','y'],density2d:['x','y'],groupShare:['by','category','value'],conditional:['value','condition'],rebase:['field','partitionBy','orderBy'],cohort:['date','entity','value','firstDay'],pivot:['row','column','value'],pareto:['category','value']}
 for(const key of fields[op]||[])field(d[key])
 if(op==='correlation') {
  if(!Array.isArray(d.fields)||d.fields.length<2||d.fields.length>6)errors.push(`${label}: correlation fields must contain 2..6 fields`)
  else d.fields.forEach(field)
  if(d.names!=null&&(!Array.isArray(d.names)||d.names.length!==d.fields?.length||d.names.some(n=>typeof n!=='string'||n.length>100)))errors.push(`${label}: correlation names must match fields and contain strings up to 100 characters`)
 }
 if(['hexbin','density2d'].includes(op)&&d.bins!=null&&(!Number.isInteger(d.bins)||d.bins<4||d.bins>64))errors.push(`${label}: bins must be 4..64`)
 if(op==='cohort'&&d.maxPeriods!=null&&(!Number.isInteger(d.maxPeriods)||d.maxPeriods<1||d.maxPeriods>120))errors.push(`${label}: maxPeriods must be 1..120`)
 if(op==='rebase'&&d.base!=null&&!bounded(d.base,-1e6,1e6))errors.push(`${label}: rebase base must be finite within +/-1000000`)
 if(op==='pareto'&&d.threshold!=null&&!bounded(d.threshold,0,1))errors.push(`${label}: pareto threshold must be 0..1`)
 if(op==='groupShare'&&d.subtotals!=null&&typeof d.subtotals!=='boolean')errors.push(`${label}: subtotals must be boolean`)
 if(op==='conditional') {
  if(d.label!=null)field(d.label)
  for(const key of ['positive','negative','zero'])if(d[key]!=null&&(typeof d[key]!=='string'||!/^#[0-9a-fA-F]{6}$/.test(d[key])))errors.push(`${label}: ${key} must be a six-digit hex colour`)
  if(d.labelFormat!=null&&!['percent','number'].includes(d.labelFormat))errors.push(`${label}: labelFormat must be percent|number`)
 }
}
// Invert the standard normal CDF numerically. The CDF uses the bounded
// Abramowitz-Stegun 26.2.17 approximation; intended QQ positions, not p-values.
export function normalQuantile(p) {
 if(!(p>0&&p<1))throw Error('normal quantile probability must be strictly between zero and one')
 if(p===.5)return 0
 const cdf=x=>{const z=Math.abs(x),t=1/(1+.2316419*z);const tail=Math.exp(-z*z/2)/Math.sqrt(2*Math.PI)*t*(.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));return x<0?tail:1-tail}
 let lo=-10,hi=10
 for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(cdf(mid)<p)lo=mid;else hi=mid}
 return (lo+hi)/2
}
function checked(value,op){if(!Number.isFinite(value))throw Error(`${op} exceeds finite numeric range; rescale the input`);return value}
function result(data,extra={}) {
 if(data.length>20000||data.reduce((s,d)=>s+(d.rowIndexes?.length||0),0)>20000)throw Error('statistical output exceeds 20000 cells or contributor identities; filter the input')
 return {data,...extra}
}
function records2d(d,get,n) {
 const x=get(d.x),y=get(d.y),rows=[]
 for(let i=0;i<n;i++){const a=finite(x[i]),b=finite(y[i]);if(a!=null&&b!=null)rows.push({x:a,y:b,index:i})}
 return rows
}
function range(rows,key) {
 const values=rows.map(r=>r[key]),scale=Math.max(...values.map(Math.abs))||1
 const min=Math.min(...values)/scale,max=Math.max(...values)/scale,span=max-min
 return {scale,min,max,span:span||1,constant:!span}
}
export function deriveStatistical(op,d,get,n,shapeValues,cats) {
 if(op==='qq') {
  const values=get(d.field).map((v,index)=>({value:finite(v),index})).filter(r=>r.value!=null).sort((a,b)=>a.value-b.value||a.index-b.index)
  return result(values.map((r,i)=>({value:[normalQuantile((i+.5)/values.length),r.value],rowIndexes:[r.index]})),{count:values.length})
 }
 if(op==='conditional') {
  const values=get(d.value),condition=get(d.condition),labels=d.label?get(d.label):values
  return result(values.map((value,i)=>{const c=finite(condition[i]),label=finite(labels[i]);return {value:finite(value),label:label==null?'':d.labelFormat==='percent'?`${Math.round(label*1000)/10}%`:String(label),itemStyle:{color:c==null||c===0?(d.zero??'#94a3b8'):c>0?(d.positive??'#2dd4bf'):(d.negative??'#f87171')},rowIndexes:[i]}}))
 }
 if(op==='rebase') {
  const values=get(d.field),groups=get(d.partitionBy),order=get(d.orderBy),parts=new Map(),out=Array(n).fill(null)
  for(let i=0;i<n;i++){const key=name(groups[i]);if(!parts.has(key))parts.set(key,[]);parts.get(key).push(i)}
  for(const indexes of parts.values()) {
   indexes.sort((a,b)=>String(order[a]??'').localeCompare(String(order[b]??''),'en',{numeric:true})||a-b)
   const first=indexes.find(i=>finite(values[i])!=null&&Number(values[i])!==0)
   if(first==null)continue
   for(const i of indexes){const value=finite(values[i]);if(value!=null)out[i]=checked(value/Number(values[first])*(d.base??100),'rebase')}
  }
  return shapeValues(out,cats)
 }
 if(op==='correlation') {
  const vectors=d.fields.map(get),categories=d.names||d.fields,data=[]
  for(let a=0;a<vectors.length;a++)for(let b=0;b<vectors.length;b++) {
   const rows=[];for(let i=0;i<n;i++){const x=finite(vectors[a][i]),y=finite(vectors[b][i]);if(x!=null&&y!=null)rows.push({x,y,index:i})}
   let value=null
   if(rows.length>1){const sx=Math.max(...rows.map(r=>Math.abs(r.x)))||1,sy=Math.max(...rows.map(r=>Math.abs(r.y)))||1;const mx=rows.reduce((s,r)=>s+r.x/sx,0)/rows.length,my=rows.reduce((s,r)=>s+r.y/sy,0)/rows.length;let xx=0,yy=0,xy=0;for(const r of rows){const x=r.x/sx-mx,y=r.y/sy-my;xx+=x*x;yy+=y*y;xy+=x*y}if(xx>0&&yy>0)value=Math.max(-1,Math.min(1,xy/Math.sqrt(xx*yy)))}
   data.push({name:`${categories[a]} / ${categories[b]}`,value:[a,b,value],rowIndexes:rows.map(r=>r.index),count:rows.length})
  }
  return result(data,{categories})
 }
 if(op==='pivot') {
  const rows=[],columns=[],cells=new Map(),row=get(d.row),column=get(d.column),values=get(d.value)
  for(let i=0;i<n;i++){const value=finite(values[i]);if(value==null)continue;const r=name(row[i]),c=name(column[i]);if(!rows.includes(r))rows.push(r);if(!columns.includes(c))columns.push(c);if(rows.length*columns.length>20000)throw Error('pivot exceeds 20000 cells; filter the input');const key=JSON.stringify([r,c]);if(!cells.has(key))cells.set(key,{value:0,rowIndexes:[]});const cell=cells.get(key);cell.value=checked(cell.value+value,'pivot');cell.rowIndexes.push(i)}
  const data=[];for(let y=0;y<rows.length;y++)for(let x=0;x<columns.length;x++){const c=cells.get(JSON.stringify([rows[y],columns[x]]));data.push({name:`${rows[y]} / ${columns[x]}`,value:[x,y,c?.value??null],rowIndexes:c?.rowIndexes??[]})}
  return result(data,{rows,columns,max:Math.max(0,...data.map(d=>d.value[2]??0))})
 }
 if(op==='groupShare'||op==='pareto') {
  const categories=get(d.category),values=get(d.value),by=op==='groupShare'?get(d.by):[],groups=new Map()
  for(let i=0;i<n;i++){const value=finite(values[i]);if(value==null)continue;if(value<0)throw Error(`${op} requires non-negative additive values`);const group=op==='groupShare'?name(by[i]):'',category=name(categories[i]);if(!groups.has(group))groups.set(group,new Map());const entries=groups.get(group);if(!entries.has(category))entries.set(category,{name:category,value:0,rowIndexes:[]});const r=entries.get(category);r.value=checked(r.value+value,op);r.rowIndexes.push(i)}
  const data=[],labels=[],cumulative=[];let thresholdCount=(d.threshold??.8)===0?0:null
  for(const [group,entries] of groups) {
   const records=[...entries.values()],total=stableStatistic(records.map(r=>r.value),'sum')??0
   if(op==='pareto')records.sort((a,b)=>b.value-a.value)
   let running=0
   for(const r of records){const label=op==='groupShare'?`${group} / ${r.name}`:r.name;labels.push(label);data.push({...r,name:label,value:op==='groupShare'?(total?r.value/total:null):r.value});running+=total?r.value/total:0;cumulative.push(running);if(total&&thresholdCount==null&&running+1e-12>=(d.threshold??.8))thresholdCount=data.length}
   if(op==='groupShare'&&d.subtotals){const label=`${group} / subtotal (${Number(total.toPrecision(8))})`;labels.push(label);data.push({name:label,value:total?1:null,rowIndexes:records.flatMap(r=>r.rowIndexes),subtotal:total,itemStyle:{color:'#64748b'}})}
  }
  return result(data,{categories:labels,...(op==='pareto'?{cumulative,thresholdCount:thresholdCount??0}: {})})
 }
 if(op==='cohort') {
  const dates=get(d.date),entity=get(d.entity),values=get(d.value),first=get(d.firstDay),cohorts=new Map(),periods=new Set(),cells=new Map()
  const month=timestamp=>{const date=new Date(timestamp);return date.getUTCFullYear()*12+date.getUTCMonth()}
  for(let i=0;i<n;i++) {
   const value=finite(values[i]),day=finite(first[i]),iso=isoDate(dates[i]);if(value==null||value<=0||day==null||iso==null)continue
   const initial=month(day*86400000),current=month(iso),period=current-initial;if(!Number.isFinite(initial)||!Number.isFinite(current))throw Error('cohort dates exceed the supported date range');if(period<0||period>=(d.maxPeriods??36))continue
   const year=Math.floor(initial/12),label=`${year}-${String((initial%12+12)%12+1).padStart(2,'0')}`,id=name(entity[i]);if(!cohorts.has(label))cohorts.set(label,new Set());cohorts.get(label).add(id);periods.add(period)
   const key=JSON.stringify([label,period]);if(!cells.has(key))cells.set(key,{entities:new Set(),rowIndexes:[]});cells.get(key).entities.add(id);cells.get(key).rowIndexes.push(i)
  }
  const labels=[...cohorts.keys()].sort(),ps=[...periods].sort((a,b)=>a-b),data=[]
  if(labels.length*ps.length>20000)throw Error('cohort exceeds 20000 cells')
  // Denominator is the distinct cohort membership returned in this query,
  // not a claim about customers outside a truncated/filtered host window.
  for(let y=0;y<labels.length;y++)for(let x=0;x<ps.length;x++){const label=labels[y],cell=cells.get(JSON.stringify([label,ps[x]]));data.push({name:`${label} +${ps[x]} months`,value:[x,y,cell?cell.entities.size/cohorts.get(label).size:null],rowIndexes:cell?.rowIndexes??[],cohortSize:cohorts.get(label).size})}
  return result(data,{cohorts:labels,periods:ps})
 }
 if(op==='hexbin'||op==='density2d') {
  const rows=records2d(d,get,n),bins=d.bins??24;if(!rows.length)return {data:[],max:0,...(op==='density2d'?{cells:[],columns:[],rows:[]}: {})}
  const rx=range(rows,'x'),ry=range(rows,'y'),norm=rows.map(r=>({x:(r.x/rx.scale-rx.min)/rx.span,y:(r.y/ry.scale-ry.min)/ry.span,index:r.index})),cells=new Map()
  const raw=(v,r)=>checked((r.min+v*r.span)*r.scale,op)
  if(op==='hexbin') {
   const radius=1/bins
   for(const r of norm) {
    const q=(Math.sqrt(3)/3*r.x-r.y/3)/radius,z=2*r.y/3/radius,s=-q-z;let a=Math.round(q),b=Math.round(z),c=Math.round(s);const da=Math.abs(a-q),db=Math.abs(b-z),dc=Math.abs(c-s);if(da>db&&da>dc)a=-b-c;else if(db>dc)b=-a-c
    const key=`${a}/${b}`;if(!cells.has(key))cells.set(key,{value:[raw(radius*Math.sqrt(3)*(a+b/2),rx),raw(radius*1.5*b,ry),0],rowIndexes:[]});const cell=cells.get(key);cell.value[2]++;cell.rowIndexes.push(r.index)
   }
  } else {
   if(bins*bins*rows.length>2000000)throw Error('density2d exceeds 2000000 kernel evaluations; reduce bins or filter the input')
   const h=Math.max(1/bins,Math.pow(rows.length,-1/6)*.15);let lineage=0
   for(let y=0;y<bins;y++)for(let x=0;x<bins;x++) {
    const px=(x+.5)/bins,py=(y+.5)/bins,rowIndexes=[];let sum=0
    for(const r of norm){const dx=(px-r.x)/h,dy=(py-r.y)/h;if(dx*dx+dy*dy<16){sum+=Math.exp(-.5*(dx*dx+dy*dy));rowIndexes.push(r.index);if(++lineage>20000)throw Error('density2d exceeds 20000 contributor identities; reduce bins or filter the input')}}
    const value=sum/(rows.length*2*Math.PI*h*h);cells.set(`${x}/${y}`,{value:[raw(px,rx),raw(py,ry),value],rowIndexes,grid:[x,y]})
   }
  }
  const data=[...cells.values()]
  return result(data,{max:Math.max(0,...data.map(r=>r.value[2])),...(op==='density2d'?{
    columns:Array.from({length:bins},(_,x)=>raw((x+.5)/bins,rx)),rows:Array.from({length:bins},(_,y)=>raw((y+.5)/bins,ry)),
    cells:data.map(r=>({value:[...r.grid,r.value[2]],rowIndexes:r.rowIndexes,label:`x ${Number(r.value[0].toPrecision(8))}, y ${Number(r.value[1].toPrecision(8))}, normalized density ${Number(r.value[2].toPrecision(6))}`})),
  }:{})})
 }
 throw Error(`Unknown statistical operation ${op}`)
}
