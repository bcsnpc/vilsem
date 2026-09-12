/**
 * Power BI Mode — IPC handlers
 *
 * Talks to the modern Fabric Items REST API to read and write Power BI
 * reports as JSON definition parts. No .pbix, no zip, no binary.
 *
 * IPC channels exposed:
 *   pbi-list-reports               — list reports in a workspace (5 min cache)
 *   pbi-get-report-definition-v2   — fetch report parts (PBIR-Legacy format)
 *   pbi-update-report-definition   — write parts back to an existing report (LRO)
 *   pbi-create-report              — create a brand-new report from parts (LRO)
 *   pbi-create-blank-report        — return an in-memory blank parts skeleton
 */

const { ipcMain } = require('electron/main')
const { dialog, BrowserWindow } = require('electron')
const axios       = require('axios')
const { getToken, forceRefresh } = require('../../src/auth/auth')
const { rateLimitedCall }        = require('../../src/queue/limiter')
const {
  savePbiReportDraft,
  getPbiReportDrafts,
  getPbiReportDraftFor,
  deletePbiReportDraft,
} = require('../../src/cache/sqlite')

// Power BI REST API — used only for listing reports (the v1.0/myorg surface
// is the canonical place to enumerate reports per workspace).
const PBI_BASE = 'https://api.powerbi.com/v1.0/myorg'
// Modern Fabric REST API — used for definition read/write + LROs.
const FABRIC_BASE = 'https://api.fabric.microsoft.com/v1'

const REPORT_LIST_TTL_MS = 5 * 60 * 1000

// In-memory report-list cache: key = `${workspaceId}|${datasetId || '*'}`
const reportListCache = new Map()

// ── HTTP helper ──────────────────────────────────────────────────────────────

/**
 * Wrap a REST call with the shared rate limiter and a single
 * 401 → forceRefresh → retry pass.
 */
async function pbiRequest(makeCall) {
  return rateLimitedCall(async () => {
    let token = await getToken()
    try {
      return await makeCall(token)
    } catch (err) {
      const status = err.response?.status
      if (status === 401) {
        token = await forceRefresh()
        return await makeCall(token)
      }
      throw err
    }
  })
}

function normalizeError(err) {
  const status = err.response?.status
  const body   = err.response?.data
  const msg    =
    body?.error?.message ||
    body?.message ||
    (typeof body === 'string' ? body : null) ||
    err.message ||
    'Unknown Fabric API error'

  let code = 'PBI_ERROR'
  if (status === 401) code = 'PBI_UNAUTHORIZED'
  else if (status === 403) code = 'PBI_FORBIDDEN'
  else if (status === 404) code = 'PBI_NOT_FOUND'
  else if (status === 413) code = 'PBI_PAYLOAD_TOO_LARGE'
  else if (status === 429) code = 'PBI_THROTTLED'

  return { code, status: status || null, message: msg }
}

/**
 * Dump full Fabric error response details to the main-process console
 * and return a clean { success: false, status, message } object.
 * Used in catch blocks for the v2 handlers so we always see exactly
 * what Fabric rejected.
 */
function reportFabricError(label, err) {
  if (err.response) {
    const status = err.response.status
    const body   = typeof err.response.data === 'string'
      ? err.response.data
      : (() => { try { return JSON.stringify(err.response.data) } catch { return String(err.response.data) } })()
    console.error(`=== FABRIC ${label} ERROR ===`)
    console.error('Status:', status)
    console.error('Body:',   body)
    console.error('============================')
    return { success: false, status, message: body }
  }
  const e = normalizeError(err)
  console.error(`[powerbi] ${label} failed:`, e.code, e.status, e.message)
  return { success: false, ...e }
}

// ── Long Running Operation polling ──────────────────────────────────────────

/**
 * Poll a Fabric LRO until it completes.
 * Fabric returns 202 + Location header pointing to /v1/operations/{id}
 * (or x-ms-operation-id header). We poll every 2s up to ~3 minutes.
 *
 * @returns {Promise<{status: 'Succeeded'|'Failed', result?: any, error?: any}>}
 */
