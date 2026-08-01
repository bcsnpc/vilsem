import React from 'react'
import { pal } from '../shared/palettes.js'
import { fmtVal } from '../shared/formatters.js'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import getThemeTokens from '../getThemeTokens'

export default function CompactLollipop({ rows, config, loading, error }) {
  const p = pal(config.colorScheme)
  const t = config._T || getThemeTokens('dark')
  if (loading) return <LoadingShimmer />
  if (error)   return <EmptyState error={error} />
  if (!rows?.length) return <EmptyState label={config.title || config.label} />

  const chartRows = [...rows].filter(r => r?._cat != null && r?._val != null).slice(0, config.limit || 20)
  if (!chartRows.length) return <EmptyState label={config.title || config.label} />

  const dotSize     = config.dotSize ?? 6
  const lineWidth   = config.lineWidth ?? 2
  const showLabels  = config.dataLabels ?? true
  const orientation = config.orientation || 'horizontal' // horizontal or vertical

  const maxVal = Math.max(...chartRows.map(r => Math.abs(r._val || 0)), 1)
  const maxLabelLen = Math.max(...chartRows.map(r => String(r._cat || '').length), 1)
  const labelW = Math.min(Math.max(maxLabelLen * 5.5, 50), 120)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 3, justifyContent: 'center', padding: '8px' }}>
      {chartRows.map((r, i) => {
        const pct = maxVal > 0 ? (Math.abs(r._val || 0) / maxVal) * 100 : 0
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 9, color: t.textMuted, width: labelW, textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r._cat}</div>
            <div style={{ flex: 1, height: dotSize * 2 + 4, position: 'relative', display: 'flex', alignItems: 'center' }}>
              <div style={{ height: lineWidth, width: `${pct}%`, background: `linear-gradient(90deg, ${p.start}40, ${p.start})`, borderRadius: lineWidth }} />
              <div style={{ position: 'absolute', left: `calc(${pct}% - ${dotSize}px)`, width: dotSize * 2, height: dotSize * 2, borderRadius: '50%', background: p.start, border: `2px solid ${p.start}`, boxShadow: `0 0 8px ${p.start}44` }} />
            </div>
            {showLabels && <div style={{ fontSize: 9, fontWeight: 600, color: p.text, width: 44, flexShrink: 0 }}>{fmtVal(r._val, config.prefix, config.suffix)}</div>}
          </div>
        )
      })}
    </div>
  )
}
