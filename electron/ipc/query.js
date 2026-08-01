const { ipcMain } = require('electron/main')
const { translateToDAX, buildFilterExpression, parseFilterKey, buildColumnReference } = require('../../src/fabric/translator')
const { executeQuery, executeQueryMulti } = require('../../src/fabric/client')
const { buildCacheKey, cacheGet, cacheSet, saveRegistryMeasure, cacheDistinctValues, getCachedDistinctValues } = require('../../src/cache/sqlite')
const { validateMeasures, getMeasureTable } = require('../../src/fabric/metadata')
const { rateLimitedCall } = require('../../src/queue/limiter')
const { logQuery } = require('../../src/audit/log')

// ── Self-healing DAX ──────────────────────────────────────────────────────────

const ERROR_TAXONOMY = {
  'single value for column': {
    hint: 'Wrap the column reference with MAX(), MIN(), or SELECTEDVALUE() since it is used in a scalar context.',
    type: 'aggregation',
  },
  'refers to multiple columns': {
    hint: 'Use SUMMARIZECOLUMNS instead of SUMMARIZE for grouping operations.',
    type: 'summarize',
  },
  'more than one result table': {
    hint: 'Return only a single EVALUATE block — do not use multiple EVALUATE statements.',
    type: 'multiple_tables',
  },
  'ambiguous': {
    hint: 'Multiple relationship paths exist. Specify the exact path using USERELATIONSHIP().',
    type: 'ambiguous_relationship',
  },
  'row limit': {
    hint: 'Result set is too large. Wrap in TOPN(10000, ...) to limit rows.',
    type: 'row_limit',
  },
  'unknown identifier': {
    hint: 'A table or column name is incorrect. Verify the exact name from the model schema.',
    type: 'unknown_identifier',
  },
  'cannot find name': {
    hint: 'A measure or column name was not found. Use only exact names from the model.',
    type: 'name_error',
  },
}

function classifyFabricError(errorMessage) {
  const msg = (errorMessage || '').toLowerCase()
  for (const [pattern, info] of Object.entries(ERROR_TAXONOMY)) {
    if (msg.includes(pattern)) return info
  }
  return { hint: 'Verify all column, table, and measure names exist in the model.', type: 'unknown' }
}

function extractFabricErrorMessage(err) {
  // HTTP 400 — error in response body
  if (err.response?.data?.error?.message) return err.response.data.error.message
  // Some Fabric errors surface inside results[].error
  return err.message || 'Unknown Fabric error'
}

/**
 * Wraps a Fabric query execution with self-healing (up to 2 repair attempts).
 * repairFn: async (prompt: string) => string (repaired DAX)
 * Falls back gracefully if no repairFn is available.
 */
async function executeWithHealing(daxQuery, executeFn, repairFn) {
  let currentDax = daxQuery
  const maxAttempts = repairFn ? 3 : 1  // original + 2 repairs, or just 1 if no LLM

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await executeFn(currentDax)
    } catch (err) {
      const errorMsg  = extractFabricErrorMessage(err)
      const taxonomy  = classifyFabricError(errorMsg)

      console.warn(`[query] DAX attempt ${attempt + 1} failed (${taxonomy.type}): ${errorMsg.slice(0, 120)}`)

      if (attempt >= maxAttempts - 1 || !repairFn) {
        // Final attempt failed — throw user-friendly message
        throw Object.assign(
          new Error(
            'Semantica could not resolve this data combination. ' +
            'The measure may not be filterable by the selected dimension. ' +
            'Try a different filter or measure combination.'
          ),
          { code: err.code || 'FABRIC_ERROR', originalError: errorMsg }
        )
      }

      try {
        const repairPrompt =
          `You generated a DAX query that failed on Microsoft Fabric.\n\n` +
          `<Original_Query>\n${currentDax}\n</Original_Query>\n\n` +
          `<Fabric_Error>\n${errorMsg}\n</Fabric_Error>\n\n` +
          `<Diagnostic_Hint>\n${taxonomy.hint}\n</Diagnostic_Hint>\n\n` +
          `Return ONLY the corrected DAX query. No explanation. No markdown. Just DAX.`
        currentDax = await repairFn(repairPrompt)
        console.log(`[query] DAX repair attempt ${attempt + 1}:`, currentDax.slice(0, 120))
      } catch (repairErr) {
        console.warn('[query] DAX repair LLM call failed:', repairErr.message)
        throw err  // re-throw original error
      }
    }
  }
}

