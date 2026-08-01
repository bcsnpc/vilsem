/**
 * themeBuilder — convert a design plan into a Power BI theme JSON object.
 *
 * The theme is the "global default" layer. Per-visual overrides written by
 * styleApplier always win on top of theme — but theme is what makes new
 * visuals (added later) automatically inherit the design system.
 *
 * Source: Doc 1 + Doc 2 + Doc 3 — verified against microsoft theme schema
 *         2.149 (powerbi-desktop-samples).
 */

import {
  PRESETS, getPreset, buildPlan,
} from './knowledge/presets.js'
import {
  buildChromeVisualStyle, getChrome, CHROME_EXCEPTIONS,
} from './knowledge/chrome.js'
import {
  buildTextClasses,
} from './knowledge/typography.js'
import {
  buildStructuralColors, PAGE_TOKENS,
} from './knowledge/structuralColors.js'
import {
  premiumDataColors, sentimentColors,
} from './knowledge/colorTheory.js'
import {
  FONT_PAIRINGS, FALLBACK_CHAINS, brandFontChain, isServiceSafe,
} from './knowledge/fontWhitelist.js'

// ── Plan defaults / merge ────────────────────────────────────────────────────

/**
 * Resolve the typography fonts from a plan. Honors:
 *   - plan.typography.brandFont (any string — wraps in fallback chain)
 *   - plan.fontPairing (named pairing key)
 *   - falls back to Modern Sans
 */
function resolveFonts(plan) {
  const pairingKey = plan.fontPairing || plan.typography?.pairing || 'modern_sans'
  const pairing = FONT_PAIRINGS[pairingKey] || FONT_PAIRINGS.modern_sans
  const brandFont = plan.brandFont || plan.typography?.brandFont || null

  const titles = brandFont ? brandFontChain(brandFont) : pairing.titles
  return {
    titleFont:   titles,
    bodyFont:    brandFont ? brandFontChain(brandFont) : pairing.body,
    numericFont: pairing.numeric,
    brandFont,
    isBrandFontSafe: brandFont ? isServiceSafe(brandFont) : true,
  }
}

/**
 * Resolve structural color ramp from plan.
 *   plan.color.structural (object) → use as-is
 *   plan.ramp ('light' | 'dark' | 'warmLight') → use named ramp
 *   default 'light'
 */
function resolveStructural(plan) {
  if (plan.color?.structural) return plan.color.structural
  return buildStructuralColors(plan.ramp || plan.chromeMode || 'light')
}

// ── Build theme JSON ─────────────────────────────────────────────────────────

/**
 * Generate a complete Power BI theme.json object from a design plan.
 *
 *   buildThemeJson(plan)
 *   → { name, $schema, dataColors, foreground, background, ...,
 *       textClasses: {...}, visualStyles: { "*": { "*": {...} }, ...family-specific... } }
 */
