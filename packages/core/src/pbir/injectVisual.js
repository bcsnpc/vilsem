import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import AdmZip from 'adm-zip'
import Ajv from 'ajv'
import { resolveVisualSpec } from '../spec/resolve.js'
import { compileScopedMeasures } from '../dax/scopedMeasures.js'
import { assertReportRenderer } from './rendererCompatibility.js'

export const RENDERER_GUID = 'semanticaRenderer4A7F2D9B8C3E1F5A6D4B2C8E9F1A3B7D'
export const VISUAL_SCHEMA = 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.7.0/schema.json'
const readJson = async file => JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''))
const literal = value => ({ expr: { Literal: { Value: `'${String(value).replace(/'/g, "''")}'` } } })
let validator

export async function validateVisualContainer(value) {
  if (!validator) {
    const cached = JSON.parse(await fs.readFile(new URL('../../schemas/pbir-visual.json', import.meta.url), 'utf8'))
    const ajv = new Ajv({ strict: false, allErrors: true, loadSchema: async url => {
      if (!cached[url]) throw Error(`Unsupported PBIR schema reference: ${url}`)
      return cached[url]
    } })
    validator = await ajv.compileAsync(cached[VISUAL_SCHEMA])
  }
  if (!validator(value)) throw Error(`Invalid PBIR visual: ${JSON.stringify(validator.errors)}`)
  return true
}

function segment(value, label) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) throw Error(`${label} must be a plain PBIR folder name`)
  return value
}

