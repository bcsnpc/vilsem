import { describe, it, expect } from 'vitest'
import { applyAxisTextConfig } from '../ui/src/appspec/shared/axisTextConfig.js'

describe('explicit axis typography contract', () => {
  it('keeps unset renderer defaults and option identity', () => {
    const option = { xAxis: { axisLabel: { color: '#aaa', fontSize: 9 } } }
    expect(applyAxisTextConfig(option)).toBe(option)
    expect(applyAxisTextConfig(option, { axisFontFamily: '', axisFontSize: null })).toBe(option)
  })
  it('preserves formatter, domain, visibility and independent axes without mutation', () => {
    const formatter = v => '$' + v
    const first = Object.freeze({ min: -100, max: 100, axisLabel: Object.freeze({ formatter, show: false, color: '#aaa' }) })
    const second = Object.freeze({ axisLabel: Object.freeze({ rotate: 30 }) })
    const option = Object.freeze({ xAxis: Object.freeze([first, second]), yAxis: first, series: Object.freeze([{ data: [1, -2] }]) })
    const result = applyAxisTextConfig(option, { axisTickColor: '#d946ef', axisFontSize: 18, axisFontFamily: 'Sora' })
    expect(result.xAxis[0].axisLabel).toEqual({ formatter, show: false, color: '#d946ef', fontSize: 18, fontFamily: 'Sora' })
    expect(result.xAxis[1].axisLabel.rotate).toBe(30)
    expect(result.yAxis.min).toBe(-100)
    expect(result.yAxis.max).toBe(100)
    expect(result.series).toBe(option.series)
    expect(first.axisLabel.color).toBe('#aaa')
  })
  it('does not invent axes or alter non-cartesian configuration', () => {
    const option = { radar: { axisName: { color: '#aaa' } }, series: [{ type: 'pie' }] }
    expect(applyAxisTextConfig(option, { axisTickColor: '#d946ef' })).toBe(option)
    expect(applyAxisTextConfig(null, { axisFontSize: 18 })).toBeNull()
  })
})

it('applies independent overrides including zero and restores defaults when cleared', () => {
  const formatter = v => '$' + v
  const option = { xAxis: { axisLabel: { rotate: 20, formatter } }, yAxis: [{ min: -10, axisLabel: { margin: 8 } }], series: [{ data: [1, -2] }] }
  const result = applyAxisTextConfig(option, { axisFontSize: 14, xAxisLabelSize: 22, xAxisLabelRotation: 0, yAxisLabelSpacing: 0, yAxisLabelWeight: 700 })
  expect(result.xAxis.axisLabel).toEqual({ rotate: 0, formatter, fontSize: 22 })
  expect(result.yAxis[0].axisLabel).toEqual({ margin: 0, fontSize: 14, fontWeight: 700 })
  expect(result.yAxis[0].min).toBe(-10)
  expect(result.series).toBe(option.series)
  expect(option.xAxis.axisLabel.rotate).toBe(20)
  expect(applyAxisTextConfig(option, { xAxisLabelRotation: null, yAxisLabelSpacing: '' })).toBe(option)
})

it('supports bounded wrapping without changing category values or formatters', () => {
 const formatter = v => v.toUpperCase()
 const source = { xAxis: { data: ['Long category'], axisLabel: { formatter } }, yAxis: { axisLabel: { fontFamily: 'serif' } } }
 const result = applyAxisTextConfig(source, { xAxisLabelFamily:'Sora', xAxisLabelWidth:80, xAxisLabelOverflow:'break', xAxisLabelHideOverlap:false })
 expect(result.xAxis.axisLabel).toEqual({formatter,fontFamily:'Sora',width:80,overflow:'break',hideOverlap:false})
 expect(result.xAxis.data).toBe(source.xAxis.data)
 expect(result.yAxis).toBe(source.yAxis)
 expect(applyAxisTextConfig(source,{xAxisLabelWidth:null,xAxisLabelOverflow:''})).toBe(source)
})
