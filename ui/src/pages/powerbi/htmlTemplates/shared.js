/**
 * Shared utilities used by every visual HTML template.
 *
 * The HTML produced by these templates lives inside Power BI's HTML Content
 * visual containers, so the rules are strict:
 *   • All styles inline via style="…" — no <link>, no external CSS
 *   • No external <script> tags (HTML Content visual blocks scripts anyway)
 *   • Self-contained — no relative URLs, no images by reference
 *   • Inline <style> blocks ARE allowed and we use them for hover/animation
 *   • DAX literal escaping: any embedded HTML string ultimately gets wrapped
 *     inside a Literal.Value single-quoted DAX string by the report builder,
 *     so the strings here MUST be safe to JSON-stringify and embed
 */

import { COLOR_SCHEMES } from '../../../appspec/colorSchemes'

// ── Theme tokens (inline for self-contained HTML) ───────────────────────────

export function themeTokens(mode) {
  if (mode === 'light') {
    return {
      cardBg:       '#FFFFFF',
      cardBorder:   '#E2E8F0',
      textPrimary:  '#0F172A',
      textSecondary:'#334155',
      textMuted:    '#64748B',
      textFaint:    '#94A3B8',
      gridLine:     'rgba(0,0,0,0.08)',
      shadow:       '0 4px 16px rgba(0,0,0,0.08)',
    }
  }
  return {
    cardBg:       'linear-gradient(180deg, rgba(20,20,34,1) 0%, rgba(11,11,20,1) 100%)',
    cardBorder:   'rgba(255,255,255,0.1)',
    textPrimary:  '#F1F5F9',
    textSecondary:'#94A3B8',
    textMuted:    '#64748B',
    gridLine:     'rgba(255,255,255,0.05)',
    shadow:       '0 16px 36px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
  }
}

export function getColorScheme(name) {
  return COLOR_SCHEMES[name] || COLOR_SCHEMES.teal
}

// ── Number formatting ──────────────────────────────────────────────────────

/**
 * Format a number for display: thousands separators, 2 sig digits for small,
 * abbreviations for large (1.2K / 4.5M / 2.3B). Returns a string.
 */
export function formatNumber(value) {
  if (value == null || value === '') return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return String(value)

  const abs = Math.abs(n)
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  if (Number.isInteger(n)) return n.toLocaleString('en-US')
  return n.toFixed(2)
}

export function formatPercent(value, total) {
  if (total === 0 || total == null) return '0%'
  const pct = (Number(value) / Number(total)) * 100
  return pct.toFixed(1) + '%'
}

// ── HTML safety ────────────────────────────────────────────────────────────

/**
 * Escape HTML special characters in a string. Use this for any value that
 * comes from data (measure names, dimension values, etc.) before embedding
 * it in the template.
 */
