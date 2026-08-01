import React from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { pal } from '../shared/palettes.js'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import getThemeTokens from '../getThemeTokens'

export default function CompactBumpChart({ rows, config, loading, error }) {
  const p = pal(config.colorScheme)
  const t = config._T || getThemeTokens('dark')
  if (loading) return <LoadingShimmer />
  if (error)   return <EmptyState error={error} />
  if (!rows?.length) return <EmptyState label={config.title || config.label} />

  // Bump chart: shows ranking changes. Each row = { _cat: period, _val: rank, _val2: optional second series }
  // For simplicity with single-series data, render as a line chart with rank axis
  const items = rows.filter(r => r._cat != null && r._val != null).slice(0, 30)
  if (!items.length) return <EmptyState label={config.title || config.label} />

  const dotSize   = config.dotSize ?? 5
  const lineWidth = config.lineWidth ?? 3
  const showDots  = config.showDots ?? true
  const invertY   = config.invertY ?? true // rank 1 = top

  return (
    <div style={{ height: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={items} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <XAxis dataKey="_cat" tick={{ fill: t.textMuted, fontSize: 9 }} tickLine={false} axisLine={false} />
          <YAxis reversed={invertY} tick={{ fill: t.textMuted, fontSize: 9 }} tickLine={false} axisLine={false} width={24} allowDecimals={false} />
          <Tooltip contentStyle={t.TT_STYLE} labelStyle={t.TT_LABEL} formatter={(v) => [`#${v}`, 'Rank']} />
          <Area dataKey="_val" stroke={p.start} strokeWidth={lineWidth} fill="none" dot={showDots ? { r: dotSize, fill: p.start, strokeWidth: 0 } : false} type="monotone" isAnimationActive animationDuration={500} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
