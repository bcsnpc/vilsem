const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const axios=require('axios');
const RESOURCE='https://analysis.windows.net/powerbi/api';
const CLIENT_ID='ea0616ba-638b-4df5-95b9-636659ae5121';
/** Credential provider independent of Electron and working directory. No secrets are logged. */
function createAuth(options={}) {
 const env=options.env || process.env, http=options.http || axios;
 const sleep=options.sleep || (ms=>new Promise(r=>setTimeout(r,ms)));
 const now=options.now || Date.now;
 const tenant=env.FABRIC_TENANT_ID || 'common';
 if(!/^[a-zA-Z0-9.-]+$/.test(tenant))throw Error('Invalid FABRIC_TENANT_ID');
 const client=env.FABRIC_CLIENT_ID || CLIENT_ID;
 const base=`https://login.microsoftonline.com/${tenant}/oauth2/v2.0`;
 const cacheDir=options.cacheDir || path.join(os.homedir(),'.vilsem','auth');
 const cacheFile=path.join(cacheDir,crypto.createHash('sha256').update(`${tenant}:${client}:${RESOURCE}`).digest('hex')+'.json');
 let state=null,pending=null;
 const mode=()=>env.AUTH_MODE || (env.FABRIC_CLIENT_SECRET?'service_principal':'device_code');
 function read(){try{const stat=fs.lstatSync(cacheFile);if(!stat.isFile()||stat.isSymbolicLink())return null;return JSON.parse(fs.readFileSync(cacheFile,'utf8'))}catch{return null}}
 function save(){
  if(!state?.refreshToken)return;
  fs.mkdirSync(cacheDir,{recursive:true,mode:0o700});
  if(fs.lstatSync(cacheDir).isSymbolicLink())throw Error('Token cache directory cannot be a symbolic link');
  fs.chmodSync(cacheDir,0o700);
  const temporary=cacheFile+'.'+crypto.randomUUID();
  try{fs.writeFileSync(temporary,JSON.stringify({refreshToken:state.refreshToken}),{mode:0o600,flag:'wx'});fs.renameSync(temporary,cacheFile);fs.chmodSync(cacheFile,0o600)}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary)}
 }
 function accept(data,refreshToken){if(!data.access_token)throw Error('Authentication response has no access token');state={accessToken:data.access_token,refreshToken:data.refresh_token || refreshToken,expiresAt:now()+Number(data.expires_in || 3600)*1000};return state.accessToken}
 async function post(endpoint,params){return (await http.post(base+'/'+endpoint,new URLSearchParams(params).toString(),{headers:{'Content-Type':'application/x-www-form-urlencoded'},timeout:30000})).data}
 async function acquire(force){
  if(!force && state?.accessToken && now()<state.expiresAt-300000)return state.accessToken;
  if(env.FABRIC_ACCESS_TOKEN && !force)return env.FABRIC_ACCESS_TOKEN;
  if(mode()==='service_principal'){
   if(!env.FABRIC_TENANT_ID||!env.FABRIC_CLIENT_ID||!env.FABRIC_CLIENT_SECRET)throw Error('AUTH_FAILED: service_principal requires FABRIC_TENANT_ID, FABRIC_CLIENT_ID, FABRIC_CLIENT_SECRET');
   return accept(await post('token',{grant_type:'client_credentials',client_id:client,client_secret:env.FABRIC_CLIENT_SECRET,scope:RESOURCE+'/.default'}));
  }
  const refreshToken=state?.refreshToken || (mode()!=='interactive' && read()?.refreshToken);
  if(refreshToken){try{const token=accept(await post('token',{grant_type:'refresh_token',client_id:client,refresh_token:refreshToken,scope:RESOURCE+'/.default offline_access'}),refreshToken);if(mode()!=='interactive')save();return token}catch(error){if(mode()==='interactive')throw error;const code=error.response?.data?.error;if(!['invalid_grant','interaction_required'].includes(code))throw error}}
  if(mode()==='interactive')throw Error('AUTH_FAILED: interactive mode requires tokens to be set first');
  const dc=await post('devicecode',{client_id:client,scope:RESOURCE+'/.default offline_access'});
  (options.onDeviceCode || (code=>console.error(code.message || `Open ${code.verification_uri} and enter ${code.user_code}`)))(dc);
  let interval=(dc.interval || 5)*1000;const deadline=now()+dc.expires_in*1000;
  while(now()<deadline){await sleep(interval);try{const token=accept(await post('token',{grant_type:'urn:ietf:params:oauth:grant-type:device_code',client_id:client,device_code:dc.device_code}));save();return token}catch(error){const code=error.response?.data?.error;if(code==='authorization_pending')continue;if(code==='slow_down'){interval+=5000;continue}throw Error('AUTH_FAILED: '+(code || 'device-code request failed'))}}
  throw Error('AUTH_FAILED: device-code login expired');
 }
 const getToken=(force=false)=>{if(!pending)pending=acquire(force).finally(()=>pending=null);return pending};
 return {getToken,initAuth:()=>getToken(),forceRefresh:()=>getToken(true),setInteractiveTokens(accessToken,refreshToken,expiresIn=3600){state={accessToken,refreshToken,expiresAt:now()+expiresIn*1000}},getTokenInfo(){return {status:state?.accessToken?'valid':'none',expiresAt:state?.expiresAt?new Date(state.expiresAt).toISOString():null,mode:mode()}}};
}
// Electron can switch workspace credentials after module load. Recreate only when
// the credential configuration changes; standalone callers can own createAuth instances.
let defaultProvider, defaultKey;
function provider(){
 const key=JSON.stringify(['AUTH_MODE','FABRIC_TENANT_ID','FABRIC_CLIENT_ID','FABRIC_CLIENT_SECRET','FABRIC_ACCESS_TOKEN'].map(k=>process.env[k] || ''));
 if(key!==defaultKey){defaultKey=key;defaultProvider=createAuth()}
 return defaultProvider;
}
module.exports={createAuth,initAuth:()=>provider().initAuth(),getToken:()=>provider().getToken(),forceRefresh:()=>provider().forceRefresh(),getTokenInfo:()=>provider().getTokenInfo(),setInteractiveTokens:(...args)=>provider().setInteractiveTokens(...args)};
