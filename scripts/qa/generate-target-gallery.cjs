// Deterministic gallery using existing AdventureWorks measures; no model writes.
const fs=require('node:fs'),path=require('node:path'),AdmZip=require('adm-zip')
const root=path.resolve(__dirname,'../..');process.chdir(root)
;(async()=>{
 const {createServer}=await import('vite')
 const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,watch:null},appType:'custom'})
 try{
  const {buildLocalReportParts}=await server.ssrLoadModule('/ui/src/pages/powerbi/localReportBuilder.js')
  const types=['bar','stacked_bar','grouped_bar','column','line','area','stacked_area','bump','donut','pie','scatter','bubble','treemap','radar','gauge','table','slope','lollipop','bar_race']
  const measures=['Quantity Sold','Quantity Returned','Total Orders'].map(name=>({name,table:'Measure Table'}))
  const spec={version:'1.0',title:'Vilsem QA target gallery',theme:{mode:'dark'},layout:{pageWidth:1440,pageHeight:1000,freeform:true,rowHeight:96,gap:12},pages:[]}
  for(let offset=0;offset<types.length;offset+=6)spec.pages.push({id:`gallery${offset}`,name:`Visuals ${offset+1}-${Math.min(offset+6,types.length)}`,slicers:[],visuals:types.slice(offset,offset+6).map((type,i)=>({id:`qa_${type}`,type,position:{x:(i%3)*4,y:Math.floor(i/3)*4,w:4,h:4},data:{measures:measures.slice(0,['grouped_bar','stacked_bar','stacked_area','line','table','scatter','bubble','bump','slope'].includes(type)?3:1).map(m=>m.name),groupBy:{table:'Product Categories Lookup',column:'CategoryName'}},config:{title:type,animations:false,animationEnabled:false}}))})
  for(const page of spec.pages)for(const visual of page.visuals){
    if(visual.type==='gauge')visual.data.groupBy=null
    if(visual.type==='bar_race')visual.config.playAxis='Calendar Lookup[Year]'
  }
  const files=fs.readdirSync('pbiviz-semantica-renderer/dist').filter(f=>f.endsWith('.pbiviz')).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))
  const zip=new AdmZip(path.resolve('pbiviz-semantica-renderer/dist',files.at(-1))),entries=zip.getEntries().filter(e=>!e.isDirectory),pkg=JSON.parse(entries.find(e=>e.entryName==='package.json').getData()),guid=pkg.visual.guid
  const bundle={success:true,guid,parts:entries.map(e=>({path:`CustomVisuals/${guid}/${e.entryName}`,payloadType:'InlineBase64',payload:e.getData().toString('base64')}))}
  const parts=buildLocalReportParts({spec,measures,bundle})
  fs.mkdirSync('cache/qa-target-gallery',{recursive:true})
  fs.writeFileSync('cache/qa-target-gallery/report-parts.json',JSON.stringify(parts))
  fs.writeFileSync('cache/qa-target-gallery/spec.json',JSON.stringify(spec,null,2))
  console.log(JSON.stringify({types,pages:spec.pages.length,parts:parts.length,bundle:files.at(-1)}))
 }finally{await server.close()}
})().catch(e=>{console.error(e.message);process.exitCode=1})
