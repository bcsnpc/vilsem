// Deterministic bounded circle packing along a value axis. Caller code cannot run.
export function validateJitter(d,field,errors,label) {
  field(d.by);field(d.field);if(d.name!=null)field(d.name)
  if(d.method!=='collision')errors.push(`${label}: jitter method must be collision`)
  for(const key of ['width','height'])if(d[key]!=null&&(typeof d[key]!=='number'||!Number.isFinite(d[key])||d[key]<100||d[key]>2000))errors.push(`${label}: jitter ${key} must be 100..2000`)
  if(d.radius!=null&&(typeof d.radius!=='number'||!Number.isFinite(d.radius)||d.radius<1||d.radius>12))errors.push(`${label}: jitter radius must be 1..12`)
  if(d.expressionGeometry!=null&&typeof d.expressionGeometry!=='boolean')errors.push(`${label}: jitter expressionGeometry must be boolean`)
}
export function deriveJitter(d,get,n) {
  const raw=get(d.field),by=get(d.by),names=d.name?get(d.name):[],groups=new Map(),width=d.width??700,height=d.height??420
  let min=Infinity,max=-Infinity,count=0
  for(let i=0;i<n;i++) {
    const value=raw[i]!=null&&raw[i]!==''?Number(raw[i]):NaN;if(!Number.isFinite(value))continue
    const group=String(by[i]??'(Blank)');if(!groups.has(group))groups.set(group,[])
    groups.get(group).push({value,index:i,name:String(names[i]??group)});count++;min=Math.min(min,value);max=Math.max(max,value)
  }
  if(count>2000||groups.size>36)throw Error('jitter exceeds 2000 points or 36 groups; filter the input')
  if(!count)return {data:[],groups:[],min:null,max:null,height,symbolSize:2*(d.radius??3),...(d.expressionGeometry?{expressionData:[]}: {})}
  const scale=Math.max(1,Math.abs(min),Math.abs(max));let low=min/scale,high=max/scale
  if(low===high){const span=Math.max(Math.abs(low)*0.1,0.01);low-=span/2;high+=span/2}
  const padding=(high-low)*10/(width-20);low-=padding;high+=padding
  if(!Number.isFinite(low*scale)||!Number.isFinite(high*scale))throw Error('jitter axis bounds exceed finite numeric range; rescale the input')
  const band=height/groups.size,ordered=[...groups].map(([name,rows],index)=>({name,index,rows:rows.sort((a,b)=>a.value-b.value||a.index-b.index)}))
  let radius=d.radius??3,checks=0
  for(;;) {
    const data=[];let failed=false
    for(const group of ordered) {
      const active=[],counts=new Map();for(const row of group.rows)counts.set(row.value,(counts.get(row.value)??0)+1)
      for(const record of group.rows) {
        const x=(record.value/scale-low)/(high-low)*width,base=(group.index+0.5)*band
        while(active.length&&x-active[0].x>=2*radius)active.shift()
        const candidates=[],limit=Math.floor((band/2-radius)/radius)
        if(counts.get(record.value)%2){candidates.push(0);for(let k=1;k<=limit;k++)candidates.push(-k*radius,k*radius)}
        else for(let k=1;k<=limit;k+=2)candidates.push(-k*radius,k*radius)
        let offset
        for(const candidate of candidates) {
          let collision=false
          for(const previous of active) {
            if(++checks>2000000)throw Error('jitter exceeds 2000000 collision checks; filter the input')
            if((x-previous.x)**2+(candidate-previous.offset)**2<4*radius*radius-1e-8){collision=true;break}
          }
          if(!collision){offset=candidate;break}
        }
        if(offset==null){failed=true;break}
        active.push({x,offset})
        data.push({name:record.name,label:`${group.name} / ${record.name}: ${record.value}`,value:[record.value,base+offset],rowIndexes:[record.index]})
      }
      if(failed)break
    }
    if(!failed)return {data,groups:ordered.map(g=>({name:g.name,value:(g.index+0.5)*band,rowIndexes:g.rows.map(r=>r.index)})),min:low*scale,max:high*scale,height,symbolSize:2*radius,...(d.expressionGeometry?{expressionData:data.map(point=>({...point,value:[...point.value,radius,(high-low)*scale,width,height]}))}:{})}
    if(radius===1)throw Error('jitter collision layout is too dense; reduce points/categories or enlarge the viewport')
    radius=Math.max(1,radius*0.8)
  }
}
