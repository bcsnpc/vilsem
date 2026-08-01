/**
 * The 4 named design presets — complete plans the style applier can consume.
 *
 * Each preset is a full design plan: chrome treatment + typography pairing +
 * structural color ramp + page tokens + per-family visual overrides.
 *
 * Plans are JSON-serializable so they can be saved as profiles, edited by the
 * AI Director, and round-tripped through the preview bridge.
 *
 * The user can override any value on top of a preset (e.g. swap accent color,
 * change typography pairing) without losing other preset choices.
 */

import { CHROME_PRESETS, CHROME_EXCEPTIONS } from './chrome.js'
import { FONT_PAIRINGS } from './fontWhitelist.js'
import { STRUCTURAL_RAMPS, PAGE_TOKENS } from './structuralColors.js'
import { PREMIUM_SCALE } from './typography.js'
import { GUTTERS, PAGE_MARGINS, KPI_ROW_RULES } from './spacing.js'
import { premiumDataColors, sentimentColors } from './colorTheory.js'

// ── Preset 1: Elevated Cards ─────────────────────────────────────────────────

const ELEVATED_CARDS = {
  id:    'elevated_cards',
  label: 'Elevated Cards',
  description: 'Modern web-app feel with soft shadows on white cards over a calm gray page. Ideal for executive dashboards.',
  thumbnail: 'elevated_cards.svg',

  // What chrome to apply
  chrome:        'elevated',
  chromeMode:    'light',
  fontPairing:   'modern_sans',
  ramp:          'light',
  pageTokens:    'light',

  // Typography scale (uses PREMIUM_SCALE; can be overridden)
  typography: {
    pageTitle:         { size: 22, weight: 'Semibold' },
    kpiHeroValue:      { size: 36, weight: 'Semibold' },
    kpiLabel:          { size: 11, weight: 'Medium', uppercase: true, tracking: 0.02 },
    visualTitle:       { size: 14, weight: 'Semibold' },
    axisTickLabel:     { size: 10, weight: 'Regular' },
    dataLabel:         { size: 10, weight: 'Regular' },
    legend:            { size: 11, weight: 'Regular' },
    slicerHeader:      { size: 11, weight: 'Semibold', uppercase: true },
    tableColumnHeader: { size: 11, weight: 'Semibold', uppercase: true },
  },

  // Spacing
  layout: {
    gutter:        GUTTERS.standard,
    pageMargin:    PAGE_MARGINS.standard,
    kpiRowHeight:  KPI_ROW_RULES.recommendedHeight,
    snapToGrid:    true,
  },

  // Color treatment
  color: {
    // Generated from accent at apply-time; default uses Slate accent
    defaultAccent:  '#3B82F6',
    seriesStrategy: 'single-accent-with-grays',  // top series gets accent, rest gray
    minimum:        '#DBEAFE',
    center:         '#94A3B8',
    maximum:        '#1D4ED8',
    sentiment:      'matched-saturation',  // good/bad use sentiment hues at accent's saturation
  },

  // Per-visual-family overrides (applied via visualStyles[type]["*"])
  perFamily: {
    cartesian: {
      categoryAxisHideTitle: true,        // hide axis title; redundant with visual title
      valueAxisGridStyle:    'dotted',    // soft horizontal gridlines
      valueAxisGridColor:    '#E5E7EB',
      hideAxisLine:          true,
      legendPosition:        'TopCenter', // legend up top, free up canvas
      labelsShow:            'auto',      // let chart decide
    },
    indicator: {
      titleAlignment: 'left',
      hideSubTitle:   false,
    },
    table: {
      bandedRows:        true,
      bandedColorPrimary:   '#FFFFFF',
      bandedColorSecondary: '#FAFAFA',
      headerBg:             '#F3F4F6',
      headerWeight:         'Semibold',
      gridLines:            'horizontalOnly',
      rowPadding:           8,
    },
    slicer: {
      outlineStyle: 4,        // BottomOnly
      outlineColor: '#CBD5E1',
      headerHide:   false,
    },
  },

  // Hide chrome elements (visual header buttons, etc)
  visualHeader: {
    show: false,            // hide the gear-icon header bar globally
  },
}

// ── Preset 2: Flat Modern ────────────────────────────────────────────────────

const FLAT_MODERN = {
  id:    'flat_modern',
  label: 'Flat Modern',
  description: 'Crisp, professional. 1px borders, 8px corners, no shadows. Best for analytical dashboards with high data density.',
  thumbnail: 'flat_modern.svg',

  chrome:      'flat_modern',
  chromeMode:  'light',
  fontPairing: 'modern_sans',
  ramp:        'light',
  pageTokens:  'light',

  typography: ELEVATED_CARDS.typography,

  layout: {
    gutter:        GUTTERS.standard,
    pageMargin:    PAGE_MARGINS.standard,
    kpiRowHeight:  KPI_ROW_RULES.recommendedHeight,
    snapToGrid:    true,
  },

  color: {
    defaultAccent:  '#0F172A',                  // near-black accent for editorial feel
    seriesStrategy: 'single-accent-with-grays',
    minimum:        '#E2E8F0',
    center:         '#64748B',
    maximum:        '#0F172A',
    sentiment:      'matched-saturation',
  },

  perFamily: {
    cartesian: {
      ...ELEVATED_CARDS.perFamily.cartesian,
      valueAxisGridStyle: 'solid',
      valueAxisGridColor: '#F3F4F6',
    },
    indicator: ELEVATED_CARDS.perFamily.indicator,
    table:     {
      ...ELEVATED_CARDS.perFamily.table,
      gridLines: 'none',          // pure flat: no gridlines, only banded rows
    },
    slicer:    ELEVATED_CARDS.perFamily.slicer,
  },

  visualHeader: { show: false },
}

