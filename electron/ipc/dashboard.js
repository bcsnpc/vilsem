const { ipcMain } = require('electron/main')
const { saveDashboard, getDashboards, deleteDashboard, saveAppSpec, getAppSpecs, deleteAppSpec, renameAppSpec } = require('../../src/cache/sqlite')

function register() {
  ipcMain.handle('save-dashboard', async (_e, { name, datasetId, layout, visuals, theme }) => {
    const id = saveDashboard(name, datasetId, layout, visuals, theme)
    return { id, saved: true }
  })

  ipcMain.handle('get-dashboards', async (_e, { datasetId }) => {
    return getDashboards(datasetId)
  })

  ipcMain.handle('delete-dashboard', async (_e, { id }) => {
    deleteDashboard(id)
    return { deleted: true }
  })

  ipcMain.handle('save-app-spec', async (_e, { name, datasetId, spec }) => {
    if (!name || !datasetId || !spec) throw new Error('name, datasetId, and spec are required')
    const id = saveAppSpec(name, datasetId, spec)
    return { id, saved: true }
  })

  ipcMain.handle('get-app-specs', async (_e, { datasetId }) => {
    return getAppSpecs(datasetId)
  })

  ipcMain.handle('delete-app-spec', async (_e, { id }) => {
    deleteAppSpec(id)
    return { deleted: true }
  })

  ipcMain.handle('rename-app-spec', async (_e, { id, name }) => {
    if (!id || !name) throw new Error('id and name are required')
    renameAppSpec(id, name)
    return { renamed: true }
  })
}

module.exports = { register }
