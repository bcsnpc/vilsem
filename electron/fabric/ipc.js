// ipc.js — Deploy-to-Fabric IPC surface. register() is called from main.js ONLY
// when FEATURE_FABRIC_EXPORT is on, so with the flag off none of these channels
// exist and the app behaves exactly as today.
const { ipcMain } = require('electron')
const { checkPrereqs } = require('./prereqs')
const { deployToFabric, rayfinLogout, rayfinLogin } = require('./runRayfin')
const { FABRIC_CONFIG } = require('./fabric.config')

function register() {
  // Prereq checklist (node/npm/rayfin/bun) — the UI calls this before deploying.
  ipcMain.handle('fabric-prereq-check', async () => checkPrereqs())

  // Read-only info for the UI (what preview format this build targets).
  ipcMain.handle('fabric-config-info', async () => ({
    previewTargetedAt: FABRIC_CONFIG.previewTargetedAt,
    templateName: FABRIC_CONFIG.templateName,
    tenantSetting: FABRIC_CONFIG.runtime.tenantSettingName,
  }))

  // Full deploy. Streams CLI output to the renderer via 'fabric-deploy-output'.
  ipcMain.handle('fabric-deploy', async (event, { spec, opts } = {}) => {
    const onOutput = (chunk) => { try { event.sender.send('fabric-deploy-output', chunk) } catch {} }
    // Fill in the connected model's IDs from the main-process env (set on connect)
    // so the injector auto-wires the semantic-model connection alias — no terminal step.
    const mergedOpts = { ...(opts || {}) }
    mergedOpts.modelWorkspaceId = mergedOpts.modelWorkspaceId || process.env.FABRIC_WORKSPACE_ID
    mergedOpts.datasetId = mergedOpts.datasetId || process.env.FABRIC_DATASET_ID
    try {
      return await deployToFabric(spec, mergedOpts, onOutput)
    } catch (e) {
      onOutput({ stream: 'stderr', text: String(e.message) + '\n' })
      return { ok: false, error: { code: 'DEPLOY_FAILED', message: e.message } }
    }
  })

  // Interactive Fabric sign-in from the app (opens a browser). Streams output so
  // the UI shows progress + the sign-in URL. Removes the "open a terminal" step.
  ipcMain.handle('fabric-login', async (event) => {
    const onOutput = (chunk) => { try { event.sender.send('fabric-deploy-output', chunk) } catch {} }
    return rayfinLogin(null, onOutput)
  })

  // 401/403 recovery — force a fresh Rayfin sign-in.
  ipcMain.handle('fabric-logout', async (event) => {
    const onOutput = (chunk) => { try { event.sender.send('fabric-deploy-output', chunk) } catch {} }
    return rayfinLogout(null, onOutput)
  })

  console.log('[fabric] Deploy-to-Fabric IPC registered (FEATURE_FABRIC_EXPORT on)')
}

module.exports = { register }
