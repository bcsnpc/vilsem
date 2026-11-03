const crypto=require('node:crypto');
const axios=require('axios');
const CLIENT_ID='ea0616ba-638b-4df5-95b9-636659ae5121';
const REDIRECT_URI='https://login.microsoftonline.com/common/oauth2/nativeclient';
const SCOPE='https://analysis.windows.net/powerbi/api/.default offline_access';
/** OAuth protocol only: the caller owns opening/closing its browser surface. */
function createMicrosoftLogin(options={}){
 const http=options.http || axios;
 const tenant=options.tenantId || 'common';
 if(!/^[a-zA-Z0-9.-]+$/.test(tenant))throw Error('Invalid Microsoft tenant');
 const clientId=options.clientId || CLIENT_ID,redirectUri=options.redirectUri || REDIRECT_URI,scope=options.scope || SCOPE;
 const verifier=crypto.randomBytes(32).toString('base64url'),state=crypto.randomBytes(24).toString('base64url');
 const base=`https://login.microsoftonline.com/${tenant}/oauth2/v2.0`;
 const url=new URL(base+'/authorize');
 for(const [key,value]of Object.entries({client_id:clientId,response_type:'code',redirect_uri:redirectUri,scope,code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',prompt:'select_account',state}))url.searchParams.set(key,value);
 function matchesRedirect(value){try{const actual=new URL(value),expected=new URL(redirectUri);return actual.origin===expected.origin && actual.pathname===expected.pathname}catch{return false}}
 let exchange;
 async function completeRedirect(value){
  if(!matchesRedirect(value))throw Object.assign(Error('AUTH_FAILED: Unexpected Microsoft redirect'),{code:'AUTH_FAILED'});
  const params=new URL(value).searchParams;
  if(params.get('state')!==state)throw Object.assign(Error('AUTH_FAILED: Microsoft login state mismatch'),{code:'AUTH_FAILED'});
  if(params.has('error'))throw Object.assign(Error('AUTH_FAILED: '+(params.get('error_description') || params.get('error'))),{code:'AUTH_FAILED'});
  const code=params.get('code');if(!code)throw Object.assign(Error('AUTH_FAILED: No authorization code in redirect'),{code:'AUTH_FAILED'});
  // will-redirect and did-navigate can both deliver the same callback.
  if(!exchange)exchange=http.post(base+'/token',new URLSearchParams({client_id:clientId,grant_type:'authorization_code',code,redirect_uri:redirectUri,code_verifier:verifier,scope}).toString(),{headers:{'Content-Type':'application/x-www-form-urlencoded'},timeout:15000}).then(({data})=>{
   if(!data.access_token)throw Object.assign(Error('AUTH_FAILED: Token response has no access token'),{code:'AUTH_FAILED'});
   return {accessToken:data.access_token,refreshToken:data.refresh_token,expiresIn:data.expires_in};
  });
  return exchange;
 }
 return {authorizationUrl:url.toString(),matchesRedirect,completeRedirect};
}
module.exports={createMicrosoftLogin};
