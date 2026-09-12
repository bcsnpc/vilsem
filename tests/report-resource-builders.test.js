import { afterEach, describe, it, expect, vi } from 'vitest'
import { buildReportParts } from '../ui/src/pages/powerbi/reportBuilder.js'
import { buildHtmlContentReportParts } from '../ui/src/pages/powerbi/reportBuilder_htmlcontent.js'

afterEach(() => vi.restoreAllMocks())
describe('report builders preserve untouched resource payloads', () => {
  it.each([['standard', buildReportParts], ['HTML content', buildHtmlContentReportParts]])('%s keeps opaque resources during report reconstruction', (_, build) => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const resource = { path: 'StaticResources/RegisteredResources/logo.png', payload: Buffer.from([137, 80, 78, 71, 255]).toString('base64'), payloadType: 'InlineBase64', content: '\ufffdPNG\ufffd' }
    const originalParts = [{ path: 'definition/report.json', content: '{"themeCollection":{}}' }, resource]
    const original = structuredClone(originalParts)
    const result = build({ originalParts, pages: [{ id: 'qa', name: 'QA', width: 1280, height: 720, visuals: [] }], injectionScope: 'fullpage', renderer: 'semantica', measuresList: [] })
    expect(result.find(p => p.path === resource.path)).toEqual(resource)
    expect(originalParts).toEqual(original)
  })
})
