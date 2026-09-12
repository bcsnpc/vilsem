const { ipcMain, safeStorage, app, BrowserWindow } = require('electron/main')
const path   = require('path')
const fs     = require('fs')
const crypto = require('crypto')
const axios  = require('axios')
const { forceRefresh, setInteractiveTokens, getToken }                            = require('../../src/auth/auth')
const { fetchMeasures, startAutoRefresh, getMeasuresList, getEnrichedMeasures,
        getRelationships, getRawModelBim }                                          = require('../../src/fabric/metadata')
const { initLakehouse }                                                             = require('../../src/fabric/lakehouse')
const { getDimensionTables, cacheModelMetadata, cacheDistinctValues,
        getCachedDistinctValues }                                                    = require('../../src/cache/sqlite')
const { buildModelContext }                                                         = require('../../src/fabric/modelContext')
const { RelationshipGraph }                                                         = require('../../src/fabric/relationshipGraph')
const { rateLimitedCall }                                                           = require('../../src/queue/limiter')
const { executeQueryMulti }                                                         = require('../../src/fabric/client')

let _getMainWindow = null
function setMainWindowGetter(fn) { _getMainWindow = fn }

// ── Config file (userData dir) ────────────────────────────────────────────────

function configPath() {
  return path.join(app.getPath('userData'), 'workspaces.json')
}

function readConfig() {
  try { return JSON.parse(fs.readFileSync(configPath(), 'utf8')) }
  catch { return { workspaces: [], activeWorkspace: null } }
}

function writeConfig(cfg) {
  fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2), 'utf8')
}

// ── Encryption helpers ────────────────────────────────────────────────────────

function encryptStr(str) {
  if (safeStorage.isEncryptionAvailable()) {
    return { enc: safeStorage.encryptString(str).toString('base64'), plain: null }
  }
  return { enc: null, plain: str }
}

function decryptStr(enc, plain) {
  if (enc) {
    try { return safeStorage.decryptString(Buffer.from(enc, 'base64')) }
    catch { /* fall through */ }
  }
  return plain || ''
}

function hydrate(entry) {
  const ws = { ...entry }
  ws.clientSecret  = decryptStr(entry.clientSecretEnc,  entry.clientSecretPlain)
  ws.refreshToken  = decryptStr(entry.refreshTokenEnc,  entry.refreshTokenPlain)
  return ws
}

// ── Public helpers (used by main.js on startup) ───────────────────────────────

function getActiveWorkspace() {
  const cfg = readConfig()
  if (cfg.loggedOut) return null
  const all = cfg.workspaces || []
  if (!all.length) return null
  const active = cfg.activeWorkspace
    ? all.find(w => w.id === cfg.activeWorkspace)
    : all[0]
  return active ? hydrate(active) : null
}

function isLoggedOut() {
  return !!readConfig().loggedOut
}

function getSavedWorkspacesSafe() {
  return (readConfig().workspaces || []).map(w => ({
    id:            w.id,
    authMode:      w.authMode || 'service_principal',
    workspaceId:   w.workspaceId,
    workspaceName: w.workspaceName,
    datasetId:     w.datasetId,
    datasetName:   w.datasetName,
    lakehouseId:   w.lakehouseId,
    lakehouseName: w.lakehouseName,
    tenantId:      w.tenantId,
    clientId:      w.clientId,
    savedAt:       w.savedAt,
    // secrets intentionally omitted
  }))
}

// ── Engine reinit ─────────────────────────────────────────────────────────────

function saveModelSnapshot(datasetId, modelCtx) {
  try {
    const dir = path.join(app.getPath('userData'), 'snapshots')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const snapshotPath = path.join(dir, datasetId + '.json')
    const payload = {
      version:   1,
      datasetId,
      savedAt:   new Date().toISOString(),
      measures:  (modelCtx.measures || []).map(m => ({
        name: m.name, table: m.table, formatString: m.formatString,
        dataType: m.dataType, isRatio: m.isRatio, isHidden: m.isHidden,
        isTimeIntelligence: m.isTimeIntelligence,
      })),
      tables: (modelCtx.tables || []).map(t => ({
        name: t.name, tableType: t.tableType,
        columns: (t.columns || []).map(c => ({
          name: c.name, dataType: c.dataType,
          isDate: c.isDate, isKey: c.isKey, isCategory: c.isCategory,
          cleanLabel: c.cleanLabel, isHidden: c.isHidden,
        })),
      })),
      relationships: (modelCtx.relationships || []).map(r => ({
        fromTable: r.fromTable, fromColumn: r.fromColumn,
        toTable:   r.toTable,   toColumn:   r.toColumn,
        isActive:  r.isActive,
      })),
    }
    fs.writeFileSync(snapshotPath, JSON.stringify(payload))
    console.log(`[connection] Model snapshot saved: ${snapshotPath}`)
  } catch (e) {
    console.error('[connection] Failed to save model snapshot:', e.message)
  }
}

