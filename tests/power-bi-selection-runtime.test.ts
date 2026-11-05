import { prepareVisualRows, rowsFromCategorical, normaliseRows } from '@vilsem/core/dax/rows'
import { resolveVisualSpec } from '@vilsem/core/spec/resolve'
import {migrate,CURRENT_SPEC_VERSION} from '@vilsem/core/spec/migrate'
import {applyPaneFormatting,effectivePaneObjects,paneFormattingCards,paneTitleConfig} from '@vilsem/core/formatting/pane'
import { resolveReportTheme, reportThemeFromHost, applyReportTheme } from '@vilsem/core/theme/report'
import { createModelFormatter, scopedMeasureFormat, applyModelFormats } from '@vilsem/core/formatting'
import { nativeTemplateTooltipItems,mapTimelineSeries,collectTimelineSeries,preserveTimelineIndex,createMotionVisibilityController } from '@vilsem/core/templates'
import { lollipop as templateExample } from '@vilsem/core/templates/examples'
import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { createCategoricalDataViewBuilder } from 'powerbi-visuals-utils-testutils/lib/dataViewBuilder/dataViewBuilder.js'
import {createRequire} from 'node:module'
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
  const frames=new Map<number,Function>();let nextFrame=0
  const events: Record<string, Function> = {}, zrEvents: Record<string, Function> = {}
  const chart = { getOption:()=>({timeline:[{currentIndex:1}]}), on: (n: string, f: Function) => { events[n] = f }, setOption: vi.fn(), dispatchAction:vi.fn(), getZr: () => ({ on: (n: string, f: Function) => { zrEvents[n] = f } }), dispose() {} }
  const rootEvents: Record<string, Function> = {}
  const node = () => ({ style: {}, clientWidth: 600, clientHeight: 400, appendChild() {}, addEventListener: (name, fn) => { rootEvents[name] = fn }, querySelectorAll: () => [], setAttribute() {} })
  const exports: any = {}
  vm.runInNewContext(js, { exports, document: { createElement: node }, console, clearInterval, clearTimeout, setTimeout, requestAnimationFrame(fn){frames.set(++nextFrame,fn);return nextFrame}, cancelAnimationFrame(id){frames.delete(id)}, require: (name: string) => {
    if (name === '@vilsem/core/dax/rows') return { prepareVisualRows, rowsFromCategorical }
    if (name === '@vilsem/core/spec/resolve') return { resolveVisualSpec }
    if (name === '@vilsem/core/spec/migrate') return {migrate}
    if (name === '@vilsem/core/formatting/pane') return {applyPaneFormatting,effectivePaneObjects,paneFormattingCards,paneTitleConfig}
    if (name === '@vilsem/core/theme/report') return { resolveReportTheme, reportThemeFromHost, applyReportTheme }
    if (name === '@vilsem/core/formatting') return { createModelFormatter, scopedMeasureFormat, applyModelFormats }
    if (name === '@vilsem/core/templates') return { nativeTemplateTooltipItems,mapTimelineSeries,collectTimelineSeries,preserveTimelineIndex,createMotionVisibilityController }
    if (name === 'echarts/core') return { use() {}, init: () => chart, format: {getTextRect:(text,font)=>({width:String(text).length*Number(/(\d+)px/.exec(font)?.[1] || 10)})} }
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
  const selection = { registerOnSelectCallback: vi.fn(fn => { restoreSelection = fn }), showContextMenu: vi.fn(), select: vi.fn(async (id: any) => Array.isArray(id) ? id : [id]), getSelectionIds: () => [], clear: vi.fn(async () => []) }
  const tooltip = { enabled: () => true, show: vi.fn(), hide: vi.fn(), move: vi.fn() }
  const host = { tooltipService: tooltip, createSelectionManager: () => selection, createSelectionIdBuilder: () => { let index=0;const builder={withCategory: (_: any,i:number)=>{index=i;return builder},createSelectionId:()=>ids[index]};return builder } }
  const visual = new exports.Visual({ element: node(), host })
  // SDK-built categorical views include metadata, opaque row identities and
  // grouped value columns, matching the host shape rather than a loose mock.
  const dv = createCategoricalDataViewBuilder()
    .withCategory({ source: { displayName: 'Category', queryName: 'Products.Category', roles: { category: true }, type: { text: true } }, values: categories, identityFrom: { fields: [], identities: ids } })
    .withValues({ columns: [
      { source: { displayName: 'Revenue', queryName: 'Measures.Revenue', roles: { content: true }, isMeasure: true, type: { numeric: true } }, values: categories.map((_, i) => [12436, 13929, 57809][i] ?? i + 1) },
      { source: { displayName: 'Returns', queryName: 'Measures.Returns', roles: { secondary: true }, isMeasure: true, type: { numeric: true } }, values: categories.map((_, i) => [269, 429, 1130][i] ?? i + 1) },
    ] }).build()!
  visual.renderPrimitiveChart(dv, { type, canvasTheme: 'dark', config: { cardStyle: 'plain', animationEnabled: false, ...configOverrides } })
  return { visual, chart, events, zrEvents, selection, ids, host, tooltip, rootEvents, dataView: dv, restoreSelection: ids => restoreSelection?.(ids),flushFrames(){for(const [id,fn]of [...frames]){frames.delete(id);fn()}} }
}

describe('Power BI render lifecycle',()=>{
 it('retains template drawing state for changed data and rewires handlers; a rebound field disposes it',()=>{
  const h=harness(),dom={style:{},clientWidth:600,clientHeight:400};Object.assign(h.chart,{getDom:()=>dom,off:vi.fn(()=>{for(const key of Object.keys(h.events))delete h.events[key]}),resize:vi.fn(),dispose:vi.fn()});const zrOff=vi.fn();const originalZr=h.chart.getZr;h.chart.getZr=()=>({...originalZr(),off:zrOff})
  const spec={type:'custom',template:{meta:{id:'retained-test',formatVersion:4},slots:{category:{kind:'dimension'},amount:{kind:'measure'}},animation:{update:{duration:400}},template:{xAxis:{type:'category',data:'$slot.category.categories'},yAxis:{type:'value'},series:[{type:'bar',data:'$slot.amount.values'}]}}}
  h.visual.renderPrimitiveChart(h.dataView,spec);h.chart.dispose.mockClear();h.chart.setOption.mockClear();const changed={...h.dataView,categorical:{...h.dataView.categorical,values:h.dataView.categorical!.values!.map(c=>({...c,values:c.values.map(v=>Number(v)+1)}))}}
  h.visual.renderPrimitiveChart(changed,spec);expect(h.chart.dispose).not.toHaveBeenCalled();expect(h.chart.resize).toHaveBeenCalledOnce();expect(h.chart.setOption).toHaveBeenCalledTimes(1);expect(h.chart.setOption.mock.calls[0][1]).toMatchObject({notMerge:false});expect(h.events.click).toBeTypeOf('function');expect(zrOff).toHaveBeenCalledWith('click',expect.any(Function))
  const rebound={...changed,categorical:{...changed.categorical,categories:changed.categorical.categories!.map(c=>({...c,source:{...c.source,queryName:'Other.Field'}}))}};h.visual.renderPrimitiveChart(rebound,spec);expect(h.chart.dispose).toHaveBeenCalledOnce()
 })
 it('dims timeline frames by source identity and preserves the active frame on selection reset',()=>{
  const h=harness();h.visual.templateRowSources=[0,1,2];h.visual.lastOption={baseOption:{timeline:{currentIndex:0},series:[]},options:[{series:[{type:'bar',data:[{value:1,rowIndexes:[0]}]}]},{series:[{type:'bar',data:[{value:2,rowIndexes:[1]}]}]}]}
  h.visual.applyChartSelection(h.ids,[h.ids[1]]);const selected=h.chart.setOption.mock.calls.at(-1)![0]
  expect(selected.options[0].series[0].data[0].itemStyle.opacity).toBe(.25);expect(selected.options[1].series[0].data[0].itemStyle.opacity).toBe(1);expect(selected.baseOption.timeline.currentIndex).toBe(1)
  h.visual.applyChartSelection(h.ids,[]);const reset=h.chart.setOption.mock.calls.at(-1)![0];expect(reset.options[0].series[0].data[0].itemStyle).toBeUndefined();expect(reset.baseOption.timeline.currentIndex).toBe(1)
 })
 function setup(){const h=harness();(h.host as any).eventService={renderingStarted:vi.fn(),renderingFinished:vi.fn(),renderingFailed:vi.fn()};return {...h,lifecycle:(h.host as any).eventService}}
 const options=(h:any)=>({dataViews:[h.dataView],viewport:{width:600,height:400}})
 it('finishes exactly once after the first completed frame',()=>{
  const h=setup(),update=options(h);h.visual.update(update)
  expect(h.lifecycle.renderingStarted).toHaveBeenCalledWith(update);expect(h.lifecycle.renderingFinished).not.toHaveBeenCalled()
  h.flushFrames();h.flushFrames();expect(h.lifecycle.renderingFinished).toHaveBeenCalledExactlyOnceWith(update);expect(h.lifecycle.renderingFailed).not.toHaveBeenCalled()
 })
 it('fails a superseded frame and completes the current update without stale callbacks',()=>{
  const h=setup(),first=options(h),second=options(h);h.visual.update(first);h.visual.update(second);h.flushFrames()
  expect(h.lifecycle.renderingFailed).toHaveBeenCalledExactlyOnceWith(first,expect.stringContaining('Superseded'))
  expect(h.lifecycle.renderingFinished).toHaveBeenCalledExactlyOnceWith(second)
 })
 it('reports invalid specs as failed, while filtered empty states finish successfully',()=>{
  const h=setup();h.dataView.metadata.objects={semantica:{primitiveSpec:'broken-json'}};h.visual.update(options(h));h.flushFrames()
  expect(h.lifecycle.renderingFailed).toHaveBeenCalledOnce();expect(h.lifecycle.renderingFinished).not.toHaveBeenCalled()
  h.dataView.metadata.objects={semantica:{primitiveSpec:JSON.stringify({type:'bar'})}};h.dataView.categorical!.categories![0].values=[];h.dataView.categorical!.values!.forEach(c=>{c.values=[]});h.visual.update(options(h));h.flushFrames()
  expect(h.lifecycle.renderingFinished).toHaveBeenCalledOnce()
 })
 it('settles a pending update when destroyed',()=>{
  const h=setup();h.visual.update(options(h));h.visual.destroy();h.flushFrames();expect(h.lifecycle.renderingFailed).toHaveBeenCalledOnce();expect(h.lifecycle.renderingFinished).not.toHaveBeenCalled()
 })
})

describe.each(['composition', 'template','expression'])('SDK categorical host contracts: %s', layer => {
  const spec = () => {const result:any=layer === 'composition' ? {type:'column',config:{animationEnabled:false,cardStyle:'plain'}} : {
    type:'custom',config:{cardStyle:'plain'},template:{meta:{id:'sdk-host-contract'},slots:{category:{kind:'dimension'},amount:{kind:'measure'},returns:{kind:'measure'}},template:{animation:false,xAxis:{type:'category',data:'$slot.category.categories'},yAxis:{type:'value'},series:[{type:'bar',data:'$slot.amount.values'}]}}}
    if(layer==='expression'){
      result.template.meta.formatVersion=4
      result.template.template.series[0]={type:'custom',data:'$slot.amount.values',renderItem:{language:'vilsem-expression',version:1,root:{type:'circle',shape:{cx:{op:'add',args:[20,{op:'mul',args:[{op:'dataIndex',args:[]},30]}]},cy:40,r:5},style:{fill:'#336699'}}}}
    }
    return result
  }
  function setup(){const h=harness();h.visual.renderPrimitiveChart(h.dataView,spec());return h}
  it('routes single/Ctrl/empty-area clicks to SDK row identities',async()=>{
    const h=setup()
    h.events.click({dataIndex:0,seriesIndex:0,event:{event:{ctrlKey:false,metaKey:false}}});await Promise.resolve()
    // Default sorting puts Accessories (source row 2) first; identities must
    // follow the source row, not the displayed index.
    expect(h.selection.select).toHaveBeenLastCalledWith(h.ids[2],false)
    h.events.click({dataIndex:1,seriesIndex:0,event:{event:{ctrlKey:true}}});await Promise.resolve()
    expect(h.selection.select).toHaveBeenLastCalledWith(h.ids[1],true)
    h.zrEvents.click({target:null});await Promise.resolve()
    expect(h.selection.clear).toHaveBeenCalledOnce()
  })
  it('dims incoming highlights, restores bookmark state, and clears a filtered-empty view',()=>{
    const h=setup(),column=h.dataView.categorical!.values![0]
    column.highlights=[0,null,5]
    h.visual.renderPrimitiveChart(h.dataView,spec())
    const opacities=()=>h.chart.setOption.mock.calls.at(-1)[0].series[0].data.map(p=>p.itemStyle?.opacity??1)
    expect(opacities()).toEqual([1,.25,1])
    delete column.highlights
    h.visual.renderPrimitiveChart(h.dataView,spec())
    h.restoreSelection([h.ids[1]])
    expect(opacities()).toEqual([.25,1,.25])
    h.restoreSelection([])
    expect(opacities()).toEqual([1,1,1])
    h.dataView.categorical!.categories!.forEach(c=>{c.values=[];c.identity=[]})
    h.dataView.categorical!.values!.forEach(c=>{c.values=[]})
    h.visual.renderPrimitiveChart(h.dataView,spec())
    expect(h.visual.root.innerHTML).toContain('No data matches the current filters')
    expect(h.visual.currentSelectionIds).toEqual([])
  })
  it('sends a native tooltip, context identity and keyboard selection to the host',async()=>{
    const h=setup(),event={clientX:40,clientY:60,preventDefault:vi.fn()}
    const point={dataIndex:1,seriesIndex:0,name:'Bikes',value:13929,event:{event}}
    h.events.mouseover(point)
    expect(h.tooltip.show).toHaveBeenLastCalledWith(expect.objectContaining({identities:[h.ids[1]],dataItems:expect.arrayContaining([expect.objectContaining({value:expect.any(String)})])}))
    h.events.contextmenu(point)
    expect(h.selection.showContextMenu).toHaveBeenLastCalledWith(h.ids[1],{x:40,y:60})
    h.rootEvents.keydown({key:'ArrowRight',preventDefault(){}})
    h.rootEvents.keydown({key:' ',ctrlKey:false,metaKey:false,preventDefault(){}});await Promise.resolve()
    expect(h.selection.select).toHaveBeenLastCalledWith(h.ids[1],false)
  })
  it('re-renders a resize update from its supplied data without asking the host for data',()=>{
    const h=setup(),fetchMoreData=vi.fn(),refreshHostData=vi.fn()
    Object.assign(h.host,{fetchMoreData,refreshHostData})
    h.dataView.metadata.objects={semantica:{primitiveSpec:JSON.stringify(spec())}}
    const before=JSON.stringify(h.dataView)
    h.visual.update({type:4,viewport:{width:180,height:600},dataViews:[h.dataView]})
    expect(h.visual.lastOption.series[0].data).toHaveLength(3)
    expect(fetchMoreData).not.toHaveBeenCalled();expect(refreshHostData).not.toHaveBeenCalled()
    expect(JSON.stringify(h.dataView)).toBe(before)
  })
  it('does not dim every remaining row when filtering removes the bookmarked selection',()=>{
    const h=setup()
    h.selection.getSelectionIds=()=>[h.ids[1]]
    h.dataView.categorical!.categories![0].values=['Clothing']
    h.dataView.categorical!.categories![0].identity=[h.ids[0]]
    h.dataView.categorical!.values!.forEach(c=>{c.values=[c.values[0]]})
    h.visual.renderPrimitiveChart(h.dataView,spec())
    const data=h.chart.setOption.mock.calls.at(-1)[0].series[0].data
    expect(data[0]?.itemStyle?.opacity??1).toBe(1)
    // Genuine all-null incoming highlights must still dim, rather than being
    // mistaken for an absent highlight channel.
    h.dataView.categorical!.values![0].highlights=[null]
    h.visual.renderPrimitiveChart(h.dataView,spec())
    expect(h.chart.setOption.mock.calls.at(-1)[0].series[0].data[0].itemStyle.opacity).toBe(.25)
    h.dataView.categorical!.values![0].highlights=[12436]
    h.visual.renderPrimitiveChart(h.dataView,spec())
    expect(h.chart.setOption.mock.calls.at(-1)[0].series[0].data[0].itemStyle?.opacity??1).toBe(1)
  })
})

describe('Power BI production primitive selection routing', () => {
  it('shows an authored canvas override as distinct from a stored report-theme toggle',()=>{
    const h=harness()
    const value=()=>h.visual.getFormattingModel().cards[0].groups[0].slices[0].control.properties.value
    expect(value()).toBe(false) // harness deliberately authors canvasTheme:dark
    h.visual.renderPrimitiveChart(h.dataView,{type:'bar',config:{cardStyle:'plain'}})
    expect(value()).toBe(true)
    h.dataView.metadata.objects={appearance:{useReportTheme:true}}
    h.visual.renderPrimitiveChart(h.dataView,{type:'bar',canvasTheme:'dark',config:{cardStyle:'plain'}})
    expect(value()).toBe(true)
    expect(h.visual.lastOption.backgroundColor).toBe('transparent')
  })
  it('uses the host viewer locale for labels, axes and native tooltips',()=>{
    const h=harness();h.host.locale='en-IN'
    const dv={categorical:{categories:[{values:['A']}],values:[{source:{displayName:'Revenue',format:'$#,0.00'},values:[24914586.8193]}]}}
    h.visual.renderPrimitiveChart(dv,{type:'column',config:{cardStyle:'plain'}})
    const option=h.chart.setOption.mock.calls.at(-1)[0]
    expect(option.series[0].label.formatter({value:24914586.8193})).toBe('$2,49,14,586.82')
    expect(option.yAxis.axisLabel.formatter(24914586.8193)).toBe('$2,49,14,586.82')
    h.events.mouseover({dataIndex:0,value:24914586.8193,event:{event:{clientX:1,clientY:1}}})
    expect(h.tooltip.show.mock.calls.at(-1)[0].dataItems.at(-1).value).toBe('$2,49,14,586.82')
  })
  it('uses the model percentage format for chart labels, value axis and native tooltip',()=>{
    const h=harness()
    const dv={categorical:{categories:[{values:['A','B']}],values:[{source:{displayName:'Margin',format:'0.00%'},values:[.2345,.12]}]}}
    h.visual.renderPrimitiveChart(dv,{type:'column',config:{cardStyle:'plain'}})
    const option=h.chart.setOption.mock.calls.at(-1)[0]
    expect(option.series[0].label.formatter({value:.2345})).toBe('23.45%')
    expect(option.yAxis.axisLabel.formatter(.2345)).toBe('23.45%')
    h.events.mouseover({dataIndex:0,value:.2345,event:{event:{clientX:1,clientY:1}}})
    expect(h.tooltip.show.mock.calls.at(-1)[0].dataItems).toEqual([{displayName:'Category',value:'A'},{displayName:'Margin',value:'23.45%'}])
  })
  it('uses report palette and applies each declared Appearance property without mutating the stored spec', () => {
    const h = harness()
    h.host.colorPalette = { foreground: { value: '#202020' }, background: { value: '#ffffff' }, getColor: () => ({ value: '#224466' }) }
    const dv = { metadata: { objects: { appearance: { useReportTheme: true, backgroundColor: { solid: { color: '#123456' } }, transparency: 25 } } }, categorical: { categories: [{ values: ['A'] }], values: [{ values: [12] }] } }
    const spec = { type: 'bar', canvasTheme: 'dark', config: { cardStyle: 'plain' } }
    h.visual.renderPrimitiveChart(dv, spec)
    const option = h.chart.setOption.mock.calls.at(-1)[0]
    expect(option.textStyle.color).toBe('#202020')
    expect(option.backgroundColor).toBe('rgba(18,52,86,0.75)')
    expect(option.series[0].itemStyle.color).toBe('#224466')
    expect(spec.canvasTheme).toBe('dark')
    const model = h.visual.getFormattingModel()
    const slices = model.cards[0].groups[0].slices
    expect(slices.map(s=>s.control.properties.descriptor.propertyName)).toEqual(['useReportTheme','backgroundColor','transparency'])
    expect(slices.map(s=>s.control.properties.value)).toEqual([true,{value:'#123456'},25])
  })
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
    expect(h.visual.renderPrimitiveChart).toHaveBeenCalledWith({}, { type, config: {},specVersion:CURRENT_SPEC_VERSION })
  })
  it('shows a precise unsupported-version error instead of silently rendering a different legacy chart',()=>{
    const h=harness();h.visual.bakedSpecRaw=()=>JSON.stringify({specVersion:'99',type:'bar'})
    h.visual.renderPrimitiveChart=vi.fn();h.visual.renderError=vi.fn()
    h.visual.update({dataViews:[h.dataView]})
    expect(h.visual.renderPrimitiveChart).not.toHaveBeenCalled();expect(h.visual.renderError).toHaveBeenCalledWith(expect.stringContaining('Unsupported specVersion'),'specification')
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
    expect(h.tooltip.show).toHaveBeenCalledWith(expect.objectContaining({coordinates:[40,60],identities:[h.ids[1]],dataItems:expect.anything()}))
    expect(Array.isArray(h.tooltip.show.mock.calls.at(-1)[0].dataItems)).toBe(true)
    h.events.contextmenu({name:'Bikes',dataIndex:1,event:{event}})
    expect(h.selection.showContextMenu).toHaveBeenCalledWith(h.ids[1],{x:40,y:60})
    expect(event.preventDefault).toHaveBeenCalled()
    h.events.mouseout()
    expect(h.tooltip.hide).toHaveBeenLastCalledWith({isTouchEvent:false,immediately:true})
  })
  it('formats tuple tooltips through the native host without losing source identities',()=>{
    const h=harness()
    const spec={type:'custom',config:{cardStyle:'plain'},template:{meta:{id:'native-tooltip'},slots:{cat:{kind:'dimension'},revenue:{kind:'measure'},profit:{kind:'measure'}},template:{tooltip:{formatterTemplate:'Revenue {value.0:thousands}; Profit {value.1:thousands}'},series:[{type:'scatter',data:'$slot.revenue.pairs'}]}}}
    const dv={categorical:{categories:[{values:['Bikes']}],values:[{source:{roles:{content:true}},values:[12345.678]},{source:{roles:{secondary:true}},values:[-20.5]}]}}
    h.visual.renderPrimitiveChart(dv,spec)
    h.events.mouseover({name:'Bikes',dataIndex:0,data:{rowIndexes:[0]},value:[12345.678,-20.5],event:{event:{clientX:10,clientY:20}}})
    expect(h.tooltip.show).toHaveBeenLastCalledWith(expect.objectContaining({identities:[h.ids[0]],dataItems:[{displayName:'Details',value:'Revenue 12,345.68; Profit -20.5'}]}))
  })
  it('does not register host hover handlers when tooltips are disabled',()=>{
    const h=harness('bar',undefined,{tooltipEnabled:false})
    expect(h.events.mouseover).toBeUndefined()
    expect(h.tooltip.show).not.toHaveBeenCalled()
  })
  it.each(['treemap','sunburst'])('preserves %s navigation while selection changes and clears missing filtered roots',type=>{
    const h=harness()
    const spec={type:'custom',config:{cardStyle:'plain'},template:{meta:{id:'navigation'},slots:{cat:{kind:'dimension'},amount:{kind:'measure'}},transforms:[{hierarchy:{levels:['cat','cat'],value:'amount'},as:'h'}],template:{series:[{type,data:'$calc.h.children'}]}}}
    const dv={categorical:{categories:[{values:['Bikes','Clothing']}],values:[{source:{roles:{content:true}},values:[20,10]}]}}
    h.visual.renderPrimitiveChart(dv,spec)
    const id=h.visual.lastOption.series[0].data[0].id,seriesId=h.visual.lastOption.series[0].id
    h.events[`${type}roottonode`]({seriesId,targetNode:{getId:()=>id,depth:1}})
    h.visual.applyChartSelection(h.ids,[h.ids[0]])
    expect(h.chart.dispatchAction).toHaveBeenLastCalledWith({type:`${type}RootToNode`,seriesId,targetNodeId:id},{silent:true})
    h.visual.applyChartSelection(h.ids,[])
    expect(h.chart.dispatchAction).toHaveBeenCalledTimes(2)
    // A filtered result retaining the id restores it; removing the node resets.
    h.visual.renderPrimitiveChart({...dv,categorical:{...dv.categorical,categories:[{values:['Clothing']}] }},spec)
    expect(h.visual.hierarchyNavigation.size).toBe(0)
  })
  it('does not re-drill after the treemap breadcrumb returns to root',()=>{
    const h=harness('treemap'),seriesId=h.visual.lastOption.series[0].id
    h.events.treemaproottonode({seriesId,targetNode:{getId:()=> 'Bikes',depth:1}})
    h.events.treemaproottonode({seriesId,targetNode:{getId:()=> 'Products',depth:0}})
    h.visual.applyChartSelection(h.ids,[])
    expect(h.chart.dispatchAction).not.toHaveBeenCalled()
  })
  it('retains tree collapse flags across selection/clear and toggles them back on expand',()=>{
    const h=harness(),spec={type:'custom',config:{cardStyle:'plain'},template:{meta:{id:'tree-state'},slots:{cat:{kind:'dimension'},amount:{kind:'measure'}},transforms:[{hierarchy:{levels:['cat','cat'],value:'amount'},as:'h'}],template:{series:[{type:'tree',initialTreeDepth:-1,data:[{name:'Products',children:'$calc.h.children'}]}]}}}
    const dv={categorical:{categories:[{values:['Bikes','Clothing']}],values:[{source:{roles:{content:true}},values:[20,10]}]}}
    h.visual.renderPrimitiveChart(dv,spec)
    const seriesId=h.visual.lastOption.series[0].id
    // Tree raw data index 0 is virtual root, 1 is Products, 2 is Bikes.
    h.events.treeexpandandcollapse({seriesId,dataIndex:2})
    h.visual.applyChartSelection(h.ids,[h.ids[0]])
    const data=()=>h.chart.setOption.mock.calls.at(-1)[0].series[0].data[0].children
    expect(data()[0].collapsed).toBe(true)
    expect(data()[0].children[0].itemStyle.opacity).toBe(1)
    expect(data()[1].children[0].itemStyle.opacity).toBe(0.25)
    h.visual.applyChartSelection(h.ids,[])
    expect(data()[0].collapsed).toBe(true)
    h.events.treeexpandandcollapse({seriesId,dataIndex:2})
    h.visual.applyChartSelection(h.ids,[])
    expect(data()[0].collapsed).toBe(false)
    const before=h.selection.select.mock.calls.length
    h.events.click({seriesType:'tree',dataIndex:1,data:{name:'Products',children:[]},event:{event:{}}})
    expect(h.selection.select.mock.calls.length).toBe(before)
    h.visual.renderPrimitiveChart({...dv,categorical:{...dv.categorical,categories:[{values:['Clothing']}] }},spec)
    expect(h.visual.treeCollapsed.get(seriesId).size).toBe(0)
  })
  it('preserves collapse through real native ECharts 6 action payloads and option replacement',()=>{
    const native=createRequire(new URL('../vilsem-renderer/package.json',import.meta.url))('echarts')
    const h=harness(),spec={type:'custom',config:{cardStyle:'plain'},template:{meta:{id:'real-tree-state'},slots:{cat:{kind:'dimension'},amount:{kind:'measure'}},transforms:[{hierarchy:{levels:['cat','cat'],value:'amount'},as:'h'}],template:{animation:false,series:[{type:'tree',expandAndCollapse:true,initialTreeDepth:-1,data:[{name:'Products',children:'$calc.h.children'}]}]}}}
    h.visual.renderPrimitiveChart({categorical:{categories:[{values:['Bikes','Clothing']}],values:[{values:[20,10]}]}},spec)
    const chart=native.init(null,undefined,{renderer:'svg',ssr:true,width:900,height:600})
    h.visual.chart=chart
    try {
      chart.setOption(h.visual.lastOption)
      chart.on('treeexpandandcollapse',h.events.treeexpandandcollapse)
      const seriesId=h.visual.lastOption.series[0].id
      const bikes=()=>chart.getModel().getSeriesByIndex(0).getData().tree.getNodeByDataIndex(2)
      expect(bikes().name).toBe('Bikes')
      expect(bikes().isExpand).toBe(true)
      chart.dispatchAction({type:'treeExpandAndCollapse',seriesId,dataIndex:2})
      expect(bikes().isExpand).toBe(false)
      h.visual.applyChartSelection(h.ids,[h.ids[0]])
      expect(bikes().isExpand).toBe(false)
      h.visual.applyChartSelection(h.ids,[])
      expect(bikes().isExpand).toBe(false)
      chart.dispatchAction({type:'treeExpandAndCollapse',seriesId,dataIndex:2})
      h.visual.applyChartSelection(h.ids,[])
      expect(bikes().isExpand).toBe(true)
    } finally {chart.dispose()}
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


describe('declarative transformed visual identity routing',()=>{
 it('keeps word packing symbols invisible and dims unrelated labels through native selection',()=>{
  const h=harness('bar',['Road Red','Mountain Blue'])
  const template={meta:{id:'word-selection'},slots:{word:{kind:'dimension'},revenue:{kind:'measure'}},transforms:[{words:{text:'word',weight:'revenue',limit:4},as:'w'}],template:{xAxis:{type:'value'},yAxis:{type:'value'},series:[{type:'graph',coordinateSystem:'cartesian2d',data:'$calc.w.data',links:[]}]}}
  h.visual.renderPrimitiveChart({categorical:{categories:[{values:['Road Red','Mountain Blue']}],values:[{values:[10,5]}]}},{type:'custom',template,config:{cardStyle:'plain'}})
  h.visual.applyChartSelection(h.ids,[h.ids[0]])
  const data=h.chart.setOption.mock.calls.at(-1)[0].series[0].data
  expect(data.every(d=>d.itemStyle.opacity===0)).toBe(true)
  expect(data.find(d=>d.name==='road').label.opacity).toBe(1)
  expect(data.find(d=>d.name==='mountain').label.opacity).toBe(.25)
  h.visual.applyChartSelection(h.ids,[])
  expect(h.chart.setOption.mock.calls.at(-1)[0]).toBe(h.visual.lastOption)
 })
 it('preserves invisible helper series and authored mark/label opacity when selecting',()=>{
  const h=harness('bar',['A','B'])
  const template={meta:{id:'transparent-helpers'},slots:{category:{kind:'dimension'},amount:{kind:'measure'}},template:{xAxis:{type:'category'},yAxis:{type:'value'},series:[{type:'bar',itemStyle:{opacity:0},data:'$slot.amount.values'},{type:'bar',itemStyle:{opacity:.6},label:{show:true,opacity:.8},data:'$slot.amount.values'}]}}
  h.visual.renderPrimitiveChart({categorical:{categories:[{values:['A','B']}],values:[{values:[10,5]}]}},{type:'custom',template,config:{cardStyle:'plain'}})
  h.visual.applyChartSelection(h.ids,[h.ids[0]])
  const series=h.chart.setOption.mock.calls.at(-1)[0].series
  expect(series[0].data.map(d=>d.itemStyle.opacity)).toEqual([0,0])
  expect(series[1].data.map(d=>d.itemStyle.opacity)).toEqual([.6,.15])
  expect(series[1].data.map(d=>d.label.opacity)).toEqual([.8,.2])
  expect(h.visual.lastOption.series[1].itemStyle.opacity).toBe(.6)
 })
 it('keeps duplicate heatmap categories bound to the correct complete source row in host tooltips and clicks',async()=>{
  const h=harness()
  const template={meta:{id:'heatmap-bound-tooltip'},slots:{month:{kind:'dimension'},country:{kind:'dimension'},revenue:{kind:'measure'}},template:{xAxis:{type:'category',data:'$slot.month.categories'},yAxis:{type:'category',data:'$slot.country.categories'},series:[{type:'heatmap',data:'$slot.revenue.matrix'}]}}
  h.visual.renderPrimitiveChart({categorical:{categories:[{source:{displayName:'Month'},values:['Jan','Jan','Feb']},{source:{displayName:'Country'},values:['US','Canada','US']}],values:[{source:{displayName:'Revenue'},values:[2,10,5]}]}},{type:'custom',template,config:{cardStyle:'plain'}})
  const data=h.visual.lastOption.series[0].data[0]
  h.events.mouseover({seriesIndex:0,dataIndex:0,value:data,data})
  expect(h.tooltip.show.mock.calls.at(-1)[0].dataItems).toEqual([{displayName:'Month',value:'Jan'},{displayName:'Country',value:'Canada'},{displayName:'Revenue',value:'10'}])
  await h.events.click({seriesIndex:0,dataIndex:0,value:data,data,event:{event:{}}})
  expect(h.selection.select).toHaveBeenLastCalledWith(h.ids[1],false)
 })
 it('uses the correct radar panel indicator names in native host tooltips',()=>{
  const h=harness()
  const template={meta:{id:'radar-host-indicators'},slots:{country:{kind:'dimension'},category:{kind:'dimension'},amount:{kind:'measure'}},transforms:[{facet:{by:'country',category:'category',value:'amount'},as:'f'}],template:{radar:[{indicator:[{name:'Wrong'}]},{indicator:[{name:'Bikes'},{name:'Clothing'}]}],series:[{type:'radar',radarIndex:1,data:{repeat:'$calc.f.panels',template:{name:'$item.name',value:'$item.values',rowIndexes:'$item.rowIndexes'}}}]}}
  h.visual.renderPrimitiveChart({categorical:{categories:[{values:['US','US']},{values:['Bikes','Clothing']}],values:[{values:[3,2]}]}},{type:'custom',template,config:{cardStyle:'plain'}})
  const data=h.visual.lastOption.series[0].data[0]
  h.events.mouseover({seriesIndex:0,dataIndex:0,name:data.name,value:data.value,data})
  expect(h.tooltip.show.mock.calls.at(-1)[0].dataItems).toEqual([{displayName:'US: Bikes',value:'3'},{displayName:'US: Clothing',value:'2'}])
  expect(h.tooltip.show.mock.calls.at(-1)[0].identities).toHaveLength(2)
 })
 it('formats radar aggregate indicators without substituting a contributing row',()=>{
  const h=harness()
  const template={meta:{id:'radar-formatted-aggregate'},slots:{country:{kind:'dimension'},category:{kind:'dimension'},amount:{kind:'measure'}},transforms:[{facet:{by:'country',category:'category',value:'amount'},as:'f'}],template:{radar:{indicator:'$calc.f.indicators'},series:[{type:'radar',data:{repeat:'$calc.f.panels',template:{name:'$item.name',value:'$item.values',rowIndexes:'$item.rowIndexes'}}}]}}
  h.visual.renderPrimitiveChart({categorical:{categories:[{values:['US','US','US']},{values:['Bikes','Bikes','Clothing']}],values:[{source:{displayName:'Margin',format:'0.00%'},values:[.1,.1345,.5]}]}},{type:'custom',template,config:{cardStyle:'plain'}})
  const data=h.visual.lastOption.series[0].data[0]
  h.events.mouseover({seriesIndex:0,dataIndex:0,name:data.name,value:data.value,data})
  expect(h.tooltip.show.mock.calls.at(-1)[0].dataItems).toEqual(expect.arrayContaining([{displayName:'US: Bikes',value:'23.45%'},{displayName:'US: Clothing',value:'50.00%'}]))
  expect(h.tooltip.show.mock.calls.at(-1)[0].identities).toHaveLength(3)
 })
 it('formats repeated facet aggregates and retains all contributor identities',()=>{
  const h=harness()
  const template={meta:{id:'facet-formatted-aggregate'},slots:{country:{kind:'dimension'},category:{kind:'dimension'},amount:{kind:'measure'}},transforms:[{facet:{by:'country',category:'category',value:'amount'},as:'f'}],template:{xAxis:{type:'category'},yAxis:{type:'value'},series:{repeat:'$calc.f.panels',template:{type:'bar',data:'$item.data'}}}}
  h.visual.renderPrimitiveChart({categorical:{categories:[{values:['US','US']},{values:['Bikes','Bikes']}],values:[{source:{displayName:'Revenue',format:'$#,0.00'},values:[100,200]}]}},{type:'custom',template,config:{cardStyle:'plain'}})
  const data=h.visual.lastOption.series[0].data[0]
  h.events.mouseover({seriesIndex:0,dataIndex:0,name:data.name,value:data.value,data})
  expect(h.tooltip.show.mock.calls.at(-1)[0].dataItems).toEqual([{displayName:'Group',value:'Bikes'},{displayName:'Revenue',value:'$300.00'}])
  expect(h.tooltip.show.mock.calls.at(-1)[0].identities).toHaveLength(2)
 })
 it('carries heatmap model formats and viewer locale into native host tooltips',()=>{
  const h=harness();(h.host as any).locale='de-DE'
  const template={meta:{id:'heatmap-formatted-host'},slots:{month:{kind:'dimension'},country:{kind:'dimension'},margin:{kind:'measure'}},template:{xAxis:{type:'category',data:'$slot.month.categories'},yAxis:{type:'category',data:'$slot.country.categories'},series:[{type:'heatmap',data:'$slot.margin.matrix'}]}}
  h.visual.renderPrimitiveChart({categorical:{categories:[{source:{displayName:'Month'},values:['Jan','Jan','Feb']},{source:{displayName:'Country'},values:['US','Canada','US']}],values:[{source:{displayName:'Margin',format:'0.00%'},values:[.2,.2345,.5]}]}},{type:'custom',template,config:{cardStyle:'plain'}})
  const dataIndex=h.visual.lastOption.series[0].data.findIndex(d=>(Array.isArray(d)?d:d.value)[2]===.2345)
  expect(dataIndex).toBeGreaterThanOrEqual(0)
  const data=h.visual.lastOption.series[0].data[dataIndex]
  expect(h.visual.lastOption.series[0].label.formatter({value:Array.isArray(data)?data:data.value})).toBe('23,45%')
  h.events.mouseover({seriesIndex:0,dataIndex,value:data,data})
  expect(h.tooltip.show.mock.calls.at(-1)[0].dataItems).toContainEqual({displayName:'Margin',value:'23,45%'})
 })
 it('dims unrelated flow links while preserving authored edge opacity and restores the pristine graph',()=>{
  const h=harness()
  const template={meta:{id:'flow-edge-style'},slots:{a:{kind:'dimension'},b:{kind:'dimension'},v:{kind:'measure'}},transforms:[{flows:{levels:['a','b'],value:'v'},as:'f'}],template:{series:[{type:'sankey',data:'$calc.f.nodes',links:'$calc.f.links',lineStyle:{opacity:0.4}}]}}
  h.visual.renderPrimitiveChart({categorical:{categories:[{values:['A','B']},{values:['X','Y']}],values:[{values:[2,3]}]}},{type:'custom',template,config:{cardStyle:'plain'}})
  h.visual.applyChartSelection(h.ids,[h.ids[0]])
  const links=h.chart.setOption.mock.calls.at(-1)[0].series[0].links
  // prepareVisualRows sorts by measure; assert identities rather than input order.
  expect(links.find(link=>link.label==='A \u2192 X').lineStyle.opacity).toBe(0.4)
  expect(links.find(link=>link.label==='B \u2192 Y').lineStyle.opacity).toBe(0.1)
  expect(links.map(link=>link.rowIndexes)).toEqual([[0],[1]])
  expect(h.visual.lastOption.series[0].links.every(link=>!link.lineStyle)).toBe(true)
  h.visual.applyChartSelection(h.ids,[])
  expect(h.chart.setOption.mock.calls.at(-1)[0]).toBe(h.visual.lastOption)
 })
 it('preserves every category field through the renderer row boundary',()=>{
  const h=harness()
  const rows=h.visual.buildRowsFromDataView({categorical:{categories:[{values:['A']},{values:['B']},{values:['C']}],values:[{values:[7]}]}})
  expect(rows[0]).toMatchObject({_cat:'A',_cat2:'B',_cats:['A','B','C'],_sourceIndex:0,_val:7})
 })
 it('selects all contributing source rows for aggregated marks after sorting, including Ctrl multi-select',async()=>{
  const h=harness()
  const template={meta:{id:'links-test'},slots:{a:{kind:'dimension'},b:{kind:'dimension'},v:{kind:'measure'}},transforms:[{links:{source:'a',target:'b',value:'v'},as:'flow'}],template:{series:[{type:'sankey',data:'$calc.flow.nodes',links:'$calc.flow.links'}]}}
  h.visual.renderPrimitiveChart({categorical:{categories:[{values:['A','A','B']},{values:['X','Y','X']}],values:[{values:[2,10,5]}]}},{type:'custom',template,config:{cardStyle:'plain'}})
  const option=h.chart.setOption.mock.calls.at(-1)[0]
  const node=option.series[0].data.find(d=>d.label==='A')
  expect(node.rowIndexes).toEqual([0,2])
  await h.events.click({data:node,dataIndex:0,event:{event:{ctrlKey:true}}})
  expect(h.selection.select).toHaveBeenLastCalledWith([h.ids[1],h.ids[0]],true)
  h.events.mouseover({data:node,dataIndex:0,value:12})
  expect(h.tooltip.show.mock.calls.at(-1)[0].identities).toEqual([h.ids[1],h.ids[0]])
 })
 it('supports explicit latest-period source identities instead of selecting the first row',async()=>{
  const h=harness()
  h.visual.templateRowSources=[2,0,1]
  expect(h.visual.primitiveCategoryIndexes({dataIndex:0,data:{rowIndexes:[2]}})).toEqual([1])
 })
})


it('preserves an explicitly authored background on a white host page while default charts stay transparent',()=>{
 const h=harness()
 const template={meta:{id:'background-test'},slots:{v:{kind:'measure'}},template:{backgroundColor:'#07111f',xAxis:{type:'category'},yAxis:{type:'value'},series:[{type:'bar',data:'$slot.v.values'}]}}
 h.visual.renderPrimitiveChart({categorical:{categories:[{values:['A']}],values:[{values:[7]}]}},{type:'custom',template,config:{cardStyle:'plain'}})
 expect(h.chart.setOption.mock.calls.at(-1)[0].backgroundColor).toBe('#07111f')
 h.visual.renderPrimitiveChart({categorical:{categories:[{values:['A']}],values:[{values:[7]}]}},{type:'bar',config:{cardStyle:'plain'}})
 expect(h.chart.setOption.mock.calls.at(-1)[0].backgroundColor).toBe('transparent')
})


it('renders scoped-measure host query results identically to the SSR resolver fixture',()=>{
  const h=harness('bar',['A','B','C'])
  const spec={version:1,type:'custom',canvasTheme:'dark',config:{cardStyle:'plain'},measures:{Margin:'DIVIDE([Profit],[Revenue])'},template:{meta:{id:'fixture_margin',name:'Margin'},slots:{category:{kind:'dimension'},margin:{kind:'measure'}},params:[],template:{animation:false,xAxis:{type:'category',data:'$slot.category.values'},yAxis:{type:'value'},series:[{type:'bar',data:'$slot.margin.values'}]}}}
  const values=[0.6284073682136907,0.442744552217835,0.41138501803790783]
  const categorical={categories:[{values:['A','B','C']}],values:[{source:{displayName:'Margin',roles:{content:true}},values}]}
  h.visual.renderPrimitiveChart({categorical},spec)
  const actual=h.chart.setOption.mock.calls.at(-1)[0]
  const ssr=resolveVisualSpec(spec,normaliseRows(values.map((v,i)=>({'P[C]':['A','B','C'][i],'[Margin]':v})),'P[C]',['Margin']))
  // Native needs stable generated series ids for retained update transitions.
  // They are runtime identity only; all data, style and format fields match SSR.
  expect(actual.series[0].id).toBe('vilsem-template-0')
  expect(JSON.stringify(actual.series.map(({id,...series})=>series))).toBe(JSON.stringify(ssr.series))
  expect(actual.xAxis.data).toEqual(ssr.xAxis.data)
})
