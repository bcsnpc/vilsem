// Image statistics only: no OCR, model, network or inferred business values.
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]))
const hex=rgb=>'#'+rgb.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('').toUpperCase()
export function extractDesignTokens({image}){
 const {width,height,data}=image||{}
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<8||height<8||width*height>4000000||!(data instanceof Uint8Array)||data.length!==width*height*4)throw Error('image must be decoded RGBA Uint8Array, dimensions >=8 and <=4000000 pixels')
 const bins=new Map(),edges=new Map(),stride=Math.max(1,Math.floor(Math.sqrt(width*height/200000)))
 const pixel=(x,y)=>{const i=(y*width+x)*4,alpha=data[i+3]/255;return [0,1,2].map(c=>data[i+c]*alpha+255*(1-alpha))}
 const key=rgb=>rgb.map(v=>Math.min(15,Math.floor(v/16))).join(',')
 const add=(map,rgb)=>{const k=key(rgb),entry=map.get(k)||{count:0,sum:[0,0,0]};entry.count++;rgb.forEach((v,i)=>entry.sum[i]+=v);map.set(k,entry)}
 let sampled=0
 for(let y=0;y<height;y+=stride)for(let x=0;x<width;x+=stride){const rgb=pixel(x,y);add(bins,rgb);sampled++;if(x<width*.03||x>width*.97||y<height*.03||y>height*.97)add(edges,rgb)}
 const ranked=map=>[...map.values()].sort((a,b)=>b.count-a.count).map(b=>({rgb:b.sum.map(v=>v/b.count),count:b.count}))
 const background=ranked(edges)[0].rgb,palette=[]
 for(const item of ranked(bins)){
  if(item.count/sampled<.001||distance(item.rgb,background)<45)continue
  const cluster=palette.find(p=>distance(p.rgb,item.rgb)<40)
  if(cluster){const total=cluster.count+item.count;cluster.rgb=cluster.rgb.map((v,i)=>(v*cluster.count+item.rgb[i]*item.count)/total);cluster.count=total}else palette.push(item)
 }
 palette.sort((a,b)=>b.count-a.count)
 const luminance=background.reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0)/255
 // Long neutral runs distinguish likely grid strokes from coloured data marks.
 const runs=[],inkRows=[]
 for(let y=0;y<height;y+=stride){let neutral=0,ink=0
  for(let x=Math.floor(width*.1);x<width*.9;x+=stride){const rgb=pixel(x,y),spread=Math.max(...rgb)-Math.min(...rgb),delta=distance(rgb,background);if(delta>18&&delta<180&&spread<20)neutral++;if(delta>90&&spread<45)ink++}
  const line=neutral*stride/(width*.8)>.65
  if(line)runs.push(y)
  inkRows.push({y,ink:ink*stride/(width*.8),line})
 }
 const bands=[];let current
 for(const row of inkRows){if(!row.line&&row.ink>.005&&row.ink<.8){if(!current)current={top:row.y,bottom:row.y};current.bottom=row.y}else if(current){bands.push(current);current=null}}
 if(current)bands.push(current)
 const title=bands.filter(b=>b.bottom<height*.3).map(b=>b.bottom-b.top+stride).filter(h=>h>=5&&h<=height*.2),labels=bands.filter(b=>b.top>=height*.3).map(b=>b.bottom-b.top+stride).filter(h=>h>=3&&h<=height*.15)
 const median=xs=>xs.sort((a,b)=>a-b)[Math.floor(xs.length/2)]
 const fontRatio=title.length&&labels.length?Math.round(Math.max(...title)/median(labels)*100)/100:null
 // Collapse adjacent pixels so one thick line is not reported as many gridlines.
 const lines=runs.filter((y,i)=>i===0||y-runs[i-1]>stride*1.5).length
 return {method:'bounded pixel statistics; no ML/OCR',theme:{background:hex(background),mode:luminance<.45?'dark':'light',palette:palette.slice(0,8).map(p=>hex(p.rgb))},layout:{aspectRatio:width/height,titleLabelFontRatio:fontRatio,gridlines:lines>=2},statistics:{width,height,sampledPixels:sampled,neutralHorizontalLines:lines},limitations:['Palette can include text and annotations; the calling agent must interpret it.','Font ratio is a row-band estimate, not font identification; null means insufficient evidence.','Gridline detection is heuristic and can confuse tables or sketch strokes.','No chart family, series count, legend semantics, fields or numbers are inferred from pixels.']}
}
