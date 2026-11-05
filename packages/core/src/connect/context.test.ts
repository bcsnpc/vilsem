import {describe,it,expect} from 'vitest'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const {parseTmdlPart,parseTmslModelBim,parseRelationshipsPart}=require('./metadata.cjs')
const {createConnector}=require('./index.cjs')

describe('agent-facing model metadata',()=>{
 it('retains multiline measure DAX, folders and hidden/key flags without changing definitions',()=>{
  const text="table Sales\n\tcolumn Id\n\t\tdataType: int64\n\t\tisKey\n\t\tisHidden\n\tcolumn Margin = 1\n\t\tdataType: double\n\tmeasure Revenue = SUMX(\n\t\tSales, Sales[Amount]\n\t\t)\n\t\tdisplayFolder: Finance\\Revenue\n\t\tformatString: $#,0\n\t\tdescription: Net revenue\n\t\tisHidden\n"
  const result=parseTmdlPart(text)
  expect(result.columns).toEqual(expect.arrayContaining([expect.objectContaining({name:'Id',isKey:true,isHidden:true}),expect.objectContaining({name:'Margin',dataType:'double'})]))
  expect(result.measures[0]).toMatchObject({expression:'SUMX(\nSales, Sales[Amount]\n)',displayFolder:'Finance\\Revenue',description:'Net revenue',formatString:'$#,0',isHidden:true})
 })
 it('exposes BIM folders and the full relationship endpoints',()=>{
  const result=parseTmslModelBim({model:{tables:[{name:'Sales',measures:[{name:'Revenue',expression:['SUM(','Sales[Amount])'],displayFolder:'Finance'}]}],relationships:[{name:'r',fromTable:'Sales',fromColumn:'ProductId',toTable:'Product',toColumn:'Id',isActive:false,crossFilteringBehavior:'bothDirections'}]}})
  expect(result.measures[0]).toMatchObject({displayFolder:'Finance',expression:'SUM(\nSales[Amount])'})
  expect(result.relationships[0]).toMatchObject({fromColumn:'ProductId',toColumn:'Id',cardinality:'many_to_one',isActive:false})
 })
 it('reads explicit TMDL relationship end cardinalities and quoted endpoints',()=>{
  const [edge]=parseRelationshipsPart("relationship r\n\tfromColumn: 'Sales data'.'Product.Id'\n\ttoColumn: Product.Id\n\tfromCardinality: one\n\ttoCardinality: one\n\tcrossFilteringBehavior: bothDirections\n\tisActive: false\n")
  expect(edge).toMatchObject({fromTable:'Sales data',fromColumn:'Product.Id',toTable:'Product',toColumn:'Id',cardinality:'one_to_one',crossFilter:'bothDirections',isActive:false})
 })
 it('resolves Desktop relationship IDs to field names and preserves measure metadata',async()=>{
  const api=createConnector()
  const schema=await api.schema({source:{kind:'desktop'},metadata:{tables:[{id:1,name:'Sales'},{id:2,name:'Product'}],columns:[{id:10,tableId:1,name:'ProductId',dataType:6,isKey:false,isHidden:true},{id:20,tableId:2,name:'Id',dataType:6,isKey:true}],measures:[{tableId:1,name:'Revenue',expression:'SUM(Sales[Amount])',displayFolder:'Finance',description:'Net'}],relationships:[{name:'r',fromTableId:1,fromColumnId:10,toTableId:2,toColumnId:20,fromCardinality:2,toCardinality:1,crossFilteringBehavior:1,isActive:true}]}})
  expect(schema.measures[0]).toMatchObject({table:'Sales',expression:'SUM(Sales[Amount])',displayFolder:'Finance'})
  expect(schema.relationships[0]).toMatchObject({fromTable:'Sales',fromColumn:'ProductId',toTable:'Product',toColumn:'Id',cardinality:'many_to_one',direction:'oneDirection',isActive:true})
 })
})
