import { metricFormatting } from '../shared/detailedCardSchemas.js'
import React from 'react'
import { pal } from '@vilsem/core/palettes'
import { fmtVal } from '../shared/formatters.js'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import getThemeTokens from '../getThemeTokens'

export default function CompactMetricTile({ rows, config, loading, error }) {
  const p = pal(config.colorScheme)
  const t = config._T || getThemeTokens('dark')
  const val = rows?.[0]?._val
  if (loading) return <LoadingShimmer />
  if (error) return <EmptyState error={error} />
  if (!rows?.length) return <EmptyState label={config.title || config.label} />
  const max = config.maxValue || 100
  const pct = val != null ? Math.min(Math.abs(val) / max, 1) : 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', height: '100%', padding: '0 12px', gap: config.contentGap ?? 12 }}>
      {/* Mini ring */}
      {config.showRing !== false && <div data-format-target="metric-ring" style={{ position: 'relative', width: config.ringSize ?? 44, height: config.ringSize ?? 44, flexShrink: 0 }}>
        <svg viewBox="0 0 44 44" width={config.ringSize ?? 44} height={config.ringSize ?? 44}>
          <circle cx="22" cy="22" r="18" fill="none" stroke={config.ringTrackColor || t.shimmerBg || 'rgba(255,255,255,0.06)'} strokeWidth={config.ringWidth ?? 4} />
          <circle cx="22" cy="22" r="18" fill="none" stroke={config.ringColor || p.start} strokeWidth={config.ringWidth ?? 4} strokeLinecap="round"
            strokeDasharray={`${pct * 113} 113`} transform="rotate(-90 22 22)" />
        </svg>
        {config.showPercentage !== false && <div data-format-target="percentage" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: config.percentageFontSize ?? 9, fontWeight: 700, color: config.percentageColor || p.text }}>{(pct * 100).toFixed(0)}%</div>}
      </div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div data-format-target="scalar-value" style={{ fontSize: config.valueFontSize || 20, fontWeight: config.valueFontWeight ?? 800, color: config.valueColor || p.text, fontFamily: config.valueFontFamily || 'inherit' }}>{fmtVal(val, config.prefix, config.suffix)}</div>
        {(config.title || config.label) && <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>{config.title || config.label}</div>}
      </div>
    </div>
  )
}

CompactMetricTile.schema = metricFormatting
