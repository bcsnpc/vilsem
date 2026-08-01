/**
 * Gauge HTML template — mirrors CompactGauge from AppSpecRenderer.jsx:714.
 *
 * Inline SVG semicircular arc:
 *   • Radius 46, centered at (60, 62) inside a 120x90 viewBox
 *   • Track arc: -140° to +140° (280° total sweep)
 *   • Value arc: -140° to -140° + (pct * 280°)
 *   • Stroke width 10, rounded caps
 *   • Value text: centered in the gauge, size 15, weight 800
 *
 * HTML Content sandbox allows inline SVG — no script needed.
 */

import { getColorScheme, formatNumber, escapeHtml, getScalarValue, wrapCard } from './shared.js'

function toXY(deg, cx, cy, r) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(startDeg, endDeg, cx, cy, r) {
  // CompactGauge's helper: toXY takes (deg - 90) inside. Here we pass the
  // already-shifted angles (matching CompactGauge's `arc(s, e)` which calls
  // `toXY(s - 90)` and `toXY(e - 90)`).
  const a   = toXY(startDeg - 90, cx, cy, r)
  const b   = toXY(endDeg   - 90, cx, cy, r)
  const lg  = (endDeg - startDeg) > 180 ? 1 : 0
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${lg} 1 ${b.x} ${b.y}`
}

export function renderGaugeHtml(visual, queryResult, theme = 'dark') {
  const config  = visual.config || {}
  const scheme  = getColorScheme(config.colorScheme || visual.colorScheme)
  const measure = visual.measures?.[0] || visual.data?.measures?.[0] || ''
  const val     = getScalarValue(queryResult, measure)
  const min     = config.minValue ?? 0
  const max     = config.maxValue ?? 100
  const pct     = val != null ? Math.max(0, Math.min((val - min) / (max - min), 1)) : 0

  const cx = 60, cy = 62, r = 46
  const trackPath = arcPath(-140, 140, cx, cy, r)
  const valuePath = arcPath(-140, -140 + pct * 280, cx, cy, r)

  const title     = config.title || config.label || ''
  const prefix    = config.prefix || ''
  const suffix    = config.suffix || ''
  const valueText = val != null ? `${prefix}${formatNumber(val)}${suffix}` : '—'

  const inner = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
    ">
      ${title ? `
        <div style="
          font-size: 11px;
          font-weight: 600;
          color: rgba(255,255,255,0.65);
          margin-bottom: 4px;
          flex-shrink: 0;
        ">
          ${escapeHtml(title)}
        </div>
      ` : ''}
      <svg width="120" height="108" viewBox="0 0 120 108" style="overflow: visible;">
        <path d="${trackPath}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="10" stroke-linecap="round" />
        ${val != null ? `<path d="${valuePath}" fill="none" stroke="${scheme.start}" stroke-width="10" stroke-linecap="round" />` : ''}
        <text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="${scheme.text || scheme.start}" font-size="15" font-weight="800">${escapeHtml(valueText)}</text>
      </svg>
    </div>
  `
  return wrapCard(inner, { theme, accentColor: scheme.start })
}
