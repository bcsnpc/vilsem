/**
 * styleApplier — orchestrate the restyle of a parsed report.
 *
 * Inputs:
 *   parsed — output of parseReportDefinition() (normalized format-agnostic shape)
 *   plan   — the design plan (built from a preset + brand kit + custom overrides)
 *   parts  — the original Fabric `getDefinition` parts array (we mutate copies)
 *
 * Output:
 *   {
 *     mutatedParts: [{ path, content }],   // ready for pbi-update-report-definition
 *     theme:        themeJson,             // generated theme JSON for transparency
 *     stats:        { visualsTouched, pagesTouched, errors[] },
 *     diff:         [{ visualId, changes: [...] }]   // list of changes for diff UI
 *   }
 *
 * The applier writes to two layers (per Doc 3 — "theme alone won't beat
 * existing per-visual overrides"):
 *
 *   Layer 1 — Theme JSON (global default)
 *     For PBIR: writes a theme part that's referenced by definition/report.json
 *     For PBIR-Legacy: embeds theme inline in report.json's themeCollection
 *
 *   Layer 2 — Per-visual chrome overrides
 *     Writes visualContainerObjects on every visual (not just charts) so
 *     the chosen chrome treatment is forced regardless of what existed before.
 *
 * Two write strategies controlled by plan.writeStrategy:
 *   - 'preserve' (default) — write theme + chrome; leave per-visual data
 *     overrides (axis fonts, fills) so the user's existing customizations
 *     for axis colors etc. are kept
 *   - 'aggressive' — write theme + chrome + STRIP all per-visual objects/
 *     visualContainerObjects so the theme cascade is unopposed
 *
 * Source: Doc 3 Section "Theme + per-visual conflict resolution"
 */

import { buildThemeJson, buildPageObjects, buildFilterPaneObjects, resolveFonts, resolveStructural } from './themeBuilder.js'
import { buildChromeVisualStyle, getChrome, CHROME_EXCEPTIONS } from './knowledge/chrome.js'
import { themeToPbir, buildPbirCard, buildPbirProperties } from './knowledge/pbirEnvelope.js'
import { canonicalize, familyOf, isNativeVisual } from './knowledge/visualTypeMap.js'
import { snapToGrid, GRID_UNIT } from './knowledge/spacing.js'
import { writeVisualData } from './visualTypeWriters.js'
import { findMatchingRule } from './directorPlanSchema.js'
import { buildPlan } from './knowledge/presets.js'
import { normalizeLayout, summarizeNormalization } from './layoutNormalizer.js'

// ── Property-merge helper ────────────────────────────────────────────────────

/**
 * Merge a new card-array (PBIR shape: [{ properties: {...} }]) on top of
 * an existing one. Preserves any properties the existing card had that the
 * new card doesn't write — most importantly `title.text` so user-customized
 * chart titles ("Revenue Trending") survive a restyle.
 *
 *   existing = [{ properties: { show: ..., text: 'Revenue Trending', fontSize: ... }}]
 *   incoming = [{ properties: { show: ..., fontFamily: ..., fontSize: ..., fontColor: ... }}]
 *   merged   = [{ properties: { show: ..., text: 'Revenue Trending', fontFamily: ..., fontSize: ..., fontColor: ... }}]
 */
function mergeCardProperties(existingCard, incomingCard) {
  if (!Array.isArray(existingCard) || !existingCard.length) return incomingCard
  if (!Array.isArray(incomingCard) || !incomingCard.length) return existingCard
  // For now: only merge the 0-th entry (most cards have 1 entry; multi-entry
  // cards like dataPoint per-series fills are handled separately by the data
  // overrides path).
  const merged = [{
    ...existingCard[0],
    properties: {
      ...(existingCard[0]?.properties || {}),
      ...(incomingCard[0]?.properties || {}),
    },
  }]
  // Carry through additional entries (per-series fills etc.) from existing
  for (let i = 1; i < existingCard.length; i++) merged.push(existingCard[i])
  return merged
}

// ── Visual-type write policy ─────────────────────────────────────────────────

/**
 * Controls how aggressively to restyle each visual family.
 *
 *   skip:       Do not touch this visual type AT ALL (image, shape, button,
 *               textbox, navigators, custom visuals). They have their own
 *               design semantics and our generic chrome breaks them.
 *
 *   chromeOnly: Only background/border/shadow/padding. No title/header
 *               override. Used for cards/KPIs whose internal "callout" or
 *               "indicator" object handles their hero number — overriding
 *               their title with a generic 14pt label clobbers their layout.
 *
 *   full:       Chrome + title + per-family data overrides. Default for
 *               charts and tables.
 *
 *   slicerOnly: Only slicer-specific cards (header, items). Skip card chrome
 *               because slicers have their own background/outline scheme.
 */
