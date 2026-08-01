/**
 * Donut chart HTML template — SVG-based donut with inline legend.
 * Slices computed manually as SVG path arcs.
 */

import { themeTokens, getColorScheme, formatNumber, escapeHtml, normalizeRows, wrapCard } from './shared.js'

export function renderDonutHtml(visual, queryResult, theme = 'dark') {
  const t       = themeTokens(theme)
  const scheme  = getColorScheme(visual.config?.colorScheme || visual.colorScheme)
  const measures = visual.measures || visual.data?.measures || []
  const dimRef   = visual.dimension || (visual.data?.groupBy
    ? `${visual.data.groupBy.table}[${visual.data.groupBy.column}]`
    : '')
  const title   = visual.title || visual.config?.title || measures[0] || 'Donut'

  const rows  = normalizeRows(queryResult, dimRef, measures).slice(0, 8)
  const total = rows.reduce((s, r) => s + (r._val || 0), 0)

  // Multi-colors matching Semantica's AppSpecRenderer MULTI_COLORS
  const MULTI_COLORS = ['#14B8A6','#3B82F6','#A855F7','#F59E0B','#22C55E','#F43F5E']

  // Build SVG arc paths
  const cx = 50, cy = 50, rOuter = 42, rInner = 26
  let startAngle = -Math.PI / 2  // start at 12 o'clock
  const slices = rows.map((row, i) => {
    const fraction = total > 0 ? row._val / total : 0
    const angle    = fraction * Math.PI * 2
    const endAngle = startAngle + angle
    const largeArc = angle > Math.PI ? 1 : 0
    const x1 = cx + rOuter * Math.cos(startAngle)
    const y1 = cy + rOuter * Math.sin(startAngle)
    const x2 = cx + rOuter * Math.cos(endAngle)
    const y2 = cy + rOuter * Math.sin(endAngle)
    const x3 = cx + rInner * Math.cos(endAngle)
    const y3 = cy + rInner * Math.sin(endAngle)
    const x4 = cx + rInner * Math.cos(startAngle)
    const y4 = cy + rInner * Math.sin(startAngle)
    const path = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`
    const color = MULTI_COLORS[i % MULTI_COLORS.length]
    startAngle = endAngle
    return { path, color, row, fraction }
  })

  const svgPaths = slices.map((s) =>
    `<path d="${s.path}" fill="${s.color}" stroke="rgba(0,0,0,0.15)" stroke-width="0.5" />`
  ).join('')

  const legendItems = slices.map((s, i) => {
    const mc = MULTI_COLORS[i % MULTI_COLORS.length]
    return `
    <div style="display:flex;align-items:center;gap:6px;font-size:11px;padding:3px 0;">
      <span style="width:8px;height:8px;border-radius:2px;background:${mc};flex-shrink:0;"></span>
      <span style="color:${mc};flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;">${escapeHtml(s.row._cat)}</span>
      <span style="color:${mc};font-weight:700;">${(s.fraction * 100).toFixed(0)}%</span>
    </div>
  `}).join('')

  const inner = `
    <div style="display: flex; flex-direction: column; height: 100%; padding-top: 6px;">
      <div style="
        font-size: 11px; font-weight: 600;
        color: ${t.textMuted};
        margin-bottom: 12px;
      ">
        ${escapeHtml(title)}
      </div>
      <div style="
        display: flex; align-items: center; gap: 16px;
        flex: 1; min-height: 0;
      ">
        <div style="flex-shrink:0;width:45%;max-width:220px;aspect-ratio:1;">
          <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            ${svgPaths}
          </svg>
        </div>
        <div style="flex: 1; min-width: 0; overflow: hidden;">
          ${legendItems || `<div style="color: ${t.textMuted}; font-size: 11px;">No data</div>`}
        </div>
      </div>
    </div>
  `
  return wrapCard(inner, { theme, accentColor: scheme.start })
}
