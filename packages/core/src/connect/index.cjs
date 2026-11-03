const {bridge}=require('./localRuntime.cjs');
const auth=require('./auth.cjs');
const metadata=require('./metadata.cjs');
/** Each connection owns its model IDs; no process-global dataset mutation. */
function createConnector(options={}){
 const invoke=options.bridge || bridge, credentials=options.auth || auth,http=options.http || require('axios');
 async function connect(source){
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
  if(connection.source.kind==='desktop')return (await invoke({action:'query',port:connection.source.port,catalog:connection.catalog,dax,maxRows})).rows.slice(0,maxRows);
  const {workspaceId,datasetId}=connection.source;
  async function execute(){return http.post(`https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/executeQueries`,{queries:[{query:dax}],serializerSettings:{includeNulls:true}},{headers:{Authorization:`Bearer ${await credentials.getToken()}`},timeout:60000})}
  let response;try{response=await execute()}catch(error){if(error.response?.status!==401)throw error;await credentials.forceRefresh();response=await execute()}
  const body=response.data;if(body.error||body.results?.[0]?.error)throw Error('Power BI query failed: '+(body.error?.message||body.results?.[0]?.error?.message||'model query error'));
  return (body.results?.[0]?.tables?.[0]?.rows || []).slice(0,maxRows);
 }
 async function schema(connection){
  if(connection.source.kind==='fabric')return metadata.discoverViaItemDefinition(connection.source.workspaceId,connection.source.datasetId,await credentials.getToken());
  const data=connection.metadata;
  return {tables:data.tables.map(table=>({...table,columns:data.columns.filter(c=>c.tableId===table.id).map(c=>({...c,dataType:({1:'automatic',2:'string',6:'int64',8:'double',9:'dateTime',10:'decimal',11:'boolean',17:'binary',19:'unknown',20:'variant'})[c.dataType] || String(c.dataType)}))})),measures:data.measures.map(m=>({...m,table:data.tables.find(t=>t.id===m.tableId)?.name}))};
 }
 return {connect,query,schema};
}
const connector=createConnector();
module.exports={createConnector,createAuth:auth.createAuth,bridge,connect:connector.connect,query:connector.query,schema:connector.schema};
