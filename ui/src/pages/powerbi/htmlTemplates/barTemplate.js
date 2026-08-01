/**
 * Bar chart HTML template — horizontal bars rendered with HTML divs.
 * Each row: category label, bar (colored div with width: %), value.
 */

import { themeTokens, getColorScheme, formatNumber, escapeHtml, normalizeRows, wrapCard, tooltipUid } from './shared.js'

export function renderBarHtml(visual, queryResult, theme = 'dark') {
  const t       = themeTokens(theme)
  const scheme  = getColorScheme(visual.config?.colorScheme || visual.colorScheme)
  const measures = visual.measures || visual.data?.measures || []
  const dimRef   = visual.dimension || (visual.data?.groupBy
    ? `${visual.data.groupBy.table}[${visual.data.groupBy.column}]`
    : '')
  const title   = visual.title || visual.config?.title || measures[0] || 'Bar Chart'

  const rows = normalizeRows(queryResult, dimRef, measures).slice(0, 12)
  const maxVal = rows.reduce((m, r) => Math.max(m, r._val || 0), 0) || 1
  const n      = rows.length
  const isAsc  = visual.config?.orderBy === 'asc' || visual.orderBy === 'asc'

  // Rank-based opacity to match CompactBar (AppSpecRenderer.jsx:362):
  //   desc order → biggest bar gets opacity 0.9, smallest gets 0.35
  //   asc  order → smallest bar gets opacity 0.35, biggest gets 0.9
  // Result: visual hierarchy — user's eye goes to the largest bar immediately.
  const prefix = visual.config?.prefix || ''
  const suffix = visual.config?.suffix || ''
  const uid = tooltipUid()

  const barRows = rows.map((row, i) => {
    const pct = Math.max(0, (row._val / maxVal) * 100)
    const ratio = isAsc
      ? i / Math.max(n - 1, 1)
      : (n - 1 - i) / Math.max(n - 1, 1)
    const opacity = (0.35 + ratio * 0.55).toFixed(2)
    const valStr  = formatNumber(row._val)
    const prefix  = visual.config?.prefix || ''
    const suffix  = visual.config?.suffix || ''
    return `
      <div style="
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
        position: relative;
      "
      class="${uid}-row"
      onmousemove="var t=this.querySelector('.${uid}-tt');if(t){t.style.left=event.offsetX+'px';t.style.top=(event.offsetY<50?(event.offsetY+20):(event.offsetY-50))+'px'}"
      >
        <div style="width:100px;flex-shrink:0;font-size:11px;color:${t.textSecondary};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right;">${escapeHtml(row._cat)}</div>
        <div style="
          flex: 1;
          height: 26px;
          background: ${theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.025)'};
          border-radius: 4px;
          overflow: hidden;
        ">
          <div style="
            height: 100%;
            width: ${pct.toFixed(2)}%;
            background: ${scheme.start};
            opacity: ${opacity};
            border-radius: 4px;
          "></div>
        </div>
        <div style="width:60px;flex-shrink:0;font-size:11px;font-weight:600;color:${t.textPrimary};text-align:right;">${escapeHtml(valStr)}</div>
        <div class="${uid}-tt" style="display:none;position:absolute;z-index:10;background:${theme === 'light' ? '#fff' : '#0e0e1c'};border:1px solid ${theme === 'light' ? '#E2E8F0' : 'rgba(255,255,255,0.11)'};border-radius:10px;padding:10px 13px;min-width:140px;pointer-events:none;white-space:nowrap;box-shadow:${theme === 'light' ? '0 8px 24px rgba(0,0,0,0.12)' : '0 12px 28px rgba(0,0,0,0.48)'};color:${theme === 'light' ? '#1E293B' : '#E5E7EB'}">
          <div style="font-size:12px;font-weight:600;color:${theme === 'light' ? '#0F172A' : '#F8FAFC'};margin-bottom:6px;">${escapeHtml(row._cat)}</div>
          <div style="display:flex;justify-content:space-between;gap:16px;font-size:11px;"><span style="color:${theme === 'light' ? '#64748B' : 'rgba(255,255,255,0.55)'};">${escapeHtml(measures[0] || 'Value')}</span><span style="color:${scheme.text || scheme.start};font-weight:700;">${escapeHtml(prefix)}${escapeHtml(valStr)}${escapeHtml(suffix)}</span></div>
        </div>
      </div>
    `
  }).join('')

  const inner = `
    <style>.${uid}-row:hover .${uid}-tt{display:block!important}.${uid}-row:hover{background:rgba(${theme === 'light' ? '0,0,0,0.03' : '255,255,255,0.03'})}</style>
    <div style="display:flex;flex-direction:column;height:100%;padding-top:6px;">
      <div style="font-size:11px;font-weight:600;color:${t.textMuted};margin-bottom:14px;">${escapeHtml(title)}</div>
      <div style="flex:1;overflow:hidden;display:flex;flex-direction:column;justify-content:space-evenly;">
        ${barRows || `<div style="color:${t.textMuted};font-size:11px;text-align:center;padding-top:32px;">No data</div>`}
      </div>
    </div>
  `
  return wrapCard(inner, { theme, accentColor: scheme.start })
}
