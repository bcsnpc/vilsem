import React from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { pal, MULTI_COLORS } from '@vilsem/core/palettes'
import { fmtVal } from '../shared/formatters.js'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import getThemeTokens from '../getThemeTokens'

export default function CompactDonut({ rows, config, loading, error }) {
  const p = pal(config.colorScheme)
  const t = config._T || getThemeTokens('dark')
  if (loading) return <LoadingShimmer />
  if (error)   return <EmptyState error={error} />
  if (!rows?.length) return <EmptyState label={config.title || config.label} />

  // ── Deep customization config ──
  const innerRadiusPct  = config.innerRadius ?? 52 // % — 0 = pie, 50+ = donut
  const outerRadiusPct  = config.outerRadius ?? 85
  const padAngle        = config.paddingAngle ?? 2
  const showLegend      = config.showLegend ?? true
  const legendPosition  = config.legendPosition || 'right' // right, bottom
  const maxLegend       = config.maxLegendItems ?? 6
  const showLabels      = config.showLabels ?? false // on-slice labels
  const labelStyle      = config.labelStyle || 'percent' // percent, value, name
  const showCenterText  = config.showCenterText ?? true // for single-measure
  const customColors    = config.customColors || null // array of hex colors
  const animEnabled     = config.animationEnabled !== false
  const animDuration    = config.animationDuration === 'fast' ? 300 : config.animationDuration === 'slow' ? 800 : 500
  const cornerRadius    = config.cornerRadius ?? 0
  const strokeColor     = config.strokeColor || 'none'
  const strokeWidth     = config.strokeWidth ?? 0

  const colors = customColors || MULTI_COLORS

  // ── Single-measure radial progress ──
  if (rows.length === 1) {
    const val = rows[0]._val ?? 0
    const max = config.maxValue || 100
    const pct = Math.min(Math.abs(val) / max, 1)
    const filled = [{ value: pct }, { value: 1 - pct }]
    const ringSize = config.ringSize || 112
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 4 }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <PieChart width={ringSize} height={ringSize}>
            <Pie data={filled} innerRadius={ringSize * 0.3} outerRadius={ringSize * 0.44} startAngle={90} endAngle={-270} dataKey="value" paddingAngle={0} stroke="none" cornerRadius={cornerRadius} isAnimationActive={animEnabled} animationDuration={animDuration}>
              <Cell fill={p.start} />
              <Cell fill={t.shimmerBg || 'rgba(255,255,255,0.05)'} />
            </Pie>
          </PieChart>
          {showCenterText && (
            <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
              <div style={{ fontSize: config.valueFontSize || 15, fontWeight: 800, color: p.text, lineHeight: 1, letterSpacing: '-0.02em', textShadow: `0 0 20px ${p.start}55`, fontFamily: config.valueFontFamily || 'inherit' }}>
                {fmtVal(val, config.prefix, config.suffix)}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Multi-segment donut/pie with legend ──
  const total    = rows.reduce((s, r) => s + Math.abs(r._val || 0), 0)
  const pieData  = rows.map(r => ({ name: r._cat, value: Math.abs(r._val || 0) }))
  const legendItems = pieData.slice(0, maxLegend)
  const isBottom = legendPosition === 'bottom'

  return (
    <div style={{ display: 'flex', flexDirection: isBottom ? 'column' : 'row', height: '100%', alignItems: 'center', gap: 12, minWidth: 0, padding: '0 4px' }}>
      <div style={{ flex: isBottom ? '0 0 auto' : '0 0 auto', width: isBottom ? '60%' : '45%', maxWidth: 180, aspectRatio: '1', position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              innerRadius={`${innerRadiusPct}%`}
              outerRadius={`${outerRadiusPct}%`}
              dataKey="value"
              paddingAngle={padAngle}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              startAngle={90}
              endAngle={-270}
              cornerRadius={cornerRadius}
              isAnimationActive={animEnabled}
              animationDuration={animDuration}
              label={showLabels ? ({ name, percent, value }) => {
                if (labelStyle === 'percent') return `${(percent * 100).toFixed(0)}%`
                if (labelStyle === 'value') return fmtVal(value, config.prefix, config.suffix)
                return name?.length > 10 ? name.slice(0, 9) + '…' : name
              } : false}
            >
              {pieData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Pie>
            <Tooltip
              contentStyle={t.TT_STYLE}
              formatter={(v, name) => [fmtVal(v, config.prefix, config.suffix), name]}
            />
          </PieChart>
        </ResponsiveContainer>
        {showCenterText && innerRadiusPct > 30 && total > 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary }}>{fmtVal(total, config.prefix, config.suffix)}</div>
          </div>
        )}
      </div>
      {showLegend && (
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: isBottom ? 'row' : 'column', flexWrap: isBottom ? 'wrap' : 'nowrap', justifyContent: isBottom ? 'center' : 'center', gap: isBottom ? 10 : 5 }}>
          {legendItems.map((item, i) => {
            const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : '0'
            const color = colors[i % colors.length]
            const name = String(item.name ?? '').length > 20 ? String(item.name).slice(0, 19) + '…' : String(item.name ?? '')
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: 11, color, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color, flexShrink: 0 }}>{pct}%</div>
              </div>
            )
          })}
          {pieData.length > maxLegend && (
            <div style={{ fontSize: 9, color: t.textFaint, paddingLeft: 12 }}>+{pieData.length - maxLegend} more</div>
          )}
        </div>
      )}
    </div>
  )
}
