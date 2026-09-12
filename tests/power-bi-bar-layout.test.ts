import { describe, it, expect } from 'vitest'
import { composeOption } from '../pbiviz-semantica-renderer/src/compositions'
const rows=[{_cat:'Accessories',_val:57809},{_cat:'Bikes',_val:13929},{_cat:'Clothing',_val:12436}]
const theme={textMuted:'#888',textPrimary:'#fff',gridStroke:'#222'}
describe('Power BI bar-family label clearance',()=>{
 it('reserves top space for default Column outside labels',()=>{
  const option=composeOption('column',rows,{},theme)
  expect(option.series[0].label.position).toBe('top')
  expect(option.grid[0].top).toBeGreaterThanOrEqual(20)
  expect(option.yAxis.max).toBe(57809)
 })
 it.each([['bar',{}],['column',{dataLabels:false}],['column',{labelPosition:'inside'}]])('preserves compact layout for %s %j',(type,config)=>{
  expect(composeOption(type,rows,config,theme).grid[0].top).toBe(4)
 })
})


describe('stacked signed domains',()=>{
 it('includes the complete negative stack',()=>{
  const o=composeOption('stacked_bar',[{_cat:'Loss',_val:-8,_val2:-5}],{},theme)
  expect(o.xAxis.min).toBeLessThanOrEqual(-13)
 })
 it('does not cancel opposite signed segments in the positive domain',()=>{
  const o=composeOption('stacked_bar',[{_cat:'Mixed',_val:8,_val2:-5}],{},theme)
  expect(o.xAxis.max).toBeGreaterThanOrEqual(8)
 })
})
