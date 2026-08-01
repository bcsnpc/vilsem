/**
 * Table HTML template — sortable-looking ranked table with row hover and rank
 * accent. Mirrors CompactTable from AppSpecRenderer.
 */

import { themeTokens, getColorScheme, formatNumber, escapeHtml, normalizeRows, wrapCard } from './shared.js'

export function renderTableHtml(visual, queryResult, theme = 'dark') {
  const t       = themeTokens(theme)
  const scheme  = getColorScheme(visual.config?.colorScheme || visual.colorScheme)
  const measures = visual.measures || visual.data?.measures || []
  const dimRef   = visual.dimension || (visual.data?.groupBy
    ? `${visual.data.groupBy.table}[${visual.data.groupBy.column}]`
    : '')
  const title   = visual.title || visual.config?.title || 'Table'

  const rows = normalizeRows(queryResult, dimRef, measures).slice(0, 25)

  const headerLabel = (() => {
    if (!dimRef) return 'Item'
    const m = String(dimRef).match(/\[(.+)\]/)
    return m ? m[1] : 'Item'
  })()

  const headers = `
    <tr>
      <th style="
        padding: 8px 10px; text-align: left;
        font-size: 9px; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.06em; color: ${t.textMuted};
        border-bottom: 1px solid ${t.cardBorder};
        background: rgba(0,0,0,0.15);
      ">#</th>
      <th style="
        padding: 8px 10px; text-align: left;
        font-size: 9px; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.06em; color: ${t.textMuted};
        border-bottom: 1px solid ${t.cardBorder};
        background: rgba(0,0,0,0.15);
      ">${escapeHtml(headerLabel)}</th>
      ${measures.map((m) => `
        <th style="
          padding: 8px 10px; text-align: right;
          font-size: 9px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.06em; color: ${t.textMuted};
          border-bottom: 1px solid ${t.cardBorder};
          background: rgba(0,0,0,0.15);
        ">${escapeHtml(m)}</th>
      `).join('')}
    </tr>
  `

  const body = rows.map((row, i) => {
    const valStr = formatNumber(row._val)
    return `
    <tr style="
      border-bottom: 1px solid ${t.gridLine};
      background: ${i % 2 === 0 ? 'transparent' : (theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.015)')};
    ">
      <td style="
        padding: 7px 10px;
        font-size: 10px; font-weight: 700;
        color: ${i < 3 ? scheme.start : t.textMuted};
        font-variant-numeric: tabular-nums;
        width: 32px;
      ">${i + 1}</td>
      <td style="
        padding: 7px 10px;
        font-size: 11px; color: ${t.textMuted};
        max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      ">${escapeHtml(row._cat)}</td>
      <td style="
        padding: 7px 10px; text-align: right;
        font-size: 11px; font-weight: 600; color: ${t.textMuted};
        font-variant-numeric: tabular-nums;
      ">${escapeHtml(valStr)}</td>
      ${row._val2 != null ? `
        <td style="
          padding: 7px 10px; text-align: right;
          font-size: 11px; font-weight: 600; color: ${t.textSecondary};
          font-variant-numeric: tabular-nums;
        ">${escapeHtml(formatNumber(row._val2))}</td>
      ` : ''}
    </tr>
  `}).join('')

  const inner = `
    <div style="display: flex; flex-direction: column; height: 100%; padding-top: 6px;">
      <div style="
        font-size: 11px; font-weight: 600;
        color: ${t.textMuted};
        margin-bottom: 10px;
      ">
        ${escapeHtml(title)}
      </div>
      <div style="flex: 1; min-height: 0; overflow: auto;">
        <table style="
          width: 100%; border-collapse: collapse;
          font-family: Inter, sans-serif;
        ">
          <thead>${headers}</thead>
          <tbody>${body || `<tr><td colspan="${measures.length + 2}" style="padding:24px;text-align:center;color:${t.textMuted};font-size:11px;">No data</td></tr>`}</tbody>
        </table>
      </div>
    </div>
  `
  return wrapCard(inner, { theme, accentColor: scheme.start })
}
