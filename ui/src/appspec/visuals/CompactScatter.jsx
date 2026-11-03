import React from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { pal } from '@vilsem/core/palettes'
import { fmtAxisNumber } from '../shared/formatters.js'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import getThemeTokens from '../getThemeTokens'

export default function CompactScatter({ rows, config, loading, error }) {
  const p = pal(config.colorScheme)
  const t = config._T || getThemeTokens('dark')
  if (loading) return <LoadingShimmer />
  if (error)   return <EmptyState error={error} />
  if (!rows?.length) return <EmptyState label={config.title || config.label} />

  // ── Deep customization ──
  const dotSize      = config.dotSize ?? 10
  const dotSizeMax   = config.dotSizeMax ?? 100
  const fillOpacity  = config.fillOpacity ?? 0.75
  const showGrid     = config.gridLines ?? false
  const showXAxis    = config.showXAxis ?? true
  const showYAxis    = config.showYAxis ?? false
  const showLabels   = config.showLabels ?? false
  const animEnabled  = config.animationEnabled !== false

  const scatterData = rows.map(r => ({
    x: r._val, y: r._val2 ?? r._val,
    z: r._val3 ?? dotSize, // third measure for bubble size
    name: r._cat,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 4, right: 8, bottom: 4, left: showYAxis ? 36 : 4 }}>
            {showGrid && <CartesianGrid strokeDasharray="4 4" stroke={t.gridStroke} />}
            <XAxis dataKey="x" tick={{ fill: t.textMuted, fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={fmtAxisNumber} hide={!showXAxis} />
            <YAxis dataKey="y" tick={{ fill: t.textMuted, fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={fmtAxisNumber} hide={!showYAxis} width={32} />
            <ZAxis dataKey="z" range={[dotSize * 3, dotSizeMax]} />
            <Tooltip contentStyle={t.TT_STYLE} labelStyle={t.TT_LABEL} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Scatter data={scatterData} fill={p.start} fillOpacity={fillOpacity} isAnimationActive={animEnabled}>
              {showLabels && scatterData.map((d, i) => (
                <Cell key={i} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
