const { ipcMain } = require('electron/main')
const { saveVisual, getSavedVisuals, deleteSavedVisual } = require('../../src/cache/sqlite')

function register() {

  ipcMain.handle('save-visual', async (_e, { name, config, datasetId }) => {
    if (!name || !config || !datasetId) throw new Error('name, config, and datasetId are required')
    await saveVisual(datasetId, name, config.visualType || 'kpi', config)
    return { saved: true }
  })

  ipcMain.handle('load-visuals', async (_e, { datasetId }) => {
    if (!datasetId) return []
    return await getSavedVisuals(datasetId)
  })

  ipcMain.handle('delete-visual', async (_e, { id }) => {
    await deleteSavedVisual(id)
    return { deleted: true }
  })
}

module.exports = { register }
