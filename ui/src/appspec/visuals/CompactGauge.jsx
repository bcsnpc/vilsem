import React from 'react'
import { pal } from '@vilsem/core/palettes'
import { fmtVal } from '../shared/formatters.js'
import { LoadingShimmer } from '../shared/atoms.jsx'
import getThemeTokens from '../getThemeTokens'

export default function CompactGauge({ rows, config, loading, error }) {
  const p = pal(config.colorScheme)
  const t = config._T || getThemeTokens('dark')
  const val = rows?.[0]?._val

  // ── Deep customization ──
  const min        = config.minValue ?? 0
  const max        = config.maxValue ?? 100
  const arcWidth   = config.arcWidth ?? 10
  const gaugeSize  = config.gaugeSize || 120
  const showTarget = config.targetValue != null
  const targetVal  = config.targetValue ?? null
  const colorZones = config.colorZones || null // [{ from, to, color }]
  const showMinMax = config.showMinMax ?? false
  const valueSize  = config.valueFontSize || 15

  const pct = val != null ? Math.max(0, Math.min((val - min) / (max - min), 1)) : 0
  const r = gaugeSize * 0.38; const cx = gaugeSize / 2; const cy = gaugeSize * 0.52
  const toXY = (deg) => { const rad = (deg - 90) * Math.PI / 180; return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) } }
  const arc = (s, e) => { const a = toXY(s - 90); const b = toXY(e - 90); const lg = (e - s) > 180 ? 1 : 0; return `M ${a.x} ${a.y} A ${r} ${r} 0 ${lg} 1 ${b.x} ${b.y}` }

  // Determine fill color based on zones
  let fillColor = p.start
  if (colorZones && val != null) {
    for (const zone of colorZones) {
      if (val >= zone.from && val <= zone.to) { fillColor = zone.color; break }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      {loading
        ? <LoadingShimmer />
        : <svg width={gaugeSize} height={gaugeSize * 0.75} viewBox={`0 0 ${gaugeSize} ${gaugeSize * 0.75}`}>
            <path d={arc(-140, 140, r)} fill="none" stroke={t.shimmerBg || 'rgba(255,255,255,0.08)'} strokeWidth={arcWidth} strokeLinecap="round" />
            {val != null && <path d={arc(-140, -140 + pct * 280)} fill="none" stroke={fillColor} strokeWidth={arcWidth} strokeLinecap="round" />}
            {showTarget && targetVal != null && (() => {
              const tPct = Math.max(0, Math.min((targetVal - min) / (max - min), 1))
              const tDeg = -140 + tPct * 280
              const tp = toXY(tDeg - 90)
              return <circle cx={tp.x} cy={tp.y} r={3} fill="#F59E0B" stroke="#0B0B14" strokeWidth={1.5} />
            })()}
            <text x={cx} y={cy + 4} textAnchor="middle" fill={fillColor} fontSize={valueSize} fontWeight={800} fontFamily={config.valueFontFamily || 'inherit'}>{fmtVal(val, config.prefix, config.suffix)}</text>
            {showMinMax && <>
              <text x={cx - r + 5} y={cy + r * 0.5} textAnchor="start" fill={t.textFaint} fontSize={8}>{min}</text>
              <text x={cx + r - 5} y={cy + r * 0.5} textAnchor="end" fill={t.textFaint} fontSize={8}>{max}</text>
            </>}
          </svg>
      }
    </div>
  )
}