export function buildThemeJson(plan, parsed = null) {
  const fonts        = resolveFonts(plan)
  const structural   = resolveStructural(plan)
  const dataColors   = plan.color?.dataColors || premiumDataColors(plan.color?.defaultAccent || '#3B82F6', plan.chromeMode || 'light')
  const sentiment    = plan.color?.sentiment   || sentimentColors(plan.color?.defaultAccent || '#3B82F6')
  const titleSize    = plan.typography?.visualTitle?.size    || 14
  const calloutSize  = plan.typography?.kpiHeroValue?.size   || 36
  const headerSize   = plan.typography?.slicerHeader?.size   || 11
  const bodySize     = plan.typography?.dataLabel?.size      || 11

  const theme = {
    name:    plan.profileName || `Semantica — ${plan.presetLabel || plan.presetId || 'Custom'}`,
    $schema: 'https://raw.githubusercontent.com/microsoft/powerbi-desktop-samples/main/Report%20Theme%20JSON%20Schema/reportThemeSchema-2.149.json',

    // ── Colors ──
    dataColors,
    good:    sentiment.good,
    neutral: sentiment.neutral,
    bad:     sentiment.bad,
    maximum: plan.color?.maximum || dataColors[0],
    center:  plan.color?.center  || structural.secondLevelElements,
    minimum: plan.color?.minimum || structural.thirdLevelElements,
    null:    structural.fourthLevelElements,

    // ── Structural colors ──
    foreground:           structural.firstLevelElements,
    firstLevelElements:   structural.firstLevelElements,
    secondLevelElements:  structural.secondLevelElements,
    thirdLevelElements:   structural.thirdLevelElements,
    fourthLevelElements:  structural.fourthLevelElements,
    background:           structural.background,
    secondaryBackground:  structural.secondaryBackground,
    tableAccent:          structural.tableAccent || dataColors[0],

    // ── Text classes (4 primary; secondaries inherit) ──
    textClasses: buildTextClasses({
      titleFont:    fonts.titleFont,
      bodyFont:     fonts.bodyFont,
      calloutFont:  fonts.titleFont,
      titleSize, calloutSize, headerSize, bodySize,
      primaryColor:   structural.firstLevelElements,
      secondaryColor: structural.secondLevelElements,
    }),

    // ── Visual styles ──
    visualStyles: buildVisualStyles(plan, fonts, structural),
  }

  return theme
}

// ── visualStyles construction ────────────────────────────────────────────────

function buildVisualStyles(plan, fonts, structural) {
  const styles = {}

  // ── Wildcard (all visuals, default state) — chrome + cross-cutting cards ──
  styles['*'] = { '*': buildWildcardCard(plan, fonts, structural) }

  // ── Per-family overrides ──
  const perFamily = plan.perFamily || {}

  // Cartesian charts share most settings — apply to each named visualType
  const cartesianTypes = [
    'barChart', 'columnChart', 'clusteredBarChart', 'clusteredColumnChart',
    'stackedBarChart', 'hundredPercentStackedBarChart', 'hundredPercentStackedColumnChart',
    'lineChart', 'areaChart', 'stackedAreaChart', 'hundredPercentStackedAreaChart',
    'lineStackedColumnComboChart', 'lineClusteredColumnComboChart',
    'ribbonChart', 'waterfallChart',
  ]
  if (perFamily.cartesian) {
    const cartesianBlock = buildCartesianCard(perFamily.cartesian, fonts, structural)
    for (const t of cartesianTypes) {
      styles[t] = { '*': cartesianBlock }
    }
  }

  // Tables / matrices
  if (perFamily.table) {
    const tableBlock = buildTableCard(perFamily.table, fonts, structural)
    styles.tableEx    = { '*': tableBlock }
    styles.pivotTable = { '*': tableBlock }
  }

  // Slicers
  if (perFamily.slicer) {
    styles.slicer = { '*': buildSlicerCard(perFamily.slicer, fonts, structural) }
    // Advanced slicer + textSlicer inherit when unspecified
  }

  // Indicator family — KPI cards, cards, multiRowCard
  if (perFamily.indicator) {
    const indicatorBlock = buildIndicatorCard(perFamily.indicator, fonts, structural)
    styles.card         = { '*': indicatorBlock }
    styles.cardVisual   = { '*': indicatorBlock }
    styles.multiRowCard = { '*': indicatorBlock }
    styles.kpi          = { '*': indicatorBlock }
  }

  // Chrome exceptions for visuals that shouldn't get full padding
  for (const [visualType, override] of Object.entries(CHROME_EXCEPTIONS)) {
    styles[visualType] = styles[visualType] || { '*': {} }
    if (override.padding) {
      styles[visualType]['*'].padding = [override.padding]
    }
  }

  return styles
}

// ── Wildcard card ────────────────────────────────────────────────────────────

