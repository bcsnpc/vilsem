import {describe,it,expect,vi} from 'vitest'
import {createRequire} from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
const require=createRequire(import.meta.url)
const {createAuth,createConnector}=require('./index.cjs')
describe('standalone core connections',()=>{
 it('auto-discovers Desktop without requiring a PBIP command-line argument',async()=>{
  const bridge=vi.fn(async p=>p.action==='sessions'?{sessions:[{port:1234,method:'process-workspace-port-file',projectPath:''}]}:p.action==='catalogs'?{catalogs:[{CATALOG_NAME:'model'}]}:{tables:[{id:1,name:'Sales'}],columns:[{tableId:1,name:'Total',dataType:10}],measures:[{tableId:1,name:'Ratio'}]})
  const api=createConnector({bridge}),connection=await api.connect({kind:'desktop'})
  expect(connection.source.port).toBe(1234);expect(connection.discovery).toBe('process-workspace-port-file')
  expect((await api.schema(connection)).tables[0].columns[0].dataType).toBe('decimal')
  expect((await api.schema(connection)).measures[0].table).toBe('Sales')
 })
 it('refuses ambiguous Desktop sessions and invalid ports',async()=>{
  const api=createConnector({bridge:async()=>({sessions:[{port:1},{port:2}]})})
  await expect(api.connect({kind:'desktop'})).rejects.toThrow('Multiple Desktop')
  await expect(api.connect({kind:'desktop',port:65536})).rejects.toThrow('Invalid Desktop port')
 })
 it('caps Desktop rows and refuses model mutation commands',async()=>{
  const api=createConnector({bridge:async()=>({rows:[{x:1},{x:2}]})}),c={source:{kind:'desktop',port:1},catalog:'m'}
  expect(await api.query(c,'EVALUATE ROW("x", 1)',1)).toEqual([{x:1}])
  await expect(api.query(c,'CREATE TABLE test',1)).rejects.toThrow('Only DAX')
 })
 it('keeps Fabric targets independent and refreshes a rejected token once',async()=>{
  const http={post:vi.fn().mockRejectedValueOnce({response:{status:401}}).mockResolvedValue({data:{results:[{tables:[{rows:[{x:1}]}]}]}})}
  const auth={getToken:vi.fn(async()=>'token'),forceRefresh:vi.fn(async()=>{})}
  const api=createConnector({http,auth});const id='00000000-0000-0000-0000-000000000001';const c=await api.connect({kind:'fabric',workspaceId:id,datasetId:id})
  expect(await api.query(c,'EVALUATE ROW("x",1)',1)).toEqual([{x:1}]);expect(auth.forceRefresh).toHaveBeenCalledOnce();expect(http.post.mock.calls[1][0]).toContain('/groups/'+id+'/datasets/'+id)
 })
 it('service principal sends scoped credentials but never persists secrets',async()=>{
  const post=vi.fn(async()=>({data:{access_token:'sp-token',expires_in:3600}}))
  const api=createAuth({env:{AUTH_MODE:'service_principal',FABRIC_TENANT_ID:'tenant',FABRIC_CLIENT_ID:'client',FABRIC_CLIENT_SECRET:'secret'},http:{post}})
  expect(await api.getToken()).toBe('sp-token');expect(await api.getToken()).toBe('sp-token');expect(post).toHaveBeenCalledOnce()
  expect(new URLSearchParams(post.mock.calls[0][1]).get('grant_type')).toBe('client_credentials')
 })
 it('device code honors pending/slow_down and persists only a private refresh token',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vilsem-auth-'))
  try{
   const post=vi.fn().mockResolvedValueOnce({data:{device_code:'device',user_code:'USER',verification_uri:'https://microsoft.com/devicelogin',expires_in:900,interval:1}}).mockRejectedValueOnce({response:{data:{error:'authorization_pending'}}}).mockRejectedValueOnce({response:{data:{error:'slow_down'}}}).mockResolvedValueOnce({data:{access_token:'access',refresh_token:'refresh',expires_in:3600}})
   const sleep=vi.fn(async()=>{}),onDeviceCode=vi.fn();const api=createAuth({env:{},cacheDir:dir,http:{post},sleep,onDeviceCode})
   expect(await api.getToken()).toBe('access');expect(onDeviceCode).toHaveBeenCalledOnce();expect(sleep.mock.calls.map(c=>c[0])).toEqual([1000,1000,6000])
   const file=path.join(dir,fs.readdirSync(dir)[0]);expect(JSON.parse(fs.readFileSync(file,'utf8'))).toEqual({refreshToken:'refresh'})
   if(process.platform!=='win32')expect(fs.statSync(file).mode & 0o777).toBe(0o600)
   const nextPost=vi.fn(async()=>({data:{access_token:'next',refresh_token:'rotated',expires_in:3600}}));expect(await createAuth({env:{},cacheDir:dir,http:{post:nextPost}}).getToken()).toBe('next')
   expect(new URLSearchParams(nextPost.mock.calls[0][1]).get('grant_type')).toBe('refresh_token')
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
 })
 it('does not mask network errors by starting a device login',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vilsem-auth-'))
  try{const p=vi.fn().mockResolvedValue({data:{access_token:'a',refresh_token:'r',expires_in:3600}});const api=createAuth({env:{},cacheDir:dir,http:{post:p},sleep:async()=>{},onDeviceCode:()=>{}});p.mockResolvedValueOnce({data:{device_code:'d',expires_in:30}});await api.getToken();const fail=vi.fn(async()=>{throw Error('offline')});await expect(createAuth({env:{},cacheDir:dir,http:{post:fail}}).getToken()).rejects.toThrow('offline');expect(fail).toHaveBeenCalledOnce()}finally{fs.rmSync(dir,{recursive:true,force:true})}
 })
 it('app auth facade observes credential mode changes after module load',()=>{
  const auth=require('./auth.cjs'),before=process.env.AUTH_MODE
  try{process.env.AUTH_MODE='interactive';auth.setInteractiveTokens('pkce','refresh',3600);expect(auth.getTokenInfo().status).toBe('valid');process.env.AUTH_MODE='service_principal';expect(auth.getTokenInfo().status).toBe('none');expect(auth.getTokenInfo().mode).toBe('service_principal')}
  finally{if(before===undefined)delete process.env.AUTH_MODE;else process.env.AUTH_MODE=before}
 })

})
