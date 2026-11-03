import {describe,it,expect} from 'vitest'
import {PieMarks,LineMarks,PointMarks,TreemapMarks,RadarMarks} from '@vilsem/core/primitives'
const category='<b data-qa="category">A & B</b>'
const ctx:any={data:{rows:[{_cat:category,_val:25,_val2:10},{_cat:'Other',_val:75,_val2:20}]},theme:{},dimensions:{width:400,height:300}}
describe('literal dataset text in chart tooltips',()=>{
 it.each([['pie',PieMarks],['line',LineMarks],['scatter',PointMarks],['treemap',TreemapMarks],['radar',RadarMarks]] as const)('%s does not interpret category markup',(_name,primitive)=>{
  const option:any=primitive({colorScheme:'teal'} as any,ctx).option
  const value=_name==='scatter'?[25,10]:_name==='radar'?[25,75]:25
  const html=option.tooltip.formatter({name:category,value,seriesName:'Sales',marker:''})
  expect(html).not.toContain(category)
  expect(html).toContain('&lt;b')
  expect(html).toContain('A &amp; B')
 })
 it('escapes custom series labels and value adornments while keeping ECharts marker markup',()=>{
  const option:any=LineMarks({colorScheme:'teal',prefix:'<i>',suffix:'&'},ctx).option
  const html=option.tooltip.formatter({name:'A',value:25,seriesName:'<b>Sales</b>',marker:'<span class="echarts-marker"></span>'})
  expect(html).toContain('&lt;b&gt;Sales&lt;/b&gt;')
  expect(html).toContain('&lt;i&gt;25&amp;')
  expect(html).toContain('<span class="echarts-marker"></span>')
 })
})
