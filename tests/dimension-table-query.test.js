import { describe, it, expect } from 'vitest'
import Module, { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
const require=createRequire(import.meta.url),file=require.resolve('../electron/ipc/query.js')
const moduleUnderTest=new Module(file)
moduleUnderTest.filename=file;moduleUnderTest.paths=Module._nodeModulePaths(path.dirname(file))
const calls=[]
moduleUnderTest.require=function(name){
 if(name==='electron/main')return {ipcMain:{handle(){}}}
 if(name==='../../src/fabric/client')return {executeQueryMulti:async dax=>{calls.push(dax);return [{'QA[Category]':'North','QA[Product]':'P'}]}}
 if(name==='../../src/queue/limiter')return {rateLimitedCall:fn=>fn()}
 return Module.prototype.require.call(this,name)
}
moduleUnderTest._compile(fs.readFileSync(file,'utf8')+'\nmodule.exports.__qa={buildTableDAX,handleQueryTable};',file)
const {buildTableDAX,handleQueryTable}=moduleUnderTest.exports.__qa
describe('dimension-only table uses the production DAX path',()=>{
 it('queries all dimension columns without inventing an undefined measure',async()=>{
  const r=await handleQueryTable({groupBy:['QA[Category]','QA[Product]'],measures:[],orderBy:'asc'})
  expect(r.rows).toHaveLength(1)
  expect(calls.at(-1)).toContain('SUMMARIZECOLUMNS')
  expect(calls.at(-1)).toContain("ORDER BY 'QA'[Category] ASC, 'QA'[Product] ASC")
  expect(calls.at(-1)).not.toContain('[undefined]')
 })
 it('keeps filters and row limits in dimension-only queries',()=>{
  const dax=buildTableDAX(['QA[Category]'],[],{'QA[Category]':'North'},25,'desc')
  expect(dax).toContain('TOPN(25,');expect(dax).toContain('North');expect(dax).toContain("ORDER BY 'QA'[Category] DESC")
 })
 it('preserves measure sorting for existing chart queries',()=>{
  const dax=buildTableDAX(['QA[Category]'],['Revenue'],{},10,'desc')
  expect(dax).toContain('"Revenue", [Revenue]');expect(dax).toContain("ORDER BY [Revenue] DESC, 'QA'[Category] ASC")
 })
 it('still rejects missing dimension or malformed measures before transport',async()=>{
  expect((await handleQueryTable({groupBy:[],measures:[]})).error).toBe('VALIDATION_ERROR')
  expect((await handleQueryTable({groupBy:['QA[Category]'],measures:'Revenue'})).error).toBe('VALIDATION_ERROR')
 })
})
