// Color palettes used by Compact* visual components and card chrome.
// Verbatim extract from AppSpecRenderer.jsx (pre-Phase-1). A richer 12-scheme
// dataset lives in `../colorSchemes.ts` and is consumed by the PBI DAX path;
// unifying the two is out of scope for Phase 1 (zero behavior change rule).

export const PALETTES = {
  teal:   { start: '#14B8A6', mid: '#2DD4BF', text: '#14B8A6' },
  blue:   { start: '#3B82F6', mid: '#60A5FA', text: '#3B82F6' },
  gold:   { start: '#F59E0B', mid: '#FBBF24', text: '#F59E0B' },
  green:  { start: '#22C55E', mid: '#4ADE80', text: '#22C55E' },
  purple: { start: '#A855F7', mid: '#C084FC', text: '#A855F7' },
  violet: { start: '#8B5CF6', mid: '#A78BFA', text: '#8B5CF6' },
  rose:   { start: '#F43F5E', mid: '#FB7185', text: '#F43F5E' },
  red:    { start: '#EF4444', mid: '#F87171', text: '#EF4444' },
  orange: { start: '#F97316', mid: '#FB923C', text: '#F97316' },
  amber:  { start: '#F59E0B', mid: '#FCD34D', text: '#F59E0B' },
}

export const MULTI_COLORS = ['#14B8A6','#3B82F6','#A855F7','#F59E0B','#22C55E','#F43F5E']

// Detects a hex color string (3- or 6-digit) for custom color scheme support.
// User can set `colorScheme` to a literal hex like "#FF5733" instead of a
// preset name like "teal" — pal() then synthesizes a palette from the hex.
const HEX_RE = /^#([0-9a-fA-F]{3}){1,2}$/

function lighten(hex, amount = 0.18) {
  const [r, g, b] = hexToRgb(hex)
  const lift = (c) => Math.min(255, Math.round(c + (255 - c) * amount))
  return `#${[lift(r), lift(g), lift(b)].map(v => v.toString(16).padStart(2, '0')).join('')}`
}

function synthesizePalette(hex) {
  // Mirror the preset shape: { start, mid, text }. `mid` is a lightened variant
  // for gradients; `text` matches `start` so accent text stays in scheme colour.
  return { start: hex, mid: lighten(hex, 0.22), text: hex }
}

export function pal(scheme) {
  if (typeof scheme === 'string' && HEX_RE.test(scheme)) return synthesizePalette(scheme)
  return PALETTES[scheme] || PALETTES.teal
}
export function getColorValue(scheme) { return pal(scheme).start }

export function hexToRgb(hex) {
  const h = (hex || '').replace('#', '').padEnd(6, '0')
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) || 0)
}

// Override the alpha channel of any CSS color string (hex / rgb / rgba).
// Named colors are returned unchanged (can't introspect their channels).
export function withAlpha(color, alpha) {
  if (typeof color !== 'string') return color
  const a = Math.max(0, Math.min(1, Number(alpha)))
  if (!Number.isFinite(a)) return color
  const c = color.trim()
  if (c.startsWith('#')) {
    const [r, g, b] = hexToRgb(c)
    return `rgba(${r}, ${g}, ${b}, ${a})`
  }
  const m = c.match(/^rgba?\(([^)]+)\)$/i)
  if (m) {
    const [r, g, b] = m[1].split(',').map(s => s.trim())
    return `rgba(${r}, ${g}, ${b}, ${a})`
  }
  return color
}

// Resolve the grid-line color for a visual from its config + a theme fallback.
// `config.gridLinesColor` overrides the base color; `config.gridLinesOpacity`
// (0–1) overrides the alpha. Both are optional — with neither set, the theme
// fallback is returned unchanged (no behavior change).
export function gridLineColor(config, fallback) {
  const base = (config && config.gridLinesColor) || fallback
  const op = config && config.gridLinesOpacity
  return (op != null && op !== '') ? withAlpha(base, op) : base
}
