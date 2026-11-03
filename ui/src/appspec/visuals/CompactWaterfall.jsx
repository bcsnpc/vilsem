import React from 'react'
import { pal } from '@vilsem/core/palettes'
import { fmtVal } from '../shared/formatters.js'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import getThemeTokens from '../getThemeTokens'

export default function CompactWaterfall({ rows, config, loading, error }) {
  const p = pal(config.colorScheme)
  const t = config._T || getThemeTokens('dark')
  if (loading) return <LoadingShimmer />
  if (error)   return <EmptyState error={error} />
  if (!rows?.length) return <EmptyState label={config.title || config.label} />

  const increaseColor = config.increaseColor || '#22C55E'
  const decreaseColor = config.decreaseColor || '#F43F5E'
  const totalColor    = config.totalColor || p.start
  const showConnector = config.connectorLines ?? true
  const connectorColor = config.connectorColor || t.textFaint
  const barRadius     = config.barRadius ?? 3
  const showLabels    = config.dataLabels ?? true
  const showTotal     = config.showTotal ?? true

  // Build waterfall data
  let running = 0
  const bars = rows.map((r, i) => {
    const val = r._val || 0
    const start = running
    running += val
    return { name: r._cat, val, start, end: running, isIncrease: val >= 0 }
  })
  if (showTotal) bars.push({ name: 'Total', val: running, start: 0, end: running, isTotal: true })
  const allVals = bars.flatMap(b => [b.start, b.end])
  const minY = Math.min(0, ...allVals)
  const maxY = Math.max(...allVals)
  const range = maxY - minY || 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box', padding: showLabels ? '20px 8px 4px' : '4px 8px' }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 2, minHeight: 0 }}>
        {bars.map((b, i) => {
          const barColor = b.isTotal ? totalColor : b.isIncrease ? increaseColor : decreaseColor
          const bottom = ((Math.min(b.start, b.end) - minY) / range) * 100
          const height = (Math.abs(b.val) / range) * 100
          return (
            <div key={i} style={{ flex: 1, position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              {showConnector && i > 0 && !b.isTotal && (
                <div style={{ position: 'absolute', bottom: `${((bars[i-1].end - minY) / range) * 100}%`, left: '-50%', width: '50%', height: 1, background: connectorColor, opacity: 0.3 }} />
              )}
              <div style={{ position: 'absolute', bottom: `${bottom}%`, width: '100%', height: `${Math.max(height, 1)}%` }}>
                <div style={{ width: '70%', height: '100%', margin: '0 auto', background: barColor, borderRadius: barRadius, opacity: 0.85 }} />
              </div>
              {showLabels && (
                <div style={{ position: 'absolute', bottom: `${bottom + height + 1}%`, width: '100%', textAlign: 'center', fontSize: 8, fontWeight: 600, color: barColor }}>{fmtVal(b.val, config.prefix, config.suffix)}</div>
              )}
              <div style={{ position: 'absolute', bottom: -16, width: '100%', textAlign: 'center', fontSize: 8, color: t.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</div>
            </div>
          )
        })}
      </div>
      <div style={{ height: 20, flexShrink: 0 }} />
    </div>
  )
}
