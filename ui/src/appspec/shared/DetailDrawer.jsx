import React from 'react'
import { expandLevels } from './drill.js'

function fmt(n) {
  const v = Number(n) || 0
  const abs = Math.abs(v)
  if (abs >= 1e9) return (v / 1e9).toFixed(1) + 'B'
  if (abs >= 1e6) return (v / 1e6).toFixed(1) + 'M'
  if (abs >= 1e3) return (v / 1e3).toFixed(1) + 'k'
  return String(Math.round(v))
}

// Detail panel (drill pattern 01 · progressive disclosure). Slides in beside the
// chart; the chart never disappears. Shows the clicked category's children as a
// table with mini row-bars. Closing returns you exactly where you were.
export default function DetailDrawer({ visual, panel, onClose, muted, primary, border, surface, accent }) {
  const rows = Array.isArray(panel?.rows) ? panel.rows : []
  const lv = expandLevels(visual)
  const childLabel = lv?.child?.label || 'Detail'
  const total = rows.reduce((a, r) => a + (Number(r._val) || 0), 0)
  const max = Math.max(1, ...rows.map(r => Math.abs(Number(r._val) || 0)))

  return (
    <div style={{
      width: 300, flexShrink: 0, alignSelf: 'stretch', minHeight: 0,
      background: surface, border: `1px solid ${border}`, borderRadius: 10,
      padding: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{panel?.value}</div>
        <button onClick={(e) => { e.stopPropagation(); onClose() }} title="Close"
          style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 2, flexShrink: 0 }}>✕</button>
      </div>
      <div style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.04em', color: muted, marginBottom: 10, textTransform: 'uppercase' }}>
        {panel?.loading ? 'loading…' : `${rows.length} ${childLabel} · ${fmt(total)} total`}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {!panel?.loading && rows.length === 0 && (
          <div style={{ fontSize: 11, color: muted, padding: '8px 0' }}>No detail rows.</div>
        )}
        {rows.map((r, i) => (
          <div key={i} style={{ padding: '7px 0', borderBottom: `1px solid ${border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
              <span style={{ fontSize: 12, color: primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r._cat}</span>
              <span style={{ fontSize: 12, fontFamily: 'monospace', color: primary, flexShrink: 0 }}>{fmt(r._val)}</span>
            </div>
            <div style={{ height: 3, borderRadius: 2, marginTop: 4, background: accent,
              width: `${Math.max(2, Math.round(Math.abs(Number(r._val) || 0) / max * 100))}%` }} />
          </div>
        ))}
      </div>
    </div>
  )
}
