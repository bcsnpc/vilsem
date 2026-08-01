import React, { useEffect, useState, useCallback } from 'react'
import { getThemeTokens } from '../../appspec/getThemeTokens'
import { COLOR_SCHEMES } from '../../appspec/colorSchemes'
import SetupBanner from './SetupBanner.jsx'

/**
 * ReportPicker — left panel: workspace info + Create New
 *                right panel: list of reports in the active dataset
 *
 * Calls window.semantica.pbiListReports({ workspaceId, datasetId }) on mount.
 * If window.semantica is missing (Vite dev outside Electron), shows mock data
 * so the component can be developed in isolation.
 */
export default function ReportPicker({
  workspaceId,
  datasetId,
  workspaceName,
  datasetName,
  onSelectReport,
  onCreateNew,
  onContinueDraft,
}) {
  const T     = getThemeTokens('dark')
  const teal  = COLOR_SCHEMES.teal

  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [cached,  setCached]  = useState(false)

  // Drafts (local SQLite)
  const [drafts, setDrafts] = useState([])

  const fetchDrafts = useCallback(async () => {
    if (!window.semantica?.pbiGetDrafts) return
    if (!workspaceId) { setDrafts([]); return }
    try {
      const res = await window.semantica.pbiGetDrafts({ workspaceId })
      if (res?.success) setDrafts(res.drafts || [])
    } catch { /* draft list is best-effort */ }
  }, [workspaceId])

  const handleDeleteDraft = useCallback(async (id) => {
    if (!window.semantica?.pbiDeleteDraft) return
    if (!confirm('Delete this saved draft?')) return
    try {
      await window.semantica.pbiDeleteDraft({ id })
      setDrafts((prev) => prev.filter((d) => d.id !== id))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchDrafts() }, [fetchDrafts])

  const fetchReports = useCallback(async (force = false) => {
    setLoading(true)
    setError(null)

    // Dev fallback — outside Electron, render mock cards so we can verify layout
    if (!window.semantica?.pbiListReports) {
      await new Promise(r => setTimeout(r, 400))
      setReports(MOCK_REPORTS)
      setCached(false)
      setLoading(false)
      return
    }

    if (!workspaceId) {
      setError('No active workspace. Connect a Fabric workspace first.')
      setLoading(false)
      return
    }

    try {
      const res = await window.semantica.pbiListReports({ workspaceId, datasetId, force })
      if (res?.success) {
        setReports(res.reports || [])
        setCached(!!res.cached)
      } else {
        setError(res?.message || 'Failed to load reports')
      }
    } catch (e) {
      setError(e.message || 'Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [workspaceId, datasetId])

  useEffect(() => { fetchReports(false) }, [fetchReports])

  return (
    <div style={{ display: 'flex', height: '100%', background: T.canvasBg || '#0b0b14' }}>

      {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
      <aside style={{
        width: 300, flexShrink: 0,
        background: 'rgba(15,17,23,0.7)',
        borderRight: `1px solid ${T.CARD_BORDER}`,
        padding: '28px 22px',
        display: 'flex', flexDirection: 'column', gap: 22,
      }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.textMuted, marginBottom: 4 }}>
            Power BI Mode
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>
            Connected to
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <InfoRow icon="🏢" label="Workspace" value={workspaceName || '—'} T={T} />
          <InfoRow icon="📊" label="Dataset"   value={datasetName   || '—'} T={T} />
          <div style={{ fontSize: 11, color: T.textFaint, lineHeight: 1.5 }}>
            Showing reports connected to this dataset.
          </div>
        </div>

        <div style={{ height: 1, background: T.CARD_BORDER }} />

        <button
          onClick={onCreateNew}
          style={{
            width: '100%',
            padding: '11px 14px',
            background: teal.start,
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: `0 6px 18px ${teal.start}33`,
            fontFamily: 'inherit',
            transition: 'transform 0.12s ease, box-shadow 0.12s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 10px 24px ${teal.start}44` }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)';   e.currentTarget.style.boxShadow = `0 6px 18px ${teal.start}33` }}
        >
          <span style={{ fontSize: 15 }}>＋</span>
          Create New Report
        </button>

        <div style={{ marginTop: 'auto', fontSize: 10, color: T.textFaint, lineHeight: 1.5 }}>
          Reports are read directly from your Fabric workspace via the Power BI REST API. No local files.
        </div>
      </aside>

      {/* ── RIGHT PANEL ─────────────────────────────────────────────────── */}
      <main style={{ flex: 1, padding: '28px 36px', overflow: 'auto' }}>
        <SetupBanner />
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.textPrimary, letterSpacing: '-0.01em' }}>
            Power BI Reports
          </h2>
          {cached && (
            <span style={{
              fontSize: 9, padding: '2px 8px', borderRadius: 99,
              background: 'rgba(255,255,255,0.06)', color: T.textMuted,
              border: `1px solid ${T.CARD_BORDER}`, letterSpacing: '0.04em', textTransform: 'uppercase',
            }}>
              cached
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button
            onClick={() => fetchReports(true)}
            disabled={loading}
            title="Refresh"
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${T.CARD_BORDER}`,
              color: T.textSecondary,
              cursor: loading ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontFamily: 'inherit',
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
          >
            {loading ? '⏳' : '↻'}
          </button>
        </header>

        {/* Loading skeletons */}
        {loading && (
          <div style={cardGridStyle}>
            {[0,1,2,3].map(i => <SkeletonCard key={i} T={T} />)}
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <EmptyState
            T={T}
            icon="❌"
            title="Failed to load reports"
            message={error}
            cta={{ label: 'Retry', onClick: () => fetchReports(true) }}
          />
        )}

        {/* Empty state */}
        {!loading && !error && reports.length === 0 && (
          <EmptyState
            T={T}
            icon="📂"
            title="No reports found"
            message="No reports are connected to this dataset yet."
            cta={{ label: '+ Create New Report', onClick: onCreateNew }}
          />
        )}

        {/* Report grid */}
        {!loading && !error && reports.length > 0 && (
          <div style={cardGridStyle}>
            {reports.map(r => (
              <ReportCard key={r.id} report={r} T={T} teal={teal} onSelect={() => onSelectReport(r)} />
            ))}
          </div>
        )}

        {/* Drafts section — local SQLite */}
        {drafts.length > 0 && (
          <section style={{ marginTop: 32 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
            }}>
              <h3 style={{
                margin: 0, fontSize: 12, fontWeight: 700, color: T.textPrimary,
                letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>
                💾 Saved Drafts
              </h3>
              <span style={{
                fontSize: 9, padding: '2px 8px', borderRadius: 99,
                background: 'rgba(255,255,255,0.06)', color: T.textMuted,
                border: `1px solid ${T.CARD_BORDER}`, letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>
                local · {drafts.length}
              </span>
            </div>
            <div style={cardGridStyle}>
              {drafts.map((d) => (
                <DraftCard
                  key={d.id}
                  draft={d}
                  T={T}
                  teal={teal}
                  onContinue={() => onContinueDraft?.(d)}
                  onDelete={() => handleDeleteDraft(d.id)}
                />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

function DraftCard({ draft, T, teal, onContinue, onDelete }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        textAlign: 'left',
        padding: '16px 16px 14px',
        background: T.CARD_BG,
        border: `1px solid ${hover ? teal.start + '66' : T.CARD_BORDER}`,
        borderRadius: 12,
        boxShadow: hover ? `0 16px 36px rgba(0,0,0,0.32), 0 0 0 1px ${teal.start}22` : T.CARD_SHADOW,
        transition: 'transform 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease',
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        display: 'flex', flexDirection: 'column', gap: 10,
        fontFamily: 'inherit',
        color: T.textPrimary,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${teal.start}, ${teal.mid})`,
        opacity: hover ? 1 : 0.55,
        transition: 'opacity 0.14s ease',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ fontSize: 16 }}>💾</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: T.textPrimary,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {draft.reportName}
          </div>
          <div style={{ fontSize: 9, color: T.textFaint, marginTop: 2 }}>
            {draft.reportId ? 'editing existing report' : 'new report draft'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: T.textSecondary }}>
        <MetaRow label="Last saved" value={relativeTime(draft.updatedAt || draft.savedAt) || '—'} T={T} />
        <MetaRow label="Pages"      value={`${draft.pageCount}`} T={T} />
        <MetaRow label="Visuals"    value={`${draft.visualCount}`} T={T} />
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <button
          onClick={onContinue}
          style={{
            flex: 1, padding: '7px 11px', borderRadius: 6,
            background: teal.start, color: 'white',
            border: 'none', fontSize: 11, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Continue →
        </button>
        <button
          onClick={onDelete}
          title="Delete draft"
          style={{
            padding: '7px 10px', borderRadius: 6,
            background: 'rgba(248,113,113,0.10)',
            border: '1px solid rgba(248,113,113,0.30)',
            color: '#FCA5A5', fontSize: 11, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Delete
        </button>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function InfoRow({ icon, label, value, T }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase', color: T.textMuted }}>
        {icon} {label}
      </div>
      <div
        title={value}
        style={{
          fontSize: 13, fontWeight: 600, color: T.textPrimary,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
    </div>
  )
}

function ReportCard({ report, T, teal, onSelect }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        textAlign: 'left',
        padding: '18px 18px 16px',
        background: T.CARD_BG,
        border: `1px solid ${hover ? teal.start + '66' : T.CARD_BORDER}`,
        borderRadius: 12,
        boxShadow: hover ? `0 18px 40px rgba(0,0,0,0.32), 0 0 0 1px ${teal.start}22` : T.CARD_SHADOW,
        cursor: 'pointer',
        transition: 'transform 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease',
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        display: 'flex', flexDirection: 'column', gap: 12,
        fontFamily: 'inherit',
        color: T.textPrimary,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top accent strip */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${teal.start}, ${teal.mid})`,
        opacity: hover ? 1 : 0.55,
        transition: 'opacity 0.14s ease',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>📊</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: T.textPrimary,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {report.name}
          </div>
          {report.reportType && (
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>
              {report.reportType}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: T.textSecondary }}>
        <MetaRow label="Modified" value={relativeTime(report.modifiedDateTime) || '—'} T={T} />
        <MetaRow label="Pages"    value={report.pageCount != null ? String(report.pageCount) : '—'} T={T} />
      </div>

      <div style={{
        marginTop: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{
          fontSize: 11, fontWeight: 600,
          color: hover ? teal.start : T.textSecondary,
          transition: 'color 0.14s ease',
        }}>
          Open in Semantica →
        </span>
      </div>
    </button>
  )
}

function MetaRow({ label, value, T }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ color: T.textMuted }}>{label}</span>
      <span style={{ color: T.textSecondary, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
        {value}
      </span>
    </div>
  )
}

function SkeletonCard({ T }) {
  return (
    <div style={{
      padding: '18px 18px 16px',
      background: T.CARD_BG,
      border: `1px solid ${T.CARD_BORDER}`,
      borderRadius: 12,
      boxShadow: T.CARD_SHADOW,
      display: 'flex', flexDirection: 'column', gap: 12,
      minHeight: 132,
    }}>
      <SkeletonBar width="62%" height={14} T={T} />
      <SkeletonBar width="100%" height={9} T={T} />
      <SkeletonBar width="80%"  height={9} T={T} />
      <div style={{ flex: 1 }} />
      <SkeletonBar width="40%"  height={11} T={T} />
    </div>
  )
}

function SkeletonBar({ width, height, T }) {
  return (
    <div style={{
      width, height,
      background: `linear-gradient(90deg, ${T.shimmerBg || 'rgba(255,255,255,0.04)'} 0%, ${T.shimmerBg2 || 'rgba(255,255,255,0.08)'} 50%, ${T.shimmerBg || 'rgba(255,255,255,0.04)'} 100%)`,
      backgroundSize: '200% 100%',
      borderRadius: 4,
      animation: 'pbi-shimmer 1.4s linear infinite',
    }} />
  )
}

function EmptyState({ T, icon, title, message, cta }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 12, padding: '80px 24px',
      background: T.CARD_BG, border: `1px dashed ${T.CARD_BORDER}`, borderRadius: 14,
      color: T.textSecondary, textAlign: 'center',
    }}>
      <div style={{ fontSize: 32, lineHeight: 1 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary }}>{title}</div>
      <div style={{ fontSize: 12, color: T.textMuted, maxWidth: 380 }}>{message}</div>
      {cta && (
        <button
          onClick={cta.onClick}
          style={{
            marginTop: 6, padding: '9px 18px',
            background: COLOR_SCHEMES.teal.start, color: 'white',
            border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {cta.label}
        </button>
      )}
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const cardGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: 16,
}

function relativeTime(iso) {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  const diff = Date.now() - then
  if (diff < 0) return 'just now'
  const sec = Math.floor(diff / 1000)
  if (sec < 60)  return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60)  return `${min} minute${min !== 1 ? 's' : ''} ago`
  const hr = Math.floor(min / 60)
  if (hr < 24)   return `${hr} hour${hr !== 1 ? 's' : ''} ago`
  const day = Math.floor(hr / 24)
  if (day < 30)  return `${day} day${day !== 1 ? 's' : ''} ago`
  const mo = Math.floor(day / 30)
  if (mo < 12)   return `${mo} month${mo !== 1 ? 's' : ''} ago`
  const yr = Math.floor(day / 365)
  return `${yr} year${yr !== 1 ? 's' : ''} ago`
}

// Mock data shown when running outside Electron (no window.semantica)
const MOCK_REPORTS = [
  { id: 'mock-1', name: 'Cricket — Match Performance', modifiedDateTime: new Date(Date.now() - 1000*60*45).toISOString(),     pageCount: 4, reportType: 'PowerBIReport' },
  { id: 'mock-2', name: 'Team Stats Overview',         modifiedDateTime: new Date(Date.now() - 1000*60*60*7).toISOString(),    pageCount: 2, reportType: 'PowerBIReport' },
  { id: 'mock-3', name: 'Player Rankings',              modifiedDateTime: new Date(Date.now() - 1000*60*60*24*3).toISOString(), pageCount: 6, reportType: 'PowerBIReport' },
  { id: 'mock-4', name: 'Bowling Analysis',             modifiedDateTime: new Date(Date.now() - 1000*60*60*24*12).toISOString(),pageCount: 3, reportType: 'PowerBIReport' },
]

// Inject keyframes once
if (typeof document !== 'undefined' && !document.getElementById('pbi-shimmer-keyframes')) {
  const style = document.createElement('style')
  style.id = 'pbi-shimmer-keyframes'
  style.textContent = `@keyframes pbi-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`
  document.head.appendChild(style)
}
