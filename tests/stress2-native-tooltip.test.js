import {describe,it,expect} from 'vitest'
import {makeFormatter,nativeTemplateTooltipItems} from '@vilsem/core/templates'
import {resolveVisualSpec} from '@vilsem/core/spec/resolve'
import {requiredRendererVersion} from '@vilsem/core/pbir'
describe('native template tooltip formatting',()=>{
 it('uses bound model formats and viewer locale instead of rounding small values to zero',()=>{
  const fields=[{name:'Margin',value:.2345,format:'0.00%',locale:'de-DE'},{name:'Tiny',value:.000012345,format:undefined,locale:'en-US'},{name:'Day',value:'2026-11-04',isDate:true,format:'yyyy-mm-dd'}]
  expect(nativeTemplateTooltipItems({value:[0,0,.2345]},undefined,undefined,fields)).toEqual([{displayName:'Margin',value:'23,45%'},{displayName:'Tiny',value:'0.000012345'},{displayName:'Day',value:'2026-11-04'}])
 })
 it('selects bounded tuple components and preserves existing last-value aliases',()=>{
  const f=makeFormatter('{name}: Revenue {value.0:thousands}; Profit {c.1:thousands}; share {value.2:percent}; last {value}')
  expect(f({name:'Bikes',value:[12345.678,-20.5,0.25]})).toBe('Bikes: Revenue 12,345.68; Profit -20.5; share 25%; last 0.25')
  expect(makeFormatter('{value.0:percent}')({value:[0]})).toBe('0%')
  expect(makeFormatter('{value.0:percent}')({value:[null]})).toBe('')
  expect(makeFormatter('{value.5:thousands}')({value:[1]})).toBe('')
 })
 it('honours the trusted formatter through host items and formats fallback tuples/nulls',()=>{
  const p={name:'Bikes',value:[12345.678,-20.5]}
  expect(nativeTemplateTooltipItems(p,makeFormatter('Revenue {value.0:thousands}; Profit {value.1:thousands}'))).toEqual([{displayName:'Details',value:'Revenue 12,345.68; Profit -20.5'}])
  expect(nativeTemplateTooltipItems({...p,value:[10000,null,0]})).toEqual([{displayName:'Bikes',value:'10,000 / (Blank) / 0'}])
 })
 it('rejects arbitrary tuple access and requires a compatible native renderer',()=>{
  const spec=fmt=>({template:{meta:{id:'tooltip'},slots:{v:{kind:'measure'}},template:{tooltip:{formatterTemplate:fmt}}}})
  expect(()=>resolveVisualSpec(spec('{value.0:thousands}'))).not.toThrow()
  expect(()=>resolveVisualSpec(spec('{value.6:thousands}'))).toThrow(/unknown formatter/)
  expect(()=>resolveVisualSpec(spec('{value.constructor}'))).toThrow(/unknown formatter/)
  expect(requiredRendererVersion({...spec('{value.1:thousands}'),canvasTheme:'dark'})).toBe('4.20.0.0')
 })
 it('labels radar tuple components and bounds oversized host tooltip payloads',()=>{
  const p={name:'Revenue',value:[12345,null,0]}
  const labels=[{name:'US'},{name:'Canada'},{name:'France'}]
  expect(nativeTemplateTooltipItems(p,undefined,labels)).toEqual([{displayName:'Revenue: US',value:'12,345'},{displayName:'Revenue: Canada',value:'(Blank)'},{displayName:'Revenue: France',value:'0'}])
  expect(nativeTemplateTooltipItems(p,makeFormatter('Custom {value.0}'),labels)).toEqual([{displayName:'Details',value:'Custom 12345'}])
  const large=nativeTemplateTooltipItems({...p,value:Array(60).fill(1)},undefined,labels)
  expect(large).toHaveLength(51)
  expect(large.at(-1)).toEqual({displayName:'Additional indicators',value:'10 omitted'})
 })
 it('uses bound heatmap field labels instead of exposing tuple coordinate indexes',()=>{
  const fields=[{name:'Date',value:'2020-04-14T00:00:00Z',isDate:true},{name:'Country',value:'Canada'},{name:'Revenue',value:7855.64}]
  const p={value:[103,0,7855.64]}
  expect(nativeTemplateTooltipItems(p,undefined,undefined,fields)).toEqual([{displayName:'Date',value:'2020-04-14'},{displayName:'Country',value:'Canada'},{displayName:'Revenue',value:'7,855.64'}])
  expect(nativeTemplateTooltipItems(p,makeFormatter('Revenue {value.2:thousands}'),undefined,fields)).toEqual([{displayName:'Details',value:'Revenue 7,855.64'}])
 })
})
