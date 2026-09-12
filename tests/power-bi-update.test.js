import {describe,it,expect} from 'vitest'
import Module,{createRequire} from 'node:module'
import fs from 'node:fs'
const require=createRequire(import.meta.url),filename=require.resolve('../electron/ipc/powerbi.js')
function subject(definitionParts=[]){
 const calls=[],m=new Module(filename);m.filename=filename
 m.require=name=>{
  if(name==='electron/main'||name==='electron')return {}
  if(name==='axios')return {post:async(...args)=>{calls.push(args);return {status:200,data:args[0].includes('/getDefinition')?{definition:{parts:definitionParts}}:undefined}}}
  if(name==='../../src/auth/auth')return {getToken:async()=>'test-token'}
  if(name==='../../src/queue/limiter')return {rateLimitedCall:fn=>fn()}
  if(name==='../../src/cache/sqlite')return {}
  return require(name)
 }
 m._compile(fs.readFileSync(filename,'utf8'),filename)
 return {...m.exports,calls}
}
describe('Power BI report update metadata contract',()=>{
 for(const platform of [false,true])it(`updates report content with platform metadata ${platform?'present':'absent'}`,async()=>{
  const h=subject(),parts=[{path:'definition/report.json',content:'{}'},...(platform?[{path:'.platform',content:'{"metadata":{"displayName":"QA"}}'}]:[])]
  expect((await h.updateReportDefinition({workspaceId:'qa',reportId:'report',parts})).success).toBe(true)
  const [url,body]=h.calls[0]
  expect(new URL(url).searchParams.get('updateMetadata')).toBe(String(platform))
  expect(body.definition.parts).toHaveLength(parts.length)
  expect(Buffer.from(body.definition.parts[0].payload,'base64').toString()).toBe('{}')
 })
})

describe('existing report resource preservation',()=>{
 it('retains binary bytes through fetch, JSON editing and update',async()=>{
  const bytes=Buffer.from([137,80,78,71,13,10,26,10,255,0,128,192,254])
  const original=[{path:'StaticResources/RegisteredResources/logo.png',payload:bytes.toString('base64'),payloadType:'InlineBase64'},
   {path:'definition/report.json',payload:Buffer.from('{"name":"before"}').toString('base64'),payloadType:'InlineBase64'}]
  const h=subject(original),fetched=await h.getReportDefinitionV2({workspaceId:'qa',reportId:'report',format:'PBIR'})
  expect(fetched.success).toBe(true)
  const edited=fetched.parts.map(p=>p.path.endsWith('report.json')?{...p,content:'{"name":"after"}'}:{...p})
  expect((await h.updateReportDefinition({workspaceId:'qa',reportId:'report',parts:edited})).success).toBe(true)
  const parts=h.calls.at(-1)[1].definition.parts
  expect(Buffer.from(parts[0].payload,'base64')).toEqual(bytes)
  expect(Buffer.from(parts[1].payload,'base64').toString('utf8')).toBe('{"name":"after"}')
 })
 it('retains untouched Unicode JSON and already encoded custom visual parts',async()=>{
  const text='{"title":"売上 📊"}',payload=Buffer.from(text).toString('base64'),h=subject([{path:'definition/report.json',payload,payloadType:'InlineBase64'}])
  const fetched=await h.getReportDefinitionV2({workspaceId:'qa',reportId:'report'})
  await h.updateReportDefinition({workspaceId:'qa',reportId:'report',parts:[...fetched.parts,{path:'CustomVisuals/qa/visual.json',payload,payloadType:'InlineBase64'}]})
  expect(h.calls.at(-1)[1].definition.parts.map(p=>p.payload)).toEqual([payload,payload])
 })
})
