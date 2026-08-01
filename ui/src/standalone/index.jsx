import React from 'react'
import { createRoot } from 'react-dom/client'
import StandaloneApp from './StandaloneApp.jsx'

// ── HTTP data adapter — replaces window.semantica for browser runtime ─────────
const API_BASE = window.location.origin

async function httpPost(endpoint, body) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

// Polyfill window.semantica so AppSpecRenderer works unchanged
window.semantica = {
  query: async ({ measures, filters }) => {
    return httpPost('/query-scalar', { measures, filters })
  },
  queryTable: async ({ groupBy, measures, filters, limit, orderBy }) => {
    return httpPost('/query-table', { groupBy, measures, filters, limit, orderBy })
  },
  getDistinctValues: async ({ column, limit }) => {
    try {
      const res = await fetch(`${API_BASE}/distinct-values`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column, limit }),
      })
      if (!res.ok) throw new Error('Not available')
      return res.json()
    } catch {
      throw new Error('getDistinctValues not available')
    }
  },
}

// ── Mount ────────────────────────────────────────────────────────────────────
// Web export: no initialSpec → the shell fetches /app-spec.json over HTTP.
const root = createRoot(document.getElementById('root'))
root.render(<StandaloneApp specUrl={`${API_BASE}/app-spec.json`} />)
