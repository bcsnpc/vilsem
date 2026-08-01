/**
 * Per-visualType writers — generates the correct visual.objects bag for
 * each visual family.
 *
 * The previous (Step 4) applier had ONE generic data-override generator
 * keyed by family. That broke purpose-built visuals — cards got chart
 * `labels` instead of card callout `labels`, gauges got chart `legend`
 * instead of `axis/calloutValue/targetValue`, KPI got nothing useful at
 * all because they have `indicator/trendline/goals/directionAndStatus`
 * which family-keyed dispatch missed.
 *
 * This module replaces that with one writer per visual family that knows
 * the EXACT cards each visualType has (per visualPropertyCatalog), and
 * writes only those cards with values from the design plan.
 *
 * Source of property names: visualPropertyCatalog.js (citations there).
 *
 * Each writer returns a `{ cardName: pbirCardArray }` bag ready to merge
 * into `visual.objects`. Caller is responsible for merging into the right
 * key (`objects` for both formats; chrome goes to `vcObjects` Legacy /
 * `visualContainerObjects` PBIR via the central chrome generator).
 */

import { buildPbirCard } from './knowledge/pbirEnvelope.js'
import { canonicalize } from './knowledge/visualTypeMap.js'
import { gridlineProperty } from './knowledge/visualPropertyCatalog.js'
import { resolveFonts, resolveStructural } from './themeBuilder.js'

// ── Cartesian (bar / column / clustered / stacked / 100% variants) ───────────

function writeCartesianData({ visualType, plan, fonts, structural }) {
  const c = plan.perFamily?.cartesian || {}
  const labelColor = structural.secondLevelElements
  const gridColor  = c.valueAxisGridColor || structural.thirdLevelElements
  const gridStyle  = c.valueAxisGridStyle || 'dotted'
  const showAxisTitle = !c.categoryAxisHideTitle
  const showGrid   = gridStyle !== 'none'

  // Bar/column uses lowercase l for gridline properties
  const gridShowKey      = gridlineProperty(visualType, 'Show')      // gridlineShow
  const gridColorKey     = gridlineProperty(visualType, 'Color')     // gridlineColor
  const gridThicknessKey = gridlineProperty(visualType, 'Thickness') // gridlineThickness

  return {
    legend: buildPbirCard({
      show:        { type: 'bool',   value: true },
      position:    { type: 'string', value: c.legendPosition || 'TopCenter' },
      showTitle:   { type: 'bool',   value: false },
      legendColor: { type: 'color',  value: labelColor },        // bar/col uses legendColor
      fontFamily:  { type: 'string', value: fonts.bodyFont },
      fontSize:    { type: 'double', value: 11 },
    }),
    categoryAxis: buildPbirCard({
      show:           { type: 'bool',   value: true },
      color:          { type: 'color',  value: labelColor },     // bar/col uses color
      fontFamily:     { type: 'string', value: fonts.bodyFont },
      fontSize:       { type: 'double', value: 10 },
      showAxisTitle:  { type: 'bool',   value: showAxisTitle },
      titleColor:     { type: 'color',  value: structural.firstLevelElements },
      titleFontFamily:{ type: 'string', value: fonts.titleFont },
      titleFontSize:  { type: 'double', value: 11 },
    }),
    valueAxis: buildPbirCard({
      show:                { type: 'bool',   value: true },
      labelColor:          { type: 'color',  value: labelColor },
      fontFamily:          { type: 'string', value: fonts.bodyFont },
      fontSize:            { type: 'double', value: 10 },
      showAxisTitle:       { type: 'bool',   value: false },
      [gridShowKey]:       { type: 'bool',   value: showGrid },
      [gridColorKey]:      { type: 'color',  value: gridColor },
      [gridThicknessKey]:  { type: 'int',    value: 1 },
      gridlineStyle:       { type: 'string', value: gridStyle === 'none' ? 'Solid' : capitalize(gridStyle) },
    }),
    labels: buildPbirCard({
      show:       { type: 'bool',   value: c.labelsShow === 'on' },
      color:      { type: 'color',  value: structural.firstLevelElements },
      fontFamily: { type: 'string', value: fonts.bodyFont },
      fontSize:   { type: 'double', value: 10 },
    }),
  }
}

// ── Line / Area family (capital-L gridlines, lineStyles card) ────────────────

