import {describe,it,expect} from 'vitest'
import {makeFormatter} from '../packages/core/src/templates/instantiate.js'
import {createModelFormatter} from '../packages/core/src/shared/modelFormatting.js'
import {resolveVisualSpec} from '../packages/core/src/spec/resolve.js'
import {requiredRendererVersion,assertRendererVersion} from '../packages/core/src/pbir/rendererCompatibility.js'

const compact=makeFormatter('{value:compact}')

describe('{value:compact} formatter token',()=>{
 it('scales to K/M/B/T with one decimal below 100 of a unit',()=>{
  expect(compact(0)).toBe('0')
  expect(compact(0.256)).toBe('0.26')
  expect(compact(12.34)).toBe('12.3')
  expect(compact(950)).toBe('950')
  expect(compact(14600)).toBe('14.6K')
  expect(compact(190966272.53)).toBe('191M')
  expect(compact(9886931005.97)).toBe('9.9B')
  expect(compact(1.2e12)).toBe('1.2T')
  expect(compact(-28200)).toBe('-28.2K')
 })
 it('drops a trailing .0 and promotes values that round up to the next unit',()=>{
  expect(compact(2e9)).toBe('2B')
  expect(compact(999960)).toBe('1M')
  expect(compact(999400)).toBe('999K')
 })
 it('keeps only the currency symbol from the measure format, never its unit literal',()=>{
  const usd=createModelFormatter('$#,0.00;($#,0.00);$0.00')
  expect(compact(9886931005.97,usd)).toBe('$9.9B')
  expect(compact(-610708317.6,usd)).toBe('-$611M')
  expect(compact(6.4,createModelFormatter('$#,0.0"M"'))).toBe('$6.4')
  expect(compact(2500000,createModelFormatter('#,0.00 €'))).toBe('2.5M€')
  expect(compact(2500000,createModelFormatter('[$₹-4009] #,0'))).toBe('₹2.5M')
  expect(compact(2500000,createModelFormatter('#,0'))).toBe('2.5M')
 })
 it('leaves percent, date and text measures in their own format',()=>{
  expect(compact(0.559,createModelFormatter('0.0%'))).toBe('55.9%')
  expect(compact('2026-03-03',createModelFormatter('yyyy-MM-dd'))).toBe('2026-03-03')
 })
 it('formats the numeric component of a tuple with {value.N:compact}',()=>{
  const pair=makeFormatter('{value.0:compact}')
  expect(pair({value:[9886931005.97,'Computers']})).toBe('9.9B')
 })
 it('applies to labels and value-axis templates through the bound measure format',()=>{
  const spec={template:{meta:{id:'compact-bars'},slots:{cat:{kind:'dimension'},sales:{kind:'measure'}},template:{
   xAxis:{type:'value',axisLabel:{formatterTemplate:'{value:compact}'}},yAxis:{type:'category',data:'$slot.cat.categories'},
   series:[{type:'bar',data:'$slot.sales.values',label:{show:true,formatterTemplate:'{value:compact}'}}]}}}
  const option=resolveVisualSpec(spec,[{_cats:['Computers'],_val:9886931005.97}],{measures:[{name:'Net Sales',formatString:'$#,0.00;($#,0.00);$0.00'}]})
  expect(option.series[0].label.formatter({value:9886931005.97})).toBe('$9.9B')
  expect(option.xAxis.axisLabel.formatter(2e9)).toBe('$2B')
 })
 it('requires renderer 4.45 so older registered renderers refuse instead of breaking',()=>{
  const spec=label=>({canvasTheme:'light',template:{meta:{id:'t'},slots:{v:{kind:'measure'}},template:{series:[{type:'bar',data:'$slot.v.values',label:{formatterTemplate:label}}]}}})
  expect(requiredRendererVersion(spec('{value:compact}'))).toBe('4.45.0.0')
  expect(requiredRendererVersion(spec('{value.0:compact} sales'))).toBe('4.45.0.0')
  expect(requiredRendererVersion(spec('{value:thousands}'))).toBeNull()
  expect(()=>assertRendererVersion(spec('{value:compact}'),{},'4.44.0.0')).toThrow('requires vilsem Renderer 4.45.0.0')
  expect(()=>assertRendererVersion(spec('{value:compact}'),{},'4.45.0.0')).not.toThrow()
 })
 it('keeps an authored {value} axis template identical to the measure format',()=>{
  const spec={template:{meta:{id:'plain-axis'},slots:{cat:{kind:'dimension'},sales:{kind:'measure'}},template:{
   xAxis:{type:'value',axisLabel:{formatterTemplate:'{value}'}},yAxis:{type:'category',data:'$slot.cat.categories'},
   series:[{type:'bar',data:'$slot.sales.values'}]}}}
  const option=resolveVisualSpec(spec,[{_cats:['A'],_val:1234.5}],{measures:[{name:'Sales',formatString:'$#,0.00'}]})
  expect(option.xAxis.axisLabel.formatter(1234.5)).toBe('$1,234.50')
 })
})