const WRITE_POLICY = {
  // Charts get the full treatment
  barChart: 'full', columnChart: 'full', clusteredBarChart: 'full',
  clusteredColumnChart: 'full', stackedBarChart: 'full',
  hundredPercentStackedBarChart: 'full', hundredPercentStackedColumnChart: 'full',
  lineChart: 'full', areaChart: 'full', stackedAreaChart: 'full',
  hundredPercentStackedAreaChart: 'full',
  lineStackedColumnComboChart: 'full', lineClusteredColumnComboChart: 'full',
  ribbonChart: 'full', waterfallChart: 'full',
  pieChart: 'full', donutChart: 'full', treemap: 'full', funnel: 'full',
  scatterChart: 'full',

  // Tables get full but indicator-style title (or none)
  tableEx: 'full', pivotTable: 'full',

  // Indicator family — chrome only, do not override their internal titles
  card: 'chromeOnly', cardVisual: 'chromeOnly', kpi: 'chromeOnly',
  multiRowCard: 'chromeOnly', gauge: 'chromeOnly', scorecard: 'chromeOnly',

  // Slicers — separate path (data overrides for header/items, no card chrome)
  slicer: 'slicerOnly', advancedSlicerVisual: 'slicerOnly',
  textSlicer: 'slicerOnly', listSlicer: 'slicerOnly',

  // ── Container-only treatment (chrome only, no internal data writes) ──
  // These visuals have purpose-built content (rich text, image src, shape
  // geometry) we shouldn't touch — but their CONTAINER (background, border,
  // radius, padding) should match the rest of the report.
  textbox:    'chromeContainer',
  shape:      'chromeContainer',
  basicShape: 'chromeContainer',
  image:      'chromeContainer',

  // Action buttons get full state-discriminated styling with brand accent
  actionButton: 'actionButton',

  // True skips — these have specific UX semantics that any generic restyle would break
  bookmarkNavigator: 'skip',
  pageNavigator:     'skip',
  // Maps — skip for v1 (their formatting is highly map-specific)
  map: 'skip', filledMap: 'skip', shapeMap: 'skip', azureMap: 'skip',
  // Specialty / custom — skip
  decompositionTreeVisual: 'skip', qnaVisual: 'skip', keyDriversVisual: 'skip',
  pythonVisual: 'skip', scriptVisual: 'skip', rdlVisual: 'skip',
  aiNarratives: 'skip',
}

function getWritePolicy(visualType) {
  const canonical = canonicalize(visualType)
  if (WRITE_POLICY[canonical]) return WRITE_POLICY[canonical]
  // Custom visuals — never touch
  if (!isNativeVisual(canonical)) return 'skip'
  return 'full'
}

// ── Public entry point ───────────────────────────────────────────────────────

export function applyRestyle({ parsed, plan, parts }) {
  if (!parsed)            throw new Error('parsed report required')
  if (!plan)              throw new Error('design plan required')
  if (!Array.isArray(parts)) throw new Error('original parts array required')

  const stats = { visualsTouched: 0, pagesTouched: 0, errors: [], skipped: [], layoutChanges: [] }
  const diff  = []

  // ── Detect plan type ──
  // Rule-based plan from AI Director: has plan.rules[]
  // Preset-based plan: has plan.presetId / plan.chrome / plan.fontPairing
  const isRulePlan = Array.isArray(plan.rules) && plan.rules.length > 0
  // For rule plans, we still need a backing preset to draw chrome/typography
  // tokens from. The plan's globalDefaults specify which preset family.
  const effectivePlan = isRulePlan ? buildEffectivePlanFromRules(plan) : plan

  // ── Layout normalization (Step 9) ──
  // Run BEFORE the per-visual mutate loop so the new positions get written
  // back via the existing position-write path. The plan's globalDefaults.layout
  // (Director-produced) or plan.layout (preset path) controls which transforms
  // run. Defaults are conservative — only snapToGrid + equalizeRowHeights ON;
  // equalizeRowWidths and standardizeGutters are off unless explicitly enabled.
  const layoutOpts = (plan.globalDefaults?.layout) || (plan.layout) || {}
  const layoutResult = normalizeLayout(parsed, {
    snapToGrid:         layoutOpts.snapToGrid          ?? layoutOpts.snap          ?? true,
    equalizeRowHeights: layoutOpts.equalizeRowHeights  ?? true,
    equalizeRowWidths:  layoutOpts.equalizeRowWidths   ?? false,
    standardizeGutters: layoutOpts.standardizeGutters  ?? false,
    // Half A.2 + A.3 + Half B — new options on by default to fix the
    // overlapping-visuals + cut-off-text issues from the previous applies.
    resolveOverlaps:    layoutOpts.resolveOverlaps     ?? true,
    clampToPageBounds:  layoutOpts.clampToPageBounds   ?? true,
    repackPageGrid:     layoutOpts.repackPageGrid      ?? false,   // off by default — most invasive
    outerMargin:        layoutOpts.outerMargin         ?? 24,
    gridUnit:           layoutOpts.gridUnit            ?? 8,
    gutter:             layoutOpts.gutter              ?? 16,
  })
  stats.layoutChanges = layoutResult.changes
  stats.layoutSummary = summarizeNormalization(layoutResult.changes)

  // 1. Build theme JSON from the effective plan
  const theme = buildThemeJson(effectivePlan, parsed)

  // 2. Generate per-visual chrome bag (envelope-wrapped, ready to merge)
  const chromeOverride = generateChromeOverride(effectivePlan)

  // 3. Mutate parts based on format. Chrome key differs by format.
  //    For rule plans, we pass the rules through; mutateVisual checks them
  //    BEFORE applying the default per-visualType policy.
  let mutatedParts
  if (parsed.format === 'PBIR-Legacy') {
    mutatedParts = applyLegacy({ parts, parsed, plan: effectivePlan, theme, chromeOverride, stats, diff, rules: isRulePlan ? plan.rules : null })
  } else if (parsed.format === 'PBIR') {
    mutatedParts = applyPbir({ parts, parsed, plan: effectivePlan, theme, chromeOverride, stats, diff, rules: isRulePlan ? plan.rules : null })
  } else {
    throw new Error(`Unsupported format: ${parsed.format}`)
  }

  return { mutatedParts, theme, stats, diff, isRulePlan, narrative: plan.narrative || null }
}