function buildWildcardCard(plan, fonts, structural) {
  const chromeBlock = buildChromeVisualStyle(plan.chrome, plan.chromeMode || 'light')
  const titleFontSize = plan.typography?.visualTitle?.size || 14

  return {
    // Chrome (background, border, dropShadow, padding, divider)
    ...chromeBlock,

    // Universal title
    title: [{
      show:       true,
      fontFamily: fonts.titleFont,
      fontSize:   titleFontSize,
      fontColor:  { solid: { color: structural.firstLevelElements } },
      alignment:  'left',
      bold:       false,
    }],

    // Hide visual headers globally (the gear icon clutter)
    visualHeader: plan.visualHeader?.show === false ? [{
      show: false,
    }] : [{ show: true }],
  }
}

// ── Cartesian (chart) card ───────────────────────────────────────────────────

function buildCartesianCard(cartesianPlan, fonts, structural) {
  const labelColor = structural.secondLevelElements
  const gridColor  = structural.thirdLevelElements
  const showAxisTitle = !cartesianPlan.categoryAxisHideTitle
  const gridStyle  = cartesianPlan.valueAxisGridStyle || 'dotted'

  return {
    categoryAxis: [{
      show:           true,
      labelColor:     { solid: { color: labelColor } },
      fontFamily:     fonts.bodyFont,
      fontSize:       10,
      showAxisTitle,
      titleColor:     { solid: { color: structural.firstLevelElements } },
      titleFontFamily: fonts.titleFont,
      titleFontSize:  11,
      gridlineShow:   gridStyle !== 'none' ? false : false,  // category axis gridlines almost always off for premium
    }],
    valueAxis: [{
      show:              true,
      labelColor:        { solid: { color: labelColor } },
      fontFamily:        fonts.bodyFont,
      fontSize:          10,
      showAxisTitle:     false,
      gridlineShow:      gridStyle !== 'none',
      gridlineColor:     { solid: { color: cartesianPlan.valueAxisGridColor || gridColor } },
      gridlineStyle:     gridStyle === 'none' ? 'solid' : gridStyle,
      gridlineThickness: 1,
    }],
    legend: [{
      show:        true,
      position:    cartesianPlan.legendPosition || 'TopCenter',
      showTitle:   false,
      labelColor:  { solid: { color: labelColor } },
      fontFamily:  fonts.bodyFont,
      fontSize:    11,
    }],
    labels: [{
      show:       cartesianPlan.labelsShow === 'on' ? true : false,
      color:      { solid: { color: structural.firstLevelElements } },
      fontFamily: fonts.bodyFont,
      fontSize:   10,
    }],
  }
}

// ── Indicator (cards / KPI) card ─────────────────────────────────────────────

function buildIndicatorCard(indicatorPlan, fonts, structural) {
  return {
    // Card data label (the big number)
    labels: [{
      color:      { solid: { color: structural.firstLevelElements } },
      fontFamily: fonts.titleFont,
    }],
    // Card category label (the small name above/below)
    categoryLabels: [{
      show:       true,
      color:      { solid: { color: structural.secondLevelElements } },
      fontFamily: fonts.bodyFont,
      fontSize:   11,
    }],
  }
}

// ── Table / matrix card ──────────────────────────────────────────────────────

function buildTableCard(tablePlan, fonts, structural) {
  const banded = tablePlan.bandedRows
  const gridLines = tablePlan.gridLines || 'horizontalOnly'

  return {
    grid: [{
      gridVertical:        gridLines === 'verticalOnly' || gridLines === 'both',
      gridHorizontal:      gridLines === 'horizontalOnly' || gridLines === 'both',
      gridVerticalColor:   { solid: { color: structural.thirdLevelElements } },
      gridHorizontalColor: { solid: { color: structural.thirdLevelElements } },
      outlineColor:        { solid: { color: structural.thirdLevelElements } },
      outlineWeight:       1,
      rowPadding:          tablePlan.rowPadding || 8,
      textSize:            11,
    }],
    columnHeaders: [{
      fontColor:   { solid: { color: structural.firstLevelElements } },
      backColor:   { solid: { color: tablePlan.headerBg || structural.thirdLevelElements } },
      bold:        tablePlan.headerWeight === 'Semibold' || tablePlan.headerWeight === 'Bold',
      fontFamily:  fonts.titleFont,
      fontSize:    11,
      alignment:   'Left',
    }],
    values: [{
      fontColor:           { solid: { color: structural.firstLevelElements } },
      backColorPrimary:    banded ? { solid: { color: tablePlan.bandedColorPrimary   || structural.background } } : undefined,
      backColorSecondary:  banded ? { solid: { color: tablePlan.bandedColorSecondary || structural.secondaryBackground } } : undefined,
      bandedRowBackColors: !!banded,
      fontSize:            11,
      fontFamily:          fonts.bodyFont,
    }],
    total: [{
      totals:    true,
      fontColor: { solid: { color: structural.firstLevelElements } },
      bold:      true,
      outline:   'TopOnly',
    }],
  }
}