async function pollOperation({ headers, onTick }) {
  const operationId  = headers['x-ms-operation-id'] || headers['operation-id'] || null
  const locationHdr  = headers['location']         || headers['Location']      || null
  const retryAfter   = parseInt(headers['retry-after'] || '2', 10) || 2

  // Build the polling URL — prefer the Location header, fall back to /operations/{id}
  let pollUrl
  if (locationHdr) {
    pollUrl = locationHdr.startsWith('http')
      ? locationHdr
      : `${FABRIC_BASE}${locationHdr.startsWith('/') ? '' : '/'}${locationHdr}`
  } else if (operationId) {
    pollUrl = `${FABRIC_BASE}/operations/${operationId}`
  } else {
    return { status: 'Succeeded', result: null }  // no LRO at all → already done
  }

  const MAX_TICKS = 90  // 90 * 2s = 180s ceiling
  let lastBody = null

  for (let i = 0; i < MAX_TICKS; i++) {
    await new Promise((r) => setTimeout(r, Math.max(retryAfter, 2) * 1000))

    try {
      const res = await pbiRequest((token) =>
        axios.get(pollUrl, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000,
          // Don't throw on 202 — that means "still running"
          validateStatus: (s) => s === 200 || s === 202,
        })
      )
      lastBody = res.data
      const status = (res.data && res.data.status) || (res.status === 202 ? 'Running' : 'Succeeded')
      onTick?.(status)
      if (status === 'Succeeded') {
        // Some LROs return the result in a separate /result endpoint
        let result = res.data?.result || res.data || null
        try {
          if (!res.data?.result) {
            const rr = await pbiRequest((token) =>
              axios.get(`${pollUrl}/result`, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 15000,
                validateStatus: (s) => s === 200 || s === 404,
              })
            )
            if (rr.status === 200) result = rr.data
          }
        } catch { /* /result is optional */ }
        return { status: 'Succeeded', result, raw: lastBody }
      }
      if (status === 'Failed') {
        return { status: 'Failed', error: res.data?.error || res.data, raw: lastBody }
      }
      // else still Running → loop
    } catch (e) {
      // If polling errors transiently, swallow once and retry
      console.warn('[powerbi] LRO poll error:', e.message)
    }
  }
  return { status: 'Failed', error: { message: 'LRO polling timed out after 3 minutes' }, raw: lastBody }
}

// ── List reports (unchanged) ────────────────────────────────────────────────

async function listReports({ workspaceId, datasetId, force, accessToken, tenantId, clientId, clientSecret }) {
  if (!workspaceId) throw new Error('workspaceId is required')

  const cacheKey = `${workspaceId}|${datasetId || '*'}`
  const cached   = reportListCache.get(cacheKey)
  if (!force && cached && Date.now() - cached.at < REPORT_LIST_TTL_MS) {
    return { success: true, reports: cached.reports, cached: true }
  }

  // Prefer the caller-supplied session creds (same ones get-workspaces uses) so
  // report listing works right after sign-in, before the engine token is set up.
  const call = (token) =>
    axios.get(`${PBI_BASE}/groups/${workspaceId}/reports`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 20000,
    }).then((r) => r.data)

  try {
    let data
    if (accessToken || (tenantId && clientId && clientSecret)) {
      const { resolveToken } = require('./connection')
      const credToken = await resolveToken({ accessToken, tenantId, clientId, clientSecret })
      data = await rateLimitedCall(() => call(credToken))
    } else {
      data = await pbiRequest(call)
    }

    let reports = (data.value || []).map((r) => ({
      id:          r.id,
      name:        r.name,
      datasetId:   r.datasetId || null,
      reportType:  r.reportType || null,
      webUrl:      r.webUrl || null,
      embedUrl:    r.embedUrl || null,
      modifiedBy:  r.modifiedBy || null,
      modifiedDateTime: r.modifiedDateTime || null,
    }))

    if (datasetId) {
      reports = reports.filter((r) => r.datasetId === datasetId)
    }

    reportListCache.set(cacheKey, { at: Date.now(), reports })
    return { success: true, reports, cached: false }
  } catch (err) {
    return reportFabricError('LIST', err)
  }
}

// ── v2: Get report definition via Fabric Items API ──────────────────────────

/**
 * POST /v1/workspaces/{workspaceId}/reports/{reportId}/getDefinition?format={fmt}
 *
 * Fabric returns an LRO. The result body is:
 *   { definition: { parts: [{ path, payload, payloadType }] } }
 * where each `payload` is base64-encoded UTF-8 text. We decode each part
 * and return them as { path, content } objects.
 *
 * If the requested format fails or returns 0 parts, this function automatically
 * retries with the OTHER format (PBIR ↔ PBIR-Legacy). Reports originally
 * published in PBIR-Legacy can fail when requested as PBIR, and vice versa.
 * The renderer's parser handles both shapes, so callers don't care which one
 * actually came back — they just see the populated parts array.
 */
