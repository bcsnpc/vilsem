/**
 * Line chart HTML template — SVG line/area chart with computed paths.
 * Used by both `line` and `area` visual types.
 */

import { themeTokens, getColorScheme, formatNumber, escapeHtml, normalizeRows, wrapCard, tooltipUid, svgTooltipContainer, svgElTooltipAttrs } from './shared.js'

export function renderLineHtml(visual, queryResult, theme = 'dark') {
  const t       = themeTokens(theme)
  const scheme  = getColorScheme(visual.config?.colorScheme || visual.colorScheme)
  const measures = visual.measures || visual.data?.measures || []
  const dimRef   = visual.dimension || (visual.data?.groupBy
    ? `${visual.data.groupBy.table}[${visual.data.groupBy.column}]`
    : '')
  const title   = visual.title || visual.config?.title || measures[0] || 'Line Chart'
  const isArea  = visual.type === 'area'

  const uid  = tooltipUid()
  const rows = normalizeRows(queryResult, dimRef, measures).slice(0, 50)
  if (rows.length === 0) {
    return wrapCard(`
      <div style="font-size:11px;font-weight:700;color:${t.textPrimary};margin-bottom:8px;">${escapeHtml(title)}</div>
      <div style="color:${t.textMuted};font-size:11px;text-align:center;padding-top:32px;">No data</div>
    `, { theme, accentColor: scheme.start })
  }

  // Chart geometry
  const W = 480, H = 200, padL = 40, padR = 12, padT = 14, padB = 28
  const chartW = W - padL - padR
  const chartH = H - padT - padB
  const minVal = Math.min(0, ...rows.map((r) => r._val || 0))
  const maxVal = Math.max(1, ...rows.map((r) => r._val || 0))
  const range  = maxVal - minVal || 1
  const stepX  = rows.length > 1 ? chartW / (rows.length - 1) : chartW

  const points = rows.map((r, i) => ({
    x: padL + i * stepX,
    y: padT + chartH - ((r._val - minVal) / range) * chartH,
    val: r._val,
    cat: r._cat,
  }))

  const linePath = points.map((p, i) =>
    (i === 0 ? 'M' : 'L') + ` ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  ).join(' ')

  const areaPath = isArea
    ? linePath + ` L ${points[points.length - 1].x.toFixed(1)} ${(padT + chartH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padT + chartH).toFixed(1)} Z`
    : null

  // Y-axis ticks (3 levels)
  const yTicks = [maxVal, (maxVal + minVal) / 2, minVal]
  const yTickLines = yTicks.map((v, i) => {
    const y = padT + (i / 2) * chartH
    return `
      <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}"
            stroke="${t.gridLine}" stroke-width="1" />
      <text x="${padL - 6}" y="${y + 3}" text-anchor="end"
            font-family="Inter, sans-serif" font-size="9" fill="${t.textMuted}">
        ${escapeHtml(formatNumber(v))}
      </text>
    `
  }).join('')

  // X-axis labels (sample evenly to avoid crowding)
  const labelCount = Math.min(5, rows.length)
  const labelStep  = Math.max(1, Math.floor(rows.length / labelCount))
  const xLabels = points.filter((_, i) => i % labelStep === 0).map((p) => `
    <text x="${p.x.toFixed(1)}" y="${(H - padB + 14).toFixed(1)}" text-anchor="middle"
          font-family="Inter, sans-serif" font-size="9" fill="${t.textMuted}">
      ${escapeHtml(String(p.cat || '').slice(0, 8))}
    </text>
  `).join('')

  const svg = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"
         style="width: 100%; height: 100%; display: block;"
         xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${scheme.start}" stop-opacity="0.45" />
          <stop offset="100%" stop-color="${scheme.start}" stop-opacity="0.05" />
        </linearGradient>
      </defs>
      ${yTickLines}
      ${areaPath ? `<path d="${areaPath}" fill="url(#lineGrad)" />` : ''}
      <path d="${linePath}" fill="none" stroke="${scheme.start}" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round" />
      ${points.map((p) =>
        `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="${scheme.mid}" stroke="${scheme.start}" stroke-width="1.5" ${svgElTooltipAttrs(uid, escapeHtml(String(p.cat || '')), escapeHtml(measures[0] || 'Value'), escapeHtml(formatNumber(p.val)), scheme.text || scheme.start)} />`
      ).join('')}
      ${xLabels}
    </svg>
  `

  const inner = `
    <div style="display: flex; flex-direction: column; height: 100%; padding-top: 6px;">
      <div style="
        font-size: 11px; font-weight: 600;
        color: ${t.textMuted};
        margin-bottom: 8px;
      ">
        ${escapeHtml(title)}
      </div>
      <div style="flex: 1; min-height: 0; overflow: hidden;">
        ${svgTooltipContainer(uid, svg)}
      </div>
    </div>
  `
  return wrapCard(inner, { theme, accentColor: scheme.start })
}