// ── Slicer card ──────────────────────────────────────────────────────────────

function buildSlicerCard(slicerPlan, fonts, structural) {
  return {
    header: [{
      show:        slicerPlan.headerHide === true ? false : true,
      fontColor:   { solid: { color: structural.firstLevelElements } },
      background:  { solid: { color: structural.background } },
      outlineStyle: slicerPlan.outlineStyle ?? 4,            // 4 = BottomOnly
      outlineColor: { solid: { color: slicerPlan.outlineColor || structural.thirdLevelElements } },
      outlineWeight: 1,
      textSize:    11,
      fontFamily:  fonts.titleFont,
      bold:        true,
    }],
    items: [{
      fontColor:    { solid: { color: structural.secondLevelElements } },
      background:   { solid: { color: structural.background } },
      outlineStyle: 0,
      textSize:     11,
      fontFamily:   fonts.bodyFont,
    }],
  }
}

// ── Page-level styling block (for page.json or report.json) ──────────────────

/**
 * Generate page-level objects (background, wallpaper, outspace) from the plan.
 * Returns a plain JSON object to merge into page.json.objects (PBIR) or
 * sections[].config.objects (Legacy).
 */
export function buildPageObjects(plan) {
  const tokens = (plan.pageTokens && PAGE_TOKENS[plan.pageTokens]) || PAGE_TOKENS[plan.chromeMode || 'light']
  return {
    background: [{
      properties: {
        color:        { solid: { color: tokens.canvasBackground } },
        transparency: 0,
      },
    }],
    outspace: [{
      properties: {
        color:        { solid: { color: tokens.outspaceBackground } },
        transparency: 0,
      },
    }],
  }
}

// ── Filter pane styling ──────────────────────────────────────────────────────

/**
 * Generate report-level objects.outspacePane + filterCard (the right-edge
 * filter pane that ships with PBI Service).
 */
export function buildFilterPaneObjects(plan) {
  const tokens = (plan.pageTokens && PAGE_TOKENS[plan.pageTokens]) || PAGE_TOKENS[plan.chromeMode || 'light']
  const fonts  = resolveFonts(plan)
  const structural = resolveStructural(plan)

  return {
    outspacePane: [{
      properties: {
        backgroundColor:  { solid: { color: tokens.filterPaneBackground } },
        foregroundColor:  { solid: { color: structural.firstLevelElements } },
        titleSize:        13,
        headerSize:       11,
        fontFamily:       fonts.titleFont,
        border:           false,
        transparency:     0,
      },
    }],
    filterCard: [
      {
        $id: 'Applied',
        properties: {
          backgroundColor: { solid: { color: tokens.canvasBackground } },
          foregroundColor: { solid: { color: structural.firstLevelElements } },
          border:          true,
          borderColor:     { solid: { color: structural.thirdLevelElements } },
          transparency:    0,
        },
      },
      {
        $id: 'Available',
        properties: {
          backgroundColor: { solid: { color: tokens.filterPaneBackground } },
          foregroundColor: { solid: { color: structural.secondLevelElements } },
          border:          true,
          borderColor:     { solid: { color: structural.thirdLevelElements } },
        },
      },
    ],
  }
}

// ── Compatibility helpers ────────────────────────────────────────────────────

export { resolveFonts, resolveStructural }
