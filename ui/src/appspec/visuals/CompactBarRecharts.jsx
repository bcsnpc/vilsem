import React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LabelList, Cell,
} from 'recharts'
import { pal, hexToRgb } from '../shared/palettes.js'
import {
  BAR_SCROLL_THRESHOLD, PX_PER_BAR_ROW,
  fmtVal, fmtAxisNumber, truncateAxisLabel,
} from '../shared/formatters.js'
import { AppBarTooltip, LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import getThemeTokens from '../getThemeTokens'

export default function CompactBar({ rows, config, loading, error }) {
  const p = pal(config.colorScheme)
  const t = config._T || getThemeTokens('dark')
  if (loading) return <LoadingShimmer />
  if (error)   return <EmptyState error={error} />
  if (!rows?.length) return <EmptyState label={config.title || config.label} />

  const chartRows = [...rows]
    .filter(r => r?._cat != null && r?._val != null)
    .slice(0, config.limit || 50)
  if (!chartRows.length) return <EmptyState label={config.title || config.label} />

  // ── Deep customization config ──
  const orientation    = config.orientation || 'horizontal' // horizontal = bars go left→right, vertical = bars go bottom→up
  const barRadius      = config.barRadius ?? 4
  const barGap         = config.barGap ?? 2
  const barCategoryGap = config.barCategoryGap || '15%'
  const gradient       = config.gradient ?? false
  const gradientTo     = config.gradientTo || p.mid || p.start
  const showGrid       = config.gridLines ?? false
  const gridStyle      = config.gridStyle || 'dashed' // solid, dashed, dotted
  const gridColor      = config.gridLinesColor || t.gridStroke
  const gridDash       = gridStyle === 'solid' ? '' : gridStyle === 'dotted' ? '2 2' : '4 4'
  const showDataLabels = config.dataLabels ?? true
  const labelPosition  = config.labelPosition || 'right' // right, inside, top
  const showXAxis      = config.showXAxis ?? true
  const showYAxis      = config.showYAxis ?? true
  const showBackground = config.showBarBackground ?? true
  const rankOpacity    = config.rankOpacity ?? true
  const highlightMax   = config.highlightMax ?? false
  const showAvgLine    = config.showAvgLine ?? false
  const targetLine     = config.targetLine ?? null
  const conditionalColor = config.conditionalColor || null // { threshold, above, below }
  const animDuration   = config.animationDuration === 'fast' ? 300 : config.animationDuration === 'slow' ? 800 : 500
  // Honor both `animations: false` (new simpler toggle) and `animationEnabled: false` (legacy)
  const animEnabled    = config.animations !== false && config.animationEnabled !== false
  const maxBarWidth    = config.maxBarSize ?? 26

  const maxLabelLen = Math.max(...chartRows.map(r => String(r._cat || '').length))
  const labelW = Math.min(Math.max(maxLabelLen * 5.5, 60), 130)
  const n = chartRows.length
  const [cr, cg, cb] = hexToRgb(p.start)
  const [cr2, cg2, cb2] = hexToRgb(gradientTo)
  const maxVal = Math.max(...chartRows.map(r => Math.abs(r._val || 0)))
  const avgVal = chartRows.reduce((s, r) => s + (r._val || 0), 0) / n
  const isAsc = config.orderBy === 'asc'

  const needsScroll = n >= BAR_SCROLL_THRESHOLD
  const innerH = n * PX_PER_BAR_ROW

  // Build gradient def ID
  const gradId = gradient ? `bar-grad-${(config.colorScheme || 'teal')}` : null

  const isVertical = orientation === 'vertical'

  // Reference lines data
  const refLines = []
  if (showAvgLine) refLines.push({ val: avgVal, color: '#F59E0B', label: 'Avg', dash: '4 4' })
  if (targetLine != null) refLines.push({ val: targetLine, color: '#F43F5E', label: 'Target', dash: '6 3' })

  return (
    <div style={{ height: '100%', overflowY: needsScroll && !isVertical ? 'auto' : 'hidden', overflowX: needsScroll && isVertical ? 'auto' : 'hidden', borderRadius: 12 }}>
      {/* Suppress the browser's default focus outline on SVG rects — shows
          up as a brief dotted/blue flash when you click a bar. */}
      <style>{`.cb-bar-wrap svg *:focus, .cb-bar-wrap svg *:focus-visible, .cb-bar-wrap .recharts-rectangle:focus { outline: none !important; }`}</style>
      <div className="cb-bar-wrap" style={{ height: needsScroll && !isVertical ? innerH : '100%', width: needsScroll && isVertical ? n * PX_PER_BAR_ROW : '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartRows}
            layout={isVertical ? undefined : 'vertical'}
            margin={{ top: 4, right: showDataLabels ? 60 : 16, left: 4, bottom: 4 }}
            barCategoryGap={barCategoryGap}
            barGap={barGap}
            style={{ background: 'transparent', outline: 'none' }}
          >
            {gradient && (
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={p.start} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={gradientTo} stopOpacity={0.7} />
                </linearGradient>
              </defs>
            )}
            {showGrid && (
              <CartesianGrid
                strokeDasharray={gridDash}
                stroke={gridColor}
                horizontal={isVertical ? true : false}
                vertical={isVertical ? false : true}
              />
            )}
            <XAxis
              type={isVertical ? 'category' : 'number'}
              dataKey={isVertical ? '_cat' : undefined}
              tick={{ fill: t.textMuted, fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={isVertical ? (v => truncateAxisLabel(v, 12)) : fmtAxisNumber}
              hide={isVertical ? !showYAxis : !showXAxis}
            />
            <YAxis
              type={isVertical ? 'number' : 'category'}
              dataKey={isVertical ? undefined : '_cat'}
              width={isVertical ? undefined : labelW}
              tick={{ fill: isVertical ? t.textMuted : t.textSecondary, fontSize: isVertical ? 10 : 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={isVertical ? fmtAxisNumber : (v => truncateAxisLabel(v, 24))}
              hide={isVertical ? !showXAxis : !showYAxis}
            />
            <Tooltip
              content={<AppBarTooltip prefix={config.prefix} suffix={config.suffix} accent={p.text} measureName={config.measureName} />}
              cursor={{ fill: 'rgba(255,255,255,0.025)' }}
            />
            {refLines.map((ref, i) => (
              <CartesianGrid key={`ref-${i}`} strokeDasharray={ref.dash} stroke={ref.color} />
            ))}
            <Bar
              dataKey="_val"
              fill={gradient ? `url(#${gradId})` : `rgba(${cr},${cg},${cb},0.80)`}
              radius={isVertical ? [barRadius, barRadius, 0, 0] : [0, barRadius, barRadius, 0]}
              background={showBackground ? { fill: 'rgba(255,255,255,0.025)' } : false}
              minPointSize={3}
              maxBarSize={maxBarWidth}
              isAnimationActive={animEnabled}
              animationDuration={animDuration}
              animationEasing="ease-out"
              style={{ cursor: config._onBarClick ? 'pointer' : 'default' }}
              onClick={(data, idx, e) => {
                // Click-to-filter: updates globalFilters with this bar's
                // category, affecting other visuals (KPIs, charts). Second
                // click on same bar clears the filter. Never affects slicers.
                if (!config._onBarClick) return
                e?.stopPropagation?.()
                config._onBarClick(data?._cat)
              }}
            >
              {chartRows.map((row, index) => {
                // Click-to-filter dim: if this visual sourced a filter, the
                // selected bar pops at full saturation while every other
                // bar fades to the same scheme hue at ~25% opacity — the
                // PBI-native "fade" look. Using the scheme color (not a
                // grey token) keeps the visual identity; using a fixed
                // fillOpacity (not the rank multiplier) guarantees the
                // fade is uniform regardless of rank. `_selectedCat` is
                // set by AppSpecRenderer when
                // `filterSources[key] === visual.id`.
                const selectedCat = config._selectedCat
                const hasSelection  = selectedCat != null
                const isSelectedBar = hasSelection && String(row._cat) === String(selectedCat)
                const isDimmed      = hasSelection && !isSelectedBar
                const selectExtra   = isSelectedBar ? { stroke: p.start, strokeWidth: 2 } : {}
                // Dimmed: faded scheme color. Preserves the bar's hue so
                // the cluster still reads as one visual; drops opacity so
                // the selected bar visibly pops.
                if (isDimmed) {
                  return <Cell key={`${row._cat}-${index}`} fill={gradient ? `url(#${gradId})` : p.start} fillOpacity={0.25} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
                }
                // Conditional coloring
                if (conditionalColor && conditionalColor.threshold != null) {
                  const color = row._val >= conditionalColor.threshold
                    ? (conditionalColor.above || p.start)
                    : (conditionalColor.below || '#F43F5E')
                  return <Cell key={`${row._cat}-${index}`} fill={color} stroke="rgba(255,255,255,0.08)" strokeWidth={1} {...selectExtra} />
                }
                // Highlight max
                if (highlightMax && row._val === maxVal) {
                  return <Cell key={`${row._cat}-${index}`} fill={p.start} stroke={p.start} strokeWidth={2} {...selectExtra} />
                }
                // Rank-based opacity — selected bar fully saturates so it
                // visibly "pops" above the rank gradient.
                if (rankOpacity) {
                  const ratio = isAsc ? index / Math.max(n - 1, 1) : (n - 1 - index) / Math.max(n - 1, 1)
                  const opacity = isSelectedBar ? '1.00' : (0.35 + ratio * 0.55).toFixed(2)
                  return <Cell key={`${row._cat}-${index}`} fill={gradient ? `url(#${gradId})` : `rgba(${cr},${cg},${cb},${opacity})`} stroke="rgba(255,255,255,0.08)" strokeWidth={1} {...selectExtra} />
                }
                return <Cell key={`${row._cat}-${index}`} fill={gradient ? `url(#${gradId})` : `rgba(${cr},${cg},${cb},0.75)`} stroke="rgba(255,255,255,0.08)" strokeWidth={1} {...selectExtra} />
              })}
              {(() => {
                // Data-label color resolution. config.dataLabelColor:
                //   'auto' (default) — inside-position: white; outside: textPrimary.
                //   hex string         — always that color regardless of position.
                const dlColor       = config.dataLabelColor || 'auto'
                const insideColor   = dlColor === 'auto' ? '#FFFFFF' : dlColor
                const outsideColor  = dlColor === 'auto' ? t.textPrimary : dlColor
                if (!showDataLabels) return null
                if (labelPosition === 'auto') {
                  return (
                    <LabelList
                      dataKey="_val"
                      content={(props) => {
                        const { x = 0, y = 0, width = 0, height = 0, value } = props
                        const fmt = fmtVal(value, config.prefix, config.suffix)
                        const approxTextWidth = String(fmt).length * 6 + 12
                        const isWideEnough = width >= approxTextWidth
                        return (
                          <text
                            x={isWideEnough ? x + width - 6 : x + width + 6}
                            y={y + height / 2 + 3}
                            fill={isWideEnough ? insideColor : outsideColor}
                            fontSize={10}
                            fontWeight={600}
                            textAnchor={isWideEnough ? 'end' : 'start'}
                            style={isWideEnough && dlColor === 'auto' ? { filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' } : undefined}
                          >{fmt}</text>
                        )
                      }}
                    />
                  )
                }
                return (
                  <LabelList
                    dataKey="_val"
                    position={isVertical ? 'top' : labelPosition}
                    offset={10}
                    fill={labelPosition === 'inside' ? insideColor : outsideColor}
                    fontSize={10}
                    fontWeight={600}
                    formatter={(v) => fmtVal(v, config.prefix, config.suffix)}
                  />
                )
              })()}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
