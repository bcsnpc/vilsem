const {spawn}=require('node:child_process')
const path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto')
const {inspectLocalProject}=require('./localProject')
let active=null
function bridge(payload){return new Promise((resolve,reject)=>{
 const child=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'localBridge.ps1').replace(/app\.asar([\\/])/, 'app.asar.unpacked$1')],{windowsHide:true,stdio:['pipe','pipe','pipe']});let output='',errors='';const timeout=setTimeout(()=>{child.kill();reject(Error('Local Power BI query timed out. Check that the model is open in Desktop.'))},60000)
 child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>errors+=b);child.on('error',e=>{clearTimeout(timeout);reject(e)});child.on('close',code=>{clearTimeout(timeout);try{const r=JSON.parse(output.replace(/^\uFEFF/,''));if(code||r.error)reject(Error(r.error||'Local query failed'));else resolve(r)}catch{reject(Error(errors||'Local Power BI returned an invalid response.'))}});child.stdin.end(JSON.stringify(payload))
})}
function fingerprint(model){const hash=crypto.createHash('sha256');function visit(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){if(item.name==='.pbi')continue;const file=path.join(dir,item.name);if(item.isSymbolicLink())throw Error('Linked model definitions are not supported.');if(item.isDirectory())visit(file);else if(/\.(tmdl|bim)$/.test(item.name)){hash.update(path.relative(model,file));hash.update(fs.readFileSync(file))}}}visit(model);return hash.digest('hex')}
async function connect(input){
 const source=inspectLocalProject(input),signature=fingerprint(source.modelPath)
 const {sessions}=await bridge({action:'sessions'});let match
 for(const session of sessions){try{const candidate=inspectLocalProject(session.projectPath);if(fingerprint(candidate.modelPath)===signature){match=session;break}}catch{}}
 if(!match)throw Error('Open this PBIP model (or an unchanged copy) in Power BI Desktop, wait for it to load, then retry. Vilsem will create a separate report.')
 const {catalogs}=await bridge({action:'catalogs',port:match.port});if(catalogs.length!==1)throw Error('The Desktop session must contain exactly one model.')
 const catalog=catalogs[0].CATALOG_NAME,metadata=await bridge({action:'metadata',port:match.port,catalog})
 const tables=metadata.tables.map(t=>({...t,columns:metadata.columns.filter(c=>c.tableId===t.id).map(c=>({...c,dataType:c.dataType===9?'dateTime':c.dataType===2?'string':'number',isDate:c.dataType===9}))}))
 const measures=metadata.measures.map(m=>({...m,table:tables.find(t=>t.id===m.tableId)?.name||''}))
 active={source,port:match.port,catalog,measures,tables,info:{kind:'local-pbip',datasetId:source.modelId,datasetName:source.name,workspaceName:'Local Power BI',localSource:source}}
 process.env.FABRIC_DATASET_ID=source.modelId
 return active.info
}
function current(){return active&&process.env.FABRIC_DATASET_ID===active.info.datasetId?active:null}
async function query(dax){const session=current();if(!session)throw Error('No local model connected');return (await bridge({action:'query',port:session.port,catalog:session.catalog,dax})).rows}
module.exports={bridge,connect,current,query,fingerprint}
