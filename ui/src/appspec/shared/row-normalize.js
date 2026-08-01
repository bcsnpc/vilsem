// Fabric row-shape helpers — normalize raw dataset responses into the
// `{ _cat, _val, _val2 }` shape every Compact* component expects.
// Verbatim extract from AppSpecRenderer.jsx (pre-Phase-1).

// Extract a scalar value from query() response, handling both response formats
export function getScalarValue(result, measureName) {
  if (!result || !measureName) return null
  // Format 1: { data: { 'Measure Name': 123 } }  ← window.semantica.query()
  if (result.data && result.data[measureName] !== undefined) return result.data[measureName]
  // Format 2: { rows: [{ 'Measure Name': 123 }] }  ← fallback
  if (result.rows?.[0]) {
    const row = result.rows[0]
    if (row[measureName] !== undefined) return row[measureName]
    // last resort: first numeric value in the row
    const numVal = Object.values(row).find(v => typeof v === 'number')
    if (numVal !== undefined) return numVal
  }
  return null
}

export function extractColumnName(columnRef) {
  const match = String(columnRef || '').match(/\[([^\]]+)\]$/)
  return match ? match[1] : String(columnRef || '')
}

export function getFilterValueKey(value) {
  if (value == null) return ''
  if (typeof value === 'object') {
    const from = value.from ?? ''
    const to = value.to ?? ''
    return `range:${from}|${to}`
  }
  return `${typeof value}:${String(value)}`
}

export function sortFilterValues(values) {
  const items = [...values]
  if (items.every(v => typeof v === 'number')) return items.sort((a, b) => a - b)
  return items.sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }))
}

export function resolveMeasureKey(row, measureName) {
  if (!row || !measureName) return measureName
  const keys = Object.keys(row)
  if (keys.includes(measureName)) return measureName
  const bracketed = `[${measureName}]`
  if (keys.includes(bracketed)) return bracketed
  return keys.find(k => k.endsWith(`[${measureName}]`) || k.endsWith(measureName)) || measureName
}

// Resolve the actual row key that Fabric used for a column reference
// Fabric can return "Table[Column]", "Column", or "[Table[Column]]"
export function resolveRowKey(rows, columnRef) {
  if (!rows?.length || !columnRef) return columnRef
  const sample = rows[0]
  const keys = Object.keys(sample)
  const columnName = extractColumnName(columnRef)
  const candidates = [columnRef, `[${columnRef}]`, columnName, `[${columnName}]`]
  for (const key of candidates) {
    if (keys.includes(key)) return key
  }
  // Try column-only: "Product[ProductName]" → "ProductName"
  const suffixMatch = keys.find(k => k.endsWith(`[${columnName}]`) || k.endsWith(`.${columnName}`))
  if (suffixMatch) return suffixMatch
  // Try first string-valued key (likely the category)
  const strKey = keys.find(k => typeof sample[k] === 'string' || typeof sample[k] === 'number')
  return strKey || columnRef
}

// Normalise raw Fabric rows for a multi-dimension table visual.
// Returns { _cat, _cat2, _cats[], _val, _val2, _val3, _vals[] } per row.
export function normaliseTableRows(rawRows, dimensionRefs, measures) {
  if (!rawRows?.length) return []
  const dimKeys = dimensionRefs.map(ref => resolveRowKey(rawRows, ref))
  const dimLabels = dimensionRefs.map(ref => extractColumnName(ref) || ref)
  const rows = rawRows.map(r => {
    const cats = dimKeys.map(key => {
      const v = r[key]
      if (v != null) return String(v)
      const colName = extractColumnName(key)
      const v2 = r[colName]
      return v2 != null ? String(v2) : ''
    })
    const vals = measures.map(m => {
      const key = resolveMeasureKey(r, m)
      return key ? (r[key] ?? null) : null
    })
    return {
      _cat:  cats[0] ?? '',
      _cat2: cats[1] ?? null,
      _cats: cats,
      _val:  vals[0] ?? null,
      _val2: vals[1] ?? null,
      _val3: vals[2] ?? null,
      _vals: vals,
    }
  })
  // Embed column labels on first row so the component can read them
  // regardless of which chartConfig injection path was used.
  if (rows.length) {
    rows[0]._dimLabels = dimLabels
    rows[0]._measureLabels = measures
  }
  return rows
}

// Normalise raw Fabric rows into { _cat, _val, _val2, _val3 } shape
export function normaliseRows(rawRows, groupByRef, measures) {
  if (!rawRows?.length) return []
  return rawRows.map(r => {
    // _cat: the groupBy column value
    let cat = null
    if (groupByRef) {
      cat = r[groupByRef]
      if (cat == null) {
        // try just column name
        const colName = extractColumnName(groupByRef)
        cat = r[colName]
      }
      if (cat == null) {
        // last resort: first non-measure key
        const resolvedMeasureKeys = measures.map(m => resolveMeasureKey(r, m))
        const nonMeasureKey = Object.keys(r).find(k => !resolvedMeasureKeys.includes(k))
        cat = nonMeasureKey ? r[nonMeasureKey] : null
      }
    }
    const primaryMeasureKey   = resolveMeasureKey(r, measures[0])
    const secondaryMeasureKey = measures[1] ? resolveMeasureKey(r, measures[1]) : null
    const tertiaryMeasureKey  = measures[2] ? resolveMeasureKey(r, measures[2]) : null
    return {
      _cat:  cat != null ? String(cat) : '',
      _val:  primaryMeasureKey   ? (r[primaryMeasureKey]   ?? null) : null,
      _val2: secondaryMeasureKey ? (r[secondaryMeasureKey] ?? null) : null,
      _val3: tertiaryMeasureKey  ? (r[tertiaryMeasureKey]  ?? null) : null,
    }
  })
}
