import { afterEach, describe, expect, it, vi } from 'vitest'
const render = vi.hoisted(() => vi.fn(() => '<div>QA visual</div>'))
vi.mock('../ui/src/pages/powerbi/htmlTemplates/index.js', () => ({ renderVisualToHtml: render }))
import { injectVisualsIntoReport } from '../ui/src/pages/injector/injectorFlow.js'

function setup() {
  render.mockReset().mockReturnValue('<div>QA visual</div>')
  const resource = { path: 'StaticResources/RegisteredResources/logo.png', payload: 'iVBORw0KGgr/AI DA/g=='.replaceAll(' ', ''), payloadType: 'InlineBase64', content: '\ufffdPNG\r\n\u001a\n\ufffd\0\ufffd\ufffd\ufffd' }
  const existingVisual = { path: 'definition/pages/page1/visuals/native/visual.json', content: '{"name":"native","visual":{"visualType":"card"}}' }
  const parts = [{ path: 'definition/report.json', content: '{"themeCollection":{}}' }, { path: 'definition/pages/page1/page.json', content: '{"name":"page1","width":1280,"height":720}' }, existingVisual, resource]
  const semantica = {
    queryTable: vi.fn(async () => ({ rows: [{ 'Product[Category]': 'North', Sales: 10 }] })),
    pbismGetDefinition: vi.fn(async () => ({ success: true, parts: [{ path: 'definition/tables/Existing.tmdl', content: 'table Existing\n' }] })),
    pbismUpdateDefinition: vi.fn(async () => ({ success: true })),
    pbiUpdateReportDefinition: vi.fn(async () => ({ success: true })),
  }
  vi.stubGlobal('window', { semantica })
  const args = { report: { id: 'qa-report', workspaceId: 'qa-workspace', datasetId: 'qa-model' }, reportParts: parts, format: 'PBIR', targetPageDir: 'page1', visuals: [{ id: 'added', type: 'bar', dimension: 'Product[Category]', measures: ['Sales'], x: 10, y: 20, width: 300, height: 200 }] }
  return { semantica, args, resource, existingVisual }
}
afterEach(() => vi.unstubAllGlobals())
describe('existing report insertion preparation and preservation', () => {
  it.each(['missing page', 'invalid report JSON', 'missing report JSON', 'duplicate visual id', 'visual without measure'])('rejects %s before model mutation', async scenario => {
    const {semantica,args}=setup()
    if(scenario==='missing page')args.targetPageDir='deleted-page'
    if(scenario==='invalid report JSON')args.reportParts[0].content='{broken'
    if(scenario==='missing report JSON')args.reportParts.shift()
    if(scenario==='duplicate visual id')args.visuals.push({...args.visuals[0]})
    if(scenario==='visual without measure')args.visuals.push({...args.visuals[0],id:'empty',measures:[]})
    await expect(injectVisualsIntoReport(args)).rejects.toThrow()
    expect(semantica.pbismUpdateDefinition).not.toHaveBeenCalled()
    expect(semantica.pbiUpdateReportDefinition).not.toHaveBeenCalled()
  })
  it('retains original visuals and binary resources when adding a visual', async () => {
    const { semantica, args, resource, existingVisual } = setup()
    const original = structuredClone(args.reportParts)
    await injectVisualsIntoReport(args)
    const written = semantica.pbiUpdateReportDefinition.mock.calls[0][0].parts
    expect(written.find(p => p.path === resource.path)).toEqual(resource)
    expect(written.find(p => p.path === existingVisual.path)).toEqual(existingVisual)
    expect(args.reportParts).toEqual(original)
    expect(semantica.pbismUpdateDefinition.mock.calls[0][0].parts).toContainEqual({ path: 'definition/tables/Existing.tmdl', content: 'table Existing\n' })
  })
  it.each([false,true])('legacy destination validation preserves the chosen page (missing=%s)',async missing=>{
    const {semantica,args}=setup()
    args.format='PBIR-Legacy'
    args.targetPageDir=missing?'deleted-page':'second'
    args.reportParts=[{path:'report.json',content:JSON.stringify({sections:[{name:'first',visualContainers:[]},{name:'second',visualContainers:[]}]})}]
    if(missing){
      await expect(injectVisualsIntoReport(args)).rejects.toThrow(/Target page/)
      expect(semantica.pbismUpdateDefinition).not.toHaveBeenCalled()
      expect(semantica.pbiUpdateReportDefinition).not.toHaveBeenCalled()
    }else{
      await injectVisualsIntoReport(args)
      const report=JSON.parse(semantica.pbiUpdateReportDefinition.mock.calls[0][0].parts[0].content)
      expect(report.sections[0].visualContainers).toHaveLength(0)
      expect(report.sections[1].visualContainers).toHaveLength(1)
    }
  })
  it.each(['query exception', 'query error result', 'render exception', 'empty render'])('stops before any write on %s', async scenario => {
    const { semantica, args } = setup()
    if (scenario === 'query exception') semantica.queryTable.mockRejectedValue(Error('query unavailable'))
    if (scenario === 'query error result') semantica.queryTable.mockResolvedValue({ error: 'QUERY_FAILED', message: 'query unavailable' })
    if (scenario === 'render exception') render.mockImplementation(() => { throw Error('render unavailable') })
    if (scenario === 'empty render') render.mockReturnValue('')
    await expect(injectVisualsIntoReport(args)).rejects.toThrow(/added/)
    expect(semantica.pbismGetDefinition).not.toHaveBeenCalled()
    expect(semantica.pbismUpdateDefinition).not.toHaveBeenCalled()
    expect(semantica.pbiUpdateReportDefinition).not.toHaveBeenCalled()
  })
})