export function escapeHtml(str) {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ── Data extraction ────────────────────────────────────────────────────────

/**
 * Extract a scalar number from a query result. Handles both shapes returned
 * by window.semantica.query: { data: { 'Measure': 123 } } and
 * { rows: [{ 'Measure': 123 }] }. Falls back to 0 if nothing useful is found.
 */
export function getScalarValue(result, measureName) {
  if (!result) return 0
  if (result.data && Object.prototype.hasOwnProperty.call(result.data, measureName)) {
    return Number(result.data[measureName]) || 0
  }
  if (result.rows && Array.isArray(result.rows) && result.rows[0]) {
    const row = result.rows[0]
    if (Object.prototype.hasOwnProperty.call(row, measureName)) {
      return Number(row[measureName]) || 0
    }
    // Fallback: first numeric column
    for (const k of Object.keys(row)) {
      const n = Number(row[k])
      if (Number.isFinite(n)) return n
    }
  }
  return 0
}

/**
 * Extract grouped rows from a queryTable result. Returns an array of
 * { _cat, _val, _val2 } objects normalized for downstream templates.
 */
export function normalizeRows(result, dimensionRef, measureNames) {
  const rows = result?.rows || result?.data || []
  if (!Array.isArray(rows) || rows.length === 0) return []

  // Determine the category column key
  const sample = rows[0] || {}
  const sampleKeys = Object.keys(sample)
  const categoryKey = sampleKeys.find((k) =>
    k === dimensionRef || k.endsWith('].' + (dimensionRef || '').split('[').pop())
  ) || sampleKeys.find((k) => typeof sample[k] === 'string') || sampleKeys[0]

  return rows.map((row) => {
    const cat  = row[categoryKey]
    const val  = measureNames[0] ? Number(row[measureNames[0]]) || 0 : 0
    const val2 = measureNames[1] ? Number(row[measureNames[1]]) || 0 : null
    return { _cat: cat, _val: val, _val2: val2 }
  })
}

// ── CSS hover tooltip helpers ──────────────────────────────────────────────
//
// Pure CSS + inline onmousemove tooltips that work inside HTML Content
// visual's sandbox (no PBI tooltip API needed). Pattern:
//   - Each interactive element gets class="${uid}-row" + hidden tooltip child
//   - <style> .${uid}-row:hover .${uid}-tt { display: block } </style>
//   - onmousemove positions the tooltip at the cursor

let _tooltipCounter = 0

/**
 * Generate a unique CSS class prefix per visual so multiple visuals on one
 * PBI page don't collide.
 */
export function tooltipUid() {
  return `stt${(++_tooltipCounter).toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Emit the <style> block for hover tooltip visibility + row highlight.
 */
export function tooltipStyle(uid) {
  return `
    <style>
      .${uid}-row:hover .${uid}-tt { display: block !important; }
      .${uid}-row:hover { background: rgba(255,255,255,0.03); border-radius: 4px; }
    </style>
  `
}

/**
 * Inline onmousemove attribute string for cursor-following tooltip.
 * Flips tooltip below cursor when near the top of the container.
 */
export function tooltipMouseMove(uid) {
  return `onmousemove="var t=this.querySelector('.${uid}-tt');if(t){t.style.left=event.offsetX+'px';t.style.top=(event.offsetY<50?(event.offsetY+20):(event.offsetY-50))+'px'}"`
}

/**
 * Render a tooltip div (hidden by default) matching Semantica's AppBarTooltip.
 * @param {string} uid - unique class prefix
 * @param {string} categoryHtml - escaped category name
 * @param {string} measureLabel - escaped measure display name
 * @param {string} valueHtml - escaped formatted value
 * @param {string} accentColor - scheme.text or scheme.start
 */
export function tooltipDiv(uid, categoryHtml, measureLabel, valueHtml, accentColor, theme = 'dark') {
  const isDark = theme !== 'light'
  return `
    <div class="${uid}-tt" style="
      display: none;
      position: absolute;
      left: 50%; top: -40px;
      z-index: 10;
      background: ${isDark ? '#0e0e1c' : '#FFFFFF'};
      border: 1px solid ${isDark ? 'rgba(255,255,255,0.11)' : '#E2E8F0'};
      border-radius: 10px;
      padding: 10px 13px;
      min-width: 140px;
      pointer-events: none;
      white-space: nowrap;
      box-shadow: ${isDark ? '0 12px 28px rgba(0,0,0,0.48)' : '0 8px 24px rgba(0,0,0,0.12)'};
      color: ${isDark ? '#E5E7EB' : '#1E293B'};
    ">
      <div style="font-size: 12px; font-weight: 600; color: ${isDark ? '#F8FAFC' : '#0F172A'}; margin-bottom: 6px;">${categoryHtml}</div>
      <div style="display: flex; justify-content: space-between; gap: 16px; font-size: 11px;">
        <span style="color: ${isDark ? 'rgba(255,255,255,0.55)' : '#64748B'};">${measureLabel}</span>
        <span style="color: ${accentColor}; font-weight: 700;">${valueHtml}</span>
      </div>
    </div>
  `
}

/**
 * For SVG-based charts: wrap the SVG + a floating tooltip div in a positioned
 * container. Individual SVG elements use svgElTooltipAttrs() to show/hide it.
 */
export function svgTooltipContainer(uid, svgHtml) {
  return `
    <div id="${uid}-wrap" style="position: relative; width: 100%; height: 100%;">
      ${svgHtml}
      <div id="${uid}-tt" style="
        display: none;
        position: absolute;
        z-index: 10;
        background: #0e0e1c;
        border: 1px solid rgba(255,255,255,0.11);
        border-radius: 10px;
        padding: 10px 13px;
        min-width: 140px;
        pointer-events: none;
        white-space: nowrap;
        box-shadow: 0 12px 28px rgba(0,0,0,0.48);
        color: #E5E7EB;
      ">
        <div id="${uid}-tt-cat" style="font-size: 12px; font-weight: 600; color: #F8FAFC; margin-bottom: 6px;"></div>
        <div style="display: flex; justify-content: space-between; gap: 16px; font-size: 11px;">
          <span id="${uid}-tt-lbl" style="color: rgba(255,255,255,0.55);"></span>
          <span id="${uid}-tt-val" style="font-weight: 700;"></span>
        </div>
      </div>
    </div>
  `
}

/**
 * Inline SVG element attributes (onmouseover/out/move) to drive the shared
 * tooltip container. Returns a string to splice into an SVG element tag.
 *
 * @param {string} uid - tooltip container uid
 * @param {string} cat - category text (already escaped)
 * @param {string} label - measure label (already escaped)
 * @param {string} value - formatted value (already escaped)
 * @param {string} accent - accent color for value text
 */
export function svgElTooltipAttrs(uid, cat, label, value, accent) {
  const show = `var w=document.getElementById('${uid}-wrap');if(!w)return;var t=document.getElementById('${uid}-tt');t.style.display='block';` +
    `t.querySelector('#${uid}-tt-cat').textContent='${cat.replace(/'/g, "\\'")}';` +
    `t.querySelector('#${uid}-tt-lbl').textContent='${label.replace(/'/g, "\\'")}';` +
    `var v=t.querySelector('#${uid}-tt-val');v.textContent='${value.replace(/'/g, "\\'")}';v.style.color='${accent}'`
  const hide = `var t=document.getElementById('${uid}-tt');if(t)t.style.display='none'`
  const move = `var w=document.getElementById('${uid}-wrap');if(!w)return;var r=w.getBoundingClientRect();var t=document.getElementById('${uid}-tt');` +
    `t.style.left=(event.clientX-r.left+12)+'px';t.style.top=(event.clientY-r.top-50)+'px'`
  return `onmouseover="${show}" onmouseout="${hide}" onmousemove="${move}" style="cursor:crosshair"`
}

