const fs=require('node:fs'),path=require('node:path')
const root=path.resolve(__dirname,'../..')
const cfg=JSON.parse(fs.readFileSync(path.join(process.env.APPDATA,'vilsem','workspaces.json'),'utf8'))
const ws=cfg.workspaces.find(w=>w.id===cfg.activeWorkspace)
if(!ws||cfg.loggedOut)throw Error('Connect the QA Fabric workspace first')
const previous=process.argv.includes('--reuse')?JSON.parse(fs.readFileSync(path.join(root,'docs/qa/evidence/fabric-gallery-deployment.json'),'utf8')):null
const parent=previous?path.dirname(previous.result.projectDir):fs.mkdtempSync(path.join(root,'cache/qa-fabric-gallery-'))
const spec=JSON.parse(fs.readFileSync(path.join(root,'cache/qa-target-gallery/fabric-spec.json'),'utf8'))
const name=previous?previous.name:'vilsem-qa-gallery-'+Date.now()
const target=path.resolve(parent,name)
if(!target.startsWith(path.resolve(root,'cache')+path.sep)||!name.startsWith('vilsem-qa-gallery-')||(!previous&&fs.existsSync(target)))throw Error('Expected an isolated QA deployment directory')
const logFile=path.join(parent,'deploy.log')
require('../../electron/fabric/runRayfin').deployToFabric(spec,{appName:name,workspace:ws.workspaceName,workspaceId:ws.workspaceId,modelWorkspaceId:ws.workspaceId,datasetId:ws.datasetId,parentDir:parent,reuseExisting:!!previous},chunk=>{
  fs.appendFileSync(logFile,chunk.text);process.stdout.write(chunk.text)
}).then(result=>{
 fs.writeFileSync(path.join(root,'docs/qa/evidence/fabric-gallery-deployment.json'),JSON.stringify({at:new Date().toISOString(),name,visualCount:spec.pages.flatMap(p=>p.visuals).length,logFile,result},null,2))
 process.exitCode=result.ok?0:1
}).catch(e=>{console.error(e.message);process.exitCode=1})
