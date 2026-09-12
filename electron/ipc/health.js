const { ipcMain, dialog } = require('electron/main')
const fs = require('fs')
const axios = require('axios')
const { getToken, getTokenInfo } = require('../../src/auth/auth')
const {
  getCacheEntryCount, getCacheStats, resetAllData,
  getRegistryMeasures, removeRegistryMeasure, saveRegistryMeasure,
  bulkSaveRegistryMeasures, bulkSaveDimensionTables, getDimensionTables,
} = require('../../src/cache/sqlite')
const { getMeasuresList, getMeasuresInfo, reloadFromRegistry } = require('../../src/fabric/metadata')
const { getLimiterInfo } = require('../../src/queue/limiter')
const { getAuditCounts } = require('../../src/audit/log')
const { getLakehouseInfo } = require('../../src/fabric/lakehouse')
const { getXmlaInfo } = require('../../src/fabric/xmla')
const { getQueryStats } = require('./query')
const { getSavedWorkspacesSafe } = require('./connection')

async function handleGetHealth() {
  const tokenInfo    = getTokenInfo()
  const cacheStats   = getCacheStats()
  const limiterInfo  = getLimiterInfo()
  const auditCounts  = getAuditCounts()
  const lakehouseInfo = getLakehouseInfo()
  const xmlaInfo     = getXmlaInfo()
  const measuresInfo = getMeasuresInfo()
  const queryStats   = getQueryStats()

  let fabricStatus = 'disconnected'
  try {
    const token = await getToken()
    if (token) fabricStatus = 'connected'
  } catch { /* keep disconnected */ }

  // Build per-workspace auth status
  const activeId = `${process.env.FABRIC_WORKSPACE_ID}_${process.env.FABRIC_DATASET_ID}`
  const allWorkspaces = getSavedWorkspacesSafe()
  const workspaces = allWorkspaces.map(ws => {
    const isActive = ws.id === activeId
    if (isActive) {
      return {
        id:            ws.id,
        workspaceName: ws.workspaceName,
        datasetName:   ws.datasetName,
        authMode:      tokenInfo?.mode || ws.authMode,
        isActive:      true,
        tokenValid:    !!(tokenInfo && tokenInfo.expiresAt && new Date(tokenInfo.expiresAt) > new Date()),
        tokenExpiresAt: tokenInfo?.expiresAt || null,
        tokenExpiresIn: tokenInfo?.expiresAt
          ? Math.max(0, Math.round((new Date(tokenInfo.expiresAt) - Date.now()) / 1000))
          : null,
      }
    }
    return {
      id:            ws.id,
      workspaceName: ws.workspaceName,
      datasetName:   ws.datasetName,
      authMode:      ws.authMode,
      isActive:      false,
      tokenValid:    null,
      tokenExpiresAt: null,
      tokenExpiresIn: null,
    }
  })

  return {
    status: fabricStatus === 'connected' ? 'healthy' : 'degraded',
    fabric: fabricStatus,
    auth: {
      mode: tokenInfo?.mode,
      tokenValid: !!(tokenInfo && tokenInfo.expiresAt && new Date(tokenInfo.expiresAt) > new Date()),
      tokenExpiresAt: tokenInfo?.expiresAt || null,
      tokenExpiresIn: tokenInfo?.expiresAt
        ? Math.max(0, Math.round((new Date(tokenInfo.expiresAt) - Date.now()) / 1000))
        : null,
    },
    workspaces,
    cache: {
      engine: 'SQLite',
      entries: getCacheEntryCount(),
      hitRate: cacheStats.hitRate,
    },
    queue: {
      waiting: limiterInfo.waiting,
      active: limiterInfo.active,
      reqPerMin: limiterInfo.active,
    },
    audit: auditCounts,
    lakehouse: lakehouseInfo,
    xmla: {
      endpoint: xmlaInfo.endpoint,
      fallbackAvailable: !!xmlaInfo.endpoint,
      lastUsed: xmlaInfo.lastUsed,
    },
    measures: measuresInfo,
    batching: queryStats,
  }
}

async function handleGetMeasures() {
  const local = require('../../src/powerbi/localRuntime').current();
  if (local) return { measures: local.measures, source: 'local-pbip' };
  const datasetId = process.env.FABRIC_DATASET_ID
  const measures  = getRegistryMeasures(datasetId)
  const info      = getMeasuresInfo()
  return { measures, refreshedAt: info.refreshedAt }
}