// ── Card chrome ────────────────────────────────────────────────────────────

/**
 * Wrap inner HTML in a Semantica-style card. Used by every template so the
 * outer styling is consistent.
 */
// Google Fonts link for Inter — injected once per visual's HTML so PBI
// renders the same font as Semantica editor. Without this, PBI falls
// back to system fonts (Segoe UI) which looks different.
const FONT_LINK = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">`

export function wrapCard(innerHtml, { theme = 'dark', accentColor = COLOR_SCHEMES.teal.start } = {}) {
  const t = themeTokens(theme)
  // Full-bleed fill: no border-radius, no outer border, no shadow. When hosted
  // inside HTML Content visual (Power BI), the visual container paints its own
  // default chrome around the visual — a rounded/bordered card here creates
  // a visible "frame" effect. Extending our dark background edge-to-edge
  // (via position:absolute inset:0) makes the container's default outline
  // sit flush against our content, so it reads as a subtle separator instead
  // of an awkward white frame.
  return `
    ${FONT_LINK}
    <div style="
      box-sizing: border-box;
      position: absolute;
      inset: 0;
      padding: 16px 18px 16px 22px;
      background: ${t.cardBg};
      border: 1px solid ${t.cardBorder};
      border-radius: 12px;
      box-shadow: ${t.shadow};
      font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: ${t.textPrimary} !important;
      overflow: hidden;
    ">
      <div style="
        position: absolute; top: 0; bottom: 0; left: 0; width: 3px;
        background: linear-gradient(180deg, ${accentColor}, ${accentColor}55);
      "></div>
      ${innerHtml}
    </div>
  `
}
