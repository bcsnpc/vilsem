const { ipcMain, dialog, BrowserWindow } = require('electron/main')
const path = require('node:path')
const { inspectLocalProject, saveBoundReport } = require('../../src/powerbi/localProject')

// Resolve in the main process: the renderer gets model identity/paths only,
// never a general filesystem reader or the model's data-source credentials.
async function selectLocalPowerBIModel(event, { selectFile = false } = {}) {
  const options = selectFile
    ? { title: 'Select a Power BI project', properties: ['openFile'], filters: [{ name: 'Power BI project', extensions: ['pbip', 'pbir'] }] }
    : { title: 'Select a local Power BI project folder', properties: ['openDirectory'] }
  try {
    const parent = BrowserWindow.fromWebContents(event.sender)
    const selected = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
    if (selected.canceled || !selected.filePaths?.length) return { canceled: true }
    const source = inspectLocalProject(selected.filePaths[0])
    return { success: true, source }
  } catch (error) {
    return { success: false, error: error.message || 'Could not read the local Power BI project.' }
  }
}

async function saveLocalPowerBIReport(event, { reportParts, sourceSpec, datasetId } = {}) {
  try {
    const connection = require('./connection').getWorkspaceConfig()
    if (!datasetId || connection.datasetId !== datasetId) throw new Error('The active model changed. Reconnect this report before exporting.')
    if (!Array.isArray(reportParts) || !sourceSpec) throw new Error('A complete report definition is required.')
    const parent = BrowserWindow.fromWebContents(event.sender)
    const options = { title: 'Choose a folder for the new Power BI project', properties: ['openDirectory', 'createDirectory'] }
    const selected = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
    if (selected.canceled || !selected.filePaths?.length) return { canceled: true }
    // The native picker chooses a parent. The writer reserves a NEW child folder
    // exclusively, leaving existing reports and the connected model untouched.
    const title = String(sourceSpec.title || 'Vilsem report').replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 70) || 'Vilsem report'
    const destination = path.join(selected.filePaths[0], `${title}-${Date.now()}`)
    if (require('./connection').getWorkspaceConfig().datasetId !== datasetId) throw new Error('The active model changed while choosing a folder. Try again.')
    return { success: true, ...saveBoundReport({ destination, reportParts, sourceSpec, connection }) }
  } catch (error) { return { success: false, error: error.message || 'Could not save the Power BI report.' } }
}

function register() {
  ipcMain.handle('connect-local-power-bi-model', async (_event, { path }) => {
    try { return { success: true, connection: await require('../../src/powerbi/localRuntime').connect(path) } }
    catch (error) { return { success: false, error: error.message } }
  })
  ipcMain.handle('select-local-power-bi-model', selectLocalPowerBIModel)
  ipcMain.handle('save-local-power-bi-report', saveLocalPowerBIReport)
}

module.exports = { register, selectLocalPowerBIModel, saveLocalPowerBIReport }