async function getReportDefinitionV2({ workspaceId, reportId, format }) {
  if (!workspaceId || !reportId) {
    throw new Error('workspaceId and reportId are required')
  }
  // Default to modern PBIR. Fall back to PBIR-Legacy if PBIR refuses.
  const primary  = format || 'PBIR'
  const fallback = primary === 'PBIR' ? 'PBIR-Legacy' : 'PBIR'

  // First attempt: requested format
  const first = await fetchDefinitionInFormat(workspaceId, reportId, primary)
  if (first.success && Array.isArray(first.parts) && first.parts.length > 0) {
    console.log(`[powerbi] getDefinition succeeded with format=${primary}, parts=${first.parts.length}`)
    return first
  }

  console.warn(`[powerbi] getDefinition with format=${primary} failed or returned no parts (success=${first.success}, parts=${first.parts?.length}, msg=${first.message}). Retrying with format=${fallback}.`)

  // Second attempt: fallback format
  const second = await fetchDefinitionInFormat(workspaceId, reportId, fallback)
  if (second.success && Array.isArray(second.parts) && second.parts.length > 0) {
    console.log(`[powerbi] getDefinition succeeded with fallback format=${fallback}, parts=${second.parts.length}`)
    return second
  }

  // Both formats failed — return the most informative error of the two
  const better = (first.message && first.message.length > (second.message?.length || 0)) ? first : second
  return {
    success: false,
    status:  'Failed',
    message: `Both PBIR and PBIR-Legacy formats failed. Primary (${primary}) error: ${first.message || 'unknown'}. Fallback (${fallback}) error: ${second.message || 'unknown'}`,
    primaryError:  first,
    fallbackError: second,
  }
}

/**
 * Single-shot getDefinition attempt for a specific format. Returns the same
 * shape getReportDefinitionV2 used to return previously.
 */
