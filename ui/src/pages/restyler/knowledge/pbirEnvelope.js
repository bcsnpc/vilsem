/**
 * PBIR property-value envelope utilities.
 *
 * In PBIR, every property value in `visual.json` is wrapped in an
 * `expr.Literal.Value` envelope with a type-suffix scheme:
 *   - boolean  → "true" / "false"
 *   - integer  → "<n>L"     (e.g. "4L")
 *   - double   → "<n>D"     (e.g. "14D")
 *   - text     → "'<value>'" (single quotes inside)
 *   - dateTime → "datetime'YYYY-MM-DDTHH:mm:ss'"
 *   - null     → "null"
 *
 * Theme JSON uses plain scalars and a `solid.color` wrapper for fills.
 *
 * Sources:
 *   - Doc 2 (Microsoft Learn theming docs example: pillCornerRadius "4L")
 *   - Doc 3 (Deneb PBIR Implementation Guide envelope spec)
 *
 * Usage:
 *   wrapInt(8)        → { expr: { Literal: { Value: '8L' } } }
 *   wrapColor('#FFF') → { solid: { color: { expr: { Literal: { Value: "'#FFF'" } } } } }
 *   unwrap(expr)      → primitive
 *   themeToPbir(value, type)  / pbirToTheme(envelope, type)
 */

// ── Wrappers ─────────────────────────────────────────────────────────────────

export function wrapBool(value) {
  return { expr: { Literal: { Value: value ? 'true' : 'false' } } }
}

export function wrapInt(value) {
  const n = Math.round(Number(value))
  return { expr: { Literal: { Value: `${n}L` } } }
}

export function wrapDouble(value) {
  const n = Number(value)
  // Strip trailing zeros but keep at least one decimal-friendly form.
  const s = Number.isInteger(n) ? `${n}` : `${n}`
  return { expr: { Literal: { Value: `${s}D` } } }
}

export function wrapText(value) {
  // Single quotes wrap text inside the JSON string. Escape single quotes by doubling.
  const escaped = String(value).replace(/'/g, "''")
  return { expr: { Literal: { Value: `'${escaped}'` } } }
}

export function wrapDateTime(isoString) {
  // PBI expects "YYYY-MM-DDTHH:mm:ss" (no millis, no zone) inside datetime'...'
  const trimmed = String(isoString).replace(/\.\d{3}Z?$/, '').replace(/Z$/, '')
  return { expr: { Literal: { Value: `datetime'${trimmed}'` } } }
}

export function wrapNull() {
  return { expr: { Literal: { Value: 'null' } } }
}

/**
 * Wrap a hex color (with or without leading #) into a PBIR `solid.color` fill.
 * Theme-bound color refs use `ThemeDataColor` instead — see wrapThemeColor.
 */
export function wrapColor(hex) {
  const safe = String(hex).startsWith('#') ? hex : `#${hex}`
  return {
    solid: {
      color: { expr: { Literal: { Value: `'${safe.toUpperCase()}'` } } },
    },
  }
}

/**
 * Theme-bound color: references a slot in the report's data palette.
 * `colorId` is 1-indexed into `dataColors[]`. `percent` shifts hue (0 = base).
 */
export function wrapThemeColor(colorId, percent = 0) {
  return { expr: { ThemeDataColor: { ColorId: colorId, Percent: percent } } }
}

// ── Unwrappers ───────────────────────────────────────────────────────────────

/**
 * Unwrap a PBIR property value back to its primitive form.
 * Returns null if envelope shape is unrecognized.
 */
export function unwrap(envelope) {
  if (envelope == null) return null

  // solid.color wrapper
  if (envelope.solid?.color) return unwrap(envelope.solid.color)

  const v = envelope?.expr?.Literal?.Value
  if (typeof v !== 'string') {
    // ThemeDataColor reference
    if (envelope?.expr?.ThemeDataColor) {
      const t = envelope.expr.ThemeDataColor
      return { kind: 'themeColor', colorId: t.ColorId, percent: t.Percent || 0 }
    }
    return null
  }

  if (v === 'true')  return true
  if (v === 'false') return false
  if (v === 'null')  return null

  // Int suffix L
  const intMatch = v.match(/^(-?\d+)L$/)
  if (intMatch) return parseInt(intMatch[1], 10)

  // Double suffix D
  const doubleMatch = v.match(/^(-?\d+(?:\.\d+)?)D$/)
  if (doubleMatch) return parseFloat(doubleMatch[1])

  // Text 'value'
  if (v.startsWith("'") && v.endsWith("'")) {
    return v.slice(1, -1).replace(/''/g, "'")
  }

  // datetime'...'
  const dtMatch = v.match(/^datetime'([^']+)'$/)
  if (dtMatch) return dtMatch[1]

  return v
}

// ── Type-aware helpers ───────────────────────────────────────────────────────

/**
 * Wrap a value using the property's known type. Use for translating a plan's
 * plain JS values into PBIR envelopes when writing per-visual overrides.
 *
 *   themeToPbir(true, 'bool')      → { expr: { Literal: { Value: 'true' } } }
 *   themeToPbir(8, 'int')          → { expr: { Literal: { Value: '8L' } } }
 *   themeToPbir(14, 'double')      → { expr: { Literal: { Value: '14D' } } }
 *   themeToPbir('Inter', 'string') → { expr: { Literal: { Value: "'Inter'" } } }
 *   themeToPbir('#FFF', 'color')   → { solid: { color: { expr: ... } } }
 */
export function themeToPbir(value, type) {
  switch (type) {
    case 'bool':     return wrapBool(value)
    case 'int':      return wrapInt(value)
    case 'double':   return wrapDouble(value)
    case 'string':
    case 'enum':     return wrapText(value)
    case 'color':    return wrapColor(value)
    case 'datetime': return wrapDateTime(value)
    case 'null':     return wrapNull()
    default:        return wrapText(value)
  }
}

/**
 * Build a PBIR `properties` block from a plain object of { propName: { type, value } }.
 *
 *   buildPbirProperties({
 *     show:   { type: 'bool', value: true },
 *     radius: { type: 'int', value: 8 },
 *     color:  { type: 'color', value: '#E5E7EB' },
 *   })
 *   → { show: {...}, radius: {...}, color: {...} }
 */
export function buildPbirProperties(propMap) {
  const out = {}
  for (const [key, { type, value }] of Object.entries(propMap)) {
    out[key] = themeToPbir(value, type)
  }
  return out
}

/**
 * Wrap a card definition for `visual.objects` or `visual.visualContainerObjects`.
 * Returns the array structure PBIR expects: [{ properties: {...} }].
 *
 * If `selector` is provided (for per-series fills, $id state cards), it's
 * attached to the entry as `selector`.
 */
export function buildPbirCard(propMap, selector = null) {
  const entry = { properties: buildPbirProperties(propMap) }
  if (selector) entry.selector = selector
  return [entry]
}
