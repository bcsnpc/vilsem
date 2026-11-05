// Rank-over-time shaping. Repeated model grains are refused rather than
// silently summing ratios/distinct counts or inventing absent observations.
import {createModelFormatter} from '../shared/modelFormatting.js'
import {intervalDate} from './date-utils.js'
export function validateRace(d,field,errors,label){
 for(const key of Object.keys(d))if(!['time','category','value','x','y','size','topN','history','maxFrames','order','timeFormat'].includes(key))errors.push(`${label}: unknown race property ${key}`)
 if(d.timeFormat!=null&&!['yyyy-MM','yyyy-MM-dd','yyyy'].includes(d.timeFormat))errors.push(`${label}: race timeFormat must be yyyy-MM|yyyy-MM-dd|yyyy`)
 for(const key of ['time','category','value'])field(d[key])
 for(const key of ['x','y','size'])if(d[key]!=null)field(d[key])
 if((d.x==null)!==(d.y==null))errors.push(`${label}: race x/y must be supplied together`)
 for(const [key,min,max]of [['topN',1,100],['history',1,120],['maxFrames',1,120]])if(d[key]!=null&&(!Number.isInteger(d[key])||d[key]<min||d[key]>max))errors.push(`${label}: race ${key} must be${min}..${max}`)
 if(d.order!=null&&!['asc','desc'].includes(d.order))errors.push(`${label}: race order must be asc|desc`)
}
export function deriveRace(d,get,n){
 const time=get(d.time),category=get(d.category),values=get(d.value),xs=d.x?get(d.x):[],ys=d.y?get(d.y):[],sizes=d.size?get(d.size):[],frames=new Map(),names=new Set();let maxValue=-Infinity
 for(let i=0;i<n;i++){
  if(time[i]==null||time[i]==='')continue
  const frameName=String(time[i]),name=String(category[i]??'(Blank)')
  if(!frames.has(frameName)){if(frames.size>=(d.maxFrames??120))throw Error('race exceeds its frame limit; filter the time grain');frames.set(frameName,new Map())}
  const frame=frames.get(frameName);if(frame.has(name))throw Error('race requires one model result per time/category; duplicate grain must be resolved in DAX')
  const numeric=raw=>raw==null||raw===''?null:Number(raw),value=numeric(values[i]),x=numeric(xs[i]),y=numeric(ys[i]),size=numeric(sizes[i])
  if([value,...(d.x?[x,y]:[]),...(d.size?[size]:[])].some(v=>v!=null&&!Number.isFinite(v)))throw Error('race requires finite numeric measures')
  if(size!=null&&size<0)throw Error('race size must be non-negative')
  frame.set(name,{id:name,name,value:d.x?[x,y,size??value,value]:value,rowIndexes:[i],rankValue:value})
  names.add(name);if(value!=null)maxValue=Math.max(maxValue,value)
 }
 const timeLabels=[...frames.keys()].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));if(d.order==='desc')timeLabels.reverse()
 const categories=[...names].sort(),out=[],format=d.timeFormat?createModelFormatter(d.timeFormat):null,labels=timeLabels.map(name=>{if(!format)return name;const date=intervalDate(name);if(date==null)throw Error('race timeFormat requires valid ISO calendar dates');return format(date)});let points=0
 for(let index=0;index<timeLabels.length;index++){
  const frame=frames.get(timeLabels[index]),data=[...frame.values()].filter(p=>p.rankValue!=null).sort((a,b)=>b.rankValue-a.rankValue||a.name.localeCompare(b.name)).slice(0,d.topN??10).map(({rankValue,...p})=>p)
  const selected=new Set(data.map(p=>p.name)),series=[]
  for(const name of categories.filter(name=>selected.has(name))){
   const trail=[]
   for(let j=Math.max(0,index-(d.history??12)+1);j<=index;j++){const point=frames.get(timeLabels[j]).get(name);trail.push({name:timeLabels[j],value:[j,point?.rankValue??null],rowIndexes:point?.rowIndexes??[]})}
   series.push({name,id:name,data:trail,rowIndexes:trail.flatMap(p=>p.rowIndexes)})
  }
  points+=data.length+series.reduce((sum,s)=>sum+s.data.length,0)
  if(points>50000)throw Error('race exceeds50000 derived points; reduce frames/topN/history')
  const tileData=data.map(p=>({id:p.id,name:p.name,value:[categories.indexOf(p.name),0,frame.get(p.name).rankValue],rowIndexes:p.rowIndexes}))
  out.push({name:timeLabels[index],label:labels[index],index,data,tileData,series,categories:data.map(p=>p.name),timeLabels:timeLabels.slice(0,index+1)})
 }
 return {frames:out,timeLabels,labels,categories,maxValue:Number.isFinite(maxValue)?maxValue:null}
}