/**
 * Rebuild model context + relationship graph after fetchMeasures() completes.
 * Called from reinitEngine after workspace connect/switch.
 */
function rebuildModelContext(datasetId) {
  try {
    const enriched = getEnrichedMeasures()
    const rels     = getRelationships()
    const dimTabs  = getDimensionTables(datasetId)
    const rawBim   = getRawModelBim()
    global.semanticaModelContext = buildModelContext(enriched, dimTabs, rels, rawBim)
    global.semanticaRelGraph     = new RelationshipGraph(rels)
    saveModelSnapshot(datasetId, global.semanticaModelContext)
    console.log(`[connection] Model context rebuilt: ${rels.length} relationships, ${enriched.length} measures`)
  } catch (e) {
    console.error('[connection] Model context rebuild failed:', e.message)
  }
}

/**
 * Background prefetch: cache model metadata + distinct dimension values.
 * Fire-and-forget — never awaited, never blocks startup.
 */
function prefetchOnConnect(workspaceId, datasetId) {
  ;(async () => {
    try {
      console.log('[prefetch] Starting background prefetch...')
      const ctx = global.semanticaModelContext
      if (!ctx) return

      // 1. Cache TMSL metadata to SQLite (24hr TTL)
      cacheModelMetadata(datasetId, workspaceId, ctx.rawModelBim || {}, ctx.measures, ctx.relationships)
      console.log('[prefetch] Model metadata cached to SQLite')

      // 2. Prefetch distinct values for visible string dimension columns
      const stringCols = ctx.tables.flatMap(t =>
        (t.columns || [])
          .filter(c => !c.isHidden && (c.dataType === 'string' || c.dataType === 'String'))
          .map(c => ({ fqn: `${t.name}[${c.name}]`, table: t.name, column: c.name }))
      ).slice(0, 20)  // cap at 20 to stay within rate limits

      for (const col of stringCols) {
        try {
          if (getCachedDistinctValues(col.fqn, datasetId)) continue  // already cached

          const dax    = `EVALUATE TOPN(1000, VALUES('${col.table}'[${col.column}]), '${col.table}'[${col.column}], ASC)`
          const result = await rateLimitedCall(() => executeQueryMulti(dax))
          if (Array.isArray(result) && result.length > 0) {
            const values = result.map(r => Object.values(r)[0]).filter(v => v != null)
            cacheDistinctValues(col.fqn, datasetId, values)
            console.log(`[prefetch] Cached ${values.length} values for ${col.fqn}`)
          }

          await new Promise(r => setTimeout(r, 200))  // 200ms spacing to respect rate limit
        } catch (e) {
          console.warn(`[prefetch] Failed for ${col.fqn}:`, e.message?.slice(0, 80))
        }
      }

      console.log('[prefetch] Background prefetch complete')
    } catch (e) {
      console.warn('[prefetch] Background prefetch error:', e.message)
    }
  })()
}

