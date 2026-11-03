const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) }
  catch (error) { throw new Error(`Cannot read Power BI definition ${file}: ${error.message}`) }
}

function relativeReference(base, reference) {
  if (typeof reference !== 'string' || !reference.trim() || path.win32.isAbsolute(reference) || path.posix.isAbsolute(reference)) {
    throw new Error('Power BI project references must be relative paths.')
  }
  return path.resolve(base, reference.replace(/[\\/]/g, path.sep))
}

// Follow the actual project/report binding, never guess a model by folder name.
// Sibling model references are valid PBIP paths; no files are changed here.
function inspectLocalProject(inputPath) {
  if (typeof inputPath !== 'string' || !inputPath.trim()) throw new Error('Select a PBIP project or semantic-model folder.')
  const selected = fs.realpathSync(inputPath)
  let projectPath = null
  let reportPath = null
  let modelPath = null
  const inspectReport = file => {
    reportPath = fs.realpathSync(file)
    const reference = readJson(reportPath).datasetReference
    if (reference?.byConnection) throw new Error('This report connects to a published model. Use the Fabric model option instead.')
    modelPath = relativeReference(path.dirname(reportPath), reference?.byPath?.path)
  }
  let entry = selected
  if (fs.statSync(entry).isDirectory()) {
    if (fs.existsSync(path.join(entry, 'definition.pbism'))) modelPath = entry
    else {
      const projects = fs.readdirSync(entry).filter(name => name.toLowerCase().endsWith('.pbip'))
      if (projects.length > 1) throw new Error('This folder contains multiple PBIP projects. Select the specific .pbip file.')
      if (projects.length === 1) entry = path.join(entry, projects[0])
      else if (fs.existsSync(path.join(entry, 'definition.pbir'))) entry = path.join(entry, 'definition.pbir')
      else throw new Error('No PBIP project, report definition or semantic-model definition found in this folder.')
    }
  }
  if (!modelPath) {
    if (entry.toLowerCase().endsWith('.pbip')) {
      projectPath = entry
      const reports = (readJson(entry).artifacts || []).filter(item => item.report)
      if (reports.length !== 1) throw new Error('Select a PBIP project with exactly one report reference.')
      inspectReport(path.join(relativeReference(path.dirname(entry), reports[0].report.path), 'definition.pbir'))
    } else if (entry.toLowerCase().endsWith('.pbir')) inspectReport(entry)
    else throw new Error('Select a .pbip file, .pbir file or semantic-model folder.')
  }
  modelPath = fs.realpathSync(modelPath)
  readJson(path.join(modelPath, 'definition.pbism'))
  const format = fs.existsSync(path.join(modelPath, 'definition', 'model.tmdl')) ? 'tmdl'
    : fs.existsSync(path.join(modelPath, 'model.bim')) ? 'bim' : null
  if (!format) throw new Error('The model has no definition/model.tmdl or model.bim. Live model-reference projects are not supported by this folder reader.')
  return {
    kind: 'local-pbip', projectPath, reportPath, modelPath, format,
    modelId: `local:${crypto.createHash('sha256').update(process.platform === 'win32' ? modelPath.toLowerCase() : modelPath).digest('hex')}`,
    name: path.basename(modelPath).replace(/\.(SemanticModel|Dataset)$/i, ''),
  }
}

