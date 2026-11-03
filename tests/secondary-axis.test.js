import { describe, expect, it } from 'vitest'
import { applyAxisTextConfig } from '../ui/src/appspec/shared/axisTextConfig.js'
import { secondaryAxisMinimumWidth, scrollableChartTooltip } from '../ui/src/appspec/shared/secondaryAxis.js'
const base = () => ({ yAxis: { type:'value',show:true,min:0,max:10000,axisLabel:{color:'#123456',fontSize:11},splitLine:{show:true} }, series:[{type:'line',data:[1000,10000]},{type:'line',data:[1,10]}] })
describe('Independent secondary value axis',()=>{
  it('keeps scrollable tooltips inside the document viewport without changing content or visibility',()=>{
    const formatter=()=>'<b>North</b>', option={tooltip:{show:false,formatter},series:[]}
    const root={clientWidth:300,clientHeight:200,ownerDocument:{documentElement:{clientWidth:400,clientHeight:300}},getBoundingClientRect:()=>({left:350,top:250,width:150,height:100})}
    const result=scrollableChartTooltip(option,root)
    expect(result.tooltip).toMatchObject({show:false,formatter,appendToBody:true,confine:false})
    const [x,y]=result.tooltip.position([200,150],null,null,null,{contentSize:[100,80]})
    expect(350+x*.5+100).toBeLessThanOrEqual(396)
    expect(250+y*.5+80).toBeLessThanOrEqual(296)
    expect(option.tooltip).not.toHaveProperty('appendToBody')
    expect(result.series).toBe(option.series)
  })
  it('reserves a scrollable drawing width only for visible independent axes',()=>{
    const config={secondaryAxisEnabled:true}
    const option=applyAxisTextConfig(base(),config)
    expect(secondaryAxisMinimumWidth(option,config)).toBeGreaterThanOrEqual(300)
    expect(secondaryAxisMinimumWidth(option,{})).toBe(0)
    expect(secondaryAxisMinimumWidth(base(),config)).toBe(0)
    option.yAxis[1].show=false
    expect(secondaryAxisMinimumWidth(option,config)).toBe(0)
  })
  it('is opt-in and preserves the original option',()=>{
    const option=base(),copy=JSON.stringify(option)
    expect(applyAxisTextConfig(option,{})).toBe(option)
    const result=applyAxisTextConfig(option,{secondaryAxisEnabled:true})
    expect(result.yAxis).toHaveLength(2)
    expect(result.yAxis[0]).toEqual(option.yAxis)
    expect(result.yAxis[1].position).toBe('right')
    expect(result.yAxis[1].min).toBeUndefined();expect(result.yAxis[1].max).toBeUndefined()
    expect(result.series[1].yAxisIndex).toBe(1)
    expect(result.series.map(s=>s.data)).toEqual(option.series.map(s=>s.data))
    expect(JSON.stringify(option)).toBe(copy)
  })
  it('keeps primary and secondary label formatting independent',()=>{
    const result=applyAxisTextConfig(base(),{secondaryAxisEnabled:true,yAxisLabelColor:'#00ff00',secondaryAxisLabelColor:'#ff00ff',secondaryAxisLabelSize:22,secondaryAxisLabelWeight:800,secondaryAxisLabelFamily:'serif',secondaryAxisLabelRotation:30,secondaryAxisLabelSpacing:14})
    expect(result.yAxis[0].axisLabel.color).toBe('#00ff00')
    expect(result.yAxis[1].axisLabel).toMatchObject({color:'#ff00ff',fontSize:22,fontWeight:800,fontFamily:'serif',rotate:30,margin:14})
  })
  it('supports independent title, ticks, grid and value decoration',()=>{
    const axis=applyAxisTextConfig(base(),{secondaryAxisEnabled:true,secondaryAxisTitle:'Returns',secondaryAxisTitleColor:'#abcdef',secondaryAxisLineColor:'#112233',secondaryAxisGrid:true,secondaryAxisGridColor:'#445566',secondaryAxisPrefix:'$',secondaryAxisSuffix:' units'}).yAxis[1]
    expect(axis.name).toBe('Returns');expect(axis.nameTextStyle.color).toBe('#abcdef')
    expect(axis.axisLine.lineStyle.color).toBe('#112233');expect(axis.splitLine).toMatchObject({show:true,lineStyle:{color:'#445566'}})
    expect(axis.axisLabel.formatter(12)).toBe('$12 units')
  })
  it('does not create incompatible axes for missing, stacked, ranked or custom multi-axis data',()=>{
    for(const change of [o=>o.series.pop(),o=>o.series[1].stack='total',o=>o.yAxis.inverse=true,o=>o.yAxis=[o.yAxis,{type:'value'}]]){
      const option=base();change(option)
      expect(applyAxisTextConfig(option,{secondaryAxisEnabled:true})).toBe(option)
    }
  })
})