async function reinitEngine(ws) {
  const authMode = ws.authMode || 'service_principal'
  process.env.AUTH_MODE = authMode

  if (authMode === 'interactive') {
    // Seed when EITHER token is supplied: fresh login carries the access token; a
    // restart / workspace-switch restores from the saved snapshot's refresh token
    // (access tokens expire, so they aren't persisted). Only skip when BOTH are
    // absent (a post-reload reconnect where the renderer no longer holds tokens),
    // so we preserve whatever the main process already has.
    if (ws.accessToken || ws.refreshToken) {
      setInteractiveTokens(ws.accessToken || '', ws.refreshToken, ws.expiresIn || 3600)
    }
  } else {
    process.env.FABRIC_TENANT_ID      = ws.tenantId
    process.env.FABRIC_CLIENT_ID      = ws.clientId
    process.env.FABRIC_CLIENT_SECRET  = ws.clientSecret
    await forceRefresh()
  }

  process.env.FABRIC_WORKSPACE_ID    = ws.workspaceId
  process.env.FABRIC_DATASET_ID      = ws.datasetId
  process.env.FABRIC_DATASET_NAME    = ws.datasetName   || ''
  process.env.FABRIC_LAKEHOUSE_NAME  = ws.lakehouseName || ''
  if (ws.workspaceName) {
    process.env.XMLA_ENDPOINT = `powerbi://api.powerbi.com/v1.0/myorg/${encodeURIComponent(ws.workspaceName)}`
  }

  await fetchMeasures()
  startAutoRefresh()
  if (ws.lakehouseId || ws.lakehouseName) {
    await initLakehouse().catch(e => console.log('[connection] Lakehouse reinit failed:', e.message))
  }

  // Rebuild model context + relationship graph with fresh TMSL data
  rebuildModelContext(process.env.FABRIC_DATASET_ID)

  // Background prefetch: cache model metadata + dimension distinct values
  prefetchOnConnect(process.env.FABRIC_WORKSPACE_ID, process.env.FABRIC_DATASET_ID)

  console.log(`[connection] Engine reinitialized for "${ws.datasetName}" in "${ws.workspaceName}"`)

  const win = _getMainWindow?.()
  const measures   = getMeasuresList()
  const dimensions = getDimensionTables(process.env.FABRIC_DATASET_ID)
  if (win && (measures.length > 0 || dimensions.length > 0)) {
    win.webContents.send('metadata-updated', { measures, dimensions })
  }
}

// ── PKCE helpers ──────────────────────────────────────────────────────────────

const MS_CLIENT_ID   = 'ea0616ba-638b-4df5-95b9-636659ae5121'
const MS_REDIRECT    = 'https://login.microsoftonline.com/common/oauth2/nativeclient'
const MS_SCOPE       = 'https://analysis.windows.net/powerbi/api/.default offline_access'
const MS_AUTH_BASE   = 'https://login.microsoftonline.com/common/oauth2/v2.0'

function generatePKCE() {
  const codeVerifier  = crypto.randomBytes(32).toString('base64url')
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')
  return { codeVerifier, codeChallenge }
}

// ── Token fetch for SP credentials ───────────────────────────────────────────

async function fetchTokenSP(tenantId, clientId, clientSecret) {
  const res = await axios.post(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     clientId,
      client_secret: clientSecret,
      scope:         'https://analysis.windows.net/powerbi/api/.default',
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
  )
  return res.data.access_token
}