async function fetchDefinitionInFormat(workspaceId, reportId, fmt) {
  try {
    const initial = await pbiRequest((token) =>
      axios.post(
        `${FABRIC_BASE}/workspaces/${workspaceId}/reports/${reportId}/getDefinition?format=${fmt}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
          validateStatus: (s) => s === 200 || s === 202,
        }
      )
    )

    let definition = null
    if (initial.status === 200) {
      definition = initial.data?.definition || initial.data || null
    } else {
      const op = await pollOperation({ headers: initial.headers })
      if (op.status !== 'Succeeded') {
        const msg = op.error?.message || op.error?.errorCode || 'getDefinition LRO failed'
        return { success: false, status: 'Failed', message: msg, format: fmt }
      }
      definition = op.result?.definition || op.result || null
    }

    if (!definition || !Array.isArray(definition.parts)) {
      return { success: false, message: 'Fabric did not return any parts', format: fmt }
    }

    const parts = definition.parts.map((p) => ({
      path: p.path,
      payloadType: p.payloadType || 'InlineBase64',
      payload: p.payload,
      content: decodePart(p),
    }))

    return { success: true, parts, format: fmt }
  } catch (err) {
    const e = reportFabricError(`GET_DEFINITION_V2(${fmt})`, err)
    return { ...e, format: fmt }
  }
}

function decodePart(part) {
  try {
    if (!part || !part.payload) return ''
    return Buffer.from(part.payload, 'base64').toString('utf8')
  } catch {
    return ''
  }
}

// ── v2: Update existing report definition ───────────────────────────────────

/**
 * POST /v1/workspaces/{workspaceId}/reports/{reportId}/updateDefinition
 *
 * Body: { definition: { parts: [{ path, payload: <base64>, payloadType: "InlineBase64" }] } }
 * Fabric responds with 202 + Location → poll until Succeeded.
 */
async function updateReportDefinition({ workspaceId, reportId, parts }) {
  if (!workspaceId || !reportId) throw new Error('workspaceId and reportId are required')
  if (!Array.isArray(parts) || parts.length === 0) throw new Error('parts array is required')

  try {
    const body = { definition: { parts: encodeParts(parts) } }
    const updateMetadata = parts.some(part => part.path === '.platform')

    const initial = await pbiRequest((token) =>
      axios.post(
        `${FABRIC_BASE}/workspaces/${workspaceId}/reports/${reportId}/updateDefinition?updateMetadata=${updateMetadata}`,
        body,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 120000,
          maxContentLength: 200 * 1024 * 1024,
          maxBodyLength:    200 * 1024 * 1024,
          validateStatus: (s) => s === 200 || s === 202,
        }
      )
    )

    if (initial.status === 200) {
      // Some tenants return 200 immediately
      invalidateReportCache(workspaceId)
      return { success: true, status: 'Succeeded', operationId: null, reportId }
    }

    const operationId = initial.headers['x-ms-operation-id'] || null
    const op = await pollOperation({ headers: initial.headers })
    if (op.status === 'Succeeded') {
      invalidateReportCache(workspaceId)
      return { success: true, status: 'Succeeded', operationId, reportId, raw: op.raw }
    }
    return {
      success: false,
      status: 'Failed',
      operationId,
      message: op.error?.message || op.error?.errorCode || 'updateDefinition LRO failed',
      raw: op.raw,
    }
  } catch (err) {
    return reportFabricError('UPDATE_DEFINITION', err)
  }
}

// ── v2: Create a brand-new report ───────────────────────────────────────────

/**
 * POST /v1/workspaces/{workspaceId}/reports
 *
 * Body: { displayName, definition: { parts: [...] } }
 * Fabric responds with 201/202. On success the new reportId comes back
 * either in the result body or by polling the LRO.
 */
async function createReport({ workspaceId, reportName, parts, description }) {
  if (!workspaceId) throw new Error('workspaceId is required')
  if (!reportName)  throw new Error('reportName is required')
  if (!Array.isArray(parts) || parts.length === 0) throw new Error('parts array is required')

  try {
    const body = {
      displayName: reportName,
      ...(description ? { description } : {}),
      definition: { parts: encodeParts(parts) },
    }

    const initial = await pbiRequest((token) =>
      axios.post(
        `${FABRIC_BASE}/workspaces/${workspaceId}/reports`,
        body,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 120000,
          maxContentLength: 200 * 1024 * 1024,
          maxBodyLength:    200 * 1024 * 1024,
          validateStatus: (s) => s === 200 || s === 201 || s === 202,
        }
      )
    )

    // Path 1 — completed inline (200/201): the response body is the new item
    if (initial.status === 200 || initial.status === 201) {
      invalidateReportCache(workspaceId)
      const reportId = initial.data?.id || null
      return { success: true, status: 'Succeeded', reportId, reportName, raw: initial.data }
    }

    // Path 2 — LRO (202): poll for the result, which contains the created item
    const operationId = initial.headers['x-ms-operation-id'] || null
    const op = await pollOperation({ headers: initial.headers })
    if (op.status === 'Succeeded') {
      invalidateReportCache(workspaceId)
      const reportId = op.result?.id || op.result?.reportId || null
      return { success: true, status: 'Succeeded', operationId, reportId, reportName, raw: op.raw }
    }
    return {
      success: false,
      status: 'Failed',
      operationId,
      message: op.error?.message || op.error?.errorCode || 'createReport LRO failed',
      raw: op.raw,
    }
  } catch (err) {
    return reportFabricError('CREATE_REPORT', err)
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Re-encode parts from { path, content } back into the Fabric API shape
 * { path, payload: <base64>, payloadType: "InlineBase64" }.
 * Accepts parts that are already in the API shape (passes them through).
 */
function encodeParts(parts) {
  return parts.map((p) => {
    // Preserve original bytes for untouched resources, including invalid UTF-8.
    // Callers may retain payload while editing content via object spread.
    const contentChanged = typeof p.content === 'string' && p.content !== decodePart(p)
    if (typeof p.payload === 'string' && !contentChanged) {
      return {
        path: p.path,
        payload: p.payload,
        payloadType: p.payloadType || 'InlineBase64',
      }
    }
    const text = typeof p.content === 'string' ? p.content : JSON.stringify(p.content || {})
    return {
      path: p.path,
      payload: Buffer.from(text, 'utf8').toString('base64'),
      payloadType: 'InlineBase64',
    }
  })
}

function invalidateReportCache(workspaceId) {
  for (const k of reportListCache.keys()) {
    if (k.startsWith(`${workspaceId}|`)) reportListCache.delete(k)
  }
}

/**
 * Build an in-memory blank parts skeleton for a brand-new report.
 * Pure function — no network. Caller injects pages/visuals via reportBuilder
 * before calling createReport.
 */
function createBlankReport({ datasetId, reportName }) {
  if (!datasetId)  throw new Error('datasetId is required')
  if (!reportName) throw new Error('reportName is required')

  const reportJson = {
    id: 0,
    resourcePackages: [],
    sections: [],
    config: JSON.stringify({
      version: '5.42',
      themeCollection: { baseTheme: { name: 'CY24SU06', version: '5.42' } },
    }),
    filters: '[]',
    layoutOptimization: 0,
  }

  const definitionPbir = {
    version: '4.0',
    datasetReference: {
      byConnection: {
        connectionString:        null,
        pbiServiceModelId:       null,
        pbiModelVirtualServerName: 'sobe_wowvirtualserver',
        pbiModelDatabaseName:    datasetId,
        name:                    'EntityDataSource',
        connectionType:          'pbiServiceXmlaStyleLive',
      },
    },
  }

  const platform = {
    $schema: 'https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json',
    metadata: { type: 'Report', displayName: reportName },
    config:   { version: '2.0', logicalId: cryptoRandomUuid() },
  }

  return {
    success: true,
    reportName,
    parts: [
      { path: 'report.json',     content: JSON.stringify(reportJson) },
      { path: 'definition.pbir', content: JSON.stringify(definitionPbir) },
      { path: '.platform',       content: JSON.stringify(platform) },
    ],
  }
}

function cryptoRandomUuid() {
  // Node 14+ has crypto.randomUUID
  try { return require('crypto').randomUUID() } catch { /* fall through */ }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// ── Draft persistence (local SQLite) ────────────────────────────────────────

function saveDraft(params) {
  try {
    const id = savePbiReportDraft(params || {})
    if (id == null) {
      return { success: false, message: 'Could not save draft (db unavailable or missing fields)' }
    }
    return { success: true, id, savedAt: new Date().toISOString() }
  } catch (e) {
    console.error('[powerbi] saveDraft failed:', e.message)
    return { success: false, message: e.message }
  }
}

function listDrafts({ workspaceId } = {}) {
  try {
    return { success: true, drafts: getPbiReportDrafts(workspaceId) || [] }
  } catch (e) {
    console.error('[powerbi] listDrafts failed:', e.message)
    return { success: false, message: e.message, drafts: [] }
  }
}

function getDraftForReport({ workspaceId, reportId } = {}) {
  try {
    const draft = getPbiReportDraftFor(workspaceId, reportId)
    return { success: true, draft: draft || null }
  } catch (e) {
    console.error('[powerbi] getDraftForReport failed:', e.message)
    return { success: false, message: e.message, draft: null }
  }
}

function deleteDraft({ id } = {}) {
  try {
    deletePbiReportDraft(id)
    return { success: true }
  } catch (e) {
    console.error('[powerbi] deleteDraft failed:', e.message)
    return { success: false, message: e.message }
  }
}

// ── Bundled .pbiviz loader ──────────────────────────────────────────────────
//
// A .pbiviz file is a ZIP containing: package.json (metadata), resources/
// visual.js (the visual code), resources/visual.css (styles), resources/
// <guid>.png (icon), etc. Modern PBIR does NOT accept a .pbiviz as a single
// embedded part — its schema's ResourcePackageItemType enum only permits
// individual piece types: CustomVisualJavascript, CustomVisualsCss,
// CustomVisualIcon, CustomVisualMetadata.
//
// So we unzip the .pbiviz and return each piece base64-encoded separately.
// reportBuilder.js then creates one resourcePackage of type `CustomVisual`
// (outer type) with items pointing to each piece, and adds each piece as
// its own PBIR part under `definition/customVisuals/<guid>/`.

const fs     = require('fs')
const path   = require('path')
const AdmZip = require('adm-zip')

// Cache keyed by (filename, mtime) so rebuilds of the .pbiviz are picked up
// without requiring an Electron restart. Previously a plain `null` check meant
// the first-read pbiviz stuck until process exit — republishes kept shipping
// the stale visual bundle even after `pbiviz package` produced a newer one.
let bundledPbivizCache = null  // { key: string, value: {...} }

// Resolve the pbiviz dist dir. In a PACKAGED app the electron code lives inside
// app.asar, but the .pbiviz files are asarUnpack'd to app.asar.unpacked. Reading
// through the app.asar path relies on Electron's asar redirection, which adm-zip's
// random-access (openSync + positioned reads) does not always get served
// correctly — yielding malformed custom-visual parts that Fabric then rejects at
// report-create time. Point every reader at the real unpacked path so fs and
// adm-zip see the actual bytes. In dev (no asar) this is a no-op.
function pbivizDistDir() {
  const base = path.join(__dirname, '..', '..', 'pbiviz-semantica-renderer', 'dist')
  const marker = `app.asar${path.sep}`
  if (base.includes(marker) && !base.includes('app.asar.unpacked')) {
    const unpacked = base.replace(marker, `app.asar.unpacked${path.sep}`)
    try { if (fs.existsSync(unpacked)) return unpacked } catch { /* fall through to base */ }
  }
  return base
}

// Parse the 4-part version from a .pbiviz filename, e.g.
// "semanticaRenderer<guid>.4.12.0.0.pbiviz" → [4,12,0,0]. Non-matching names
// sort last.
function pbivizVersion(name) {
  const m = name.match(/\.(\d+)\.(\d+)\.(\d+)\.(\d+)\.pbiviz$/i)
  return m ? [+m[1], +m[2], +m[3], +m[4]] : [-1, -1, -1, -1]
}

// Pick the newest semanticaRenderer .pbiviz by VERSION, not mtime. electron-builder
// normalizes file mtimes when it packages, so an mtime sort is non-deterministic in
// the installed app — it could grab the wrong visual (an old semanticaHtmlRenderer, a
// 3KB stub, or a mismatched guid), and the report then references a custom-visual
// resource that isn't in the parts → Fabric rejects the import ("file not found").
// Restricting to the semanticaRenderer prefix + version sort is stable across dev and
// packaged, so both always embed the same correct file.
function pickRendererPbiviz(distDir) {
  const files = fs.readdirSync(distDir)
    .filter((f) => f.startsWith('semanticaRenderer') && f.endsWith('.pbiviz'))
  if (!files.length) return null
  return files.sort((a, b) => {
    const va = pbivizVersion(a), vb = pbivizVersion(b)
    for (let i = 0; i < 4; i++) { if (vb[i] !== va[i]) return vb[i] - va[i] }
    return a.localeCompare(b)
  })[0]
}

function getBundledPbiviz() {
  const distDir = pbivizDistDir()

  let pbivizFile = null
  let pbivizMtime = 0
  try {
    pbivizFile = pickRendererPbiviz(distDir)
    if (!pbivizFile) {
      return { success: false, message: 'No semanticaRenderer .pbiviz found in ' + distDir }
    }
    pbivizMtime = fs.statSync(path.join(distDir, pbivizFile)).mtimeMs
  } catch (e) {
    return { success: false, message: 'Failed to list pbiviz dir: ' + e.message }
  }

  const cacheKey = `${pbivizFile}|${pbivizMtime}`
  if (bundledPbivizCache?.key === cacheKey) return bundledPbivizCache.value

  try {
    const fullPath = path.join(distDir, pbivizFile)
    // SECURITY (adm-zip pinned <0.6): safe ONLY because the input is our OWN
    // bundled .pbiviz (pbivizDistDir(), shipped read-only) — never a user-supplied,
    // downloaded, or imported archive — and nothing here extracts to disk. Change
    // the input source and the adm-zip advisory becomes reachable:
    // upgrade adm-zip to >=0.6.0 FIRST. See SECURITY.md ("adm-zip").
    const zip      = new AdmZip(fullPath)
    const entries  = zip.getEntries()

    // Index every zipped file by its internal path. Power BI's .pbiviz format
    // is documented here: https://github.com/microsoft/PowerBI-visuals-tools
    // Typical layout: package.json, resources/visual.js, resources/visual.css,
    // resources/<guid>.png (icon).
    const byPath = {}
    for (const e of entries) {
      if (!e.isDirectory) byPath[e.entryName.replace(/\\/g, '/')] = e
    }

    const findEntry = (predicate) => {
      for (const p of Object.keys(byPath)) {
        if (predicate(p)) return byPath[p]
      }
      return null
    }

    const metadataEntry = findEntry((p) => /(^|\/)package\.json$/i.test(p))
    const jsEntry       = findEntry((p) => /\.js$/i.test(p))
    const cssEntry      = findEntry((p) => /\.css$/i.test(p))
    const iconEntry     = findEntry((p) => /\.png$/i.test(p))

    if (!metadataEntry || !jsEntry) {
      return {
        success: false,
        message: 'Missing package.json or visual.js in .pbiviz. Files: ' + Object.keys(byPath).join(', '),
      }
    }

    const metadataBuf = metadataEntry.getData()
    const jsBuf       = jsEntry.getData()
    const cssBuf      = cssEntry ? cssEntry.getData() : null
    const iconBuf     = iconEntry ? iconEntry.getData() : null

    const metadata = JSON.parse(metadataBuf.toString('utf8'))
    const guid     = metadata?.visual?.guid    || ''
    const name     = metadata?.visual?.name    || ''
    const version  = metadata?.visual?.version || ''

    // Preserve each zip entry's internal path so PBIR references match the
    // .pbiviz's expected layout (e.g. resources/visual.js, resources/visual.css,
    // resources/<guid>.png, package.json at root).
    const toRel = (p) => p.replace(/^\/+/, '')
    const value = {
      success: true,
      filename: pbivizFile,
      guid,
      name,
      version,
      pieces: {
        metadata: { base64: metadataBuf.toString('base64'), relPath: toRel(metadataEntry.entryName) },
        js:       { base64: jsBuf.toString('base64'),       relPath: toRel(jsEntry.entryName) },
        css:      cssBuf  ? { base64: cssBuf.toString('base64'),  relPath: toRel(cssEntry.entryName) }  : null,
        icon:     iconBuf ? { base64: iconBuf.toString('base64'), relPath: toRel(iconEntry.entryName) } : null,
      },
    }
    bundledPbivizCache = { key: cacheKey, value }
    console.log(`[powerbi] bundled .pbiviz loaded: ${pbivizFile} (v${version}, mtime ${new Date(pbivizMtime).toISOString()})`)
    console.log('[powerbi] piece paths:',
      'metadata=' + value.pieces.metadata.relPath,
      'js=' + value.pieces.js.relPath,
      'css=' + value.pieces.css?.relPath,
      'icon=' + value.pieces.icon?.relPath)
    return value
  } catch (e) {
    return { success: false, message: 'Failed to read/unzip ' + pbivizFile + ': ' + e.message }
  }
}

// ── Custom visual parts from bundled .pbiviz ────────────────────────────────
// Reads the .pbiviz (a zip) from disk, extracts every entry, and returns
// them as report parts under CustomVisuals/<guid>/ ready to drop into a
// legacy report.json publish (see docs/CUSTOM_VISUAL_PUBLISH_BREAKTHROUGH.md).
//
// Embedding the visual binary works on Trial, Pro, and every SKU — org-library
// resolution via _OrgStore suffix silently fails via the Fabric API, which is
// why we embed instead of reference.

// mtime-keyed cache — same rationale as getBundledPbiviz(): rebuilds should
// invalidate immediately without an Electron restart.
let bundledCustomVisualPartsCache = null  // { key, value }

function getBundledCustomVisualParts() {
  const distDir = pbivizDistDir()
  let pbivizFile = null
  let pbivizMtime = 0
  try {
    pbivizFile = pickRendererPbiviz(distDir)
    if (!pbivizFile) return { success: false, message: 'No semanticaRenderer .pbiviz in ' + distDir }
    pbivizMtime = fs.statSync(path.join(distDir, pbivizFile)).mtimeMs
  } catch (e) {
    return { success: false, message: 'Failed to list pbiviz dir: ' + e.message }
  }

  const cacheKey = `${pbivizFile}|${pbivizMtime}`
  if (bundledCustomVisualPartsCache?.key === cacheKey) return bundledCustomVisualPartsCache.value

  try {
    const fullPath = path.join(distDir, pbivizFile)
    // SECURITY (adm-zip pinned <0.6): safe ONLY because the input is our OWN
    // bundled .pbiviz (pbivizDistDir(), shipped read-only) — never a user-supplied,
    // downloaded, or imported archive — and nothing here extracts to disk. Change
    // the input source and the adm-zip advisory becomes reachable:
    // upgrade adm-zip to >=0.6.0 FIRST. See SECURITY.md ("adm-zip").
    const zip      = new AdmZip(fullPath)
    const entries  = zip.getEntries().filter((e) => !e.isDirectory)

    // Find guid from package.json inside the zip
    const pkgEntry = entries.find((e) => /(^|\/)package\.json$/i.test(e.entryName))
    if (!pkgEntry) return { success: false, message: 'No package.json in .pbiviz' }
    const pkgBuf = pkgEntry.getData()
    const pkgObj = JSON.parse(pkgBuf.toString('utf8'))
    const guid   = pkgObj?.visual?.guid || pkgObj?.resources?.[0]?.resourceId?.replace(/\.[^.]+$/, '') || ''
    if (!guid) return { success: false, message: 'Could not derive visual guid from package.json' }

    // Map every internal zip path → CustomVisuals/<guid>/<same path>
    const parts = entries.map((e) => {
      const rel = e.entryName.replace(/^\/+/, '').replace(/\\/g, '/')
      return {
        path: `CustomVisuals/${guid}/${rel}`,
        payload: e.getData().toString('base64'),
        payloadType: 'InlineBase64',
      }
    })

    const value = { success: true, guid, filename: pbivizFile, parts }
    bundledCustomVisualPartsCache = { key: cacheKey, value }
    console.log(`[powerbi] bundled custom-visual parts: ${parts.length} files from ${pbivizFile} (guid=${guid})`)
    return value
  } catch (e) {
    return { success: false, message: 'Failed to unzip ' + pbivizFile + ': ' + e.message }
  }
}

// ── IPC registration ────────────────────────────────────────────────────────

/**
 * Return an AAD access token for embedding a report ("embed for your
 * organization"). Only valid for interactive (Microsoft-login) sessions — a
 * service principal cannot embed-for-your-org without a paid capacity, so we
 * return ok:false and the renderer falls back to the wireframe backdrop.
 * The token is never logged.
 */
async function getAccessTokenForEmbed() {
  const authMode = process.env.AUTH_MODE || 'service_principal'
  if (authMode !== 'interactive') {
    return { ok: false, authMode, reason: 'Embedding requires an interactive Microsoft sign-in.' }
  }
  try {
    const token = await getToken()
    if (!token) return { ok: false, authMode, reason: 'No access token available.' }
    return { ok: true, authMode, token, tokenType: 'Aad' }
  } catch (err) {
    return { ok: false, authMode, reason: err?.message || 'Failed to acquire token' }
  }
}

// ── Export a single visual as a self-contained .pbiviz ──────────────────────
// Repackages the bundled semanticaRenderer template with (a) the visual's
// primitiveSpec BAKED into the placeholder token, (b) a UNIQUE guid so several
// exports can coexist in one report, and (c) the visual's title as displayName.
// Saved via a native dialog. The user imports it into Power BI (per-report or as
// an Organizational visual) and binds the fields; PBI queries the model and the
// baked spec draws the chart.
async function exportVisualPackage({ spec, title, fileBase } = {}) {
  try {
    if (!spec || typeof spec !== 'string') return { success: false, message: 'spec (JSON string) is required' }
    const distDir = pbivizDistDir()
    const latest = pickRendererPbiviz(distDir)
    if (!latest) return { success: false, message: 'No semanticaRenderer .pbiviz found in ' + distDir }

    const OLD_GUID = 'semanticaRenderer4A7F2D9B8C3E1F5A6D4B2C8E9F1A3B7D'
    const newGuid  = 'vilsem' + cryptoRandomUuid().replace(/-/g, '')
    const displayName = String(title || 'Vilsem visual').slice(0, 50)

    // SECURITY (adm-zip pinned <0.6): safe ONLY because the input is our OWN
    // bundled .pbiviz template (pbivizDistDir(), shipped read-only) — never a
    // user-supplied, downloaded, or imported archive — and nothing here extracts
    // to disk. Change the input source and the adm-zip advisory becomes
    // reachable: upgrade adm-zip to >=0.6.0 FIRST. See SECURITY.md ("adm-zip").
    const zip = new AdmZip(path.join(distDir, latest))

    // 1. Resource pbiviz.json — bake the spec, swap the guid everywhere, set displayName.
    const resEntry = zip.getEntries().find((e) => /\.pbiviz\.json$/.test(e.entryName))
    if (!resEntry) return { success: false, message: 'resource pbiviz.json not found in template' }
    const obj = JSON.parse(resEntry.getData().toString('utf8'))
    if (!obj.content || typeof obj.content.js !== 'string') return { success: false, message: 'template content.js missing' }
    const before = (obj.content.js.match(/__SEMANTICA_BAKED_SPEC__/g) || []).length
    obj.content.js = obj.content.js.replace(/["']__SEMANTICA_BAKED_SPEC__["']/, JSON.stringify(spec))
    const after = (obj.content.js.match(/__SEMANTICA_BAKED_SPEC__/g) || []).length
    if (before === 0 || after !== 0) return { success: false, message: 'baked-spec placeholder missing/not replaced — rebuild the .pbiviz template' }
    let resStr = JSON.stringify(obj).split(OLD_GUID).join(newGuid)
    const obj2 = JSON.parse(resStr)
    if (obj2.visual) obj2.visual.displayName = displayName
    resStr = JSON.stringify(obj2)
    zip.deleteFile(resEntry.entryName)
    zip.addFile(`resources/${newGuid}.pbiviz.json`, Buffer.from(resStr, 'utf8'))

    // 2. package.json — swap the guid, set displayName.
    const pkgEntry = zip.getEntries().find((e) => /(^|\/)package\.json$/.test(e.entryName))
    const pkg = JSON.parse(pkgEntry.getData().toString('utf8').split(OLD_GUID).join(newGuid))
    if (pkg.visual) pkg.visual.displayName = displayName
    zip.updateFile(pkgEntry.entryName, Buffer.from(JSON.stringify(pkg, null, 2), 'utf8'))

    // 3. Save via a native dialog.
    const defaultName = (String(fileBase || displayName).replace(/[^a-zA-Z0-9]+/g, '') || 'vilsemVisual') + '.pbiviz'
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
    const res = await dialog.showSaveDialog(win, {
      title: 'Export visual as a Power BI .pbiviz',
      defaultPath: defaultName,
      filters: [{ name: 'Power BI custom visual', extensions: ['pbiviz'] }],
    })
    if (res.canceled || !res.filePath) return { success: false, canceled: true }
    fs.writeFileSync(res.filePath, zip.toBuffer())
    console.log('[powerbi] exported visual package:', res.filePath, '(guid', newGuid + ')')
    return { success: true, path: res.filePath, guid: newGuid, displayName }
  } catch (e) {
    return { success: false, message: e?.message || String(e) }
  }
}

function register() {
  // Returns ONLY whether an interactive sign-in with a usable token exists — the
  // bearer token itself never crosses into the renderer. (Replaces the former
  // pbi-get-access-token, which handed the raw token to the UI.)
  ipcMain.handle('pbi-auth-state', async () => {
    const r = await getAccessTokenForEmbed()
    return { ok: !!r.ok, authMode: r.authMode, reason: r.ok ? undefined : r.reason }
  })
  ipcMain.handle('pbi-export-visual-package',       (_e, p) => exportVisualPackage(p || {}))
  ipcMain.handle('pbi-list-reports',                (_e, p) => listReports(p || {}))
  ipcMain.handle('pbi-get-report-definition-v2',    (_e, p) => getReportDefinitionV2(p || {}))
  ipcMain.handle('pbi-update-report-definition',    (_e, p) => updateReportDefinition(p || {}))
  ipcMain.handle('pbi-create-report',               (_e, p) => createReport(p || {}))
  ipcMain.handle('pbi-create-blank-report',         (_e, p) => createBlankReport(p || {}))
  ipcMain.handle('pbi-save-draft',                  (_e, p) => saveDraft(p || {}))
  ipcMain.handle('pbi-get-drafts',                  (_e, p) => listDrafts(p || {}))
  ipcMain.handle('pbi-get-draft-for-report',        (_e, p) => getDraftForReport(p || {}))
  ipcMain.handle('pbi-delete-draft',                (_e, p) => deleteDraft(p || {}))
  ipcMain.handle('pbi-get-bundled-pbiviz',          ()      => getBundledPbiviz())
  ipcMain.handle('pbi-get-custom-visual-parts',     ()      => getBundledCustomVisualParts())
  console.log('[powerbi] IPC handlers registered (Fabric Items API + drafts)')
}

module.exports = {
  getBundledCustomVisualParts,
  register,
  listReports,
  getReportDefinitionV2,
  updateReportDefinition,
  createReport,
  createBlankReport,
  saveDraft,
  listDrafts,
  getDraftForReport,
  deleteDraft,
}