/**
 * Convert a Director-produced rule plan into a flat preset-style plan that
 * themeBuilder + generateChromeOverride can consume. The rule engine still
 * runs per-visual; this just gives us valid theme+chrome tokens to fall back to.
 */
function buildEffectivePlanFromRules(rulePlan) {
  const g = rulePlan.globalDefaults || {}
  // Map globalDefaults to a preset id for backing tokens
  const ramp     = g.ramp || 'light'
  const accent   = g.accent || '#3B82F6'
  const pairing  = g.fontPairing || 'modern_sans'
  const presetId =
    ramp === 'dark'      ? 'premium_dark' :
    pairing === 'editorial' ? 'editorial_mono' :
                             'flat_modern'
  return {
    ...buildPlan(presetId, { accent, mode: ramp === 'dark' ? 'dark' : 'light', fontPairing: pairing }),
    narrative:  rulePlan.narrative,
    archetype:  rulePlan.archetype,
    confidence: rulePlan.confidence,
  }
}

// ── Generate the chrome override bag (PBIR envelope form) ────────────────────

/**
 * Returns a vcObjects-shaped bag with the chrome treatment ready to merge
 * into any visual. Each card is `[{ properties: {...} }]` with values
 * already wrapped in PBIR `expr.Literal.Value` envelopes.
 */
function generateChromeOverride(plan) {
  const themeStyleBlock = buildChromeVisualStyle(plan.chrome, plan.chromeMode || 'light')
  const fonts = resolveFonts(plan)
  const structural = resolveStructural(plan)
  const out = {}

  // background
  if (themeStyleBlock.background) {
    const bg = themeStyleBlock.background[0]
    const props = {
      show: { type: 'bool', value: bg.show ?? true },
    }
    if (bg.color?.solid?.color) {
      props.color = { type: 'color', value: bg.color.solid.color }
    }
    if (bg.transparency != null) {
      props.transparency = { type: 'int', value: bg.transparency }
    }
    out.background = buildPbirCard(props)
  }

  // border
  if (themeStyleBlock.border) {
    const b = themeStyleBlock.border[0]
    out.border = buildPbirCard({
      show:   { type: 'bool', value: !!b.show },
      color:  { type: 'color', value: b.color?.solid?.color || '#E5E7EB' },
      radius: { type: 'int',  value: b.radius ?? 0 },
      weight: { type: 'int',  value: b.weight ?? 1 },
    })
  }

  // dropShadow
  if (themeStyleBlock.dropShadow) {
    const s = themeStyleBlock.dropShadow[0]
    if (s.show) {
      out.dropShadow = buildPbirCard({
        show:         { type: 'bool',   value: true },
        preset:       { type: 'string', value: s.preset || 'Outer' },
        color:        { type: 'color',  value: s.color?.solid?.color || '#000000' },
        transparency: { type: 'int',    value: s.transparency ?? 80 },
        blur:         { type: 'int',    value: s.blur ?? 6 },
        distance:     { type: 'int',    value: s.distance ?? 2 },
        angle:        { type: 'int',    value: s.angle ?? 90 },
      })
    } else {
      out.dropShadow = buildPbirCard({ show: { type: 'bool', value: false } })
    }
  }

  // padding
  if (themeStyleBlock.padding) {
    const p = themeStyleBlock.padding[0]
    out.padding = buildPbirCard({
      top:    { type: 'int', value: p.top    ?? 16 },
      right:  { type: 'int', value: p.right  ?? 16 },
      bottom: { type: 'int', value: p.bottom ?? 16 },
      left:   { type: 'int', value: p.left   ?? 16 },
    })
  }

  // title (chrome) — use plan typography
  const titleSize = plan.typography?.visualTitle?.size || 14
  out.title = buildPbirCard({
    show:       { type: 'bool',   value: true },
    fontFamily: { type: 'string', value: fonts.titleFont },
    fontSize:   { type: 'double', value: titleSize },
    fontColor:  { type: 'color',  value: structural.firstLevelElements },
    alignment:  { type: 'string', value: 'left' },
    bold:       { type: 'bool',   value: false },
  })

  // visualHeader — hide globally
  if (plan.visualHeader?.show === false) {
    out.visualHeader = buildPbirCard({
      show: { type: 'bool', value: false },
    })
  }

  return out
}

