import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
const { inspectLocalProject, writeLocalProject, saveBoundReport } = createRequire(import.meta.url)('../src/powerbi/localProject.js')
let root
const json = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value)) }
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vilsem-local-pbip-'))
  json(path.join(root, 'Sales.pbip'), { artifacts: [{ report: { path: 'Sales.Report' } }] })
  json(path.join(root, 'Sales.Report/definition.pbir'), { datasetReference: { byPath: { path: '../Sales.SemanticModel' } } })
  json(path.join(root, 'Sales.SemanticModel/definition.pbism'), { version: '4.0' })
  fs.mkdirSync(path.join(root, 'Sales.SemanticModel/definition'))
  fs.writeFileSync(path.join(root, 'Sales.SemanticModel/definition/model.tmdl'), 'model Model\n\tculture: en-US\n')
})
afterEach(() => fs.rmSync(root, { recursive: true, force: true }))
const parts = () => [
  { path: 'definition.pbir', content: JSON.stringify({ version: '4.0', datasetReference: { byPath: { path: '../../Sales.SemanticModel' } } }) },
  { path: 'definition/report.json', content: '{}' },
  { path: 'definition/version.json', content: '{"version":"4.0.0"}' },
  { path: 'StaticResources/RegisteredResources/test.bin', payloadType: 'InlineBase64', payload: Buffer.from([0, 255, 123, 10]).toString('base64') },
]
describe('local Power BI project resolution', () => {
  it('follows report references and gives stable model identity across folder/file entry points', () => {
    const fromFolder = inspectLocalProject(root)
    expect(fromFolder).toMatchObject({ kind: 'local-pbip', format: 'tmdl', name: 'Sales' })
    expect(inspectLocalProject(path.join(root, 'Sales.pbip')).modelId).toBe(fromFolder.modelId)
    expect(inspectLocalProject(path.join(root, 'Sales.SemanticModel')).modelId).toBe(fromFolder.modelId)
  })
  it('rejects ambiguous project folders instead of choosing the first model', () => {
    json(path.join(root, 'Other.pbip'), {})
    expect(() => inspectLocalProject(root)).toThrow('multiple PBIP')
  })
  it('distinguishes remote live reports from local model folders', () => {
    json(path.join(root, 'Sales.Report/definition.pbir'), { datasetReference: { byConnection: { connectionString: 'semanticmodelid=abc' } } })
    expect(() => inspectLocalProject(root)).toThrow('Fabric model option')
  })
  it('supports BIM definitions and rejects missing model definitions', () => {
    fs.unlinkSync(path.join(root, 'Sales.SemanticModel/definition/model.tmdl'))
    expect(() => inspectLocalProject(root)).toThrow('no definition/model.tmdl')
    json(path.join(root, 'Sales.SemanticModel/model.bim'), { model: { tables: [] } })
    expect(inspectLocalProject(root).format).toBe('bim')
  })
  it('rejects absolute references and handles missing files with an error', () => {
    json(path.join(root, 'Sales.pbip'), { artifacts: [{ report: { path: 'C:\\elsewhere' } }] })
    expect(() => inspectLocalProject(root)).toThrow('relative paths')
    expect(() => inspectLocalProject(path.join(root, 'missing'))).toThrow()
  })
})
describe('local Power BI project package writing', () => {
  it('preserves resource bytes, source spec and model reference without editing source', () => {
    const before = fs.readFileSync(path.join(root, 'Sales.SemanticModel/definition/model.tmdl'))
    const destination = path.join(root, 'Output')
    const result = writeLocalProject({ destination, reportParts: parts(), sourceSpec: { title: 'Revenue 日本', visuals: [] } })
    expect(inspectLocalProject(result.projectPath).modelId).toBe(inspectLocalProject(root).modelId)
    expect(fs.readFileSync(path.join(destination, 'Report/StaticResources/RegisteredResources/test.bin'))).toEqual(Buffer.from([0, 255, 123, 10]))
    expect(JSON.parse(fs.readFileSync(path.join(destination, 'vilsem-source.json'), 'utf8')).title).toBe('Revenue 日本')
    expect(fs.readFileSync(path.join(root, 'Sales.SemanticModel/definition/model.tmdl'))).toEqual(before)
  })
  it('does not overwrite a destination or its files', () => {
    const destination = path.join(root, 'Output')
    fs.mkdirSync(destination); fs.writeFileSync(path.join(destination, 'keep.txt'), 'keep')
    expect(() => writeLocalProject({ destination, reportParts: parts() })).toThrow()
    expect(fs.readdirSync(destination)).toEqual(['keep.txt'])
  })
  it.each(['../escape', '/absolute', 'C:/absolute', 'folder/../escape', 'folder\\escape', 'CON', 'file:stream', 'trailing.'])('rejects unsafe part %s before writing', name => {
    const destination = path.join(root, 'Output')
    expect(() => writeLocalProject({ destination, reportParts: [...parts(), { path: name, content: 'bad' }] })).toThrow('Invalid report part path')
    expect(fs.existsSync(destination)).toBe(false)
  })
  it('rejects duplicate files and incomplete reports before writing', () => {
    const destination = path.join(root, 'Output')
    expect(() => writeLocalProject({ destination, reportParts: [...parts(), { path: 'DEFINITION.PBIR', content: '{}' }] })).toThrow('Duplicate')
    expect(() => writeLocalProject({ destination, reportParts: parts().slice(0, 1) })).toThrow('complete enhanced PBIR')
    expect(fs.existsSync(destination)).toBe(false)
  })
  it('rejects an unresolved local model without creating output', () => {
    const reportParts = parts(); reportParts[0].content = JSON.stringify({ datasetReference: { byPath: { path: '../Missing' } } })
    const destination = path.join(root, 'Output')
    expect(() => writeLocalProject({ destination, reportParts })).toThrow('Cannot read')
    expect(fs.existsSync(destination)).toBe(false)
  })
})


describe('active model binding for a new report', () => {
  it('creates a separate report referencing the unchanged local model', () => {
    const source=inspectLocalProject(root)
    const destination=path.join(root,'NewReport')
    const original=fs.readFileSync(path.join(root,'Sales.Report/definition.pbir'),'utf8')
    const result=saveBoundReport({destination,reportParts:parts().filter(p=>p.path!=='definition.pbir'),sourceSpec:{title:'New'},connection:{kind:'local-pbip',datasetId:source.modelId,localSource:source}})
    expect(JSON.parse(fs.readFileSync(result.reportPath,'utf8')).datasetReference.byPath.path).toBe('../../Sales.SemanticModel')
    expect(fs.readFileSync(path.join(root,'Sales.Report/definition.pbir'),'utf8')).toBe(original)
  })
  it('rejects stale model identity before reserving a destination', () => {
    const destination=path.join(root,'NewReport')
    expect(()=>saveBoundReport({destination,reportParts:[],connection:{kind:'local-pbip',datasetId:'local:stale',localSource:inspectLocalProject(root)}})).toThrow('identity changed')
    expect(fs.existsSync(destination)).toBe(false)
  })
  it('writes a Desktop live connection for Fabric without credentials', () => {
    const result=saveBoundReport({destination:path.join(root,'RemoteReport'),reportParts:parts().filter(p=>p.path!=='definition.pbir'),connection:{datasetId:'model-id',workspaceName:'Workspace',datasetName:'Sales'}})
    const reference=JSON.parse(fs.readFileSync(result.reportPath,'utf8')).datasetReference
    expect(reference.byConnection.connectionString).toContain('powerbi://api.powerbi.com/v1.0/myorg/Workspace')
    expect(reference.byPath).toBeUndefined()
  })
})
