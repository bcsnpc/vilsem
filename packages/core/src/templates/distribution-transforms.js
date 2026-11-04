// Bounded trusted numeric shaping, never template callbacks.
export const DISTRIBUTION_OPS=['histogram','boxplot','ecdf']
const finite=v=>v!=null&&v!==''&&Number.isFinite(Number(v))?Number(v):null
export function quantileSorted(values,q) {
  if(!values.length)return null
  const scale=Math.max(...values.map(Math.abs));if(!scale)return 0
  const position=(values.length-1)*q,lo=Math.floor(position),hi=Math.ceil(position),t=position-lo
  return ((1-t)*(values[lo]/scale)+t*(values[hi]/scale))*scale
}
export function stableStatistic(values,op,q,sample=false) {
  if(op==='count')return values.length
  if(!values.length)return null
  if(op==='min')return values[0]
  if(op==='max')return values.at(-1)
  if(op==='median'||op==='quantile')return quantileSorted(values,op==='median'?0.5:q)
  if(op==='stddev'&&values.length-(sample?1:0)===0)return null
  const scale=Math.max(...values.map(Math.abs));if(!scale)return 0
  let sum=0,error=0
  for(const value of values){const next=value/scale,total=sum+next;error+=Math.abs(sum)>=Math.abs(next)?(sum-total)+next:(next-total)+sum;sum=total}
  sum+=error
  const mean=sum/values.length
  let result
  if(op==='sum')result=sum*scale
  else if(op==='mean')result=mean*scale
  else {const denominator=values.length-(sample?1:0);if(!denominator)return null;result=Math.sqrt(values.reduce((sum,value)=>sum+(value/scale-mean)**2,0)/denominator)*scale}
  if(!Number.isFinite(result))throw Error(`stat ${op} exceeds finite numeric range; rescale the input`)
  return result
}
export function validateDistribution(op,d,field,params,errors,label) {
  field(d.field)
  if(op==='boxplot') {
    field(d.by)
    if(d.whisker!=null&&(typeof d.whisker!=='number'||!Number.isFinite(d.whisker)||d.whisker<0||d.whisker>10))errors.push(`${label}: boxplot whisker must be 0..10 IQR`)
  } else if(op==='histogram') {
    if(d.bins!=null&&d.bins!=='auto'&&(!Number.isInteger(d.bins)||d.bins<1||d.bins>200))errors.push(`${label}: histogram bins must be auto or 1..200`)
    if(d.widthParam!=null&&!params.some(p=>p.name===d.widthParam&&p.type==='number'))errors.push(`${label}: histogram widthParam requires a declared numeric parameter`)
    if(d.width!=null&&(typeof d.width!=='number'||!Number.isFinite(d.width)||d.width<=0))errors.push(`${label}: histogram width must be finite and positive`)
    if([d.width,d.widthParam].filter(v=>v!=null).length>1||(d.bins!=null&&(d.width!=null||d.widthParam!=null)))errors.push(`${label}: choose bins, width or widthParam, not multiple bin modes`)
  }
}
const label=value=>Number(value.toPrecision(8)).toString()
export function deriveDistribution(op,d,get,n,params={}) {
  const source=get(d.field),records=[]
  for(let index=0;index<n;index++){const value=finite(source[index]);if(value!=null)records.push({value,index})}
  records.sort((a,b)=>a.value-b.value||a.index-b.index)
  if(op==='ecdf') {
    if(!records.length)return {data:[],count:0}
    const groups=new Map()
    for(const record of records){if(!groups.has(record.value))groups.set(record.value,[]);groups.get(record.value).push(record.index)}
    let cumulative=0
    const data=[{name:String(records[0].value),value:[records[0].value,0],rowIndexes:[]}]
    for(const [value,rowIndexes] of groups){cumulative+=rowIndexes.length;data.push({name:String(value),value:[value,cumulative/records.length],rowIndexes})}
    return {data,count:records.length}
  }
  if(op==='boxplot') {
    const by=get(d.by),groups=new Map()
    for(let i=0;i<n;i++)if(finite(source[i])!=null&&!groups.has(String(by[i]??'(Blank)')))groups.set(String(by[i]??'(Blank)'),[])
    for(const record of records)groups.get(String(by[record.index]??'(Blank)')).push(record)
    if(groups.size>2000)throw Error('boxplot exceeds 2000 groups; filter the input')
    const categories=[],boxes=[],outliers=[]
    for(const [name,group] of groups) {
      const values=group.map(r=>r.value),q1=quantileSorted(values,0.25),median=quantileSorted(values,0.5),q3=quantileSorted(values,0.75),scale=Math.max(...values.map(Math.abs))||1
      const spread=(q3/scale-q1/scale)*(d.whisker??1.5),lo=q1/scale-spread,hi=q3/scale+spread
      const inner=group.filter(r=>r.value/scale>=lo&&r.value/scale<=hi),index=categories.length
      categories.push(name)
      boxes.push({name,value:[inner[0]?.value??q1,q1,median,q3,inner.at(-1)?.value??q3],rowIndexes:group.map(r=>r.index)})
      for(const record of group)if(record.value/scale<lo||record.value/scale>hi)outliers.push({name,value:[index,record.value],rowIndexes:[record.index]})
    }
    return {categories,boxes,outliers}
  }
  if(!records.length)return {categories:[],data:[],count:0}
  const min=records[0].value,max=records.at(-1).value,scale=Math.max(Math.abs(min),Math.abs(max))||1,low=min/scale,high=max/scale,span=high-low
  const width=d.widthParam!=null?params[d.widthParam]:d.width
  if((d.width!=null||d.widthParam!=null)&&(typeof width!=='number'||!Number.isFinite(width)||width<=0))throw Error('histogram bin width must be finite and positive')
  let count=1,normalizedWidth
  if(span) {
    if(width!=null){normalizedWidth=Math.min(span,width/scale);count=Math.ceil(span/normalizedWidth)}
    else if(Number.isInteger(d.bins))count=d.bins
    else {const normalized=records.map(r=>r.value/scale),iqr=quantileSorted(normalized,0.75)-quantileSorted(normalized,0.25),fd=2*iqr/Math.cbrt(records.length);count=Math.min(200,Math.max(1,fd?Math.ceil(span/fd):Math.ceil(Math.log2(records.length))+1))}
  }
  if(!Number.isFinite(count)||count<1||count>200)throw Error('histogram exceeds 200 bins; increase the bin width or filter the data')
  normalizedWidth=normalizedWidth??(span/count)
  const data=Array.from({length:count},(_,index)=>{
    const lower=span?(low+index*normalizedWidth)*scale:min,upper=span?(index===count-1?max:Math.min(high,low+(index+1)*normalizedWidth)*scale):max
    return {name:lower===upper?label(lower):`${label(lower)} - ${label(upper)}`,value:0,rowIndexes:[],lower,upper}
  })
  for(const record of records){const index=span?Math.max(0,Math.min(count-1,Math.floor((record.value/scale-low)/normalizedWidth))):0;data[index].value++;data[index].rowIndexes.push(record.index)}
  return {categories:data.map(d=>d.name),data,count:records.length}
}
