import React from 'react'
import StatusBadge from './StatusBadge.jsx'

function formatNumber(v) {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'number') return v.toLocaleString()
  return String(v)
}

export default function KpiCard({ label, value, source, queryMs }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #E5E7EB',
      borderRadius: 10,
      padding: '20px 24px',
      minWidth: 180,
      flex: '1 1 180px',
    }}>
      <div style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 500, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--gray-900)', lineHeight: 1.2, marginBottom: 10 }}>
        {formatNumber(value)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {source && (
          <StatusBadge status={source} label={source} size="xs" />
        )}
        {queryMs !== undefined && (
          <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{queryMs}ms</span>
        )}
      </div>
    </div>
  )
}