// ── Generate per-family data overrides ───────────────────────────────────────

/**
 * Returns per-family vcObjects-shaped bags for data cards (axis, labels,
 * legend, table grid). Keyed by family name. The applier looks up the
 * family for each visual and merges the matching block.
 */
function generateDataOverrides(plan) {
  const fonts = resolveFonts(plan)
  const structural = resolveStructural(plan)
  const out = {}

  // Cartesian
  if (plan.perFamily?.cartesian) {
    const c = plan.perFamily.cartesian
    out.cartesian = {
      categoryAxis: buildPbirCard({
        show:           { type: 'bool',   value: true },
        labelColor:     { type: 'color',  value: structural.secondLevelElements },
        fontFamily:     { type: 'string', value: fonts.bodyFont },
        fontSize:       { type: 'double', value: 10 },
        showAxisTitle:  { type: 'bool',   value: !c.categoryAxisHideTitle },
        gridlineShow:   { type: 'bool',   value: false },
      }),
      valueAxis: buildPbirCard({
        show:              { type: 'bool',   value: true },
        labelColor:        { type: 'color',  value: structural.secondLevelElements },
        fontFamily:        { type: 'string', value: fonts.bodyFont },
        fontSize:          { type: 'double', value: 10 },
        showAxisTitle:     { type: 'bool',   value: false },
        gridlineShow:      { type: 'bool',   value: c.valueAxisGridStyle !== 'none' },
        gridlineColor:     { type: 'color',  value: c.valueAxisGridColor || structural.thirdLevelElements },
        gridlineStyle:     { type: 'string', value: c.valueAxisGridStyle === 'none' ? 'solid' : (c.valueAxisGridStyle || 'dotted') },
        gridlineThickness: { type: 'int',    value: 1 },
      }),
      legend: buildPbirCard({
        show:       { type: 'bool',   value: true },
        position:   { type: 'string', value: c.legendPosition || 'TopCenter' },
        showTitle:  { type: 'bool',   value: false },
        labelColor: { type: 'color',  value: structural.secondLevelElements },
        fontFamily: { type: 'string', value: fonts.bodyFont },
        fontSize:   { type: 'double', value: 11 },
      }),
    }
  }

  // Indicator (cards / KPIs)
  if (plan.perFamily?.indicator) {
    out.indicator = {
      labels: buildPbirCard({
        color:      { type: 'color',  value: structural.firstLevelElements },
        fontFamily: { type: 'string', value: fonts.titleFont },
      }),
      categoryLabels: buildPbirCard({
        show:       { type: 'bool',   value: true },
        color:      { type: 'color',  value: structural.secondLevelElements },
        fontFamily: { type: 'string', value: fonts.bodyFont },
        fontSize:   { type: 'double', value: 11 },
      }),
    }
  }

  // Slicer
  if (plan.perFamily?.slicer) {
    const sl = plan.perFamily.slicer
    out.slicer = {
      header: buildPbirCard({
        show:          { type: 'bool',   value: sl.headerHide !== true },
        fontColor:     { type: 'color',  value: structural.firstLevelElements },
        background:    { type: 'color',  value: structural.background },
        outlineStyle:  { type: 'int',    value: sl.outlineStyle ?? 4 },
        outlineColor:  { type: 'color',  value: sl.outlineColor || structural.thirdLevelElements },
        outlineWeight: { type: 'int',    value: 1 },
        textSize:      { type: 'double', value: 11 },
        fontFamily:    { type: 'string', value: fonts.titleFont },
        bold:          { type: 'bool',   value: true },
      }),
      items: buildPbirCard({
        fontColor:    { type: 'color',  value: structural.secondLevelElements },
        background:   { type: 'color',  value: structural.background },
        textSize:     { type: 'double', value: 11 },
        fontFamily:   { type: 'string', value: fonts.bodyFont },
      }),
    }
  }

  // Table / matrix
  if (plan.perFamily?.table) {
    const t = plan.perFamily.table
    const banded = t.bandedRows
    out.table = {
      grid: buildPbirCard({
        gridVertical:        { type: 'bool',   value: t.gridLines === 'verticalOnly' || t.gridLines === 'both' },
        gridHorizontal:      { type: 'bool',   value: t.gridLines === 'horizontalOnly' || t.gridLines === 'both' },
        gridHorizontalColor: { type: 'color',  value: structural.thirdLevelElements },
        rowPadding:          { type: 'int',    value: t.rowPadding || 8 },
        textSize:            { type: 'double', value: 11 },
      }),
      columnHeaders: buildPbirCard({
        fontColor:  { type: 'color',  value: structural.firstLevelElements },
        backColor:  { type: 'color',  value: t.headerBg || structural.thirdLevelElements },
        bold:       { type: 'bool',   value: true },
        fontFamily: { type: 'string', value: fonts.titleFont },
        fontSize:   { type: 'double', value: 11 },
      }),
      values: buildPbirCard({
        fontColor:           { type: 'color',  value: structural.firstLevelElements },
        ...(banded ? {
          backColorPrimary:    { type: 'color', value: t.bandedColorPrimary   || structural.background },
          backColorSecondary:  { type: 'color', value: t.bandedColorSecondary || structural.secondaryBackground },
          bandedRowBackColors: { type: 'bool',  value: true },
        } : {}),
        fontSize:            { type: 'double', value: 11 },
        fontFamily:          { type: 'string', value: fonts.bodyFont },
      }),
    }
  }

  return out
}

