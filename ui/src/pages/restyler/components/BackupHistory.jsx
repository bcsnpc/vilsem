import React, { useState, useEffect } from 'react'

/**
 * Backup history + restore UI. Lists snapshots for the current report and
 * lets the user roll back to any of them by re-writing the snapshot's parts
 * via pbi-update-report-definition.
 */
export default function BackupHistory({ report }) {
  const [snapshots, setSnapshots] = useState([])
  const [loading,   setLoading]   = useState(false)
  const [restoring, setRestoring] = useState(null)   // file path being restored
  const [result,    setResult]    = useState(null)

  useEffect(() => {
    if (!report?.id) return
    refreshList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report?.id])

  async function refreshList() {
    setLoading(true)
    try {
      const res = await window.semantica?.restyler?.backupList?.({ reportId: report.id })
      setSnapshots(Array.isArray(res?.snapshots) ? res.snapshots : [])
    } catch { setSnapshots([]) }
    setLoading(false)
  }

  async function handleRestore(snap) {
    if (!confirm(`Restore "${report.name}" to the snapshot from ${new Date(snap.timestamp).toLocaleString()}?\n\nThis writes the original PBIR back to PBI Service.`)) return
    setRestoring(snap.file); setResult(null)
    try {
      // Read the snapshot
      const read = await window.semantica?.restyler?.backupRead?.({ reportId: report.id, file: snap.file })
      if (!read?.success || !read.snapshot?.parts) {
        throw new Error(read?.message || 'Could not read snapshot')
      }
      // Push it back
      const update = await window.semantica?.pbiUpdateReportDefinition?.({
        workspaceId: report.workspaceId,
        reportId:    report.id,
        parts:       read.snapshot.parts.map(p => ({ path: p.path, content: p.content })),
      })
      if (!update?.success) {
        throw new Error(update?.message || 'Update rejected by Fabric')
      }
      setResult({ success: true, message: `Restored. Refresh in PBI Service to see the original.` })
    } catch (err) {
      setResult({ success: false, message: err.message })
    }
    setRestoring(null)
  }

  if (!report?.id) return null

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 8, padding: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Backup history ({snapshots.length})
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={refreshList} style={{
          background: 'transparent', border: 'none',
          color: '#64748B', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit',
        }}>↻ Refresh</button>
      </div>

      {result && (
        <div style={{
          background: result.success ? 'rgba(34,197,94,0.08)' : 'rgba(248,113,113,0.08)',
          border: result.success ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(248,113,113,0.3)',
          color: result.success ? '#86EFAC' : '#F87171',
          borderRadius: 6, padding: '6px 10px', fontSize: 11, marginBottom: 8,
        }}>
          {result.success ? '✓ ' : '⚠ '}{result.message}
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 11, color: '#64748B', padding: 8 }}>Loading…</div>
      ) : snapshots.length === 0 ? (
        <div style={{ fontSize: 11, color: '#64748B', padding: 8 }}>No backups yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {snapshots.map((s, i) => (
            <div key={s.file} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 10px', borderRadius: 6,
              background: i === 0 ? 'rgba(167,139,250,0.06)' : 'transparent',
              border: i === 0 ? '1px solid rgba(167,139,250,0.15)' : '1px solid transparent',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#E2E8F0', fontWeight: i === 0 ? 600 : 400 }}>
                  {new Date(s.timestamp).toLocaleString()}
                  {i === 0 && <span style={{ marginLeft: 8, fontSize: 9, color: '#A78BFA' }}>most recent</span>}
                </div>
                <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
                  {s.partsCount} parts · {(s.sizeBytes / 1024).toFixed(0)} KB
                </div>
              </div>
              <button onClick={() => handleRestore(s)}
                disabled={!!restoring}
                style={{
                  background: restoring === s.file ? 'rgba(167,139,250,0.4)' : 'rgba(167,139,250,0.15)',
                  border: '1px solid rgba(167,139,250,0.3)',
                  color: '#A78BFA',
                  borderRadius: 5, padding: '4px 10px',
                  fontSize: 10, fontWeight: 600,
                  cursor: restoring ? 'wait' : 'pointer', fontFamily: 'inherit',
                }}>
                {restoring === s.file ? 'Restoring…' : '↶ Restore'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
