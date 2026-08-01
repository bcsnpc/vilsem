/**
 * Design audit rules — the engine that scores a parsed report on design
 * quality and recommends fixes. Each rule is a pure function that takes the
 * parsed report and returns 0..N issue records.
 *
 * Rule structure:
 *   {
 *     id:          'TYPO-1',                // stable identifier
 *     category:    'typography',            // typography | color | layout | chrome | hierarchy
 *     severity:    'high' | 'med' | 'low',
 *     label:       'Font family drift',
 *     describe:    'Multiple font families across visuals'
 *     check:       (parsed) => issues[],    // returns 0..N detected issues
 *     fix:         (issue, plan) => plan,   // mutates the design plan to fix
 *   }
 *
 * The `check` function returns an array of issue records:
 *   { ruleId, severity, location, detail, fixDescription }
 *
 * Sources: Doc 1 + Doc 3 design-rules sections, WCAG 2.1, Cole Nussbaumer
 *          ("Storytelling with Data"), IBM Carbon dashboard guidelines.
 */

import { contrastRatio } from './colorTheory.js'
import { isOnGrid, GRID_UNIT, KPI_ROW_RULES } from './spacing.js'
import { isServiceSafe } from './fontWhitelist.js'
import { COLOR_DISCIPLINE } from './colorTheory.js'
import { canonicalize, familyOf } from './visualTypeMap.js'
import { unwrap } from './pbirEnvelope.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

function collectAllVisuals(parsed) {
  const out = []
  for (const page of parsed.pages || []) {
    for (const v of page.visuals || []) {
      out.push({ ...v, _pageName: page.name, _pageId: page.id })
    }
  }
  return out
}

/**
 * Read a PBIR property and unwrap the envelope to its primitive value.
 * Returns null if the property is missing OR wrapping is unrecognized.
 *
 * `cardName` is the formatting card (title, background, border, ...).
 * `propName` is the property inside that card (fontFamily, color, ...).
 * `isChrome` controls whether we read from `visualContainerObjects` (chrome)
 * or `objects` (data-bound).
 */
function readProp(visual, cardName, propName, isChrome = false) {
  const bag = isChrome ? visual.visualContainerObjects : visual.objects
  const envelope = bag?.[cardName]?.[0]?.properties?.[propName]
  if (envelope == null) return null
  return unwrap(envelope)
}

/**
 * Normalize a font family string: strip quotes, take first family from
 * a CSS-style fallback chain, return lowercase for set membership.
 */