export function makeVisualContainer({ visualName, spec, bindings = {}, layout = {} }) {
  resolveVisualSpec(spec)
  const position = { x: 0, y: 0, width: 800, height: 500, z: 0, tabOrder: 0, ...layout }
  for (const [key, value] of Object.entries(position)) {
    if (!['x','y','width','height','z','tabOrder'].includes(key) || typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw Error(`Invalid layout.${key}`)
  }
  if (!position.width || !position.height) throw Error('Visual width and height must be positive')
  const queryState = {}
  const dimensions = bindings.dimensions || []
  const measures = bindings.measures || []
  const scoped = compileScopedMeasures(spec.measures || {}, {homeTable:measures[0]?.table})
  if (!Array.isArray(dimensions) || dimensions.length > 6 || !Array.isArray(measures) || measures.length > 6) throw Error('Bindings support up to six category levels and six measures')
  const add = (field, index, measure) => {
    const property = measure ? field.name : field.column
    if (!field.table || !property || typeof field.table !== 'string' || typeof property !== 'string') throw Error('Every binding requires a table and field name')
    const role = measure ? ['content','secondary','tertiary','quaternary','quinary','senary'][index] : index ? `category${index+1}` : 'category'
    const expression = measure ? scoped.expression(property) : undefined
    if(expression!==undefined && field.table.toLowerCase()!==measures[0].table.toLowerCase())throw Error('All visual-scoped measure bindings must use the first measure binding table')
    const projection = expression
      ? { NativeMeasure: { Language:'dax', Expression:expression, DataType:3, ProposedName:property, ...(scoped.format(property)!==undefined?{Format:scoped.format(property)}:{}) } }
      : { [measure ? 'Measure' : 'Column']: { Expression: { SourceRef: { Entity: field.table } }, Property: property } }
    queryState[role] = { projections: [{ field:projection, queryRef: expression ? `NativeMeasure(${property})` : `${field.table}.${property}`, nativeQueryRef: property, ...(!measure ? { active:true } : {}) }] }
  }
  dimensions.forEach((field,index)=>add(field,index,false))
  measures.forEach((field,index)=>add(field,index,true))
  return { $schema: VISUAL_SCHEMA, name: segment(visualName,'visualName'), position, visual: { visualType: RENDERER_GUID, query: { queryState }, drillFilterOtherVisuals:true, objects: { semantica: [{ properties: { primitiveSpec: literal(JSON.stringify(spec)) } }] } } }
}

async function rendererParts() {
  const bundle = fileURLToPath(new URL('../../assets/renderer.pbiviz', import.meta.url))
  const zip = new AdmZip(await fs.readFile(bundle))
  const entries = zip.getEntries().filter(entry=>!entry.isDirectory)
  const metadata = entries.find(entry=>entry.entryName === 'package.json')
  if (!metadata || JSON.parse(metadata.getData().toString()).visual?.guid !== RENDERER_GUID) throw Error('Bundled renderer GUID mismatch')
  return entries.map(entry=>{
    const relative = entry.entryName.replace(/\\/g,'/')
    if (relative.startsWith('/') || relative.split('/').some(part=>!part || part==='..' || part==='.') || relative.includes(':')) throw Error('Invalid renderer resource path')
    return { relative, content:entry.getData() }
  })
}

// Changes one new visual and, only when missing, its custom-visual registration.
// Existing report content is never passed through a report builder/serializer.
export async function injectVisual({ reportDir, pageName, visualName, spec, bindings, layout }) {
  const root = await fs.realpath(reportDir)
  const pageDir = path.join(root,'definition','pages',segment(pageName,'pageName'))
  const pageReal = await fs.realpath(pageDir)
  if (!pageReal.startsWith(root+path.sep)) throw Error('Page resolves outside the report')
  await readJson(path.join(pageDir,'page.json'))
  const reportFile = path.join(root,'definition','report.json')
  const reportBytes = await fs.readFile(reportFile)
  const report = JSON.parse(reportBytes.toString('utf8').replace(/^\uFEFF/,''))
  const visual = makeVisualContainer({ visualName,spec,bindings,layout })
  await validateVisualContainer(visual)
  const visualDir = path.join(pageDir,'visuals',visualName)
  const registrationExists = (report.resourcePackages || []).some(item=>item.type==='CustomVisual' && item.name===RENDERER_GUID)
  if (registrationExists) await assertReportRenderer(root,RENDERER_GUID,spec,bindings)
  const parts = registrationExists ? [] : await rendererParts()
  const resourceDir = path.join(root,'CustomVisuals',RENDERER_GUID)
  // Never overwrite another tool's resource directory or any existing visual.
  let madeVisual = false, madeResources = false
  try {
    await fs.mkdir(path.dirname(visualDir),{recursive:true})
    const visualsReal = await fs.realpath(path.dirname(visualDir))
    if (!visualsReal.startsWith(pageReal+path.sep)) throw Error('Visuals folder resolves outside the page')
    await fs.mkdir(visualDir)
    madeVisual = true
    await fs.writeFile(path.join(visualDir,'visual.json'),JSON.stringify(visual,null,2)+'\n',{flag:'wx'})
    if (!registrationExists) {
      await fs.mkdir(path.dirname(resourceDir),{recursive:true})
      const resourcesReal = await fs.realpath(path.dirname(resourceDir))
      if (!resourcesReal.startsWith(root+path.sep)) throw Error('Resources folder resolves outside the report')
      await fs.mkdir(resourceDir)
      madeResources = true
      for (const part of parts) {
        const file = path.join(resourceDir,part.relative)
        await fs.mkdir(path.dirname(file),{recursive:true})
        await fs.writeFile(file,part.content,{flag:'wx'})
      }
      report.resourcePackages ||= []
      report.resourcePackages.push({name:RENDERER_GUID,type:'CustomVisual',items:[{name:`${RENDERER_GUID}.pbiviz.json`,path:`${RENDERER_GUID}.pbiviz.json`,type:'CustomVisualMetadata'}]})
      // Abort if Desktop or another writer changed report.json during validation.
      if (!(await fs.readFile(reportFile)).equals(reportBytes)) throw Error('Report changed during insertion; retry after Desktop finishes saving')
      const temporary = `${reportFile}.vilsem-${process.pid}-${Date.now()}.tmp`
      try {
        await fs.writeFile(temporary,JSON.stringify(report,null,2)+'\n',{flag:'wx'})
        await fs.rename(temporary,reportFile)
      } finally {
        await fs.rm(temporary,{force:true})
      }
    }
    return { path:path.join(visualDir,'visual.json'), rendererRegistered:!registrationExists }
  } catch (error) {
    if (madeVisual) await fs.rm(visualDir,{recursive:true,force:true})
    if (madeResources) await fs.rm(resourceDir,{recursive:true,force:true})
    throw error
  }
}
