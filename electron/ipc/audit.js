const { ipcMain } = require('electron/main')
const { getAuditEntries } = require('../../src/audit/log')

async function handleGetAudit({ limit = 20, type } = {}) {
  return getAuditEntries(limit, type)
}

function register() {
  ipcMain.handle('get-audit', (_e, params) => handleGetAudit(params))
}

module.exports = { register }
