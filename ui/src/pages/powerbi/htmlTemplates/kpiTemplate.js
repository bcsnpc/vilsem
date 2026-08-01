/**
 * KPI card HTML template — mirrors CompactKpi from AppSpecRenderer.jsx.
 *
 * Supports every config field CompactKpi reads:
 *   • Title: title, titlePosition (above|below), titleFontFamily, titleFontSize,
 *     titleFontWeight, titleColor, titleUppercase
 *   • Value: prefix, suffix, valueFontFamily, valueFontSize, valueFontWeight,
 *     valueColor, showGlow
 *   • Layout: align (left|center|right), compact, subtitle
 *   • Trend: showTrend, trendValue, trendFontSize, trendUpColor, trendDownColor
 *   • Sparkline: showSparkline, sparklinePosition (inline|below|background),
 *     sparklineWidth, sparklineHeight, sparklineColor, sparklineShowArea
 *   • Progress: showProgress, progressMax, progressHeight, progressColor,
 *     progressTrackColor
 *   • Icon: showIcon, icon, iconSize, iconColor
 *   • Card: cardStyle (minimal|filled|glass|accent|bordered|glossy), colorScheme
 *
 * The visual object may carry `_sparkData: number[]` (pre-fetched by
 * publishCustomVisualFlow). When absent, sparkline is skipped.
 */

import { themeTokens, getColorScheme, formatNumber, escapeHtml, getScalarValue } from './shared.js'

function cleanAffix(s) {
  if (s == null) return ''
  const str = String(s).trim()
  if (!str || str === 'null' || str === 'undefined') return ''
  return str
}

function formatValue(v, prefix, suffix) {
  if (v == null || isNaN(v)) return '—'
  return `${cleanAffix(prefix)}${formatNumber(v)}${cleanAffix(suffix)}`
}