function partPath(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes(':') || value.includes('\0') || value.startsWith('/')) throw new Error('Invalid report part path.')
  const segments = value.split('/')
  if (segments.some(s => !s || s === '.' || s === '..' || /[. ]$/.test(s) || /[<>"|?*]/.test(s) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(s))) throw new Error('Invalid report part path.')
  return segments.join(path.sep)
}

// Low-level writer only: callers must supply an already validated, complete
// report definition and resolved model binding. No queries, model edits or
// publication are performed by saving local files.
function writeLocalProject({ destination, reportParts, sourceSpec }) {
  if (!path.isAbsolute(destination || '')) throw new Error('Choose an absolute destination folder.')
  if (!Array.isArray(reportParts)) throw new Error('Report parts are required.')
  const seen = new Set()
  const files = reportParts.map(part => {
    const name = partPath(part.path)
    if (seen.has(name.toLowerCase())) throw new Error(`Duplicate report part: ${part.path}`)
    seen.add(name.toLowerCase())
    let bytes
    if (typeof part.content === 'string') bytes = Buffer.from(part.content, 'utf8')
    else if (part.payloadType === 'InlineBase64' && typeof part.payload === 'string' && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(part.payload)) bytes = Buffer.from(part.payload, 'base64')
    else throw new Error(`Invalid report part content: ${part.path}`)
    return { name, bytes }
  })
  const binding = files.find(f => f.name === 'definition.pbir')
  if (!binding) throw new Error('Report is missing definition.pbir.')
  const definition = JSON.parse(binding.bytes.toString('utf8'))
  const reference = definition.datasetReference
  if (!!reference?.byPath === !!reference?.byConnection) throw new Error('Report must have exactly one semantic-model reference.')
  if (!files.some(f => f.name === path.join('definition', 'report.json')) || !files.some(f => f.name === path.join('definition', 'version.json'))) {
    throw new Error('A complete enhanced PBIR report definition is required.')
  }
  if (reference.byPath) {
    const model = relativeReference(path.join(destination, 'Report'), reference.byPath.path)
    readJson(path.join(model, 'definition.pbism'))
  } else if (typeof reference.byConnection.connectionString !== 'string' || !reference.byConnection.connectionString.trim()) {
    throw new Error('A published semantic-model connection string is required.')
  }
  const snapshot = sourceSpec == null ? null : JSON.stringify(sourceSpec, null, 2)
  // An exclusive folder reservation avoids replacing existing user projects.
  fs.mkdirSync(destination)
  try {
    for (const file of files) {
      const target = path.join(destination, 'Report', file.name)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, file.bytes, { flag: 'wx' })
    }
    if (snapshot !== null) fs.writeFileSync(path.join(destination, 'vilsem-source.json'), snapshot, { flag: 'wx' })
    fs.writeFileSync(path.join(destination, '.gitignore'), '**/.pbi/localSettings.json\n**/.pbi/cache.abf\n', { flag: 'wx' })
    // The entry point is written last: incomplete output is never presented as
    // a successfully saved project. A failure leaves evidence, never deletes.
    const projectPath = path.join(destination, 'Report.pbip')
    fs.writeFileSync(projectPath, JSON.stringify({ version: '1.0', artifacts: [{ report: { path: 'Report' } }], settings: { enableAutoRecovery: true } }, null, 2), { flag: 'wx' })
    return { projectPath, reportPath: path.join(destination, 'Report', 'definition.pbir') }
  } catch (error) {
    throw new Error(`Local export incomplete at ${destination}: ${error.message}`)
  }
}

function saveBoundReport({ destination, reportParts, sourceSpec, connection }) {
  if (!connection?.datasetId) throw new Error('Connect a semantic model before saving a Power BI report.')
  let datasetReference
  if (connection.kind === 'local-pbip') {
    const source = inspectLocalProject(connection.localSource?.projectPath || connection.localSource?.modelPath)
    if (source.modelId !== connection.datasetId) throw new Error('Local model identity changed. Reconnect before exporting.')
    const relative = path.relative(path.join(destination, 'Report'), source.modelPath)
    if (path.isAbsolute(relative)) throw new Error('Save the report on the same drive as the local semantic model.')
    datasetReference = { byPath: { path: relative.split(path.sep).join('/') } }
  } else {
    if (!connection.workspaceName || !connection.datasetName || String(connection.datasetId).startsWith('local:')) throw new Error('A complete Fabric connection is required.')
    const quote = value => '"' + String(value).replace(/"/g, '""') + '"'
    datasetReference = { byConnection: { connectionString: `Data Source=${quote('powerbi://api.powerbi.com/v1.0/myorg/' + connection.workspaceName)};Initial Catalog=${quote(connection.datasetName)};Integrated Security=ClaimsToken;semanticmodelid=${quote(connection.datasetId)}` } }
  }
  if (reportParts.some(p => p.path === 'definition.pbir')) throw new Error('The model binding must be supplied by the active connection.')
  return writeLocalProject({ destination, sourceSpec, reportParts: [
    { path: 'definition.pbir', content: JSON.stringify({ $schema: 'https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/2.0.0/schema.json', version: '4.0', datasetReference }, null, 2) },
    ...reportParts,
  ] })
}

module.exports = { inspectLocalProject, writeLocalProject, saveBoundReport }
