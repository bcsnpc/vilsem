import React from 'react'
import { pal } from '../shared/palettes.js'
import { fmtVal } from '../shared/formatters.js'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import getThemeTokens from '../getThemeTokens'

export default function CompactBullet({ rows, config, loading, error }) {
  const p = pal(config.colorScheme)
  const t = config._T || getThemeTokens('dark')
  if (loading) return <LoadingShimmer />
  if (error)   return <EmptyState error={error} />
  const val = rows?.[0]?._val ?? 0
  const target = config.targetValue ?? (rows?.[0]?._val2 ?? 100)
  const max = config.maxValue ?? Math.max(val, target) * 1.2
  const ranges = config.ranges || [
    { pct: 0.6, color: t.shimmerBg2 || 'rgba(255,255,255,0.04)' },
    { pct: 0.8, color: t.shimmerBg || 'rgba(255,255,255,0.06)' },
    { pct: 1.0, color: 'rgba(255,255,255,0.08)' },
  ]
  const barH = config.barHeight ?? 12

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, padding: '0 16px' }}>
      <div style={{ fontSize: config.valueFontSize || 22, fontWeight: 800, color: p.text, fontFamily: config.valueFontFamily || 'inherit' }}>
        {fmtVal(val, config.prefix, config.suffix)}
      </div>
      <div style={{ width: '100%', maxWidth: 280, position: 'relative', height: barH + 8 }}>
        {/* Background ranges */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', borderRadius: 4, overflow: 'hidden' }}>
          {ranges.map((r, i) => (
            <div key={i} style={{ flex: r.pct - (ranges[i-1]?.pct || 0), background: r.color }} />
          ))}
        </div>
        {/* Actual value bar */}
        <div style={{ position: 'absolute', top: (barH + 8 - barH) / 2, left: 0, height: barH, width: `${Math.min((val / max) * 100, 100)}%`, background: p.start, borderRadius: 3, transition: 'width 0.5s ease-out' }} />
        {/* Target marker */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${Math.min((target / max) * 100, 100)}%`, width: 2, background: t.textSecondary, borderRadius: 1 }} />
      </div>
      {(config.title || config.label) && (
        <div style={{ fontSize: 10, color: t.textMuted }}>{config.title || config.label} {target > 0 && `(target: ${fmtVal(target, config.prefix, config.suffix)})`}</div>
      )}
    </div>
  )
}
