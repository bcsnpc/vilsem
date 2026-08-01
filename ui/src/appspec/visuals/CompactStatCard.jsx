import React from 'react'
import { pal } from '../shared/palettes.js'
import { fmtVal } from '../shared/formatters.js'
import { LoadingShimmer } from '../shared/atoms.jsx'
import getThemeTokens from '../getThemeTokens'

export default function CompactStatCard({ rows, config, loading, error }) {
  const p = pal(config.colorScheme)
  const t = config._T || getThemeTokens('dark')
  const val = rows?.[0]?._val
  const val2 = rows?.[0]?._val2
  const trend = val2 != null && val2 !== 0 ? ((val - val2) / Math.abs(val2)) * 100 : null

  if (loading) return <LoadingShimmer />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', padding: '0 14px', gap: 4 }}>
      {(config.title || config.label) && <div style={{ fontSize: 10, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{config.title || config.label}</div>}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontSize: config.valueFontSize || 28, fontWeight: 800, color: p.text, fontFamily: config.valueFontFamily || 'inherit' }}>{fmtVal(val, config.prefix, config.suffix)}</div>
        {trend != null && (
          <div style={{ fontSize: 11, fontWeight: 700, color: trend >= 0 ? '#22C55E' : '#F43F5E', display: 'flex', alignItems: 'center', gap: 2 }}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      {config.subtitle && <div style={{ fontSize: 10, color: t.textFaint }}>{config.subtitle}</div>}
    </div>
  )
}
