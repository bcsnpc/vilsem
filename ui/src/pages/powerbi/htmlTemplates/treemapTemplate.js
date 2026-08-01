/**
 * Treemap HTML template — mirrors CompactTreemap from AppSpecRenderer.jsx:786.
 *
 * Uses a slice-and-dice layout (simpler than squarified, still visually
 * effective for the 5-20 item range typical in dashboards). Largest items
 * get larger rectangles. Alternates horizontal/vertical slicing at each
 * level for balance.
 *
 * Each cell:
 *   • Rect with scheme.start fill, opacity 0.8 (cells > 20x14), 0.6 otherwise
 *   • Dark stroke hairline between cells
 *   • Label inside cell if cell is large enough to fit (>= 50x20)
 */

import { getColorScheme, formatNumber, escapeHtml, normalizeRows, wrapCard, tooltipUid, svgTooltipContainer, svgElTooltipAttrs } from './shared.js'

/**
 * Simple treemap layout — slice alternately.
 * Input: { items: [{name, value}], x, y, w, h }
 * Output: [{ name, value, x, y, w, h }]
 */
function layoutSliceAndDice(items, x, y, w, h, horizontal = true) {
  if (items.length === 0) return []
  if (items.length === 1) {
    return [{ ...items[0], x, y, w, h }]
  }

  // Split items in half by total value
  const totalVal = items.reduce((s, it) => s + it.value, 0)
  if (totalVal <= 0) {
    // Equal split if no meaningful values
    const mid = Math.floor(items.length / 2)
    const firstHalf  = items.slice(0, mid)
    const secondHalf = items.slice(mid)
    if (horizontal) {
      const w1 = w / 2
      return [
        ...layoutSliceAndDice(firstHalf,  x,      y, w1, h, false),
        ...layoutSliceAndDice(secondHalf, x + w1, y, w - w1, h, false),
      ]
    } else {
      const h1 = h / 2
      return [
        ...layoutSliceAndDice(firstHalf,  x, y,      w, h1,     true),
        ...layoutSliceAndDice(secondHalf, x, y + h1, w, h - h1, true),
      ]
    }
  }

  // Accumulate until we pass half the total
  let acc = 0
  const target = totalVal / 2
  let splitIdx = 1
  for (let i = 0; i < items.length; i++) {
    acc += items[i].value
    if (acc >= target) { splitIdx = Math.max(1, i + 1); break }
  }
  const firstHalf  = items.slice(0, splitIdx)
  const secondHalf = items.slice(splitIdx)
  const firstVal   = firstHalf.reduce((s, it) => s + it.value, 0)
  const firstRatio = firstVal / totalVal

  if (horizontal) {
    const w1 = Math.max(1, w * firstRatio)
    return [
      ...layoutSliceAndDice(firstHalf,  x,      y, w1,      h, false),
      ...layoutSliceAndDice(secondHalf, x + w1, y, w - w1,  h, false),
    ]
  } else {
    const h1 = Math.max(1, h * firstRatio)
    return [
      ...layoutSliceAndDice(firstHalf,  x, y,      w, h1,     true),
      ...layoutSliceAndDice(secondHalf, x, y + h1, w, h - h1, true),
    ]
  }
}

export function renderTreemapHtml(visual, queryResult, theme = 'dark') {
  const config   = visual.config || {}
  const scheme   = getColorScheme(config.colorScheme || visual.colorScheme)
  const title    = config.title || config.label || visual.title || ''
  const measures = visual.measures || visual.data?.measures || []

  const rawRows = normalizeRows(queryResult, visual.dimension, measures)
  const items   = rawRows
    .filter((r) => r?._cat != null && r?._val != null)
    .map((r) => ({ name: String(r._cat), value: Math.abs(Number(r._val) || 0) }))
    .filter((it) => it.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 30)

  if (!items.length) {
    return wrapCard(
      `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,0.3);font-size:11px;">No data</div>`,
      { theme, accentColor: scheme.start },
    )
  }

  const uid = tooltipUid()
  const W = 400, H = 200
  const cells = layoutSliceAndDice(items, 0, 0, W, H, true)

  const maxVal = items[0].value
  const svgCells = cells.map((c) => {
    const opacity = c.w > 20 && c.h > 14 ? 0.8 : 0.6
    // Cell color: gradient based on value (darker for smaller values)
    const valueRatio = c.value / maxVal
    const fillOp = 0.35 + valueRatio * 0.55

    const showLabel = c.w >= 50 && c.h >= 20
    const labelMaxChars = Math.floor(c.w / 7)
    const displayName = c.name.length > labelMaxChars ? c.name.slice(0, labelMaxChars - 1) + '…' : c.name

    return `
      <g>
        <rect x="${c.x.toFixed(1)}" y="${c.y.toFixed(1)}" width="${c.w.toFixed(1)}" height="${c.h.toFixed(1)}"
              fill="${scheme.start}" fill-opacity="${fillOp.toFixed(2)}"
              stroke="rgba(0,0,0,0.3)" stroke-width="1"
              ${svgElTooltipAttrs(uid, escapeHtml(c.name), escapeHtml(measures[0] || 'Value'), escapeHtml(formatNumber(c.value)), scheme.text || scheme.start)} />
        ${showLabel ? `
          <text x="${(c.x + 6).toFixed(1)}" y="${(c.y + 14).toFixed(1)}"
                font-family="Inter, sans-serif" font-size="10" font-weight="600"
                fill="rgba(255,255,255,0.92)">
            ${escapeHtml(displayName)}
          </text>
          ${c.h >= 32 ? `
            <text x="${(c.x + 6).toFixed(1)}" y="${(c.y + 28).toFixed(1)}"
                  font-family="Inter, sans-serif" font-size="9"
                  fill="rgba(255,255,255,0.65)">
              ${escapeHtml(formatNumber(c.value))}
            </text>
          ` : ''}
        ` : ''}
      </g>
    `
  }).join('')

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
        ${svgTooltipContainer(uid, `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width: 100%; height: 100%; display: block;">
          ${svgCells}
        </svg>`)}
      </div>
    </div>
  `
  return wrapCard(inner, { theme, accentColor: scheme.start })
}
