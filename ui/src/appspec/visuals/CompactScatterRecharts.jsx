import React from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { pal } from '@vilsem/core/palettes'
import { fmtAxisNumber } from '../shared/formatters.js'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import getThemeTokens from '../getThemeTokens'

function ScatterTooltip({ active, payload, xLabel, yLabel, t }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div style={{ ...t.TT_STYLE, padding: '6px 10px', fontSize: 12 }}>
      {d.name && <div style={{ fontWeight: 600, marginBottom: 2 }}>{d.name}</div>}
      <div>{xLabel || 'X'}: {fmtAxisNumber(d.x)}</div>
      <div>{yLabel || 'Y'}: {fmtAxisNumber(d.y)}</div>
    </div>
  )
}

export default function CompactScatter({ rows, config, loading, error }) {
  const p = pal(config.colorScheme)
  const t = config._T || getThemeTokens('dark')
  const xLabel = config.measureName
  const yLabel = config.secondaryMeasureName
  if (loading) return <LoadingShimmer />
  if (error)   return <EmptyState error={error} />
  if (!rows?.length) return <EmptyState label={config.title || config.label} />

  // ── Deep customization ──
  const dotSize      = config.dotSize ?? 16
  const dotSizeMax   = config.dotSizeMax ?? 100
  const fillOpacity  = config.fillOpacity ?? 0.75
  const showGrid     = config.gridLines ?? true
  const showXAxis    = config.showXAxis ?? true
  const showYAxis    = config.showYAxis ?? true
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
            <XAxis type="number" dataKey="x" domain={['auto', 'auto']} tick={{ fill: t.textMuted, fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={fmtAxisNumber} hide={!showXAxis} />
            <YAxis type="number" dataKey="y" domain={['auto', 'auto']} tick={{ fill: t.textMuted, fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={fmtAxisNumber} hide={!showYAxis} width={40} />
            <ZAxis dataKey="z" range={[dotSize * 3, dotSizeMax]} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ScatterTooltip xLabel={xLabel} yLabel={yLabel} t={t} />} />
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