function writeLineData({ visualType, plan, fonts, structural }) {
  const c = plan.perFamily?.cartesian || {}
  const labelColor = structural.secondLevelElements
  const gridColor  = c.valueAxisGridColor || structural.thirdLevelElements
  const gridStyle  = c.valueAxisGridStyle || 'dotted'
  const showAxisTitle = !c.categoryAxisHideTitle
  const showGrid   = gridStyle !== 'none'

  const gridShowKey      = gridlineProperty(visualType, 'Show')      // gridLineShow (cap L)
  const gridColorKey     = gridlineProperty(visualType, 'Color')     // gridLineColor
  const gridThicknessKey = gridlineProperty(visualType, 'Thickness') // gridLineThickness

  return {
    legend: buildPbirCard({
      show:                  { type: 'bool',   value: true },
      position:              { type: 'string', value: c.legendPosition || 'TopCenter' },
      showTitle:             { type: 'bool',   value: false },
      labelColor:            { type: 'color',  value: labelColor },   // line uses labelColor
      fontFamily:            { type: 'string', value: fonts.bodyFont },
      fontSize:              { type: 'double', value: 11 },
      legendMarkerRendering: { type: 'string', value: 'lineWithMarker' },
      matchLineColor:        { type: 'bool',   value: true },
    }),
    categoryAxis: buildPbirCard({
      show:            { type: 'bool',   value: true },
      labelColor:      { type: 'color',  value: labelColor },
      fontFamily:      { type: 'string', value: fonts.bodyFont },
      fontSize:        { type: 'double', value: 10 },
      showAxisTitle:   { type: 'bool',   value: showAxisTitle },
      titleColor:      { type: 'color',  value: structural.firstLevelElements },
      titleFontFamily: { type: 'string', value: fonts.titleFont },
      titleFontSize:   { type: 'double', value: 11 },
    }),
    valueAxis: buildPbirCard({
      show:               { type: 'bool',   value: true },
      labelColor:         { type: 'color',  value: labelColor },
      fontFamily:         { type: 'string', value: fonts.bodyFont },
      fontSize:           { type: 'double', value: 10 },
      showAxisTitle:      { type: 'bool',   value: false },
      [gridShowKey]:      { type: 'bool',   value: showGrid },
      [gridColorKey]:     { type: 'color',  value: gridColor },
      [gridThicknessKey]: { type: 'int',    value: 1 },
      gridlineStyle:      { type: 'string', value: gridStyle === 'none' ? 'Solid' : capitalize(gridStyle) },
    }),
    lineStyles: buildPbirCard({
      strokeWidth:    { type: 'int',    value: 2 },
      strokeLineJoin: { type: 'string', value: 'Round' },
      lineStyle:      { type: 'string', value: 'Solid' },
      showMarker:     { type: 'bool',   value: false },
    }),
    labels: buildPbirCard({
      show:       { type: 'bool',   value: c.labelsShow === 'on' },
      color:      { type: 'color',  value: structural.firstLevelElements },
      fontFamily: { type: 'string', value: fonts.bodyFont },
      fontSize:   { type: 'double', value: 10 },
    }),
  }
}

// ── Pie / Donut ──────────────────────────────────────────────────────────────

function writePieDonutData({ visualType, plan, fonts, structural }) {
  return {
    legend: buildPbirCard({
      show:        { type: 'bool',   value: true },
      position:    { type: 'string', value: 'BottomCenter' },
      showTitle:   { type: 'bool',   value: false },
      labelColor:  { type: 'color',  value: structural.secondLevelElements },
      fontFamily:  { type: 'string', value: fonts.bodyFont },
      fontSize:    { type: 'double', value: 11 },
    }),
    detailLabels: buildPbirCard({
      show:          { type: 'bool',   value: true },
      color:         { type: 'color',  value: structural.firstLevelElements },
      fontFamily:    { type: 'string', value: fonts.bodyFont },
      fontSize:      { type: 'double', value: 11 },
      labelStyle:    { type: 'string', value: 'Both' },
      labelPosition: { type: 'string', value: 'Outside' },
    }),
    // Donut-specific — inner radius
    ...(visualType === 'donutChart' ? {
      slices: buildPbirCard({
        innerRadiusRatio: { type: 'int',   value: 50 },
        strokeWidth:      { type: 'int',   value: 0 },
      }),
    } : {}),
  }
}

