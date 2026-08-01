/**
 * Typography knowledge — text class hierarchy, premium scale, and what each
 * theme `textClasses` entry actually controls in PBI.
 *
 * The "agency tell" is a tight, intentional scale — PBI's default uses 12pt
 * for everything. Premium dashboards use a Major Third (1.25x) or Perfect
 * Fourth (1.333x) ratio for visual hierarchy.
 *
 * Source: Doc 2 + Doc 3 research, Microsoft Learn theme docs.
 */

// ── Text class hierarchy (12 classes) ────────────────────────────────────────

/**
 * The 12 text classes in PBI theme JSON, with what they actually control.
 * Primary classes (callout/header/title/label) are the inheritance roots —
 * the other 8 inherit from these unless explicitly overridden.
 *
 * Default values per Doc 3 research.
 */
export const TEXT_CLASSES = {
  // ── Primary classes ──
  callout: {
    primary: true,
    inherits: null,
    defaultFont: 'DIN',
    defaultSize: 45,
    defaultColor: '#252423',
    controls: ['Card data labels', 'KPI indicators'],
  },
  header: {
    primary: true,
    inherits: null,
    defaultFont: 'Segoe UI Semibold',
    defaultSize: 12,
    defaultColor: '#252423',
    controls: ['Key Influencers headers'],
  },
  title: {
    primary: true,
    inherits: null,
    defaultFont: 'DIN',
    defaultSize: 12,
    defaultColor: '#252423',
    controls: ['Category/value axis title', 'Multi-row card title', 'Slicer header'],
  },
  label: {
    primary: true,
    inherits: null,
    defaultFont: 'Segoe UI',
    defaultSize: 10,
    defaultColor: '#252423',
    controls: ['Table/matrix column headers, row headers, grid, values'],
  },

  // ── Secondary classes (inherit from primary) ──
  largeTitle: {
    primary: false,
    inherits: 'title',
    defaultSize: 14,
    controls: ['Visual title'],
  },
  semiboldLabel: {
    primary: false,
    inherits: 'label',
    defaultFont: 'Segoe UI Semibold',
    controls: ['Key Influencers profile text'],
  },
  largeLabel: {
    primary: false,
    inherits: 'label',
    defaultSize: 12,
    controls: ['Multi-row card data labels'],
  },
  smallLabel: {
    primary: false,
    inherits: 'label',
    defaultSize: 9,
    controls: ['Reference line labels', 'Slicer date/numeric input', 'Search box'],
  },
  lightLabel: {
    primary: false,
    inherits: 'label',
    defaultColor: '#605E5C',
    controls: ['Legend', 'Button text', 'Category axis labels', 'Funnel', 'Gauge target', 'Slicer items'],
  },
  boldLabel: {
    primary: false,
    inherits: 'label',
    defaultFont: 'Segoe UI Bold',
    controls: ['Matrix subtotals & grand totals', 'Table totals'],
  },
  largeLightLabel: {
    primary: false,
    inherits: 'label',
    defaultColor: '#605E5C',
    defaultSize: 12,
    controls: ['Card category labels', 'Gauge labels', 'Multi-row card category labels'],
  },
  smallLightLabel: {
    primary: false,
    inherits: 'label',
    defaultColor: '#605E5C',
    defaultSize: 9,
    controls: ['Data labels', 'Value-axis labels'],
  },
}

// ── Premium typography scale ─────────────────────────────────────────────────

/**
 * Recommended premium scale. Notice the deliberate spacing between sizes —
 * this is what creates visual hierarchy. Not every visual gets every size.
 *
 * The "agency tell-tale" details:
 *   - Small uppercase tracked labels for KPIs and slicer/table headers (1-2% letter-spacing)
 *   - Bigger callout for KPIs (32-40 vs PBI default 45 — slightly smaller reads modern)
 *   - Visual title at 14-16 (vs PBI default 12) — small bump but huge perception change
 *   - Axis tick labels at 10-11 (vs PBI default 12) — quieter, draws eye to data
 */
