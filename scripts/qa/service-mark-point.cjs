// Locate native click coordinates from the same production compositions. This
// predicts geometry only; the Service audit verifies the real host's filter result.
const path=require('node:path'),fs=require('node:fs')
const root=path.resolve(__dirname,'../..')
module.exports=async function createPointLocator(){
 const {createServer}=await import('vite')
 const server=await createServer({root,configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,watch:null},appType:'custom'})
 let composeOption,getThemeTokens
 try{
  ;({composeOption}=await server.ssrLoadModule('/pbiviz-semantica-renderer/src/compositions.ts'))
  ;({default:getThemeTokens}=await server.ssrLoadModule('/ui/src/appspec/getThemeTokens.ts'))
 }finally{await server.close()}
 const echarts=require('../../pbiviz-semantica-renderer/node_modules/echarts')
 const parts=JSON.parse(fs.readFileSync(path.join(root,'cache/qa-target-gallery/report-parts.json')))
 const specs=parts.filter(p=>p.path.endsWith('/visual.json')).map(p=>{
  const value=JSON.parse(p.content).visual.objects.semantica[0].properties.primitiveSpec.expr.Literal.Value
  return JSON.parse(value.slice(1,-1).replaceAll("''","'"))
 })
 return (type,width,height,nativeTextWidths)=>{
  const missing=new Set()
  if(nativeTextWidths)echarts.setPlatformAPI({measureText(text,font){
   const size=Number(font?.match(/([\d.]+)px/)?.[1]||12),weight=font?.match(/\b[1-9]00\b/)?.[0]||(font?.includes('bold')?'700':'400'),key=`${size}|${weight}|${text}`
   const measured=nativeTextWidths[key]
   if(measured===undefined)missing.add(key)
   return {width:measured??String(text).length*size*.6}
  }})
  const spec=specs.find(s=>s.type===type)
  if(!spec)throw Error(`No QA fixture for ${type}`)
  const rows=[['Accessories',57809,1130,16983],['Bikes',13929,429,13929],['Clothing',12436,269,6976]].map(([cat,...values])=>Object.fromEntries([['_cat',cat],...values.slice(0,spec.measures.all.length).map((v,i)=>[i?`_val${i+1}`:'_val',v])]))
  const chart=echarts.init(null,null,{renderer:'svg',ssr:true,width,height})
  try{
   const option=composeOption(type,rows,{...spec.config,measureName:spec.measures.primary,secondaryMeasureName:spec.measures.secondary},getThemeTokens('dark'))
   chart.setOption({...option,animation:false,textStyle:{fontFamily:"Inter, 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",...option.textStyle}})
   const series=chart.getModel().getSeriesByIndex(type==='lollipop'?1:0),data=series.getData()
   let point,category='Accessories'
   if(type==='radar'){point=data.getItemLayout(0)[1];category='Bikes'}
   else if(type==='pie'||type==='donut'){
    const d=data.getItemLayout(0),a=(d.startAngle+d.endAngle)/2,r=(d.r+d.r0)/2
    point=[d.cx+Math.cos(a)*r,d.cy+Math.sin(a)*r]
   }else if(type==='treemap'){
    const el=data.getItemGraphicEl(data.indexOfName(category)),r=el.getBoundingRect().clone();r.applyTransform(el.getComputedTransform());point=[r.x+r.width/2,r.y+r.height/2]
   }else if(['bar','stacked_bar','grouped_bar','column'].includes(type)){
    const d=data.getItemLayout(0);point=[d.x+d.width/2,d.y+d.height/2]
   }else{
    point=chart.convertToPixel({seriesIndex:series.seriesIndex},[data.get(data.mapDimension('x'),0),data.get(data.mapDimension('y'),0)])
   }
   if(!point?.every(Number.isFinite))throw Error(`No finite mark point for ${type}`)
   return {x:point[0],y:point[1],category,width,height,unmeasuredText:[...missing]}
  }finally{chart.dispose()}
 }
}
