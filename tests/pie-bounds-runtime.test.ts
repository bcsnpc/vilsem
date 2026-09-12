import {describe,it,expect} from 'vitest'
import {createRequire} from 'node:module'
import {PieMarks} from '../ui/src/primitives/pie-marks'
const require=createRequire(import.meta.url)
const echarts=require('../ui/node_modules/echarts')

describe('pie and donut legend layout bounds',()=>{
 it('removes categorical legend entries when switching to scalar progress and restores them on return',()=>{
  const chart=echarts.init(null,null,{renderer:'svg',ssr:true,width:400,height:300})
  const ctx:any={data:{rows:[{_cat:'Accessories',_val:25}]},theme:{},dimensions:{width:400,height:300}}
  const render=()=>chart.setOption(PieMarks({colorScheme:'teal',animEnabled:false},ctx).option,{replaceMerge:['series','xAxis','yAxis','tooltip']})
  try{
   render()
   expect(chart.getOption().legend[0].show).toBe(true)
   ctx.data.rows=[{_val:25}]
   render()
   expect(chart.getOption().legend[0].show).toBe(false)
   expect(chart.getOption().legend[0].data).toEqual([])
   ctx.data.rows=[{_cat:'Bikes',_val:40}]
   render()
   expect(chart.getOption().legend[0].show).toBe(true)
   expect(chart.getOption().legend[0].data).toEqual(['Bikes'])
   expect(chart.getModel().getSeriesByIndex(0).get('silent')).toBeFalsy()
  }finally{chart.dispose()}
 })
 it('resets reserved space when a legend is hidden or categorical data becomes scalar',()=>{
  const chart=echarts.init(null,null,{renderer:'svg',ssr:true,width:274,height:366})
  const ctx:any={data:{rows:[{_cat:'A',_val:25}]},theme:{},dimensions:{width:274,height:366}}
  try{
   const render=(props:any)=>chart.setOption(PieMarks({colorScheme:'teal',animEnabled:false,...props},ctx).option)
   render({legendPosition:'right'})
   render({showLegend:false})
   expect(chart.getModel().getSeriesByIndex(0).getData().getItemLayout(0).cx).toBe(137)
   render({legendPosition:'right'})
   ctx.data.rows=[{_val:25}]
   render({})
   expect(chart.getModel().getSeriesByIndex(0).getData().getItemLayout(0).cx).toBe(137)
  }finally{chart.dispose()}
 })
 for(const innerRadius of [0,52]) for(const legendPosition of ['right','top','bottom'] as const){
  it.each([[274,366],[640,120],[120,640],[80,80],[800,600]])(`${innerRadius} / ${legendPosition} stays inside %sx%s`,(width,height)=>{
   const chart=echarts.init(null,null,{renderer:'svg',ssr:true,width,height})
   try{
    const ctx:any={data:{rows:[{_cat:'Accessories',_val:57809},{_cat:'Bikes',_val:13929}]},theme:{},dimensions:{width,height}}
    chart.setOption(PieMarks({colorScheme:'teal',innerRadius,outerRadius:95,legendPosition,animEnabled:false},ctx).option)
    const data=chart.getModel().getSeriesByIndex(0).getData()
    for(let i=0;i<data.count();i++){
     const {cx,cy,r}=data.getItemLayout(i)
     expect(cx-r).toBeGreaterThanOrEqual(0)
     expect(cy-r).toBeGreaterThanOrEqual(0)
     expect(cx+r).toBeLessThanOrEqual(width)
     expect(cy+r).toBeLessThanOrEqual(height)
    }
   }finally{chart.dispose()}
  })
 }
})
