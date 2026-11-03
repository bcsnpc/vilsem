import React from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { pal, MULTI_COLORS } from '@vilsem/core/palettes'
import { fmtVal } from '../shared/formatters.js'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import getThemeTokens from '../getThemeTokens'

export default function CompactSunburst({ rows, config, loading, error }) {
  const p = pal(config.colorScheme)
  const t = config._T || getThemeTokens('dark')
  if (loading) return <LoadingShimmer />
  if (error)   return <EmptyState error={error} />
  if (!rows?.length) return <EmptyState label={config.title || config.label} />

  // Sunburst: two-ring donut. Inner ring = main categories, outer ring = subcategories
  // For now, render as a donut with thicker ring and segment labels
  const innerPct = config.innerRadius ?? 30
  const outerPct = config.outerRadius ?? 90
  const colors   = config.customColors || MULTI_COLORS
  const showLabels = config.showLabels ?? true

  const total = rows.reduce((s, r) => s + Math.abs(r._val || 0), 0)
  const items = rows.filter(r => r._cat && r._val).slice(0, 16)
  const pieData = items.map(r => ({ name: r._cat, value: Math.abs(r._val || 0) }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ position: 'relative', width: '80%', maxWidth: 220, height: '100%', maxHeight: 220, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              innerRadius={`${innerPct}%`}
              outerRadius={`${outerPct}%`}
              dataKey="value"
              paddingAngle={1}
              stroke="rgba(0,0,0,0.2)"
              strokeWidth={1}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={config.animations !== false && config.animationEnabled !== false}
              animationDuration={500}
              labelLine={false}
              label={showLabels ? ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                const radius = (innerRadius + outerRadius) / 2
                const text = `${(percent * 100).toFixed(0)}%`
                // Keep percentages within their ring instead of outside the SVG.
                // Small segments retain their values in the tooltip.
                if (percent <= 0.05 || radius * 2 * Math.PI * percent < text.length * 7 || outerRadius - innerRadius < 14) return null
                const angle = -midAngle * Math.PI / 180
                return <text className="recharts-pie-label-text" x={cx + radius * Math.cos(angle)} y={cy + radius * Math.sin(angle)} textAnchor="middle" dominantBaseline="central" fontSize={11} fill={t.textPrimary}>{text}</text>
              } : false}
            >
              {pieData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Pie>
            <Tooltip contentStyle={t.TT_STYLE} formatter={(v, name) => [fmtVal(v, config.prefix, config.suffix), name]} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: t.textPrimary }}>{fmtVal(total, config.prefix, config.suffix)}</div>
            <div style={{ fontSize: 8, color: t.textMuted }}>Total</div>
          </div>
        </div>
      </div>
    </div>
  )
}
