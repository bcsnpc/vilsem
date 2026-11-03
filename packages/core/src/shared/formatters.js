// Number, axis-label, and grain-aware formatting helpers, plus scroll-threshold
// constants shared across bar/line visuals. Verbatim extract from
// AppSpecRenderer.jsx (pre-Phase-1).

export const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export const BAR_SCROLL_THRESHOLD = 10  // categories — above this, bar gets v-scroll
export const PX_PER_BAR_ROW       = 44  // inner canvas px per bar row

// Primary: detect grain from the grouped column name in the spec.
// Returns 'year' | 'month' | 'date' | null (null = unknown, fall back to values).
export function getAxisGrain(groupBy) {
  const col = String(groupBy?.column || '').toLowerCase()
  if (/\byear\b/.test(col))        return 'year'
  if (/\bmonth\b/.test(col))       return 'month'
  if (/\bdate\b|\bday\b/.test(col)) return 'date'
  return null
}

// Fallback: inspect actual _cat values to guess grain.
export function detectGrainFromValues(rows) {
  if (!rows?.length) return 'category'
  const samples = rows.slice(0, Math.min(rows.length, 5)).map(r => String(r._cat ?? '').trim())
  if (samples.every(s => /^\d{4}$/.test(s) && +s >= 1900 && +s <= 2100)) return 'year'
  if (samples.every(s => /^\d{4}-\d{2}-\d{2}/.test(s)))                   return 'date'
  if (samples.every(s => /^\d{4}[-/]\d{2}$/.test(s)))                      return 'month'
  return 'category'
}

// Combine: column name wins; fall back to value inspection.
export function resolveGrain(groupBy, rows) {
  return getAxisGrain(groupBy) || detectGrainFromValues(rows)
}

// Format a single axis label according to grain.
export function formatAxisLabel(value, grain) {
  const s = String(value ?? '').trim()
  if (grain === 'year') {
    const m = s.match(/^(\d{4})/)
    return m ? m[1] : s
  }
  if (grain === 'month') {
    const m = s.match(/^(\d{4})[-/](\d{2})/)
    if (m) return `${MONTH_NAMES[parseInt(m[2], 10) - 1] || m[2]} ${m[1]}`
    return s
  }
  if (grain === 'date') {
    const m = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/)
    if (m) {
      // Compact "Mon D 'YY" — keeps the day visible while disambiguating across years.
      // Year matters whenever a chart spans multiple years (common for line/area), and
      // the apostrophe form keeps each label short enough that ECharts hideOverlap
      // still has room to pick a reasonable subset of ticks.
      const monthName = MONTH_NAMES[parseInt(m[2], 10) - 1] || m[2]
      return `${monthName} ${parseInt(m[3], 10)} '${m[1].slice(2)}`
    }
    return s
  }
  return s
}

// Sort rows chronologically for time grains; preserve order for categories.
export function sortRowsForAxis(rows, grain) {
  if (grain === 'category' || !rows?.length) return rows
  return [...rows].sort((a, b) =>
    String(a._cat ?? '').localeCompare(String(b._cat ?? ''), undefined, { numeric: true })
  )
}

// Grain-aware scroll thresholds and per-point widths for line/area charts.
// date/day grain: scroll earlier (>6 points) and give each point more space.
// month grain: moderate scroll (>8 points), moderate per-point width.
// year/category: generous scroll (>10 points), compact per-point width.
export function getLineScrollParams(grain) {
  if (grain === 'date')  return { threshold: 6,  pxPerPoint: 80 }
  if (grain === 'month') return { threshold: 8,  pxPerPoint: 72 }
  return                        { threshold: 10, pxPerPoint: 64 }  // year / category
}

export function fmtVal(v, prefix, suffix) {
  if (v == null) return '—'
  let s
  if (Math.abs(v) >= 1e9)       s = (v / 1e9).toFixed(1) + 'B'
  else if (Math.abs(v) >= 1e6)  s = (v / 1e6).toFixed(1) + 'M'
  else if (Math.abs(v) >= 1e3)  s = (v / 1e3).toFixed(1) + 'k'
  else if (Number.isInteger(v)) s = v.toLocaleString()
  else                          s = parseFloat(v.toFixed(2)).toLocaleString()
  return `${prefix || ''}${s}${suffix || ''}`
}

export function fmtAxisNumber(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '--'
  // Whole-thousand rounding made adjacent ticks (1000, 1200) identical.
  // Significant digits also preserve tiny nonzero axes without long decimals.
  const compact = scale => Number((n / scale).toPrecision(6))
  if (Math.abs(n) >= 1e9) return `${compact(1e9)}B`
  if (Math.abs(n) >= 1e6) return `${compact(1e6)}M`
  if (Math.abs(n) >= 1e3) return `${compact(1e3)}k`
  return n.toLocaleString(undefined, { maximumSignificantDigits: 6 })
}

export function truncateAxisLabel(label, maxLen = 24) {
  const text = String(label || '')
  return text.length > maxLen ? `${text.slice(0, maxLen - 3)}...` : text
}
