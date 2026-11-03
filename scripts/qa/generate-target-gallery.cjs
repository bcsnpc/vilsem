// Deterministic gallery using existing AdventureWorks measures; no model writes.
const fs=require('node:fs'),path=require('node:path'),AdmZip=require('adm-zip')
const root=path.resolve(__dirname,'../..');process.chdir(root)
;(async()=>{
 const {createServer}=await import('vite')
 const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,watch:null},appType:'custom'})
 try{
  const {buildLocalReportParts}=await server.ssrLoadModule('/ui/src/pages/powerbi/localReportBuilder.js')
  const types=require('@vilsem/core/spec/types')
  const measures=['Quantity Sold','Quantity Returned','Total Orders'].map(name=>({name,table:'Measure Table'}))
  const spec={version:'1.0',title:'Vilsem QA target gallery',theme:{mode:'dark'},layout:{pageWidth:1440,pageHeight:1000,freeform:true,rowHeight:96,gap:12},pages:[]}
  for(let offset=0;offset<types.length;offset+=6)spec.pages.push({id:`gallery${offset}`,name:`Visuals ${offset+1}-${Math.min(offset+6,types.length)}`,slicers:[],visuals:types.slice(offset,offset+6).map((type,i)=>({id:`qa_${type}`,type,position:{x:(i%3)*4,y:Math.floor(i/3)*4,w:4,h:4},data:{measures:measures.slice(0,['grouped_bar','stacked_bar','stacked_area','line','table','scatter','bubble','bump','slope'].includes(type)?3:1).map(m=>m.name),groupBy:{table:'Product Categories Lookup',column:'CategoryName'}},config:{title:type,animations:false,animationEnabled:false}}))})
  for(const page of spec.pages)for(const visual of page.visuals){
    if(process.argv.includes('--secondary-axis')&&['line','area'].includes(visual.type)){
      visual.data.measures=measures.slice(0,2).map(m=>m.name)
      Object.assign(visual.config,{secondaryAxisEnabled:true,secondaryAxisTitle:'Returns',secondaryAxisLabelColor:'#f472b6',secondaryAxisTitleColor:'#f472b6',secondaryAxisLineColor:'#f472b6',secondaryAxisLabelSize:14,showYAxis:true})
      if(process.argv.includes('--narrow-secondary-axis'))visual.position.w=1
    }
    if(['gauge','bullet','progress','stat_card','metric_tile'].includes(visual.type))visual.data.groupBy=null
    if(['bullet','stat_card'].includes(visual.type))visual.data.measures=measures.slice(0,2).map(m=>m.name)
    if(['shape','divider'].includes(visual.type)){visual.data={measures:[]};visual.config={shape:'star',fill:'#14b8a6',color:'#ff00ff',thickness:7}}
    if(visual.type==='bar_race')visual.config.playAxis='Calendar Lookup[Year]'
  }
  const files=fs.readdirSync('vilsem-renderer/dist').filter(f=>f.endsWith('.pbiviz')).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))
  const zip=new AdmZip(path.resolve('vilsem-renderer/dist',files.at(-1))),entries=zip.getEntries().filter(e=>!e.isDirectory),pkg=JSON.parse(entries.find(e=>e.entryName==='package.json').getData()),guid=pkg.visual.guid
  const bundle={success:true,guid,parts:entries.map(e=>({path:`CustomVisuals/${guid}/${e.entryName}`,payloadType:'InlineBase64',payload:e.getData().toString('base64')}))}
  // Optional focused gallery uses the same production export path as the full gallery.
  if(process.argv.includes('--waffle-pilot'))spec.pages=[{id:'waffle-pilot',name:'Waffle pilot',slicers:[],visuals:[{id:'qa_waffle',type:'waffle',position:{x:0,y:0,w:4,h:4},data:{measures:['Quantity Sold'],groupBy:{table:'Product Categories Lookup',column:'CategoryName'}},config:{title:'waffle',customColors:['#ff0000','#00ff00','#0000ff'],cellSize:13,cellGap:3,cellRadius:4}}]}]
  if(process.argv.includes('--dom-card-pilot'))spec.pages=[{id:'dom-cards',name:'DOM card pilot',slicers:[],visuals:['bullet','progress'].map((type,i)=>({id:'qa_'+type,type,position:{x:i*4,y:0,w:4,h:4},data:{measures:measures.slice(0,type==='bullet'?2:1).map(m=>m.name)},config:{title:type,maxValue:100000,barColor:'#ff0000',barEndColor:'#00ff00',targetColor:'#ff00ff',percentageColor:'#00ffff'}}))}]
  const parts=buildLocalReportParts({spec,measures,bundle})
  fs.mkdirSync('cache/qa-target-gallery',{recursive:true})
  fs.writeFileSync('cache/qa-target-gallery/report-parts.json',JSON.stringify(parts))
  fs.writeFileSync('cache/qa-target-gallery/spec.json',JSON.stringify(spec,null,2))
  console.log(JSON.stringify({types,pages:spec.pages.length,parts:parts.length,bundle:files.at(-1)}))
 }finally{await server.close()}
})().catch(e=>{console.error(e.message);process.exitCode=1})