// ── Card (legacy) — labels here is the CALLOUT VALUE ─────────────────────────

function writeCardData({ plan, fonts, structural, parsedVisual }) {
  // Premium executive dashboards use 40-50pt for KPI hero numbers.
  // Original PBI default is 45pt; we bump the floor to 42pt.
  // BUT cap by card width — a 50pt hero in a 120px-wide card overflows.
  // Rule of thumb: ~10px per character. "$24.9M" is 6 chars + symbol = ~8 char-widths.
  // For a 120px card, max sensible hero = 120 / 8 * 1.4 = 21pt.
  // For a 200px card, max = 200 / 8 * 1.4 = 35pt.
  // For a 280px card, max = 280 / 8 * 1.4 = 49pt.
  const cardWidth = parsedVisual?.position?.width || 200
  const planHero  = plan.typography?.kpiHeroValue?.size || 42
  const widthCap  = Math.round(cardWidth / 8 * 1.4)
  const heroSize  = Math.max(20, Math.min(planHero, widthCap))   // floor 20pt, ceiling = widthCap
  const labelSize = plan.typography?.kpiLabel?.size || 12
  return {
    // The big number (NOT chart data labels — confusing PBI naming)
    labels: buildPbirCard({
      color:      { type: 'color',  value: structural.firstLevelElements },
      fontSize:   { type: 'double', value: heroSize },
      fontFamily: { type: 'string', value: fonts.titleFont },
      bold:       { type: 'bool',   value: true },
    }),
    // Category label = the small caption above/below the hero (e.g. "REVENUE").
    // Premium tell-tale: bold + Semibold font + muted color (we can't force
    // uppercase in PBI — that's done by the user's text — but bold+font weight
    // gives it presence).
    categoryLabels: buildPbirCard({
      show:       { type: 'bool',   value: true },
      color:      { type: 'color',  value: structural.secondLevelElements },
      fontSize:   { type: 'double', value: labelSize },
      fontFamily: { type: 'string', value: fonts.titleFont },     // Semibold, not body
    }),
    wordWrap: buildPbirCard({
      show: { type: 'bool', value: true },
    }),
    // Accent bar (top) — the slim colored stripe at top of the card. Premium
    // dashboards use this sparingly to mark KPI variance, but a baseline accent
    // bar gives every card visual weight.
    accentBar: buildPbirCard({
      show:   { type: 'bool',  value: true },
      color:  { type: 'color', value: plan.color?.defaultAccent || '#3B82F6' },
      weight: { type: 'int',   value: 2 },
    }),
  }
}

// ── CardVisual (new card, GA Nov 2025) — Fluent 2 properties ────────────────

function writeCardVisualData({ plan, fonts, structural }) {
  const heroSize = plan.typography?.kpiHeroValue?.size || 24   // Fluent 2 default ~24pt
  return {
    callout: buildPbirCard({
      fontFamily: { type: 'string', value: fonts.titleFont },
      fontSize:   { type: 'double', value: heroSize },
      bold:       { type: 'bool',   value: true },
      color:      { type: 'color',  value: structural.firstLevelElements },
    }),
    referenceLabels: buildPbirCard({
      // Fluent 2 default: hide background for cleaner look
      backgroundTransparency: { type: 'int',   value: 100 },
      color:                  { type: 'color', value: structural.secondLevelElements },
      fontSize:               { type: 'double', value: 11 },
    }),
  }
}

// ── KPI — its own purpose-built cards ────────────────────────────────────────

function writeKpiData({ plan, fonts, structural, parsedVisual }) {
  const cardWidth = parsedVisual?.position?.width || 200
  const planHero  = plan.typography?.kpiHeroValue?.size || 36
  const heroSize  = Math.max(18, Math.min(planHero, Math.round(cardWidth / 8 * 1.4)))
  return {
    indicator: buildPbirCard({
      fontFamily: { type: 'string', value: fonts.titleFont },
      fontSize:   { type: 'double', value: heroSize },
      color:      { type: 'color',  value: structural.firstLevelElements },
    }),
    trendline: buildPbirCard({
      show:         { type: 'bool', value: true },
      transparency: { type: 'int',  value: 70 },
    }),
    goals: buildPbirCard({
      color: { type: 'color', value: structural.secondLevelElements },
    }),
    directionAndStatus: buildPbirCard({
      direction: { type: 'string', value: 'PositiveIsGood' },
    }),
    dateLabel: buildPbirCard({
      color:    { type: 'color',  value: structural.fourthLevelElements },
      fontSize: { type: 'double', value: 9 },
    }),
  }
}

