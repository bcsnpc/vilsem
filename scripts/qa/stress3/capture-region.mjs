// Official Desktop Bridge SDK; no screen-colour inference or model writes.
import {connectToBridge,withBridgeRetry} from '@microsoft/powerbi-desktop-bridge-cli'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
const [pid,reportDir,pageName,visualName,output,scaleArg='3']=process.argv.slice(2)
const scale=Number(scaleArg)
if(!Number.isFinite(scale)||scale<1||scale>3)throw Error('Scale must be 1..3')
if(!/^\d+$/.test(pid||'')||!reportDir||!pageName||!visualName||!output)throw Error('Usage: capture-region.mjs PID REPORT_DIR PAGE_ID VISUAL_ID OUTPUT.png')
if(!/^[\w-]+$/.test(pageName)||!/^[\w-]+$/.test(visualName))throw Error('Invalid PBIR IDs')
const visualPath=path.join(reportDir,'definition/pages',pageName,'visuals',visualName,'visual.json')
const visual=JSON.parse((await fs.readFile(visualPath,'utf8')).replace(/^\uFEFF/,''))
const {x,y,width,height}=visual.position
if(![x,y,width,height].every(Number.isFinite)||width<=0||height<=0)throw Error('Invalid visual bounds')
const connection=await connectToBridge({pid,waitMs:30000})
try{
 const method='report.snapshot.capture/v2'
 const definition=connection.manifest.methods.find(m=>m.name===method)
 if(!definition?.params?.properties?.args?.properties?.region)throw Error('This Desktop instance does not advertise logical-region capture')
 const result=await withBridgeRetry(()=>connection.client.sendBridgeMethod(method,{pageId:pageName,scale,region:{x,y,width,height}}),{timeoutMs:30000})
 if(result.mimeType!=='image/png'||!result.payload)throw Error('Expected a native PNG snapshot')
 const png=Buffer.from(result.payload,result.encoding||'base64')
 const dimensions={width:png.readUInt32BE(16),height:png.readUInt32BE(20)}
 await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,png)
 await fs.writeFile(output+'.json',JSON.stringify({method,pageName,visualName,region:{x,y,width,height},dimensions,sha256:crypto.createHash('sha256').update(png).digest('hex')},null,2)+'\n')
 console.log(JSON.stringify({output,...dimensions}))
}finally{connection.client.dispose()}
