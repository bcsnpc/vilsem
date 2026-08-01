const { ipcMain } = require('electron/main')
const { writeLakehouseRows } = require('../../src/fabric/lakehouse')
const { flushCache } = require('../../src/cache/sqlite')
const { logWriteback } = require('../../src/audit/log')

async function handleWriteback({ table, rows, destination = 'lakehouse', flushCacheOnWrite = false } = {}) {
  const start = Date.now()

  if (!table || typeof table !== 'string') {
    return { error: 'VALIDATION_ERROR', message: 'table is required and must be a string' }
  }
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return { error: 'VALIDATION_ERROR', message: 'rows must be a non-empty array' }
  }
  if (destination !== 'lakehouse') {
    return { error: 'VALIDATION_ERROR', message: 'destination must be "lakehouse"' }
  }

  try {
    const result = await writeLakehouseRows(table, rows)

    if (flushCacheOnWrite) {
      flushCache()
    }

    const auditId = logWriteback({
      tableName: table,
      rowsWritten: rows.length,
      destination,
    })

    const queryMs = Date.now() - start

    return {
      written: rows.length,
      table,
      destination,
      writeMethod: result.method,
      auditId,
      timestamp: new Date().toISOString(),
      queryMs,
      ...(result.writePath ? { writePath: result.writePath } : {}),
    }
  } catch (err) {
    return { error: err.code || 'WRITEBACK_ERROR', message: err.message || 'Unknown writeback error' }
  }
}

function register() {
  ipcMain.handle('writeback', (_e, params) => handleWriteback(params))
}

module.exports = { register }
