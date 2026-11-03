const identifier = value => `[${String(value).replace(/\]/g, ']]')}]`
const table = value => `'${String(value).replace(/'/g, "''")}'`
const alias = value => `"${String(value).replace(/"/g, '""')}"`

// Structured bindings avoid ambiguous parsing and keep preview evaluation at the
// same semantic-model grain as the report's direct field bindings.
export function buildVisualDax({ dimensions = [], measures = [], maxRows = 200 }) {
  if (!measures.length || measures.some(field=>!field.table || !field.name)) throw Error('At least one fully qualified measure binding is required')
  if (!Number.isInteger(maxRows) || maxRows < 1 || maxRows > 10000) throw Error('maxRows must be between 1 and 10000')
  if (dimensions.some(field=>!field.table || !field.column)) throw Error('Every dimension requires a table and column')
  const groups = dimensions.map(field=>`${table(field.table)}${identifier(field.column)}`)
  const values = measures.map(field=>`${alias(field.name)}, ${table(field.table)}${identifier(field.name)}`)
  const summary = `SUMMARIZECOLUMNS(${[...groups,...values].join(', ')})`
  // Category ordering preserves time-series chronology; the shared row-preparation
  // boundary applies value ordering for ranked visual compositions afterwards.
  return groups.length ? `EVALUATE TOPN(${maxRows}, ${summary}, ${groups.map(ref=>`${ref}, ASC`).join(', ')})\nORDER BY ${groups.map(ref=>`${ref} ASC`).join(', ')}` : `EVALUATE ${summary}`
}
