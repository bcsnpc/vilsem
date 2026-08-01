/**
 * Verified Power BI native visualType strings + family taxonomy.
 *
 * Source: microsoft/json-schemas, microsoft/powerbi-desktop-samples,
 *         NatVanG/PBI-Inspector, Doc 3 research.
 *
 * Important corrections from the research:
 *   - There is NO `stackedColumnChart` — column charts use `columnChart`
 *     (default stacked) and `clusteredColumnChart`.
 *   - The matrix visual's PBIR `visualType` is `pivotTable`, not `matrix`.
 *   - Tables use `tableEx`, not `table`.
 */

// ── All verified native visualType strings ───────────────────────────────────

export const NATIVE_VISUAL_TYPES = [
  // Cartesian
  'barChart', 'columnChart', 'clusteredBarChart', 'clusteredColumnChart',
  'stackedBarChart', 'hundredPercentStackedBarChart', 'hundredPercentStackedColumnChart',
  'lineChart', 'areaChart', 'stackedAreaChart', 'hundredPercentStackedAreaChart',
  'lineStackedColumnComboChart', 'lineClusteredColumnComboChart',
  'ribbonChart', 'waterfallChart',
  // Distribution
  'pieChart', 'donutChart', 'treemap', 'funnel', 'scatterChart',
  // Indicator
  'gauge', 'kpi', 'card', 'cardVisual', 'multiRowCard', 'scorecard',
  // Slicers
  'slicer', 'advancedSlicerVisual', 'textSlicer', 'listSlicer',
  // Table / Matrix
  'tableEx', 'pivotTable',
  // Maps
  'map', 'filledMap', 'shapeMap', 'azureMap',
  // Containers / shapes
  'actionButton', 'basicShape', 'shape', 'image', 'textbox',
  // Navigation
  'bookmarkNavigator', 'pageNavigator',
  // Specialty / advanced
  'decompositionTreeVisual', 'qnaVisual', 'keyDriversVisual',
  'pythonVisual', 'scriptVisual', 'rdlVisual', 'aiNarratives',
]

// ── Family taxonomy ──────────────────────────────────────────────────────────

export const VISUAL_FAMILIES = {
  cartesian: [
    'barChart', 'columnChart', 'clusteredBarChart', 'clusteredColumnChart',
    'stackedBarChart', 'hundredPercentStackedBarChart', 'hundredPercentStackedColumnChart',
    'lineChart', 'areaChart', 'stackedAreaChart', 'hundredPercentStackedAreaChart',
    'lineStackedColumnComboChart', 'lineClusteredColumnComboChart',
    'ribbonChart', 'waterfallChart',
  ],
  partToWhole: ['pieChart', 'donutChart', 'treemap', 'funnel'],
  point:       ['scatterChart'],
  indicator:   ['gauge', 'kpi', 'card', 'cardVisual', 'multiRowCard', 'scorecard'],
  slicer:      ['slicer', 'advancedSlicerVisual', 'textSlicer', 'listSlicer'],
  table:       ['tableEx', 'pivotTable'],
  map:         ['map', 'filledMap', 'shapeMap', 'azureMap'],
  shape:       ['actionButton', 'basicShape', 'shape', 'image', 'textbox'],
  navigation:  ['bookmarkNavigator', 'pageNavigator'],
  specialty:   ['decompositionTreeVisual', 'qnaVisual', 'keyDriversVisual',
                'pythonVisual', 'scriptVisual', 'rdlVisual', 'aiNarratives'],
}

export function familyOf(visualType) {
  for (const [family, types] of Object.entries(VISUAL_FAMILIES)) {
    if (types.includes(visualType)) return family
  }
  return 'unknown'
}

// ── Aliases (legacy → canonical) ─────────────────────────────────────────────

export const VISUAL_TYPE_ALIASES = {
  matrix:             'pivotTable',
  table:              'tableEx',
  stackedColumnChart: 'columnChart',  // no such type — column is stacked by default
}

export function canonicalize(visualType) {
  return VISUAL_TYPE_ALIASES[visualType] || visualType
}

// ── Display labels (for UI) ──────────────────────────────────────────────────

export const VISUAL_DISPLAY_LABEL = {
  barChart:                              'Bar chart',
  columnChart:                           'Column chart (stacked)',
  clusteredBarChart:                     'Clustered bar chart',
  clusteredColumnChart:                  'Clustered column chart',
  stackedBarChart:                       'Stacked bar chart',
  hundredPercentStackedBarChart:         '100% stacked bar',
  hundredPercentStackedColumnChart:      '100% stacked column',
  lineChart:                             'Line chart',
  areaChart:                             'Area chart',
  stackedAreaChart:                      'Stacked area',
  ribbonChart:                           'Ribbon chart',
  waterfallChart:                        'Waterfall',
  pieChart:                              'Pie chart',
  donutChart:                            'Donut chart',
  treemap:                               'Treemap',
  funnel:                                'Funnel',
  scatterChart:                          'Scatter / bubble',
  gauge:                                 'Gauge',
  kpi:                                   'KPI',
  card:                                  'Card (legacy)',
  cardVisual:                            'Card (new)',
  multiRowCard:                          'Multi-row card',
  scorecard:                             'Scorecard',
  slicer:                                'Slicer',
  advancedSlicerVisual:                  'Advanced slicer',
  textSlicer:                            'Text slicer',
  listSlicer:                            'List slicer',
  tableEx:                               'Table',
  pivotTable:                            'Matrix',
}

// ── Custom-visual detection ──────────────────────────────────────────────────

const NATIVE_SET = new Set(NATIVE_VISUAL_TYPES)

export function isNativeVisual(visualType) {
  return NATIVE_SET.has(visualType)
}

export function isCustomVisual(visualType) {
  // Custom visuals appear with their AppSource GUID, e.g.
  // "deneb7E15AEF80B9E4D4F8E12924291ECE89A".
  return !isNativeVisual(visualType) && /^[a-zA-Z][a-zA-Z0-9]+[A-F0-9]{16,}/.test(visualType || '')
}
