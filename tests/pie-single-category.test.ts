import {describe,it,expect} from 'vitest'
import {PieMarks} from '@vilsem/core/primitives/pie-marks'
const ctx=(rows:any[])=>({data:{fields:[],rows},encoding:{},theme:{shimmerBg:'#222',textMuted:'#888',textPrimary:'#fff'},selection:{},dimensions:{width:400,height:300}} as any)
describe('single-category pie/donut integrity',()=>{
 it.each([0,52])('preserves categorical marks and configured inner radius %s',innerRadius=>{
  const option:any=PieMarks({colorScheme:'teal',innerRadius},ctx([{_cat:'Accessories',_val:25}])).option
  expect(option.series[0].radius[0]).toBe(`${innerRadius}%`)
  expect(option.series[0].data.map(d=>d.name)).toEqual(['Accessories'])
  expect(option.series[0].silent).not.toBe(true)
  expect(option.legend.data).toEqual(['Accessories'])
 })
 it('keeps scalar donut progress behavior',()=>{
  const option:any=PieMarks({colorScheme:'teal',maxValue:100},ctx([{_val:25}])).option
  expect(option.series[0].data.map(d=>d.value)).toEqual([0.25,0.75])
 })
 it('keeps a null category as a category',()=>{
  const option:any=PieMarks({colorScheme:'teal'},ctx([{_cat:null,_val:25}])).option
  expect(option.series[0].data).toHaveLength(1)
 })
})
