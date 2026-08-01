import React, { useState, useEffect } from 'react'
import { Input } from '../../../ui/Input.jsx'
import { Button } from '../../../ui/Button.jsx'
import { Spinner } from '../../../ui/Feedback.jsx'
import { ArrowLeft, ArrowRight, Layers } from '../../../ui/icons.js'

/**
 * Step 1 of the Restyler/Injector wizard: pick a workspace + report.
 * Pulls live data via the same IPCs used by Home.jsx (getWorkspaces, pbiListReports).
 * S3–S5 richness: counts, breadcrumb, search, grid/list, capacity + type badges,
 * modified time — all degrade gracefully when a field is absent.
 */

function relTime(iso) {
  if (!iso) return null
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return null
  const s = Math.floor((Date.now() - d) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24); if (days < 30) return `${days}d ago`
  const mo = Math.floor(days / 30); if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

function reportTypeLabel(t) {
  if (!t) return null
  if (/paginated/i.test(t)) return 'Paginated'
  if (/powerbi/i.test(t)) return 'Power BI'
  return t
}

export default function ReportPicker({ authCreds, onSelect }) {
  const [workspaces,    setWorkspaces]    = useState([])
  const [reports,       setReports]       = useState([])
  const [selectedWs,    setSelectedWs]    = useState(null)
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState('')
  const [search,        setSearch]        = useState('')
  const [wsSearch,      setWsSearch]      = useState('')
  const [view,          setView]          = useState('list')  // 'list' | 'grid'

  // Build creds in same shape Home.jsx uses
  const creds = authCreds
    ? (authCreds.accessToken
        ? { accessToken: authCreds.accessToken }
        : { tenantId: authCreds.tenantId, clientId: authCreds.clientId, clientSecret: authCreds.clientSecret })
    : null

  useEffect(() => {
    (async () => {
      setLoading(true); setError('')
      try {
        const res = await window.semantica?.getWorkspaces?.(creds || {})
        const list = Array.isArray(res?.workspaces) ? res.workspaces : []
        setWorkspaces(list)
        if (!list.length) setError('No workspaces returned. Check your sign-in.')
      } catch (e) {
        setError(e?.message || 'Failed to load workspaces')
      }
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handlePickWorkspace(ws) {
    setSelectedWs(ws)
    setReports([]); setSearch('')
    setLoading(true); setError('')
    try {
      const res = await window.semantica?.pbiListReports?.({ workspaceId: ws.id, force: true, ...(creds || {}) })
      const list = Array.isArray(res?.reports) ? res.reports : []
      setReports(list)
      if (!list.length) setError('No reports in this workspace.')
    } catch (e) {
      setError(e?.message || 'Failed to load reports')
    }
    setLoading(false)
  }

  function handlePickReport(r) {
    onSelect?.({
      id: r.id, name: r.name, datasetId: r.datasetId,
      workspaceId: selectedWs.id, workspaceName: selectedWs.name, raw: r,
    })
  }

  const filteredWs = wsSearch.trim()
    ? workspaces.filter(w => (w.name || '').toLowerCase().includes(wsSearch.toLowerCase()))
    : workspaces
  const filteredReports = search.trim()
    ? reports.filter(r => (r.name || '').toLowerCase().includes(search.toLowerCase()))
    : reports

  const heading = { fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h3)', fontWeight: 600, color: 'var(--text-primary)' }
  const countPill = { fontSize: 'var(--fs-micro)', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-pill, 999px)', padding: '2px 8px', whiteSpace: 'nowrap' }

  return (
    <div style={{ padding: '24px 32px', minHeight: 320 }}>
      {!selectedWs ? (
        // ── Workspace picker ──
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={heading}>Choose a workspace</div>
            {!loading && !error && <span style={countPill}>{filteredWs.length} of {workspaces.length}</span>}
            <div style={{ flex: 1 }} />
            {workspaces.length > 6 && (
              <Input value={wsSearch} onChange={e => setWsSearch(e.target.value)} placeholder="Search workspaces…" style={{ width: 200, height: 30, fontSize: 'var(--fs-sm)' }} />
            )}
          </div>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spinner size={20} /></div>
          ) : error ? (
            <div style={{ color: 'var(--danger)', fontSize: 'var(--fs-sm)', padding: 24 }}>{error}</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
              {filteredWs.map(ws => {
                const premium = typeof ws.isOnDedicatedCapacity === 'boolean' ? ws.isOnDedicatedCapacity : null
                return (
                  <button key={ws.id} onClick={() => handlePickWorkspace(ws)}
                    style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 14, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', transition: 'background var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-subtle)'; e.currentTarget.style.borderColor = 'var(--accent-border)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-raised)'; e.currentTarget.style.borderColor = 'var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name}</div>
                      {premium !== null && (
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: premium ? 'var(--accent)' : 'var(--text-muted)', background: premium ? 'var(--accent-subtle)' : 'var(--surface-sunken)', borderRadius: 'var(--radius-xs)', padding: '1px 6px', flexShrink: 0 }}>{premium ? 'Premium' : 'Shared'}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{ws.id?.slice(0, 8)}…</div>
                  </button>
                )
              })}
            </div>
          )}
        </>
      ) : (
        // ── Report picker ──
        <>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
            <button onClick={() => { setSelectedWs(null); setReports([]); setSearch('') }}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontSize: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ArrowLeft size={13} /> Workspaces
            </button>
            <ArrowRight size={12} style={{ color: 'var(--text-faint)' }} />
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selectedWs.name}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14, gap: 10 }}>
            <div style={heading}>Pick a report</div>
            {!loading && !error && <span style={countPill}>{filteredReports.length} of {reports.length}</span>}
            <div style={{ flex: 1 }} />
            {reports.length > 4 && (
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reports…" style={{ width: 200, height: 30, fontSize: 'var(--fs-sm)' }} />
            )}
            {/* Grid / list toggle */}
            <div style={{ display: 'flex', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              {['list', 'grid'].map(v => (
                <button key={v} onClick={() => setView(v)}
                  style={{ padding: '5px 10px', fontSize: 'var(--fs-caption)', fontWeight: 600, textTransform: 'capitalize', border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: view === v ? 'var(--accent-subtle)' : 'transparent', color: view === v ? 'var(--accent)' : 'var(--text-muted)' }}>{v}</button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spinner size={20} /></div>
          ) : error ? (
            <div style={{ color: 'var(--danger)', fontSize: 'var(--fs-sm)', padding: 24 }}>{error}</div>
          ) : view === 'grid' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
              {filteredReports.map(r => {
                const t = reportTypeLabel(r.reportType); const mod = relTime(r.modifiedDateTime)
                return (
                  <button key={r.id} onClick={() => handlePickReport(r)}
                    style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 14, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-subtle)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-raised)' }}>
                    {/* Thumbnail placeholder — the API returns no preview image */}
                    <div style={{ height: 72, borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                      <Layers size={20} />
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                        {t && <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--accent)', background: 'var(--accent-subtle)', borderRadius: 'var(--radius-xs)', padding: '1px 5px' }}>{t}</span>}
                        {mod && <span style={{ fontSize: 'var(--fs-micro)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{mod}</span>}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filteredReports.map(r => {
                const t = reportTypeLabel(r.reportType); const mod = relTime(r.modifiedDateTime)
                return (
                  <button key={r.id} onClick={() => handlePickReport(r)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '10px 14px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'background var(--dur-fast) var(--ease-standard)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-subtle)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-raised)' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 'var(--radius-sm)', background: 'var(--accent-subtle)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Layers size={15} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                      <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                        {r.datasetId ? `dataset ${r.datasetId.slice(0, 8)}…` : 'no dataset'}{mod ? ` · ${mod}` : ''}
                      </div>
                    </div>
                    {t && <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-muted)', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-xs)', padding: '2px 6px', flexShrink: 0 }}>{t}</span>}
                    <ArrowRight size={15} color="var(--accent)" />
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
