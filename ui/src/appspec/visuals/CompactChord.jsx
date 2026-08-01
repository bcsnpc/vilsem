import React from 'react'
import { pal, MULTI_COLORS } from '../shared/palettes.js'
import { fmtVal } from '../shared/formatters.js'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import getThemeTokens from '../getThemeTokens'

export default function CompactChord({ rows, config, loading, error }) {
  const p = pal(config.colorScheme)
  const t = config._T || getThemeTokens('dark')
  if (loading) return <LoadingShimmer />
  if (error)   return <EmptyState error={error} />
  if (!rows?.length) return <EmptyState label={config.title || config.label} />

  // Chord diagram: rendered as a circular arc visualization
  // Each row represents a flow: _cat (source-target label), _val (value)
  const items = rows.filter(r => r._cat && r._val).slice(0, 20)
  const total = items.reduce((s, r) => s + Math.abs(r._val || 0), 0)
  const colors = config.customColors || MULTI_COLORS
  const size = 200
  const cx = size / 2, cy = size / 2, outerR = size * 0.42, innerR = size * 0.35

  let angle = 0
  const arcs = items.map((r, i) => {
    const sweep = (Math.abs(r._val || 0) / total) * 360
    const startAngle = angle
    angle += sweep
    return { ...r, startAngle, sweep, color: colors[i % colors.length] }
  })

  const toXY = (deg, radius) => {
    const rad = (deg - 90) * Math.PI / 180
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100%', alignItems: 'center', gap: 8, padding: '0 4px' }}>
      <div style={{ flex: '0 0 auto', width: '55%', maxWidth: 200, aspectRatio: '1' }}>
        <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%">
          {arcs.map((arc, i) => {
            const s = toXY(arc.startAngle, outerR)
            const e = toXY(arc.startAngle + arc.sweep, outerR)
            const si = toXY(arc.startAngle, innerR)
            const ei = toXY(arc.startAngle + arc.sweep, innerR)
            const lg = arc.sweep > 180 ? 1 : 0
            const d = `M ${s.x} ${s.y} A ${outerR} ${outerR} 0 ${lg} 1 ${e.x} ${e.y} L ${ei.x} ${ei.y} A ${innerR} ${innerR} 0 ${lg} 0 ${si.x} ${si.y} Z`
            return <path key={i} d={d} fill={arc.color} opacity={0.8} stroke="rgba(0,0,0,0.3)" strokeWidth={0.5} />
          })}
          {/* Center label */}
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill={t.textMuted} fontSize={10} fontWeight={600}>{fmtVal(total, config.prefix, config.suffix)}</text>
        </svg>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        {arcs.slice(0, 8).map((a, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10 }}>
            <div style={{ width: 7, height: 7, borderRadius: 2, background: a.color, flexShrink: 0 }} />
            <div style={{ flex: 1, color: a.color, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(a._cat).slice(0, 18)}</div>
            <div style={{ color: a.color, fontWeight: 700, flexShrink: 0 }}>{fmtVal(a._val, config.prefix, config.suffix)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
