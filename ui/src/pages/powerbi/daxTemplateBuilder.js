/**
 * DAX Template Builder — generates DAX expressions that produce HTML strings
 * at Power BI query time using live measure values. When a slicer changes
 * the filter context, DAX re-evaluates → HTML updates → visual re-renders.
 *
 * Each function returns a DAX expression string (NOT HTML, NOT TMDL — the
 * raw DAX that goes into a measure body). The caller wraps it in TMDL.
 *
 * CSS notes: all styles use single quotes (`style='...'`) because the DAX
 * strings are double-quoted. HTML is valid with either quote style.
 *
 * Supported: kpi, gauge, bar, stacked_bar, funnel, table, donut, line, area
 * Fallback:  radar, scatter, treemap (complex SVG geometry in DAX — uses
 *            simplified representation for v1)
 */

import { COLOR_SCHEMES } from '../../appspec/colorSchemes'
import { getThemeTokens } from '../../appspec/getThemeTokens'

function getScheme(name) {
  return COLOR_SCHEMES[name] || COLOR_SCHEMES.teal
}

function daxStr(s) {
  return s.replace(/"/g, '""')
}

/**
 * DAX snippet that abbreviates a number to K/M/B — equivalent to our JS
 * formatNumber(). Returns a DAX expression (not a value) that evaluates
 * to a formatted string. Caller must assign to a VAR.
 *
 * Usage: `VAR _fmt = ${daxAbbrevFormat('_val')}`
 */
// Matches Semantica's fmtVal (1 decimal for M/B/k) so both platforms format identically.
function daxAbbrevFormat(varName) {
  return `IF(ABS(${varName}) >= 1E9, FORMAT(${varName} / 1E9, "0.0") & "B", IF(ABS(${varName}) >= 1E6, FORMAT(${varName} / 1E6, "0.0") & "M", IF(ABS(${varName}) >= 1E3, FORMAT(${varName} / 1E3, "0.0") & "k", FORMAT(${varName}, "#,##0"))))`
}

/**
 * Build a DAX expression that produces an SVG sparkline that re-evaluates
 * with filter context. Returns a DAX expression (string) whose result is the
 * `<svg>...</svg>` markup, or `""` (empty string) when there aren't enough
 * points.
 *
 * @param {string} axisCol    — fully-qualified axis column, e.g. "Calendar Lookup[Start of Month]"
 * @param {string} measure    — bracketed measure name, e.g. "[Total Revenue]"
 * @param {Object} opts       — { width, height, color, showArea }
 */
function buildSparklineDax(axisCol, measure, { width = 60, height = 20, color = '#14B8A6', showArea = true } = {}) {
  const colParts = axisCol.match(/^(.+?)\[(.+)\]$/)
  if (!colParts) return '""'
  const qualified = `'${colParts[1]}'[${colParts[2]}]`
  const w = width, h = height
  const gradId = `spk-${Math.random().toString(36).slice(2, 6)}`

  const areaLayer = showArea
    ? `"<polygon points=""1," & "${h - 1}" & " " & _pts & " " & "${w - 1}," & "${h - 1}" & """ fill=""url(#${gradId})"" />"`
    : `""`
  const defs = showArea
    ? `"<defs><linearGradient id=""${gradId}"" x1=""0"" y1=""0"" x2=""0"" y2=""1""><stop offset=""0%"" stop-color=""${color}"" stop-opacity=""0.3""/><stop offset=""100%"" stop-color=""${color}"" stop-opacity=""0""/></linearGradient></defs>"`
    : `""`

  return `
VAR _spkTbl = FILTER(
    SUMMARIZECOLUMNS(${qualified}, "__v", ${measure}),
    NOT ISBLANK([__v])
)
VAR _spkN = COUNTROWS(_spkTbl)
VAR _spkMin = MINX(_spkTbl, [__v])
VAR _spkMax = MAXX(_spkTbl, [__v])
VAR _spkRange = IF(_spkMax = _spkMin, 1, _spkMax - _spkMin)
VAR _spkIdx = ADDCOLUMNS(
    _spkTbl,
    "__i", RANKX(_spkTbl, ${qualified}, , ASC, DENSE) - 1
)
VAR _spkDiv = IF(_spkN > 1, _spkN - 1, 1)
VAR _pts = CONCATENATEX(
    _spkIdx,
    FORMAT([__i] / _spkDiv * ${w - 2} + 1, "0.00") & "," & FORMAT(${h - 2} - (([__v] - _spkMin) / _spkRange) * ${h - 4}, "0.00"),
    " ",
    [__i], ASC
)
VAR _svg =
    IF(_spkN < 3, "",
        "<svg width=""${w}"" height=""${h}"" viewBox=""0 0 ${w} ${h}"" style=""flex-shrink:0;display:block"" preserveAspectRatio=""none"">" &
        ${defs} &
        ${areaLayer} &
        "<polyline points=""" & _pts & """ fill=""none"" stroke=""${color}"" stroke-width=""1.5"" stroke-linecap=""round"" stroke-linejoin=""round""/>" &
        "</svg>"
    )
  `.trim()
}

function parseDim(dimension) {
  if (!dimension || typeof dimension !== 'string') return null
  const m = dimension.match(/^(.+?)\[(.+)\]$/)
  return m ? { table: m[1], column: m[2] } : null
}

// ── KPI ────────────────────────────────────────────────────────────────────
// Produces live DAX that re-evaluates with filter context (slicers work).
// HTML chrome mirrors kpiTemplate.js → getThemeTokens.ts tokens exactly.

function cleanAffix(s) {
  if (s == null) return ''
  const str = String(s).trim()
  if (!str || str === 'null' || str === 'undefined') return ''
  return str
}

export function buildKpiDax(visual, theme = 'dark') {
  const config   = visual.config || {}
  const isDark   = theme !== 'light'
  // Single source of truth — same tokens Semantica's CompactKpi reads.
  const t        = getThemeTokens(isDark ? 'dark' : 'light')
  const scheme   = getScheme(config.colorScheme || visual.colorScheme)
  const measure  = visual.measures?.[0] || ''
  const measure2 = visual.measures?.[1] || null
  const rawTitle = config.title || config.label || visual.title || measure
  const title    = (rawTitle && String(rawTitle).toLowerCase() !== 'kpi') ? rawTitle : measure
  const subtitle = config.subtitle || ''
  const prefix   = cleanAffix(config.prefix)
  const suffix   = cleanAffix(config.suffix)
  const c        = scheme.start

  const align          = config.align || 'center'
  const alignItems     = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center'
  const textAlign      = align
  const justifyRow     = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center'
  const compact        = config.compact ?? false
  const gap            = compact ? 2 : 6
  const padding        = compact ? '0 6px' : '0 10px'

  const rawValueSize   = config.valueFontSize ?? (compact ? 'clamp(16px,2.5vw,24px)' : 'clamp(22px,3.4vw,34px)')
  const valueSize      = typeof rawValueSize === 'number'
    ? `${compact ? Math.round(rawValueSize * 0.7) : rawValueSize}px`
    : rawValueSize
  const valueWeight    = config.valueFontWeight ?? 800
  const valueColor     = config.valueColor || scheme.text || c
  const valueFont      = config.valueFontFamily || 'inherit'

  const rawTitleSize   = config.titleFontSize ?? 11
  const titleSize      = typeof rawTitleSize === 'number'
    ? `${compact ? Math.round(rawTitleSize * 0.85) : rawTitleSize}px`
    : rawTitleSize
  const titleWeight    = config.titleFontWeight ?? 500
  // Matches CompactKpi's `titleColor = config.titleColor || t.textMuted`
  const titleColor     = config.titleColor || t.textMuted
  const titleFont      = config.titleFontFamily || 'inherit'
  const titlePosition  = config.titlePosition || 'below'
  const titleUppercase = config.titleUppercase ? 'uppercase' : 'none'
  const showGlow       = config.showGlow !== false
  const glow           = showGlow ? `text-shadow:0 0 24px ${c}aa,0 0 48px ${c}55;` : ''

  // Card chrome — MUST match Semantica's getCardChromeStyle() helper exactly.
  // config.bgOpacity override and all 6 cardStyle variants reproduced in DAX form.
  const cardStyle = config.cardStyle || 'minimal'
  const [cr, cg, cb] = (() => {
    const h = (c || '').replace('#', '').padEnd(6, '0')
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) || 0)
  })()
  const bo = config.bgOpacity
  let cardBg, cardBorder, cardBorderTop, cardShadow
  const accentStrip = `linear-gradient(180deg,${c}cc 0%,${c}22 100%)`
  if (cardStyle === 'filled') {
    cardBg = `linear-gradient(135deg,rgba(${cr},${cg},${cb},${bo ?? 1}) 0%,rgba(${cr},${cg},${cb},${bo ?? 0.7}) 100%)`
    cardBorder = `1px solid ${c}`
    cardBorderTop = `2px solid ${c}`
    cardShadow = `0 8px 24px rgba(${cr},${cg},${cb},0.3)`
  } else if (cardStyle === 'glass') {
    cardBg = `rgba(${cr},${cg},${cb},${bo ?? 0.08})`
    cardBorder = `1px solid rgba(${cr},${cg},${cb},0.2)`
    cardBorderTop = `1px solid rgba(${cr},${cg},${cb},0.2)`
    cardShadow = `0 8px 32px rgba(${cr},${cg},${cb},0.1),inset 0 1px 0 rgba(255,255,255,0.05)`
  } else if (cardStyle === 'glossy') {
    cardBg = `linear-gradient(145deg,rgba(${cr},${cg},${cb},${bo ?? 0.15}) 0%,rgba(${cr},${cg},${cb},${bo ?? 0.05}) 50%,rgba(${cr},${cg},${cb},${bo ?? 0.12}) 100%)`
    cardBorder = `1px solid rgba(${cr},${cg},${cb},0.25)`
    cardBorderTop = `1px solid rgba(${cr},${cg},${cb},0.25)`
    cardShadow = `0 8px 32px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.08)`
  } else if (cardStyle === 'accent') {
    cardBg = bo != null ? `rgba(${cr},${cg},${cb},${bo})` : `linear-gradient(150deg,${c}18 0%,rgba(10,10,18,0.96) 55%)`
    cardBorder = `1px solid rgba(255,255,255,0.08)`
    cardBorderTop = `1px solid rgba(255,255,255,0.08)`
    cardShadow = `0 16px 36px rgba(0,0,0,0.28),inset 0 1px 0 rgba(255,255,255,0.025)`
    // accent adds a 4px left edge — applied inline in cardStyleStr below
  } else if (cardStyle === 'bordered') {
    cardBg = bo != null ? `rgba(${cr},${cg},${cb},${bo})` : 'transparent'
    cardBorder = `2px solid rgba(${cr},${cg},${cb},0.4)`
    cardBorderTop = `2px solid rgba(${cr},${cg},${cb},0.6)`
    cardShadow = 'none'
  } else {
    // minimal (default) — exact Semantica tokens
    cardBg = bo != null ? `rgba(${cr},${cg},${cb},${bo})` : `linear-gradient(150deg,${c}18 0%,rgba(10,10,18,0.96) 55%)`
    cardBorder = `1px solid ${c}3a`
    cardBorderTop = `1.5px solid ${c}60`
    cardShadow = `0 8px 24px rgba(0,0,0,0.22),0 0 32px ${c}0c,inset 0 -1px 0 rgba(0,0,0,0.4)`
  }
  const accentLeftBorder = cardStyle === 'accent' ? `border-left:4px solid ${c};` : ''

  const cardStyleStr = `box-sizing:border-box;position:absolute;inset:0;background:${cardBg};border:${cardBorder};border-top:${cardBorderTop};${accentLeftBorder}border-radius:14px;box-shadow:${cardShadow};font-family:Inter,sans-serif;color:${t.textPrimary};overflow:hidden;`
  const showAccentStripKpi = config.showAccentStrip !== false
  const stripStr     = `position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:14px 0 0 14px;background:${accentStrip};`
  const bodyStr      = `position:relative;display:flex;flex-direction:column;align-items:${alignItems};justify-content:center;height:100%;gap:${gap}px;padding:${padding};`
  const valueStr     = `font-size:${valueSize};font-weight:${valueWeight};color:${valueColor};line-height:1;letter-spacing:-0.02em;${glow}font-family:${valueFont};`
  const titleStr     = `font-size:${titleSize};font-weight:${titleWeight};color:${titleColor};text-align:${textAlign};line-height:1.3;letter-spacing:${config.titleUppercase ? '0.05em' : '0.01em'};max-width:90%;font-family:${titleFont};text-transform:${titleUppercase};`
  // Subtitle uses t.textFaint — matches CompactKpi
  const subStr       = `font-size:10px;color:${t.textFaint};text-align:${textAlign};margin-top:-2px;font-family:${titleFont};`
  const valueRowStr  = `display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;justify-content:${justifyRow};`

  const titleHtml = title
    ? `"<div style='${titleStr}'>${daxStr(String(title))}</div>"`
    : `""`
  const subtitleHtml = subtitle
    ? `"<div style='${subStr}'>${daxStr(String(subtitle))}</div>"`
    : `""`

  // ── Icon ──
  const showIcon  = config.showIcon ?? false
  const iconChar  = config.icon || '✦'
  const iconSize  = config.iconSize ?? (compact ? 14 : 18)
  const iconColor = config.iconColor || scheme.text || c
  const iconOpacity = config.iconColor ? 1 : 0.5
  const iconHtml = showIcon
    ? `"<div style='font-size:${iconSize}px;color:${iconColor};opacity:${iconOpacity};'>${daxStr(String(iconChar))}</div>"`
    : `""`

  // ── Trend (live-DAX: arrow + % change) ──
  const showTrend      = config.showTrend ?? false
  const trendFontSize  = config.trendFontSize ?? 11
  const trendUpColor   = config.trendUpColor || '#22C55E'
  const trendDownColor = config.trendDownColor || '#F43F5E'
  const explicitTrend  = config.trendValue
  let trendVarBlock = ''
  let trendHtml = `""`
  if (showTrend) {
    if (typeof explicitTrend === 'number') {
      // Fixed trend value from config
      trendVarBlock = `VAR _trend = ${explicitTrend}\n`
    } else if (measure2) {
      // Compute from second measure
      trendVarBlock = `VAR _val2 = [${measure2}]\nVAR _trend = IF(_val2 = 0 || ISBLANK(_val2), BLANK(), (_val - _val2) / ABS(_val2) * 100)\n`
    } else {
      trendVarBlock = `VAR _trend = BLANK()\n`
    }
    trendHtml = `IF(ISBLANK(_trend), "", "<div style='font-size:${trendFontSize}px;font-weight:700;color:" & IF(_trend >= 0, "${trendUpColor}", "${trendDownColor}") & ";display:flex;align-items:center;gap:2px;'>" & IF(_trend >= 0, "▲", "▼") & " " & FORMAT(ABS(_trend), "0.0") & "%</div>")`
  }

  // ── Sparkline (live DAX) ──
  const showSparkline     = config.showSparkline ?? false
  // Coerce object form {table, column} → "Table[Column]" string form
  const sparklineAxis     = (() => {
    const raw = config.sparklineAxis
    if (!raw) return null
    if (typeof raw === 'string') return raw
    if (raw.table && raw.column) return `${raw.table}[${raw.column}]`
    return null
  })()
  const sparklinePosition = config.sparklinePosition || 'inline'
  const sparklineColor    = config.sparklineColor || c
  const sparklineShowArea = config.sparklineShowArea ?? true
  const sparklineW        = typeof config.sparklineWidth === 'number' ? config.sparklineWidth : 100
  const sparklineH        = typeof config.sparklineHeight === 'number' ? config.sparklineHeight : 24

  const sparkDaxBlock = (showSparkline && sparklineAxis)
    ? buildSparklineDax(sparklineAxis, `[${measure}]`, {
        width: sparklineW, height: sparklineH, color: sparklineColor, showArea: sparklineShowArea,
      })
    : null

  // ── Progress bar ──
  const showProgress        = config.showProgress ?? false
  const explicitProgressMax = config.progressMax ?? config.maxValue  // may be undefined
  const progressHeight      = config.progressHeight ?? 4
  const progressColor       = config.progressColor || c
  const progressTrackColor  = config.progressTrackColor || 'rgba(255,255,255,0.06)'
  // If user sets a target, use it static. Otherwise scale max to 1.25× the
  // current value — bar reads ~80% filled; same default as Semantica's CompactKpi.
  const progressVar = showProgress
    ? (explicitProgressMax != null
        ? `VAR _progMax = ${explicitProgressMax}\nVAR _progPct = MIN(DIVIDE(ABS(_val), _progMax, 0), 1)\n`
        : `VAR _progPct = IF(_val = 0, 0, 0.8)\n`)  // dynamic 80% fill — user hasn't set a target yet
    : ''
  const progressHtml = showProgress
    ? `"<div style='width:80%;max-width:200px;height:${progressHeight}px;background:${progressTrackColor};border-radius:${progressHeight}px;margin-top:2px;overflow:hidden;'><div style='height:100%;width:" & FORMAT(_progPct * 100, "0.00") & "%;background:${progressColor};border-radius:${progressHeight}px;'></div></div>"`
    : `""`

  // ── Assemble HTML ──
  // Value row (value + inline trend + inline sparkline)
  const inlineSparkPart = (sparkDaxBlock && sparklinePosition === 'inline') ? ` & _svg` : ''
  const trendInlinePart = showTrend ? ` & ${trendHtml}` : ''
  // Attach data-countup + format hints so the Semantica Renderer visual can
  // animate the number counting up after innerHTML. When animations are
  // disabled (config.animations === false), omit the attributes so the visual
  // just shows the static final text.
  //
  // DAX quoting reminder: `"""` sequence = close-string + open-new-string-with-
  // literal-quote. So `"...="""` & X & `""">"` produces `...="<X>">`.
  const animationsOn = config.animations !== false
  const countUpAttrs = animationsOn
    ? `data-countup=""" & _val & """ data-prefix=""${daxStr(prefix)}"" data-suffix=""${daxStr(suffix)}""`
    : `""`
  const valueRowHtml = animationsOn
    ? `"<div style='${valueRowStr}'>" & "<div style='${valueStr}' ${countUpAttrs}>" & _fmt & "</div>"${trendInlinePart}${inlineSparkPart} & "</div>"`
    : `"<div style='${valueRowStr}'>" & "<div style='${valueStr}'>" & _fmt & "</div>"${trendInlinePart}${inlineSparkPart} & "</div>"`

  const belowSparkHtml = (sparkDaxBlock && sparklinePosition === 'below')
    ? `"<div style='width:90%;max-width:240px;margin-top:4px;'>" & _svg & "</div>"`
    : `""`

  const bgSparkHtml = (sparkDaxBlock && sparklinePosition === 'background')
    ? `"<div style='position:absolute;inset:0;opacity:0.25;pointer-events:none;'>" & _svg & "</div>"`
    : `""`

  // Order per CompactKpi: [bgSpark] card-chrome → strip → body{ titleAbove? → icon → valueRow → titleBelow? → subtitle → belowSpark → progress }
  const titleAbovePart = titlePosition === 'above' ? `${titleHtml} & ` : ''
  const titleBelowPart = titlePosition !== 'above' ? `${titleHtml} & ` : ''
  const iconPart       = showIcon ? `${iconHtml} & ` : ''
  const subtitlePart   = subtitle ? `${subtitleHtml} & ` : ''
  const belowPart      = (sparkDaxBlock && sparklinePosition === 'below') ? `${belowSparkHtml} & ` : ''
  const progressPart   = showProgress ? `${progressHtml} & ` : ''
  const bgPart         = (sparkDaxBlock && sparklinePosition === 'background') ? `${bgSparkHtml} & ` : ''

  const stripHtml = showAccentStripKpi ? `"<div style='${stripStr}'></div>" &` : ''
  const assembled = `
"<div style='${cardStyleStr}'>" &
${stripHtml}
${bgPart}"<div style='${bodyStr}'>" &
${titleAbovePart}${iconPart}${valueRowHtml} & ${titleBelowPart}${subtitlePart}${belowPart}${progressPart}"" &
"</div></div>"
  `.trim()

  const sparkVars = sparkDaxBlock ? sparkDaxBlock + '\n' : ''

  return `
VAR _val = [${measure}]
VAR _abbrev = ${daxAbbrevFormat('_val')}
VAR _fmt = "${daxStr(prefix)}" & _abbrev & "${daxStr(suffix)}"
${trendVarBlock}${progressVar}${sparkVars}RETURN
${assembled}
  `.trim()
}