async function handleGetDimensions() {
  const local = require('../../src/powerbi/localRuntime').current();
  if (local) return { tables: local.tables, source: 'local-pbip' };
  const datasetId = process.env.FABRIC_DATASET_ID

  // Strategy 1: dimension_registry (populated via file import)
  const regTables = getDimensionTables(datasetId)
  if (regTables.length > 0) {
    return { tables: regTables, source: 'registry' }
  }

  // Strategy 2: REST API tables endpoint
  const workspaceId = process.env.FABRIC_WORKSPACE_ID
  try {
    const token = await getToken()
    const url = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/tables`
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    })
    const tables = (res.data.value || []).map(t => ({
      name: t.name,
      columns: (t.columns || [])
        .filter(c => c.columnType !== 'RowNumber')
        .map(c => ({ name: c.name, dataType: c.dataType })),
    }))
    if (tables.length > 0) return { tables, source: 'rest' }
  } catch { /* fall through */ }

  return { tables: [], source: 'unavailable', error: 'No dimension metadata — use Import to load from Power BI Desktop' }
}

async function handleImportFromFile() {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select model export JSON',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  })

  if (canceled || !filePaths.length) return { canceled: true }

  let parsed
  try {
    const raw = fs.readFileSync(filePaths[0], 'utf8')
    parsed = JSON.parse(raw)
  } catch (e) {
    return { success: false, error: `Cannot read file: ${e.message}` }
  }

  const measures = parsed.measures
  const tables   = parsed.tables

  if (!Array.isArray(measures) || measures.length === 0) {
    return { success: false, error: 'File must contain a non-empty "measures" array' }
  }

  // Normalise measures — allow {name, table} or plain strings
  const normMeasures = measures.map(m =>
    typeof m === 'string' ? { name: m, table: '' } : { name: m.name || '', table: m.table || '' }
  ).filter(m => m.name)

  const datasetId = process.env.FABRIC_DATASET_ID

  // Save measures to registry
  bulkSaveRegistryMeasures(datasetId, normMeasures)
  reloadFromRegistry()

  // Save tables/columns to dimension_registry (optional section)
  let tableCount = 0
  if (Array.isArray(tables) && tables.length > 0) {
    bulkSaveDimensionTables(datasetId, tables)
    tableCount = tables.length
  }

  console.log(`[health] Imported ${normMeasures.length} measures + ${tableCount} tables from ${filePaths[0]}`)

  return {
    success:      true,
    measures:     getRegistryMeasures(datasetId),
    tables:       getDimensionTables(datasetId),
    measureCount: normMeasures.length,
    tableCount,
    filePath:     filePaths[0],
  }
}

function register() {
  ipcMain.handle('validate-filter', (_e, { filterColumn, measureName }) => {
    if (!global.semanticaRelGraph) return { valid: true }

    // Extract table name from "TableName[ColName]" or "'Table Name'[ColName]"
    const rawTable = filterColumn?.includes('[')
      ? filterColumn.split('[')[0]
      : filterColumn
    const filterTable = (rawTable || '').replace(/^['"]|['"]$/g, '').trim()

    const ctx = global.semanticaModelContext
    const measure = ctx?.measures?.find(m => m.name === measureName)
    if (!measure) return { valid: true }

    // Try direct path: filter table → measure's home table
    const direct = global.semanticaRelGraph.canFilter(filterTable, measure.table)
    if (direct.valid) return direct

    // Fallback: measure may live in a measure-group table with no relationships.
    // Extract tables referenced in the measure's DAX and check those instead.
    if (measure.expression) {
      const daxTableRefs = [...new Set(
        [...(measure.expression.matchAll(/'([^']+)'\s*\[|([A-Za-z_][A-Za-z0-9_ ]*)(?=\s*\[)/g))]
          .map(m => (m[1] || m[2] || '').trim())
          .filter(Boolean)
      )]
      for (const t of daxTableRefs) {
        const r = global.semanticaRelGraph.canFilter(filterTable, t)
        if (r.valid) {
          console.log(`[validate-filter] Found path via DAX table ref "${t}" for measure "${measureName}"`)
          return r
        }
      }
    }

    // Fallback 2: if filter table can reach any fact table, likely valid
    const factTables = (ctx.tables || []).filter(t => t.tableType === 'fact')
    for (const ft of factTables) {
      const r = global.semanticaRelGraph.canFilter(filterTable, ft.name)
      if (r.valid) {
        console.log(`[validate-filter] Found path via fact table "${ft.name}" for measure "${measureName}"`)
        return r
      }
    }

    console.log(`[validate-filter] No path: "${filterTable}" → "${measure.table}" (measure: ${measureName})`)
    return { valid: false, path: [] }
  })

  ipcMain.handle('get-health',     () => handleGetHealth())
  ipcMain.handle('get-measures',   () => handleGetMeasures())
  ipcMain.handle('get-dimensions', () => handleGetDimensions())

  ipcMain.handle('get-measure-registry', () => {
    const local = require('../../src/powerbi/localRuntime').current();
    if (local) return { measures: local.measures };
    const datasetId = process.env.FABRIC_DATASET_ID
    return { measures: getRegistryMeasures(datasetId) }
  })
  ipcMain.handle('remove-measure-registry', (_e, { name }) => {
    const datasetId = process.env.FABRIC_DATASET_ID
    removeRegistryMeasure(datasetId, name)
    return { success: true }
  })

  ipcMain.handle('import-from-file', () => handleImportFromFile())

  ipcMain.handle('clear-cache', () => {
    resetAllData()
    return { cleared: true }
  })

  ipcMain.handle('get-model-context', () => {
    const local = require('../../src/powerbi/localRuntime').current();
    if (local) return { tables: local.tables, measures: local.measures, relationships: [], source: 'local-pbip' };
    return global.semanticaModelContext || null
  })
}

module.exports = { register }
