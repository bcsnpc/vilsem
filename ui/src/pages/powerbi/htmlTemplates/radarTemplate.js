/**
 * Radar HTML template — hand-rolled SVG polygon on polar coords.
 * Mirrors CompactRadar from AppSpecRenderer.jsx:738 (Recharts-based there;
 * static SVG here).
 *
 * Layout:
 *   • Centered SVG with concentric polygons (25/50/75/100% rings)
 *   • Axis lines from center to each category vertex
 *   • Category labels at each vertex (9px)
 *   • Data polygon filled at 22% opacity with full-stroke outline
 */

import { getColorScheme, formatNumber, escapeHtml, normalizeRows, wrapCard, tooltipUid, svgTooltipContainer, svgElTooltipAttrs } from './shared.js'

function polarToXY(angleRad, radius, cx, cy) {
  // SVG coords: y grows downward. 0rad is right; subtract π/2 to put first point at top.
  const a = angleRad - Math.PI / 2
  return {
    x: cx + radius * Math.cos(a),
    y: cy + radius * Math.sin(a),
  }
}

export function renderRadarHtml(visual, queryResult, theme = 'dark') {
  const config  = visual.config || {}
  const scheme  = getColorScheme(config.colorScheme || visual.colorScheme)
  const title   = config.title || config.label || visual.title || ''
  const measures = visual.measures || visual.data?.measures || []

  const rawRows = normalizeRows(queryResult, visual.dimension, measures)
  const rows    = rawRows.filter((r) => r?._cat != null && r?._val != null).slice(0, 12)

  if (!rows.length) {
    return wrapCard(
      `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,0.3);font-size:11px;">No data</div>`,
      { theme, accentColor: scheme.start },
    )
  }

  // Geometry
  const W = 260, H = 220
  const cx = W / 2, cy = H / 2 + 4
  const maxR = Math.min(W, H) / 2 - 28
  const n    = rows.length
  const maxVal = Math.max(...rows.map((r) => Math.abs(r._val || 0)), 1)

  // Grid polygons at 0.25, 0.5, 0.75, 1.0 of maxR
  const gridLevels = [0.25, 0.5, 0.75, 1.0]
  const gridPaths  = gridLevels.map((lvl) => {
    const pts = Array.from({ length: n }, (_, i) => {
      const angle = (i / n) * 2 * Math.PI
      return polarToXY(angle, maxR * lvl, cx, cy)
    })
    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z'
    return `<path d="${d}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1" />`
  }).join('')

  // Axis spokes + category labels
  const spokes = rows.map((r, i) => {
    const angle = (i / n) * 2 * Math.PI
    const end   = polarToXY(angle, maxR, cx, cy)
    const lbl   = polarToXY(angle, maxR + 12, cx, cy)
    const anchor = Math.abs(end.x - cx) < 1 ? 'middle' : (end.x > cx ? 'start' : 'end')
    return `
      <line x1="${cx}" y1="${cy}" x2="${end.x.toFixed(1)}" y2="${end.y.toFixed(1)}" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
      <text x="${lbl.x.toFixed(1)}" y="${lbl.y.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle"
            font-family="Inter, sans-serif" font-size="9" fill="rgba(255,255,255,0.45)">
        ${escapeHtml(String(r._cat).slice(0, 12))}
      </text>
    `
  }).join('')

  // Data polygon
  const dataPts = rows.map((r, i) => {
    const angle = (i / n) * 2 * Math.PI
    const val   = Math.abs(r._val || 0)
    const ratio = val / maxVal
    return polarToXY(angle, maxR * ratio, cx, cy)
  })
  const dataPath = dataPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z'
  const uid = tooltipUid()
  const dataDots = dataPts.map((p, i) =>
    `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="${scheme.start}" ${svgElTooltipAttrs(uid, escapeHtml(String(rows[i]?._cat || '')), escapeHtml(measures[0] || 'Value'), escapeHtml(formatNumber(rows[i]?._val)), scheme.text || scheme.start)} />`
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
      <div style="flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center;">
        ${svgTooltipContainer(uid, `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width: 100%; height: 100%;">
          ${gridPaths}
          ${spokes}
          <path d="${dataPath}" fill="${scheme.start}" fill-opacity="0.22" stroke="${scheme.start}" stroke-width="1.5" />
          ${dataDots}
        </svg>`)}
      </div>
    </div>
  `
  return wrapCard(inner, { theme, accentColor: scheme.start })
}
