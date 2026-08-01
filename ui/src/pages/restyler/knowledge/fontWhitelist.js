/**
 * Power BI Service font rendering whitelist.
 *
 * The Service supports approximately 24 font families through its `wf_*` web-font
 * infrastructure. Anything outside this set falls back silently — community
 * testing confirms Times New Roman on iOS/Mac and Segoe UI on Windows/Service.
 *
 * Defaults (since 2024):
 *   - DIN (rendered as `wf_standard-font, helvetica, arial, sans-serif`)
 *     for visuals (titles, axis labels, data labels)
 *   - Segoe UI (`wf_segoe-ui_normal`) for application chrome
 *
 * For Service-safe restyling, prefer:
 *   - Segoe UI Semibold for titles and headers
 *   - Segoe UI for body / labels
 *   - DIN where numeric clarity matters
 *
 * For brand fonts NOT in this list (Inter, Manrope, IBM Plex Sans, etc.):
 *   - Will fall back silently in Service
 *   - Use ONLY via Deneb-rendered SVG text or HTML Content custom visuals
 *   - Or pre-render hero KPIs as PNG/SVG images
 *
 * Sources: Doc 3 research, Microsoft Learn font troubleshooting,
 *          Daniil Maslyuk on PowerOfBI ("CSS-style fallback chains DO work").
 */

// ── Service-safe font families (verified) ────────────────────────────────────

export const SERVICE_SAFE_FONTS = [
  'Arial',
  'Arial Black',
  'Arial Unicode MS',
  'Calibri',
  'Cambria',
  'Cambria Math',
  'Candara',
  'Comic Sans MS',
  'Consolas',
  'Constantia',
  'Corbel',
  'Courier New',
  'DIN',
  'Georgia',
  'Lucida Sans Unicode',
  'Segoe (Bold)',
  'Segoe UI',
  'Segoe UI Light',
  'Segoe UI Semibold',
  'Symbol',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
  'Wingdings',
]

const SAFE_SET = new Set(SERVICE_SAFE_FONTS.map(f => f.toLowerCase()))

export function isServiceSafe(fontFamily) {
  if (!fontFamily) return false
  // Allow CSS-style fallback chains — first family is what matters.
  const first = String(fontFamily).split(',')[0].trim().replace(/^['"]|['"]$/g, '')
  return SAFE_SET.has(first.toLowerCase())
}

// ── Recommended fallback chains ──────────────────────────────────────────────

/**
 * CSS-style fallback chains DO work in theme JSON. Always provide a fallback
 * to a Service-safe family so brand fonts gracefully degrade.
 */
export const FALLBACK_CHAINS = {
  // Microsoft default — most reliable
  default:           "'Segoe UI', wf_segoe-ui_normal, helvetica, arial, sans-serif",
  defaultSemibold:   "'Segoe UI Semibold', wf_segoe-ui_semibold, helvetica, arial, sans-serif",
  defaultBold:       "'Segoe UI Bold', wf_segoe-ui_bold, helvetica, arial, sans-serif",
  defaultLight:      "'Segoe UI Light', wf_segoe-ui_light, helvetica, arial, sans-serif",

  // Numeric — DIN renders cleanly for axis labels and KPI values
  numeric:           "DIN, wf_standard-font, helvetica, arial, sans-serif",

  // Editorial — Cambria for serif accents (lower confidence in Service)
  editorial:         "Cambria, Georgia, 'Times New Roman', serif",

  // Mono — Consolas for tabular numbers in dense tables
  mono:              "Consolas, 'Courier New', monospace",

  // Brand-with-fallback (use the NAMED brand family with safe fallback)
  brandWithSegoe:    (brandFont) => `'${brandFont}', 'Segoe UI', wf_segoe-ui_normal, helvetica, arial, sans-serif`,
}

// ── Recommended pairings for premium dashboards ──────────────────────────────

/**
 * Pairings that are reliable in Service. Each represents a complete typography
 * approach — title font + body font + numeric font.
 */
export const FONT_PAIRINGS = {
  microsoft_default: {
    label:   'Microsoft Default',
    description: 'DIN for numbers + Segoe UI for everything else. Closest to default PBI but tightened.',
    titles:  FALLBACK_CHAINS.defaultSemibold,
    body:    FALLBACK_CHAINS.default,
    numeric: FALLBACK_CHAINS.numeric,
  },
  modern_sans: {
    label:   'Modern Sans (recommended)',
    description: 'Segoe UI Semibold across titles + Segoe UI for body. Modern, agency-feel within Service constraints.',
    titles:  FALLBACK_CHAINS.defaultSemibold,
    body:    FALLBACK_CHAINS.default,
    numeric: FALLBACK_CHAINS.defaultSemibold,
  },
  editorial: {
    label:   'Editorial',
    description: 'Cambria titles + Segoe UI body. Lower confidence in Service rendering on non-Windows.',
    titles:  FALLBACK_CHAINS.editorial,
    body:    FALLBACK_CHAINS.default,
    numeric: FALLBACK_CHAINS.numeric,
  },
  numeric_focus: {
    label:   'Numeric Focus',
    description: 'DIN titles AND values. Strong for finance/analytics dashboards with heavy number readout.',
    titles:  FALLBACK_CHAINS.numeric,
    body:    FALLBACK_CHAINS.default,
    numeric: FALLBACK_CHAINS.numeric,
  },
}

// ── Brand font helpers ───────────────────────────────────────────────────────

/**
 * If the user supplies a brand font name not in the whitelist, build a chain
 * that requests the brand font but falls back to a safe family. This will:
 *   - Render in Desktop if the user has the font installed locally
 *   - Render in Service ONLY if Microsoft has whitelisted it (rare)
 *   - Otherwise fall back to Segoe UI silently (acceptable degradation)
 */
export function brandFontChain(brandFontName) {
  if (!brandFontName) return FALLBACK_CHAINS.default
  if (isServiceSafe(brandFontName)) {
    return `'${brandFontName}', ${FALLBACK_CHAINS.default}`
  }
  return FALLBACK_CHAINS.brandWithSegoe(brandFontName)
}

/**
 * Generate a structured warning when a non-Service-safe font is requested.
 * The UI should surface this so the user knows the limitation up front.
 */
export function fontRiskAssessment(fontFamily) {
  if (!fontFamily) return { risk: 'none', message: '' }
  const first = String(fontFamily).split(',')[0].trim().replace(/^['"]|['"]$/g, '')
  if (isServiceSafe(first)) {
    return { risk: 'none', font: first, message: 'Service-safe — renders reliably.' }
  }
  return {
    risk: 'high', font: first,
    message: `"${first}" is not in Power BI Service's font whitelist. It will render only on Desktop or for users with the font installed locally; Service viewers will see a fallback (Segoe UI on Windows, Times New Roman on Mac/iOS). Consider Segoe UI Semibold for an agency feel that's guaranteed to render.`,
  }
}