function buildSparklineSvg({ data, width, height, color, showArea, id }) {
  if (!data?.length || data.length < 2) return ''
  const w = typeof width === 'number' ? width : 100
  const h = typeof height === 'number' ? height : 20
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * (w - 2) + 1},${(h - 2) - ((v - min) / range) * (h - 4)}`).join(' ')
  const gradId = `spark-${id}-${w}-${Math.random().toString(36).slice(2, 6)}`
  const widthAttr = typeof width === 'string' ? width : w
  return `
    <svg width="${widthAttr}" height="${h}" viewBox="0 0 ${w} ${h}" style="flex-shrink:0; display:block;" preserveAspectRatio="none">
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${showArea ? `<polygon points="1,${h - 1} ${pts} ${w - 1},${h - 1}" fill="url(#${gradId})"/>` : ''}
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `
}

export function renderKpiHtml(visual, queryResult, theme = 'dark') {
  const t       = themeTokens(theme)
  const config  = visual.config || {}
  const scheme  = getColorScheme(config.colorScheme || visual.colorScheme)
  const measure = visual.measures?.[0] || visual.data?.measures?.[0] || ''
  const val     = getScalarValue(queryResult, measure)
  const val2    = (() => {
    if (!queryResult?.rows?.length) return null
    const row = queryResult.rows[0]
    const second = visual.measures?.[1] || visual.data?.measures?.[1]
    return second ? row[second] : null
  })()
  const isDark  = theme !== 'light'
  const c       = scheme.start

  // ── Styling knobs (mirrors CompactKpi) ──────────────────────────────────
  const align           = config.align || 'center'
  const compactMode     = config.compact ?? false
  const valueSize       = config.valueFontSize || 'clamp(22px,3.4vw,34px)'
  const valueWeight     = config.valueFontWeight ?? 800
  const valueColor      = config.valueColor || scheme.text || c
  const valueFont       = config.valueFontFamily || 'inherit'
  const titleSize       = config.titleFontSize || 11
  const titleWeight     = config.titleFontWeight ?? 500
  const titleColor      = config.titleColor || t.textMuted
  const titleFont       = config.titleFontFamily || 'inherit'
  const titlePosition   = config.titlePosition || 'below'
  const titleUppercase  = config.titleUppercase || false
  const showGlow        = config.showGlow !== false

  const showTrend      = config.showTrend ?? false
  const trendValue     = config.trendValue ?? (val2 != null && val2 !== 0 ? ((val - val2) / Math.abs(val2)) * 100 : null)
  const trendFontSize  = config.trendFontSize ?? 11
  const trendUpColor   = config.trendUpColor || '#22C55E'
  const trendDownColor = config.trendDownColor || '#F43F5E'

  const showSparkline     = config.showSparkline ?? false
  const sparklinePosition = config.sparklinePosition || 'inline'
  const sparklineWidth    = config.sparklineWidth ?? (sparklinePosition === 'background' ? '100%' : 60)
  const sparklineHeight   = config.sparklineHeight ?? (sparklinePosition === 'background' ? '100%' : 20)
  const sparklineColor    = config.sparklineColor || c
  const sparklineShowArea = config.sparklineShowArea ?? true
  // Sparkline data comes pre-fetched via visual._sparkData; fallback to queryResult rows
  const sparkData = visual._sparkData
    || (queryResult?.rows?.length > 1
      ? queryResult.rows.map(r => r[measure] ?? Object.values(r).find(x => typeof x === 'number')).filter(v => typeof v === 'number')
      : null)

  const showIcon   = config.showIcon ?? false
  const iconChar   = config.icon || '✦'
  const iconSize   = config.iconSize ?? (compactMode ? 14 : 18)
  const iconColor  = config.iconColor || scheme.text || c

  const showProgress      = config.showProgress ?? false
  const progressMax       = config.progressMax ?? config.maxValue ?? 100
  const progressPct       = val != null ? Math.min(Math.abs(val) / progressMax, 1) : 0
  const progressHeight    = config.progressHeight ?? 4
  const progressColor     = config.progressColor || c
  const progressTrackColor = config.progressTrackColor || t.shimmerBg || 'rgba(255,255,255,0.06)'

  // Title resolution
  const rawTitle = config.title || config.label || visual.title || visual.label
  const title    = (rawTitle && String(rawTitle).toLowerCase() !== 'kpi') ? rawTitle : measure
  const subtitle = config.subtitle || ''

  // ── Card chrome (mirrors getThemeTokens kpiBgFn/kpiBorderFn/kpiBorderTop/
  // kpiShadowFn/kpiAccentFn exactly — same hex/alpha values Semantica uses) ─
  const cardStyle = config.cardStyle || 'minimal'

  // Semantica defaults (from getThemeTokens.ts and AppSpecRenderer.jsx)
  const defaultBgDark     = `linear-gradient(150deg, ${c}18 0%, rgba(10,10,18,0.96) 55%)`
  const defaultBgLight    = `linear-gradient(150deg, ${c}0c 0%, #FFFFFF 55%)`
  const defaultBorderDark = `1px solid ${c}3a`
  const defaultBorderLight = `1px solid ${c}20`
  const defaultBorderTopDark  = `1.5px solid ${c}60`
  const defaultBorderTopLight = `1.5px solid ${c}35`
  const defaultShadowDark = `0 8px 24px rgba(0,0,0,0.22), 0 0 32px ${c}0c, inset 0 -1px 0 rgba(0,0,0,0.4)`
  const defaultShadowLight = `0 2px 12px rgba(0,0,0,0.05), 0 0 20px ${c}08`
  const accentDark = `linear-gradient(180deg, ${c}cc 0%, ${c}22 100%)`
  const accentLight = `linear-gradient(180deg, ${c}aa 0%, ${c}15 100%)`

  let cardBg, cardBorder, cardBorderTop, cardShadow, cardExtra = ''

  if (cardStyle === 'filled') {
    cardBg = isDark
      ? `linear-gradient(135deg, ${c}22 0%, ${c}10 100%), #14141F`
      : `linear-gradient(135deg, ${c}14 0%, ${c}06 100%), #FFFFFF`
    cardBorder = isDark ? defaultBorderDark : defaultBorderLight
    cardBorderTop = isDark ? defaultBorderTopDark : defaultBorderTopLight
    cardShadow = isDark ? defaultShadowDark : defaultShadowLight
  } else if (cardStyle === 'glass') {
    cardBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
    cardBorder = '1px solid rgba(255,255,255,0.08)'
    cardBorderTop = isDark ? defaultBorderTopDark : defaultBorderTopLight
    cardShadow = `0 8px 24px rgba(0,0,0,0.18)`
    cardExtra = 'backdrop-filter: blur(12px);'
  } else if (cardStyle === 'accent') {
    cardBg = isDark ? '#14141F' : '#FFFFFF'
    cardBorder = `1px solid ${c}26`
    cardBorderTop = `1px solid ${c}26`
    cardShadow = 'none'
  } else if (cardStyle === 'bordered') {
    cardBg = isDark ? '#14141F' : '#FFFFFF'
    cardBorder = `1px solid ${c}40`
    cardBorderTop = `1px solid ${c}40`
    cardShadow = 'none'
  } else if (cardStyle === 'glossy') {
    cardBg = isDark
      ? `linear-gradient(145deg, ${c}28 0%, rgba(10,10,18,0.98) 55%, rgba(0,0,0,0.95) 100%)`
      : `linear-gradient(145deg, ${c}14 0%, #F8FAFC 55%, #FFFFFF 100%)`
    cardBorder = isDark ? defaultBorderDark : defaultBorderLight
    cardBorderTop = isDark ? defaultBorderTopDark : defaultBorderTopLight
    cardShadow = isDark
      ? `0 8px 24px rgba(0,0,0,0.3), 0 0 32px ${c}0c, inset 0 1px 0 rgba(255,255,255,0.08)`
      : `0 4px 16px rgba(0,0,0,0.08)`
  } else {
    // minimal (default) — EXACT Semantica kpiBgFn
    cardBg         = isDark ? defaultBgDark : defaultBgLight
    cardBorder     = isDark ? defaultBorderDark : defaultBorderLight
    cardBorderTop  = isDark ? defaultBorderTopDark : defaultBorderTopLight
    cardShadow     = isDark ? defaultShadowDark : defaultShadowLight
  }

  // Left accent strip (3px, full-height gradient) — ALWAYS shown, matches
  // the strip rendered at AppSpecRenderer.jsx:2670
  const accentStripGradient = isDark ? accentDark : accentLight

  const alignItems = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center'
  const textAlign  = align
  const gap        = compactMode ? 2 : 6
  const padding    = cardStyle === 'accent' ? '0 10px 0 14px' : (compactMode ? '0 6px' : '0 10px')

  const effectiveValueSize = compactMode
    ? (typeof valueSize === 'number' ? Math.round(valueSize * 0.7) : 'clamp(16px,2.5vw,24px)')
    : valueSize
  const effectiveTitleSize = compactMode ? Math.round(titleSize * 0.85) : titleSize

  const valueText = formatValue(val, config.prefix, config.suffix)

  // ── Element builders ────────────────────────────────────────────────────
  const titleEl = title ? `
    <div style="
      font-size: ${typeof effectiveTitleSize === 'number' ? effectiveTitleSize + 'px' : effectiveTitleSize};
      font-weight: ${titleWeight};
      color: ${titleColor};
      text-align: ${textAlign};
      line-height: 1.3;
      letter-spacing: ${titleUppercase ? '0.05em' : '0.01em'};
      max-width: 90%;
      font-family: ${titleFont};
      text-transform: ${titleUppercase ? 'uppercase' : 'none'};
    ">${escapeHtml(title)}</div>
  ` : ''

  const iconEl = showIcon ? `
    <div style="
      font-size: ${iconSize}px;
      color: ${iconColor};
      opacity: ${config.iconColor ? 1 : 0.5};
    ">${escapeHtml(iconChar)}</div>
  ` : ''

  const trendEl = (showTrend && trendValue != null) ? `
    <div style="
      font-size: ${trendFontSize}px;
      font-weight: 700;
      color: ${trendValue >= 0 ? trendUpColor : trendDownColor};
      display: flex;
      align-items: center;
      gap: 2px;
    ">${trendValue >= 0 ? '▲' : '▼'} ${Math.abs(trendValue).toFixed(1)}%</div>
  ` : ''

  const sparkInline = (showSparkline && sparklinePosition === 'inline' && sparkData?.length > 2)
    ? buildSparklineSvg({ data: sparkData, width: sparklineWidth, height: sparklineHeight, color: sparklineColor, showArea: sparklineShowArea, id: config.colorScheme || 'a' })
    : ''

  const sparkBelow = (showSparkline && sparklinePosition === 'below' && sparkData?.length > 2) ? `
    <div style="width: 90%; max-width: 240px; margin-top: 4px;">
      ${buildSparklineSvg({ data: sparkData, width: '100%', height: 28, color: sparklineColor, showArea: sparklineShowArea, id: config.colorScheme || 'b' })}
    </div>
  ` : ''

  const sparkBackground = (showSparkline && sparklinePosition === 'background' && sparkData?.length > 2) ? `
    <div style="position: absolute; inset: 0; opacity: 0.25; pointer-events: none;">
      ${buildSparklineSvg({ data: sparkData, width: '100%', height: '100%', color: sparklineColor, showArea: sparklineShowArea, id: config.colorScheme || 'bg' })}
    </div>
  ` : ''

  const progressEl = showProgress ? `
    <div style="
      width: 80%; max-width: 200px;
      height: ${progressHeight}px;
      background: ${progressTrackColor};
      border-radius: ${progressHeight}px;
      margin-top: 2px;
      overflow: hidden;
    ">
      <div style="
        height: 100%;
        width: ${(progressPct * 100).toFixed(2)}%;
        background: ${progressColor};
        border-radius: ${progressHeight}px;
      "></div>
    </div>
  ` : ''

  const subtitleEl = subtitle ? `
    <div style="
      font-size: 10px;
      color: ${t.textFaint || t.textMuted};
      text-align: ${textAlign};
      margin-top: -2px;
      font-family: ${titleFont};
    ">${escapeHtml(subtitle)}</div>
  ` : ''

  const valueEl = `
    <div style="
      display: flex;
      align-items: baseline;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: ${align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center'};
    ">
      <div style="
        font-size: ${typeof effectiveValueSize === 'number' ? effectiveValueSize + 'px' : effectiveValueSize};
        font-weight: ${valueWeight};
        color: ${valueColor};
        line-height: 1;
        letter-spacing: -0.02em;
        text-shadow: ${showGlow ? `0 0 24px ${c}aa, 0 0 48px ${c}55` : 'none'};
        font-family: ${valueFont};
      ">${escapeHtml(valueText)}</div>
      ${trendEl}
      ${sparkInline}
    </div>
  `

  // ── Assemble ────────────────────────────────────────────────────────────
  return `
    <div style="
      box-sizing: border-box;
      position: absolute;
      inset: 0;
      background: ${cardBg};
      border: ${cardBorder};
      border-top: ${cardBorderTop};
      border-radius: 14px;
      box-shadow: ${cardShadow};
      font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: ${t.textPrimary};
      overflow: hidden;
      ${cardExtra}
    " title="${escapeHtml(title)}: ${escapeHtml(valueText)}">
      <div style="
        position: absolute;
        left: 0; top: 0; bottom: 0;
        width: 3px;
        border-radius: 14px 0 0 14px;
        background: ${accentStripGradient};
      "></div>
      ${sparkBackground}
      <div style="
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: ${alignItems};
        justify-content: center;
        height: 100%;
        gap: ${gap}px;
        padding: ${padding};
      ">
        ${titlePosition === 'above' ? titleEl : ''}
        ${iconEl}
        ${valueEl}
        ${titlePosition !== 'above' ? titleEl : ''}
        ${subtitleEl}
        ${sparkBelow}
        ${progressEl}
      </div>
    </div>
  `
}
