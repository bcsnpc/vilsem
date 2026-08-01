import React, { useState, useEffect, useCallback } from 'react'
import StatusBadge from '../components/StatusBadge.jsx'

function timeAgo(iso) {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const LIMITS = [10, 20, 50, 100]

export default function Audit({ sessionStart }) {
  const [entries, setEntries]       = useState([])
  const [total, setTotal]           = useState(0)
  const [type, setType]             = useState('all')
  const [limit, setLimit]           = useState(20)
  const [loading, setLoading]       = useState(true)
  const [thisSession, setThisSession] = useState(false)

  const refresh = useCallback(async () => {
    if (!window.semantica) return
    setLoading(true)
    try {
      const res = await window.semantica.getAuditLog({
        limit,
        type: type === 'all' ? undefined : type,
      })
      setEntries(res?.entries || [])
      setTotal(res?.total ?? 0)
    } catch { /* keep last */ }
    setLoading(false)
  }, [limit, type])

  useEffect(() => { refresh() }, [refresh])

  const visibleEntries = thisSession && sessionStart
    ? entries.filter(e => e.timestamp >= sessionStart)
    : entries

  function detailText(entry) {
    if (entry.type === 'query') {
      const ms = entry.measures || []
      const text = ms.slice(0, 3).join(', ')
      return ms.length > 3 ? `${text} +${ms.length - 3} more` : text
    }
    return `${entry.table} · ${entry.rowsWritten} row${entry.rowsWritten !== 1 ? 's' : ''}`
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #E5E7EB', background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-900)' }}>Audit Log</div>
          <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>
            {thisSession ? `${visibleEntries.length} this session` : `${total} total entries`}
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => setThisSession(s => !s)}
            style={{
              background: thisSession ? '#EFF6FF' : 'white',
              border: `1px solid ${thisSession ? '#93C5FD' : '#E5E7EB'}`,
              color: thisSession ? '#2563EB' : 'var(--gray-400)',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: thisSession ? 600 : 400,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {thisSession ? '● This session' : '○ This session'}
          </button>
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            style={selectStyle}
          >
            <option value="all">All Types</option>
            <option value="query">Queries</option>
            <option value="writeback">Writebacks</option>
          </select>
          <select
            value={limit}
            onChange={e => setLimit(Number(e.target.value))}
            style={selectStyle}
          >
            {LIMITS.map(l => <option key={l} value={l}>Last {l}</option>)}
          </select>
          <button onClick={refresh} style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--gray-50)' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
            <div className="spinner" />
          </div>
        ) : visibleEntries.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60, color: 'var(--gray-400)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>≡</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No audit entries yet</div>
            <div style={{ fontSize: 12 }}>Run some queries in the Playground to see them here</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'white', borderBottom: '2px solid #E5E7EB' }}>
                {['#', 'Type', 'Details', 'Source', 'Time', 'When'].map(h => (
                  <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleEntries.map((entry, i) => (
                <tr
                  key={entry.id}
                  style={{ background: i % 2 === 0 ? 'white' : '#FAFAFA', borderBottom: '1px solid #F3F4F6' }}
                >
                  <td style={cellStyle}><span style={{ color: 'var(--gray-400)', fontSize: 12 }}>{entry.id}</span></td>

                  <td style={cellStyle}>
                    <StatusBadge
                      status={entry.type === 'query' ? 'query' : 'writeback'}
                      label={entry.type}
                      size="sm"
                    />
                  </td>

                  <td style={{ ...cellStyle, maxWidth: 280 }}>
                    <span style={{ fontSize: 12, color: 'var(--gray-700)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {detailText(entry)}
                    </span>
                    {entry.type === 'query' && entry.filters && Object.keys(entry.filters).length > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                        {Object.entries(entry.filters).map(([k, v]) => `${k}=${v}`).join(', ')}
                      </span>
                    )}
                  </td>

                  <td style={cellStyle}>
                    {entry.type === 'query' ? (
                      <span style={{ fontSize: 12, fontWeight: 600, color: entry.source === 'cache' ? 'var(--green)' : 'var(--blue)' }}>
                        {entry.source}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: '#7C3AED' }}>
                        {entry.destination || 'lakehouse'}
                      </span>
                    )}
                  </td>

                  <td style={cellStyle}>
                    <span style={{ fontSize: 12, color: 'var(--gray-700)' }}>
                      {entry.type === 'query' && entry.queryMs !== null ? `${entry.queryMs}ms` : '—'}
                    </span>
                  </td>

                  <td style={cellStyle}>
                    <span
                      title={entry.timestamp}
                      style={{ fontSize: 12, color: 'var(--gray-400)', cursor: 'default' }}
                    >
                      {timeAgo(entry.timestamp)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const cellStyle = { padding: '10px 20px', verticalAlign: 'middle' }
const selectStyle = {
  padding: '6px 10px',
  border: '1px solid #E5E7EB',
  borderRadius: 6,
  fontSize: 12,
  color: 'var(--gray-700)',
  background: 'white',
  cursor: 'pointer',
  fontFamily: 'inherit',
  outline: 'none',
}
