import React from 'react'
import { pal } from '../shared/palettes.js'
import { fmtVal } from '../shared/formatters.js'
import { LoadingShimmer } from '../shared/atoms.jsx'
import getThemeTokens from '../getThemeTokens'

export default function CompactMetricTile({ rows, config, loading, error }) {
  const p = pal(config.colorScheme)
  const t = config._T || getThemeTokens('dark')
  const val = rows?.[0]?._val
  if (loading) return <LoadingShimmer />
  const max = config.maxValue || 100
  const pct = val != null ? Math.min(Math.abs(val) / max, 1) : 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', height: '100%', padding: '0 12px', gap: 12 }}>
      {/* Mini ring */}
      <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
        <svg viewBox="0 0 44 44" width={44} height={44}>
          <circle cx="22" cy="22" r="18" fill="none" stroke={t.shimmerBg || 'rgba(255,255,255,0.06)'} strokeWidth="4" />
          <circle cx="22" cy="22" r="18" fill="none" stroke={p.start} strokeWidth="4" strokeLinecap="round"
            strokeDasharray={`${pct * 113} 113`} transform="rotate(-90 22 22)" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: p.text }}>{(pct * 100).toFixed(0)}%</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: config.valueFontSize || 20, fontWeight: 800, color: p.text }}>{fmtVal(val, config.prefix, config.suffix)}</div>
        {(config.title || config.label) && <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>{config.title || config.label}</div>}
      </div>
    </div>
  )
}