function normalizeFontName(raw) {
  if (raw == null) return null
  return String(raw).split(',')[0].trim().replace(/^['"]|['"]$/g, '')
}

function isFloatNearGrid(n, unit = GRID_UNIT, tolerance = 1) {
  if (n == null || !Number.isFinite(n)) return true
  const mod = ((n % unit) + unit) % unit
  return Math.min(mod, unit - mod) <= tolerance
}

function positionOnGrid(pos, unit = GRID_UNIT, tolerance = 1) {
  for (const k of ['x', 'y', 'width', 'height']) {
    if (pos[k] != null && !isFloatNearGrid(pos[k], unit, tolerance)) return false
  }
  return true
}

// ── Typography rules ─────────────────────────────────────────────────────────

const TYPO_1 = {
  id:       'TYPO-1',
  category: 'typography',
  severity: 'med',
  label:    'Typography font drift',
  describe: 'Premium dashboards use 1–2 font families across all visuals. Default reports often mix 4+ inherited from the base theme.',

  check(parsed) {
    const families = new Set()
    const visuals  = collectAllVisuals(parsed)
    for (const v of visuals) {
      const sources = [
        readProp(v, 'title', 'fontFamily', true),
        readProp(v, 'categoryAxis', 'fontFamily', false),
        readProp(v, 'valueAxis', 'fontFamily', false),
        readProp(v, 'labels', 'fontFamily', false),
        readProp(v, 'legend', 'fontFamily', false),
        readProp(v, 'columnHeaders', 'fontFamily', false),
        readProp(v, 'values', 'fontFamily', false),
        readProp(v, 'header', 'fontFamily', false),
        readProp(v, 'items', 'fontFamily', false),
      ]
      for (const f of sources) {
        const name = normalizeFontName(f)
        if (name) families.add(name)
      }
    }
    if (families.size > 2) {
      const list = [...families].slice(0, 8).join(', ')
      const more = families.size > 8 ? `, +${families.size - 8} more` : ''
      return [{
        ruleId:   'TYPO-1',
        severity: families.size > 4 ? 'med' : 'low',
        location: 'report.theme + visualStyles',
        detail:   `${families.size} distinct font families used: ${list}${more}`,
        fixDescription: 'Force a single font family via textClasses + visualStyles wildcards',
      }]
    }
    return []
  },
}

const TYPO_2 = {
  id:       'TYPO-2',
  category: 'typography',
  severity: 'med',
  label:    'Font size drift',
  describe: 'Premium scales use ≤5 distinct sizes. Default reports often have 8+ different sizes from inherited defaults.',

  check(parsed) {
    const sizes = new Set()
    for (const v of collectAllVisuals(parsed)) {
      for (const card of ['title', 'subTitle']) {
        const raw = readProp(v, card, 'fontSize', true)
        const n = Number(raw)
        if (Number.isFinite(n) && n > 0) sizes.add(Math.round(n))
      }
      for (const card of ['categoryAxis', 'valueAxis', 'labels', 'legend', 'columnHeaders', 'values', 'header', 'items']) {
        const raw = readProp(v, card, 'fontSize', false) ?? readProp(v, card, 'textSize', false)
        const n = Number(raw)
        if (Number.isFinite(n) && n > 0) sizes.add(Math.round(n))
      }
    }
    if (sizes.size > 5) {
      return [{
        ruleId:   'TYPO-2',
        severity: 'med',
        location: 'visualStyles fontSize',
        detail:   `${sizes.size} distinct font sizes used: ${[...sizes].sort((a, b) => a - b).join(', ')}px`,
        fixDescription: 'Apply a Major Third (1.25x) typographic scale: 10/11/13/16/22',
      }]
    }
    return []
  },
}

const TYPO_3 = {
  id:       'TYPO-3',
  category: 'typography',
  severity: 'low',
  label:    'Non-Service-safe fonts in use',
  describe: 'Custom fonts not on Power BI Service\'s whitelist will fall back silently for cloud viewers.',

  check(parsed) {
    const issues = []
    const seen = new Set()
    for (const v of collectAllVisuals(parsed)) {
      const lookups = [
        ['title',         true],
        ['categoryAxis',  false],
        ['valueAxis',     false],
        ['labels',        false],
        ['legend',        false],
        ['columnHeaders', false],
        ['values',        false],
        ['header',        false],
        ['items',         false],
      ]
      for (const [card, isChrome] of lookups) {
        const raw = readProp(v, card, 'fontFamily', isChrome)
        const first = normalizeFontName(raw)
        if (!first) continue
        if (!isServiceSafe(first) && !seen.has(first)) {
          seen.add(first)
          issues.push({
            ruleId:   'TYPO-3',
            severity: 'low',
            location: `${v.id || 'visual'} / ${card}.fontFamily`,
            detail:   `Font "${first}" is not in Service whitelist — will fall back`,
            fixDescription: 'Add a Service-safe fallback chain or switch to Segoe UI Semibold',
          })
        }
      }
    }
    return issues
  },
}

// ── Color rules ──────────────────────────────────────────────────────────────

const COLOR_1 = {
  id:       'COLOR-1',
  category: 'color',
  severity: 'med',
  label:    'Categorical color noise',
  describe: 'Premium charts use ≤5 categorical colors. More creates visual noise without aiding interpretation.',

  check(parsed) {
    const colors = new Set()
    for (const v of collectAllVisuals(parsed)) {
      // Per-series fills under dataPoint
      const dpBag = v.objects?.dataPoint
      if (Array.isArray(dpBag)) {
        for (const entry of dpBag) {
          const fill = entry?.properties?.fill || entry?.properties?.defaultColor
          if (!fill) continue
          // PBIR fills are { solid: { color: { expr: { Literal: { Value: "'#HEX'" }}}}}
          const value = unwrap(fill)
          if (typeof value === 'string') colors.add(value.toUpperCase())
        }
      }
    }
    if (colors.size > COLOR_DISCIPLINE.maxCategoricalSeries + 2) {
      const list = [...colors].slice(0, 6).join(', ')
      const more = colors.size > 6 ? `, +${colors.size - 6} more` : ''
      return [{
        ruleId:   'COLOR-1',
        severity: 'med',
        location: 'dataPoint fills across visuals',
        detail:   `${colors.size} distinct categorical fill colors: ${list}${more}`,
        fixDescription: 'Curate a 5-color dataColors palette and let theme cascade. Top-3 use accent; rest go neutral.',
      }]
    }
    return []
  },
}

const COLOR_2 = {
  id:       'COLOR-2',
  category: 'color',
  severity: 'high',
  label:    'Title contrast below WCAG AA',
  describe: 'Title text contrast ratio below 4.5:1 against the visual background fails accessibility (WCAG AA).',

  check(parsed) {
    const issues = []
    for (const v of collectAllVisuals(parsed)) {
      const titleHex = unwrap(readProp(v, 'title', 'fontColor', true))
      const bgHex    = unwrap(readProp(v, 'background', 'color', true))
      if (typeof titleHex !== 'string' || typeof bgHex !== 'string') continue
      if (!/^#[0-9A-F]{3,8}$/i.test(titleHex) || !/^#[0-9A-F]{3,8}$/i.test(bgHex)) continue
      try {
        const ratio = contrastRatio(titleHex, bgHex)
        if (ratio < 4.5) {
          issues.push({
            ruleId:   'COLOR-2',
            severity: 'high',
            location: `${v.id || 'visual'} title vs background`,
            detail:   `Contrast ${ratio.toFixed(1)}:1 (need 4.5:1) — ${titleHex} on ${bgHex}`,
            fixDescription: 'Use firstLevelElements color from structural ramp matched to chosen mode',
          })
        }
      } catch { /* ignore parse errors */ }
    }
    return issues
  },
}

// ── Layout rules ─────────────────────────────────────────────────────────────

const LAYOUT_1 = {
  id:       'LAYOUT-1',
  category: 'layout',
  severity: 'med',
  label:    'Visuals not on 8pt grid',
  describe: 'Premium dashboards align all visual positions to a consistent grid (typically 8px). Off-grid visuals create the "default PBI" ragged feel.',

  check(parsed) {
    const visuals = collectAllVisuals(parsed)
    if (!visuals.length) return []
    // Allow ±1px tolerance — legacy positions are floats, not strict integers
    const offGrid = visuals.filter(v => !positionOnGrid(v.position || {}, GRID_UNIT, 1))
    if (offGrid.length === 0) return []
    // Only fire if MORE than 25% of visuals are off — reports with a few one-off
    // misalignments shouldn't get a high-severity hit.
    if (offGrid.length / visuals.length < 0.25) {
      return [{
        ruleId:   'LAYOUT-1',
        severity: 'low',
        location: `${offGrid.length} of ${visuals.length} visuals`,
        detail:   `${offGrid.length} visuals slightly off the ${GRID_UNIT}px grid (>1px deviation)`,
        fixDescription: `Snap to nearest ${GRID_UNIT}px multiple via layoutNormalizer`,
      }]
    }
    return [{
      ruleId:   'LAYOUT-1',
      severity: offGrid.length > visuals.length * 0.66 ? 'high' : 'med',
      location: `${offGrid.length} of ${visuals.length} visuals`,
      detail:   `${offGrid.length} visuals not aligned to ${GRID_UNIT}px grid`,
      fixDescription: `Snap all positions to nearest ${GRID_UNIT}px multiple via layoutNormalizer`,
    }]
  },
}

const LAYOUT_2 = {
  id:       'LAYOUT-2',
  category: 'layout',
  severity: 'med',
  label:    'KPI row height mismatch',
  describe: 'Cards on the same horizontal row should have identical heights for clean visual rhythm.',

  check(parsed) {
    const issues = []
    for (const page of parsed.pages || []) {
      const kpis = (page.visuals || []).filter(v => {
        const t = canonicalize(v.visualType)
        return ['card', 'cardVisual', 'kpi', 'multiRowCard'].includes(t)
      })
      if (kpis.length < 2) continue
      // Group by approximate y
      const rows = {}
      for (const k of kpis) {
        const yKey = Math.round((k.position?.y || 0) / KPI_ROW_RULES.yToleranceForRowDetect) * KPI_ROW_RULES.yToleranceForRowDetect
        if (!rows[yKey]) rows[yKey] = []
        rows[yKey].push(k)
      }
      for (const [y, group] of Object.entries(rows)) {
        if (group.length < 2) continue
        const heights = group.map(g => g.position?.height || 0)
        const min = Math.min(...heights), max = Math.max(...heights)
        if (max - min > 4) {
          issues.push({
            ruleId:   'LAYOUT-2',
            severity: 'med',
            location: `${page.name || 'page'} / KPI row at y=${y}`,
            detail:   `${group.length} KPI cards with heights ${heights.join(', ')}px`,
            fixDescription: `Equalize to recommended height ${KPI_ROW_RULES.recommendedHeight}px`,
          })
        }
      }
    }
    return issues
  },
}

const LAYOUT_3 = {
  id:       'LAYOUT-3',
  category: 'layout',
  severity: 'high',
  label:    'Overlapping visuals',
  describe: 'Visuals that overlap in screen space create rendering artifacts and indicate broken layout.',

  check(parsed) {
    const issues = []
    for (const page of parsed.pages || []) {
      // Skip shape/image/textbox visuals — common pattern is "card sits on background shape"
      const vs = (page.visuals || []).filter(v => {
        const fam = familyOf(canonicalize(v.visualType))
        return fam !== 'shape' && fam !== 'navigation'
      })
      const overlapPairs = []
      for (let i = 0; i < vs.length; i++) {
        for (let j = i + 1; j < vs.length; j++) {
          const a = vs[i].position, b = vs[j].position
          if (!a || !b) continue
          if (rectsOverlap(a, b, 4)) {
            overlapPairs.push([vs[i].id || `v${i}`, vs[j].id || `v${j}`])
          }
        }
      }
      if (!overlapPairs.length) continue
      // Dedupe — fire once per page with a count
      const sample = overlapPairs.slice(0, 3).map(p => `${p[0]} ⇄ ${p[1]}`).join('; ')
      issues.push({
        ruleId:   'LAYOUT-3',
        severity: overlapPairs.length > 5 ? 'high' : 'med',
        location: `${page.name || 'page'}: ${overlapPairs.length} overlap${overlapPairs.length === 1 ? '' : 's'}`,
        detail:   overlapPairs.length === 1
          ? `Visuals overlap: ${sample}`
          : `${overlapPairs.length} pairs of visuals overlap (e.g. ${sample})`,
        fixDescription: 'Re-position overlapping visuals; consider redistributing canvas',
      })
    }
    return issues
  },
}

function rectsOverlap(a, b, tolerance = 0) {
  const ax2 = a.x + a.width,  ay2 = a.y + a.height
  const bx2 = b.x + b.width,  by2 = b.y + b.height
  return !(ax2 - tolerance <= b.x || bx2 - tolerance <= a.x ||
           ay2 - tolerance <= b.y || by2 - tolerance <= a.y)
}

// ── Chrome rules ─────────────────────────────────────────────────────────────

const CHROME_1 = {
  id:       'CHROME-1',
  category: 'chrome',
  severity: 'low',
  label:    'Inconsistent border treatment',
  describe: 'Mixed border styles across visuals of the same type creates visual noise.',

  check(parsed) {
    const styles = {}
    for (const v of collectAllVisuals(parsed)) {
      const fam = familyOf(canonicalize(v.visualType))
      if (fam === 'shape' || fam === 'navigation') continue
      const show   = unwrap(readProp(v, 'border', 'show',   true))
      const radius = unwrap(readProp(v, 'border', 'radius', true))
      const weight = unwrap(readProp(v, 'border', 'weight', true))
      // Distinct signature per family
      const sig = `${show ?? 'na'}|r${radius ?? 0}|w${weight ?? 0}`
      styles[fam] = styles[fam] || new Set()
      styles[fam].add(sig)
    }
    const issues = []
    for (const [fam, set] of Object.entries(styles)) {
      if (set.size > 2) {
        issues.push({
          ruleId:   'CHROME-1',
          severity: 'low',
          location: `${fam} family`,
          detail:   `${set.size} distinct border treatments used across ${fam} visuals`,
          fixDescription: 'Apply one chrome preset (Flat Modern / Elevated / Section / Glass) consistently',
        })
      }
    }
    return issues
  },
}

const CHROME_2 = {
  id:       'CHROME-2',
  category: 'chrome',
  severity: 'low',
  label:    'Visuals without explicit background',
  describe: 'Default-transparent visual containers blend into the page wallpaper inconsistently.',

  check(parsed) {
    const visuals = collectAllVisuals(parsed).filter(v => {
      const fam = familyOf(canonicalize(v.visualType))
      return fam !== 'shape' && fam !== 'navigation' && fam !== 'slicer'
    })
    if (!visuals.length) return []
    const noBg = visuals.filter(v => {
      const show = unwrap(readProp(v, 'background', 'show', true))
      return show !== true
    })
    if (noBg.length === 0 || noBg.length === visuals.length) return []
    return [{
      ruleId:   'CHROME-2',
      severity: 'low',
      location: `${noBg.length} of ${visuals.length} visuals`,
      detail:   `${noBg.length} visuals have no explicit background — relying on page wallpaper`,
      fixDescription: 'Apply consistent background fill via theme visualStyles wildcard',
    }]
  },
}

// ── Hierarchy rules ──────────────────────────────────────────────────────────

const HIERARCHY_1 = {
  id:       'HIERARCHY-1',
  category: 'hierarchy',
  severity: 'low',
  label:    'No KPI cards on top row',
  describe: 'Premium executive dashboards lead with 3-5 KPI cards in a top row to anchor the eye.',

  check(parsed) {
    for (const page of parsed.pages || []) {
      const visuals = page.visuals || []
      if (visuals.length < 4) continue   // small pages exempt
      const sortedByY = [...visuals].sort((a, b) => (a.position?.y || 0) - (b.position?.y || 0))
      const topRow = sortedByY.filter(v => Math.abs((v.position?.y || 0) - (sortedByY[0].position?.y || 0)) < 32)
      const kpiTopRow = topRow.filter(v => {
        const t = canonicalize(v.visualType)
        return ['card', 'cardVisual', 'kpi', 'multiRowCard'].includes(t)
      })
      if (kpiTopRow.length < 2 && topRow.length > 1) {
        return [{
          ruleId:   'HIERARCHY-1',
          severity: 'low',
          location: page.name || 'page',
          detail:   'Top row has no KPI/card visuals — eye lacks an anchor',
          fixDescription: 'Consider promoting key metrics to KPI cards on the top row',
        }]
      }
    }
    return []
  },
}

// ── Title rules ──────────────────────────────────────────────────────────────

const TITLE_1 = {
  id:       'TITLE-1',
  category: 'typography',
  severity: 'low',
  label:    'Redundant title text',
  describe: 'Cards with a title that exactly matches the displayed measure name add noise without information.',

  check(parsed) {
    const issues = []
    for (const v of collectAllVisuals(parsed)) {
      const t = canonicalize(v.visualType)
      if (!['card', 'cardVisual', 'kpi'].includes(t)) continue
      const titleText = unwrap(readProp(v, 'title', 'text', true))
      if (typeof titleText !== 'string' || !titleText.trim()) continue
      const measureNames = (v.fields?.Values || v.fields?.values || []).map(f => f.displayName || f.measure || f.column).filter(Boolean)
      if (measureNames.length === 1 && titleText.toLowerCase().trim() === String(measureNames[0]).toLowerCase().trim()) {
        issues.push({
          ruleId:   'TITLE-1',
          severity: 'low',
          location: v.id || 'visual',
          detail:   `Title "${titleText}" duplicates the measure name`,
          fixDescription: 'Replace title with descriptive context or hide; let the measure value speak',
        })
      }
    }
    return issues
  },
}

// ── Visual-header (gear icon) rules ──────────────────────────────────────────

const HEADER_1 = {
  id:       'HEADER-1',
  category: 'chrome',
  severity: 'low',
  label:    'Visible visual headers in published reports',
  describe: 'The visual header gear icons are useful in Desktop edit mode but clutter published reports.',

  check(parsed) {
    let count = 0, total = 0
    for (const v of collectAllVisuals(parsed)) {
      const fam = familyOf(canonicalize(v.visualType))
      if (fam === 'shape' || fam === 'navigation') continue
      total++
      const show = unwrap(readProp(v, 'visualHeader', 'show', true))
      // PBI default is show=true; only count as "showing" when not explicitly false
      if (show !== false) count++
    }
    if (total === 0) return []
    if (count > total / 2) {
      return [{
        ruleId:   'HEADER-1',
        severity: 'low',
        location: `${count} of ${total} visuals`,
        detail:   `${count} visuals show their header bar in view mode`,
        fixDescription: 'Hide visualHeader globally via visualStyles wildcard',
      }]
    }
    return []
  },
}

// ── Export rule registry ─────────────────────────────────────────────────────

export const AUDIT_RULES = [
  TYPO_1, TYPO_2, TYPO_3,
  COLOR_1, COLOR_2,
  LAYOUT_1, LAYOUT_2, LAYOUT_3,
  CHROME_1, CHROME_2,
  HIERARCHY_1,
  TITLE_1,
  HEADER_1,
]

// ── Run all rules + score ────────────────────────────────────────────────────

/**
 * Run every rule and produce a score 0-100 + issue list.
 *
 * Scoring:
 *   - Start at 100
 *   - Subtract 12 per high-severity issue
 *   - Subtract 6  per med-severity issue
 *   - Subtract 2  per low-severity issue
 *   - Floor at 0
 */
export function runAudit(parsed) {
  const issues = []
  for (const rule of AUDIT_RULES) {
    try {
      const found = rule.check(parsed) || []
      for (const f of found) issues.push({ ...f, label: rule.label, category: rule.category })
    } catch (err) {
      console.warn(`[audit] rule ${rule.id} failed:`, err?.message)
    }
  }

  let score = 100
  for (const i of issues) {
    if (i.severity === 'high')      score -= 12
    else if (i.severity === 'med')  score -= 6
    else                            score -= 2
  }
  score = Math.max(0, Math.min(100, score))

  // Group issues by category for UI rendering
  const grouped = {}
  for (const i of issues) {
    grouped[i.category] = grouped[i.category] || []
    grouped[i.category].push(i)
  }

  return { score, issues, grouped }
}