// ── Gauge ──────────────────────────────────────────────────────────────────

export function buildGaugeDax(visual, theme = 'dark') {
  const config  = visual.config || {}
  const isDark  = theme !== 'light'
  const scheme  = getScheme(config.colorScheme || visual.colorScheme)
  const measure = visual.measures?.[0] || ''
  const title   = config.title || config.label || measure
  const prefix  = config.prefix || ''
  const suffix  = config.suffix || ''
  const c       = scheme.start
  const minVal  = config.minValue ?? 0
  const maxVal  = config.maxValue ?? 100
  const cardBg      = isDark ? 'linear-gradient(180deg,rgba(20,20,34,1) 0%,rgba(11,11,20,1) 100%)' : 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFC 100%)'
  const titleColor  = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(15,23,42,0.65)'
  const mutedColor  = isDark ? '#64748B' : '#475569'

  return `
VAR _val = [${measure}]
VAR _pct = DIVIDE(_val - ${minVal}, ${maxVal} - ${minVal}, 0)
VAR _clamp = MIN(MAX(_pct, 0), 1)
VAR _abbrev = ${daxAbbrevFormat('_val')}
VAR _fmt = "${daxStr(prefix)}" & _abbrev & "${daxStr(suffix)}"
RETURN
"<div style='box-sizing:border-box;position:absolute;inset:0;background:${cardBg};font-family:Inter,sans-serif;overflow:hidden;padding:18px 20px 18px 24px'>" &
"<div style='position:absolute;top:0;bottom:0;left:0;width:3px;background:linear-gradient(180deg,${c},${c}55)'></div>" &
"<div style='display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%'>" &
IF(LEN("${daxStr(title)}") > 0, "<div style='font-size:11px;font-weight:600;color:${titleColor};margin-bottom:4px'>${daxStr(title)}</div>", "") &
"<div style='font-size:28px;font-weight:800;color:${c};text-shadow:0 0 20px ${c}55'>" & _fmt & "</div>" &
"<div style='font-size:10px;color:${mutedColor};margin-top:4px'>" & FORMAT(_clamp * 100, "0") & "%</div>" &
"</div></div>"
  `.trim()
}

