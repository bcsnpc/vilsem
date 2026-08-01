/**
 * Tooltip HTML template — compact, single-visual tooltip card rendered on
 * the hidden Power BI tooltip page. One `renderTooltipHtml(visual, result,
 * theme)` covers every visual type by producing a consistent key/value
 * summary (title + primary metric + optional breakdown).
 *
 * Design: smaller than the main visual, fits a 320x200 tooltip page, dark
 * gradient matching the main card chrome, accent left-edge.
 */

import { getColorScheme, formatNumber, escapeHtml, normalizeRows, getScalarValue, themeTokens } from './shared.js'

export function renderTooltipHtml(visual, queryResult, theme = 'dark') {
  const t       = themeTokens(theme)
  const config  = visual.config || {}
  const scheme  = getColorScheme(config.colorScheme || visual.colorScheme)
  const title   = config.title || config.label || visual.title || visual.type || ''
  const measures = visual.measures || visual.data?.measures || []
  const c       = scheme.start

  // Scalar primary value (works for kpi/gauge/bar/donut/etc — takes row[0])
  let primaryValue = null
  let breakdown    = []

  if (visual.type === 'kpi' || visual.type === 'gauge') {
    const name = measures[0] || ''
    primaryValue = getScalarValue(queryResult, name)
  } else {
    const rows = normalizeRows(queryResult, visual.dimension, measures).slice(0, 5)
    if (rows.length > 0) {
      primaryValue = rows[0]._val
      breakdown = rows.map((r) => ({
        cat:  r._cat,
        val:  r._val,
        val2: r._val2,
      }))
    }
  }

  const prefix = config.prefix || ''
  const suffix = config.suffix || ''
  const valueText = primaryValue != null ? `${prefix}${formatNumber(primaryValue)}${suffix}` : '—'

  const breakdownRows = breakdown.map((b) => `
    <div style="display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; font-size: 11px;">
      <span style="color: ${t.textSecondary}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px;">${escapeHtml(String(b.cat || ''))}</span>
      <span style="color: ${t.textPrimary}; font-weight: 600; font-variant-numeric: tabular-nums;">${escapeHtml(formatNumber(b.val))}</span>
    </div>
  `).join('')

  return `
    <div style="
      box-sizing: border-box;
      position: absolute;
      inset: 0;
      background: linear-gradient(150deg, ${c}22 0%, rgba(10,10,18,0.98) 60%);
      border: 1px solid ${c}3a;
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.32);
      font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: ${t.textPrimary};
      overflow: hidden;
      padding: 14px 16px 14px 18px;
    ">
      <div style="position: absolute; top: 0; bottom: 0; left: 0; width: 3px; background: linear-gradient(180deg, ${c}cc 0%, ${c}22 100%);"></div>
      <div style="font-size: 10px; font-weight: 700; color: ${t.textMuted}; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px;">
        ${escapeHtml(title)}
      </div>
      <div style="font-size: 26px; font-weight: 800; color: ${scheme.text || c}; line-height: 1; letter-spacing: -0.02em; text-shadow: 0 0 20px ${c}55; margin-bottom: 10px;">
        ${escapeHtml(valueText)}
      </div>
      ${breakdown.length > 0 ? `
        <div style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 8px;">
          <div style="font-size: 9px; font-weight: 600; color: ${t.textMuted}; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Top entries</div>
          ${breakdownRows}
        </div>
      ` : ''}
    </div>
  `
}
