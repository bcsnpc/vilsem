/**
 * Power BI Mode — Semantic Model (dataset) definition IPC
 * ─────────────────────────────────────────────────────────
 * STANDALONE MODULE. Does not touch existing powerbi.js handlers.
 *
 * Purpose: read and write the TMDL definition of a Fabric semantic model
 * so Semantica's HTML Content publish path can inject per-visual DAX
 * measures that return pre-rendered HTML strings as their values.
 *
 * Only used by the new HTML-Content-via-XMLA publish flow. The existing
 * Semantica Renderer (org-library visual) path is untouched and keeps
 * working as before.
 *
 * IPC channels:
 *   pbism-get-definition   — GET the TMDL parts of a semantic model
 *   pbism-update-definition — PUT new TMDL parts back to the model (LRO)
 *
 * Endpoints used:
 *   POST /v1/workspaces/{ws}/semanticModels/{id}/getDefinition?format=TMDL
 *   POST /v1/workspaces/{ws}/semanticModels/{id}/updateDefinition
 */

const { ipcMain } = require('electron/main')
const axios       = require('axios')
const { getToken, forceRefresh } = require('../../src/auth/auth')
const { rateLimitedCall }        = require('../../src/queue/limiter')

const FABRIC_BASE = 'https://api.fabric.microsoft.com/v1'

// ── HTTP helper (same shape as powerbi.js) ─────────────────────────────────

async function sbRequest(makeCall) {
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

function reportError(label, err) {
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
  console.error(`[pbism] ${label} failed:`, err.message)
  return { success: false, message: err.message }
}

// ── LRO polling (mirrors powerbi.js pollOperation) ─────────────────────────

async function pollOperation(headers) {
  const operationId  = headers['x-ms-operation-id'] || headers['operation-id'] || null
  const locationHdr  = headers['location']         || headers['Location']      || null
  const retryAfter   = parseInt(headers['retry-after'] || '2', 10) || 2

  let pollUrl
  if (locationHdr) {
    pollUrl = locationHdr.startsWith('http') ? locationHdr
      : `${FABRIC_BASE}${locationHdr.startsWith('/') ? '' : '/'}${locationHdr}`
  } else if (operationId) {
    pollUrl = `${FABRIC_BASE}/operations/${operationId}`
  } else {
    return { status: 'Succeeded', result: null }
  }

  const MAX_TICKS = 90
  for (let i = 0; i < MAX_TICKS; i++) {
    await new Promise((r) => setTimeout(r, Math.max(retryAfter, 2) * 1000))
    try {
      const res = await sbRequest((token) =>
        axios.get(pollUrl, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 30000,
          validateStatus: (s) => s === 200 || s === 202,
        })
      )
      if (res.status === 200) {
        const status = res.data?.status || 'Succeeded'
        if (status === 'Succeeded') {
          // Try to fetch the actual result from the result-location header
          const resultLoc = res.headers['location'] || res.headers['Location']
          if (resultLoc) {
            try {
              const resultUrl = resultLoc.startsWith('http') ? resultLoc
                : `${FABRIC_BASE}${resultLoc.startsWith('/') ? '' : '/'}${resultLoc}`
              const r2 = await sbRequest((token) =>
                axios.get(resultUrl, {
                  headers: { Authorization: `Bearer ${token}` },
                  timeout: 30000,
                })
              )
              return { status: 'Succeeded', result: r2.data }
            } catch { /* ignore */ }
          }
          return { status: 'Succeeded', result: res.data }
        }
        if (status === 'Failed') {
          return { status: 'Failed', error: res.data?.error || res.data }
        }
      }
    } catch (err) {
      console.warn('[pbism] poll tick error:', err.message)
    }
  }
  return { status: 'Failed', error: { message: 'LRO polling timed out' } }
}

// ── getDefinition ──────────────────────────────────────────────────────────

