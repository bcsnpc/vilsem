const {bridge}=require('./localRuntime.cjs');
const auth=require('./auth.cjs');
const {createMicrosoftLogin}=require('./microsoft.cjs');
const metadata=require('./metadata.cjs');
const {normalizeLocalMetadata}=require('./fieldContext.cjs');
const {readReportConnection,offlineSchema,sessionMatches}=require('./report.cjs');
/** Each connection owns its model IDs; no process-global dataset mutation. */
function createConnector(options={}){
 const invoke=options.bridge || bridge, credentials=options.auth || auth,http=options.http || require('axios');
 async function connect(source){
  if(source.kind==='report'){
   const reference=readReportConnection(source.reportDir);
   if(reference.kind==='local'){
    const {sessions}=process.platform==='win32'||options.bridge?await invoke({action:'sessions'}):{sessions:[]};
    const matches=sessions.filter(session=>sessionMatches(session,reference));
    if(matches.length>1)throw Error('Multiple Desktop sessions use this report model; close the duplicate session');
    if(matches.length){const connection=await connect({kind:'desktop',port:matches[0].port});return {...connection,reportDir:reference.reportDir,discovery:matches[0].method||'report-model-path'};}
    return {source:{kind:'offline'},reportDir:reference.reportDir,metadata:offlineSchema(reference.modelPath),schemaOnly:true,discovery:'local-model-definitions'};
   }
   if(reference.kind==='ssas'){
    if(process.platform!=='win32'&&!options.bridge)throw Error('Windows-integrated SSAS connections require Windows');
    const target={endpoint:reference.endpoint,catalog:reference.catalog};
    return {source:{kind:'ssas',...target},reportDir:reference.reportDir,metadata:await invoke({action:'metadata',...target}),discovery:'report-ssas'};
   }
   // Resolve IDs through the configured Microsoft credentials. Nothing from
   // the report's connection string is used as an authentication credential.
   const headers={Authorization:`Bearer ${await credentials.getToken()}`};
   const groups=(await http.get('https://api.powerbi.com/v1.0/myorg/groups',{headers,timeout:30000})).data.value||[];
   const workspaces=groups.filter(group=>group.name===reference.workspace||group.id===reference.workspace);
   if(workspaces.length!==1)throw Error('Report workspace is missing or ambiguous for the configured identity');
   const workspaceId=workspaces[0].id;
   const datasets=(await http.get(`https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets`,{headers,timeout:30000})).data.value||[];
   const candidates=datasets.filter(dataset=>reference.datasetId?dataset.id.toLowerCase()===reference.datasetId.toLowerCase():dataset.name===reference.catalog);
   if(candidates.length!==1)throw Error('Report semantic model is missing or ambiguous for the configured identity');
   const connection=await connect({kind:'fabric',workspaceId,datasetId:candidates[0].id});
   return {...connection,reportDir:reference.reportDir,discovery:'report-fabric-connection'};
  }
  if(source.kind==='desktop'){
   if(process.platform!=='win32' && !options.bridge)throw Error('Power BI Desktop connections require Windows');
   let port=source.port,session;
   if(!port){const {sessions}=await invoke({action:'sessions'});const unique=[...new Map(sessions.map(s=>[s.port,s])).values()];if(unique.length!==1)throw Error(unique.length?'Multiple Desktop models are open; specify source.port':'No local Analysis Services instance found; open a model in Power BI Desktop');session=unique[0];port=session.port}
   if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid Desktop port');
   const {catalogs}=await invoke({action:'catalogs',port});if(catalogs.length!==1)throw Error('Desktop must expose exactly one model');
   const catalog=catalogs[0].CATALOG_NAME;
   return {source:{kind:'desktop',port},catalog,metadata:await invoke({action:'metadata',port,catalog}),discovery:session?.method || 'explicit-port'};
  }
  if(source.kind!=='fabric')throw Error('Unsupported connection kind');
  for(const key of ['workspaceId','datasetId'])if(!/^[0-9a-f-]{36}$/i.test(source[key]))throw Error('Invalid '+key);
  await credentials.getToken();return {source:{...source}};
 }
 async function query(connection,dax,maxRows=10000){
  if(!Number.isInteger(maxRows)||maxRows<1||maxRows>10000)throw Error('maxRows must be between 1 and 10000');
  const code=dax.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'').trim();
  if(!/^(EVALUATE\b|DEFINE\b[\s\S]*?\bEVALUATE\b)/i.test(code))throw Error('Only DAX EVALUATE queries are supported');
  if(connection.schemaOnly)throw Error('Schema-only connection: open this report model in Power BI Desktop and reconnect before querying or previewing');
  if(connection.source.kind==='ssas')return (await invoke({action:'query',endpoint:connection.source.endpoint,catalog:connection.source.catalog,dax,maxRows})).rows.slice(0,maxRows);
  if(connection.source.kind==='desktop')return (await invoke({action:'query',port:connection.source.port,catalog:connection.catalog,dax,maxRows})).rows.slice(0,maxRows);
  const {workspaceId,datasetId}=connection.source;
  async function execute(){return http.post(`https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/executeQueries`,{queries:[{query:dax}],serializerSettings:{includeNulls:true}},{headers:{Authorization:`Bearer ${await credentials.getToken()}`},timeout:60000})}
  let response;try{response=await execute()}catch(error){if(error.response?.status!==401)throw error;await credentials.forceRefresh();response=await execute()}
  const body=response.data;if(body.error||body.results?.[0]?.error)throw Error('Power BI query failed: '+(body.error?.message||body.results?.[0]?.error?.message||'model query error'));
  return (body.results?.[0]?.tables?.[0]?.rows || []).slice(0,maxRows);
 }
 async function schema(connection,{refresh=false}={}){
  if(connection.schemaOnly)return connection.metadata;
  if(connection.source.kind==='fabric')return metadata.discoverViaItemDefinition(connection.source.workspaceId,connection.source.datasetId,await credentials.getToken());
  if(refresh && ['desktop','ssas'].includes(connection.source.kind))connection.metadata=await invoke({action:'metadata',...(connection.source.kind==='desktop'?{port:connection.source.port,catalog:connection.catalog}:{endpoint:connection.source.endpoint,catalog:connection.source.catalog})});
  const data=connection.metadata;
  return normalizeLocalMetadata(data);
 }
 return {connect,query,schema};
}
const connector=createConnector();
module.exports={createConnector,createMicrosoftLogin,createAuth:auth.createAuth,bridge,connect:connector.connect,query:connector.query,schema:connector.schema};