// Resolve a bearer token from either accessToken directly or SP credentials
async function resolveToken(params) {
  if (params.accessToken) return params.accessToken
  // Interactive sign-in: the bearer token lives ONLY in the main process — use it
  // here instead of requiring the renderer to hand one back. Service-principal
  // mode falls through to a fresh SP token.
  if ((process.env.AUTH_MODE || 'service_principal') === 'interactive') {
    const token = await getToken()
    if (token) return token
  }
  return fetchTokenSP(params.tenantId, params.clientId, params.clientSecret)
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

function register() {

  // ── Microsoft PKCE login ──────────────────────────────────────────────────

  ipcMain.handle('start-ms-login', async () => {
    const { codeVerifier, codeChallenge } = generatePKCE()

    const authUrl = new URL(`${MS_AUTH_BASE}/authorize`)
    authUrl.searchParams.set('client_id',             MS_CLIENT_ID)
    authUrl.searchParams.set('response_type',         'code')
    authUrl.searchParams.set('redirect_uri',          MS_REDIRECT)
    authUrl.searchParams.set('scope',                 MS_SCOPE)
    authUrl.searchParams.set('code_challenge',        codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    authUrl.searchParams.set('prompt',                'select_account')

    return new Promise((resolve, reject) => {
      const win = new BrowserWindow({
        width: 500, height: 700,
        show: true, autoHideMenuBar: true,
        title: 'Sign in to Microsoft Fabric',
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      })

      win.loadURL(authUrl.toString())

      let settled = false
      function settle(fn, val) { if (!settled) { settled = true; fn(val) } }

      async function handleUrl(url) {
        if (!url.startsWith(MS_REDIRECT) || settled) return
        settled = true  // claim before close to prevent 'closed' firing as rejection

        const params = new URL(url).searchParams
        const code   = params.get('code')
        const error  = params.get('error')

        if (!win.isDestroyed()) win.close()

        if (error) {
          reject(new Error(params.get('error_description') || error))
          return
        }
        if (!code) {
          reject(new Error('No authorization code in redirect'))
          return
        }

        try {
          const res = await axios.post(
            `${MS_AUTH_BASE}/token`,
            new URLSearchParams({
              client_id:     MS_CLIENT_ID,
              grant_type:    'authorization_code',
              code,
              redirect_uri:  MS_REDIRECT,
              code_verifier: codeVerifier,
              scope:         MS_SCOPE,
            }).toString(),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
          )
          resolve({
            success:      true,
            accessToken:  res.data.access_token,
            refreshToken: res.data.refresh_token,
            expiresIn:    res.data.expires_in,
          })
        } catch (err) {
          reject(new Error(err.response?.data?.error_description || err.message))
        }
      }

      win.webContents.on('will-redirect', (_e, url) => handleUrl(url))
      win.webContents.on('did-navigate',  (_e, url) => handleUrl(url))
      win.on('closed', () => settle(reject, new Error('Login window closed')))
    }).catch(err => ({ success: false, error: err.message }))
  })

  // ── List workspaces ───────────────────────────────────────────────────────

  ipcMain.handle('test-auth', async (_e, params) => {
    try {
      const token = await resolveToken(params)
      return token ? { success: true } : { success: false, error: 'No token returned' }
    } catch (e) {
      return { success: false, error: e.response?.data?.error_description || e.message }
    }
  })

  ipcMain.handle('get-workspaces', async (_e, params) => {
    try {
      // Fall back to the active workspace's credentials if none provided
      const effectiveParams = (params?.accessToken || params?.clientSecret)
        ? params
        : getActiveWorkspace() || params || {}
      const token = await resolveToken(effectiveParams)
      const res   = await axios.get('https://api.powerbi.com/v1.0/myorg/groups', {
        headers: { Authorization: `Bearer ${token}` }, timeout: 15000,
      })
      return { success: true, workspaces: (res.data.value || []).map(w => ({ id: w.id, name: w.name })) }
    } catch (e) {
      return { success: false, error: e.response?.data?.error?.message || e.message, workspaces: [] }
    }
  })

  ipcMain.handle('get-datasets', async (_e, params) => {
    try {
      // Fall back to the active workspace's credentials if none provided
      const effectiveParams = (params?.accessToken || params?.clientSecret)
        ? params
        : { ...(getActiveWorkspace() || {}), ...params }
      const token = await resolveToken(effectiveParams)
      const res   = await axios.get(
        `https://api.powerbi.com/v1.0/myorg/groups/${params.workspaceId}/datasets`,
        { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }
      )
      return { success: true, datasets: (res.data.value || []).map(d => ({ id: d.id, name: d.name })) }
    } catch (e) {
      return { success: false, error: e.response?.data?.error?.message || e.message, datasets: [] }
    }
  })

  ipcMain.handle('get-lakehouses', async (_e, params) => {
    try {
      const token = await resolveToken(params)
      const res   = await axios.get(
        `https://api.fabric.microsoft.com/v1/workspaces/${params.workspaceId}/lakehouses`,
        { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }
      )
      return { success: true, lakehouses: (res.data.value || []).map(l => ({ id: l.id, name: l.displayName })) }
    } catch (e) {
      return { success: false, error: e.response?.data?.message || e.message, lakehouses: [] }
    }
  })

  // ── Save workspace config + reinit engine ─────────────────────────────────

  ipcMain.handle('save-workspace', async (_e, config) => {
    try {
      const cfg  = readConfig()
      const list = cfg.workspaces || []
      const id   = `${config.workspaceId}_${config.datasetId}`
      const authMode = config.authMode || 'service_principal'

      // Encrypt the appropriate secret
      const secretFields = authMode === 'interactive'
        ? (() => {
            const { enc, plain } = encryptStr(config.refreshToken || '')
            return { refreshTokenEnc: enc, refreshTokenPlain: plain, clientSecretEnc: null, clientSecretPlain: null }
          })()
        : (() => {
            const { enc, plain } = encryptStr(config.clientSecret || '')
            return { clientSecretEnc: enc, clientSecretPlain: plain, refreshTokenEnc: null, refreshTokenPlain: null }
          })()

      const entry = {
        id,
        authMode,
        tenantId:      config.tenantId      || null,
        clientId:      config.clientId      || null,
        ...secretFields,
        workspaceId:   config.workspaceId,
        workspaceName: config.workspaceName,
        datasetId:     config.datasetId,
        datasetName:   config.datasetName,
        lakehouseId:   config.lakehouseId   || null,
        lakehouseName: config.lakehouseName || null,
        savedAt:       new Date().toISOString(),
      }

      const idx = list.findIndex(w => w.id === id)
      if (idx >= 0) list[idx] = entry
      else          list.push(entry)
      writeConfig({ workspaces: list, activeWorkspace: id, loggedOut: false })

      // Reinit engine with decrypted secrets
      const reinitWs = {
        ...entry,
        clientSecret: config.clientSecret || '',
        refreshToken: config.refreshToken || '',
        accessToken:  config.accessToken  || '',
        expiresIn:    config.expiresIn    || 3600,
      }
      await reinitEngine(reinitWs)

      console.log('[connection] Workspace saved:', id)
      return { success: true, config: getSavedWorkspacesSafe().find(w => w.id === id) }
    } catch (e) {
      console.error('[connection] save-workspace error:', e.message)
      return { success: false, error: e.message }
    }
  })

  // ── Get current workspace config (datasetId etc) ─────────────────────────

  ipcMain.handle('get-workspace-config', () => getWorkspaceConfig())

  // ── List saved workspaces (no secrets) ───────────────────────────────────

  ipcMain.handle('get-saved-workspaces', async () => {
    const cfg = readConfig()
    return { workspaces: getSavedWorkspacesSafe(), activeWorkspace: cfg.activeWorkspace }
  })

  // ── Switch active workspace ───────────────────────────────────────────────

  ipcMain.handle('switch-workspace', async (_e, { id }) => {
    try {
      const cfg  = readConfig()
      const raw  = (cfg.workspaces || []).find(w => w.id === id)
      if (!raw) return { success: false, error: 'Workspace not found' }
      cfg.activeWorkspace = id
      writeConfig(cfg)
      await reinitEngine(hydrate(raw))
      return { success: true, config: getSavedWorkspacesSafe().find(w => w.id === id) }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  // ── Connect to a new workspace+dataset using current auth session ─────────
  // Used by "New Project" dialog — clones credentials from the active workspace
  // so the user doesn't need to re-enter SP credentials or re-sign in.
  ipcMain.handle('connect-dataset', async (_e, params) => {
    const { workspaceId, workspaceName, datasetId, datasetName } = params
    try {
      // Try active workspace first, then fall back to credentials passed from frontend
      const active = getActiveWorkspace()
      const authMode = params.authMode || active?.authMode || 'service_principal'

      // Resolve credentials: active session → frontend params
      let tenantId = active?.tenantId || params.tenantId || null
      let clientId = active?.clientId || params.clientId || null
      let clientSecret = active?.clientSecret || params.clientSecret || ''
      let refreshToken = active?.refreshToken || params.refreshToken || ''
      let accessToken = active?.accessToken || params.accessToken || ''
      let expiresIn = active?.expiresIn || params.expiresIn || 3600

      if (!accessToken && !clientSecret && !refreshToken) {
        return { success: false, error: 'No credentials available — please sign in first' }
      }

      const cfg  = readConfig()
      const list = cfg.workspaces || []
      const id   = `${workspaceId}_${datasetId}`

      const secretFields = authMode === 'interactive'
        ? (() => { const { enc, plain } = encryptStr(refreshToken); return { refreshTokenEnc: enc, refreshTokenPlain: plain, clientSecretEnc: null, clientSecretPlain: null } })()
        : (() => { const { enc, plain } = encryptStr(clientSecret); return { clientSecretEnc: enc, clientSecretPlain: plain, refreshTokenEnc: null, refreshTokenPlain: null } })()

      const entry = {
        id, authMode, tenantId, clientId,
        ...secretFields,
        workspaceId, workspaceName, datasetId, datasetName,
        lakehouseId: null, lakehouseName: null,
        savedAt: new Date().toISOString(),
      }

      const idx = list.findIndex(w => w.id === id)
      if (idx >= 0) list[idx] = entry
      else list.push(entry)
      writeConfig({ workspaces: list, activeWorkspace: id, loggedOut: false })

      await reinitEngine({
        ...entry, clientSecret, refreshToken, accessToken, expiresIn,
      })

      console.log('[connection] Connected to dataset:', id)
      return { success: true, config: getSavedWorkspacesSafe().find(w => w.id === id) }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  // ── Re-authenticate active Microsoft Account workspace ───────────────────

  ipcMain.handle('reauth-microsoft', async () => {
    // Reuse the PKCE login flow, then update the active workspace tokens
    return new Promise((resolve) => {
      const { codeVerifier, codeChallenge } = generatePKCE()

      const authUrl = new URL(`${MS_AUTH_BASE}/authorize`)
      authUrl.searchParams.set('client_id',             MS_CLIENT_ID)
      authUrl.searchParams.set('response_type',         'code')
      authUrl.searchParams.set('redirect_uri',          MS_REDIRECT)
      authUrl.searchParams.set('scope',                 MS_SCOPE)
      authUrl.searchParams.set('code_challenge',        codeChallenge)
      authUrl.searchParams.set('code_challenge_method', 'S256')
      authUrl.searchParams.set('prompt',                'select_account')

      const win = new BrowserWindow({
        width: 500, height: 700,
        show: true, autoHideMenuBar: true,
        title: 'Sign in to Microsoft Fabric',
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      })

      win.loadURL(authUrl.toString())

      let settled = false
      function settle(val) { if (!settled) { settled = true; resolve(val) } }

      async function handleUrl(url) {
        if (!url.startsWith(MS_REDIRECT) || settled) return
        settled = true

        const params = new URL(url).searchParams
        const code   = params.get('code')
        const error  = params.get('error')

        if (!win.isDestroyed()) win.close()

        if (error || !code) {
          settle({ success: false, error: params.get('error_description') || error || 'No code' })
          return
        }

        try {
          const res = await axios.post(
            `${MS_AUTH_BASE}/token`,
            new URLSearchParams({
              client_id:     MS_CLIENT_ID,
              grant_type:    'authorization_code',
              code,
              redirect_uri:  MS_REDIRECT,
              code_verifier: codeVerifier,
              scope:         MS_SCOPE,
            }).toString(),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
          )

          const { access_token, refresh_token, expires_in } = res.data

          // Update active workspace config with new tokens
          const cfg = readConfig()
          const activeId = cfg.activeWorkspace
          const idx = (cfg.workspaces || []).findIndex(w => w.id === activeId)
          if (idx >= 0) {
            const { enc, plain } = encryptStr(refresh_token || '')
            cfg.workspaces[idx].refreshTokenEnc   = enc
            cfg.workspaces[idx].refreshTokenPlain = plain
            writeConfig(cfg)
          }

          // Update in-memory auth state
          setInteractiveTokens(access_token, refresh_token, expires_in || 3600)

          settle({ success: true })
        } catch (err) {
          settle({ success: false, error: err.response?.data?.error_description || err.message })
        }
      }

      win.webContents.on('will-redirect', (_e, url) => handleUrl(url))
      win.webContents.on('did-navigate',  (_e, url) => handleUrl(url))
      win.on('closed', () => settle({ success: false, error: 'Login window closed' }))
    })
  })

  // ── Delete a saved workspace ──────────────────────────────────────────────

  ipcMain.handle('delete-workspace', async (_e, { id }) => {
    try {
      const cfg = readConfig()
      cfg.workspaces = (cfg.workspaces || []).filter(w => w.id !== id)
      if (cfg.activeWorkspace === id) cfg.activeWorkspace = cfg.workspaces[0]?.id || null
      writeConfig(cfg)
      return { success: true }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('logout-all', async () => {
    try {
      writeConfig({ workspaces: [], activeWorkspace: null, loggedOut: true })
      // Clear the in-memory model context so a different account/SP never sees a
      // previous dataset's schema (e.g. cricket) leaking into generation.
      global.semanticaModelContext = null
      global.semanticaRelGraph     = null
      return { success: true }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })
}

function getWorkspaceConfig() {
  const local = require('../../src/powerbi/localRuntime').current();
  if (local) return local.info;
  return {
    workspaceId: process.env.FABRIC_WORKSPACE_ID || '',
    workspaceName: getActiveWorkspace()?.workspaceName || '',
    datasetId:   process.env.FABRIC_DATASET_ID   || '',
    datasetName: process.env.FABRIC_DATASET_NAME  || '',
  }
}

module.exports = { register, getActiveWorkspace, isLoggedOut, getSavedWorkspacesSafe, reinitEngine, setMainWindowGetter, getWorkspaceConfig, resolveToken }
