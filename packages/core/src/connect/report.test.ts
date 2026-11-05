import {describe,it,expect,vi} from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const {createConnector}=require('./index.cjs')
const {parseConnectionString,readReportConnection}=require('./report.cjs')
const {parseTmdlPart}=require('./metadata.cjs')
function fixture(reference){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'vilsem-report-connect-'))
 const report=path.join(root,'Report'),model=path.join(root,'Model')
 fs.mkdirSync(report);fs.mkdirSync(path.join(model,'definition','tables'),{recursive:true})
 fs.writeFileSync(path.join(report,'definition.pbir'),JSON.stringify({datasetReference:reference}))
 fs.writeFileSync(path.join(model,'definition.pbism'),'{}')
 fs.writeFileSync(path.join(model,'definition','model.tmdl'),'model Model')
 fs.writeFileSync(path.join(model,'definition','tables','Sales.tmdl'),"table Sales\n\tcolumn Category\n\t\tdataType: string\n\tmeasure Revenue = SUM(Sales[Amount])\n\t\tformatString: #,0\n")
 const project=path.join(root,'Report.pbip');fs.writeFileSync(project,JSON.stringify({artifacts:[{report:{path:'Report'}}]}))
 return {root,report,model,project,close:()=>fs.rmSync(root,{recursive:true,force:true})}
}
describe('PBIR-owned model connection routing',()=>{
 it.each([
  ['0.0,,"M"','0.0,,"M"'],
  ['"0.0,,""M"""','0.0,,"M"'],
  ['"$"#,0.00','"$"#,0.00'],
  ['"#,0.00"','#,0.00'],
 ])('preserves format literals while decoding TMDL property quoting: %s',(serialized,expected)=>{
  const result=parseTmdlPart(`table Sales\n\tmeasure Amount = 1\n\t\tformatString: ${serialized}\n`)
  expect(result.measures[0].formatString).toBe(expected)
 })
 it('routes byPath to the matching Desktop session instead of another open model',async()=>{
  const f=fixture({byPath:{path:'../Model'}})
  try{
   const before=fs.readFileSync(path.join(f.report,'definition.pbir'),'utf8')
   const bridge=vi.fn(async p=>p.action==='sessions'?{sessions:[{port:111,projectPath:'not-our-report.pbip'},{port:222,projectPath:f.project,method:'process-workspace-port-file'}]}:p.action==='catalogs'?{catalogs:[{CATALOG_NAME:'model'}]}:{tables:[],columns:[],measures:[]})
   const api=createConnector({bridge}),connection=await api.connect({kind:'report',reportDir:f.report})
   expect(connection.source).toEqual({kind:'desktop',port:222})
   expect(connection.discovery).toBe('process-workspace-port-file')
   expect(fs.readFileSync(path.join(f.report,'definition.pbir'),'utf8')).toBe(before)
  }finally{f.close()}
 })
 it('returns honest schema-only TMDL metadata with Desktop closed and refuses data queries',async()=>{
  const f=fixture({byPath:{path:'../Model'}})
  try{
   const api=createConnector({bridge:async()=>({sessions:[]})}),connection=await api.connect({kind:'report',reportDir:f.report})
   expect(connection.schemaOnly).toBe(true)
   const schema=await api.schema(connection)
   expect(schema.tables[0].columns[0]).toMatchObject({name:'Category',dataType:'string'})
   expect(schema.measures[0]).toMatchObject({name:'Revenue',table:'Sales',formatString:'#,0'})
   await expect(api.query(connection,'EVALUATE ROW("x",1)')).rejects.toThrow('Schema-only')
  }finally{f.close()}
 })
 it('routes byConnection through authenticated Fabric with quoted names and pinned model IDs',async()=>{
  const id='00000000-0000-0000-0000-000000000001'
  const f=fixture({byConnection:{connectionString:`Data Source="powerbi://api.powerbi.com/v1.0/myorg/Workspace; one";Initial Catalog="Model; one";semanticmodelid=${id};Password=untrusted;EffectiveUserName=someone;`}})
  try{
   const auth={getToken:vi.fn(async()=>'configured-token')},bridge=vi.fn()
   const http={get:vi.fn(async url=>({data:{value:url.endsWith('/groups')?[{id,name:'Workspace; one'}]:[{id,name:'Model; one'}]}}))}
   const c=await createConnector({auth,http,bridge}).connect({kind:'report',reportDir:f.report})
   expect(c.source).toEqual({kind:'fabric',workspaceId:id,datasetId:id})
   expect(bridge).not.toHaveBeenCalled()
   expect(http.get.mock.calls[0][1].headers.Authorization).toBe('Bearer configured-token')
   expect(JSON.stringify(c)).not.toContain('untrusted')
  }finally{f.close()}
 })
 it('routes SSAS only to the Windows-integrated bridge, without acquiring an Entra token',async()=>{
  const f=fixture({byConnection:{connectionString:'Data Source=server\\instance;Initial Catalog=Sales;User ID=ignored;Password=ignored'}})
  try{
   const auth={getToken:vi.fn()},bridge=vi.fn(async()=>({tables:[],columns:[],measures:[]}))
   const api=createConnector({auth,bridge}),c=await api.connect({kind:'report',reportDir:f.report})
   expect(c.source).toEqual({kind:'ssas',endpoint:'server\\instance',catalog:'Sales'})
   expect(bridge).toHaveBeenCalledWith({action:'metadata',endpoint:'server\\instance',catalog:'Sales'})
   expect(auth.getToken).not.toHaveBeenCalled()
  }finally{f.close()}
 })
 it.each(['Data Source="unterminated','A=1;a=2','A="x"oops'])('rejects malformed connection strings: %s',text=>{
  expect(()=>parseConnectionString(text)).toThrow()
 })
 it.each(['powerbi://evil.test/v1.0/myorg/ws','https://evil.test/endpoint','powerbi://user@api.powerbi.com/v1.0/myorg/ws'])('never forwards configured credentials to %s',endpoint=>{
  const f=fixture({byConnection:{connectionString:`Data Source=${endpoint};Initial Catalog=Sales`}})
  try{expect(()=>readReportConnection(f.report)).toThrow()}finally{f.close()}
 })
})
