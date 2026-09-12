import { describe, it, expect } from 'vitest'
import Module, { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
const require=createRequire(import.meta.url),file=require.resolve('../src/routes/preview.js')
const moduleUnderTest=new Module(file)
moduleUnderTest.filename=file;moduleUnderTest.paths=Module._nodeModulePaths(path.dirname(file))
const calls=[]
moduleUnderTest.require=function(name){
 if(name==='electron/main')return {ipcMain:{handle(){}}}
 if(name==='../fabric/client')return {executeQueryMulti:async dax=>{calls.push(dax);return [{'QA[Category]':'North','QA[Product]':'P'}]}}
 if(name==='../queue/limiter')return {rateLimitedCall:fn=>fn()}
 return Module.prototype.require.call(this,name)
}
moduleUnderTest._compile(fs.readFileSync(file,'utf8'),file)
const routes={};await moduleUnderTest.exports({post:(url,fn)=>routes[url]=fn,get:()=>{}})
async function request(body){let status=200;const reply={code(n){status=n;return this},send(value){return value}};const result=await routes['/query-table']({body},reply);return {status,result}}

describe('web dimension-only table route',()=>{
 it('retains all dimensions without inventing a measure',async()=>{const r=await request({groupBy:['QA[Category]','QA[Product]'],measures:[],orderBy:'asc'});expect(r.status).toBe(200);expect(r.result.rows).toHaveLength(1);expect(calls.at(-1)).toContain("ORDER BY 'QA'[Category] ASC, 'QA'[Product] ASC");expect(calls.at(-1)).not.toContain('[undefined]')})
 it('retains existing measured query behavior',async()=>{expect((await request({groupBy:['QA[Category]'],measures:['Revenue']})).status).toBe(200);expect(calls.at(-1)).toContain("ORDER BY [Revenue] DESC, 'QA'[Category] ASC")})
 it('rejects malformed measures and missing dimensions',async()=>{expect((await request({groupBy:['QA[Category]'],measures:'Revenue'})).status).toBe(400);expect((await request({groupBy:[],measures:[]})).status).toBe(400)})
})
