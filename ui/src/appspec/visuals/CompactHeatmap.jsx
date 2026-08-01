import React from 'react'
import { pal, hexToRgb } from '../shared/palettes.js'
import { fmtVal } from '../shared/formatters.js'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import getThemeTokens from '../getThemeTokens'

export default function CompactHeatmap({ rows, config, loading, error }) {
  const p = pal(config.colorScheme)
  const t = config._T || getThemeTokens('dark')
  if (loading) return <LoadingShimmer />
  if (error)   return <EmptyState error={error} />
  if (!rows?.length) return <EmptyState label={config.title || config.label} />

  const cellRadius = config.cellRadius ?? 2
  const cellGap    = config.cellGap ?? 2
  const showValues = config.showValues ?? false
  const lowColor   = config.lowColor || 'rgba(255,255,255,0.04)'
  const highColor  = config.highColor || p.start

  const vals = rows.map(r => r._val || 0)
  const minV = Math.min(...vals)
  const maxV = Math.max(...vals)
  const range = maxV - minV || 1
  const cols = config.columns ?? Math.ceil(Math.sqrt(rows.length))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: cellGap, padding: 8, alignContent: 'center' }}>
        {rows.map((r, i) => {
          const intensity = (r._val - minV) / range
          const [hr, hg, hb] = hexToRgb(highColor)
          const bg = intensity > 0.1 ? `rgba(${hr},${hg},${hb},${(0.15 + intensity * 0.7).toFixed(2)})` : lowColor
          return (
            <div key={i} style={{ aspectRatio: '1', borderRadius: cellRadius, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: intensity > 0.5 ? 'rgba(255,255,255,0.9)' : t.textFaint, fontWeight: 600, position: 'relative' }} title={`${r._cat}: ${fmtVal(r._val, config.prefix, config.suffix)}`}>
              {showValues && fmtVal(r._val, config.prefix, config.suffix)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
