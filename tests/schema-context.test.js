import {describe,it,expect,vi} from 'vitest'
import {enrichSchema,schemaDetail,columnProfileQuery} from '../packages/core/src/connect/schemaContext.js'
const fixture=()=>({tables:[{name:'Sales',partitions:['private'],columns:[{name:'Amount',dataType:'double',isKey:false,isHidden:true},{name:'Category',dataType:'string'}]}],measures:[{name:'Revenue',table:'Sales',expression:'SUM(Sales[Amount])',displayFolder:'Finance',description:'Net',formatString:'$#,0'}],relationships:[{fromTable:'Sales',fromColumn:'Id',toTable:'Product',toColumn:'Id',cardinality:'many_to_one',crossFilter:'oneDirection',isActive:true}],rawModelBim:{dataSources:['private']}})
describe('read-only schema context',()=>{
 it('profiles composite-key field parameters without dropping their key semantics',async()=>{
  const schema={tables:[{name:'Parameters',columns:[{name:'Metric',dataType:'string'}]}],measures:[]}
  const query=vi.fn(async dax=>{
   if(dax.includes('DISTINCTCOUNT('))throw Error('part of composite key')
   if(dax.startsWith('EVALUATE ROW'))return [{__rows:5,c0Distinct:5,c0Blanks:0}]
   return [{value:'Revenue'}]
  })
  const result=await enrichSchema(schema,query)
  expect(result.tables[0].columns[0]).toMatchObject({cardinality:5,nullShare:0,sampleValues:['Revenue']})
  expect(result.tables[0].columns[0].profileError).toBeUndefined()
  expect(query.mock.calls.some(([dax])=>dax.includes('DISTINCT(SELECTCOLUMNS('))).toBe(true)
 })
 it('profiles exact counts/ranges in one typed ROW batch, preserving input and sample types',async()=>{
  const schema=fixture(),before=structuredClone(schema)
  const query=vi.fn(async dax=>dax.startsWith('EVALUATE ROW')?[{'[__rows]':5,'[c0Distinct]':4,'[c0Blanks]':1,'[c0Min]':10,'[c0Max]':90,'[c1Distinct]':3,'[c1Blanks]':0}]:dax.includes('[Amount]')?[{x:10},{x:90}]:[{x:'A'},{x:'B'}])
  const full=await enrichSchema(schema,query)
  expect(full.tables[0].columns[0]).toMatchObject({cardinality:4,nullShare:.2,min:10,max:90,sampleValues:[10,90],isHidden:true})
  expect(full.tables[0].columns[1]).toMatchObject({cardinality:3,nullShare:0,min:null,max:null,sampleValues:['A','B']})
  expect(query.mock.calls.filter(([dax])=>dax.startsWith('EVALUATE ROW'))).toHaveLength(1)
  expect(full.rawModelBim).toBeUndefined();expect(full.tables[0].partitions).toBeUndefined();expect(schema).toEqual(before)
  expect(schemaDetail(full).measures[0].expression).toBeUndefined();expect(schemaDetail(full).relationships).toBeUndefined()
  expect(schemaDetail(full,'full').measures[0].expression).toBe('SUM(Sales[Amount])')
 })
 it('quotes model identifiers and never interpolates them as executable DAX',()=>{
  expect(columnProfileQuery("O'Brien",[{name:'A]mount',dataType:'double'}])).toContain("'O''Brien'[A]]mount]")
  expect(()=>columnProfileQuery('T',[])).toThrow('1..8')
 })
 it('reports offline/empty/unqueryable states without inventing zeros',async()=>{
  const query=vi.fn(),offline=await enrichSchema(fixture(),query,{schemaOnly:true})
  expect(query).not.toHaveBeenCalled();expect(offline.tables[0].columns[0]).toMatchObject({cardinality:null,nullShare:null,sampleValues:[]})
  const schema={...fixture(),tables:[{name:'T',columns:[{name:'RowNumber-engine',dataType:'int64'}]}]}
  const internal=await enrichSchema(schema,query);expect(internal.tables[0].columns[0].sampleSkipped).toContain('not queryable');expect(query).not.toHaveBeenCalled()
  const result=await enrichSchema(fixture(),async dax=>dax.startsWith('EVALUATE ROW')?[{__rows:null,c0Distinct:0,c0Blanks:0,c1Distinct:0,c1Blanks:0}]:[])
  expect(result.tables[0].columns[0]).toMatchObject({cardinality:0,nullShare:null,min:null,max:null})
 })
 it('isolates profile errors and retains field-parameter sample fallback',async()=>{
  const query=vi.fn(async dax=>{if(dax.startsWith('EVALUATE ROW'))throw Error('restricted');if(dax.includes('VALUES('))throw Error('part of composite key');return [{x:'Revenue'},{x:'Revenue'},{x:'Profit'}]})
  const result=await enrichSchema(fixture(),query)
  expect(result.tables[0].columns[0]).toMatchObject({profileError:'restricted',sampleValues:['Revenue','Profit']})
 })
})
