// Conservative fixed-font rectangle packing, not an external wordCloud plugin.
// Words are laid out as ordinary labelled graph nodes on fixed numeric axes.
export function validateWords(d,field,errors,label) {
 field(d.text);field(d.weight)
 for(const [key,min,max] of [['limit',1,100],['width',300,1600],['height',150,1000],['minFont',8,40],['maxFont',8,80]])if(d[key]!=null&&(!Number.isInteger(d[key])||d[key]<min||d[key]>max))errors.push(`${label}: words ${key} must be an integer ${min}..${max}`)
 if((d.minFont??12)>(d.maxFont??36))errors.push(`${label}: words minFont must not exceed maxFont`)
}
export function deriveWords(d,get,n) {
 const texts=get(d.text),weights=get(d.weight),terms=new Map(),width=d.width??750,height=d.height??400
 let lineage=0
 for(let index=0;index<n;index++) {
  const raw=weights[index],value=raw!=null&&raw!==''?Number(raw):NaN;if(!Number.isFinite(value))continue;if(value<0)throw Error('words requires non-negative additive weights');if(!value)continue
  const text=String(texts[index]??'');if(text.length>2000)throw Error('words text exceeds 2000 characters')
  const words=new Set((text.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]).filter(w=>[...w].length>=2&&[...w].length<=40))
  for(const word of words){if(++lineage>20000)throw Error('words exceeds 20000 contributor identities; filter the input');if(!terms.has(word))terms.set(word,{name:word,weight:0,rowIndexes:[]});const term=terms.get(word);term.weight+=value;if(!Number.isFinite(term.weight))throw Error('words aggregate exceeds finite numeric range; rescale the input');term.rowIndexes.push(index)}
 }
 const ranked=[...terms.values()].sort((a,b)=>b.weight-a.weight||(a.name<b.name?-1:a.name>b.name?1:0)).slice(0,d.limit??24),data=[]
 if(!ranked.length)return {data:[],width,height,count:0,omittedCount:terms.size}
 const min=ranked.at(-1).weight,max=ranked[0].weight;let checks=0
 for(const term of ranked) {
  const ratio=max===min ? .5 : Math.sqrt((term.weight-min)/(max-min)),font=Math.round((d.minFont??12)+ratio*((d.maxFont??36)-(d.minFont??12)))
  // One em per Unicode code point deliberately overestimates common Latin
  // glyph widths. Restrict fixed output font, no rotations or untrusted CSS.
  const w=[...term.name].length*font*1.05+8,h=font*1.4+6
  if(w>width||h>height)throw Error(`words cannot fit "${term.name}"; reduce maxFont or increase explicit plot dimensions`)
  let placement
  for(let step=0;step<2000;step++) {
   const angle=step*2.399963229728653,radius=step===0?0:2.5*Math.sqrt(step),x=width/2+radius*Math.cos(angle)*2.4,y=height/2+radius*Math.sin(angle)*1.3
   if(x-w/2<0||x+w/2>width||y-h/2<0||y+h/2>height)continue
   let collides=false
   for(const old of data){if(++checks>2000000)throw Error('words exceeds 2000000 collision checks');if(Math.abs(x-old.value[0])<(w+old.bounds.width)/2&&Math.abs(y-old.value[1])<(h+old.bounds.height)/2){collides=true;break}}
   if(!collides){placement={x,y};break}
  }
  if(!placement)throw Error(`words cannot place ${ranked.length} terms without overlap; reduce limit/font size or increase explicit plot dimensions`)
  data.push({id:term.name,name:term.name,value:[placement.x,placement.y,term.weight],rowIndexes:term.rowIndexes,bounds:{width:w,height:h},symbolSize:1,itemStyle:{opacity:0},label:{show:true,opacity:1,position:'inside',fontFamily:'Segoe UI',fontSize:font}})
 }
 return {data,width,height,count:data.length,omittedCount:Math.max(0,terms.size-data.length)}
}
