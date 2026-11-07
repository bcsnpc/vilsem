import * as renderingSurface from '../packages/core/src/shared/renderingSurface.js'
import { expect, it, vi } from 'vitest'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { applyAxisTextConfig } from '../ui/src/appspec/shared/axisTextConfig.js'
import { applyTooltipConfig } from '../ui/src/appspec/shared/applyTooltipConfig.js'

it('retains race axis and tooltip settings when scrubbing frames', () => {
  const nodes: any[] = []
  const node = (tag = 'div') => {
    const n = { tag, style: {}, appendChild() {}, insertBefore() {} }
    nodes.push(n)
    return n
  }
  const chart = { setOption: vi.fn() }
  const exports: any = {}
  const source = fs.readFileSync('vilsem-renderer/src/visual.ts', 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText
  vm.runInNewContext(js, { exports, console, clearInterval, document: { createElement: node }, require: (name: string) => {
    if (name === '@vilsem/core/rendering') return renderingSurface
    if (name === 'echarts/core') return { use() {}, init: () => chart }
    if (name.endsWith('/axisTextConfig.js')) return { applyAxisTextConfig }
    if (name.endsWith('/applyTooltipConfig.js')) return { applyTooltipConfig }
    return {}
  } })
  const visual = Object.create(exports.Visual.prototype)
  const dv = { categorical: { categories: [{ values: ['2024', '2025'] }, { values: ['North', 'South'] }], values: [{ values: [10, 20] }] } }
  visual.renderBarRace(node(), node(), dv, { yAxisLabelColor: '#ff00ff', yAxisLabelSize: 19, tooltipEnabled: false }, { textMuted: '#999' }, true, '#123456')
  const scrub = nodes.find(n => n.tag === 'input')
  scrub.value = '1'
  scrub.oninput()
  expect(chart.setOption).toHaveBeenCalledTimes(2)
  for (const [option] of chart.setOption.mock.calls) {
    expect(option.yAxis.axisLabel.color).toBe('#ff00ff')
    expect(option.yAxis.axisLabel.fontSize).toBe(19)
    expect(option.tooltip.show).toBe(false)
  }
  expect(chart.setOption.mock.calls[1][0].yAxis.data).toEqual(['South'])
  expect(chart.setOption.mock.calls[1][0].series[0].data[0].value).toBe(20)
})
