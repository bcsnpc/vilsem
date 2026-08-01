/**
 * AI Director — Rule-Based Plan Schema.
 *
 * The Director (LLM) produces plans in this shape. The styleApplier consumes
 * them. This is a STRICTER schema than the preset-based plan we had before:
 * each rule has a `match` clause and either `apply` directives or a `skip`
 * flag, plus a human-readable reason.
 *
 * Default behavior is CONSERVATIVE — visuals not matching any rule are left
 * alone. The Director must explicitly call out what to touch. This is the
 * opposite of the preset model (which mechanically rewrote everything).
 *
 * Why a rule engine instead of per-visualType writers:
 *   The Director can be SURGICAL — "elevate the KPI cards on the top row of
 *   page 1 ONLY", "leave the left nav rail alone", "recolor only the focal
 *   chart". Mechanical type-based dispatch can't do contextual decisions.
 */

// ── Plan shape (returned by Director, consumed by applier) ───────────────────

/**
 * @typedef {Object} RestyleDirectorPlan
 * @property {string} narrative      — Plain-English summary the user reads
 * @property {string} archetype      — Detected dashboard archetype id
 * @property {Object} globalDefaults — Theme-level defaults (accent, ramp, font)
 * @property {Rule[]} rules          — Ordered rule list; first match wins per visual
 * @property {string} [confidence]   — 'high' / 'medium' / 'low' — how sure the Director is
 */

/**
 * @typedef {Object} Rule
 * @property {string} id              — Stable identifier (e.g. "kpi_top_row")
 * @property {Match}  match           — Filter conditions
 * @property {Apply}  [apply]         — Style directives (XOR with skip)
 * @property {boolean}[skip]          — If true, this visual is left untouched
 * @property {string} reason          — Plain-English explanation
 */

/**
 * @typedef {Object} Match
 * @property {string|string[]} [visualType]  — Match by canonical type(s)
 * @property {string|string[]} [visualId]    — Match by exact id(s)
 * @property {string|string[]} [page]        — Match by page name(s)
 * @property {string|string[]} [pageId]      — Match by page id(s)
 * @property {number} [yMin]                  — Min y position (px)
 * @property {number} [yMax]                  — Max y position
 * @property {number} [xMin]                  — Min x position
 * @property {number} [xMax]                  — Max x position
 * @property {number} [widthMin]               — Min width
 * @property {number} [heightMin]              — Min height
 * @property {string} [fieldContains]         — Match if any field displayName contains this substring
 * @property {string} [titleContains]         — Match if title.text contains this substring
 * @property {string} [family]                — Match by family (cartesian | indicator | slicer | table)
 */

/**
 * @typedef {Object} Apply
 * @property {string}  [chrome]           — 'elevated' | 'flat_modern' | 'section_divider' | 'glass_dark'
 * @property {string}  [chromeMode]       — 'light' | 'dark' | inherit from globalDefaults
 * @property {number}  [heroSize]         — KPI hero font size (overrides preset default)
 * @property {boolean} [accentBar]        — Add brand accent bar at top of card
 * @property {boolean} [stripDataPointFills] — Remove per-visual dataPoint.fill so theme palette wins
 * @property {boolean} [useThemePalette]  — Force theme dataColors[] to cascade (alias of above)
 * @property {string}  [axisStyle]        — 'minimal' | 'standard' | 'gridless'
 * @property {boolean} [hideTitle]        — Hide the visual title entirely
 * @property {boolean} [hideLegend]       — Hide chart legend
 * @property {boolean} [hideAxes]         — Hide both axes
 * @property {boolean} [hideGridlines]    — Hide value-axis gridlines
 * @property {string}  [accentColor]      — Override accent for this visual specifically
 * @property {boolean} [hideHeader]       — Hide visual header (gear/pin/etc.)
 * @property {Object}  [propertyOverrides] — Free-form { card: { prop: value } } map for Director's discretion
 * @property {number}  [titleSize]        — Override title font size
 * @property {string}  [titleAlignment]   — 'Left' | 'Center' | 'Right'
 */

// ── Validation ───────────────────────────────────────────────────────────────