// ── Bar ────────────────────────────────────────────────────────────────────
// Full parity with CompactBar in AppSpecRenderer.jsx — mirrors every config
// field, card chrome (via getCardChromeStyle formulas), conditional color,
// reference lines, data labels, gradient, rank opacity, rich tooltip.

export function buildBarDax(visual, theme = 'dark') {
  const config    = visual.config || {}
  const isDark    = theme !== 'light'
  const t         = getThemeTokens(isDark ? 'dark' : 'light')
  const scheme    = getScheme(config.colorScheme || visual.colorScheme)
  const measure   = visual.measures?.[0] || ''
  const rawTitle  = config.title || config.label || measure
  const dim       = parseDim(visual.dimension)
  const limit     = visual.limit || visual.data?.limit || 50
  const orderDir  = (visual.orderBy || visual.data?.orderBy || 'desc').toString().toUpperCase()
  // Rows ALWAYS flex-fill available height. DAX-time limit != actual row
  // count (low-cardinality dimensions like 3 product categories would leave
  // the card half-empty if we used fixed per-row heights as a scroll proxy).
  // overflow-y:auto still handles overflow when lots of bars shrink too small.
  const rowStyleSize = 'flex:1 1 0;min-height:30px;'
  const containerOverflow = 'overflow-y:auto'
  const c         = scheme.start
  const cEnd      = config.gradientTo || scheme.mid || scheme.start
  const [cr, cg, cb] = (() => {
    const h = (c || '').replace('#', '').padEnd(6, '0')
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) || 0)
  })()

  if (!dim) return buildKpiDax(visual, theme)

  // Axis switcher — emit bars for EVERY axis option in a single measure,
  // each wrapped in a <div data-axis-section="N">. visual.ts attaches a click
  // handler on .sbar-axis-pills buttons to toggle which section is visible.
  // DAX itself doesn't re-query on click (measures are static), but all the
  // data for every axis is pre-computed in one evaluation and hidden via CSS.
  const rawAxisOptions = Array.isArray(config.axisOptions) ? config.axisOptions.filter(o => o?.groupBy?.table && o?.groupBy?.column) : []
  // The primary axis is always the visual's bound dimension (axis 0).
  // Dedupe the user's options so primary isn't duplicated.
  const primaryAxis = {
    label: (rawAxisOptions.find(o => o.groupBy.table === dim.table && o.groupBy.column === dim.column)?.label) || dim.column,
    groupBy: { table: dim.table, column: dim.column },
  }
  const nonPrimaryOptions = rawAxisOptions.filter(o => !(o.groupBy.table === dim.table && o.groupBy.column === dim.column))
  const axisList = nonPrimaryOptions.length > 0
    ? [primaryAxis, ...nonPrimaryOptions]
    : [primaryAxis]
  const showAxisPills = axisList.length >= 2

  // Config surface — every field CompactBar reads
  const barRadius      = config.barRadius ?? 4
  const gradient       = config.gradient ?? false
  const showGrid       = config.gridLines ?? false
  const gridStyle      = config.gridStyle || 'dashed'
  const gridDash       = gridStyle === 'solid' ? 'none' : gridStyle === 'dotted' ? '2 2' : '4 4'
  const showDataLabels = config.dataLabels ?? true
  const labelPosition  = config.labelPosition || 'right'  // right | inside | top
  const rankOpacity    = config.rankOpacity ?? true
  const highlightMax   = config.highlightMax ?? false
  const showAvgLine    = config.showAvgLine ?? false
  const targetLine     = typeof config.targetLine === 'number' ? config.targetLine : null
  const condColor      = config.conditionalColor || null // { rules: [{lt,gte,gt,lte, color}] } | { gradient: {min,mid,max} } | { fromField }
  const maxBarWidth    = config.maxBarSize ?? 26
  const prefix         = cleanAffix(config.prefix)
  const suffix         = cleanAffix(config.suffix)

  // Typography
  const titleFont      = config.titleFontFamily || 'inherit'
  const titleSize      = typeof config.titleFontSize === 'number' ? `${config.titleFontSize}px` : (config.titleFontSize || '12px')
  const titleWeight    = config.titleFontWeight ?? 600
  const titleColor     = config.titleColor || t.textPrimary
  const labelFont      = config.valueFontFamily || 'inherit'
  const labelSize      = typeof config.valueFontSize === 'number' ? `${config.valueFontSize}px` : '11px'
  // Data label color. config.dataLabelColor:
  //   'auto' (default) — white inside bar, textPrimary outside.
  //   hex             — that color regardless of position.
  //   config.valueColor still acts as a fallback for the outside color.
  const dataLabelColor  = config.dataLabelColor || 'auto'
  const insideLabelColor  = dataLabelColor === 'auto' ? '#FFFFFF' : dataLabelColor
  const outsideLabelColor = dataLabelColor === 'auto' ? (config.valueColor || t.textPrimary) : dataLabelColor
  const labelColor      = outsideLabelColor  // back-compat for existing string substitutions
  const catColor       = config.catColor || t.textMuted

  // Card chrome — same formulas as getCardChromeStyle (but for charts)
  const cardStyle      = config.cardStyle || 'minimal'
  const bo             = config.bgOpacity
  let cardBg, cardBorder, cardBorderTop, cardShadow
  if (cardStyle === 'filled') {
    cardBg = `linear-gradient(135deg,rgba(${cr},${cg},${cb},${bo ?? 1}) 0%,rgba(${cr},${cg},${cb},${bo ?? 0.7}) 100%)`
    cardBorder = `1px solid ${c}`
    cardBorderTop = `2px solid ${c}`
    cardShadow = `0 8px 24px rgba(${cr},${cg},${cb},0.3)`
  } else if (cardStyle === 'glass') {
    cardBg = `rgba(${cr},${cg},${cb},${bo ?? 0.08})`
    cardBorder = `1px solid rgba(${cr},${cg},${cb},0.2)`
    cardBorderTop = `1px solid rgba(${cr},${cg},${cb},0.2)`
    cardShadow = `0 8px 32px rgba(${cr},${cg},${cb},0.1),inset 0 1px 0 rgba(255,255,255,0.05)`
  } else if (cardStyle === 'glossy') {
    cardBg = `linear-gradient(145deg,rgba(${cr},${cg},${cb},${bo ?? 0.15}) 0%,rgba(${cr},${cg},${cb},${bo ?? 0.05}) 50%,rgba(${cr},${cg},${cb},${bo ?? 0.12}) 100%)`
    cardBorder = `1px solid rgba(${cr},${cg},${cb},0.25)`
    cardBorderTop = `1px solid rgba(${cr},${cg},${cb},0.25)`
    cardShadow = `0 8px 32px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.08)`
  } else if (cardStyle === 'bordered') {
    cardBg = bo != null ? `rgba(${cr},${cg},${cb},${bo})` : 'transparent'
    cardBorder = `2px solid rgba(${cr},${cg},${cb},0.4)`
    cardBorderTop = `2px solid rgba(${cr},${cg},${cb},0.6)`
    cardShadow = 'none'
  } else {
    cardBg = bo != null ? `rgba(${cr},${cg},${cb},${bo})` : (isDark ? 'linear-gradient(180deg,rgba(20,20,34,0.98) 0%,rgba(11,11,20,0.99) 100%)' : 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFC 100%)')
    cardBorder = isDark ? `1px solid rgba(255,255,255,0.08)` : `1px solid rgba(0,0,0,0.08)`
    cardBorderTop = `1.5px solid ${c}2e`
    cardShadow = isDark ? `0 16px 36px rgba(0,0,0,0.28),inset 0 1px 0 rgba(255,255,255,0.025)` : `0 4px 16px rgba(0,0,0,0.06),0 1px 3px rgba(0,0,0,0.08)`
  }
  const accentLeft = cardStyle === 'accent' ? `border-left:4px solid ${c};` : ''
  // NOTE: no padding on the outer card — otherwise absolute-positioned children
  // (left accent strip) get inset by the padding and don't reach the card edge.
  // Padding is applied to the inner content wrapper below instead.
  const cardStyleStr = `box-sizing:border-box;position:absolute;inset:0;background:${cardBg};border:${cardBorder};border-top:${cardBorderTop};${accentLeft}border-radius:14px;box-shadow:${cardShadow};font-family:Inter,sans-serif;color:${t.textPrimary};overflow:hidden;`

  // Left accent strip (matches Semantica CompactBar card wrapper).
  // Toggled via config.showAccentStrip (default true) — matches Semantica.
  const showAccentStrip = config.showAccentStrip !== false
  const stripStr = `position:absolute;left:0;top:0;bottom:0;width:2.5px;border-radius:14px 0 0 14px;background:linear-gradient(180deg,${c} 0%,${c}50 100%);`

  // Header
  const titleStr = `font-size:${titleSize};font-weight:${titleWeight};color:${titleColor};font-family:${titleFont};margin-bottom:8px;letter-spacing:0.01em;`

  // 3-column grid when labels live outside the bar (right/auto): cat | bar | label
  // 2-column grid for inside labels (label stays within fill, no overflow risk).
  // The 3rd "auto" column sizes to the widest label text so bars stay as wide as
  // possible. Grid is always defined at the row level, never relying on absolute
  // positioning to escape the overflow-y:auto scroll container.
  const catW = '140px'
  const useOuterLabelCol = showDataLabels && (labelPosition === 'right' || labelPosition === 'auto')
  const gridCols = useOuterLabelCol ? `${catW} 1fr auto` : `${catW} 1fr`
  // labelColWidth used by the grid-lines overlay to leave room for the label column
  const labelColWidth = useOuterLabelCol ? '60px' : '0px'

  // Conditional color DAX — returns a hex per row
  let condColorDax = `"${c}"`
  if (condColor?.rules && Array.isArray(condColor.rules)) {
    // SWITCH-style expression. Each rule is evaluated in order; first match wins.
    const clauses = condColor.rules.map(r => {
      let test = 'TRUE()'
      if (typeof r.lt === 'number') test = `_val < ${r.lt}`
      else if (typeof r.lte === 'number') test = `_val <= ${r.lte}`
      else if (typeof r.gt === 'number') test = `_val > ${r.gt}`
      else if (typeof r.gte === 'number') test = `_val >= ${r.gte}`
      return `IF(${test}, "${daxStr(r.color || c)}", `
    }).join('')
    const closes = ')'.repeat(condColor.rules.length)
    condColorDax = `(${clauses}"${c}"${closes})`
  } else if (condColor?.gradient) {
    // Simple 3-color gradient by percentile
    const min = daxStr(condColor.gradient.min || '#F43F5E')
    const mid = daxStr(condColor.gradient.mid || '#F59E0B')
    const max = daxStr(condColor.gradient.max || '#22C55E')
    condColorDax = `IF(_pct >= 66, "${max}", IF(_pct >= 33, "${mid}", "${min}"))`
  }

  // Rank opacity / max-stroke — per-axis (each axis has its own _maxValN).
  // Returns the DAX VAR declarations that reference the axis-scoped _maxVal.
  const rankOpacityDaxFor = (maxVar) => highlightMax
    ? `VAR _rankOp = IF(_val = ${maxVar}, 1, ${rankOpacity ? '0.55 + (_pct / 100) * 0.45' : '0.75'})`
    : rankOpacity
      ? `VAR _rankOp = 0.55 + (_pct / 100) * 0.45`
      : `VAR _rankOp = 1`
  const maxStrokeDaxFor = (maxVar) => highlightMax
    ? `VAR _maxStroke = IF(_val = ${maxVar}, "1.5px solid ${c}", "none")`
    : `VAR _maxStroke = "none"`

  // Gradient fill (per-bar). If enabled, overrides solid color with linear-gradient.
  const barFillDax = gradient
    ? `"linear-gradient(90deg," & _barColor & " 0%," & "${daxStr(cEnd)}" & " 100%)"`
    : `_barColor`

  const maxWidthStyle = `max-width:${maxBarWidth === 26 ? '100' : maxBarWidth}%;`  // track width cap

  // Reference lines (avg + target) overlay — absolute positioned within bar area
  const avgLineDax = showAvgLine
    ? `", <span data-refline-avg style='position:absolute;left:" & FORMAT(DIVIDE(_avg, _maxVal) * 100, "0.0") & "%;top:0;bottom:0;width:1px;background:#F59E0B;border-right:1px dashed #F59E0B;z-index:2'></span>"`
    : '", """'
  const tgtLineDax = (targetLine != null)
    ? `", <span data-refline-tgt style='position:absolute;left:" & FORMAT(DIVIDE(${targetLine}, _maxVal) * 100, "0.0") & "%;top:0;bottom:0;width:1px;background:#F43F5E;border-right:1px dashed #F43F5E;z-index:2'></span>"`
    : '", """'

  // Grid lines — overlay vertical lines at 25/50/75% if enabled
  const gridLinesHtml = showGrid
    ? `"<div style='position:absolute;inset:0 ${labelColWidth} 0 ${catW};pointer-events:none;'>" &
       "<div style='position:absolute;left:25%;top:0;bottom:0;border-left:1px ${gridStyle} ${t.gridStroke}'></div>" &
       "<div style='position:absolute;left:50%;top:0;bottom:0;border-left:1px ${gridStyle} ${t.gridStroke}'></div>" &
       "<div style='position:absolute;left:75%;top:0;bottom:0;border-left:1px ${gridStyle} ${t.gridStroke}'></div>" &
       "</div>"`
    : '""'

  // Highlight-max weight bump
  const highlightWeight = highlightMax ? '800' : '600'

  // Row template builder — one per axis. Each axis has its own _maxVal${i}
  // lexically in scope (declared outside CONCATENATEX), so the row expression
  // can reference it by name.
  //
  // CRITICAL (non-primary axes only): `[measure]` inside CONCATENATEX runs in
  // the outer filter context, which PBI populates with the primary-dim filter
  // (per-row binding on Region). Without wrapping in CALCULATE + ALL(primary),
  // every non-primary row returns BLANK except the one matching the current
  // primary-row value. That's the "only Australia shows" bug.
  const buildRowTemplate = (axisDim, idx) => {
    const maxVar = `_maxVal${idx}`
    const isPrimaryAxis = idx === 0 || (axisDim.table === dim.table && axisDim.column === dim.column)
    const valExpr = isPrimaryAxis
      ? `[${measure}]`
      : `CALCULATE([${measure}], ALL('${dim.table}'[${dim.column}]))`
    return `
    VAR _cat = '${axisDim.table}'[${axisDim.column}]
    VAR _val = ${valExpr}
    VAR _pct = IF(${maxVar} > 0, DIVIDE(_val, ${maxVar}) * 100, 0)
    VAR _abbrev = ${daxAbbrevFormat('_val')}
    VAR _fmt = "${daxStr(prefix)}" & _abbrev & "${daxStr(suffix)}"
    VAR _barColor = ${condColorDax}
    ${rankOpacityDaxFor(maxVar)}
    ${maxStrokeDaxFor(maxVar)}
    VAR _isMax = IF(_val = ${maxVar}, 1, 0)
    RETURN
    -- Bar row: category | bar track | (optional) label column.
    -- Label column (3rd grid col) is used for right/auto positions so labels
    -- are always in normal flow — no absolute-positioned overflow that would
    -- be clipped by the scroll container's effective overflow-x:auto.
    "<div class='sbar-row' data-sbar-cat=""" & _cat & """ style='display:grid;grid-template-columns:${gridCols};align-items:center;gap:12px;padding:0 8px;cursor:pointer;border-radius:4px;transition:background 120ms ease-out;position:relative;${rowStyleSize}'>" &
      "<div style='font-size:11px;color:${catColor};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:${titleFont};padding-left:4px;'>" & _cat & "</div>" &
      "<div style='position:relative;height:26px;background:${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'};border-radius:${barRadius}px;overflow:hidden;border:" & _maxStroke & ";'>" &
        "<div data-sbar-fill style='height:100%;width:" & FORMAT(_pct, "0.00") & "%;background:" & ${barFillDax} & ";opacity:" & FORMAT(_rankOp, "0.00") & ";border-radius:${barRadius}px;transition:width 500ms ease-out;position:relative;'>" &
          ${showDataLabels && labelPosition === 'inside'
            ? `"<div style='position:absolute;top:50%;right:6px;transform:translateY(-50%);font-size:${labelSize};font-weight:${highlightWeight};color:${insideLabelColor};font-variant-numeric:tabular-nums;font-family:${labelFont};${dataLabelColor === 'auto' ? 'text-shadow:0 1px 2px rgba(0,0,0,0.5);' : ''}pointer-events:none;white-space:nowrap;' data-countup=""" & _val & """ data-prefix=""${daxStr(prefix)}"" data-suffix=""${daxStr(suffix)}"">" & _fmt & "</div>"`
            : labelPosition === 'auto'
            ? `IF(_pct >= 35, "<div style='position:absolute;top:50%;right:6px;transform:translateY(-50%);font-size:${labelSize};font-weight:${highlightWeight};color:${insideLabelColor};font-variant-numeric:tabular-nums;font-family:${labelFont};${dataLabelColor === 'auto' ? 'text-shadow:0 1px 2px rgba(0,0,0,0.5);' : ''}pointer-events:none;white-space:nowrap;' data-countup=""" & _val & """ data-prefix=""${daxStr(prefix)}"" data-suffix=""${daxStr(suffix)}"">" & _fmt & "</div>", "")`
            : `""`} &
        "</div>" &
      "</div>" &
      ${showDataLabels && labelPosition === 'right'
        ? `"<div style='font-size:${labelSize};font-weight:${highlightWeight};color:${labelColor};font-variant-numeric:tabular-nums;font-family:${labelFont};padding-left:6px;white-space:nowrap;' data-countup=""" & _val & """ data-prefix=""${daxStr(prefix)}"" data-suffix=""${daxStr(suffix)}"">" & _fmt & "</div>" &`
        : showDataLabels && labelPosition === 'auto'
        ? `IF(_pct < 35, "<div style='font-size:${labelSize};font-weight:${highlightWeight};color:${labelColor};font-variant-numeric:tabular-nums;font-family:${labelFont};padding-left:6px;white-space:nowrap;' data-countup=""" & _val & """ data-prefix=""${daxStr(prefix)}"" data-suffix=""${daxStr(suffix)}"">" & _fmt & "</div>", "") &`
        : ``}
      "<div class='sbar-tt' style='position:absolute;top:-38px;left:50%;transform:translateX(-50%);background:${isDark ? '#0e0e1c' : '#FFFFFF'};color:${isDark ? '#E5E7EB' : '#1E293B'};padding:6px 10px;border-radius:6px;font-size:10px;white-space:nowrap;pointer-events:none;box-shadow:0 8px 20px rgba(0,0,0,${isDark ? '0.4' : '0.15'});border:1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'};opacity:0;transition:opacity 120ms;z-index:10;'>" &
        "<div style='font-weight:600;color:${isDark ? '#F8FAFC' : '#0F172A'};margin-bottom:2px;'>" & _cat & "</div>" &
        "<div><span style='color:${isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)'}'>${daxStr(measure)}</span> <span style='color:${c};font-weight:700;margin-left:6px'>" & _fmt & "</span></div>" &
      "</div>" &
    "</div>"
  `.trim()
  }

  // CSS keyframes for bar grow-in animation (0 → final width on mount).
  // Matches Semantica/Recharts default bar animation. Single-line so DAX
  // doesn't choke on embedded newlines in string literals.
  // Disabled when config.animations === false.
  const animationsEnabled = config.animations !== false
  // Theme-aware scrollbar + hover colors. Dark theme stays translucent white;
  // light theme uses translucent black so the thumb / hover is visible on
  // white card chrome. Both scrollbar-width: thin for Firefox.
  const thumbCol     = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.18)'
  const thumbColHvr  = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.28)'
  const rowHoverBg   = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'
  const scrollbarCss = `::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${thumbCol};border-radius:3px}::-webkit-scrollbar-thumb:hover{background:${thumbColHvr}}*{scrollbar-width:thin;scrollbar-color:${thumbCol} transparent}`
  const animCss = animationsEnabled
    ? `<style>${scrollbarCss}@keyframes sb-grow{from{width:0 !important;}}[data-sbar-fill]{animation:sb-grow 600ms cubic-bezier(0.2,0.8,0.2,1) both;}.sbar-row:hover{background:${rowHoverBg}!important;}.sbar-row:hover .sbar-tt{opacity:1!important;}</style>`
    : `<style>${scrollbarCss}.sbar-row:hover{background:${rowHoverBg}!important;}.sbar-row:hover .sbar-tt{opacity:1!important;}</style>`

  // Build per-axis VAR declarations (rows/maxVal/avg/barHtml) + RETURN pieces.
  // Every axis is pre-computed into the same measure — visual.ts toggles which
  // section is visible on pill click (no re-query, since DAX is static).
  //
  // CRITICAL: for axes other than the primary (index 0), we also REMOVE the
  // filter on the primary bound dim. PBI's category role binding causes the
  // measure to be evaluated per-row on the primary dim (e.g. Region). Without
  // ALL(primary.dim), axis N>0 would only see rows that match the current
  // primary row — collapsing to a single bar. ALL on the primary dim gives
  // each axis its full category list regardless of the per-row PBI evaluation.
  const primaryT = dim.table, primaryC = dim.column
  const axisVarBlocks = axisList.map((ax, idx) => {
    const t2 = ax.groupBy.table, col = ax.groupBy.column
    const isPrimary = idx === 0 || (t2 === primaryT && col === primaryC)
    // Always drop self-filter on this axis's column; additionally drop primary
    // dim filter for non-primary axes (see comment above).
    const allSelectedArgs = isPrimary
      ? `ALLSELECTED('${t2}'[${col}])`
      : `ALLSELECTED('${t2}'[${col}]), ALL('${primaryT}'[${primaryC}])`
    // Filter-context-aware measure expression. For non-primary axes, the
    // measure MUST be evaluated with ALL(primary) or it inherits PBI's
    // per-row primary filter and returns BLANK for most rows.
    // Used for both TOPN sort AND CONCATENATEX order — otherwise rows are
    // ordered by a filter-poisoned value and the sort is garbage.
    const measureExpr = isPrimary
      ? `[${measure}]`
      : `CALCULATE([${measure}], ALL('${primaryT}'[${primaryC}]))`
    return `
VAR _rows${idx} = CALCULATETABLE(
    TOPN(
      ${limit},
      FILTER(VALUES('${t2}'[${col}]), NOT ISBLANK(${measureExpr})),
      ${measureExpr}, ${orderDir}
    ),
    ${allSelectedArgs}
)
VAR _maxVal${idx} = CALCULATE(MAXX(_rows${idx}, ${measureExpr}), ${allSelectedArgs})
VAR _avg${idx}    = CALCULATE(AVERAGEX(_rows${idx}, ${measureExpr}), ${allSelectedArgs})
VAR _barHtml${idx} = CONCATENATEX(
    _rows${idx},
    ${buildRowTemplate(ax.groupBy, idx)},
    "",
    ${measureExpr}, ${orderDir}
)`.trim()
  }).join('\n\n')

  // Pills — emitted inline inside a flex row that ALSO contains the title so
  // they sit on the right side of the title (matches Semantica layout).
  // Active/inactive style values are carried on data- attributes; visual.ts
  // swaps them on click (so the active color tracks the user's chosen color
  // scheme without any hardcoding — `c` comes from config.colorScheme).
  const pillActiveBg    = `${c}22`
  const pillActiveBorder= `1px solid ${c}66`
  const pillActiveColor = c
  const pillInactiveBg  = 'transparent'
  const pillInactiveBorder = isDark ? `1px solid rgba(255,255,255,0.1)` : `1px solid rgba(0,0,0,0.1)`
  const pillInactiveColor  = t.textMuted
  const pillBaseStyle = `padding:3px 10px;border-radius:10px;font-size:10px;font-weight:600;cursor:pointer;font-family:${titleFont};transition:all 120ms;`
  const pillsInlineHtml = showAxisPills
    ? axisList.map((ax, i) => {
        const isActive = i === 0
        const label = ax.label || ax.groupBy.column
        const initialStyle = isActive
          ? `background:${pillActiveBg};border:${pillActiveBorder};color:${pillActiveColor};`
          : `background:${pillInactiveBg};border:${pillInactiveBorder};color:${pillInactiveColor};`
        return `"<button data-axis-idx='${i}' data-axis-active='${isActive ? '1' : '0'}' data-active-bg='${pillActiveBg}' data-active-border='${pillActiveBorder}' data-active-color='${pillActiveColor}' data-inactive-bg='${pillInactiveBg}' data-inactive-border='${pillInactiveBorder}' data-inactive-color='${pillInactiveColor}' style='${pillBaseStyle}${initialStyle}'>${daxStr(label)}</button>"`
      }).join(' & ')
    : ''
  const titleWithPillsHtml = (rawTitle || showAxisPills)
    ? `"<div style='display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-shrink:0;'>" & ` +
      (rawTitle
        ? `"<div style='flex:1;min-width:0;${titleStr.replace(/margin-bottom:[^;]+;?/, '')}'>${daxStr(rawTitle)}</div>" & `
        : `"<div style='flex:1'></div>" & `) +
      (showAxisPills
        ? `"<div class='sbar-axis-pills' style='display:flex;gap:4px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end;max-width:65%;'>" & ${pillsInlineHtml} & "</div>" & `
        : '') +
      `"</div>" & `
    : ''

  // Stacked axis sections — each axis's bar list wrapped in a display-togglable div.
  // Section 0 is visible by default; visual.ts flips display:none/flex on pill click.
  // Each section carries the axis's table+column as data attrs so visual.ts
  // can build a precise `host.applyJsonFilter` target when the user clicks
  // a bar in a non-primary axis section (PBI Selection API is locked to the
  // primary category role, so non-primary cross-filter needs a filter object).
  const axisSectionsHtml = axisList.map((ax, i) => {
    const display = i === 0 ? 'flex' : 'none'
    const t2 = ax.groupBy.table, col = ax.groupBy.column
    return `"<div data-axis-section='${i}' data-axis-table='${daxStr(t2)}' data-axis-column='${daxStr(col)}' style='flex:1;${containerOverflow};overflow-x:visible;position:relative;${display === 'none' ? 'display:none;' : 'display:flex;'}flex-direction:column;gap:4px;padding-block:6px;min-height:0;'>" & ${gridLinesHtml} & _barHtml${i} & "</div>"`
  }).join(' & ')

  return `
-- ALLSELECTED removes the category self-filter so the measure returns ALL
-- category rows even when PBI evaluates it per-category (category role bound
-- for Selection API / cross-filter). Without this, each category sees only
-- its own row and we end up with one bar per evaluation.
-- FILTER(..., NOT ISBLANK([measure])) drops categories with no data so we
-- don't emit empty "$" bars (e.g. Components with null revenue).
${axisVarBlocks}
RETURN
"${animCss.replace(/"/g, '""')}" &
"<div style='${cardStyleStr}'>" &
${showAccentStrip ? `"<div style='${stripStr}'></div>" &` : ''}
"<div style='display:flex;flex-direction:column;height:100%;padding:14px 16px 12px 18px;box-sizing:border-box;'>" &
${titleWithPillsHtml}
${axisSectionsHtml} &
"</div></div>"
  `.trim()
}

// ── Stacked Bar ────────────────────────────────────────────────────────────

export function buildStackedBarDax(visual, theme = 'dark') {
  const config   = visual.config || {}
  const isDark   = theme !== 'light'
  const scheme   = getScheme(config.colorScheme || visual.colorScheme)
  const measures = visual.measures || []
  const m1       = measures[0] || ''
  const m2       = measures[1] || m1
  const title    = config.title || config.label || m1
  const dim      = parseDim(visual.dimension)
  const limit    = visual.limit || 10
  const c        = scheme.start
  const c2       = scheme.mid || scheme.start
  const cardBg   = isDark ? 'linear-gradient(180deg,rgba(20,20,34,1) 0%,rgba(11,11,20,1) 100%)' : 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFC 100%)'
  const catColor = isDark ? 'rgba(255,255,255,0.75)' : 'rgba(15,23,42,0.75)'
  const trackBg  = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.05)'
  const valColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(15,23,42,0.6)'

  if (!dim) return buildKpiDax(visual, theme)

  return `
VAR _rows = TOPN(${limit}, VALUES('${dim.table}'[${dim.column}]), [${m1}] + [${m2}], DESC)
VAR _maxTotal = MAXX(_rows, [${m1}] + [${m2}])
VAR _barHtml = CONCATENATEX(
    _rows,
    VAR _cat = '${dim.table}'[${dim.column}]
    VAR _v1 = [${m1}]
    VAR _v2 = [${m2}]
    VAR _total = _v1 + _v2
    VAR _totalFmt = ${daxAbbrevFormat('_total')}
    VAR _pct1 = IF(_maxTotal > 0, DIVIDE(_v1, _maxTotal) * 100, 0)
    VAR _pct2 = IF(_maxTotal > 0, DIVIDE(_v2, _maxTotal) * 100, 0)
    RETURN
    "<div style='display:flex;align-items:center;gap:8px;height:20px;margin-bottom:6px'>" &
    "<div style='width:110px;font-size:11px;color:${catColor};text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'>" & _cat & "</div>" &
    "<div style='flex:1;height:14px;display:flex;border-radius:4px;overflow:hidden;background:${trackBg}'>" &
    "<div style='width:" & FORMAT(_pct1, "0.0") & "%;height:100%;background:${c}'></div>" &
    "<div style='width:" & FORMAT(_pct2, "0.0") & "%;height:100%;background:${c2}'></div>" &
    "</div>" &
    "<div style='font-size:10px;color:${valColor};min-width:48px;text-align:right'>" & _totalFmt & "</div>" &
    "</div>",
    "",
    [${m1}] + [${m2}], DESC
)
RETURN
"<div style='box-sizing:border-box;position:absolute;inset:0;background:${cardBg};font-family:Inter,sans-serif;overflow:hidden;padding:18px 20px 18px 24px'>" &
"<div style='position:absolute;top:0;bottom:0;left:0;width:3px;background:linear-gradient(180deg,${c},${c}55)'></div>" &
"<div style='display:flex;flex-direction:column;height:100%'>" &
"<div style='font-size:11px;font-weight:600;color:${isDark ? 'rgba(255,255,255,0.65)' : 'rgba(15,23,42,0.65)'};margin-bottom:6px'>${daxStr(title)}</div>" &
"<div style='flex:1;overflow-y:auto;min-height:0;padding-right:4px'>" & _barHtml & "</div>" &
"</div></div>"
  `.trim()
}

// ── Funnel ─────────────────────────────────────────────────────────────────

export function buildFunnelDax(visual, theme = 'dark') {
  return buildBarDax(visual, theme)
}

// ── Table ──────────────────────────────────────────────────────────────────

export function buildTableDax(visual, theme = 'dark') {
  const config   = visual.config || {}
  const isDark   = theme !== 'light'
  const scheme   = getScheme(config.colorScheme || visual.colorScheme)
  const measure  = visual.measures?.[0] || ''
  const title    = config.title || config.label || 'Table'
  const dim      = parseDim(visual.dimension)
  const limit    = visual.limit || 10
  const c        = scheme.start
  const cardBg   = isDark ? 'linear-gradient(180deg,rgba(20,20,34,1) 0%,rgba(11,11,20,1) 100%)' : 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFC 100%)'
  const rowBorder= isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'
  const cellColor= isDark ? '#F1F5F9' : '#0F172A'
  const titleColor = isDark ? '#F1F5F9' : '#0F172A'

  if (!dim) return buildKpiDax(visual, theme)

  return `
VAR _rows = TOPN(${limit}, VALUES('${dim.table}'[${dim.column}]), [${measure}], DESC)
VAR _tableHtml = CONCATENATEX(
    _rows,
    VAR _cat = '${dim.table}'[${dim.column}]
    VAR _val = [${measure}]
    VAR _abbrev = ${daxAbbrevFormat('_val')}
    RETURN
    "<tr style='border-bottom:1px solid ${rowBorder}'>" &
    "<td style='padding:7px 10px;font-size:11px;color:${cellColor};max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'>" & _cat & "</td>" &
    "<td style='padding:7px 10px;text-align:right;font-size:11px;font-weight:600;color:${cellColor};font-variant-numeric:tabular-nums'>" & _abbrev & "</td>" &
    "</tr>",
    "",
    [${measure}], DESC
)
RETURN
"<div style='box-sizing:border-box;position:absolute;inset:0;background:${cardBg};font-family:Inter,sans-serif;overflow:hidden;padding:18px 20px 18px 24px'>" &
"<div style='position:absolute;top:0;bottom:0;left:0;width:3px;background:linear-gradient(180deg,${c},${c}55)'></div>" &
"<div style='display:flex;flex-direction:column;height:100%;padding-top:6px'>" &
"<div style='font-size:11px;font-weight:700;color:${titleColor};margin-bottom:10px'>${daxStr(title)}</div>" &
"<div style='flex:1;min-height:0;overflow:auto'>" &
"<table style='width:100%;border-collapse:collapse'>" &
"<thead><tr><th style='padding:8px 10px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;color:${isDark ? '#64748B' : '#475569'};border-bottom:1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};background:${isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.03)'}'>Name</th><th style='padding:8px 10px;text-align:right;font-size:9px;font-weight:700;text-transform:uppercase;color:${isDark ? '#64748B' : '#475569'};border-bottom:1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};background:${isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.03)'}'>${daxStr(measure)}</th></tr></thead>" &
"<tbody>" & _tableHtml & "</tbody>" &
"</table></div></div></div>"
  `.trim()
}

// ── Donut ──────────────────────────────────────────────────────────────────

export function buildDonutDax(visual, theme = 'dark') {
  // Donut with dynamic SVG arcs in DAX is extremely complex.
  // Simplified: show a value breakdown list (same data, no pie chart).
  return buildBarDax(visual, theme)
}

// ── Line / Area ───────────────────────────────────────────────────────────

export function buildLineDax(visual, theme = 'dark') {
  // Line/area SVG path computation in DAX is impractical.
  // Simplified: show as a table with trend indicator.
  return buildBarDax(visual, theme)
}

// ── SVG-heavy types (radar, scatter, treemap) ─────────────────────────────

export function buildRadarDax(visual, theme = 'dark')   { return buildBarDax(visual, theme) }
export function buildScatterDax(visual, theme = 'dark') { return buildBarDax(visual, theme) }
export function buildTreemapDax(visual, theme = 'dark') { return buildBarDax(visual, theme) }

// ── Dispatcher ─────────────────────────────────────────────────────────────

const DAX_BUILDERS = {
  kpi:         buildKpiDax,
  gauge:       buildGaugeDax,
  bar:         buildBarDax,
  stacked_bar: buildStackedBarDax,
  funnel:      buildFunnelDax,
  table:       buildTableDax,
  donut:       buildDonutDax,
  line:        buildLineDax,
  area:        buildLineDax,
  radar:       buildRadarDax,
  scatter:     buildScatterDax,
  treemap:     buildTreemapDax,
  sankey:      buildFunnelDax,
}

/**
 * Build a live DAX expression for a visual that produces HTML at query time.
 * Returns the DAX expression string (to be placed in a TMDL measure body).
 *
 * @param {Object} visual — { type, measures, dimension, config, limit, orderBy }
 * @param {string} theme  — 'dark' | 'light' (passed through to builders)
 * @returns {string} — DAX expression
 */
export function buildLiveDax(visual, theme = 'dark') {
  const builder = DAX_BUILDERS[visual?.type]
  if (!builder) return buildKpiDax(visual, theme)
  return builder(visual, theme)
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 5.2 — data-only DAX path. Used for primitive-covered visual types.
// Returns a measure body that produces a numeric value (or a SUMMARIZECOLUMNS
// table — written by the caller as part of the dataView). Companion to
// `buildPrimitiveSpec` which serializes the visual's config alongside the data
// so the .pbiviz can reconstruct the chart via the primitives runtime.
// ─────────────────────────────────────────────────────────────────────────────

// Visual types that have a primitive-runtime renderer in the .pbiviz (Phase 5.1
// onward). All other types fall back to the legacy HTML/Live-DAX path.
export const PRIMITIVE_COVERED_TYPES = new Set([
  'bar', 'stacked_bar', 'grouped_bar', 'column',
  'line', 'area', 'stacked_area', 'bump',
  'donut', 'pie',
  'scatter', 'bubble',
  'treemap', 'radar', 'gauge',
  'table',
  'slope', 'lollipop',
  'bar_race',
])

export function isPrimitiveCovered(visualType) {
  return PRIMITIVE_COVERED_TYPES.has(visualType)
}

/**
 * Build a data-only measure body for a primitive-covered visual.
 * The DAX measure simply returns the primary measure value — at query time, PBI
 * groups by the visual's category column (declared via the visual binding) so
 * the dataView arrives as a categorical with one row per category.
 *
 * For multi-measure visuals (stacked/grouped bar, scatter+secondary, bubble+third),
 * additional measures are bound directly to dataView roles in the publish flow —
 * this builder still returns the PRIMARY measure body. The publish flow attaches
 * secondary/tertiary as separate measure bindings on the same visual container.
 *
 * @param {Object} visual — { type, data: { measures, groupBy, limit, orderBy }, config }
 * @returns {string} — DAX expression (the measure body)
 */
export function buildDataOnlyDax(visual, measureIndex = 0) {
  // Visuals carry measures at the top-level (`visual.measures`); fall back to
  // `visual.data.measures` for older shapes used by some preview paths.
  const measures = visual?.measures || visual?.data?.measures || []
  const measureName = measures[measureIndex]
  if (!measureName) return null
  // Bracketize the measure reference. If it's already bracket-wrapped, leave it.
  const ref = /^\[.+\]$/.test(measureName) ? measureName : `[${measureName}]`
  // Single line — the caller wraps in TMDL measure block. SUMMARIZECOLUMNS lives
  // in the visual's data binding (PBI auto-groups), so the measure just returns
  // the scalar. The primitive renderer doesn't need the group-by inside DAX.
  return ref
}

/**
 * Serialize the visual's spec into a JSON string that the .pbiviz reads as
 * `dataView.metadata.objects.semantica.primitiveSpec`. This carries the visual
 * type + all of `visual.config` — enough for the renderer to reconstruct the
 * exact same chart it sees on the web canvas.
 *
 * Strips fields the renderer doesn't need (private `_T`, `_globalFilters`,
 * `_selectedCat`, etc. that the web app uses for runtime selection state but
 * which are meaningless in PBI Service).
 */
export function buildPrimitiveSpec(visual, canvasTheme = 'dark') {
  const config = { ...(visual?.config || {}) }
  // Strip web-only runtime keys
  for (const k of Object.keys(config)) {
    if (k.startsWith('_')) delete config[k]
  }
  // Strip null-valued keys to keep the JSON small
  for (const k of Object.keys(config)) {
    if (config[k] === null) delete config[k]
  }
  const measures = visual?.measures || visual?.data?.measures || []
  // Click-to-drill hierarchy (interaction-plays). When present (≥2 levels) the
  // publish flow binds every level to category1..N, and the .pbiviz re-aggregates
  // client-side on click (drillStyle rides in config). Absent → visual unchanged.
  const drillRaw = Array.isArray(visual?.drill) ? visual.drill
    : (Array.isArray(visual?.data?.drill) ? visual.data.drill : null)
  const drill = drillRaw
    ? drillRaw.filter(d => d?.table && d?.column).map(d => ({ table: d.table, column: d.column }))
    : null
  return {
    version: 1,
    type: visual?.type,
    // Phase 5.3: carry the canvas theme so the .pbiviz uses the same dark/light
    // tokens as Semantica without relying on host.colorPalette inference (which
    // doesn't always reflect Semantica's actual canvas in PBI Service).
    canvasTheme: canvasTheme === 'light' ? 'light' : 'dark',
    config,
    ...(drill && drill.length >= 2 ? { drill } : {}),
    measures: {
      primary:   measures[0] || null,
      secondary: measures[1] || null,
      tertiary:  measures[2] || null,
      // Full ordered list — table visual reads this for dynamic N measure labels.
      all: measures,
    },
  }
}

/**
 * Convenience: returns the JSON-stringified spec ready to embed in a Power BI
 * report-visual property. The .pbiviz reads it via
 * `dataView.metadata.objects.semantica.primitiveSpec` (declared in capabilities.json).
 */
export function buildPrimitiveSpecJson(visual, canvasTheme = 'dark') {
  return JSON.stringify(buildPrimitiveSpec(visual, canvasTheme))
}
