import React from 'react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, Tooltip, ResponsiveContainer,
} from 'recharts'
import { pal } from '../shared/palettes.js'
import { fmtVal } from '../shared/formatters.js'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import getThemeTokens from '../getThemeTokens'

export default function CompactRadar({ rows, config, loading, error }) {
  const p = pal(config.colorScheme)
  const t = config._T || getThemeTokens('dark')
  if (loading) return <LoadingShimmer />
  if (error)   return <EmptyState error={error} />
  if (!rows?.length) return <EmptyState label={config.title || config.label} />

  // ── Deep customization ──
  const fillOpacity  = config.fillOpacity ?? 0.22
  const strokeW      = config.strokeWidth ?? 2
  const showDots     = config.showDots ?? false
  const gridColor    = config.gridColor || t.gridStroke
  const labelColor   = config.labelColor || t.textMuted
  const labelSize    = config.labelFontSize ?? 9
  const animEnabled  = config.animationEnabled !== false

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={rows}>
            <PolarGrid stroke={gridColor} />
            <PolarAngleAxis dataKey="_cat" tick={{ fill: labelColor, fontSize: labelSize }} />
            <Radar dataKey="_val" stroke={p.start} strokeWidth={strokeW} fill={p.start} fillOpacity={fillOpacity} dot={showDots ? { r: 3, fill: p.start } : false} isAnimationActive={animEnabled} />
            <Tooltip contentStyle={t.TT_STYLE} labelStyle={t.TT_LABEL} formatter={(v) => [fmtVal(v, config.prefix, config.suffix)]} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
