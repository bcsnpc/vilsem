/**
 * Scatter HTML template — mirrors CompactScatter from AppSpecRenderer.jsx:761.
 *
 * Simple XY scatter:
 *   • X axis with 3 tick labels (min/mid/max)
 *   • No Y axis (matches <YAxis hide /> in editor)
 *   • SVG <circle> per point, radius based on optional z/size (or fixed)
 *   • Fill opacity 0.75
 */

import { getColorScheme, formatNumber, escapeHtml, normalizeRows, wrapCard, tooltipUid, svgTooltipContainer, svgElTooltipAttrs } from './shared.js'

export function renderScatterHtml(visual, queryResult, theme = 'dark') {
  const config  = visual.config || {}
  const scheme  = getColorScheme(config.colorScheme || visual.colorScheme)
  const title   = config.title || config.label || visual.title || ''
  const measures = visual.measures || visual.data?.measures || []

  const rawRows = normalizeRows(queryResult, visual.dimension, measures)
  // Scatter uses _val (x) and _val2 (y); fallback y = _val if _val2 missing
  const rows = rawRows
    .filter((r) => r?._val != null)
    .slice(0, 100)
    .map((r) => ({ cat: r._cat, x: r._val, y: r._val2 ?? r._val }))

  if (!rows.length) {
    return wrapCard(
      `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,0.3);font-size:11px;">No data</div>`,
      { theme, accentColor: scheme.start },
    )
  }

  // Geometry
  const W = 400, H = 220, padL = 24, padR = 16, padT = 12, padB = 26
  const chartW = W - padL - padR
  const chartH = H - padT - padB

  const xs = rows.map((r) => r.x)
  const ys = rows.map((r) => r.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1

  const points = rows.map((r) => ({
    x: padL + ((r.x - minX) / rangeX) * chartW,
    y: padT + chartH - ((r.y - minY) / rangeY) * chartH,
    cat: r.cat,
    rawX: r.x,
    rawY: r.y,
  }))

  // X axis ticks (3): min, mid, max
  const xTicks = [minX, (minX + maxX) / 2, maxX]
  const xTickMarks = xTicks.map((v, i) => {
    const x = padL + (i / 2) * chartW
    return `
      <line x1="${x.toFixed(1)}" y1="${padT + chartH}" x2="${x.toFixed(1)}" y2="${padT + chartH + 4}" stroke="rgba(255,255,255,0.2)" stroke-width="1" />
      <text x="${x.toFixed(1)}" y="${padT + chartH + 16}" text-anchor="middle" font-family="Inter, sans-serif" font-size="9" fill="rgba(255,255,255,0.35)">
        ${escapeHtml(formatNumber(v))}
      </text>
    `
  }).join('')

  const axisLine = `<line x1="${padL}" y1="${padT + chartH}" x2="${padL + chartW}" y2="${padT + chartH}" stroke="rgba(255,255,255,0.1)" stroke-width="1" />`

  const uid = tooltipUid()
  const circles = points.map((p) =>
    `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="${scheme.start}" fill-opacity="0.75" stroke="${scheme.start}" stroke-width="0.5" ${svgElTooltipAttrs(uid, escapeHtml(String(p.cat || '')), escapeHtml(measures[0] || 'X') + ' / ' + escapeHtml(measures[1] || 'Y'), escapeHtml(formatNumber(p.rawX)) + ' / ' + escapeHtml(formatNumber(p.rawY)), scheme.text || scheme.start)} />`
  ).join('')

  const inner = `
    <div style="display: flex; flex-direction: column; height: 100%;">
      ${title ? `
        <div style="
          font-size: 11px; font-weight: 600;
          color: rgba(255,255,255,0.65);
          margin-bottom: 2px; padding-left: 2px; flex-shrink: 0;
        ">${escapeHtml(title)}</div>
      ` : ''}
      <div style="flex: 1; min-height: 0;">
        ${svgTooltipContainer(uid, `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width: 100%; height: 100%;">
          ${axisLine}
          ${xTickMarks}
          ${circles}
        </svg>`)}
      </div>
    </div>
  `
  return wrapCard(inner, { theme, accentColor: scheme.start })
}
