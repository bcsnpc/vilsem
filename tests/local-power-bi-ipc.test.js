import { describe, it, expect, beforeEach } from 'vitest'
import Module, { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
const filename = require.resolve('../electron/ipc/localPowerBI.js')
let selection, inspected, options, parent, failure, written, connection
const registrations = new Map()
const subject = new Module(filename)
subject.filename = filename
subject.paths = Module._nodeModulePaths(require('node:path').dirname(filename))
subject.require = name => {
  if (name === 'electron/main') return {
    ipcMain: { handle: (name, fn) => registrations.set(name, fn) },
    BrowserWindow: { fromWebContents: () => parent },
    dialog: { showOpenDialog: async (...args) => { options = args; return selection } },
  }
  if (name === './connection') return { getWorkspaceConfig: () => connection }
  if (name === '../../src/powerbi/localProject') return { saveBoundReport: args => { written=args; return { projectPath: 'D:/QA/New/Report.pbip' } }, inspectLocalProject: file => {
    inspected = file
    if (failure) throw new Error(failure)
    return { kind: 'local-pbip', modelId: 'local:qa', modelPath: file }
  } }
  return require(name)
}
subject._compile(fs.readFileSync(filename, 'utf8'), filename)
const select = subject.exports.selectLocalPowerBIModel
beforeEach(() => { selection = { canceled: false, filePaths: ['D:/QA/Sales'] }; inspected = null; options = null; parent = { id: 1 }; failure = null; written=null; connection={datasetId:'local:qa',kind:'local-pbip'} })
describe('local Power BI selection IPC', () => {
  it('registers a dedicated selection operation', () => {
    subject.exports.register()
    expect(registrations.get('select-local-power-bi-model')).toBe(select)
  })
  it('resolves only the folder selected through the native dialog', async () => {
    const result = await select({ sender: {} }, { path: 'D:/unrequested' })
    expect(options[0]).toBe(parent)
    expect(options[1].properties).toEqual(['openDirectory'])
    expect(inspected).toBe('D:/QA/Sales')
    expect(result).toMatchObject({ success: true, source: { kind: 'local-pbip' } })
  })
  it('treats cancellation as cancellation without reading a model', async () => {
    selection = { canceled: true, filePaths: [] }
    expect(await select({ sender: {} })).toEqual({ canceled: true })
    expect(inspected).toBeNull()
  })
  it('supports choosing an exact project when folders are ambiguous', async () => {
    parent = null
    await select({ sender: {} }, { selectFile: true })
    expect(options).toHaveLength(1)
    expect(options[0].filters[0].extensions).toEqual(['pbip', 'pbir'])
  })
  it('returns actionable validation failure without switching connections', async () => {
    failure = 'This report connects to a published model.'
    expect(await select({ sender: {} })).toEqual({ success: false, error: failure })
  })
})


describe('Power BI file save IPC',()=>{
  const save=subject.exports.saveLocalPowerBIReport
  const request={datasetId:'local:qa',sourceSpec:{title:'New report'},reportParts:[]}
  it('writes only into a new folder under the picked destination',async()=>{
    expect(await save({sender:{}},request)).toMatchObject({success:true})
    expect(written.destination.replace(/\\/g,'/')).toMatch(/^D:\/QA\/Sales\/New report-\d+$/)
    expect(written.connection).toBe(connection)
  })
  it('does not write after cancel',async()=>{
    selection={canceled:true,filePaths:[]}
    expect(await save({sender:{}},request)).toEqual({canceled:true});expect(written).toBeNull()
  })
  it('rejects a stale model before opening a picker',async()=>{
    expect(await save({sender:{}},{...request,datasetId:'other'})).toMatchObject({success:false})
    expect(options).toBeNull();expect(written).toBeNull()
  })
})
