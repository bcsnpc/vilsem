import {describe,it,expect} from 'vitest'
import fs from 'node:fs'
import vm from 'node:vm'
import Module,{createRequire} from 'node:module'
import ts from 'typescript'
const require=createRequire(import.meta.url)
function parse(rows){
 const f=require.resolve('../src/fabric/client.js'),m=new Module(f)
 m.require=name=>name==='axios'||name==='../auth/auth'||name==='./xmla'?{}:require(name)
 m._compile(fs.readFileSync(f,'utf8'),f)
 return m.exports.parseFabricResponseMulti({results:[{tables:[{rows}]}]})
}
function shim(table){
 const window={}
 const source=fs.readFileSync('electron/fabric/templates/semantica-shim.ts.tmpl','utf8').replace(/^import [^\r\n]*getFabricClient[^\r\n]*\r?\n/m,'')
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText
 vm.runInNewContext(js,{window,exports:{},getFabricClient:()=>({semanticModel:()=>({query:async()=>({status:'success',table})})})})
 return window.semantica.queryTable({groupBy:['Product[Code]'],measures:['Sales'],filters:{},limit:10})
}
describe('category identity across query transports',()=>{
 it.each(['00123','900719925474099312345','1e3',' '])('preserves category text %s in REST/local rows',code=>{
  expect(parse([{'Product[Code]':code,'[Sales]':'12.5'}])[0]).toEqual({'Product[Code]':code,Sales:12.5})
 })
 it.each([true,false])('preserves category text in SDK %s array rows',async array=>{
  const result=await shim({columns:[{name:'Product[Code]'},{name:'[Sales]'}],rows:[array?['00123',12.5]:{'Product[Code]':'00123','[Sales]':12.5}]})
  expect(result.rows[0]).toEqual({'Product[Code]':'00123',Sales:12.5})
 })
})
