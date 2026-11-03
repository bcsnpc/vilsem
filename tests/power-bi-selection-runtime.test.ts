import { prepareVisualRows } from '@vilsem/core/dax/rows'
import { resolveVisualSpec } from '@vilsem/core/spec/resolve'
import { lollipop as templateExample } from '@vilsem/core/templates/examples'
import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { composeOption } from '../vilsem-renderer/src/compositions'
import { escapeHtml } from '@vilsem/core/primitives/escapeHtml'
import { applyAxisTextConfig } from '../ui/src/appspec/shared/axisTextConfig.js'
import { aggregateDrillLevel } from '../ui/src/appspec/shared/drill.js'
import { applyTooltipConfig } from '../ui/src/appspec/shared/applyTooltipConfig.js'
import { chartTitleStyle } from '../ui/src/appspec/shared/chartTitle.js'
import { secondaryAxisMinimumWidth, scrollableChartTooltip } from '../ui/src/appspec/shared/secondaryAxis.js'

// Compile immutable source once; each test still gets a fresh VM, host and visual.
const source = fs.readFileSync('vilsem-renderer/src/visual.ts', 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText

function harness(type = 'bar', categories = ['Clothing', 'Bikes', 'Accessories'], configOverrides = {}) {
  const events: Record<string, Function> = {}, zrEvents: Record<string, Function> = {}
  const chart = { on: (n: string, f: Function) => { events[n] = f }, setOption: vi.fn(), getZr: () => ({ on: (n: string, f: Function) => { zrEvents[n] = f } }), dispose() {} }
  const rootEvents: Record<string, Function> = {}
  const node = () => ({ style: {}, clientWidth: 600, clientHeight: 400, appendChild() {}, addEventListener: (name, fn) => { rootEvents[name] = fn }, querySelectorAll: () => [], setAttribute() {} })
  const exports: any = {}
  vm.runInNewContext(js, { exports, document: { createElement: node }, console, clearInterval, cancelAnimationFrame() {}, require: (name: string) => {
    if (name === '@vilsem/core/dax/rows') return { prepareVisualRows }
    if (name === '@vilsem/core/spec/resolve') return { resolveVisualSpec }
    if (name === 'echarts/core') return { use() {}, init: () => chart }
    if (name === './compositions') return { composeOption }
    if (name === './primitives/escapeHtml') return { escapeHtml }
    if (name.endsWith('/chrome.js')) return { getCardChromeStyle: () => ({}) }
    if (name.endsWith('/chartTitle.js')) return { chartTitleStyle }
    if (name.endsWith('/secondaryAxis.js')) return { secondaryAxisMinimumWidth, scrollableChartTooltip }
    if (name.endsWith('/axisTextConfig.js')) return { applyAxisTextConfig }
    if (name.endsWith('/applyTooltipConfig.js')) return { applyTooltipConfig }
    if (name.endsWith('/getThemeTokens')) return { default: () => ({}) }
    return {}
  } })
  const ids = categories.map(name => ({ name, equals: (other: any) => other.name === name }))
  let restoreSelection: Function | undefined
  const selection = { registerOnSelectCallback: vi.fn(fn => { restoreSelection = fn }), showContextMenu: vi.fn(), select: vi.fn(async (id: any) => [id]), getSelectionIds: () => [], clear: vi.fn(async () => []) }
  const tooltip = { enabled: () => true, show: vi.fn(), hide: vi.fn(), move: vi.fn() }
  const host = { tooltipService: tooltip, createSelectionManager: () => selection, createSelectionIdBuilder: () => ({ withCategory: (_: any, i: number) => ({ createSelectionId: () => ids[i] }) }) }
  const visual = new exports.Visual({ element: node(), host })
  const dv = { categorical: { categories: [{ values: categories }], values: [{ source: { roles: { content: true } }, values: [12436, 13929, 57809] }, { source: { roles: { secondary: true } }, values: [269, 429, 1130] }] } }
  visual.renderPrimitiveChart(dv, { type, canvasTheme: 'dark', config: { cardStyle: 'plain', animationEnabled: false, ...configOverrides } })
  return { visual, chart, events, zrEvents, selection, ids, host, tooltip, rootEvents, restoreSelection: ids => restoreSelection?.(ids) }
}

describe('Power BI production primitive selection routing', () => {
  it.each(['line','area','grouped_bar','stacked_bar'])('%s uses bound measure names and refreshes them after rebinding', type => {
    const h=harness(type)
    const dv={categorical:{categories:[{values:['North','South']}],values:[{source:{displayName:'Quantity Sold'},values:[12,20]},{source:{displayName:'Quantity Returned'},values:[1,3]}]}}
    const spec={type,config:{cardStyle:'plain',animationEnabled:false}}
    h.visual.renderPrimitiveChart(dv,spec)
    const names=()=>h.chart.setOption.mock.calls.at(-1)[0].series.slice(0,2).map(s=>s.name)
    expect(names()).toEqual(['Quantity Sold','Quantity Returned'])
    dv.categorical.values[1].source.displayName='Refunds'
    h.visual.renderPrimitiveChart(dv,spec)
    expect(names()).toEqual(['Quantity Sold','Refunds'])
    h.visual.renderPrimitiveChart(dv,{...spec,config:{...spec.config,measureName:'Sales label',secondaryMeasureName:'Return label'}})
    expect(names()).toEqual(['Sales label','Return label'])
    expect(spec.config).not.toHaveProperty('measureName')
  })
  it.each(['html', 'bar'])('keeps one background clear handler after repeated %s renders and removes it on disposal', async mode => {
    const h = harness()
    const target = new EventTarget()
    const root: any = { innerHTML: '', style: {}, querySelectorAll: () => [], addEventListener: target.addEventListener.bind(target), removeEventListener: target.removeEventListener.bind(target) }
    Object.defineProperty(root, 'onclick', { set(fn) { if (this.handler) target.removeEventListener('click', this.handler); this.handler = fn; if (fn) target.addEventListener('click', fn) } })
    h.visual.root = root
    h.visual.animateCountUp = () => {}
    h.visual.wireAxisPills = () => {}
    h.visual.ensureTooltipEl = () => ({ style: {} })
    const cat = { categories: [{ values: ['A'] }], values: [{ values: [10] }] }
    for (let i = 0; i < 3; i++) {
      if (mode === 'html') h.visual.renderHtmlWithSelection({}, cat, '<div>A</div>')
      else h.visual.renderBarChart({}, cat)
    }
    target.dispatchEvent(new Event('click'))
    await Promise.resolve()
    expect(h.selection.clear).toHaveBeenCalledTimes(1)
    h.visual.disposeChart()
    target.dispatchEvent(new Event('click'))
    expect(h.selection.clear).toHaveBeenCalledTimes(1)
  })

  it.each(['ctrlKey', 'metaKey'])('alternate-axis local selection adds/removes marks with %s', async modifier => {
    const h = harness()
    const bars: any[] = []
    const section = { getAttribute: () => '1', querySelectorAll: () => bars }
    for (const name of ['A', 'B', 'C']) {
      const attrs: any = { 'data-sbar-cat': name }
      const handlers: any = {}
      bars.push({ style: {}, handlers, getAttribute: key => attrs[key] ?? null, setAttribute: (key, value) => { attrs[key] = value }, closest: () => section, addEventListener: (key, fn) => { handlers[key] = fn } })
    }
    h.visual.root = { innerHTML: '', querySelectorAll: () => bars, addEventListener() {} }
    h.visual.animateCountUp = () => {}
    h.visual.wireAxisPills = () => {}
    h.visual.ensureTooltipEl = () => ({ style: {} })
    h.visual.renderHtmlWithSelection({}, { categories: [{ values: ['A', 'B', 'C'] }] }, '<div/>')
    const click = (i, multi = false) => bars[i].handlers.click({ stopPropagation() {}, [modifier]: multi })
    const selected = () => bars.filter(b => b.getAttribute('data-sbar-local-selected') === '1').map(b => b.getAttribute('data-sbar-cat'))
    click(0); click(1, true)
    expect(selected()).toEqual(['A', 'B'])
    expect(bars.map(b => b.style.opacity)).toEqual(['1', '1', '0.35'])
    click(0, true)
    expect(selected()).toEqual(['B'])
    click(1, true)
    expect(selected()).toEqual([])
    expect(bars.map(b => b.style.opacity)).toEqual(['', '', ''])
    click(0); click(1, true); click(2)
    expect(selected()).toEqual(['C'])
    click(2)
    expect(selected()).toEqual([])
    expect(h.selection.select).not.toHaveBeenCalled()
  })

  it('routes an alternate-axis click through its bound field even when primary labels match', async () => {
    const h = harness()
    const primary = { source: { queryName: 'Region.Name' }, values: ['Shared'] }
    const alternate = { source: { queryName: 'Product.Name' }, values: ['Other', 'Shared'] }
    const builder = { withCategory: (column, index) => ({ createSelectionId: () => ({ column, index, equals: other => other.column === column && other.index === index }) }) }
    h.visual.host.createSelectionIdBuilder = () => builder
    const section = { getAttribute: key => ({ 'data-axis-section': '1', 'data-axis-table': 'Product', 'data-axis-column': 'Name' })[key] }
    const handlers: any = {}
    const mark = { style: {}, getAttribute: () => 'Shared', closest: () => section, addEventListener: (key, fn) => { handlers[key] = fn } }
    h.visual.root = { innerHTML: '', querySelectorAll: () => [mark] }
    h.visual.animateCountUp = () => {}
    h.visual.wireAxisPills = () => {}
    h.visual.ensureTooltipEl = () => ({ style: {} })
    h.visual.renderHtmlWithSelection({}, { categories: [primary, alternate] }, '<div/>')
    handlers.click({ stopPropagation() {}, ctrlKey: true })
    await Promise.resolve()
    const [id, multi] = h.selection.select.mock.calls[0]
    expect(id.column).toBe(alternate)
    expect(id.index).toBe(1)
    expect(multi).toBe(true)
    expect(mark.style.opacity).toBe('1')
  })
  it('does not fabricate alternate identities from unbound, missing, or ambiguous fields', () => {
    const h = harness()
    const section = { getAttribute: key => key === 'data-axis-table' ? 'Product' : 'Name' }
    const primary = { source: { queryName: 'Region.Name' }, values: ['Shared'] }
    const alternate = { source: { queryName: 'Product.Name' }, values: ['Shared'] }
    expect(h.visual.boundHtmlAxisSelection({ categories: [primary] }, section, 'Shared')).toBeNull()
    expect(h.visual.boundHtmlAxisSelection({ categories: [alternate] }, section, 'Missing')).toBeNull()
    expect(h.visual.boundHtmlAxisSelection({ categories: [alternate, alternate] }, section, 'Shared')).toBeNull()
  })

  it.each(['shape', 'divider'])('renders baked %s without data bindings', type => {
    const h = harness()
    h.visual.bakedSpecRaw = () => JSON.stringify({ type, config: {} })
    h.visual.renderPrimitiveChart = vi.fn()
    h.visual.update({ dataViews: [] })
    expect(h.visual.renderPrimitiveChart).toHaveBeenCalledWith({}, { type, config: {} })
  })
  it('does not invent data for a chart without bindings', () => {
    const h = harness()
    h.visual.bakedSpecRaw = () => JSON.stringify({ type: 'bar', config: {} })
    h.visual.renderPrimitiveChart = vi.fn()
    h.visual.renderEmpty = vi.fn()
    h.visual.update({ dataViews: [] })
    expect(h.visual.renderPrimitiveChart).not.toHaveBeenCalled()
    expect(h.visual.renderEmpty).toHaveBeenCalled()
  })

  it('reports an incomplete imported drill hierarchy before drawing partial data', () => {
    const h = harness()
    h.visual.renderError = vi.fn()
    h.visual.renderReplaceDrill = vi.fn()
    const dv = { categorical: { categories: [{ values: ['West'] }, { values: ['Bikes'] }], values: [{ source: { roles: { content: true } }, values: [25] }] } }
    const drill = [{ table: 'Region', column: 'Name' }, { table: 'Product', column: 'Name' }, { table: 'Product', column: 'SKU' }]
    h.visual.renderPrimitiveChart(dv, { type: 'bar', drill, config: { drillStyle: 'replace' } })
    expect(h.visual.renderError).toHaveBeenCalledWith(expect.stringMatching(/3.*category/i), 'bar', true)
  })

  it('uses literal fallback text and cloned existing nodes for legacy hover tooltips', () => {
    const h = harness()
    const handlers: Record<string, Function> = {}
    let inline: any = null
    const category = '<b>literal category</b>'
    const element = { style: {}, getAttribute: () => category, closest: () => null, addEventListener: (name: string, fn: Function) => { handlers[name] = fn }, querySelector: () => inline }
    const tooltip: any = { style: {}, replaceChildren: vi.fn() }
    Object.defineProperty(tooltip, 'innerHTML', { set() { throw Error('Tooltip must not parse HTML') } })
    h.visual.root = { innerHTML: '', querySelectorAll: () => [element], addEventListener() {} }
    h.visual.animateCountUp = () => {}
    h.visual.wireAxisPills = () => {}
    h.visual.ensureTooltipEl = () => tooltip
    h.visual.positionTooltip = () => {}
    h.visual.renderHtmlWithSelection({}, { categories: [{ values: [category] }] }, '<div></div>')
    handlers.mouseenter({})
    expect(tooltip.textContent).toBe(category)
    const clone = { textContent: 'Existing formatted tooltip' }
    const child = { cloneNode: vi.fn(() => clone) }
    inline = { style: {}, hasChildNodes: () => true, childNodes: [child] }
    handlers.mouseenter({})
    expect(child.cloneNode).toHaveBeenCalledWith(true)
    expect(tooltip.replaceChildren).toHaveBeenCalledWith(clone)
  })

  it('applies formatting to the shared drill redraw boundary', () => {
    const h = harness()
    const option = { yAxis: { axisLabel: { color: '#999' } }, tooltip: { trigger: 'item' }, series: [{ data: [25] }] }
    const styled = h.visual.styleChartOption(option, {}, { yAxisLabelColor: '#ff00ff', tooltipEnabled: false })
    expect(styled.yAxis.axisLabel.color).toBe('#ff00ff')
    expect(styled.tooltip.show).toBe(false)
    expect(styled.series).toBe(option.series)
  })

  it('preserves all drill levels including equal column names in different tables', () => {
    const h = harness()
    const levels = [{ table: 'Region', column: 'Name' }, { table: 'Product', column: 'Name' }, { table: 'Product', column: 'SKU' }]
    const dv = { categorical: { categories: [{ values: ['West'] }, { values: ['Bikes'] }, { values: ['Road-1'] }], values: [{ values: [25] }] } }
    const { rows, colOf } = h.visual.buildFinestDrillRows(dv, levels)
    expect(levels.map(l => colOf(rows[0], l))).toEqual(['West', 'Bikes', 'Road-1'])
    expect(rows[0]._val).toBe(25)
    expect(aggregateDrillLevel(rows, levels, ['West', 'Bikes'], ['_val'], colOf)).toEqual([{ _cat: 'Road-1', _val: 25 }])
  })

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


describe('native Power BI interaction contracts', () => {
  it('includes all category levels in selection identity', () => {
    const h = harness()
    const levels = Array.from({ length: 6 }, (_, i) => ({ source: { roles: { [i ? `category${i+1}` : 'category']: true } }, values: ['A', 'B'] }))
    const columns: any[] = []
    h.host.createSelectionIdBuilder = () => {
      const builder = { withCategory: (column, index) => { columns.push([column,index]); return builder }, createSelectionId: () => h.ids[0] }
      return builder
    }
    h.visual.renderPrimitiveChart({ categorical: { categories: levels, values: [{ values: [10,20] }] } }, { type:'bar', config:{ cardStyle:'plain' } })
    expect(columns).toHaveLength(12)
    expect(columns.slice(0,6).map(([column])=>column)).toEqual(levels)
  })
  it('dims non-highlighted points, including all-null highlights, and restores on removal', () => {
    const h = harness()
    const dv = { categorical: { categories:[{values:['A','B','C']}], values:[{ values:[10,20,30], highlights:[0,null,5] }] } }
    const spec = { type:'bar', config:{cardStyle:'plain'} }
    const opacity = () => h.chart.setOption.mock.calls.at(-1)[0].series[0].data.map(point=>point.itemStyle?.opacity ?? 1)
    h.visual.renderPrimitiveChart(dv,spec)
    expect(opacity()).toEqual([1,0.25,1])
    dv.categorical.values[0].highlights=[null,null,null]
    h.visual.renderPrimitiveChart(dv,spec)
    expect(opacity()).toEqual([0.25,0.25,0.25])
    delete dv.categorical.values[0].highlights
    h.visual.renderPrimitiveChart(dv,spec)
    expect(opacity()).toEqual([1,1,1])
  })
  it('passes native tooltip and context-menu identities to the host', () => {
    const h=harness()
    const event={clientX:40,clientY:60,preventDefault:vi.fn()}
    h.events.mouseover({name:'Bikes',dataIndex:1,event:{event}})
    expect(h.tooltip.show).toHaveBeenCalledWith(expect.objectContaining({coordinates:[40,60],identities:[h.ids[1]],dataItems:expect.any(Array)}))
    h.events.contextmenu({name:'Bikes',dataIndex:1,event:{event}})
    expect(h.selection.showContextMenu).toHaveBeenCalledWith(h.ids[1],{x:40,y:60})
    expect(event.preventDefault).toHaveBeenCalled()
    h.events.mouseout()
    expect(h.tooltip.hide).toHaveBeenLastCalledWith({isTouchEvent:false,immediately:true})
  })
  it('restores bookmark selection and resets it through the host callback', () => {
    const h=harness()
    h.restoreSelection([h.ids[1]])
    expect(h.chart.setOption.mock.calls.at(-1)[0].series[0].data[0].itemStyle.opacity).toBe(0.25)
    h.restoreSelection([])
    expect(h.chart.setOption.mock.calls.at(-1)[0]).toBe(h.visual.lastOption)
  })
  it('replaces filtered values and explicitly displays an empty filtered result', () => {
    const h=harness()
    const spec={type:'bar',config:{cardStyle:'plain'}}
    h.visual.renderPrimitiveChart({categorical:{categories:[{values:['Bikes']}],values:[{values:[7]}]}},spec)
    expect(h.visual.primitiveCategoryNames).toEqual(['Bikes'])
    h.visual.renderPrimitiveChart({categorical:{categories:[{values:[]}],values:[{values:[]}]}},spec)
    expect(h.visual.root.innerHTML).toContain('No data matches the current filters')
    expect(h.visual.currentSelectionIds).toEqual([])
  })
})


describe('renderer template and keyboard contracts', () => {
  it('renders the same declarative template option as core preview', () => {
    const h = harness()
    h.visual.renderPrimitiveChart({categorical:{categories:[{values:['Bikes']}],values:[{values:[12]}]}},{type:'custom',template:templateExample,config:{cardStyle:'plain'}})
    expect(h.visual.lastOption.series).toBeTruthy()
    expect(h.visual.lastOption.series.length).toBe(resolveVisualSpec({template:templateExample},[{_cat:'Bikes',_val:12}]).series.length)
  })
  it('supports keyboard selection, modifiers and clearing', async () => {
    const h=harness()
    const event=(key,ctrlKey=false)=>({key,ctrlKey,metaKey:false,preventDefault:vi.fn()})
    h.rootEvents.keydown(event('ArrowRight'))
    h.rootEvents.keydown(event('Enter',true))
    await Promise.resolve()
    expect(h.selection.select).toHaveBeenLastCalledWith(h.ids[1],true)
    h.rootEvents.keydown(event('Escape'))
    await Promise.resolve()
    expect(h.selection.clear).toHaveBeenCalledOnce()
  })
})