const VALID_CHROME    = ['elevated', 'flat_modern', 'section_divider', 'glass_dark']
const VALID_AXIS      = ['minimal', 'standard', 'gridless']
const VALID_FAMILY    = ['cartesian', 'indicator', 'slicer', 'table', 'partToWhole', 'point', 'shape', 'navigation']
const VALID_RAMP      = ['light', 'dark', 'warmLight']
const VALID_PAIRING   = ['microsoft_default', 'modern_sans', 'editorial', 'numeric_focus']

/**
 * Validate a plan returned from the Director. Returns { valid, errors, plan }.
 * Tries to be lenient — minor issues become warnings, not errors.
 * Critical issues (no rules, malformed structure) fail validation.
 */
export function validatePlan(plan) {
  const errors   = []
  const warnings = []

  if (!plan || typeof plan !== 'object')        return fail('plan is not an object')
  if (typeof plan.narrative !== 'string')       errors.push('plan.narrative must be a string')
  if (!Array.isArray(plan.rules))               return fail('plan.rules must be an array')
  if (plan.rules.length === 0)                  warnings.push('plan has no rules — applier will leave the report unchanged')

  if (plan.globalDefaults) {
    const g = plan.globalDefaults
    if (g.ramp        && !VALID_RAMP.includes(g.ramp))         warnings.push(`unknown ramp "${g.ramp}"`)
    if (g.fontPairing && !VALID_PAIRING.includes(g.fontPairing)) warnings.push(`unknown fontPairing "${g.fontPairing}"`)
    if (g.accent      && !/^#[0-9A-F]{3,8}$/i.test(g.accent))   warnings.push(`accent "${g.accent}" is not a valid hex color`)
  }

  for (let i = 0; i < plan.rules.length; i++) {
    const r = plan.rules[i]
    if (!r.id)             warnings.push(`rules[${i}]: missing id`)
    if (!r.match)          errors.push(`rules[${i}]: missing match clause`)
    if (!r.apply && !r.skip) errors.push(`rules[${i}]: must have apply or skip`)
    if (r.apply && r.skip)   errors.push(`rules[${i}]: cannot have both apply and skip`)
    if (r.apply?.chrome && !VALID_CHROME.includes(r.apply.chrome))
      warnings.push(`rules[${i}]: unknown chrome "${r.apply.chrome}"`)
    if (r.apply?.axisStyle && !VALID_AXIS.includes(r.apply.axisStyle))
      warnings.push(`rules[${i}]: unknown axisStyle "${r.apply.axisStyle}"`)
    if (r.match?.family && !VALID_FAMILY.includes(r.match.family))
      warnings.push(`rules[${i}]: unknown family "${r.match.family}"`)
    if (!r.reason || typeof r.reason !== 'string')
      warnings.push(`rules[${i}]: missing reason — every rule should explain WHY`)
  }

  return { valid: errors.length === 0, errors, warnings, plan }

  function fail(msg) {
    return { valid: false, errors: [msg], warnings, plan: null }
  }
}

// ── Rule matching engine (used by styleApplier) ──────────────────────────────

/**
 * Does this visual match this rule's match clause?
 *
 *   matchesRule(visual, rule.match)
 *
 * `visual` is a parsed visual from pbirParser (fields, position, visualType, etc.).
 * `match` is the rule's match clause.
 * Returns true if EVERY specified condition matches (AND semantics).
 */
export function matchesRule(visual, match, family) {
  if (!match) return false

  if (match.visualType) {
    const types = Array.isArray(match.visualType) ? match.visualType : [match.visualType]
    if (!types.includes(visual.visualType)) return false
  }
  if (match.visualId) {
    const ids = Array.isArray(match.visualId) ? match.visualId : [match.visualId]
    if (!ids.includes(visual.id)) return false
  }
  if (match.page) {
    const pages = Array.isArray(match.page) ? match.page : [match.page]
    if (!pages.includes(visual._pageName)) return false
  }
  if (match.pageId) {
    const ids = Array.isArray(match.pageId) ? match.pageId : [match.pageId]
    if (!ids.includes(visual._pageId)) return false
  }
  if (match.yMin !== undefined && (visual.position?.y || 0) < match.yMin) return false
  if (match.yMax !== undefined && (visual.position?.y || 0) > match.yMax) return false
  if (match.xMin !== undefined && (visual.position?.x || 0) < match.xMin) return false
  if (match.xMax !== undefined && (visual.position?.x || 0) > match.xMax) return false
  if (match.widthMin  !== undefined && (visual.position?.width  || 0) < match.widthMin)  return false
  if (match.heightMin !== undefined && (visual.position?.height || 0) < match.heightMin) return false
  if (match.family && family !== match.family) return false

  if (match.fieldContains) {
    const needle = String(match.fieldContains).toLowerCase()
    const haystack = JSON.stringify(visual.fields || {}).toLowerCase()
    if (!haystack.includes(needle)) return false
  }

  if (match.titleContains) {
    const titleText = visual.visualContainerObjects?.title?.[0]?.properties?.text?.expr?.Literal?.Value
    if (!titleText) return false
    const cleaned = String(titleText).replace(/^'|'$/g, '').toLowerCase()
    if (!cleaned.includes(String(match.titleContains).toLowerCase())) return false
  }

  return true
}

/**
 * Find the first matching rule for a visual. Rules are ordered — earliest
 * match wins. Returns null if no rule matches (visual is left untouched).
 */
export function findMatchingRule(visual, plan, familyOf) {
  if (!plan?.rules?.length) return null
  const family = familyOf?.(visual.visualType)
  for (const rule of plan.rules) {
    if (matchesRule(visual, rule.match, family)) return rule
  }
  return null
}

// ── A minimal sample plan (for testing the applier rule engine before LLM is wired) ──

export const SAMPLE_PLAN = {
  narrative: 'Detected executive sales dashboard. Elevating KPI cards, recoloring focal trend chart, leaving navigation buttons untouched.',
  archetype: 'executive_monitoring',
  confidence: 'high',
  globalDefaults: {
    ramp:        'dark',
    accent:      '#3B82F6',
    fontPairing: 'modern_sans',
    chromeMode:  'dark',
  },
  rules: [
    {
      id: 'skip_nav_buttons',
      match: { visualType: 'actionButton' },
      skip: true,
      reason: 'Left-edge action buttons are a navigation pattern — restyling them would break navigation visual feedback',
    },
    {
      id: 'skip_textboxes',
      match: { visualType: 'textbox' },
      skip: true,
      reason: 'Textboxes hold rich-text labels (e.g. "Selected Product:") that the user wrote intentionally',
    },
    {
      id: 'kpi_top_row',
      match: { visualType: ['card', 'cardVisual'], yMax: 200 },
      apply: { chrome: 'elevated', heroSize: 44, accentBar: true, hideHeader: true },
      reason: 'Top-row KPI cards get premium executive treatment — bigger heroes, brand accent bar, elevated chrome',
    },
    {
      id: 'gauge_treatment',
      match: { visualType: 'gauge' },
      apply: { chrome: 'elevated', hideHeader: true },
      reason: 'Gauges keep their internal axis/callout — just elevate their container',
    },
    {
      id: 'all_charts',
      match: { family: 'cartesian' },
      apply: { chrome: 'elevated', axisStyle: 'minimal', hideHeader: true },
      reason: 'Charts get minimal axis treatment — gridlines off, axis labels muted, value labels off unless density allows',
    },
    {
      id: 'donut_pie',
      match: { family: 'partToWhole' },
      apply: { chrome: 'elevated', hideHeader: true, stripDataPointFills: true },
      reason: 'Donut/pie charts have hardcoded fills from original; strip so theme palette cascades',
    },
    {
      id: 'tables',
      match: { family: 'table' },
      apply: { chrome: 'elevated', hideHeader: true },
      reason: 'Tables get banded rows + clean headers via theme; subtle elevated chrome ties them to the page',
    },
    {
      id: 'slicers',
      match: { family: 'slicer' },
      apply: { hideHeader: false },
      reason: 'Slicers keep their bottom-only outline + brand accent on selection (no card chrome — it conflicts with outline)',
    },
  ],
}
