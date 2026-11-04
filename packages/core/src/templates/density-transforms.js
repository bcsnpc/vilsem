// Fixed trusted density math. No caller functions, randomness or model writes.
import {stableStatistic,quantileSorted} from './distribution-transforms.js'
export function validateDensity(d,field,errors,label) {
  field(d.by);field(d.field)
  if(!['violin','ridgeline'].includes(d.layout))errors.push(`${label}: density layout must be violin|ridgeline`)
  if(d.samples!=null&&(!Number.isInteger(d.samples)||d.samples<16||d.samples>256))errors.push(`${label}: density samples must be 16..256`)
  if(d.bandwidth!=null&&(typeof d.bandwidth!=='number'||!Number.isFinite(d.bandwidth)||d.bandwidth<=0))errors.push(`${label}: density bandwidth must be finite and positive`)
}
export function deriveDensity(d,get,n) {
  const by=get(d.by),values=get(d.field),groups=new Map()
  let scale=0
  for(let index=0;index<n;index++) {
    const raw=values[index],value=raw!=null&&raw!==''?Number(raw):NaN;if(!Number.isFinite(value))continue
    const name=String(by[index]??'(Blank)');if(!groups.has(name))groups.set(name,[])
    groups.get(name).push({value,index});scale=Math.max(scale,Math.abs(value))
  }
  if(groups.size>36)throw Error('density exceeds 36 groups; filter the input')
  if(!groups.size)return {panels:[],categories:[],min:null,max:null,groupMax:null}
  scale=scale||1
  const panels=[],categories=[],samples=d.samples??64
  let min=Infinity,max=-Infinity,lineage=0,points=0,rawLineage=0
  for(const [name,records] of groups) {
    records.sort((a,b)=>a.value-b.value||a.index-b.index)
    const numeric=records.map(r=>r.value/scale),sd=stableStatistic(numeric,'stddev',undefined,true),iqr=(quantileSorted(numeric,0.75)-quantileSorted(numeric,0.25))/1.34
    // Normal-reference heuristic; constant groups get an explicit positive
    // fallback. This is not a promise of bit-identical R density output.
    const spread=Math.min(sd||Infinity,iqr||Infinity)
    const h=d.bandwidth!=null?d.bandwidth/scale:0.9*(Number.isFinite(spread)?spread:Math.max(Math.abs(numeric[0])*0.05,0.01))*Math.pow(records.length,-0.2)
    const low=numeric[0]-4*h,high=numeric.at(-1)+4*h
    if(!(h>0)||!Number.isFinite(h)||![low*scale,high*scale,h*scale].every(Number.isFinite)||h*scale===0)throw Error('density bounds/bandwidth exceed finite numeric range; rescale the input')
    const curve=[]
    for(let i=0;i<samples;i++) {
      const x=low+(high-low)*i/(samples-1),rowIndexes=[]
      let sum=0
      // The Gaussian is explicitly truncated at four bandwidths and normalized
      // by its retained mass. Source identities are local contributors only.
      for(let j=0;i>0&&i<samples-1&&j<records.length;j++) {
        const u=(x-numeric[j])/h
        if(Math.abs(u)<4){if(++rawLineage*(d.layout==='violin'?2:1)>20000)throw Error('density exceeds 20000 contributor identities; reduce samples or filter the input');sum+=Math.exp(-0.5*u*u);rowIndexes.push(records[j].index)}
      }
      const density=sum/(records.length*h*Math.sqrt(2*Math.PI)*0.9999366575163338)/scale
      if(!Number.isFinite(density))throw Error('density exceeds finite numeric range; rescale the input')
      const value=x*scale
      curve.push({price:value,density,rowIndexes,label:`${name}: value ${Number(value.toPrecision(8))}, density ${Number(density.toPrecision(6))}`})
    }
    const peak=Math.max(...curve.map(p=>p.density)),index=panels.length
    if(!peak)throw Error('density sample grid misses the kernel peaks; increase samples or bandwidth')
    min=Math.min(min,low*scale);max=Math.max(max,high*scale);categories.push(name)
    let data
    if(d.layout==='violin') {
      data=curve.map(p=>({name,label:p.label,density:p.density,value:[index-0.4*p.density/peak,p.price],rowIndexes:p.rowIndexes})).concat([...curve].reverse().map(p=>({name,label:p.label,density:p.density,value:[index+0.4*p.density/peak,p.price],rowIndexes:p.rowIndexes})))
    } else data=curve.map(p=>({name,label:p.label,density:p.density,value:[p.price,index+0.8*p.density/peak],rowIndexes:p.rowIndexes}))
    points+=data.length;lineage+=data.reduce((sum,p)=>sum+p.rowIndexes.length,0)
    if(points>20000||lineage>20000)throw Error('density exceeds 20000 points or contributor identities; reduce samples or filter the input')
    panels.push({name,index,data,bandwidth:h*scale,rowIndexes:records.map(r=>r.index)})
  }
  return {panels,categories,min,max,groupMax:panels.length-0.5}
}
