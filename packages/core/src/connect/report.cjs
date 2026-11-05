const fs = require('node:fs');
const path = require('node:path');
const {parseTmdlPart,parseRelationshipsPart,parseTmslModelBim} = require('./metadata.cjs');
const read = file => JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));

// Parse quoted connection-string values without evaluating or forwarding the
// report's credentials, impersonation settings or provider configuration.
function parseConnectionString(text) {
 if(typeof text!=='string'||text.length>16384)throw Error('Invalid report connection string');
 const result=Object.create(null);let offset=0;
 while(offset<text.length){
  while(/[;\s]/.test(text[offset]||'')&&offset<text.length)offset++;
  if(offset===text.length)break;
  const eq=text.indexOf('=',offset);if(eq<0)throw Error('Invalid report connection-string property');
  const key=text.slice(offset,eq).trim().toLowerCase();offset=eq+1;
  while(/\s/.test(text[offset]||'')&&offset<text.length)offset++;
  let value='';const quote=['"',"'"].includes(text[offset])?text[offset++]:null;
  if(quote){let closed=false;while(offset<text.length){const c=text[offset++];if(c===quote){if(text[offset]===quote){value+=quote;offset++;}else{closed=true;break;}}else value+=c;}if(!closed)throw Error('Unterminated report connection-string value');while(/\s/.test(text[offset]||'')&&offset<text.length)offset++;if(offset<text.length&&text[offset]!==';')throw Error('Invalid report connection-string separator');}
  else {const end=text.indexOf(';',offset);value=text.slice(offset,end<0?text.length:end).trim();offset=end<0?text.length:end;}
  if(!key||Object.hasOwn(result,key))throw Error('Duplicate or empty report connection-string property');
  result[key]=value;
 }
 return result;
}
function readReportConnection(reportDir) {
 const root=fs.realpathSync(reportDir);
 const definition=read(path.join(root,'definition.pbir'));
 const ref=definition.datasetReference;
 if(!!ref?.byPath===!!ref?.byConnection)throw Error('Report must have exactly one byPath or byConnection dataset reference');
 if(ref.byPath){
  const relative=ref.byPath.path;
  if(typeof relative!=='string'||!relative.trim()||path.win32.isAbsolute(relative)||path.posix.isAbsolute(relative))throw Error('Report model path must be relative');
  return {kind:'local',reportDir:root,modelPath:fs.realpathSync(path.resolve(root,relative.replace(/[\\/]/g,path.sep)))};
 }
 const fields=parseConnectionString(ref.byConnection.connectionString);
 const endpoint=fields['data source']||fields.datasource, catalog=fields['initial catalog']||fields.database;
 if(!endpoint||!catalog||/[\r\n\0]/.test(endpoint+catalog))throw Error('Report connection requires Data Source and Initial Catalog');
 if(/^powerbi:/i.test(endpoint)){
  const url=new URL(endpoint.replace(/ /g,'%20'));
  if(url.protocol!=='powerbi:'||url.hostname!=='api.powerbi.com'||url.username||url.password||url.search||url.hash||!/^\/v1\.0\/[^/]+\/[^/]+\/?$/.test(url.pathname))throw Error('Unsupported Power BI XMLA endpoint');
  return {kind:'fabric',reportDir:root,endpoint,catalog,workspace:decodeURIComponent(url.pathname.split('/')[3]),datasetId:fields.semanticmodelid||ref.byConnection.pbiModelDatabaseName};
 }
 // Windows-integrated SSAS only. Never forward Entra tokens to arbitrary hosts.
 if(!/^[a-z\d_.-]+(?:\\[a-z\d_.-]+)?(?::\d{1,5})?$/i.test(endpoint))throw Error('Unsupported report endpoint; use Power BI XMLA or a Windows-integrated SSAS server');
 return {kind:'ssas',reportDir:root,endpoint,catalog};
}
function offlineSchema(modelPath){
 const bim=path.join(modelPath,'model.bim');if(fs.existsSync(bim))return parseTmslModelBim(read(bim));
 const definition=path.join(modelPath,'definition'),result={tables:[],measures:[],relationships:[]};let bytes=0;
 function visit(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  if(entry.isSymbolicLink())throw Error('Linked model definitions are not supported');
  const file=path.join(dir,entry.name);
  if(entry.isDirectory())visit(file);
  else if(entry.name.endsWith('.tmdl')){
   bytes+=fs.statSync(file).size;if(bytes>32*1024*1024)throw Error('Model definitions exceed the 32MB schema limit');
   const text=fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'');
   if(/^table\s+/m.test(text)){const part=parseTmdlPart(text);result.tables.push({name:part.tableName,columns:part.columns});result.measures.push(...part.measures);}
   else result.relationships.push(...parseRelationshipsPart(text));
  }
 }}
 visit(definition);if(!result.tables.length)throw Error('No model tables found in local definitions');return result;
}
function samePath(a,b){if(!a||!b)return false;try{a=fs.realpathSync(a);b=fs.realpathSync(b);return process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;}catch{return false;}}
function sessionMatches(session,reference){
 if(!session.projectPath)return false;
 try{const {inspectLocalProject}=require('../pbir/localProject.cjs');const project=inspectLocalProject(session.projectPath);return samePath(project.modelPath,reference.modelPath);}catch{return false;}
}
module.exports={readReportConnection,parseConnectionString,offlineSchema,sessionMatches};
