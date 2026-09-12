console.log('[main] line:1 reached. node=', process.versions.node, 'electron=', process.versions.electron, 'ELECTRON_RUN_AS_NODE=', JSON.stringify(process.env.ELECTRON_RUN_AS_NODE))
require('dotenv').config(); console.log('[main] line:2 dotenv ok')

const { app, BrowserWindow, ipcMain, session } = require('electron/main'); console.log('[main] line:3 electron/main ok')
const path = require('path')
const axios = require('axios'); console.log('[main] line:5 axios ok')

app.disableHardwareAcceleration()

process.on('uncaughtException',  err    => console.error('[main] uncaughtException:',  err.message, '\n', err.stack))
process.on('unhandledRejection', reason => console.error('[main] unhandledRejection:', reason))

// Point the shared src/ persistence (cache DB, audit log, auth token cache,
// fabric staging) at a WRITABLE dir. In dev cwd is the repo root (writable); in
// the packaged app cwd is Program Files / System32 (read-only), which silently
// disabled the cache and forced re-auth every launch. Set this BEFORE requiring
// the src/ modules below — they read SEMANTICA_DATA_DIR at module-load time.
try { process.env.SEMANTICA_DATA_DIR = app.getPath('userData') } catch { /* keep cwd fallback */ }

const { initCache, getDimensionTables }                                = require('../src/cache/sqlite')
const { initAuth, getTokenInfo, getToken, setInteractiveTokens }      = require('../src/auth/auth')
const { fetchMeasures, startAutoRefresh, getMeasuresList, getMeasuresInfo, getEnrichedMeasures, getRelationships, getRawModelBim } = require('../src/fabric/metadata')
const { buildModelContext } = require('../src/fabric/modelContext')
const { RelationshipGraph } = require('../src/fabric/relationshipGraph')
const { setMainWindowGetter } = require('./ipc/connection')
const { initLakehouse, getLakehouseInfo }                             = require('../src/fabric/lakehouse')
const { getActiveWorkspace, isLoggedOut }                             = require('./ipc/connection')

const queryHandlers      = require('./ipc/query')
const healthHandlers     = require('./ipc/health')
const writebackHandlers  = require('./ipc/writeback')
const auditHandlers      = require('./ipc/audit')
const connectionHandlers = require('./ipc/connection')
const visualHandlers     = require('./ipc/visuals')
const llmHandlers        = require('./ipc/llm')
const dashboardHandlers  = require('./ipc/dashboard')
const exportHandlers     = require('./ipc/exportPackage')
const powerbiHandlers    = require('./ipc/powerbi')
const pbismHandlers      = require('./ipc/powerbi_semanticmodel')
const pbiRestylerHandlers = require('./ipc/pbiRestyler')
const restylerDirectorHandlers = require('./ipc/restylerPrompts')
const customTemplateHandlers = require('./ipc/customTemplates') // Playground Spike

let mainWindow = null
let tokenCheckInterval = null

function setupTokenCheck() {
  if (tokenCheckInterval) clearInterval(tokenCheckInterval)
  tokenCheckInterval = setInterval(async () => {
    if (process.env.AUTH_MODE !== 'interactive') return
    try {
      await getToken()
    } catch (err) {
      console.log('[main] Token refresh failed — sending auth-expired:', err.message)
      if (mainWindow && !mainWindow.isDestroyed()) {
        const ws = getActiveWorkspace()
        mainWindow.webContents.send('auth-expired', {
          workspaceName: ws?.workspaceName || process.env.FABRIC_DATASET_NAME || '',
        })
      }
    }
  }, 5 * 60 * 1000)
}