async function getSemanticModelDefinition({ workspaceId, datasetId, format }) {
  if (!workspaceId || !datasetId) {
    return { success: false, message: 'workspaceId and datasetId are required' }
  }
  const fmt = format || 'TMDL'
  try {
    const initial = await sbRequest((token) =>
      axios.post(
        `${FABRIC_BASE}/workspaces/${workspaceId}/semanticModels/${datasetId}/getDefinition?format=${fmt}`,
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
      const op = await pollOperation(initial.headers)
      if (op.status !== 'Succeeded') {
        return { success: false, status: 'Failed', message: op.error?.message || 'LRO failed' }
      }
      definition = op.result?.definition || op.result || null
    }

    if (!definition || !Array.isArray(definition.parts)) {
      return { success: false, message: 'Fabric returned no parts' }
    }

    const parts = definition.parts.map((p) => ({
      path: p.path,
      payloadType: p.payloadType || 'InlineBase64',
      content: decodePart(p),
    }))
    console.log(`[pbism] getDefinition OK: ${parts.length} parts (format=${fmt})`)
    return { success: true, parts, format: fmt }
  } catch (err) {
    return reportError('GET_SEMANTIC_MODEL_DEFINITION', err)
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

function encodePart(text) {
  return Buffer.from(text || '', 'utf8').toString('base64')
}

// ── updateDefinition ───────────────────────────────────────────────────────

async function updateSemanticModelDefinition({ workspaceId, datasetId, parts }) {
  if (!workspaceId || !datasetId) {
    return { success: false, message: 'workspaceId and datasetId are required' }
  }
  if (!Array.isArray(parts) || parts.length === 0) {
    return { success: false, message: 'parts[] is required and non-empty' }
  }

  const body = {
    definition: {
      parts: parts.map((p) => ({
        path: p.path,
        payload: p.content ? encodePart(p.content) : (p.payload || ''),
        payloadType: 'InlineBase64',
      })),
    },
  }

  const MAX_RETRIES = 3
  let lastErr = null
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await sbRequest((token) =>
        axios.post(
          `${FABRIC_BASE}/workspaces/${workspaceId}/semanticModels/${datasetId}/updateDefinition`,
          body,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            timeout: 120000,
            validateStatus: (s) => s === 200 || s === 202,
          }
        )
      )

      if (res.status === 200) {
        console.log(`[pbism] updateDefinition OK (sync, attempt ${attempt})`)
        return { success: true, status: 'Succeeded', sync: true }
      }
      const op = await pollOperation(res.headers)
      if (op.status === 'Succeeded') {
        console.log(`[pbism] updateDefinition OK (LRO, attempt ${attempt})`)
        return { success: true, status: 'Succeeded', sync: false }
      }
      console.warn('[pbism] updateDefinition LRO failed:', op.error)
      return {
        success: false, status: 'Failed',
        message: op.error?.message || op.error?.errorCode || 'updateDefinition LRO failed',
        raw: op,
      }
    } catch (err) {
      lastErr = err
      const isRetryable = err.code === 'ECONNRESET' || err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT'
      if (isRetryable && attempt < MAX_RETRIES) {
        const delay = attempt * 4000  // 4s, 8s
        console.warn(`[pbism] updateDefinition attempt ${attempt} failed (${err.code}), retrying in ${delay}ms…`)
        await new Promise(r => setTimeout(r, delay))
        continue
      }
      return reportError('UPDATE_SEMANTIC_MODEL_DEFINITION', err)
    }
  }
  return reportError('UPDATE_SEMANTIC_MODEL_DEFINITION', lastErr)
}

// ── IPC registration ───────────────────────────────────────────────────────

function register() {
  ipcMain.handle('pbism-get-definition',    (_e, p) => getSemanticModelDefinition(p || {}))
  ipcMain.handle('pbism-update-definition', (_e, p) => updateSemanticModelDefinition(p || {}))
  console.log('[pbism] IPC handlers registered (semantic model TMDL read/write)')
}

module.exports = {
  register,
  getSemanticModelDefinition,
  updateSemanticModelDefinition,
}