// ── Preset 3: Editorial Mono ─────────────────────────────────────────────────

const EDITORIAL_MONO = {
  id:    'editorial_mono',
  label: 'Editorial Mono',
  description: 'Magazine-style with section dividers, no card chrome, generous whitespace. Best for narrative dashboards.',
  thumbnail: 'editorial_mono.svg',

  chrome:      'section_divider',
  chromeMode:  'light',
  fontPairing: 'editorial',                    // Cambria titles + Segoe UI body
  ramp:        'warmLight',
  pageTokens:  'light',

  typography: {
    ...ELEVATED_CARDS.typography,
    pageTitle:    { size: 28, weight: 'Semibold' },     // larger for editorial
    visualTitle:  { size: 16, weight: 'Semibold' },
    kpiHeroValue: { size: 40, weight: 'Semibold' },
  },

  layout: {
    gutter:       GUTTERS.executive,
    pageMargin:   PAGE_MARGINS.executive,
    kpiRowHeight: KPI_ROW_RULES.recommendedHeightCalm,
    snapToGrid:   true,
  },

  color: {
    defaultAccent:  '#1C1917',                  // stone 900 — paper-feel
    seriesStrategy: 'single-accent-with-grays',
    minimum:        '#E7E5E4',
    center:         '#A8A29E',
    maximum:        '#1C1917',
    sentiment:      'matched-saturation',
  },

  perFamily: {
    cartesian: {
      categoryAxisHideTitle: true,
      valueAxisGridStyle:    'none',           // no gridlines — minimal
      valueAxisGridColor:    'transparent',
      hideAxisLine:          true,
      legendPosition:        'BottomCenter',
      labelsShow:            'on',             // direct labels instead of axis
    },
    indicator: { titleAlignment: 'left' },
    table: {
      bandedRows: false,
      gridLines:  'none',
      headerBg:   'transparent',
      rowPadding: 12,
    },
    slicer: ELEVATED_CARDS.perFamily.slicer,
  },

  visualHeader: { show: false },
}

// ── Preset 4: Premium Dark ───────────────────────────────────────────────────

const PREMIUM_DARK = {
  id:    'premium_dark',
  label: 'Premium Dark',
  description: 'Translucent dark cards on near-black canvas with subtle borders. Best for executive presentations and TV displays.',
  thumbnail: 'premium_dark.svg',

  chrome:      'glass_dark',
  chromeMode:  'dark',
  fontPairing: 'modern_sans',
  ramp:        'dark',
  pageTokens:  'dark',

  typography: {
    ...ELEVATED_CARDS.typography,
    kpiHeroValue: { size: 40, weight: 'Semibold' },
  },

  layout: {
    gutter:       GUTTERS.standard,
    pageMargin:   PAGE_MARGINS.executive,
    kpiRowHeight: KPI_ROW_RULES.recommendedHeight,
    snapToGrid:   true,
  },

  color: {
    defaultAccent:  '#A78BFA',                  // soft violet — readable on dark
    seriesStrategy: 'single-accent-with-grays',
    minimum:        '#1E1B4B',
    center:         '#475569',
    maximum:        '#A78BFA',
    sentiment:      'matched-saturation',
  },

  perFamily: {
    cartesian: {
      categoryAxisHideTitle: true,
      valueAxisGridStyle:    'dotted',
      valueAxisGridColor:    '#1E293B',
      hideAxisLine:          true,
      legendPosition:        'TopCenter',
      labelsShow:            'auto',
    },
    indicator: { titleAlignment: 'left' },
    table: {
      bandedRows:           true,
      bandedColorPrimary:   '#1A1F2E',
      bandedColorSecondary: '#111827',
      headerBg:             '#0B0B14',
      gridLines:            'horizontalOnly',
      rowPadding:           8,
    },
    slicer: {
      ...ELEVATED_CARDS.perFamily.slicer,
      outlineColor: '#334155',
    },
  },

  visualHeader: { show: false },
}

// ── Export ───────────────────────────────────────────────────────────────────

export const PRESETS = {
  elevated_cards:  ELEVATED_CARDS,
  flat_modern:     FLAT_MODERN,
  editorial_mono:  EDITORIAL_MONO,
  premium_dark:    PREMIUM_DARK,
}

export const PRESET_LIST = [
  ELEVATED_CARDS,
  FLAT_MODERN,
  EDITORIAL_MONO,
  PREMIUM_DARK,
]

export function getPreset(id) {
  return PRESETS[id] || ELEVATED_CARDS
}

/**
 * Build a complete design plan from a preset id + optional brand kit overrides.
 *
 *   buildPlan('elevated_cards', { accent: '#FF5733' })
 *
 * Returns the merged plan as a plain object the styleApplier can consume.
 */
export function buildPlan(presetId, brandKit = {}) {
  const preset = getPreset(presetId)
  const accent = brandKit.accent || preset.color.defaultAccent
  return {
    presetId:        preset.id,
    presetLabel:     preset.label,
    chrome:          preset.chrome,
    chromeMode:      brandKit.mode || preset.chromeMode,
    fontPairing:     brandKit.fontPairing || preset.fontPairing,
    brandFont:       brandKit.brandFont || null,    // optional
    ramp:            preset.ramp,
    pageTokens:      preset.pageTokens,
    typography:      { ...preset.typography, ...(brandKit.typography || {}) },
    layout:          { ...preset.layout, ...(brandKit.layout || {}) },
    color:           {
      ...preset.color,
      defaultAccent:  accent,
      dataColors:     premiumDataColors(accent, preset.chromeMode),
      sentiment:      sentimentColors(accent),
    },
    perFamily:       preset.perFamily,
    visualHeader:    preset.visualHeader,
    chromeExceptions: CHROME_EXCEPTIONS,
  }
}
