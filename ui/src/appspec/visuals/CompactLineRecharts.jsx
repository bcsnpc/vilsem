import React from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LabelList,
} from 'recharts'
import { pal } from '@vilsem/core/palettes'
import {
  resolveGrain, sortRowsForAxis, formatAxisLabel, getLineScrollParams,
  fmtVal, fmtAxisNumber,
} from '../shared/formatters.js'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import getThemeTokens from '../getThemeTokens'

export default function CompactLine({ rows, config, loading, error, groupBy }) {
  const p = pal(config.colorScheme)
  const t = config._T || getThemeTokens('dark')
  if (loading) return <LoadingShimmer />
  if (error)   return <EmptyState error={error} />
  if (!rows?.length) return <EmptyState label={config.title || config.label} />

  // ── Deep customization config ──
  const chartType      = config.chartType || (config.type === 'area' ? 'area' : 'line') // line, area
  const curveType      = config.smooth !== false ? 'monotone' : 'linear' // monotone (smooth) or linear (sharp)
  const strokeW        = config.strokeWidth ?? 2.5
  const showDots       = config.showDots ?? true
  const dotSize        = config.dotSize ?? 2.5
  const showGrid       = config.gridLines ?? false
  const gridStyle      = config.gridStyle || 'dashed'
  const gridColor      = config.gridLinesColor || t.gridStroke
  const gridDash       = gridStyle === 'solid' ? '' : gridStyle === 'dotted' ? '2 2' : '4 4'
  const showXAxis      = config.showXAxis ?? true
  const showYAxis      = config.showYAxis ?? false
  const showArea       = chartType === 'area'
  const fillOpacity    = config.fillOpacity ?? 0.28
  const showDataLabels = config.dataLabels ?? false
  const showAvgLine    = config.showAvgLine ?? false
  const targetLine     = config.targetLine ?? null
  // Honor both `animations: false` (new simpler toggle) and `animationEnabled: false` (legacy)
  const animEnabled    = config.animations !== false && config.animationEnabled !== false
  const animDuration   = config.animationDuration === 'fast' ? 300 : config.animationDuration === 'slow' ? 800 : 500
  const showSecondary  = config.showSecondary ?? (rows?.[0]?._val2 != null)

  const grain      = resolveGrain(groupBy, rows)
  const sortedRows = sortRowsForAxis(rows, grain)
  const fmtLabel   = (v) => formatAxisLabel(v, grain)

  const gradId = `ag-line-${config.colorScheme || 'teal'}-${String(config.title || config.label || 'line').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}`

  const { threshold: scrollThreshold, pxPerPoint } = getLineScrollParams(grain)
  const needsScroll = sortedRows.length > scrollThreshold
  const innerW = needsScroll ? Math.max(sortedRows.length * pxPerPoint, 480) : '100%'

  const tiltLabels = needsScroll && (grain === 'date' ? sortedRows.length > 10 : sortedRows.length > 16)
  const axisH = tiltLabels ? 42 : 20

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0, overflowX: needsScroll ? 'auto' : 'hidden', overflowY: 'hidden' }}>
        <div style={{ width: innerW, height: '100%', minWidth: needsScroll ? innerW : 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sortedRows} margin={{ top: 4, right: 8, bottom: axisH - 16, left: showYAxis ? 40 : 4 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={p.start} stopOpacity={fillOpacity} />
                  <stop offset="92%" stopColor={p.start} stopOpacity={0} />
                </linearGradient>
                {showSecondary && (
                  <linearGradient id={`${gradId}-2`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={p.mid || '#3B82F6'} stopOpacity={fillOpacity * 0.6} />
                    <stop offset="92%" stopColor={p.mid || '#3B82F6'} stopOpacity={0} />
                  </linearGradient>
                )}
              </defs>
              <CartesianGrid
                strokeDasharray={showGrid ? gridDash : '4 4'}
                stroke={showGrid ? gridColor : t.gridStroke}
                vertical={false}
              />
              <XAxis
                dataKey="_cat"
                tick={{ fill: t.textMuted, fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                interval={needsScroll ? 0 : 'preserveStartEnd'}
                angle={tiltLabels ? -35 : 0}
                textAnchor={tiltLabels ? 'end' : 'middle'}
                height={axisH}
                tickFormatter={fmtLabel}
                hide={!showXAxis}
              />
              <YAxis
                hide={!showYAxis}
                tick={{ fill: t.textMuted, fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={fmtAxisNumber}
                width={36}
              />
              <Tooltip
                contentStyle={t.TT_STYLE}
                formatter={(v) => [fmtVal(v, config.prefix, config.suffix)]}
                labelFormatter={fmtLabel}
                labelStyle={t.TT_LABEL}
              />
              <Area
                dataKey="_val"
                stroke={p.start}
                strokeWidth={strokeW}
                fill={showArea ? `url(#${gradId})` : 'none'}
                dot={showDots && sortedRows.length <= 30 ? { r: dotSize, fill: p.start, strokeWidth: 0 } : false}
                type={curveType}
                isAnimationActive={animEnabled}
                animationDuration={animDuration}
              >
                {showDataLabels && (
                  <LabelList dataKey="_val" position="top" offset={8} fill={t.textSecondary} fontSize={9} formatter={(v) => fmtVal(v, config.prefix, config.suffix)} />
                )}
              </Area>
              {showSecondary && (
                <Area
                  dataKey="_val2"
                  stroke={p.mid || '#3B82F6'}
                  strokeWidth={strokeW * 0.8}
                  fill={showArea ? `url(#${gradId}-2)` : 'none'}
                  dot={false}
                  type={curveType}
                  strokeDasharray="4 3"
                  isAnimationActive={animEnabled}
                  animationDuration={animDuration}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