// ── Visual mutation: merge chrome + data overrides into one visual ───────────

/**
 * Mutates a visual's `objects` and `visualContainerObjects` in place with
 * the plan's overrides. Records what changed in `diff`.
 *
 * Returns the same visual object for chaining.
 */
/**
 * Mutate a visual according to its write policy. The chrome key differs by
 * format: PBIR uses `visualContainerObjects`; Legacy uses `vcObjects`.
 * Caller passes `chromeKey` so this function stays format-agnostic.
 */
function mutateVisual({ visual, parsedVisual, plan, chromeOverride, diff, chromeKey, skipped, rules }) {
  const visualType = canonicalize(parsedVisual.visualType)

  // ── Rule engine path (Director-produced plans) ──
  // If the plan supplied rules, find the first matching one. Skip rules win
  // immediately. Apply rules attach their directives below.
  let matchedRule = null
  if (Array.isArray(rules) && rules.length) {
    matchedRule = findMatchingRule(parsedVisual, { rules }, t => familyOf(canonicalize(t)))
    if (matchedRule?.skip) {
      skipped?.push({ id: parsedVisual.id, visualType: parsedVisual.visualType, reason: matchedRule.reason || `rule "${matchedRule.id}" skip` })
      return visual
    }
    // If no rule matched AND we're in rule-mode, default to skip (conservative).
    // Rule plans must be explicit — visuals not addressed are left alone.
    if (!matchedRule) {
      skipped?.push({ id: parsedVisual.id, visualType: parsedVisual.visualType, reason: 'no matching rule (rule-plan default = leave alone)' })
      return visual
    }
  }

  // ── Preset path (no rules — fall back to per-visualType policy) ──
  const policy = matchedRule ? 'rule' : getWritePolicy(visualType)

  if (policy === 'skip') {
    skipped?.push({ id: parsedVisual.id, visualType: parsedVisual.visualType, reason: 'skip policy' })
    return visual
  }

  const changes = []
  const apply   = matchedRule?.apply || {}

  // ── Chrome (visualContainerObjects in PBIR / vcObjects in Legacy) ──
  // Slicers have their own outline scheme — skip card chrome.
  // chromeContainer / actionButton policies write chrome only, no data internals.
  if (policy !== 'slicerOnly') {
    if (!visual[chromeKey]) visual[chromeKey] = {}
    for (const [card, value] of Object.entries(chromeOverride)) {
      // Indicator family (card / kpi / gauge / multiRowCard / cardVisual /
      // scorecard) — don't overwrite their internal title with generic 14pt;
      // their title/callout layout is purpose-built.
      if (card === 'title' && policy === 'chromeOnly') continue

      // Visual-type-specific padding override (slicer/button/shape get less)
      if (card === 'padding' && CHROME_EXCEPTIONS[visualType]?.padding) {
        const ex = CHROME_EXCEPTIONS[visualType].padding
        visual[chromeKey][card] = buildPbirCard({
          top:    { type: 'int', value: ex.top },
          right:  { type: 'int', value: ex.right },
          bottom: { type: 'int', value: ex.bottom },
          left:   { type: 'int', value: ex.left },
        })
        changes.push(`${chromeKey}.${card}`)
        continue
      }
      // MERGE — don't replace. Preserve any existing properties (especially
      // `title.text` and other user-customized values) so we only overwrite
      // the styling we want to control. Without this, custom chart titles
      // get reset to PBI's auto-generated field-name titles.
      visual[chromeKey][card] = mergeCardProperties(visual[chromeKey][card], value)
      changes.push(`${chromeKey}.${card}`)
    }
  }

  // ── Per-visualType data overrides (catalog-driven, NOT family-keyed) ──
  // The writer dispatches by canonical visualType to its purpose-built cards:
  //   - card → labels (callout) + categoryLabels
  //   - cardVisual → callout + referenceLabels
  //   - kpi → indicator + trendline + goals + directionAndStatus + dateLabel
  //   - gauge → dataPoint + calloutValue + targetValue
  //   - multiRowCard → cardTitle + dataLabels + categoryLabels + card
  //   - line/area → categoryAxis + valueAxis (capital-L gridLine*) + lineStyles
  //   - bar/column → categoryAxis + valueAxis (lowercase-l gridline*) + Totals
  //   - pie/donut → legend + detailLabels + slices (innerRadiusRatio)
  //   - table/matrix → grid + columnHeaders + values + total
  //   - slicer → header + items
  if (policy === 'full' || policy === 'chromeOnly' || policy === 'slicerOnly' || policy === 'actionButton' || policy === 'rule') {
    const dataBag = writeVisualData(parsedVisual.visualType, plan, parsedVisual)
    if (dataBag) {
      if (!visual.objects) visual.objects = {}
      for (const [card, value] of Object.entries(dataBag)) {
        visual.objects[card] = mergeCardProperties(visual.objects[card], value)
        changes.push(`objects.${card}`)
      }
    }

    // ── Rule-directive overrides (Director plans only) ──
    if (matchedRule && apply) {
      // hideTitle — set show:false on title
      if (apply.hideTitle && visual[chromeKey]) {
        visual[chromeKey].title = mergeCardProperties(visual[chromeKey].title, buildPbirCard({
          show: { type: 'bool', value: false },
        }))
        changes.push(`${chromeKey}.title.show=false (rule)`)
      }
      // hideHeader — collapse the gear/pin/etc. visualHeader bar
      if (apply.hideHeader && visual[chromeKey]) {
        visual[chromeKey].visualHeader = mergeCardProperties(visual[chromeKey].visualHeader, buildPbirCard({
          show: { type: 'bool', value: false },
        }))
        changes.push(`${chromeKey}.visualHeader.show=false (rule)`)
      }
      // hideLegend / hideAxes / hideGridlines on charts
      if (apply.hideLegend && visual.objects) {
        visual.objects.legend = mergeCardProperties(visual.objects.legend, buildPbirCard({
          show: { type: 'bool', value: false },
        }))
        changes.push('objects.legend.show=false (rule)')
      }
      if (apply.hideAxes && visual.objects) {
        visual.objects.categoryAxis = mergeCardProperties(visual.objects.categoryAxis, buildPbirCard({
          show: { type: 'bool', value: false },
        }))
        visual.objects.valueAxis = mergeCardProperties(visual.objects.valueAxis, buildPbirCard({
          show: { type: 'bool', value: false },
        }))
        changes.push('objects.{categoryAxis,valueAxis}.show=false (rule)')
      }
      // accentBar — apply to the card visual (accentBar card)
      if (apply.accentBar && visual.objects) {
        const accent = apply.accentColor || plan.color?.defaultAccent || '#3B82F6'
        visual.objects.accentBar = buildPbirCard({
          show:   { type: 'bool',  value: true },
          color:  { type: 'color', value: accent },
          weight: { type: 'int',   value: 2 },
        })
        changes.push('objects.accentBar (rule)')
      }
      // heroSize — override KPI hero font size on cards
      if (apply.heroSize && visual.objects?.labels) {
        visual.objects.labels = mergeCardProperties(visual.objects.labels, buildPbirCard({
          fontSize: { type: 'double', value: apply.heroSize },
        }))
        changes.push(`objects.labels.fontSize=${apply.heroSize}pt (rule)`)
      }
      // titleSize / titleAlignment
      if (apply.titleSize && visual[chromeKey]) {
        visual[chromeKey].title = mergeCardProperties(visual[chromeKey].title, buildPbirCard({
          fontSize: { type: 'double', value: apply.titleSize },
        }))
        changes.push(`${chromeKey}.title.fontSize=${apply.titleSize}pt (rule)`)
      }
      if (apply.titleAlignment && visual[chromeKey]) {
        visual[chromeKey].title = mergeCardProperties(visual[chromeKey].title, buildPbirCard({
          alignment: { type: 'string', value: apply.titleAlignment },
        }))
        changes.push(`${chromeKey}.title.alignment=${apply.titleAlignment} (rule)`)
      }
      // Free-form propertyOverrides — Director's discretion
      if (apply.propertyOverrides) {
        if (!visual.objects) visual.objects = {}
        for (const [card, props] of Object.entries(apply.propertyOverrides)) {
          const cardEntries = {}
          for (const [propName, propVal] of Object.entries(props)) {
            const type = typeof propVal === 'boolean' ? 'bool'
                       : typeof propVal === 'number'  ? (Number.isInteger(propVal) ? 'int' : 'double')
                       : (/^#[0-9A-Fa-f]{3,8}$/.test(propVal) ? 'color' : 'string')
            cardEntries[propName] = { type, value: propVal }
          }
          visual.objects[card] = mergeCardProperties(visual.objects[card], buildPbirCard(cardEntries))
          changes.push(`objects.${card} (rule.propertyOverrides)`)
        }
      }
    }

    // AGGRESSIVE MODE — strip per-visual dataPoint.fill overrides so the
    // theme's dataColors palette can cascade through. Without this, the
    // original report's per-series fills (e.g. donut teal/yellow) defeat
    // any palette change.
    // Now triggered EITHER by aggressive mode (preset path) OR by an
    // explicit rule directive (Director path) — Director can target
    // specific visuals while leaving others alone.
    const ruleStripsFills = matchedRule?.apply?.stripDataPointFills || matchedRule?.apply?.useThemePalette
    if ((plan.writeStrategy === 'aggressive' || ruleStripsFills) && visual.objects?.dataPoint) {
      const filtered = (Array.isArray(visual.objects.dataPoint) ? visual.objects.dataPoint : [])
        .filter(entry => !entry.properties?.fill && !entry.properties?.fillRule && !entry.properties?.defaultColor)
      if (filtered.length !== visual.objects.dataPoint.length) {
        visual.objects.dataPoint = filtered
        changes.push('objects.dataPoint (stripped per-series fills — aggressive)')
      }
    }
  }

  // ── Layout normalization (snap to grid) ──
  if (plan.layout?.snapToGrid && parsedVisual.position) {
    const unit = plan.layout?.gridUnit || GRID_UNIT
    const before = { ...parsedVisual.position }
    const snapped = {
      x:      snapToGrid(parsedVisual.position.x, unit),
      y:      snapToGrid(parsedVisual.position.y, unit),
      width:  snapToGrid(parsedVisual.position.width, unit),
      height: snapToGrid(parsedVisual.position.height, unit),
    }
    if (snapped.x !== before.x || snapped.y !== before.y || snapped.width !== before.width || snapped.height !== before.height) {
      Object.assign(parsedVisual.position, snapped)
      changes.push('position (snap to grid)')
    }
  }

  if (changes.length) {
    diff.push({
      visualId:   parsedVisual.id,
      visualType: parsedVisual.visualType,
      page:       parsedVisual._pageName || parsedVisual._pageId,
      changes,
      policy,
    })
  }

  return visual
}

// ── PBIR-Legacy applier ──────────────────────────────────────────────────────

/**
 * For Legacy: walk the original parts, find report.json, parse it, walk
 * sections + visualContainers, mutate each visualContainer's `config`
 * string-encoded JSON, then re-stringify and serialize parts back.
 */
function applyLegacy({ parts, parsed, plan, theme, chromeOverride, stats, diff, rules }) {
  // Clone parts so we don't mutate the originals
  const next = parts.map(p => ({ ...p }))

  // Find report.json (entry from parsed.sourceReportPath)
  const reportPath = parsed.sourceReportPath
  const reportPart = next.find(p => p.path === reportPath)
  if (!reportPart) {
    stats.errors.push(`report.json not found at ${reportPath}`)
    return next
  }

  let report
  try { report = JSON.parse(reportPart.content) }
  catch (err) {
    stats.errors.push('report.json parse failed: ' + err.message)
    return next
  }

  // Inline theme into report.themeCollection (legacy convention)
  // — replaces base theme so our cascading rules apply globally
  let reportConfig = {}
  try { reportConfig = JSON.parse(report.config || '{}') } catch { reportConfig = {} }
  reportConfig.themeCollection = reportConfig.themeCollection || {}
  reportConfig.themeCollection.customTheme = theme
  // Filter pane styling
  reportConfig.objects = { ...(reportConfig.objects || {}), ...buildFilterPaneObjects(plan) }
  report.config = JSON.stringify(reportConfig)

  // Walk sections + visualContainers
  for (let si = 0; si < (report.sections || []).length; si++) {
    const section = report.sections[si]
    const parsedPage = parsed.pages?.[si]
    if (!parsedPage) continue

    // Page-level objects (background)
    let pageConfig = {}
    try { pageConfig = JSON.parse(section.config || '{}') } catch { pageConfig = {} }
    pageConfig.objects = { ...(pageConfig.objects || {}), ...buildPageObjects(plan) }
    section.config = JSON.stringify(pageConfig)
    stats.pagesTouched++

    // Per-visual mutation
    for (let vi = 0; vi < (section.visualContainers || []).length; vi++) {
      const vc = section.visualContainers[vi]
      const parsedVisual = parsedPage.visuals?.[vi]
      if (!parsedVisual) continue
      parsedVisual._pageName = parsedPage.name
      parsedVisual._pageId   = parsedPage.id

      let vcConfig
      try { vcConfig = JSON.parse(vc.config || '{}') }
      catch { stats.errors.push(`visualContainer ${vi} on page ${si} parse failed`); continue }

      const sv = vcConfig.singleVisual
      if (!sv) continue   // visual groups untouched

      // Mutate — Legacy chrome lives at `singleVisual.vcObjects`
      mutateVisual({
        visual:         sv,
        parsedVisual,
        plan,
        chromeOverride,
        diff,
        chromeKey:      'vcObjects',
        skipped:        stats.skipped,
        rules,
      })

      // Sync back position if layout normalizer ran
      if (plan.layout?.snapToGrid && parsedVisual.position) {
        // Outer fields take priority for legacy
        vc.x      = parsedVisual.position.x
        vc.y      = parsedVisual.position.y
        vc.width  = parsedVisual.position.width
        vc.height = parsedVisual.position.height
        if (vcConfig.layouts?.[0]?.position) {
          Object.assign(vcConfig.layouts[0].position, parsedVisual.position)
        }
      }

      // Re-encode the modified config back
      vc.config = JSON.stringify(vcConfig)
      stats.visualsTouched++
    }
  }

  reportPart.content = JSON.stringify(report)
  return next
}

// ── PBIR (modern) applier ────────────────────────────────────────────────────

function applyPbir({ parts, parsed, plan, theme, chromeOverride, stats, diff, rules }) {
  const next = parts.map(p => ({ ...p }))

  // Update report-level theme + filter pane
  const reportPart = next.find(p => p.path === 'definition/report.json')
  if (reportPart) {
    try {
      const report = JSON.parse(reportPart.content)
      report.themeCollection = report.themeCollection || {}
      report.themeCollection.customTheme = theme
      report.objects = { ...(report.objects || {}), ...buildFilterPaneObjects(plan) }
      reportPart.content = JSON.stringify(report, null, 2)
    } catch (err) {
      stats.errors.push('definition/report.json mutation failed: ' + err.message)
    }
  }

  // Walk pages + visuals
  for (const page of parsed.pages || []) {
    // Page-level background
    const pageJsonPart = next.find(p => p.path === `definition/pages/${page.id}/page.json`)
    if (pageJsonPart) {
      try {
        const pageJson = JSON.parse(pageJsonPart.content)
        pageJson.objects = { ...(pageJson.objects || {}), ...buildPageObjects(plan) }
        pageJsonPart.content = JSON.stringify(pageJson, null, 2)
        stats.pagesTouched++
      } catch (err) {
        stats.errors.push(`page.json mutation failed for ${page.id}: ${err.message}`)
      }
    }

    // Per-visual
    for (const v of page.visuals || []) {
      const visualPart = next.find(p => p.path === v.rawPath)
      if (!visualPart) continue
      try {
        const visualJson = JSON.parse(visualPart.content)
        const sv = visualJson.visual
        if (!sv) continue

        v._pageName = page.name
        v._pageId   = page.id

        mutateVisual({
          visual:         sv,
          parsedVisual:   v,
          plan,
          chromeOverride,
          diff,
          chromeKey:      'visualContainerObjects',
          skipped:        stats.skipped,
          rules,
        })

        // Position sync
        if (plan.layout?.snapToGrid && v.position) {
          visualJson.position = { ...visualJson.position, ...v.position }
        }

        visualPart.content = JSON.stringify(visualJson, null, 2)
        stats.visualsTouched++
      } catch (err) {
        stats.errors.push(`visual.json mutation failed for ${v.id}: ${err.message}`)
      }
    }
  }

  return next
}
