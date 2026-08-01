import React from 'react'
import { pal, MULTI_COLORS } from '../shared/palettes.js'
import { fmtVal } from '../shared/formatters.js'
import { LoadingShimmer } from '../shared/atoms.jsx'
import getThemeTokens from '../getThemeTokens'

export default function CompactWaffle({ rows, config, loading, error }) {
  const p = pal(config.colorScheme)
  const t = config._T || getThemeTokens('dark')
  if (loading) return <LoadingShimmer />
  const val = rows?.[0]?._val ?? 0
  const max = config.maxValue || 100
  const pct = Math.min(Math.max(val / max, 0), 1)
  const filled = Math.round(pct * 100)
  const cellSize = config.cellSize || 10
  const cellGap  = config.cellGap ?? 2
  const cellRadius = config.cellRadius ?? 2
  const colors = config.customColors || MULTI_COLORS

  // Multi-segment waffle (if multiple rows)
  if (rows?.length > 1) {
    const total = rows.reduce((s, r) => s + Math.abs(r._val || 0), 0)
    let cellIdx = 0
    const segments = rows.map((r, i) => {
      const count = Math.round((Math.abs(r._val || 0) / total) * 100)
      const start = cellIdx
      cellIdx += count
      return { name: r._cat, count, start, color: colors[i % colors.length] }
    })

    return (
      <div style={{ display: 'flex', flexDirection: 'row', height: '100%', alignItems: 'center', gap: 12, padding: '0 8px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(10, ${cellSize}px)`, gap: cellGap }}>
          {Array.from({ length: 100 }, (_, i) => {
            const seg = segments.find(s => i >= s.start && i < s.start + s.count)
            return <div key={i} style={{ width: cellSize, height: cellSize, borderRadius: cellRadius, background: seg ? seg.color : t.shimmerBg || 'rgba(255,255,255,0.04)' }} />
          })}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          {segments.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9 }}>
              <div style={{ width: 7, height: 7, borderRadius: 2, background: s.color, flexShrink: 0 }} />
              <span style={{ color: s.color, fontWeight: 500 }}>{String(s.name).slice(0, 14)}</span>
              <span style={{ color: t.textFaint }}>{s.count}%</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Single value waffle
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(10, ${cellSize}px)`, gap: cellGap }}>
        {Array.from({ length: 100 }, (_, i) => (
          <div key={i} style={{ width: cellSize, height: cellSize, borderRadius: cellRadius, background: i < filled ? p.start : t.shimmerBg || 'rgba(255,255,255,0.04)', opacity: i < filled ? 0.8 : 1, transition: 'background 0.3s' }} />
        ))}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: p.text }}>{fmtVal(val, config.prefix, config.suffix)} <span style={{ fontSize: 10, color: t.textMuted }}>/ {fmtVal(max, config.prefix, config.suffix)}</span></div>
    </div>
  )
}
