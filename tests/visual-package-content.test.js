import { describe, expect, it } from 'vitest'
import Module, { createRequire } from 'node:module'
import fs from 'node:fs'
import AdmZip from 'adm-zip'
import vm from 'node:vm'
const require = createRequire(import.meta.url)
const filename = require.resolve('../electron/ipc/powerbi.js')
const nativeRequire = createRequire(filename)

function writer() {
  const handlers = {}, output = [], dialogs = []
  const m = new Module(filename)
  m.filename = filename
  m.require = name => {
    if (name === 'electron/main') return { ipcMain: { handle: (key, fn) => { handlers[key] = fn } } }
    if (name === 'electron') return { dialog: { showSaveDialog: async () => { dialogs.push(true); return { filePath: 'qa-export.pbiviz' } } }, BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] } }
    if (name === 'fs') return { ...fs, writeFileSync: (_file, bytes) => output.push(bytes) }
    if (name === '../../src/auth/auth' || name === '../../src/cache/sqlite' || name === '../../src/queue/limiter') return {}
    return nativeRequire(name)
  }
  m._compile(fs.readFileSync(filename, 'utf8'), filename)
  m.exports.register()
  return { run: spec => handlers['pbi-export-visual-package'](null, { spec, title: 'QA visual' }), output, dialogs }
}

describe('Custom visual export boundary', () => {
  it.each(['kpi','text_box','unknown'])('rejects %s before opening Save', async type => {
    const h=writer(), result=await h.run(JSON.stringify({version:1,type,config:{}}))
    expect(result.success).toBe(false);expect(result.message).toMatch(/not supported/i)
    expect(h.dialogs).toHaveLength(0);expect(h.output).toHaveLength(0)
  })
  it('rejects malformed JSON before opening Save',async()=>{
    const h=writer(),result=await h.run('{broken')
    expect(result.success).toBe(false);expect(result.message).toMatch(/JSON/)
    expect(h.dialogs).toHaveLength(0);expect(h.output).toHaveLength(0)
  })
})

const hasBuiltTemplate = fs.existsSync('vilsem-renderer/dist') && fs.readdirSync('vilsem-renderer/dist').some(f => f.endsWith('.pbiviz'))
// Integration coverage uses the actual package; clean checkouts must build it first.
describe.skipIf(!hasBuiltTemplate)('production custom visual package contents', () => {
  it.each(['waffle', 'bullet', 'progress', 'stat_card', 'metric_tile', 'funnel', 'waterfall', 'heatmap', 'ranked_list', 'chord', 'sankey', 'sunburst', 'narrative', 'insight'])('exports the shared %s renderer with its formatting spec intact', async type => {
    const h=writer()
    const spec=JSON.stringify({version:1,type,canvasTheme:'light',config:{cellSize:13,cellGap:3,cellRadius:4,customColors:[]},measures:{primary:'Sales',all:['Sales']}})
    const result=await h.run(spec)
    expect(result.success).toBe(true)
    const zip=new AdmZip(h.output[0])
    const metadata=JSON.parse(zip.getEntries().find(e=>e.entryName.endsWith('.pbiviz.json')).getData().toString())
    expect(metadata.content.js.includes(JSON.stringify(spec))).toBe(true)
    expect(()=>new vm.Script(metadata.content.js)).not.toThrow()
  },20000)
  it.each(['ordinary text', '$&', '$`', "$'"] )('preserves literal title %s while baking the spec', async title => {
    const h = writer()
    const spec = JSON.stringify({ version: 1, type: 'bar', canvasTheme: 'dark', config: { title }, measures: { primary: 'Sales', all: ['Sales'] } })
    const result = await h.run(spec)
    expect(result.success).toBe(true)
    expect(h.output).toHaveLength(1)
    const zip = new AdmZip(h.output[0])
    const metadata = JSON.parse(zip.getEntries().find(e => e.entryName.endsWith('.pbiviz.json')).getData().toString())
    expect(metadata.content.js.includes(JSON.stringify(spec)), "Baked spec must survive byte-for-byte").toBe(true)
    expect(metadata.content.js.includes('__SEMANTICA_BAKED_SPEC__')).toBe(false)
    expect(() => new vm.Script(metadata.content.js)).not.toThrow()
    expect(JSON.parse(zip.readAsText('package.json')).visual.guid).toBe(result.guid)
  }, 20000)
})