export const PREMIUM_SCALE = {
  pageTitle:         { size: 22, weight: 'Semibold', color: 'firstLevelElements',  notes: 'Optional — prefer report header bar 40-50px tall' },
  kpiHeroValue:      { size: 36, weight: 'Semibold', color: 'firstLevelElements',  notes: 'Default 45 in PBI; 32-40 reads more modern; drop to 28 for density' },
  kpiLabel:          { size: 11, weight: 'Medium',   color: 'secondLevelElements', uppercase: true, tracking: 0.02, notes: 'AGENCY TELL: small uppercase tracked labels' },
  visualTitle:       { size: 14, weight: 'Semibold', color: 'firstLevelElements',  notes: 'PBI default 12pt DIN; Segoe UI Semibold 14pt is the modern look' },
  visualSubtitle:    { size: 11, weight: 'Regular',  color: 'secondLevelElements', notes: 'Reserve for context like "Last 12 months"' },
  axisTickLabel:     { size: 10, weight: 'Regular',  color: 'secondLevelElements', notes: 'Use lightLabel text class; drop from PBI default 12pt' },
  dataLabel:         { size: 10, weight: 'Regular',  color: 'firstLevelElements',  notes: 'Use smallLightLabel only on dense charts' },
  legend:            { size: 11, weight: 'Regular',  color: 'secondLevelElements', notes: 'Or hide entirely and use direct labeling' },
  slicerHeader:      { size: 11, weight: 'Semibold', color: 'firstLevelElements',  uppercase: true, tracking: 0.02, notes: 'Pair with outlineStyle 4 (BottomOnly)' },
  slicerItem:        { size: 11, weight: 'Regular',  color: 'secondLevelElements' },
  tableColumnHeader: { size: 11, weight: 'Semibold', color: 'firstLevelElements',  uppercase: true, tracking: 0.01, notes: 'Banded rows: backColorPrimary #FFFFFF, backColorSecondary #FAFAFA' },
  tableValue:        { size: 11, weight: 'Regular',  color: 'firstLevelElements'  },
  tableTotals:       { size: 11, weight: 'Bold',     color: 'firstLevelElements',  notes: 'total[0].outline: TopOnly' },
  footnote:          { size: 9,  weight: 'Regular',  color: 'fourthLevelElements' },
}

// ── Typography ratios (alternate scales) ─────────────────────────────────────

/**
 * Common typography ratios. Major Third (1.25x) is most common in dashboard UI.
 * Use these to generate alternate scales from a base size.
 */
export const TYPE_RATIOS = {
  minorSecond:   1.067,
  majorSecond:   1.125,
  minorThird:    1.2,
  majorThird:    1.25,    // ★ recommended for dashboards
  perfectFourth: 1.333,
  augmentedFourth: 1.414,
  perfectFifth:  1.5,
  goldenRatio:   1.618,
}

/**
 * Generate a typography scale from a base size + ratio.
 *
 *   makeScale(11, 1.25, 6)
 *   → [11, 13.75, 17.19, 21.48, 26.86, 33.57]
 */
export function makeScale(baseSize, ratio, steps = 6) {
  const out = [baseSize]
  let cur = baseSize
  for (let i = 1; i < steps; i++) {
    cur = cur * ratio
    out.push(Math.round(cur * 10) / 10)
  }
  return out
}

// ── Theme JSON textClasses generator ─────────────────────────────────────────

/**
 * Build the theme JSON `textClasses` block from a font pairing + scale.
 * Uses fontFace (theme convention) — visual cards typically use fontFamily.
 *
 *   buildTextClasses({
 *     titleFont: "'Segoe UI Semibold', wf_segoe-ui_semibold, ...",
 *     bodyFont:  "'Segoe UI', wf_segoe-ui_normal, ...",
 *     calloutFont: 'DIN, wf_standard-font, ...',
 *     calloutSize: 36,
 *     baseSize: 11,
 *   })
 */
export function buildTextClasses({
  titleFont,
  bodyFont,
  calloutFont,
  calloutSize  = 36,
  titleSize    = 14,
  headerSize   = 11,
  bodySize     = 11,
  primaryColor = '#252423',
  secondaryColor = '#605E5C',
}) {
  return {
    callout: { fontFace: calloutFont || titleFont, fontSize: calloutSize, color: primaryColor },
    header:  { fontFace: titleFont,                 fontSize: headerSize,  color: primaryColor },
    title:   { fontFace: titleFont,                 fontSize: titleSize,   color: primaryColor },
    label:   { fontFace: bodyFont,                  fontSize: bodySize,    color: primaryColor },
  }
}
