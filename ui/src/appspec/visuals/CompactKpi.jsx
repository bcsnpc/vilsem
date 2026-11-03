import React, { useState, useEffect } from 'react'
import { pal } from '@vilsem/core/palettes'
import { fmtVal } from '../shared/formatters.js'
import { SparklineSvg } from '../shared/atoms.jsx'
import { useCountUp } from '../shared/hooks.js'
import getThemeTokens from '../getThemeTokens'

export default function CompactKpi({ rows, config, loading, error }) {
  const p   = pal(config.colorScheme || config.title)
  const t   = config._T || getThemeTokens('dark')
  const val = rows?.[0]?._val
  const val2 = rows?.[0]?._val2 // comparison value (e.g. previous period)

  // Counter-up animation — interpolates from previous to current value on mount
  // + data change. Honors prefers-reduced-motion. Falls back to static if value
  // isn't numeric or user disabled via config.countUp === false.
  const countUpEnabled = config.animations !== false && config.countUp !== false && typeof val === 'number' && !loading
  const animatedVal = useCountUp(val, {
    enabled: countUpEnabled,
    duration: config.countUpDuration ?? 900,
  })
  const displayVal = countUpEnabled && animatedVal != null ? animatedVal : val

  // ── Sparkline data — fetch time series if showSparkline is on ──
  // Honors global slicer filters (passed via config._globalFilters) and
  // re-fetches when they change — matches PBI live-DAX behavior.
  const [sparkPoints, setSparkPoints] = useState(null)
  const sparkMeasure = config.measureName || config.title || ''
  const sparkEnabled = config.showSparkline ?? false
  // Coerce sparklineAxis to the canonical "Table[Column]" string form.
  // LLMs sometimes emit it as an object {table, column} — normalize here so
  // the downstream queryTable call always gets a string.
  const sparkAxisCfg = (() => {
    const raw = config.sparklineAxis
    if (!raw) return null
    if (typeof raw === 'string') return raw
    if (raw.table && raw.column) return `${raw.table}[${raw.column}]`
    return null
  })()
  const sparkFilters = config._globalFilters || {}
  const sparkFiltersKey = config._globalFiltersKey || ''
  useEffect(() => {
    setSparkPoints(null) // reset on axis/measure/filter change
    if (!sparkEnabled || !sparkMeasure || !window.semantica?.queryTable) return
    let cancelled = false
    const run = async () => {
      const dateColumns = []
      if (sparkAxisCfg) {
        dateColumns.push(sparkAxisCfg)
      } else if (window.semantica?.getModelContext) {
        try {
          const ctx = window._sparklineModelCtx || await window.semantica.getModelContext()
          window._sparklineModelCtx = ctx
          for (const table of (ctx?.tables || [])) {
            const isDateTable = table.type === 'date' || /calendar|date|time/i.test(table.name)
            if (!isDateTable) continue
            const cols = table.columns || []
            const monthCol = cols.find(c => /month/i.test(c.name) && /start|date/i.test(c.name)) || cols.find(c => /^month$/i.test(c.name))
            if (monthCol) dateColumns.push(`${table.name}[${monthCol.name}]`)
            const quarterCol = cols.find(c => /quarter/i.test(c.name) && /start|date/i.test(c.name))
            if (quarterCol) dateColumns.push(`${table.name}[${quarterCol.name}]`)
            const yearCol = cols.find(c => /^year$/i.test(c.name)) || cols.find(c => /year/i.test(c.name))
            if (yearCol) dateColumns.push(`${table.name}[${yearCol.name}]`)
          }
        } catch { /* ignore */ }
      }
      if (!dateColumns.length || cancelled) return
      console.log('[Sparkline]', sparkMeasure, 'trying cols:', dateColumns, 'filters:', sparkFilters)
      for (const col of dateColumns) {
        if (cancelled) return
        try {
          const res = await window.semantica.queryTable({
            groupBy: [col], measures: [sparkMeasure], filters: sparkFilters, limit: 500, orderBy: 'asc',
          })
          if (cancelled) return
          console.log('[Sparkline]', col, '→', res?.rows?.length || 0, 'rows')
          if (res?.rows?.length > 2) {
            const colName = col.split('[')[1]?.replace(']', '')
            const dateKey = Object.keys(res.rows[0]).find(k => k === col || k === colName)
            const key = Object.keys(res.rows[0]).find(k => k !== dateKey)
            // queryTable's DAX sorts by the MEASURE (ORDER BY [measure]); a sparkline is
            // a time series, so re-sort chronologically by the axis column — otherwise the
            // line comes out as a smooth value-sorted ramp instead of real ups-and-downs.
            const ordered = dateKey
              ? [...res.rows].sort((a, b) => {
                  const av = a[dateKey], bv = b[dateKey]
                  const at = Date.parse(av), bt = Date.parse(bv)
                  if (!Number.isNaN(at) && !Number.isNaN(bt)) return at - bt
                  return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' })
                })
              : res.rows
            const pts = ordered.map(r => {
              const v = r[sparkMeasure] ?? r[key] ?? Object.values(r).find(x => typeof x === 'number')
              return typeof v === 'number' ? v : null
            }).filter(v => v != null)
            if (pts.length > 2) { console.log('[Sparkline] using', col, 'with', pts.length, 'points (chrono-sorted)'); setSparkPoints(pts); return }
          }
        } catch (e) { console.warn('[Sparkline] query failed for', col, e?.message) }
      }
    }
    run()
    return () => { cancelled = true }
  }, [sparkEnabled, sparkMeasure, sparkAxisCfg, sparkFiltersKey])

  // ── Deep customization config ──
  // Font sizes default to PIXEL values computed from card height — no vw/clamp,
  // so the same formula applies in Semantica and PBI DAX → identical rendering
  // at any viewport. Override via explicit config.valueFontSize/titleFontSize.
  const cardPxH        = config._cardPixelHeight || 168
  const defaultValueSize = Math.round(Math.max(22, Math.min(40, cardPxH * 0.2)))
  const defaultTitleSize = Math.round(Math.max(10, Math.min(14, cardPxH * 0.07)))
  const align          = config.align || 'center' // left, center, right
  const valueSize      = config.valueFontSize || defaultValueSize
  const valueWeight    = config.valueFontWeight ?? 800
  const valueColor     = config.valueColor || p.text
  const valueFont      = config.valueFontFamily || 'inherit'
  const titleSize      = config.titleFontSize || defaultTitleSize
  const titleWeight    = config.titleFontWeight ?? 500
  const titleColor     = config.titleColor || t.textMuted
  const titleFont      = config.titleFontFamily || 'inherit'
  const titlePosition  = config.titlePosition || 'below' // above, below
  const showGlow       = config.showGlow !== false
  const showTrend      = config.showTrend ?? false // show ▲/▼ with % change
  const trendValue     = config.trendValue ?? (val2 != null && val2 !== 0 ? ((val - val2) / Math.abs(val2)) * 100 : null)
  const showSparkline    = config.showSparkline ?? false
  const sparklinePosition = config.sparklinePosition || 'inline' // inline (next to value), below, background
  const sparklineAxis    = config.sparklineAxis || null // e.g. "Calendar Lookup[Start of Month]" — auto-detects if null
  // Default 100px for inline, '100%' for background — wider than before so
  // month-level peaks/valleys are visible (matches PBI's stretched SVG).
  const sparklineWidth   = config.sparklineWidth ?? (sparklinePosition === 'background' ? '100%' : 100)
  const sparklineHeight  = config.sparklineHeight ?? (sparklinePosition === 'background' ? '100%' : 24)
  const sparklineColor   = config.sparklineColor || p.start
  const sparklineShowArea = config.sparklineShowArea ?? true
  const sparklineWeight  = config.sparklineWeight ?? 1.5   // line thickness (px), user-adjustable
  const sparkData      = sparkPoints || (rows?.length > 1 ? rows.map(r => r._val).filter(v => v != null) : null)
  const showIcon       = config.showIcon ?? false
  const icon           = config.icon || '✦'
  const compactMode    = config.compact ?? false

  const gap = compactMode ? 2 : 6
  const padding = compactMode ? '0 6px' : '0 10px'
  // Compact mode: smaller fonts, tighter everything
  const effectiveValueSize = compactMode && typeof valueSize === 'number' ? Math.round(valueSize * 0.7) : valueSize
  const effectiveTitleSize = compactMode && typeof titleSize === 'number' ? Math.round(titleSize * 0.85) : titleSize

  const titleEl = (config.showTitle !== false) && (config.title || config.label) && (
    <div style={{ fontSize: effectiveTitleSize, fontWeight: titleWeight, color: titleColor, textAlign: align, lineHeight: 1.3, letterSpacing: config.titleUppercase ? '0.05em' : '0.01em', maxWidth: '90%', fontFamily: titleFont, textTransform: config.titleUppercase ? 'uppercase' : 'none' }}>
      {config.title || config.label}
    </div>
  )

  // Card style: minimal (default), filled, glass, accent, bordered
  const cardStyle    = config.cardStyle || 'minimal'
  const showProgress = config.showProgress ?? false
  // Default progress target = 1.25× current value so bar fills ~80% — reads
  // as "you're pushing toward a higher goal". User can override with a
  // specific `progressMax` (a revenue target, SLA goal, etc.) via inspector.
  const progressMax  = config.progressMax ?? config.maxValue ?? (val != null ? Math.abs(val) * 1.25 : 100)
  const progressPct  = val != null ? Math.min(Math.abs(val) / progressMax, 1) : 0

  // Background styles per card variant
  // NOTE: card chrome (background, border, shadow) is applied ONCE by the
  // outer wrapper via getCardChromeStyle() in AppSpecRenderer's render paths.
  // CompactKpi itself MUST NOT add its own background or it stacks on top of
  // the wrapper and drifts visibly from the PBI DAX output (which has only
  // a single layer). Only the padding-for-accent adjustment stays.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center', justifyContent: 'center', height: '100%', gap, padding: cardStyle === 'accent' ? '0 10px 0 14px' : padding }}>
      {loading
        ? <div style={{ width: 88, height: 30, background: t.shimmerBg, borderRadius: 6, animation: 'spec-pulse 1.5s ease-in-out infinite' }} />
        : error
        ? <div style={{ fontSize: 10, color: '#F87171', textAlign: 'center', lineHeight: 1.5 }}>⚠ {error}</div>
        : <>
            {titlePosition === 'above' && titleEl}
            {showIcon && <div style={{ fontSize: config.iconSize ?? (compactMode ? 14 : 18), color: config.iconColor || p.text, opacity: config.iconColor ? 1 : 0.5 }}>{icon}</div>}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontSize: effectiveValueSize, fontWeight: valueWeight, color: valueColor, lineHeight: 1, letterSpacing: '-0.02em', textShadow: showGlow ? `0 0 24px ${p.start}aa, 0 0 48px ${p.start}55` : 'none', fontFamily: valueFont, fontVariantNumeric: 'tabular-nums' }}>
                {fmtVal(displayVal, config.prefix, config.suffix)}
              </div>
              {showTrend && trendValue != null && (
                <div style={{ fontSize: config.trendFontSize ?? 11, fontWeight: 700, color: trendValue >= 0 ? (config.trendUpColor || '#22C55E') : (config.trendDownColor || '#F43F5E'), display: 'flex', alignItems: 'center', gap: 2 }}>
                  {trendValue >= 0 ? '▲' : '▼'} {Math.abs(trendValue).toFixed(1)}%
                </div>
              )}
              {/* Inline sparkline (next to value) */}
              {showSparkline && sparklinePosition === 'inline' && sparkData && sparkData.length > 2 && (
                <SparklineSvg data={sparkData} width={sparklineWidth} height={sparklineHeight} color={sparklineColor} showArea={sparklineShowArea} strokeWidth={sparklineWeight} id={config.colorScheme || 'a'} />
              )}
            </div>
            {titlePosition !== 'above' && titleEl}
            {config.subtitle && <div style={{ fontSize: 10, color: t.textFaint, textAlign: align, marginTop: -2, fontFamily: titleFont }}>{config.subtitle}</div>}
            {/* Below sparkline */}
            {showSparkline && sparklinePosition === 'below' && sparkData && sparkData.length > 2 && (
              <div style={{ width: '90%', maxWidth: 240, marginTop: 4 }}>
                <SparklineSvg data={sparkData} width="100%" height={28} color={sparklineColor} showArea={sparklineShowArea} strokeWidth={sparklineWeight} id={config.colorScheme || 'b'} />
              </div>
            )}
            {/* Progress bar (when showProgress is enabled) */}
            {showProgress && (
              <div style={{ width: '80%', maxWidth: 200, height: config.progressHeight ?? 4, background: config.progressTrackColor || t.shimmerBg || 'rgba(255,255,255,0.06)', borderRadius: (config.progressHeight ?? 4), marginTop: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progressPct * 100}%`, background: config.progressColor || p.start, borderRadius: (config.progressHeight ?? 4), transition: 'width 0.5s ease-out' }} />
              </div>
            )}
          </>
      }
    </div>
  )
}
