import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { composeOption } from '../pbiviz-semantica-renderer/src/compositions'
import { escapeHtml } from '../ui/src/primitives/escapeHtml'
import { applyTooltipConfig } from '../ui/src/appspec/shared/applyTooltipConfig.js'

function harness(type = 'bar', categories = ['Clothing', 'Bikes', 'Accessories'], configOverrides = {}) {
  const events: Record<string, Function> = {}, zrEvents: Record<string, Function> = {}
  const chart = { on: (n: string, f: Function) => { events[n] = f }, setOption: vi.fn(), getZr: () => ({ on: (n: string, f: Function) => { zrEvents[n] = f } }), dispose() {} }
  const node = () => ({ style: {}, clientWidth: 600, clientHeight: 400, appendChild() {}, addEventListener() {}, querySelectorAll: () => [] })
  const source = fs.readFileSync('pbiviz-semantica-renderer/src/visual.ts', 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText
  const exports: any = {}
  vm.runInNewContext(js, { exports, document: { createElement: node }, console, clearInterval, cancelAnimationFrame() {}, require: (name: string) => {
    if (name === 'echarts/core') return { use() {}, init: () => chart }
    if (name === './compositions') return { composeOption }
    if (name === './primitives/escapeHtml') return { escapeHtml }
    if (name.endsWith('/chrome.js')) return { getCardChromeStyle: () => ({}) }
    if (name.endsWith('/applyTooltipConfig.js')) return { applyTooltipConfig }
    if (name.endsWith('/getThemeTokens')) return { default: () => ({}) }
    return {}
  } })
  const ids = categories.map(name => ({ name, equals: (other: any) => other.name === name }))
  const selection = { select: vi.fn(async (id: any) => [id]), getSelectionIds: () => [], clear: vi.fn(async () => []) }
  const host = { createSelectionManager: () => selection, createSelectionIdBuilder: () => ({ withCategory: (_: any, i: number) => ({ createSelectionId: () => ids[i] }) }) }
  const visual = new exports.Visual({ element: node(), host })
  const dv = { categorical: { categories: [{ values: categories }], values: [{ source: { roles: { content: true } }, values: [12436, 13929, 57809] }, { source: { roles: { secondary: true } }, values: [269, 429, 1130] }] } }
  visual.renderPrimitiveChart(dv, { type, canvasTheme: 'dark', config: { cardStyle: 'plain', animationEnabled: false, ...configOverrides } })
  return { visual, chart, events, zrEvents, selection, ids }
}

describe('Power BI production primitive selection routing', () => {
  it('honors tooltip visibility and trigger configuration',()=>{
    const hidden=harness('bar',undefined,{tooltipEnabled:false})
    expect(hidden.visual.lastOption.tooltip.show).toBe(false)
    const axis=harness('bar',undefined,{tooltipTrigger:'axis'})
    expect(axis.visual.lastOption.tooltip.trigger).toBe('axis')
  })
  it('the Power BI radar override preserves category text literally',()=>{
    const category='<b data-qa="category">A & B</b>'
    const h=harness('radar',[category,'Bikes','Accessories'])
    const html=h.visual.lastOption.tooltip.formatter({value:[57809,13929,12436]})
    expect(html).not.toContain(category)
    expect(html).toContain('A &amp; B')
    expect(html).toContain('&lt;b')
  })
  it.each(['bar', 'column', 'grouped_bar', 'stacked_bar', 'pie', 'donut', 'scatter', 'bubble', 'lollipop'])('%s selects the visible category after renderer sorting', async type => {
    const h = harness(type)
    await h.events.click({ dataIndex: 0, name: 'Accessories', event: { event: {} } })
    expect(h.selection.select.mock.calls[0][0].name).toBe('Accessories')
  })
  it('treemap uses the tile identity rather than its virtual-root index', async () => {
    const h = harness('treemap')
    await h.events.click({ dataIndex: 1, name: 'Accessories', event: { event: {} } })
    expect(h.selection.select.mock.calls[0][0].name).toBe('Accessories')
  })
  it('slope resolves a category from the series, not the endpoint index', async () => {
    const h = harness('slope')
    await h.events.click({ dataIndex: 0, seriesIndex: 0, seriesName: 'Accessories', name: 'Start', event: { event: { ctrlKey: true } } })
    expect(h.selection.select.mock.calls[0][0].name).toBe('Accessories')
    expect(h.selection.select.mock.calls[0][1]).toBe(true)
  })
  it('selection preserves callback formatting and original option', () => {
    const h = harness('bubble'), size = () => 42, label = () => 'Formatted', tooltip = () => 'Tooltip'
    h.visual.lastOption = { tooltip: { formatter: tooltip }, series: [{ type: 'scatter', symbolSize: size, label: { formatter: label }, data: [{ name: 'Accessories', value: [5, 6] }] }] }
    h.visual.applyChartSelection(h.ids, [h.ids[2]])
    const option = h.chart.setOption.mock.calls.findLast(c => c[0].series)?.[0]
    expect(option.series[0].symbolSize).toBe(size)
    expect(option.series[0].label.formatter).toBe(label)
    expect(option.series[0].data[0].itemStyle.opacity).toBe(1)
    expect(h.visual.lastOption.series[0].data[0].itemStyle).toBeUndefined()
  })
  it('radar selects the category on the hovered counterclockwise spoke', async () => {
    const h=harness('radar')
    h.zrEvents.mousemove({offsetX:250,offsetY:230})
    await h.events.click({dataIndex:0,name:'Value',event:{event:{}}})
    expect(h.selection.select.mock.calls[0][0].name).toBe('Bikes')
  })
  it('lollipop selection retains coordinate arrays as ECharts values', () => {
    const h=harness('lollipop')
    h.visual.applyChartSelection(h.ids,[h.ids[2]])
    const option=h.chart.setOption.mock.calls.findLast(c=>c[0].series)?.[0]
    expect(option.series[1].data[0].value).toEqual([57809,'Accessories'])
    expect(option.series[1].data[0].itemStyle.opacity).toBe(1)
  })
})
