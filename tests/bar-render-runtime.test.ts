import {describe,it,expect} from 'vitest'
import {createRequire} from 'node:module'
import {composeOption} from '../vilsem-renderer/src/compositions'
const require=createRequire(import.meta.url)
const echarts=require('../vilsem-renderer/node_modules/echarts')
const theme={textMuted:'#888',textPrimary:'#fff',gridStroke:'#222'}
describe('stacked bar ECharts runtime geometry',()=>{
 it.each(['slope','lollipop'])('%s honors both animation controls in Power BI',type=>{
  const rows=[{_cat:'A',_val:10,_val2:20}]
  expect(composeOption(type,rows,{animations:false},theme).animation).toBe(false)
  expect(composeOption(type,rows,{animationEnabled:false},theme).animation).toBe(false)
  expect(composeOption(type,rows,{animations:true,animationEnabled:true},theme).animation).toBe(true)
 })
 it('suppresses overlapping slope endpoint values',()=>{
  const chart=echarts.init(null,null,{renderer:'svg',ssr:true,width:440,height:320})
  try{
   chart.setOption({...composeOption('slope',[{_cat:'A',_val:1000,_val2:500},{_cat:'B',_val:990,_val2:500}],{showLegend:false},theme),animation:false})
   const labels=chart.getZr().storage.getDisplayList(true).filter(t=>t.type==='tspan'&&t.style.text==='500'&&!t.ignore&&!t.invisible)
   const boxes=labels.map(t=>{const rect=t.getBoundingRect().clone();rect.applyTransform(t.getComputedTransform());return rect})
   if(boxes.length===2)expect(boxes[0].intersect(boxes[1])).toBe(false)
   expect(labels.length).toBeGreaterThan(0)
  }finally{chart.dispose()}
 })
 it('keeps visible adjacent stack labels from overlapping',()=>{
  const chart=echarts.init(null,null,{renderer:'svg',ssr:true,width:440,height:320})
  try{
   chart.setOption(composeOption('stacked_bar',[{_cat:'Accessories',_val:57809,_val2:1130}],{animations:false,measureName:'Sold',secondaryMeasureName:'Returned'},theme))
   const labels=[0,1].map(i=>chart.getModel().getSeriesByIndex(i).getData().getItemGraphicEl(0)?.getTextContent()).filter(t=>t&&!t.ignore&&!t.invisible)
   const boxes=labels.map(t=>{const rect=t.getBoundingRect().clone();rect.applyTransform(t.getComputedTransform());return rect})
   if(boxes.length===2)expect(boxes[0].intersect(boxes[1])).toBe(false)
   expect(labels.length).toBeGreaterThan(0)
  }finally{chart.dispose()}
 })
 it.each([
  ['negative',-8,-5,-13],
  ['mixed',8,-5,8],
  ['positive',8,5,13],
 ])('renders %s stack endpoint within the plot',(_name,a,b,end)=>{
  const chart=echarts.init(null,null,{renderer:'svg',ssr:true,width:640,height:320})
  try{
   const option=composeOption('stacked_bar',[{_cat:'Test',_val:a,_val2:b}],{animations:false,measureName:'Primary',secondaryMeasureName:'Secondary'},theme)
   chart.setOption(option)
   const rect=chart.getModel().getComponent('grid').coordinateSystem.getRect()
   const x=chart.convertToPixel({xAxisIndex:0},end)
   expect(x).toBeGreaterThanOrEqual(rect.x-0.01)
   expect(x).toBeLessThanOrEqual(rect.x+rect.width+0.01)
   const svg=chart.renderToSVGString()
   expect(svg).toContain('<path')
   expect(svg).not.toContain('NaN')
  }finally{chart.dispose()}
 })
})
