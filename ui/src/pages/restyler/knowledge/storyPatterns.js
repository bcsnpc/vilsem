/**
 * Dashboard story patterns — how a report's purpose informs its design.
 *
 * The AI Design Director uses these to recommend layout + chrome + typography
 * combinations based on what the user says the dashboard is for. A monitoring
 * dashboard wants different treatment than an executive narrative.
 *
 * Source: Stephen Few ("Information Dashboard Design"), Cole Nussbaumer
 *         Knaflic ("Storytelling with Data"), IBM Carbon dashboard guidelines.
 */

// ── Story archetypes ─────────────────────────────────────────────────────────

export const STORY_PATTERNS = {

  executive_monitoring: {
    label: 'Executive Monitoring',
    description: 'For C-suite — answers the question "is the business healthy right now?" at a glance.',
    audienceSize: 'small (5-20 people)',
    refreshCadence: 'daily / weekly',
    layoutSignature: {
      pattern:        'executive_kpi_top',
      densityTarget:  'low',
      pagesExpected:  '1-3',
      visualsPerPage: '5-9',
    },
    designRecommendations: {
      preset:    'elevated_cards',
      chrome:    'elevated',
      typography: 'modern_sans',
      kpiCount:  '4-5 across top row, identical heights',
      heroChart: 'single trend (line) or top-N bar; 60-70% of canvas below KPI row',
      detailZone: 'compact tables/breakdowns at bottom-right',
      colorRule: 'single brand accent + 5 grays; sentiment for variance arrows only',
    },
    avoid: [
      'Too many slicers (>3 erodes the at-a-glance feel)',
      'Mixed chrome treatments',
      'Bright color palettes — calm wins',
    ],
  },

  analytical_explorer: {
    label: 'Analytical Explorer',
    description: 'For analysts — answers "why?" Cross-filtering and slicers do the work.',
    audienceSize: 'medium (20-200)',
    refreshCadence: 'real-time / hourly',
    layoutSignature: {
      pattern:        'analytical_left_rail',
      densityTarget:  'high',
      pagesExpected:  '3-8',
      visualsPerPage: '8-15',
    },
    designRecommendations: {
      preset:    'flat_modern',
      chrome:    'flat-modern',
      typography: 'modern_sans',
      slicerRail: 'left rail 240-280px, vertically stacked, slicers bottom-only outline',
      heroChart: 'no single hero — multiple peer charts',
      colorRule: 'curated 5-color categorical palette; consistent across all visuals',
      gridDensity: '12-column with 12-16px gutters',
    },
    avoid: [
      'Heavy chrome that competes with data',
      'Drop shadows — too noisy at high density',
      'Sentiment colors on non-sentiment data',
    ],
  },

  operational_status: {
    label: 'Operational Status',
    description: 'For ops teams — answers "is anything broken?" Alerting + thresholds.',
    audienceSize: 'small (5-50)',
    refreshCadence: 'real-time',
    layoutSignature: {
      pattern:        'monitoring_dense',
      densityTarget:  'very high',
      pagesExpected:  '1-2',
      visualsPerPage: '12-20',
    },
    designRecommendations: {
      preset:    'flat_modern',
      chrome:    'flat-modern, dense padding (8-10px)',
      typography: 'modern_sans',
      kpiTreatment: 'compact KPI cards; sentiment color when threshold exceeded',
      gridDensity: '12-column with 12px gutters',
      colorRule: 'sentiment-driven: good/warning/bad; muted defaults',
    },
    avoid: [
      'Calm whitespace — operators need density',
      'Long titles — abbreviate ruthlessly',
      'Gradients / sequential palettes — noise on alerts',
    ],
  },

  narrative_briefing: {
    label: 'Narrative Briefing',
    description: 'For board / stakeholder presentations — tells a specific story with a beginning, middle, end.',
    audienceSize: 'small (board, exec team)',
    refreshCadence: 'monthly / quarterly',
    layoutSignature: {
      pattern:        'editorial',
      densityTarget:  'low',
      pagesExpected:  '5-12 (one story per page)',
      visualsPerPage: '2-5',
    },
    designRecommendations: {
      preset:    'editorial_mono',
      chrome:    'section-divider',
      typography: 'editorial',
      kpiTreatment: 'large hero numbers + descriptive text alongside',
      heroChart: 'single annotated chart per page with explanatory subtitle',
      colorRule: 'monochromatic — accent only on the focal data point',
      typography2: 'serif titles (Cambria) + sans body for editorial feel',
    },
    avoid: [
      'Slicers (this is a curated story, not interactive)',
      'KPI rows — replace with named hero numbers in copy',
      'Multiple visual types per page — one chart that earns its space',
    ],
  },

  scorecard: {
    label: 'Scorecard',
    description: 'For team performance review — uniform card grid, identical treatment per metric.',
    audienceSize: 'medium (50-500)',
    refreshCadence: 'weekly',
    layoutSignature: {
      pattern:        'scorecard_grid',
      densityTarget:  'medium',
      pagesExpected:  '1',
      visualsPerPage: '9-16',
    },
    designRecommendations: {
      preset:    'elevated_cards',
      chrome:    'elevated',
      typography: 'modern_sans',
      gridLayout: 'uniform 3x3 or 4x4 cards; identical width/height',
      kpiTreatment: 'each card = one metric + sentiment + sparkline',
      colorRule: 'sentiment per card based on threshold; neutral structure',
    },
    avoid: [
      'Different visual types per card (breaks the rhythm)',
      'Mixed sizes (kills the grid)',
      'Page chrome other than uniform cards',
    ],
  },

  presentation_screen: {
    label: 'Presentation / TV Screen',
    description: 'For boardroom / hallway TVs — readable from 6+ feet, dark mode by default.',
    audienceSize: 'public',
    refreshCadence: 'real-time',
    layoutSignature: {
      pattern:        'executive_kpi_top',
      densityTarget:  'very low',
      pagesExpected:  '1',
      visualsPerPage: '4-6',
    },
    designRecommendations: {
      preset:    'premium_dark',
      chrome:    'glass-dark',
      typography: 'modern_sans (sized up — 120-140% standard)',
      kpiTreatment: 'huge hero values (44-56pt); sentiment color',
      colorRule: 'high-contrast accent on dark; saturated where needed for distance reading',
      visualHeader: 'always hidden',
    },
    avoid: [
      'Detail tables (unreadable from distance)',
      'More than 6 visuals per screen',
      'Light backgrounds (TV glare)',
    ],
  },

}

