import {describe,it,expect} from 'vitest'
import {createModelFormatter} from '../packages/core/src/shared/modelFormatting.js'
import {resolveVisualSpec} from '../packages/core/src/spec/resolve.js'
import {applyModelFormats} from '../packages/core/src/shared/applyModelFormats.js'

describe('model display formats shared by preview and host',()=>{
 it('formats directly bound heatmap cell labels without formatting categorical coordinates',()=>{
  const spec={template:{meta:{id:'matrix-format'},slots:{x:{kind:'dimension'},y:{kind:'dimension'},ratio:{kind:'measure'}},template:{xAxis:{type:'category',data:'$slot.x.categories'},yAxis:{type:'category',data:'$slot.y.categories'},series:[{type:'heatmap',data:'$slot.ratio.matrix',label:{show:true}}]}}}
  const option=resolveVisualSpec(spec,[{_cats:['A','B'],_val:.2345}],{measures:[{name:'Margin',formatString:'0.00%'}]})
  expect(option.series[0].label.formatter({value:[0,0,.2345]})).toBe('23.45%')
  expect(option.series[0].tooltip.valueFormatter(.2345)).toBe('23.45%')
  expect(option.xAxis.axisLabel.formatter).toBeUndefined()
 })
 it('rounds floating-point axis artifacts without inventing units or replacing authored formatting',()=>{
  const custom=value=>`authored ${value}`
  const input={xAxis:[{type:'value'},{type:'value',axisLabel:{formatter:custom}},{type:'category'}],series:[]}
  const option=applyModelFormats(input,{},[],{locale:'en-US'})
  expect(option.xAxis[0].axisLabel.formatter(14.399999999999999)).toBe('14.4')
  expect(option.xAxis[0].axisLabel.formatter(.000012345)).toBe('0.000012345')
  expect(option.xAxis[1].axisLabel.formatter).toBe(custom)
  expect(option.xAxis[2].axisLabel).toBeUndefined()
  expect(input.xAxis[0].axisLabel).toBeUndefined()
 })
 it('honors viewer grouping, decimal separators and localized month names without changing values',()=>{
  expect(createModelFormatter('$#,0.00',{locale:'en-IN'})(24914586.8193)).toBe('$2,49,14,586.82')
  expect(createModelFormatter('0.00%',{locale:'de-DE'})(.2345)).toBe('23,45%')
  expect(createModelFormatter('mmmm d, yyyy',{locale:'de-DE'})('2026-03-03')).toBe('März 3, 2026')
  expect(()=>createModelFormatter('#,0',{locale:'not_a_locale'})).toThrow('Invalid formatting locale')
  const option=resolveVisualSpec({type:'column'},[{_cat:'A',_val:24914586.8193}],{locale:'en-IN',measures:[{name:'Revenue',formatString:'$#,0.00'}]})
  expect(option.series[0].label.formatter({value:24914586.8193})).toBe('$2,49,14,586.82')
  expect(option.yAxis.axisLabel.formatter(24914586.8193)).toBe('$2,49,14,586.82')
  expect(option.series[0].data[0]?.value??option.series[0].data[0]).toBe(24914586.8193)
 })
 it.each([false,true])('formats raw measure labels and axes in composition/template mode %s',templateMode=>{
  const spec=templateMode?{template:{meta:{id:'formatted-ratio'},slots:{category:{kind:'dimension'},ratio:{kind:'measure'}},template:{xAxis:{type:'category',data:'$slot.category.categories'},yAxis:{type:'value'},series:[{type:'bar',data:'$slot.ratio.values',label:{show:true,formatterTemplate:'{name}: {value:thousands}'}}]}}}:{type:'column'}
  const option=resolveVisualSpec(spec,[{_cat:'A',_val:.2345}],{measures:[{name:'Margin',formatString:'0.00%'}]})
  expect(option.yAxis.axisLabel.formatter(.2345)).toBe('23.45%')
  expect(option.series[0].label.formatter({name:'A',value:.2345})).toBe(templateMode?'A: 23.45%':'23.45%')
  expect(option.series[0].tooltip.valueFormatter(.2345)).toBe('23.45%')
 })
 it.each([
  ['0.00%',.2345,'23.45%'],['#,0',1234567,'1,234,567'],['$#,0.00',1234.5,'$1,234.50'],
  ['#,0.000',12.3,'12.300'],['0.##',12.3,'12.3'],['0.0,"K"',12345,'12.3K'],['0.0,,"M"',12345678,'12.3M'],
  ['0.00,,,"B"',1234567890,'1.23B'],['#,0;(#,0)',-1234,'(1,234)'],['0.0%;-0.0%;"—"',0,'—'],
  ['#,0,,.0"M"',12345678,'12.3M'],
  ['[$€-407]#,0.00',1234.5,'€1,234.50'],['yyyy-mm-dd','2026-11-03','2026-11-03'],
  ['mmm d, yyyy','2026-11-03','Nov 3, 2026'],['hh:mm:ss','2026-11-03T14:05:06Z','14:05:06'],
 ])('%s formats %s without changing its numerical value',(format,value,expected)=>expect(createModelFormatter(format)(value)).toBe(expected))
 it('preserves null/nonfinite emptiness and tiny unformatted decimals instead of inventing percentages',()=>{
  const format=createModelFormatter();expect(format(null)).toBe('(Blank)');expect(format(NaN)).toBe('(Blank)');expect(format(.2345)).toBe('0.2345')
 })
 it('bounds and validates literals; caller text never executes',()=>{
  expect(()=>createModelFormatter('"unfinished')).toThrow(/unterminated/)
  expect(()=>createModelFormatter('0'.repeat(513))).toThrow(/512/)
  expect(createModelFormatter('"globalThis.fetch()"')(1)).toBe('globalThis.fetch()')
 })
})