// ── Gauge — axis / dataPoint / calloutValue ──────────────────────────────────

function writeGaugeData({ plan, fonts, structural, parsedVisual }) {
  const accent = plan.color?.defaultAccent || '#3B82F6'
  const cardWidth = parsedVisual?.position?.width || 200
  const planHero  = plan.typography?.kpiHeroValue?.size || 32
  const heroSize  = Math.max(16, Math.min(planHero, Math.round(cardWidth / 8 * 1.4)))
  return {
    dataPoint: buildPbirCard({
      fillColor:   { type: 'color', value: accent },
      targetColor: { type: 'color', value: structural.secondLevelElements },
    }),
    calloutValue: buildPbirCard({
      color:      { type: 'color',  value: structural.firstLevelElements },
      fontSize:   { type: 'double', value: heroSize },
      fontFamily: { type: 'string', value: fonts.titleFont },
    }),
    targetValue: buildPbirCard({
      color: { type: 'color', value: structural.secondLevelElements },
    }),
  }
}

// ── MultiRowCard — its own card structure ────────────────────────────────────

function writeMultiRowCardData({ plan, fonts, structural }) {
  // multiRowCard text was nearly invisible on dark backgrounds (secondLevel
  // grey on slate-900 fails contrast). Bump category labels and data labels
  // to use firstLevelElements (high-contrast) for both data and category.
  return {
    cardTitle: buildPbirCard({
      color:      { type: 'color',  value: structural.firstLevelElements },
      fontFamily: { type: 'string', value: fonts.titleFont },
      fontSize:   { type: 'double', value: 13 },
    }),
    dataLabels: buildPbirCard({
      color:      { type: 'color',  value: structural.firstLevelElements },
      fontFamily: { type: 'string', value: fonts.titleFont },
      fontSize:   { type: 'double', value: 22 },
      bold:       { type: 'bool',   value: true },
    }),
    categoryLabels: buildPbirCard({
      // Use firstLevelElements (not second) so labels are readable on dark cards
      color:      { type: 'color',  value: structural.firstLevelElements },
      fontFamily: { type: 'string', value: fonts.titleFont },
      fontSize:   { type: 'double', value: 11 },
    }),
    card: buildPbirCard({
      outline:        { type: 'string', value: 'BottomOnly' },
      outlineColor:   { type: 'color',  value: structural.thirdLevelElements },
      outlineWeight:  { type: 'int',    value: 1 },
      cardPadding:    { type: 'int',    value: 12 },
    }),
  }
}

// ── Table — the existing logic still works, but route through this writer ───

