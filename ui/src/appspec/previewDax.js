// Pure frontend mirror of the backend DAX builders — used ONLY to DISPLAY the
// resolved query in the Data-preview pane. Never executed. Mirrors:
//   • src/fabric/translator.js  (buildColumnReference / buildFilterExpression / translateToDAX)
//   • electron/ipc/query.js      (buildTableDAX)
// If those change, update here. Kept dependency-free so it can't do I/O.

function parseFilterKey(key) {
  const m = /^(.+)\[(.+)\]$/.exec(String(key))
  if (!m) return { table: String(key), column: '' }
  return { table: m[1], column: m[2] }
}

function buildColumnReference(key) {
  const { table, column } = parseFilterKey(key)
  return `'${table}'[${column}]`
}

function escapeDaxString(v) { return String(v).replace(/"/g, '""') }

function formatDaxLiteral(value) {
  if (value === null || value === undefined || value === '') return 'BLANK()'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'BLANK()'
  if (typeof value === 'boolean') return value ? 'TRUE()' : 'FALSE()'
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `DATEVALUE("${escapeDaxString(value)}")`
    return `"${escapeDaxString(value)}"`
  }
  return `"${escapeDaxString(JSON.stringify(value))}"`
}

function buildFilterExpression(key, value) {
  const { table } = parseFilterKey(key)
  const ref = buildColumnReference(key)
  if (Array.isArray(value)) {
    const values = value.filter(v => v !== null && v !== undefined && v !== '')
    if (!values.length) return null
    return `FILTER('${table}', ${ref} IN { ${values.map(formatDaxLiteral).join(', ')} })`
  }
  if (value && typeof value === 'object') {
    if (Object.prototype.hasOwnProperty.call(value, 'from') || Object.prototype.hasOwnProperty.call(value, 'to')) {
      const clauses = []
      if (value.from != null && value.from !== '') clauses.push(`${ref} >= ${formatDaxLiteral(value.from)}`)
      if (value.to != null && value.to !== '') clauses.push(`${ref} <= ${formatDaxLiteral(value.to)}`)
      if (!clauses.length) return null
      return `FILTER('${table}', ${clauses.join(' && ')})`
    }
  }
  return `FILTER('${table}', ${ref} = ${formatDaxLiteral(value)})`
}

// Mirror of electron/ipc/query.js buildTableDAX — grouped (bar / line / table).
export function buildTablePreviewDax(groupBy, measures, filters = {}, limit = 100, orderBy = 'desc') {
  if (!groupBy?.length || !measures?.length) return ''
  const order = String(orderBy || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC'
  const groupCols = groupBy.map(col => buildColumnReference(col))
  const filterParts = Object.entries(filters).map(([k, v]) => buildFilterExpression(k, v)).filter(Boolean)
  const measureParts = measures.map(m => `"${m}", [${m}]`)
  const args = [...groupCols, ...filterParts, ...measureParts]
  const summary = `SUMMARIZECOLUMNS(\n  ${args.join(',\n  ')}\n)`
  const sortMeasure = measures[0]
  const sortColumn = groupCols[0]
  return `EVALUATE\nTOPN(${limit}, ${summary}, [${sortMeasure}], ${order}, ${sortColumn}, ASC)\nORDER BY [${sortMeasure}] ${order}, ${sortColumn} ASC`
}

// Mirror of src/fabric/translator.js translateToDAX — scalar KPI (no grouping).
export function buildScalarPreviewDax(measures, filters = {}) {
  if (!measures?.length) return ''
  const filterParts = Object.entries(filters).map(([k, v]) => buildFilterExpression(k, v)).filter(Boolean)
  const measureParts = measures.map(m => `"${m}", [${m}]`)
  const args = [...filterParts, ...measureParts]
  return `EVALUATE SUMMARIZECOLUMNS(\n  ${args.join(',\n  ')}\n)`
}
