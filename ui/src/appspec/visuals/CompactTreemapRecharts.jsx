import React from 'react'
import { Treemap, ResponsiveContainer } from 'recharts'
import { pal, MULTI_COLORS } from '@vilsem/core/palettes'
import { fmtVal } from '../shared/formatters.js'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import getThemeTokens from '../getThemeTokens'

export default function CompactTreemap({ rows, config, loading, error }) {
  const p = pal(config.colorScheme)
  const t = config._T || getThemeTokens('dark')
  if (loading) return <LoadingShimmer />
  if (error)   return <EmptyState error={error} />
  if (!rows?.length) return <EmptyState label={config.title || config.label} />

  // ── Deep customization ──
  const showLabels    = config.showLabels ?? true
  const showValues    = config.showValues ?? false
  const colorMode     = config.colorMode || 'single' // single, gradient, multi
  const borderColor   = config.borderColor || 'rgba(0,0,0,0.3)'
  const borderWidth   = config.borderWidth ?? 1
  const borderRadius  = config.borderRadius ?? 0
  const animEnabled   = config.animationEnabled !== false
  const customColors  = config.customColors || MULTI_COLORS

  const tmData = rows.map(r => ({ name: r._cat, size: Math.abs(r._val || 0), value: r._val || 0 }))
  const maxSize = Math.max(...tmData.map(d => d.size))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <Treemap data={tmData} dataKey="size" stroke={borderColor} fill={p.start} isAnimationActive={animEnabled}
            content={({ x, y, width, height, name, value, index }) => {
              const cellColor = colorMode === 'multi'
                ? customColors[index % customColors.length]
                : colorMode === 'gradient'
                  ? p.start
                  : p.start
              const opacity = colorMode === 'gradient' ? 0.4 + (value / maxSize) * 0.5 : 0.8
              return (
                <g>
                  <rect x={x} y={y} width={width} height={height} rx={borderRadius} fill={cellColor} fillOpacity={opacity} stroke={borderColor} strokeWidth={borderWidth} />
                  {showLabels && width > 24 && height > 16 && (
                    <text x={x + 4} y={y + 13} fill="rgba(255,255,255,0.9)" fontSize={9} fontWeight={600}>{String(name).length > Math.floor(width / 6) ? String(name).slice(0, Math.floor(width / 6) - 1) + '…' : name}</text>
                  )}
                  {showValues && width > 40 && height > 28 && (
                    <text x={x + 4} y={y + 25} fill="rgba(255,255,255,0.5)" fontSize={8}>{fmtVal(value, config.prefix, config.suffix)}</text>
                  )}
                </g>
              )
            }} />
        </ResponsiveContainer>
      </div>
    </div>
  )
}
