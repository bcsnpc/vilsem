// dax.js — build a standalone EVALUATE query for a vilsem App-Spec visual.
//
// READ-ONLY MIRROR of src/routes/preview.js `buildTableDAX` + src/fabric/translator.js
// helpers. Deliberately DUPLICATED (not imported) so the Electron main process /
// Fabric-export path stays decoupled from the Fastify route module and its deps —
// behaviour matches those builders. No existing file is modified by this.
//
// Output is a standalone `EVALUATE …` (SUMMARIZECOLUMNS / TOPN) executed by the
// deployed Rayfin app via the Execute Queries REST API — the same query shape
// vilsem's web export runs today.

// "Table[Column]" → "'Table'[Column]"
function colRef(tableCol) {
  const m = String(tableCol).match(/^(.+?)\[(.+)\]$/)
  return m ? `'${m[1]}'[${m[2]}]` : String(tableCol)
}

// { table, column } → "Table[Column]"
function fromDim(dim) {
  return dim && dim.table && dim.column ? `${dim.table}[${dim.column}]` : null
}

function daxLiteral(v) {
  if (typeof v === 'number') return String(v)
  return `"${String(v).replace(/"/g, '""')}"`
}

// "Table[Col]" + value → FILTER('Table', 'Table'[Col] = <lit>)
function filterExpr(key, value) {
  const m = String(key).match(/^(.+?)\[(.+)\]$/)
  if (!m) return null
  return `FILTER('${m[1]}', ${colRef(key)} = ${daxLiteral(value)})`
}

// Column NAMES the query returns (bracket-free), used to map result rows → ECharts.
function resultColumns(visual) {
  const data = visual.data || {}
  const gb = data.groupBy && data.groupBy.column ? data.groupBy.column
    : (Array.isArray(data.dimensions) && data.dimensions[0] ? data.dimensions[0].column : null)
  const measures = Array.isArray(data.measures) ? data.measures : []
  return { category: gb, measures }
}

// Build the standalone EVALUATE for a visual (App-Spec `visual.data.*` shape).
function buildVisualDax(visual) {
  const data = visual.data || {}
  const measures = Array.isArray(data.measures) ? data.measures : []
  const gb = data.groupBy && data.groupBy.table ? fromDim(data.groupBy)
    : (Array.isArray(data.dimensions) && data.dimensions[0] ? fromDim(data.dimensions[0]) : null)

  const filters = {}
  for (const f of (data.filters || [])) {
    if (f && f.table && f.column && f.value != null) filters[`${f.table}[${f.column}]`] = f.value
  }
  const filterParts = Object.entries(filters).map(([k, v]) => filterExpr(k, v)).filter(Boolean)
  const measureParts = measures.map(m => `"${m}", [${m}]`)

  // Scalar / KPI — no groupBy.
  if (!gb) {
    return `EVALUATE SUMMARIZECOLUMNS(\n  ${[...filterParts, ...measureParts].join(',\n  ')}\n)`
  }

  // Grouped (bar/line/donut/…) — mirror of buildTableDAX (SUMMARIZECOLUMNS + TOPN).
  const limit = Number(data.limit) || 100
  const order = String((typeof data.orderBy === 'string' ? data.orderBy : data.orderBy?.dir) || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC'
  const args = [colRef(gb), ...filterParts, ...measureParts]
  const summary = `SUMMARIZECOLUMNS(\n  ${args.join(',\n  ')}\n)`
  const sortMeasure = measures[0]
  return `EVALUATE\nTOPN(${limit}, ${summary}, [${sortMeasure}], ${order}, ${colRef(gb)}, ASC)\nORDER BY [${sortMeasure}] ${order}, ${colRef(gb)} ASC`
}

module.exports = { buildVisualDax, resultColumns, colRef, fromDim }
