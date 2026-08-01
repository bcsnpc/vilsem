/**
 * Visual selection / replacement intelligence — the rules of "use a bar
 * chart for X, not a pie chart."
 *
 * The restyler does NOT auto-replace visual types in v1 — only flags problems
 * via Smart Visual Type Suggestions (Step 10). User opts in per-suggestion.
 *
 * Source: Stephen Few "Information Dashboard Design", Cole Nussbaumer Knaflic,
 *         IBCS standards.
 */

import { canonicalize } from './visualTypeMap.js'

// ── Anti-patterns: "this visual is wrong for the data" ───────────────────────

/**
 * Each anti-pattern: detect(visual) → null | { issue, suggestion, confidence }
 *
 * Confidence is 0..1. Only surface ones >= 0.7 by default.
 */
export const ANTI_PATTERNS = [

  {
    id: 'AP-1',
    label: 'Pie chart with too many slices',
    detect(visual) {
      const t = canonicalize(visual.visualType)
      if (!['pieChart', 'donutChart'].includes(t)) return null
      const seriesCount = visual.fields?.values?.length || 0
      const categoryCount = visual.fields?.category?.length || 0
      // Heuristic: too many distinct categories
      if (categoryCount > 5 || seriesCount > 5) {
        return {
          issue: 'Pie/donut with >5 slices — humans cannot accurately compare slice areas at this density.',
          suggestion: { newType: 'barChart', reason: 'Bar chart shows ranking and comparison clearly at any category count.' },
          confidence: 0.85,
        }
      }
      return null
    },
  },

  {
    id: 'AP-2',
    label: 'Single-value line chart',
    detect(visual) {
      const t = canonicalize(visual.visualType)
      if (!['lineChart', 'areaChart'].includes(t)) return null
      const seriesCount = visual.fields?.values?.length || 0
      const xCount = visual.fields?.category?.length || 0
      if (xCount === 1 && seriesCount === 1) {
        return {
          issue: 'Line chart with 1 category — degenerates to a single point. Consider a card or bar chart.',
          suggestion: { newType: 'card', reason: 'Single value reads better as a hero KPI card.' },
          confidence: 0.9,
        }
      }
      return null
    },
  },

  {
    id: 'AP-3',
    label: 'Dual-axis without legend',
    detect(visual) {
      const t = canonicalize(visual.visualType)
      if (!['lineClusteredColumnComboChart', 'lineStackedColumnComboChart'].includes(t)) return null
      const legend = visual.objects?.legend?.[0]?.properties
      const legendShow = legend?.show?.expr?.Literal?.Value
      if (legendShow === 'false') {
        return {
          issue: 'Dual-axis combo chart without a visible legend leaves viewers guessing which axis a series uses.',
          suggestion: { newType: null, reason: 'Enable legend or split into two charts.' },
          confidence: 0.85,
        }
      }
      return null
    },
  },

  {
    id: 'AP-4',
    label: 'Table where chart would tell the story',
    detect(visual) {
      const t = canonicalize(visual.visualType)
      if (!['tableEx', 'pivotTable'].includes(t)) return null
      const rowCount    = visual._rowCountEstimate || 0
      const measureCount = visual.fields?.values?.length || 0
      // Small numeric tables with a single comparable measure → bar
      if (rowCount > 0 && rowCount <= 12 && measureCount === 1) {
        return {
          issue: 'Small table with one measure — comparison is faster as a bar chart.',
          suggestion: { newType: 'barChart', reason: 'Bar chart beats numeric table for "which is biggest" questions.' },
          confidence: 0.65,
        }
      }
      return null
    },
  },

  {
    id: 'AP-5',
    label: '3D effects',
    detect(visual) {
      // 3D charts in PBI are a property on certain chart types; we surface a recommendation regardless
      const dim = visual.objects?.shapes?.[0]?.properties?.is3D?.expr?.Literal?.Value
      if (dim === 'true') {
        return {
          issue: '3D chart distorts perspective and harms accuracy of comparison.',
          suggestion: { newType: null, reason: 'Switch to flat 2D rendering.' },
          confidence: 0.95,
        }
      }
      return null
    },
  },

  {
    id: 'AP-6',
    label: 'Stacked area with too many series',
    detect(visual) {
      const t = canonicalize(visual.visualType)
      if (t !== 'stackedAreaChart') return null
      const seriesCount = visual.fields?.values?.length || 0
      if (seriesCount > 5) {
        return {
          issue: 'Stacked area with >5 series — middle bands become unreadable.',
          suggestion: { newType: 'lineChart', reason: 'Multi-line is clearer; or switch to top-3 + "Others" rollup.' },
          confidence: 0.7,
        }
      }
      return null
    },
  },

  {
    id: 'AP-7',
    label: 'Scatter without color encoding',
    detect(visual) {
      const t = canonicalize(visual.visualType)
      if (t !== 'scatterChart') return null
      const legendField = visual.fields?.series?.length || 0
      const dataPointCount = visual._rowCountEstimate || 0
      if (legendField === 0 && dataPointCount > 30) {
        return {
          issue: 'Scatter with 30+ points and no legend/series — outliers and clusters get lost.',
          suggestion: { newType: null, reason: 'Add a Legend role or color-by category to surface patterns.' },
          confidence: 0.6,
        }
      }
      return null
    },
  },

  {
    id: 'AP-8',
    label: 'Funnel with missing conversion',
    detect(visual) {
      const t = canonicalize(visual.visualType)
      if (t !== 'funnel') return null
      const showConv = visual.objects?.percentBarLabel?.[0]?.properties?.show?.expr?.Literal?.Value
      if (showConv !== 'true') {
        return {
          issue: 'Funnel without conversion percentages obscures the drop-off pattern that funnels exist to show.',
          suggestion: { newType: null, reason: 'Enable percentBarLabel.show to display drop-off rates.' },
          confidence: 0.75,
        }
      }
      return null
    },
  },

]

// ── Best-fit visual recommendations ──────────────────────────────────────────

/**
 * Given an analytical task, what visual types fit?
 * (Used by the AI Director when proposing improvements.)
 */
export const TASK_TO_VISUAL = {
  rankingComparison:        ['barChart', 'columnChart', 'multiRowCard'],
  partToWhole:              ['donutChart', 'pieChart', 'treemap', 'stackedBarChart'],
  trendOverTime:            ['lineChart', 'areaChart', 'columnChart'],
  distribution:             ['scatterChart', 'columnChart'],
  correlation:              ['scatterChart'],
  geographic:               ['filledMap', 'azureMap', 'shapeMap'],
  hierarchy:                ['treemap', 'decompositionTreeVisual'],
  variance:                 ['waterfallChart', 'barChart'],
  flow:                     ['funnel', 'ribbonChart'],
  status:                   ['kpi', 'card', 'cardVisual', 'gauge'],
  comparison:               ['clusteredBarChart', 'clusteredColumnChart', 'lineChart'],
  detailLookup:             ['tableEx', 'pivotTable'],
}

// ── Run all anti-pattern checks ──────────────────────────────────────────────

export function detectAntiPatterns(visual, threshold = 0.7) {
  const out = []
  for (const ap of ANTI_PATTERNS) {
    try {
      const result = ap.detect(visual)
      if (result && result.confidence >= threshold) {
        out.push({ ruleId: ap.id, label: ap.label, ...result })
      }
    } catch { /* ignore */ }
  }
  return out
}
