import React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { pal } from '@vilsem/core/palettes'
import { fmtVal, fmtAxisNumber, truncateAxisLabel } from '../shared/formatters.js'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import getThemeTokens from '../getThemeTokens'

export default function CompactGroupedBar({ rows, config, loading, error }) {
  const p = pal(config.colorScheme)
  const t = config._T || getThemeTokens('dark')
  if (loading) return <LoadingShimmer />
  if (error)   return <EmptyState error={error} />
  if (!rows?.length) return <EmptyState label={config.title || config.label} />

  const chartRows = [...rows].filter(r => r?._cat != null && r?._val != null).slice(0, 30)
  const hasTwoMeasures = chartRows.some(r => r._val2 != null)
  const m1Name = config.measureName || 'Measure 1'
  const m2Name = config.secondaryMeasureName || 'Measure 2'
  const barRadius = config.barRadius ?? 3

  return (
    <div style={{ height: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartRows} margin={{ top: 4, right: 8, bottom: 4, left: 4 }} barCategoryGap="20%" barGap={2}>
          <CartesianGrid strokeDasharray="4 4" stroke={t.gridStroke} vertical={false} />
          <XAxis dataKey="_cat" tick={{ fill: t.textMuted, fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => truncateAxisLabel(v, 12)} />
          <YAxis tick={{ fill: t.textMuted, fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={fmtAxisNumber} width={36} />
          <Tooltip contentStyle={t.TT_STYLE} labelStyle={t.TT_LABEL} formatter={(v, name) => [fmtVal(v, config.prefix, config.suffix), name === '_val' ? m1Name : m2Name]} />
          <Bar dataKey="_val" name={m1Name} fill={p.start} radius={[barRadius, barRadius, 0, 0]} maxBarSize={24} isAnimationActive animationDuration={500} />
          {hasTwoMeasures && <Bar dataKey="_val2" name={m2Name} fill={p.mid || '#3B82F6'} radius={[barRadius, barRadius, 0, 0]} maxBarSize={24} isAnimationActive animationDuration={500} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
