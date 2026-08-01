/**
 * PBI structural color classes — the 6 classes that define non-data UI elements.
 *
 * The difference between a "default" and a "premium" report is largely
 * structural color discipline. Default reports use a mishmash of grays;
 * premium reports use a single, intentional 4-step ramp.
 *
 * Source: Microsoft Learn theming docs, Doc 1 + Doc 3 research.
 */

// ── The 6 structural classes ─────────────────────────────────────────────────

/**
 * Each entry: { aliases, controls, defaultLight, defaultDark }
 *
 * `aliases` lists alternate property names (theme JSON accepts either form).
 * `controls` is the canonical map of what visual elements this class drives.
 * Default values are starting points — adjust for accessibility per palette.
 */
export const STRUCTURAL_CLASSES = {
  firstLevelElements: {
    aliases: ['foreground'],
    controls: [
      'Trend lines', 'Textbox text',
      'Table/matrix values & totals',
      'Data bars axis',
      'Card data labels', 'Gauge callout', 'KPI text/goal',
      'Slicer items in focus', 'Dropdown items', 'Numeric input', 'Header text',
      'Map leader lines',
      'Modern tooltip text',
    ],
    role:         'primary text — body content, hero values, focal text',
    defaultLight: '#252423',
    defaultDark:  '#F1F5F9',
  },
  secondLevelElements: {
    aliases: ['foregroundNeutralSecondary'],
    controls: [
      'Light secondary text classes',
      'Legend label', 'Axis label',
      'Table/matrix header',
      'Gauge target', 'KPI trend axis',
      'Slicer slider/items/outline',
      'Line-chart hover',
      'Multi-row card title',
      'Ribbon chart stroke',
      'Button text/icon/outline',
    ],
    role:         'secondary text — labels, axis ticks, supporting copy',
    defaultLight: '#605E5C',
    defaultDark:  '#94A3B8',
  },
  thirdLevelElements: {
    aliases: ['backgroundLight'],
    controls: [
      'Axis gridlines',
      'Table/matrix grid',
      'Slicer header background in focus',
      'Multi-row card outline',
      'Shape fill',
      'Gauge arc background',
      'Applied filter card background',
    ],
    role:         'subtle structural lines — gridlines, dividers, background fills',
    defaultLight: '#F3F2F1',
    defaultDark:  '#1E293B',
  },
  fourthLevelElements: {
    aliases: ['foregroundNeutralTertiary'],
    controls: [
      'Legend dimmed',
      'Card category labels',
      'Multi-row card category labels & bar',
      'Funnel conversion stroke',
      'Disabled button text/icon',
    ],
    role:         'tertiary / muted — disabled states, dimmed elements, footnotes',
    defaultLight: '#B3B0AD',
    defaultDark:  '#475569',
  },
  background: {
    aliases: [],
    controls: [
      'Label background inside data points',
      'Slicer dropdown items background',
      'Donut/treemap stroke',
      'Combo chart background',
      'Button fill',
      'Filter pane background',
      'Modern tooltip background',
    ],
    role:         'primary surface — page background, card fills',
    defaultLight: '#FFFFFF',
    defaultDark:  '#0B0B14',
  },
  secondaryBackground: {
    aliases: ['backgroundNeutral'],
    controls: [
      'Table/matrix grid outline',
      'Shape-map default',
      'Ribbon-chart ribbon when match-series off',
      'Modern tooltip separator',
    ],
    role:         'secondary surface — alternating rows, subtle elevation',
    defaultLight: '#FAFAFA',
    defaultDark:  '#111827',
  },
}

// ── Recommended dark/light ramps ─────────────────────────────────────────────

/**
 * Premium 4-step ramps for dark and light modes. These are the starting point
 * — `colorTheory.js` adjusts them for AA contrast against the chosen palette.
 */
export const STRUCTURAL_RAMPS = {
  light: {
    firstLevelElements:   '#0F172A',  // Slate 900
    secondLevelElements:  '#475569',  // Slate 600
    thirdLevelElements:   '#E2E8F0',  // Slate 200
    fourthLevelElements:  '#94A3B8',  // Slate 400
    background:           '#FFFFFF',
    secondaryBackground:  '#F7F9FC',
  },
  dark: {
    firstLevelElements:   '#F1F5F9',  // Slate 100
    secondLevelElements:  '#94A3B8',  // Slate 400
    thirdLevelElements:   '#334155',  // Slate 700
    fourthLevelElements:  '#475569',  // Slate 600
    background:           '#0B0B14',  // Near-black
    secondaryBackground:  '#1A1F2E',  // Slate 900-ish
  },
  // For a "warm" alternative (paper-feel light)
  warmLight: {
    firstLevelElements:   '#1C1917',  // Stone 900
    secondLevelElements:  '#57534E',  // Stone 600
    thirdLevelElements:   '#E7E5E4',  // Stone 200
    fourthLevelElements:  '#A8A29E',  // Stone 400
    background:           '#FAFAF9',  // Stone 50
    secondaryBackground:  '#F5F5F4',  // Stone 100
  },
}

/**
 * Build a complete theme JSON structural color block from a chosen ramp.
 */
export function buildStructuralColors(rampKey = 'light') {
  const ramp = STRUCTURAL_RAMPS[rampKey] || STRUCTURAL_RAMPS.light
  return {
    foreground:               ramp.firstLevelElements,
    firstLevelElements:       ramp.firstLevelElements,
    secondLevelElements:      ramp.secondLevelElements,
    thirdLevelElements:       ramp.thirdLevelElements,
    fourthLevelElements:      ramp.fourthLevelElements,
    background:               ramp.background,
    secondaryBackground:      ramp.secondaryBackground,
    // tableAccent — usually the first dataColor; can also be a brand neutral
    tableAccent:              ramp.thirdLevelElements,
  }
}

// ── Page wallpaper / outspace ────────────────────────────────────────────────

/**
 * Page-level color tokens. Outspace = the area outside the page canvas
 * (visible in PBI Service when canvas is fixed). Filter pane styling matches.
 */
export const PAGE_TOKENS = {
  light: {
    pageBackground:    '#F7F9FC',      // off-white, calmer than pure #FFF
    canvasBackground:  '#FFFFFF',
    outspaceBackground:'#F1F5F9',
    filterPaneBackground: '#FFFFFF',
  },
  dark: {
    pageBackground:    '#0B0B14',
    canvasBackground:  '#111827',
    outspaceBackground:'#0B0B14',
    filterPaneBackground: '#1A1F2E',
  },
}
