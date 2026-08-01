import React from 'react'
import { pal, MULTI_COLORS } from '../shared/palettes.js'
import { fmtVal } from '../shared/formatters.js'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import getThemeTokens from '../getThemeTokens'

export default function CompactSlopeChart({ rows, config, loading, error }) {
  const p = pal(config.colorScheme)
  const t = config._T || getThemeTokens('dark')
  if (loading) return <LoadingShimmer />
  if (error)   return <EmptyState error={error} />
  if (!rows?.length || !rows.some(r => r._val2 != null)) return <EmptyState label={config.title || config.label || 'Need 2 measures'} />

  // Slope chart: two columns (start, end), lines connecting them per category
  const items = rows.filter(r => r._cat != null && r._val != null && r._val2 != null).slice(0, config.limit || 12)
  if (!items.length) return <EmptyState label={config.title || config.label} />

  const allVals = items.flatMap(r => [r._val, r._val2])
  const minV = Math.min(...allVals)
  const maxV = Math.max(...allVals)
  const range = maxV - minV || 1
  const dotSize   = config.dotSize ?? 5
  const lineWidth = config.lineWidth ?? 2
  const colors    = config.customColors || MULTI_COLORS
  const leftLabel = config.leftLabel || 'Start'
  const rightLabel = config.rightLabel || 'End'
  const h = 100 // viewBox height
  const pad = 10

  const yPos = (v) => pad + ((maxV - v) / range) * (h - pad * 2)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '4px 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 20px', fontSize: 9, fontWeight: 600, color: t.textMuted, flexShrink: 0 }}>
        <span>{leftLabel}</span><span>{rightLabel}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <svg width="100%" height="100%" viewBox={`0 0 200 ${h}`} preserveAspectRatio="none">
          {items.map((r, i) => {
            const color = colors[i % colors.length]
            const y1 = yPos(r._val)
            const y2 = yPos(r._val2)
            const improved = r._val2 > r._val
            return (
              <g key={i}>
                <line x1={30} y1={y1} x2={170} y2={y2} stroke={color} strokeWidth={lineWidth} opacity={0.7} />
                <circle cx={30} cy={y1} r={dotSize} fill={color} />
                <circle cx={170} cy={y2} r={dotSize} fill={color} />
                <text x={3} y={y1 + 3} fill={color} fontSize={7} fontWeight={600}>{fmtVal(r._val, config.prefix, config.suffix)}</text>
                <text x={197} y={y2 + 3} fill={color} fontSize={7} fontWeight={600} textAnchor="end">{fmtVal(r._val2, config.prefix, config.suffix)}</text>
              </g>
            )
          })}
        </svg>
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', padding: '4px 0', flexShrink: 0 }}>
        {items.slice(0, 8).map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 8, color: colors[i % colors.length] }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: colors[i % colors.length] }} />{String(r._cat).slice(0, 15)}
          </div>
        ))}
      </div>
    </div>
  )
}