function writeTableData({ plan, fonts, structural }) {
  const t = plan.perFamily?.table || {}
  const banded = t.bandedRows
  return {
    grid: buildPbirCard({
      gridVertical:        { type: 'bool',   value: t.gridLines === 'verticalOnly' || t.gridLines === 'both' },
      gridHorizontal:      { type: 'bool',   value: t.gridLines === 'horizontalOnly' || t.gridLines === 'both' },
      gridHorizontalColor: { type: 'color',  value: structural.thirdLevelElements },
      gridVerticalColor:   { type: 'color',  value: structural.thirdLevelElements },
      outlineColor:        { type: 'color',  value: structural.thirdLevelElements },
      outlineWeight:       { type: 'int',    value: 1 },
      rowPadding:          { type: 'int',    value: t.rowPadding || 8 },
      textSize:            { type: 'double', value: 11 },
    }),
    columnHeaders: buildPbirCard({
      fontColor:  { type: 'color',  value: structural.firstLevelElements },
      backColor:  { type: 'color',  value: t.headerBg || structural.thirdLevelElements },
      bold:       { type: 'bool',   value: true },
      fontFamily: { type: 'string', value: fonts.titleFont },
      fontSize:   { type: 'double', value: 11 },
      alignment:  { type: 'string', value: 'Left' },
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
    total: buildPbirCard({
      totals:    { type: 'bool',   value: true },
      fontColor: { type: 'color',  value: structural.firstLevelElements },
      bold:      { type: 'bool',   value: true },
      outline:   { type: 'string', value: 'TopOnly' },
    }),
  }
}

// ── Action Button — state-discriminated brand styling ───────────────────────

/**
 * Action buttons in the Fluent 2 era use state-discriminated cards via the
 * newer `state:` syntax (replacing the older `$id` form deprecated in
 * PBI 2.145+). Each state takes its own outline/fill/icon/text values.
 *
 * Premium treatment: brand accent on hover, neutral default, subtle disabled.
 *
 * Note: this writer emits cards in the legacy `$id` form for compatibility
 * with PBIR-Legacy reports (which most existing reports still are). The newer
 * `state:` form would be used for fresh PBIR — we'll branch on format in a
 * future iteration.
 */
function writeActionButtonData({ plan, fonts, structural }) {
  const accent = plan.color?.defaultAccent || '#3B82F6'
  const accentDark = plan.chromeMode === 'dark'
  const cardBg = accentDark ? structural.secondaryBackground : '#FFFFFF'

  return {
    // Outline — per-state border for buttons. Subtle by default, accent on hover.
    outline: [
      { '$id': 'default',  properties: {
        transparency: { expr: { Literal: { Value: '0L' } } },
        weight:       { expr: { Literal: { Value: '1L' } } },
        roundEdge:    { expr: { Literal: { Value: '8L' } } },
        lineColor:    { solid: { color: { expr: { Literal: { Value: `'${structural.thirdLevelElements}'` } } } } },
      } },
      { '$id': 'hover',    properties: {
        transparency: { expr: { Literal: { Value: '0L' } } },
        weight:       { expr: { Literal: { Value: '1L' } } },
        lineColor:    { solid: { color: { expr: { Literal: { Value: `'${accent}'` } } } } },
      } },
      { '$id': 'selected', properties: {
        transparency: { expr: { Literal: { Value: '0L' } } },
        weight:       { expr: { Literal: { Value: '2L' } } },
        lineColor:    { solid: { color: { expr: { Literal: { Value: `'${accent}'` } } } } },
      } },
    ],
    // Fill — per-state background. Subtle by default, brand-tinted on hover.
    fill: [
      { properties: {
        show:         { expr: { Literal: { Value: 'true' } } },
      } },
      { '$id': 'default',  properties: {
        transparency: { expr: { Literal: { Value: '0L' } } },
        fillColor:    { solid: { color: { expr: { Literal: { Value: `'${cardBg}'` } } } } },
      } },
      { '$id': 'hover',    properties: {
        transparency: { expr: { Literal: { Value: '90L' } } },
        fillColor:    { solid: { color: { expr: { Literal: { Value: `'${accent}'` } } } } },
      } },
      { '$id': 'selected', properties: {
        transparency: { expr: { Literal: { Value: '0L' } } },
        fillColor:    { solid: { color: { expr: { Literal: { Value: `'${accent}'` } } } } },
      } },
    ],
    // Text — bold, brand-aware on hover
    text: [
      { '$id': 'default',  properties: {
        fontColor:  { solid: { color: { expr: { Literal: { Value: `'${structural.firstLevelElements}'` } } } } },
        fontFamily: { expr: { Literal: { Value: `'${fonts.titleFont.replace(/'/g, "''")}'` } } },
        fontSize:   { expr: { Literal: { Value: '11D' } } },
        bold:       { expr: { Literal: { Value: 'true' } } },
      } },
      { '$id': 'hover',    properties: {
        fontColor: { solid: { color: { expr: { Literal: { Value: `'${accent}'` } } } } },
      } },
      { '$id': 'selected', properties: {
        fontColor: { solid: { color: { expr: { Literal: { Value: `'#FFFFFF'` } } } } },
      } },
    ],
    // Icon — same color treatment as text
    icon: [
      { '$id': 'default',  properties: {
        iconColor:  { solid: { color: { expr: { Literal: { Value: `'${structural.firstLevelElements}'` } } } } },
        lineWeight: { expr: { Literal: { Value: '1L' } } },
      } },
      { '$id': 'hover',    properties: {
        iconColor: { solid: { color: { expr: { Literal: { Value: `'${accent}'` } } } } },
      } },
      { '$id': 'selected', properties: {
        iconColor: { solid: { color: { expr: { Literal: { Value: `'#FFFFFF'` } } } } },
      } },
    ],
  }
}

// ── Slicer — header + items, no chrome ───────────────────────────────────────

function writeSlicerData({ plan, fonts, structural }) {
  const sl = plan.perFamily?.slicer || {}
  // Legacy slicer reads `outline` (enum) — newer reads `outlineStyle` (int).
  // Write BOTH so the slicer's actual schema version finds what it needs.
  // The black bar at top in the previous apply was because outlineStyle=4
  // got interpreted weirdly without a matching outline enum value.
  return {
    header: buildPbirCard({
      show:          { type: 'bool',   value: sl.headerHide !== true },
      fontColor:     { type: 'color',  value: structural.firstLevelElements },
      background:    { type: 'color',  value: structural.background },
      outline:       { type: 'string', value: 'BottomOnly' },             // legacy enum
      outlineStyle:  { type: 'int',    value: sl.outlineStyle ?? 4 },     // numeric: 4 = BottomOnly
      outlineColor:  { type: 'color',  value: sl.outlineColor || structural.thirdLevelElements },
      outlineWeight: { type: 'int',    value: 1 },
      textSize:      { type: 'double', value: 11 },
      fontFamily:    { type: 'string', value: fonts.titleFont },
      bold:          { type: 'bool',   value: true },
    }),
    items: buildPbirCard({
      fontColor:    { type: 'color',  value: structural.firstLevelElements },  // bumped to firstLevel for readability
      background:   { type: 'color',  value: structural.background },
      outline:      { type: 'string', value: 'None' },
      outlineStyle: { type: 'int',    value: 0 },
      textSize:     { type: 'double', value: 11 },
      fontFamily:   { type: 'string', value: fonts.bodyFont },
    }),
  }
}

// ── Public dispatcher ────────────────────────────────────────────────────────

const LINE_FAMILY = new Set([
  'lineChart', 'areaChart', 'stackedAreaChart', 'hundredPercentStackedAreaChart',
  'lineStackedColumnComboChart', 'lineClusteredColumnComboChart', 'ribbonChart',
])

const COLUMN_BAR_FAMILY = new Set([
  'barChart', 'columnChart', 'clusteredBarChart', 'clusteredColumnChart',
  'stackedBarChart', 'hundredPercentStackedBarChart', 'hundredPercentStackedColumnChart',
  'waterfallChart',
])

const PIE_DONUT_FAMILY = new Set(['pieChart', 'donutChart'])

/**
 * Generate the data-bound objects bag for any visual. Returns null for
 * visual types we don't write (image/shape/button — those use 'skip' policy
 * in the applier and never call this).
 */
export function writeVisualData(visualType, plan, parsedVisual = null) {
  const canonical = canonicalize(visualType)
  const fonts = resolveFonts(plan)
  const structural = resolveStructural(plan)
  const ctx = { visualType: canonical, plan, fonts, structural, parsedVisual }

  if (LINE_FAMILY.has(canonical))         return writeLineData(ctx)
  if (COLUMN_BAR_FAMILY.has(canonical))   return writeCartesianData(ctx)
  if (PIE_DONUT_FAMILY.has(canonical))    return writePieDonutData(ctx)
  if (canonical === 'treemap')            return writePieDonutData(ctx)        // treemap shares part-to-whole props
  if (canonical === 'scatterChart')       return writeCartesianData(ctx)       // scatter uses cartesian axes
  if (canonical === 'funnel')             return writePieDonutData(ctx)
  if (canonical === 'card')               return writeCardData(ctx)
  if (canonical === 'cardVisual')         return writeCardVisualData(ctx)
  if (canonical === 'kpi')                return writeKpiData(ctx)
  if (canonical === 'gauge')              return writeGaugeData(ctx)
  if (canonical === 'multiRowCard')       return writeMultiRowCardData(ctx)
  if (canonical === 'tableEx')            return writeTableData(ctx)
  if (canonical === 'pivotTable')         return writeTableData(ctx)
  if (['slicer', 'advancedSlicerVisual', 'textSlicer', 'listSlicer'].includes(canonical)) return writeSlicerData(ctx)
  if (canonical === 'actionButton')       return writeActionButtonData(ctx)

  return null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s }
