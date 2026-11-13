import {describe,it,expect} from 'vitest'
import {enrichSchema} from '../packages/core/src/connect/schemaContext.js'

const schema={tables:[
 {name:'Sales',columns:[{name:'Amount',dataType:'double'},{name:'Region',dataType:'string'}]},
 {name:'Product',columns:[{name:'Category',dataType:'string'}]},
],measures:[{name:'Net Sales',table:'Sales',formatString:'$#,0'}]}

function recorder(){
 const calls=[]
 const query=async dax=>{
  calls.push(dax)
  if(dax.startsWith('EVALUATE ROW('))return [{'[__rows]':10,'[c0Distinct]':3,'[c0Blanks]':0,'[c0Min]':1,'[c0Max]':9,'[c1Distinct]':2,'[c1Blanks]':0}]
  return [{v:'A'},{v:'B'}]
 }
 return {calls,query}
}

describe('bounded schema profiling options',()=>{
 it('profile:false returns fields and measure formats without running any query',async()=>{
  const {calls,query}=recorder()
  const result=await enrichSchema(schema,query,{profile:false})
  expect(calls).toEqual([])
  expect(result.measures[0].formatString).toBe('$#,0')
  expect(result.tables[0].columns[0]).toMatchObject({name:'Amount',cardinality:null,profileSkipped:'Not profiled (profile:false)'})
 })
 it('samples:false skips sample queries entirely but still profiles counts and ranges',async()=>{
  const {calls,query}=recorder()
  const result=await enrichSchema(schema,query,{samples:false})
  expect(calls.every(dax=>dax.startsWith('EVALUATE ROW('))).toBe(true)
  expect(result.tables[0].columns[0]).toMatchObject({cardinality:3,min:1,max:9,sampleValues:[],sampleSkipped:'Samples not requested (samples:false)'})
 })
 it('tables:[...] profiles only the requested tables, case-insensitively',async()=>{
  const {calls,query}=recorder()
  const result=await enrichSchema(schema,query,{tables:['product']})
  expect(calls.every(dax=>dax.includes("'Product'"))).toBe(true)
  expect(result.tables[0].columns[0].profileSkipped).toMatch('table not in the requested tables')
  expect(result.tables[1].columns[0].sampleValues).toEqual(['A','B'])
 })
 it('stops starting new queries after the time budget and labels what was skipped',async()=>{
  const {calls,query}=recorder()
  let clock=0
  const slowQuery=async dax=>{clock+=15000;return query(dax)}
  const result=await enrichSchema(schema,slowQuery,{budgetMs:20000,now:()=>clock})
  expect(calls.length).toBeLessThan(5)
  expect(result.profileIncomplete).toMatch(/Profiling stopped after 20 s/)
  const skipped=result.tables.flatMap(t=>t.columns).filter(c=>/time budget reached/.test(c.profileSkipped || c.sampleSkipped || ''))
  expect(skipped.length).toBeGreaterThan(0)
 })
 it('keeps the previous complete behaviour by default on small models',async()=>{
  const {query}=recorder()
  const result=await enrichSchema(schema,query)
  expect(result.profileIncomplete).toBeUndefined()
  expect(result.tables[0].columns[0]).toMatchObject({cardinality:3,sampleValues:['A','B']})
 })
})
