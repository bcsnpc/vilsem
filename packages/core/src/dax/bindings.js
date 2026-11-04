const identifier = value => `[${String(value).replace(/\]/g, ']]')}]`
const table = value => `'${String(value).replace(/'/g, "''")}'`
const alias = value => `"${String(value).replace(/"/g, '""')}"`

import { compileScopedMeasures } from './scopedMeasures.js'

// Structured bindings avoid ambiguous parsing and keep preview evaluation at the
// same semantic-model grain as the report's direct field bindings.
export function buildVisualDax({ dimensions = [], measures = [], maxRows = 200, scopedMeasures = {}, schema }) {
  if (!measures.length || measures.some(field=>!field.table || !field.name)) throw Error('At least one fully qualified measure binding is required')
  if (!Number.isInteger(maxRows) || maxRows < 1 || maxRows > 10000) throw Error('maxRows must be between 1 and 10000')
  if (dimensions.some(field=>!field.table || !field.column)) throw Error('Every dimension requires a table and column')
  const groups = dimensions.map(field=>`${table(field.table)}${identifier(field.column)}`)
  const scoped = compileScopedMeasures(scopedMeasures, {schema,homeTable:measures[0].table})
  for(const field of measures)if(scoped.expression(field.name)!==undefined && field.table.toLowerCase()!==measures[0].table.toLowerCase())throw Error('All visual-scoped measure bindings must use the first measure binding table')
  const values = measures.map(field=>`${alias(field.name)}, ${table(field.table)}${identifier(field.name)}`)
  const summary = `SUMMARIZECOLUMNS(${[...groups,...values].join(', ')})`
  // Category ordering preserves time-series chronology; the shared row-preparation
  // boundary applies value ordering for ranked visual compositions afterwards.
  const query = groups.length ? `EVALUATE TOPN(${maxRows}, ${summary}, ${groups.map(ref=>`${ref}, ASC`).join(', ')})\nORDER BY ${groups.map(ref=>`${ref} ASC`).join(', ')}` : `EVALUATE ${summary}`
  return scoped.define + query
}