// ── Query stats ───────────────────────────────────────────────────────────────
let statsQueriesRequested = 0
let statsFabricCallsMade  = 0
let statsBatchSavings     = 0

function getQueryStats() {
  return {
    queriesRequested: statsQueriesRequested,
    fabricCallsMade:  statsFabricCallsMade,
    batchSavings:     statsBatchSavings,
  }
}

// ── Request coalescing ────────────────────────────────────────────────────────
// Collect all query() IPC calls within a 10ms window. Group by identical
// filters and combine into one SUMMARIZECOLUMNS DAX call per group.

const COALESCE_MS = 10
let pendingBatch  = []   // { id, params, resolve }[]
let coalesceTimer = null

function handleQuery(params) {
  const { measures, filters = {} } = params || {}

  // Validate synchronously — invalid calls never enter the coalesce queue
  if (!measures || !Array.isArray(measures) || measures.length === 0) {
    return Promise.resolve({ error: 'VALIDATION_ERROR', message: 'measures is required and must be a non-empty array' })
  }
  for (const key of Object.keys(filters)) {
    if (!key.match(/^[^[]+\[[^\]]+\]$/)) {
      return Promise.resolve({ error: 'INVALID_FILTER', message: `Invalid filter key "${key}". Expected format: TableName[ColumnName]` })
    }
  }
  const validation = validateMeasures(measures)
  if (!validation.valid) {
    return Promise.resolve({ error: validation.error.code, message: validation.error.message })
  }

  statsQueriesRequested++
  return new Promise((resolve) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`
    pendingBatch.push({ id, params: { ...params, filters }, resolve })
    if (!coalesceTimer) {
      coalesceTimer = setTimeout(flushBatch, COALESCE_MS)
    }
  })
}

async function flushBatch() {
  const batch = pendingBatch
  pendingBatch   = []
  coalesceTimer  = null
  if (batch.length === 0) return

  const datasetId = process.env.FABRIC_DATASET_ID
  const results   = {}
  const misses    = []

  // Pass 1: cache hits
  for (const item of batch) {
    const { measures, filters } = item.params
    const start    = Date.now()
    const cacheKey = buildCacheKey(datasetId, measures, filters)
    const cached   = cacheGet(cacheKey)
    if (cached) {
      logQuery({ measures, filters, source: 'cache', queryMs: Date.now() - start })
      results[item.id] = {
        data: cached.value,
        source: 'cache',
        cachedAt: cached.cachedAt,
        cacheExpiresAt: cached.expiresAt,
        queryMs: Date.now() - start,
      }
    } else {
      misses.push(item)
    }
  }

  // Pass 2: group misses by identical filters → one Fabric call per group
  if (misses.length > 0) {
    const groups = new Map()
    for (const item of misses) {
      const f  = item.params.filters || {}
      const fk = JSON.stringify(Object.keys(f).sort().reduce((a, k) => { a[k] = f[k]; return a }, {}))
      if (!groups.has(fk)) groups.set(fk, { filters: f, items: [] })
      groups.get(fk).items.push(item)
    }

    for (const [, group] of groups) {
      const groupStart  = Date.now()
      const allMeasures = [...new Set(group.items.flatMap(i => i.params.measures))]

      try {
        const dax         = translateToDAX(allMeasures, group.filters)
        const rawData     = await rateLimitedCall(() => executeQuery(dax))
        const { queryPath, ...data } = rawData
        statsFabricCallsMade++

        // Every coalesced item beyond the first is a saved call
        if (group.items.length > 1) statsBatchSavings += group.items.length - 1

        for (const item of group.items) {
          const qData    = {}
          for (const m of item.params.measures) qData[m] = data[m] ?? null
          const cacheTtl = Number(item.params.ttl) || parseInt(process.env.DEFAULT_TTL, 10) || 300
          const { cachedAt, expiresAt } = cacheSet(
            buildCacheKey(datasetId, item.params.measures, item.params.filters),
            qData, cacheTtl,
          )
          const queryMs = Date.now() - groupStart
          logQuery({ measures: item.params.measures, filters: item.params.filters, source: 'fabric', queryMs })
          for (const m of item.params.measures) saveRegistryMeasure(datasetId, m, getMeasureTable(m))
          results[item.id] = { data: qData, source: 'fabric', cachedAt, cacheExpiresAt: expiresAt, queryMs }
        }
      } catch (err) {
        statsFabricCallsMade++
        const code         = err.code || 'FABRIC_ERROR'
        const msg          = err.message || 'Unknown error'
        const isMeasureErr = msg.toLowerCase().includes('not found') ||
          msg.toLowerCase().includes('unknown identifier') ||
          msg.toLowerCase().includes('failed to execute the dax query') ||
          err.status === 400
        for (const item of group.items) {
          results[item.id] = {
            error:   isMeasureErr ? 'MEASURE_NOT_FOUND' : code,
            message: isMeasureErr ? 'Measure not found. Check measure name and try again.' : msg,
          }
        }
      }
    }
  }

  // Resolve every waiting promise
  for (const item of batch) {
    item.resolve(results[item.id] || { error: 'FABRIC_ERROR', message: 'No result produced' })
  }
}

// ── Batch IPC handler ─────────────────────────────────────────────────────────

async function handleBatch({ queries } = {}) {
  if (!queries || !Array.isArray(queries) || queries.length === 0) {
    return { error: 'VALIDATION_ERROR', message: 'queries must be a non-empty array' }
  }

  const datasetId  = process.env.FABRIC_DATASET_ID
  const results    = {}
  let fabricCallsMade = 0
  const totalStart = Date.now()
  const cacheMisses = []

  statsQueriesRequested += queries.length

  for (const q of queries) {
    const start    = Date.now()
    const filters  = q.filters || {}
    const cacheKey = buildCacheKey(datasetId, q.measures, filters)
    const cached   = cacheGet(cacheKey)
    if (cached) {
      logQuery({ measures: q.measures, filters, source: 'cache', queryMs: Date.now() - start })
      results[q.id] = { data: cached.value, source: 'cache', queryMs: Date.now() - start }
    } else {
      cacheMisses.push(q)
    }
  }

  const groups = new Map()
  for (const q of cacheMisses) {
    const f  = q.filters || {}
    const fk = JSON.stringify(Object.keys(f).sort().reduce((a, k) => { a[k] = f[k]; return a }, {}))
    if (!groups.has(fk)) groups.set(fk, { filters: f, queries: [] })
    groups.get(fk).queries.push(q)
  }

  for (const [, group] of groups) {
    const start       = Date.now()
    const allMeasures = [...new Set(group.queries.flatMap(q => q.measures))]
    try {
      const dax     = translateToDAX(allMeasures, group.filters)
      const rawData = await rateLimitedCall(() => executeQuery(dax))
      const { queryPath, ...data } = rawData
      fabricCallsMade++
      statsFabricCallsMade++
      if (group.queries.length > 1) statsBatchSavings += group.queries.length - 1

      for (const q of group.queries) {
        const qData    = {}
        for (const m of q.measures) qData[m] = data[m] ?? null
        const cacheTtl = Number(q.ttl) || parseInt(process.env.DEFAULT_TTL, 10) || 300
        cacheSet(buildCacheKey(datasetId, q.measures, q.filters || {}), qData, cacheTtl)
        const queryMs = Date.now() - start
        logQuery({ measures: q.measures, filters: q.filters || {}, source: 'fabric', queryMs })
        for (const m of q.measures) saveRegistryMeasure(datasetId, m, getMeasureTable(m))
        results[q.id] = { data: qData, source: 'fabric', queryMs }
      }
    } catch (err) {
      for (const q of group.queries) {
        results[q.id] = { error: err.code || 'FABRIC_ERROR', message: err.message }
      }
    }
  }

  return { results, fabricCallsMade, totalMs: Date.now() - totalStart }
}

// ── Register ──────────────────────────────────────────────────────────────────

function buildTableDAX(groupBy, measures, filters = {}, limit = 100, orderBy = 'desc') {
  const order = String(orderBy || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC'
  const groupCols = groupBy.map(col => buildColumnReference(col))
  const filterParts = Object.entries(filters)
    .map(([key, val]) => buildFilterExpression(key, val))
    .filter(Boolean)
  const measureParts = measures.map(m => `"${m}", [${m}]`)
  const args = [...groupCols, ...filterParts, ...measureParts]
  const summary = `SUMMARIZECOLUMNS(\n  ${args.join(',\n  ')}\n)`
  const sortMeasure = measures[0]
  const sortColumn = groupCols[0]
  return `EVALUATE\nTOPN(${limit}, ${summary}, [${sortMeasure}], ${order}, ${sortColumn}, ASC)\nORDER BY [${sortMeasure}] ${order}, ${sortColumn} ASC`
}

function buildDistinctValuesDAX(columnRef, limit = 100) {
  const ref = buildColumnReference(columnRef)
  return `EVALUATE TOPN(${limit}, VALUES(${ref}), ${ref}, ASC)`
}

async function handleQueryTable({ groupBy, measures, filters = {}, limit = 100, orderBy = 'desc' } = {}) {
  if (!groupBy || !Array.isArray(groupBy) || groupBy.length === 0) {
    return { error: 'VALIDATION_ERROR', message: 'groupBy must be a non-empty array' }
  }
  if (!measures || !Array.isArray(measures) || measures.length === 0) {
    return { error: 'VALIDATION_ERROR', message: 'measures must be a non-empty array' }
  }
  try {
    const dax      = buildTableDAX(groupBy, measures, filters, limit, orderBy)
    const repairFn = global.semanticaDaxRepairFn || null
    const rows     = await executeWithHealing(
      dax,
      (d) => rateLimitedCall(() => executeQueryMulti(d)),
      repairFn
    )
    return { rows, total: rows.length }
  } catch (err) {
    return { error: err.code || 'FABRIC_ERROR', message: err.message }
  }
}

async function handleGetDistinctValues({ column, limit = 100 } = {}) {
  if (!column || typeof column !== 'string') {
    return { error: 'VALIDATION_ERROR', message: 'column is required and must be in Table[Column] format' }
  }

  try {
    parseFilterKey(column)
    const datasetId = process.env.FABRIC_DATASET_ID || 'default'
    const cached = getCachedDistinctValues(column, datasetId)
    if (Array.isArray(cached) && cached.length > 0) {
      return { values: cached.slice(0, limit) }
    }

    const dax = buildDistinctValuesDAX(column, limit)
    const repairFn = global.semanticaDaxRepairFn || null
    const rows = await executeWithHealing(
      dax,
      (d) => rateLimitedCall(() => executeQueryMulti(d)),
      repairFn
    )
    const { column: columnName } = parseFilterKey(column)
    const values = (rows || [])
      .map(row => row[column] ?? row[columnName] ?? Object.values(row)[0])
      .filter(value => value !== null && value !== undefined && value !== '')

    if (values.length > 0) cacheDistinctValues(column, datasetId, values)
    return { values }
  } catch (err) {
    return { error: err.code || 'FABRIC_ERROR', message: err.message }
  }
}

function register() {
  ipcMain.handle('query',       (_e, params) => handleQuery(params))
  ipcMain.handle('batch',       (_e, params) => handleBatch(params))
  ipcMain.handle('query-table', (_e, params) => handleQueryTable(params))
  ipcMain.handle('get-distinct-values', (_e, params) => handleGetDistinctValues(params))
}

module.exports = { register, getQueryStats }
