import {describe,it,expect} from 'vitest'
import fs from 'node:fs'
import Module,{createRequire} from 'node:module'
const require=createRequire(import.meta.url)
describe('core auth error compatibility',()=>{
 it.each([Object.assign(Error('expired'),{code:'AUTH_FAILED'}),Error('AUTH_FAILED: device-code login expired')])('preserves the application AUTH_FAILED response',async error=>{
  const file=require.resolve('../src/routes/query.js'),module=new Module(file);let handler
  const mocks={
   '../fabric/translator':{translateToDAX:()=> 'EVALUATE ROW("x",1)'},
   '../fabric/client':{executeQuery:async()=>{throw error}},
   '../cache/sqlite':{buildCacheKey:()=> 'key',cacheGet:()=>null},
   '../fabric/metadata':{validateMeasures:()=>({valid:true})},
   '../queue/limiter':{rateLimitedCall:fn=>fn()},'../audit/log':{logQuery:()=>{}}
  }
  module.require=name=>name in mocks?mocks[name]:require(name)
  module._compile(fs.readFileSync(file,'utf8'),file)
  await module.exports({post:(_path,fn)=>handler=fn})
  let status,body;const reply={code:s=>(status=s,reply),send:b=>(body=b)}
  await handler({body:{measures:['Total Revenue']}},reply)
  expect(status).toBe(502);expect(body.error).toBe('AUTH_FAILED');expect(body.message).toBe(error.message)
 })
})
