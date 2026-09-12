import { it, expect } from 'vitest'
import { schemaFieldsForTab, legendSchemaExtras } from '../ui/src/appspec/shared/schemaPlacement.js'
it('places typography under Text and preserves explicit placement',()=>{
 const schema=[{key:'labelFontSize'},{key:'centerColor'},{key:'barRadius'},{key:'special',tab:'text'}]
 expect(schemaFieldsForTab(schema,'text').map(f=>f.key)).toEqual(['labelFontSize','centerColor','special'])
 expect(schemaFieldsForTab(schema,'style').map(f=>f.key)).toEqual(['barRadius'])
 expect(schema[0]).toEqual({key:'labelFontSize'})
})
it('keeps one common value/legend control while retaining legend extras',()=>{
 const schema=[{key:'valueFontSize'},{key:'showLegend',group:'Legend'},{key:'legendPosition',group:'Legend'},{key:'maxLegendItems',group:'Legend'}]
 expect(schemaFieldsForTab(schema,'text',{valueText:true,legend:true})).toEqual([])
 expect(legendSchemaExtras(schema).map(f=>f.key)).toEqual(['maxLegendItems'])
 expect(schemaFieldsForTab(schema,'text').length).toBe(4)
})
