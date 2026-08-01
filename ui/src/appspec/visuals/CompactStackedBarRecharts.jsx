import React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { pal } from '../shared/palettes.js'
import {
  BAR_SCROLL_THRESHOLD, PX_PER_BAR_ROW,
  fmtVal, fmtAxisNumber, truncateAxisLabel,
} from '../shared/formatters.js'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import getThemeTokens from '../getThemeTokens'

export default function CompactStackedBar({ rows, config, loading, error }) {
  const p = pal(config.colorScheme)
  const t = config._T || getThemeTokens('dark')
  if (loading) return <LoadingShimmer />
  if (error)   return <EmptyState error={error} />
  if (!rows?.length) return <EmptyState label={config.title || config.label} />

  const hasTwoMeasures = rows.some(r => r._val2 != null)
  const chartRows = [...rows].filter(r => r?._cat != null && r?._val != null).slice(0, 30)
  if (!chartRows.length) return <EmptyState label={config.title || config.label} />

  const maxLabelLen = Math.max(...chartRows.map(r => String(r._cat || '').length))
  const labelW = Math.min(Math.max(maxLabelLen * 5.5, 60), 130)
  const n = chartRows.length
  const needsScroll = n >= BAR_SCROLL_THRESHOLD
  const innerH = n * PX_PER_BAR_ROW

  const m1Name = config.measureName || 'Value 1'
  const m2Name = config.secondaryMeasureName || 'Value 2'

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: needsScroll ? 'auto' : 'hidden', overflowX: 'hidden', borderRadius: 12 }}>
        <div style={{ height: needsScroll ? innerH : '100%', minHeight: needsScroll ? innerH : 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartRows}
              layout="vertical"
              margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
              barCategoryGap="18%"
              style={{ background: 'transparent' }}
            >
              <CartesianGrid strokeDasharray="4 4" stroke={t.gridStroke} horizontal={false} vertical />
              <XAxis
                type="number"
                tick={{ fill: t.axisTick, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={fmtAxisNumber}
              />
              <YAxis
                type="category"
                dataKey="_cat"
                width={labelW}
                tick={{ fill: t.textSecondary, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={value => truncateAxisLabel(value, 20)}
              />
              <Tooltip
                contentStyle={t.TT_STYLE}
                labelStyle={t.TT_LABEL}
                formatter={(v, name) => [fmtVal(v, config.prefix, config.suffix), name === '_val' ? m1Name : m2Name]}
                cursor={{ fill: 'rgba(255,255,255,0.025)' }}
              />
              <Bar dataKey="_val" name={m1Name} stackId="stack" fill={p.start} radius={hasTwoMeasures ? [0, 0, 0, 0] : [0, 4, 4, 0]} maxBarSize={24} isAnimationActive animationDuration={500} />
              {hasTwoMeasures && (
                <Bar dataKey="_val2" name={m2Name} stackId="stack" fill={p.mid} radius={[0, 4, 4, 0]} maxBarSize={24} isAnimationActive animationDuration={500} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      {/* Legend */}
      {hasTwoMeasures && (
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', padding: '8px 0 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: t.textMuted }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: p.start }} />{m1Name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: t.textMuted }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: p.mid }} />{m2Name}
          </div>
        </div>
      )}
    </div>
  )
}
