// Playground Spike — IPC for declarative custom-visual templates.
// Additive; mirrors electron/ipc/visuals.js. Throwawayable with the spike.

const { ipcMain, app } = require('electron/main')
const fs = require('fs')
const path = require('path')
const { saveCustomTemplate, getCustomTemplates, deleteCustomTemplate } = require('../../src/cache/sqlite')

// Phase 7 trial telemetry — one JSONL line per AI generation attempt so the
// §8.3 table builds itself as the user drives the trial. Lives in userData
// (always writable). Never contains tokens/keys — just prompt/mode/result/ms.
function trialLogPath() {
  return path.join(app.getPath('userData'), 'playground-ai-trial.jsonl')
}

function register() {
  ipcMain.handle('save-custom-template', async (_e, { datasetId, template }) => {
    if (!datasetId || !template?.meta?.id) throw new Error('datasetId and template.meta.id are required')
    return saveCustomTemplate(datasetId, template)
  })

  ipcMain.handle('load-custom-templates', async (_e, { datasetId }) => {
    if (!datasetId) return []
    return getCustomTemplates(datasetId)
  })

  ipcMain.handle('delete-custom-template', async (_e, { datasetId, templateId }) => {
    deleteCustomTemplate(datasetId, templateId)
    return { deleted: true }
  })

  // ── Phase 7 trial telemetry ───────────────────────────────────────────────
  ipcMain.handle('append-playground-log', async (_e, record) => {
    try {
      const line = JSON.stringify({ ...record, at: new Date().toISOString() }) + '\n'
      fs.appendFileSync(trialLogPath(), line, 'utf-8')
      return { logged: true }
    } catch (e) { return { logged: false, error: e.message } }
  })

  ipcMain.handle('read-playground-log', async () => {
    try {
      const raw = fs.readFileSync(trialLogPath(), 'utf-8')
      return raw.split('\n').filter(Boolean).map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
    } catch { return [] }
  })

  ipcMain.handle('clear-playground-log', async () => {
    try { fs.writeFileSync(trialLogPath(), '', 'utf-8') } catch {}
    return { cleared: true }
  })
}

module.exports = { register }
