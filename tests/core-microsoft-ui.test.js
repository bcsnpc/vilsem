import {describe,it,expect,vi} from 'vitest'
import {EventEmitter} from 'node:events'
import {createRequire} from 'node:module'
import Module from 'node:module'
import fs from 'node:fs'
const require=createRequire(import.meta.url)
function fixture(){
 const file=require.resolve('../electron/ipc/connection.js'),module=new Module(file),handlers={},tokens={accessToken:'access',refreshToken:'refresh',expiresIn:3600}
 let window
 class BrowserWindow extends EventEmitter {
  webContents=new EventEmitter();destroyed=false
  constructor(){super();window=this}
  loadURL=vi.fn();isDestroyed=()=>this.destroyed
  close(){this.destroyed=true;this.emit('closed')}
 }
 const completeRedirect=vi.fn(async()=>tokens),setInteractiveTokens=vi.fn()
 module.require=name=>{
  if(name==='electron/main')return {ipcMain:{handle:(name,handler)=>handlers[name]=handler},BrowserWindow,app:{getPath:()=> 'not-an-existing-workspace'},safeStorage:{isEncryptionAvailable:()=>false}}
  if(name==='@vilsem/core/connect')return {createMicrosoftLogin:()=>({authorizationUrl:'https://login.microsoftonline.com/test',matchesRedirect:()=>true,completeRedirect})}
  if(name==='../../src/auth/auth')return {setInteractiveTokens}
  if(name.startsWith('../../src/'))return {}
  return require(name)
 }
 module._compile(fs.readFileSync(file,'utf8'),file);module.exports.register()
 return {handlers,getWindow:()=>window,completeRedirect,setInteractiveTokens,tokens}
}
describe('Electron UI handoff to core OAuth',()=>{
 it.each(['start-ms-login','reauth-microsoft'])('%s resolves after exchanging the redirect, despite the window close callback',async name=>{
  const f=fixture(),result=f.handlers[name]()
  f.getWindow().webContents.emit('will-redirect',{},'https://login.microsoftonline.com/callback')
  expect(await result).toMatchObject({success:true})
  expect(f.completeRedirect).toHaveBeenCalledOnce()
  if(name==='reauth-microsoft')expect(f.setInteractiveTokens).toHaveBeenCalledWith('access','refresh',3600)
 })
 it.each(['start-ms-login','reauth-microsoft'])('%s resolves cancellation without attempting a token exchange',async name=>{
  const f=fixture(),result=f.handlers[name]();f.getWindow().close()
  expect(await result).toMatchObject({success:false,error:'Login window closed'})
  expect(f.completeRedirect).not.toHaveBeenCalled()
 })
 it.each(['start-ms-login','reauth-microsoft'])('%s resolves a failed core exchange instead of hanging',async name=>{
  const f=fixture();f.completeRedirect.mockRejectedValueOnce(Error('AUTH_FAILED: rejected'))
  const result=f.handlers[name]();f.getWindow().webContents.emit('did-navigate',{},'https://login.microsoftonline.com/callback')
  expect(await result).toMatchObject({success:false,error:'AUTH_FAILED: rejected'})
 })

})
