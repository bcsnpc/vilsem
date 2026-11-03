import { describe, expect, it } from 'vitest'
import { composeOption } from '../vilsem-renderer/src/compositions'

describe('Power BI axis formatting parity', () => {
  it('ignores stale independent-axis configuration after switching to slope', () => {
    const rows = [{ _cat: 'North', _val: 12, _val2: 4 }, { _cat: 'South', _val: 3, _val2: 8 }]
    const theme = { textMuted: '#999', gridStroke: '#333' }
    const actual = composeOption('slope', rows, { secondaryAxisEnabled: true }, theme)
    const original = composeOption('slope', rows, {}, theme)
    expect(actual.yAxis).toEqual(original.yAxis)
    expect(actual.series.map(s => ({data:s.data,yAxisIndex:s.yAxisIndex}))).toEqual(original.series.map(s => ({data:s.data,yAxisIndex:s.yAxisIndex})))
  })
  it.each(['line', 'area'])('%s exports the independent second-measure axis without changing values', type => {
    const rows = [{ _cat: 'North', _val: 12000, _val2: 4 }, { _cat: 'South', _val: 3000, _val2: 8 }]
    const theme = { textMuted: '#999', gridStroke: '#333' }
    const base = composeOption(type, rows, {}, theme)
    const styled = composeOption(type, rows, { secondaryAxisEnabled: true, secondaryAxisTitle: 'Returns', secondaryAxisLabelColor: '#e11d48', secondaryAxisLabelSize: 18, secondaryAxisLineColor: '#10b981', secondaryAxisPrefix: '$' }, theme)
    expect(styled.yAxis).toHaveLength(2)
    expect(styled.yAxis[0]).toEqual(base.yAxis)
    expect(styled.yAxis[1].name).toBe('Returns')
    expect(styled.yAxis[1].axisLabel.color).toBe('#e11d48')
    expect(styled.yAxis[1].axisLabel.fontSize).toBe(18)
    expect(styled.yAxis[1].axisLabel.formatter(12)).toBe('$12')
    expect(styled.yAxis[1].axisLine.lineStyle.color).toBe('#10b981')
    expect(styled.series[1].yAxisIndex).toBe(1)
    expect(styled.series.map(s => s.data)).toEqual(base.series.map(s => s.data))
  })
  it('does not silently substitute a bar for an unsupported visual', () => {
    expect(() => composeOption('waffle', [{_cat:'A',_val:10}], {}, {textMuted:'#999',gridStroke:'#333'})).toThrow(/not supported/i)
  })
  it.each(['bar', 'column', 'grouped_bar', 'stacked_bar', 'line', 'area', 'stacked_area', 'scatter', 'bubble', 'slope', 'lollipop'])('%s respects explicit typography and preserves data/domain', type => {
    const rows = [{ _cat: 'North', _val: 12, _val2: 4, _val3: 2 }, { _cat: 'South', _val: -3, _val2: 8, _val3: 5 }]
    const theme = { textMuted: '#999', gridStroke: '#333' }
    const base = composeOption(type, rows, {}, theme)
    const styled = composeOption(type, rows, { xAxisLabelColor: '#c026d3', yAxisLabelSize: 21, axisFontFamily: 'serif', xAxisLabelRotation: 0 }, theme)
    for (const key of ['xAxis', 'yAxis']) {
      const axes = Array.isArray(styled[key]) ? styled[key] : [styled[key]]
      const originals = Array.isArray(base[key]) ? base[key] : [base[key]]
      axes.forEach((axis, i) => {
        expect(axis.axisLabel.fontFamily).toBe('serif')
        expect(axis.axisLabel[key === 'xAxis' ? 'color' : 'fontSize']).toBe(key === 'xAxis' ? '#c026d3' : 21)
        expect(axis.min).toEqual(originals[i].min)
        expect(axis.max).toEqual(originals[i].max)
        expect(axis.data).toEqual(originals[i].data)
      })
    }
    expect(styled.series.map(s => ({ type: s.type, data: s.data, yAxisIndex: s.yAxisIndex }))).toEqual(base.series.map(s => ({ type: s.type, data: s.data, yAxisIndex: s.yAxisIndex })))
  })
})