// ── Pattern detection ────────────────────────────────────────────────────────

/**
 * Heuristically infer the most likely story pattern from a parsed report's
 * structure. Used by the AI Design Director when the user doesn't explicitly
 * tell us what the dashboard is for.
 *
 * Returns { id, confidence } where confidence is 0..1.
 */
export function inferStoryPattern(parsed) {
  const visuals = parsed.pages?.flatMap(p => p.visuals || []) || []
  const totalVisuals = visuals.length
  const pageCount    = parsed.pages?.length || 1

  // Count visual types
  const types = {}
  for (const v of visuals) {
    const t = v.visualType || 'unknown'
    types[t] = (types[t] || 0) + 1
  }
  const kpiCount    = (types.card || 0) + (types.cardVisual || 0) + (types.kpi || 0) + (types.multiRowCard || 0)
  const slicerCount = (types.slicer || 0) + (types.advancedSlicerVisual || 0) + (types.textSlicer || 0)
  const tableCount  = (types.tableEx || 0) + (types.pivotTable || 0)
  const visualsPerPage = totalVisuals / pageCount

  // Story signatures
  const candidates = []

  if (kpiCount >= 3 && visualsPerPage <= 9 && pageCount <= 3) {
    candidates.push({ id: 'executive_monitoring', confidence: 0.7 })
  }
  if (slicerCount >= 3 && visualsPerPage >= 8) {
    candidates.push({ id: 'analytical_explorer', confidence: 0.8 })
  }
  if (visualsPerPage >= 12 && tableCount > 0) {
    candidates.push({ id: 'operational_status', confidence: 0.6 })
  }
  if (pageCount >= 5 && visualsPerPage <= 5) {
    candidates.push({ id: 'narrative_briefing', confidence: 0.7 })
  }
  if (kpiCount >= 6 && Object.keys(types).length <= 3) {
    candidates.push({ id: 'scorecard', confidence: 0.7 })
  }

  if (!candidates.length) {
    return { id: 'analytical_explorer', confidence: 0.3 }   // safe default
  }
  candidates.sort((a, b) => b.confidence - a.confidence)
  return candidates[0]
}