// ── Content Security Policy ──────────────────────────────────────────────────
// Locks down what the renderer may load/execute/connect-to, so an injected
// string can't run a remote script or exfiltrate data to an attacker host.
// PRODUCTION (packaged) is strict: script-src 'self' — NO 'unsafe-inline'.
// DEV adds only what Vite needs (its dev origin + HMR ws, and 'unsafe-inline'
// for scripts, which React Fast Refresh injects as an inline <script> preamble).
// The dev relaxation is gated on VITE_DEV_SERVER, which packaged builds never
// set — so it can never apply in production.
function buildCsp() {
  // `&& !app.isPackaged` makes the "dev relaxations can never reach a packaged
  // build" guarantee enforced by code, not just by VITE_DEV_SERVER being unset:
  // even if that env var somehow leaked into a packaged build, the strict policy
  // still applies.
  const isDev = !!process.env.VITE_DEV_SERVER && !app.isPackaged
  const apiHosts = [
    'https://api.anthropic.com',
    'https://api.openai.com',
    'https://api.groq.com',
    'https://generativelanguage.googleapis.com',
    'https://api.powerbi.com',
    'https://api.fabric.microsoft.com',
    'https://login.microsoftonline.com',
  ].join(' ')

  const scriptSrc = isDev ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'"
  const connectSrc = isDev
    ? `connect-src 'self' ws://127.0.0.1:5173 http://127.0.0.1:5173 ${apiHosts}`
    : `connect-src 'self' ${apiHosts}`

  return [
    "default-src 'self'",
    scriptSrc,
    // React (style={{}}) and ECharts emit inline style attributes; Google Fonts
    // CSS is served from fonts.googleapis.com. 'unsafe-inline' here is styles
    // only — never scripts.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    connectSrc,
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

function installCsp() {
  const csp = buildCsp()
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const url = details.url || ''
    // Apply OUR CSP ONLY to the app's own documents/resources — file:// when
    // packaged, the Vite dev origin in dev. Do NOT touch external windows such as
    // the Microsoft sign-in popup (login.microsoftonline.com + Microsoft CDNs),
    // which rely on inline scripts and their own CDNs and would render blank
    // under our policy.
    const isAppOrigin =
      url.startsWith('file://') ||
      url.startsWith('http://127.0.0.1:5173') ||
      url.startsWith('http://localhost:5173')
    if (!isAppOrigin) {
      return callback({ responseHeaders: details.responseHeaders })
    }
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    })
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800, minWidth: 900, minHeight: 600,
    frame: false,
    backgroundColor: '#F9FAFB',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Chromium sandbox ON. The preload requires only 'electron' (available in
      // the sandbox) and the renderer talks to the backend via IPC only — no
      // direct Node/native modules — so it runs fully sandboxed. Do not disable.
      sandbox: true,
    },
  })

  if (process.env.VITE_DEV_SERVER) {
    const devUrl = 'http://127.0.0.1:5173'
    let attempts = 0
    let loaded = false
    const MAX_ATTEMPTS = 20    // 20 × 500ms = 10s max wait for Vite

    function tryLoad() {
      attempts++
      console.log(`[main] loading dev URL (attempt ${attempts}/${MAX_ATTEMPTS}):`, devUrl)
      mainWindow?.loadURL(devUrl).catch(err => {
        console.error(`[main] loadURL attempt ${attempts} failed:`, err.message)
        if (attempts < MAX_ATTEMPTS && mainWindow) {
          setTimeout(tryLoad, 500)
        } else {
          console.error('[main] giving up after', MAX_ATTEMPTS, 'attempts. Vite dev server is not responding on 127.0.0.1:5173')
        }
      })
    }
    tryLoad()

    // Re-trigger load if we land on chrome-error (which happens when first
    // attempt failed before Chromium discarded the error frame).
    mainWindow.webContents.on('did-fail-load', (_e, errCode, errDesc, validated) => {
      // ERR_ABORTED (-3) is normal when a load is superseded (HMR, navigation) —
      // ignore it. And once the renderer has loaded, NEVER retry: another loadURL
      // would abort the live page → another did-fail-load → an endless reload loop
      // (which also re-races the startup-complete event and sticks on Connect).
      if (loaded || errCode === -3) return
      console.error(`[main] did-fail-load: ${errCode} ${errDesc} (url: ${validated})`)
      if (attempts < MAX_ATTEMPTS && mainWindow) {
        setTimeout(tryLoad, 500)
      }
    })

    mainWindow.webContents.on('did-finish-load', () => {
      loaded = true
      console.log('[main] ✓ renderer loaded after', attempts, 'attempt(s)')
    })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/ui/index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

async function startup() {
  console.log('[main] startup begin')

  try { await initCache(); console.log('[main] ✓ cache') }
  catch (e) { console.error('[main] ✗ cache:', e.message) }

  // ── Workspace resolution ──────────────────────────────────────────────────
  // Priority: 1) keychain config  2) .env fallback  3) setup screen
  let needsSetup    = false
  let workspaceInfo = null

  const saved = getActiveWorkspace()

  if (saved) {
    const authMode = saved.authMode || 'service_principal'
    process.env.AUTH_MODE = authMode

    if (authMode === 'interactive') {
      // Tokens come from saved workspace — auth.js will refresh on initAuth()
      setInteractiveTokens(saved.accessToken || '', saved.refreshToken, saved.expiresIn || 3600)
    } else {
      process.env.FABRIC_TENANT_ID      = saved.tenantId
      process.env.FABRIC_CLIENT_ID      = saved.clientId
      process.env.FABRIC_CLIENT_SECRET  = saved.clientSecret
    }

    process.env.FABRIC_WORKSPACE_ID   = saved.workspaceId
    process.env.FABRIC_DATASET_ID     = saved.datasetId
    process.env.FABRIC_DATASET_NAME   = saved.datasetName  || ''
    process.env.FABRIC_LAKEHOUSE_NAME = saved.lakehouseName || ''
    workspaceInfo = saved
    console.log(`[main] ✓ workspace loaded from config: "${saved.datasetName}" in "${saved.workspaceName}" (${authMode})`)
  } else if (process.env.FABRIC_WORKSPACE_ID && process.env.FABRIC_DATASET_ID && !isLoggedOut()) {
    // .env fallback (dev mode) — skipped if user explicitly logged out
    workspaceInfo = {
      workspaceName: 'Dev workspace',
      datasetName:   process.env.FABRIC_DATASET_NAME || process.env.FABRIC_DATASET_ID,
      authMode:      process.env.AUTH_MODE || 'service_principal',
    }
    console.log('[main] ✓ workspace from .env (dev fallback)')
  } else {
    needsSetup = true
    console.log('[main] No workspace configured — will show setup screen')
  }

  // ── Auth ───────────────────���──────────────────────────────────────────────
  if (!needsSetup) {
    try { await initAuth(); console.log('[main] ✓ auth') }
    catch (e) {
      // Saved session couldn't be restored (e.g. the refresh token expired).
      // Don't proceed to Home with a dead session — show the login screen so
      // the user can re-sign in (their saved profile is still available for a
      // one-click re-auth). Previously this only logged and fell through to a
      // broken Home, forcing a manual sign-out first.
      console.error('[main] ✗ auth — routing to setup:', e.message)
      needsSetup = true
    }
  }

  // ── Measures ──────────────────��─────────────────────────��─────────────────
  let measures = []
  let measuresRefreshedAt = null
  try {
    await fetchMeasures()
    if (!needsSetup) { startAutoRefresh(); setupTokenCheck() }
    measures            = getMeasuresList()
    measuresRefreshedAt = getMeasuresInfo().refreshedAt
    console.log(`[main] ✓ measures (${measures.length})`)

    // Build rich model context for AI prompts
    try {
      const enriched   = getEnrichedMeasures()
      const rels       = getRelationships()
      const dimTables  = getDimensionTables(process.env.FABRIC_DATASET_ID)
      const rawBim     = getRawModelBim()
      global.semanticaModelContext = buildModelContext(enriched, dimTables, rels, rawBim)
      global.semanticaRelGraph     = new RelationshipGraph(rels)
    } catch (e) { console.error('[main] ✗ modelContext:', e.message) }
  } catch (e) { console.error('[main] ✗ measures:', e.message) }

  // ── Lakehouse ────────────────────────────────────────────────────────��────
  let lakehouseInfo = { status: 'unavailable' }
  if (!needsSetup) {
    try { await initLakehouse(); lakehouseInfo = getLakehouseInfo(); console.log('[main] ✓ lakehouse') }
    catch (e) { console.error('[main] ✗ lakehouse:', e.message) }
  }

  // ── Register IPC ────────────────────────��─────────────────────────────���───
  queryHandlers.register()
  healthHandlers.register()
  writebackHandlers.register()
  auditHandlers.register()
  connectionHandlers.register()
  visualHandlers.register()
  llmHandlers.register()
  dashboardHandlers.register()
  exportHandlers.register()
  require('./ipc/localPowerBI').register()
  powerbiHandlers.register()
  pbismHandlers.register()
  pbiRestylerHandlers.register()
  restylerDirectorHandlers.register()
  customTemplateHandlers.register() // Playground Spike
  // Deploy-to-Fabric (Rayfin) — shipped feature, isolated under electron/fabric/.
  // Registered by default; set FEATURE_FABRIC_EXPORT=false to disable. (Deploying to
  // Fabric requires Node.js + npm on PATH, since it shells out to the Rayfin CLI.)
  if (process.env.FEATURE_FABRIC_EXPORT !== 'false') {
    try { require('./fabric/ipc').register() }
    catch (e) { console.error('[fabric] IPC registration failed:', e.message) }
  }

  ipcMain.handle('minimize-window', () => mainWindow?.minimize())
  ipcMain.handle('maximize-window', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.handle('close-window', () => mainWindow?.close())

  console.log('[main] creating window...')
  installCsp()
  createWindow()
  setMainWindowGetter(() => mainWindow)
  console.log('[main] window created')

  mainWindow.webContents.on('did-finish-load', () => {
    if (needsSetup) {
      mainWindow.webContents.send('show-setup')
      return
    }

    const tokenInfo = getTokenInfo()
    mainWindow.webContents.send('startup-complete', {
      measures,
      measuresRefreshedAt,
      lakehouse:    lakehouseInfo,
      workspaceId:  process.env.FABRIC_WORKSPACE_ID,
      datasetId:    process.env.FABRIC_DATASET_ID,
      datasetName:  process.env.FABRIC_DATASET_NAME || workspaceInfo?.datasetName || '',
      lakehouseName: process.env.FABRIC_LAKEHOUSE_NAME || '',
      workspaceName: workspaceInfo?.workspaceName || '',
      authMode:     tokenInfo?.mode || process.env.AUTH_MODE || 'service_principal',
    })

    const dimensions = getDimensionTables(process.env.FABRIC_DATASET_ID)
    if (measures.length > 0 || dimensions.length > 0) {
      mainWindow.webContents.send('metadata-updated', { measures, dimensions })
    }
  })
}

app.whenReady().then(startup).catch(err => {
  console.error('[main] startup failed:', err.message, '\n', err.stack)
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (mainWindow === null) createWindow() })
