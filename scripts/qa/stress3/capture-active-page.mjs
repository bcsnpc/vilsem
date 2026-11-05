// Activate this page in Desktop and inspect settled marks BEFORE invoking.
// Snapshot success alone does not establish that an inactive page queried data.
import {connectToBridge,withBridgeRetry} from '@microsoft/powerbi-desktop-bridge-cli'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
const [pid,reportDir,pageName,outputDir,visibleIds]=process.argv.slice(2)
if(!/^\d+$/.test(pid||'')||!reportDir||!/^stress[23]_[\w-]+$/.test(pageName||'')||!outputDir||!visibleIds)
  throw Error('Usage: capture-active-page.mjs PID REPORT_DIR PAGE OUTPUT_DIR VISIBLE_VISUAL_IDS_COMMA_SEPARATED')
const requested=visibleIds.split(',')
if(!requested.length||requested.some(n=>!/^(?:stress2_\d{3}_[\w-]+|stress3_custom_bar)$/.test(n))||new Set(requested).size!==requested.length)
  throw Error('Specify unique visual IDs observed fully inside the viewport; offscreen regions can capture Desktop chrome or blanks')
const base=path.join(reportDir,'definition/pages',pageName,'visuals')
const guid='semanticaRenderer4A7F2D9B8C3E1F5A6D4B2C8E9F1A3B7D'
const rendererFile=path.join(reportDir,'CustomVisuals',guid,'resources',guid+'.pbiviz.json')
const rendererSha256=crypto.createHash('sha256').update(await fs.readFile(rendererFile)).digest('hex')
const connection=await connectToBridge({pid,waitMs:30000})
try{
  const method='report.snapshot.capture/v2'
  if(!connection.manifest.methods.find(m=>m.name===method)?.params?.properties?.args?.properties?.region)
    throw Error('Desktop does not advertise region capture')
  await fs.mkdir(outputDir,{recursive:true})
  const captures=[]
  for(const name of requested){
    const visualBytes=await fs.readFile(path.join(base,name,'visual.json'))
    const visual=JSON.parse(visualBytes.toString('utf8').replace(/^\uFEFF/,''))
    const {x,y,width,height}=visual.position
    if(![x,y,width,height].every(Number.isFinite)||width<=0||height<=0)throw Error('Invalid bounds: '+name)
    const result=await withBridgeRetry(()=>connection.client.sendBridgeMethod(method,{pageId:pageName,scale:3,region:{x,y,width,height}}),{timeoutMs:30000})
    if(result.mimeType!=='image/png'||!result.payload)throw Error('Invalid capture: '+name)
    const png=Buffer.from(result.payload,result.encoding||'base64')
    const output=path.join(outputDir,name+'.png')
    await fs.writeFile(output,png)
    const record={reportName:path.basename(reportDir),pageName,visualName:name,method,rendererSha256,visualSha256:crypto.createHash('sha256').update(visualBytes).digest('hex'),region:{x,y,width,height},width:png.readUInt32BE(16),height:png.readUInt32BE(20),sha256:crypto.createHash('sha256').update(png).digest('hex'),status:'Captured; visual inspection pending'}
    await fs.writeFile(output+'.json',JSON.stringify(record,null,2)+'\n')
    captures.push(record)
  }
  await fs.writeFile(path.join(outputDir,pageName+'-captures.json'),JSON.stringify(captures,null,2)+'\n')
  console.log(JSON.stringify({pageName,captured:captures.length,verification:'Not inferred from capture success'}))
}finally{connection.client.dispose()}
