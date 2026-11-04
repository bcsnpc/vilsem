import {isoDate} from './date-utils.js'
const finite=v=>v!=null&&v!==''&&Number.isFinite(Number(v))?Number(v):null
export const ANALYTIC_OPS=['conversion','dateBands']
export function validateAnalytic(op,d,field,errors,label) {
  if(op==='conversion'){field(d.category);field(d.value)}
  else {
    field(d.field)
    if(!Array.isArray(d.weekdays)||!d.weekdays.length||d.weekdays.length>7||d.weekdays.some(v=>!Number.isInteger(v)||v<0||v>6))errors.push(`${label}: dateBands weekdays must contain 1..7 UTC weekday numbers (0..6)`)
  }
}
export function deriveAnalytic(op,d,get,n) {
  if(op==='conversion') {
    const categories=get(d.category),values=get(d.value),groups=new Map()
    for(let i=0;i<n;i++) {
      const value=finite(values[i]);if(value==null)continue
      if(value<0)throw Error('conversion requires non-negative stage values')
      const name=String(categories[i]??'(Blank)')
      if(!groups.has(name))groups.set(name,{name,value:0,rowIndexes:[]})
      const group=groups.get(name);group.value+=value;group.rowIndexes.push(i)
      if(!Number.isFinite(group.value))throw Error('conversion stage aggregate exceeds finite numeric range')
      if(groups.size>2000)throw Error('conversion exceeds 2000 stages; filter the input')
    }
    const data=[...groups.values()].map((group,index,all)=>{
      const previous=index?all[index-1].value:null,conversion=previous>0?group.value/previous:null
      if(conversion!=null&&!Number.isFinite(conversion))throw Error('conversion ratio exceeds finite numeric range')
      const percent=conversion==null?null:conversion*100
      if(percent!=null&&!Number.isFinite(percent))throw Error('conversion percentage exceeds finite numeric range')
      const label=`${group.name}: ${index===0?'first stage':previous===0?'n/a (zero prior)':`${Number(percent.toFixed(1))}% of prior`}`
      return {...group,conversion,label}
    })
    return {data}
  }
  const dates=get(d.field),selected=new Set(d.weekdays),days=new Map()
  for(let i=0;i<n;i++) {
    if(dates[i]==null||dates[i]==='')continue
    const date=isoDate(dates[i]);if(date==null)throw Error(`dateBands requires ISO calendar dates at row ${i}`)
    if(!selected.has(new Date(date).getUTCDay()))continue
    if(!days.has(date))days.set(date,[])
    days.get(date).push(i)
  }
  const spans=[]
  for(const [date,rows] of [...days].sort(([a],[b])=>a-b)) {
    const previous=spans.at(-1)
    if(previous?.end===date){previous.end=date+86400000;previous.rowIndexes.push(...rows)}
    else spans.push({start:date,end:date+86400000,rowIndexes:[...rows]})
  }
  if(spans.length>5000)throw Error('dateBands exceeds 5000 bands; filter the input')
  return {areas:spans.map(span=>[{name:'Selected calendar days',xAxis:span.start,rowIndexes:span.rowIndexes},{xAxis:span.end,rowIndexes:span.rowIndexes}])}
}
