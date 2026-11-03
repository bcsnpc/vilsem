import {describe,it,expect,vi} from 'vitest'
import {createRequire} from 'node:module'
import crypto from 'node:crypto'
const require=createRequire(import.meta.url)
const {createMicrosoftLogin,createAuth}=require('./index.cjs')
describe('headless Microsoft OAuth protocol',()=>{
 it('generates S256 PKCE and state, exchanges once and preserves the token contract',async()=>{
  const post=vi.fn(async()=>({data:{access_token:'access',refresh_token:'refresh',expires_in:3600}}))
  const login=createMicrosoftLogin({http:{post}}),url=new URL(login.authorizationUrl)
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');expect(url.searchParams.get('state')?.length).toBeGreaterThan(20)
  const redirect=url.searchParams.get('redirect_uri')+'?code=code&state='+url.searchParams.get('state')
  expect(login.matchesRedirect(redirect)).toBe(true)
  const [a,b]=await Promise.all([login.completeRedirect(redirect),login.completeRedirect(redirect)])
  expect(a).toEqual({accessToken:'access',refreshToken:'refresh',expiresIn:3600});expect(b).toEqual(a);expect(post).toHaveBeenCalledOnce()
  const body=new URLSearchParams(post.mock.calls[0][1]);expect(body.get('grant_type')).toBe('authorization_code')
  expect(crypto.createHash('sha256').update(body.get('code_verifier')).digest('base64url')).toBe(url.searchParams.get('code_challenge'))
 })
 it('refuses redirect lookalikes and state mismatch before contacting the token endpoint',async()=>{
  const post=vi.fn(),login=createMicrosoftLogin({http:{post}})
  expect(login.matchesRedirect('https://login.microsoftonline.com/common/oauth2/nativeclient.evil?code=bad')).toBe(false)
  await expect(login.completeRedirect('https://login.microsoftonline.com/common/oauth2/nativeclient?code=bad&state=wrong')).rejects.toMatchObject({code:'AUTH_FAILED'})
  expect(post).not.toHaveBeenCalled()
 })
 it('surfaces a Microsoft rejection without a token exchange',async()=>{
  const post=vi.fn(),login=createMicrosoftLogin({http:{post}}),url=new URL(login.authorizationUrl)
  await expect(login.completeRedirect(url.searchParams.get('redirect_uri')+'?state='+url.searchParams.get('state')+'&error=access_denied')).rejects.toMatchObject({code:'AUTH_FAILED'})
  expect(post).not.toHaveBeenCalled()
 })
 it('supports a scoped service principal without moving OneLake auth back into Electron',async()=>{
  const post=vi.fn(async()=>({data:{access_token:'storage',expires_in:3600}}))
  const auth=createAuth({env:{AUTH_MODE:'service_principal',FABRIC_TENANT_ID:'tenant',FABRIC_CLIENT_ID:'client',FABRIC_CLIENT_SECRET:'secret'},resource:'https://storage.azure.com',http:{post}})
  expect(await auth.getToken()).toBe('storage');expect(new URLSearchParams(post.mock.calls[0][1]).get('scope')).toBe('https://storage.azure.com/.default')
 })
 it('keeps the application AUTH_FAILED error code on failed device login',async()=>{
  const auth=createAuth({env:{},cacheDir:'nonexistent-cache-for-test',http:{post:async()=>({data:{device_code:'d',expires_in:0}})},onDeviceCode:()=>{}})
  await expect(auth.getToken()).rejects.toMatchObject({code:'AUTH_FAILED'})
 })
 it('refreshes injected Electron PKCE tokens with the original public client even after switching from an SP workspace',async()=>{
  const post=vi.fn(async()=>({data:{access_token:'new-pkce',refresh_token:'new-refresh',expires_in:3600}}))
  const auth=createAuth({env:{AUTH_MODE:'interactive',FABRIC_TENANT_ID:'old-sp-tenant',FABRIC_CLIENT_ID:'old-sp-client',FABRIC_CLIENT_SECRET:'old-secret'},http:{post}})
  auth.setInteractiveTokens('expired','pkce-refresh',-1)
  expect(await auth.getToken()).toBe('new-pkce')
  expect(post.mock.calls[0][0]).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/token')
  const body=new URLSearchParams(post.mock.calls[0][1]);expect(body.get('client_id')).toBe('ea0616ba-638b-4df5-95b9-636659ae5121');expect(body.has('client_secret')).toBe(false)
 })

})
