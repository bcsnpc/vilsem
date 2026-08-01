/**
 * Stacked Bar HTML template — mirrors CompactStackedBar from AppSpecRenderer.jsx:464.
 *
 * Two-measure horizontal stacked bars. Pure SVG (no scripts, HTML Content safe).
 *
 * Layout:
 *   • Left column: category labels (fixed width, ellipsized)
 *   • Right column: stacked horizontal bars — primary measure left, secondary right
 *   • Inline legend centered below (only when two measures)
 */

import { themeTokens, getColorScheme, formatNumber, escapeHtml, normalizeRows, wrapCard, tooltipUid } from './shared.js'

export function renderStackedBarHtml(visual, queryResult, theme = 'dark') {
  const config  = visual.config || {}
  const scheme  = getColorScheme(config.colorScheme || visual.colorScheme)
  const title   = config.title || config.label || visual.title || ''
  const measures = visual.measures || visual.data?.measures || []

  const rawRows  = normalizeRows(queryResult, visual.dimension, measures)
  const rows     = rawRows.filter((r) => r?._cat != null && r?._val != null).slice(0, 30)
  const hasTwo   = rows.some((r) => r._val2 != null)

  const m1Name = config.measureName || measures[0] || 'Value 1'
  const m2Name = config.secondaryMeasureName || measures[1] || 'Value 2'

  if (!rows.length) {
    return wrapCard(
      `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,0.3);font-size:11px;">No data</div>`,
      { theme, accentColor: scheme.start },
    )
  }

  // Compute max total across rows for width scaling
  const maxTotal = Math.max(
    ...rows.map((r) => Math.abs(r._val || 0) + Math.abs(r._val2 || 0)),
    1,
  )

  // Left label column width — matches CompactStackedBar's labelW formula
  const maxLabelLen = Math.max(...rows.map((r) => String(r._cat || '').length))
  const labelW = Math.min(Math.max(maxLabelLen * 5.5, 60), 130)

  const rowHeight = 20
  const rowGap    = 6
  const barHeight = 14

  const t = themeTokens(theme)
  const uid = tooltipUid()
  const barRows = rows.map((r) => {
    const v1 = Math.abs(r._val  || 0)
    const v2 = Math.abs(r._val2 || 0)
    const total = v1 + v2
    const pct1 = (v1 / maxTotal) * 100
    const pct2 = (v2 / maxTotal) * 100
    const label = escapeHtml(String(r._cat).length > 20 ? String(r._cat).slice(0, 18) + '…' : r._cat)

    return `
      <div class="${uid}-row" style="display:flex;align-items:center;gap:8px;padding:3px 0;position:relative;"
        onmousemove="var t=this.querySelector('.${uid}-tt');if(t){t.style.left=event.offsetX+'px';t.style.top=(event.offsetY<50?(event.offsetY+20):(event.offsetY-50))+'px'}"
      >
        <div style="width:100px;flex-shrink:0;font-size:11px;color:${t.textSecondary};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right;">${label}</div>
        <div style="flex:1;height:26px;display:flex;border-radius:4px;overflow:hidden;background:${theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.025)'}">
          <div style="
            width: ${pct1}%;
            background: ${scheme.start};
            height: 100%;
          " title="${escapeHtml(m1Name)}: ${escapeHtml(formatNumber(v1))}"></div>
          ${hasTwo ? `
            <div style="
              width: ${pct2}%;
              background: ${scheme.mid || scheme.start};
              height: 100%;
            " title="${escapeHtml(m2Name)}: ${escapeHtml(formatNumber(v2))}"></div>
          ` : ''}
        </div>
        <div style="width:60px;flex-shrink:0;font-size:11px;font-weight:600;color:${t.textPrimary};text-align:right;">${escapeHtml(formatNumber(total))}</div>
        <div class="${uid}-tt" style="display:none;position:absolute;z-index:10;background:${theme === 'light' ? '#fff' : '#0e0e1c'};border:1px solid ${theme === 'light' ? '#E2E8F0' : 'rgba(255,255,255,0.11)'};border-radius:10px;padding:10px 13px;min-width:160px;pointer-events:none;white-space:nowrap;box-shadow:${theme === 'light' ? '0 8px 24px rgba(0,0,0,0.12)' : '0 12px 28px rgba(0,0,0,0.48)'};color:${theme === 'light' ? '#1E293B' : '#E5E7EB'}">
          <div style="font-size:12px;font-weight:600;color:${theme === 'light' ? '#0F172A' : '#F8FAFC'};margin-bottom:6px;">${escapeHtml(label)}</div>
          <div style="font-size:11px;display:flex;justify-content:space-between;gap:12px;"><span style="color:${theme === 'light' ? '#64748B' : 'rgba(255,255,255,0.55)'};">${escapeHtml(m1Name)}</span><span style="color:${scheme.start};font-weight:700;">${escapeHtml(formatNumber(v1))}</span></div>
          ${hasTwo ? `<div style="font-size:11px;display:flex;justify-content:space-between;gap:12px;margin-top:2px;"><span style="color:${theme === 'light' ? '#64748B' : 'rgba(255,255,255,0.55)'};">${escapeHtml(m2Name)}</span><span style="color:${scheme.mid || scheme.start};font-weight:700;">${escapeHtml(formatNumber(v2))}</span></div>` : ''}
        </div>
      </div>
    `
  }).join('')

  const legend = hasTwo ? `
    <div style="display:flex;gap:12px;justify-content:center;padding-top:6px;flex-shrink:0;">
      <div style="display:flex;align-items:center;gap:4px;font-size:9px;color:${t.textMuted};">
        <div style="width:8px;height:8px;border-radius:2px;background:${scheme.start};"></div>${escapeHtml(m1Name)}
      </div>
      <div style="display:flex;align-items:center;gap:4px;font-size:9px;color:${t.textMuted};">
        <div style="width:8px;height:8px;border-radius:2px;background:${scheme.mid || scheme.start};"></div>${escapeHtml(m2Name)}
      </div>
    </div>
  ` : ''

  const inner = `
    <style>.${uid}-row:hover .${uid}-tt{display:block!important}.${uid}-row:hover{background:rgba(${theme === 'light' ? '0,0,0,0.03' : '255,255,255,0.03'})}</style>
    <div style="display:flex;flex-direction:column;height:100%;">
      ${title ? `<div style="font-size:11px;font-weight:600;color:${t.textMuted};margin-bottom:8px;">${escapeHtml(title)}</div>` : ''}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:space-evenly;">
        ${barRows}
      </div>
      ${legend}
    </div>
  `
  return wrapCard(inner, { theme, accentColor: scheme.start })
}
