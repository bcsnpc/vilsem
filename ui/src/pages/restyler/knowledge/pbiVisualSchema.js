/**
 * Comprehensive map of PBI native visual formatting objects + their key
 * properties. This is the single source of truth for "what can I touch on
 * a barChart?" — used by the audit engine, style applier, and design director.
 *
 * Two parallel object groups per visual:
 *   - `objects` (PBIR) / `singleVisual.objects` (legacy):
 *       Data-bound formatting (axes, legend, data points, labels, plot area)
 *   - `visualContainerObjects` (PBIR) / `singleVisual.vcObjects` (legacy):
 *       Visual container chrome (background, border, dropShadow, padding,
 *       title, subtitle, divider, spacing, visualHeader, etc.)
 *
 * Theme JSON exposes the same object names under
 *   visualStyles["<visualType>"]["<style>"]["<objectName>"]
 *
 * Sources: Doc 3 (most comprehensive), microsoft/json-schemas, Doc 1 + Doc 2.
 *
 * NOTE: Microsoft does NOT publish a single authoritative catalog of every
 * raw formatting card per visual. This map is built from cross-referencing
 * the public theme schema, community templates, PBI-Inspector, and Deneb's
 * PBIR Implementation Guide. Treat as "high-confidence, version-sensitive"
 * — schema versions bump monthly with Desktop releases.
 */

// ── Common chrome (every visual gets these via vcObjects / visualContainerObjects) ──

export const COMMON_CHROME_CARDS = {
  background: {
    properties: {
      show:          { type: 'bool',   describe: 'Toggle background fill' },
      color:         { type: 'color',  describe: 'Background color' },
      transparency:  { type: 'int',    describe: 'Percent transparency 0-100' },
      image:         { type: 'string', describe: 'Background image URL (optional)' },
    },
  },
  border: {
    properties: {
      show:    { type: 'bool',  describe: 'Toggle border' },
      color:   { type: 'color', describe: 'Border color' },
      radius:  { type: 'int',   describe: 'Corner radius in px' },
      weight:  { type: 'int',   describe: 'Border thickness in px' },
    },
  },
  dropShadow: {
    properties: {
      show:         { type: 'bool',   describe: 'Toggle shadow' },
      color:        { type: 'color',  describe: 'Shadow color' },
      position:     { type: 'enum',   values: ['Outer', 'Inner', 'Custom'] },
      preset:       { type: 'enum',   values: ['Default', 'Outer', 'Inner', 'Custom'] },
      angle:        { type: 'int',    describe: 'Shadow angle (0-360)' },
      distance:     { type: 'int',    describe: 'Shadow offset distance' },
      blur:         { type: 'int',    describe: 'Blur intensity' },
      transparency: { type: 'int',    describe: 'Shadow transparency 0-100' },
    },
  },
  padding: {
    properties: {
      top:    { type: 'int' },
      right:  { type: 'int' },
      bottom: { type: 'int' },
      left:   { type: 'int' },
    },
  },
  title: {
    properties: {
      show:        { type: 'bool' },
      text:        { type: 'string' },
      fontFamily:  { type: 'string' },
      fontSize:    { type: 'double' },
      fontColor:   { type: 'color' },
      background:  { type: 'color' },
      alignment:   { type: 'enum', values: ['Left', 'Center', 'Right'] },
      bold:        { type: 'bool' },
      italic:      { type: 'bool' },
      underline:   { type: 'bool' },
      titleWrap:   { type: 'bool' },
    },
  },
  subTitle: {
    properties: {
      show:       { type: 'bool' },
      text:       { type: 'string' },
      fontFamily: { type: 'string' },
      fontSize:   { type: 'double' },
      fontColor:  { type: 'color' },
      alignment:  { type: 'enum', values: ['Left', 'Center', 'Right'] },
    },
  },
  divider: {
    properties: {
      show:          { type: 'bool' },
      color:         { type: 'color' },
      style:         { type: 'enum', values: ['solid', 'dashed', 'dotted'] },
      width:         { type: 'int' },
      ignorePadding: { type: 'bool' },
    },
  },
  spacing: {
    properties: {
      customizeSpacing:    { type: 'bool' },
      verticalSpacing:     { type: 'int' },
      spaceBelowTitle:     { type: 'int' },
      spaceBelowSubTitle:  { type: 'int' },
      spaceBelowTitleArea: { type: 'int' },
    },
  },
  visualHeader: {
    properties: {
      show:                          { type: 'bool' },
      background:                    { type: 'color' },
      border:                        { type: 'color' },
      foreground:                    { type: 'color' },
      transparency:                  { type: 'int' },
      // 12 button visibility flags
      showFilterRestatementButton:   { type: 'bool' },
      showOptionsMenu:               { type: 'bool' },
      showSeeDataLayoutToggleButton: { type: 'bool' },
      showPinButton:                 { type: 'bool' },
      showDrillDownExpandButton:     { type: 'bool' },
      showDrillDownLevelButton:      { type: 'bool' },
      showDrillToggleButton:         { type: 'bool' },
      showDrillUpButton:             { type: 'bool' },
      showDrillRoleSelector:         { type: 'bool' },
      showVisualErrorButton:         { type: 'bool' },
      showVisualWarningButton:       { type: 'bool' },
      showVisualInformationButton:   { type: 'bool' },
    },
  },
  lockAspect: {
    properties: { show: { type: 'bool' } },
  },
  stylePreset: {
    properties: { name: { type: 'string', describe: 'Named style preset key' } },
  },
  general: {
    properties: {
      responsive:     { type: 'bool' },
      keepLayerOrder: { type: 'bool' },
      altText:        { type: 'string' },
      outline:        { type: 'string' },
      bookmark:       { type: 'string' },
    },
  },
}

// ── Cartesian charts (bar, column, line, area, ribbon, waterfall) ────────────

const CARTESIAN_DATA_CARDS = {
  dataPoint: {
    properties: {
      defaultColor:       { type: 'color' },
      showAllDataPoints:  { type: 'bool' },
      fill:               { type: 'color', describe: 'Per-series via selector.metadata' },
      fillRule:           { type: 'object', describe: 'Gradient — minimum/center/maximum' },
    },
  },
  categoryAxis: {
    properties: {
      show:                   { type: 'bool' },
      axisType:               { type: 'enum', values: ['categorical', 'continuous'] },
      position:               { type: 'enum', values: ['Left', 'Right', 'Bottom'] },
      axisScale:              { type: 'enum', values: ['Linear', 'Log'] },
      start:                  { type: 'double' },
      end:                    { type: 'double' },
      labelColor:             { type: 'color' },
      fontSize:               { type: 'double' },
      fontFamily:             { type: 'string' },
      labelDisplayUnits:      { type: 'enum', values: ['Auto', 'None', 'Thousands', 'Millions', 'Billions', 'Trillions'] },
      labelPrecision:         { type: 'string', describe: '"Auto" or numeric' },
      concatenateLabels:      { type: 'bool' },
      preferredCategoryWidth: { type: 'int' },
      maxMarginFactor:        { type: 'double' },
      innerPadding:           { type: 'int' },
      showAxisTitle:          { type: 'bool' },
      axisStyle:              { type: 'enum', values: ['both', 'showTitleOnly', 'showUnitOnly'] },
      titleColor:             { type: 'color' },
      titleText:              { type: 'string' },
      titleFontSize:          { type: 'double' },
      titleFontFamily:        { type: 'string' },
      gridlineShow:           { type: 'bool' },
      gridlineColor:          { type: 'color' },
      gridlineThickness:      { type: 'int' },
      gridlineStyle:          { type: 'enum', values: ['solid', 'dashed', 'dotted'] },
    },
  },
  valueAxis: {
    properties: {
      show:               { type: 'bool' },
      position:           { type: 'enum', values: ['Left', 'Right'] },
      axisScale:          { type: 'enum', values: ['Linear', 'Log'] },
      start:              { type: 'double' },
      end:                { type: 'double' },
      secStart:           { type: 'double' },
      secEnd:             { type: 'double' },
      labelColor:         { type: 'color' },
      fontSize:           { type: 'double' },
      fontFamily:         { type: 'string' },
      labelDisplayUnits:  { type: 'enum' },
      labelPrecision:     { type: 'string' },
      showAxisTitle:      { type: 'bool' },
      axisStyle:          { type: 'enum' },
      color:              { type: 'color' },
      titleText:          { type: 'string' },
      titleFontSize:      { type: 'double' },
      titleFontFamily:    { type: 'string' },
      gridlineShow:       { type: 'bool' },
      gridlineColor:      { type: 'color' },
      gridlineThickness:  { type: 'int' },
      gridlineStyle:      { type: 'enum' },
    },
  },
  legend: {
    properties: {
      show:        { type: 'bool' },
      position:    { type: 'enum', values: ['Top', 'Bottom', 'Right', 'Left', 'TopCenter', 'BottomCenter', 'RightCenter', 'LeftCenter'] },
      showTitle:   { type: 'bool' },
      titleText:   { type: 'string' },
      labelColor:  { type: 'color' },
      fontSize:    { type: 'double' },
      fontFamily:  { type: 'string' },
      bold:        { type: 'bool' },
      italic:      { type: 'bool' },
    },
  },
  labels: {
    properties: {
      show:                   { type: 'bool' },
      color:                  { type: 'color' },
      labelDisplayUnits:      { type: 'enum' },
      labelPrecision:         { type: 'string' },
      fontSize:               { type: 'double' },
      fontFamily:             { type: 'string' },
      bold:                   { type: 'bool' },
      italic:                 { type: 'bool' },
      labelOrientation:       { type: 'enum', values: ['horizontal', 'vertical'] },
      labelPosition:          { type: 'enum', values: ['Auto', 'Inside end', 'Outside end', 'Inside center', 'Inside base'] },
      enableBackground:       { type: 'bool' },
      backgroundColor:        { type: 'color' },
      backgroundTransparency: { type: 'int' },
      preserveWhitespace:     { type: 'bool' },
    },
  },
  plotArea: {
    properties: {
      transparency: { type: 'int' },
    },
  },
  plotAreaBackground: {
    properties: {
      show:         { type: 'bool' },
      color:        { type: 'color' },
      transparency: { type: 'int' },
      image:        { type: 'string' },
    },
  },
  // Line/area-specific
  lineStyles: {
    properties: {
      strokeWidth:  { type: 'int' },
      lineStyle:    { type: 'enum', values: ['solid', 'dashed', 'dotted'] },
      stepped:      { type: 'bool' },
      showMarker:   { type: 'bool' },
      markerShape:  { type: 'enum' },
      markerSize:   { type: 'int' },
      markerColor:  { type: 'color' },
    },
  },
  // Reference line / band cards (axis-anchored)
  referenceLine: {
    properties: { show: { type: 'bool' }, value: { type: 'double' }, lineColor: { type: 'color' }, transparency: { type: 'int' }, style: { type: 'enum' } },
  },
  // Trend line / forecast
  trend: {
    properties: { show: { type: 'bool' }, lineColor: { type: 'color' }, transparency: { type: 'int' }, style: { type: 'enum' } },
  },
  forecast: {
    properties: { show: { type: 'bool' }, lineColor: { type: 'color' }, confidenceBandStyle: { type: 'enum' } },
  },
  zoomSlider: {
    properties: { show: { type: 'bool' }, showLabels: { type: 'bool' }, showTooltip: { type: 'bool' } },
  },
}

// ── Pie/donut/treemap-specific cards ─────────────────────────────────────────

const PARTTOWHOLE_DATA_CARDS = {
  legend: CARTESIAN_DATA_CARDS.legend,
  labels: CARTESIAN_DATA_CARDS.labels,
  detailLabels: {
    properties: {
      show:        { type: 'bool' },
      color:       { type: 'color' },
      fontFamily:  { type: 'string' },
      fontSize:    { type: 'double' },
      labelStyle:  { type: 'enum', values: ['Category', 'Data value', 'Category, percent of total', 'Both', 'Percent of total', 'Data value, percent of total'] },
      labelPosition: { type: 'enum', values: ['Outside', 'Inside'] },
    },
  },
  slices: {
    properties: {
      innerRadiusRatio: { type: 'int', describe: 'Donut hole percentage (0-95)' },
      strokeColor:      { type: 'color' },
      strokeWidth:      { type: 'int' },
    },
  },
  rotation: { properties: { value: { type: 'int' } } },
}

// ── Card / KPI / Gauge ───────────────────────────────────────────────────────

const INDICATOR_CARDS = {
  // Legacy single-value card
  card_labels: {
    properties: {
      color:             { type: 'color' },
      labelDisplayUnits: { type: 'enum' },
      labelPrecision:    { type: 'string' },
      fontSize:          { type: 'double' },
      fontFamily:        { type: 'string' },
      bold:              { type: 'bool' },
    },
  },
  card_categoryLabels: {
    properties: {
      show:       { type: 'bool' },
      color:      { type: 'color' },
      fontSize:   { type: 'double' },
      fontFamily: { type: 'string' },
    },
  },
  card_wordWrap:  { properties: { show: { type: 'bool' } } },
  card_accentBar: { properties: { show: { type: 'bool' }, color: { type: 'color' }, weight: { type: 'int' } } },
  // KPI specific
  kpi_indicator: {
    properties: { fontFamily: { type: 'string' }, fontSize: { type: 'double' }, color: { type: 'color' } },
  },
  kpi_trendline: { properties: { show: { type: 'bool' }, transparency: { type: 'int' } } },
  kpi_goals:     { properties: { goalText: { type: 'string' }, distanceText: { type: 'string' }, color: { type: 'color' } } },
  kpi_directionAndStatus: {
    properties: {
      direction:    { type: 'enum', values: ['PositiveIsGood', 'NegativeIsGood'] },
      statusColors: { type: 'object' },
    },
  },
  // Gauge specific
  gauge_axis: {
    properties: {
      min:    { type: 'double' },
      max:    { type: 'double' },
      target: { type: 'double' },
    },
  },
  gauge_dataPoint: { properties: { fillColor: { type: 'color' }, targetColor: { type: 'color' } } },
  gauge_calloutValue: {
    properties: { color: { type: 'color' }, fontSize: { type: 'double' }, fontFamily: { type: 'string' } },
  },
}

// ── Slicer (classic + advanced) ──────────────────────────────────────────────

const SLICER_CARDS = {
  general: {
    properties: {
      outlineColor:  { type: 'color' },
      outlineWeight: { type: 'int' },
      orientation:   { type: 'enum', values: ['horizontal', 'vertical'] },
      responsive:    { type: 'bool' },
    },
  },
  data: {
    properties: {
      mode:          { type: 'enum', values: ['Basic', 'Dropdown', 'Between', 'Before', 'After', 'List', 'Relative'] },
      relativeRange: { type: 'enum' },
    },
  },
  selection: {
    properties: {
      selectAllCheckboxEnabled: { type: 'bool' },
      singleSelect:             { type: 'bool' },
      selfFilterEnabled:        { type: 'bool' },
    },
  },
  header: {
    properties: {
      show:          { type: 'bool' },
      fontColor:     { type: 'color' },
      background:    { type: 'color' },
      outline:       { type: 'enum', describe: 'Legacy enum — use outlineStyle for new reports' },
      outlineStyle:  { type: 'int',  describe: '1=Top, 2=Right, 3=Top-Right, 4=Bottom, 15=Frame' },
      outlineColor:  { type: 'color' },
      outlineWeight: { type: 'int' },
      textSize:      { type: 'double' },
      fontFamily:    { type: 'string' },
      bold:          { type: 'bool' },
    },
  },
  items: {
    properties: {
      fontColor:     { type: 'color' },
      background:    { type: 'color' },
      outline:       { type: 'enum' },
      outlineStyle:  { type: 'int' },
      textSize:      { type: 'double' },
      fontFamily:    { type: 'string' },
      padding:       { type: 'int' },
    },
  },
  // Text slicer (Microsoft's documented `pillCornerRadius` example)
  inputText: {
    properties: {
      pillCornerRadius: { type: 'int', describe: 'Documented PBIR example: "4L"' },
      background:       { type: 'color' },
      fontColor:        { type: 'color' },
      placeholderText:  { type: 'string' },
      border:           { type: 'color' },
    },
  },
}

// ── Table / Matrix ───────────────────────────────────────────────────────────

const TABLE_CARDS = {
  grid: {
    properties: {
      gridVertical:        { type: 'bool' },
      gridHorizontal:      { type: 'bool' },
      gridVerticalColor:   { type: 'color' },
      gridHorizontalColor: { type: 'color' },
      gridVerticalWeight:  { type: 'int' },
      gridHorizontalWeight:{ type: 'int' },
      outlineColor:        { type: 'color' },
      outlineWeight:       { type: 'int' },
      rowPadding:          { type: 'int' },
      imageHeight:         { type: 'int' },
      textSize:            { type: 'double' },
    },
  },
  columnHeaders: {
    properties: {
      fontColor:           { type: 'color' },
      backColor:           { type: 'color' },
      outline:             { type: 'enum' },
      wordWrap:            { type: 'bool' },
      autoSizeColumnWidth: { type: 'bool' },
      bold:                { type: 'bool' },
      fontFamily:          { type: 'string' },
      fontSize:            { type: 'double' },
      alignment:           { type: 'enum', values: ['Left', 'Center', 'Right'] },
      urlIcon:             { type: 'bool' },
      columnSeparator:     { type: 'bool' },
    },
  },
  values: {
    properties: {
      fontColor:           { type: 'color' },
      backColor:           { type: 'color' },
      backColorPrimary:    { type: 'color', describe: 'Banded rows — primary' },
      backColorSecondary:  { type: 'color', describe: 'Banded rows — secondary' },
      bandedRowBackColors: { type: 'bool' },
      urlIcon:             { type: 'bool' },
      wordWrap:            { type: 'bool' },
      imageHeight:         { type: 'int' },
      fontSize:            { type: 'double' },
      fontFamily:          { type: 'string' },
    },
  },
  total: {
    properties: {
      totals:           { type: 'bool' },
      fontColor:        { type: 'color' },
      backColor:        { type: 'color' },
      bold:             { type: 'bool' },
      applyToHeaders:   { type: 'bool' },
      outline:          { type: 'enum', values: ['None', 'BottomOnly', 'TopOnly', 'TopBottom', 'Frame'] },
    },
  },
  subTotals: {
    properties: {
      rowSubtotals:           { type: 'bool' },
      columnSubtotals:        { type: 'bool' },
      applyToHeaders:         { type: 'bool' },
      levelSubtotalEnabled:   { type: 'bool' },
    },
  },
  // Matrix-specific
  rowHeaders: {
    properties: {
      stepped:                  { type: 'bool' },
      steppedLayoutIndentation: { type: 'int' },
      fontColor:                { type: 'color' },
      backColor:                { type: 'color' },
      outline:                  { type: 'enum' },
      bold:                     { type: 'bool' },
      fontFamily:               { type: 'string' },
      fontSize:                 { type: 'double' },
    },
  },
}

// ── The schema map ───────────────────────────────────────────────────────────

/**
 * Per-visualType formatting card map. For each visual:
 *   data:      { cardName: { properties: {...} } }   — visual.objects
 *   chrome:    same shape as COMMON_CHROME_CARDS    — visual.visualContainerObjects
 *
 * Common chrome is included implicitly via the COMMON_CHROME_CARDS export;
 * code reading this map should always merge in COMMON_CHROME_CARDS for chrome.
 */
export const VISUAL_SCHEMA = {
  // ── Cartesian family ──
  barChart:                       { data: CARTESIAN_DATA_CARDS },
  columnChart:                    { data: CARTESIAN_DATA_CARDS },
  clusteredBarChart:              { data: CARTESIAN_DATA_CARDS },
  clusteredColumnChart:           { data: CARTESIAN_DATA_CARDS },
  stackedBarChart:                { data: CARTESIAN_DATA_CARDS },
  hundredPercentStackedBarChart:  { data: CARTESIAN_DATA_CARDS },
  hundredPercentStackedColumnChart: { data: CARTESIAN_DATA_CARDS },
  lineChart:                      { data: CARTESIAN_DATA_CARDS },
  areaChart:                      { data: CARTESIAN_DATA_CARDS },
  stackedAreaChart:               { data: CARTESIAN_DATA_CARDS },
  hundredPercentStackedAreaChart: { data: CARTESIAN_DATA_CARDS },
  ribbonChart:                    { data: { ...CARTESIAN_DATA_CARDS, ribbonChartSeries: { properties: { ribbonRatio: { type: 'double' }, transparency: { type: 'int' }, matchSeriesColor: { type: 'bool' }, strokeColor: { type: 'color' }, strokeWidth: { type: 'int' } } } } },
  waterfallChart:                 { data: { ...CARTESIAN_DATA_CARDS, sentimentColors: { properties: { increaseFill: { type: 'color' }, decreaseFill: { type: 'color' }, totalFill: { type: 'color' }, otherFill: { type: 'color' } } } } },

  // ── Part-to-whole family ──
  pieChart:    { data: PARTTOWHOLE_DATA_CARDS },
  donutChart:  { data: PARTTOWHOLE_DATA_CARDS },
  treemap:     { data: { ...PARTTOWHOLE_DATA_CARDS, dataPoint: CARTESIAN_DATA_CARDS.dataPoint } },
  funnel:      { data: { dataPoint: CARTESIAN_DATA_CARDS.dataPoint, labels: CARTESIAN_DATA_CARDS.labels, percentBarLabel: { properties: { color: { type: 'color' }, fontSize: { type: 'double' } } } } },
  scatterChart: { data: { ...CARTESIAN_DATA_CARDS, bubbles: { properties: { bubbleSize: { type: 'int' } } }, fillPoint: { properties: { show: { type: 'bool' } } } } },

  // ── Indicator family ──
  card:        { data: { labels: INDICATOR_CARDS.card_labels, categoryLabels: INDICATOR_CARDS.card_categoryLabels, wordWrap: INDICATOR_CARDS.card_wordWrap, accentBar: INDICATOR_CARDS.card_accentBar } },
  cardVisual:  { data: { callout: { properties: { fontFamily: { type: 'string' }, fontSize: { type: 'double' }, bold: { type: 'bool' }, color: { type: 'color' }, alignment: { type: 'enum' } } }, referenceLabels: { properties: { color: { type: 'color' }, fontSize: { type: 'double' } } }, image: {}, cards: { properties: { cornerRadius: { type: 'int' }, padding: { type: 'int' }, gap: { type: 'int' }, backgroundColor: { type: 'color' } } }, multiCardLayout: {}, multiCategoryLayout: {} } },
  multiRowCard: { data: { dataLabels: CARTESIAN_DATA_CARDS.labels, categoryLabels: INDICATOR_CARDS.card_categoryLabels, cardTitle: { properties: { color: { type: 'color' }, fontFamily: { type: 'string' }, fontSize: { type: 'double' } } }, card: { properties: { outline: { type: 'enum', values: ['None', 'BottomOnly', 'Frame'] }, outlineColor: { type: 'color' }, outlineWeight: { type: 'int' }, barShow: { type: 'bool' }, barColor: { type: 'color' }, cardPadding: { type: 'int' }, cardBackground: { type: 'color' } } } } },
  kpi:         { data: { indicator: INDICATOR_CARDS.kpi_indicator, trendline: INDICATOR_CARDS.kpi_trendline, goals: INDICATOR_CARDS.kpi_goals, directionAndStatus: INDICATOR_CARDS.kpi_directionAndStatus, dateLabel: { properties: { color: { type: 'color' }, fontSize: { type: 'double' } } } } },
  gauge:       { data: { axis: INDICATOR_CARDS.gauge_axis, dataPoint: INDICATOR_CARDS.gauge_dataPoint, labels: CARTESIAN_DATA_CARDS.labels, calloutValue: INDICATOR_CARDS.gauge_calloutValue, targetValue: { properties: { color: { type: 'color' } } } } },

  // ── Slicer family ──
  slicer:                 { data: SLICER_CARDS },
  advancedSlicerVisual:   { data: SLICER_CARDS, statefulCards: ['header', 'items'] },
  textSlicer:             { data: { inputText: SLICER_CARDS.inputText, ...SLICER_CARDS } },

  // ── Table / matrix ──
  tableEx:    { data: TABLE_CARDS },
  pivotTable: { data: { ...TABLE_CARDS, rowHeaders: TABLE_CARDS.rowHeaders } },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get every data card available for a visualType.
 *   listDataCards('barChart') → ['dataPoint', 'categoryAxis', 'valueAxis', 'legend', 'labels', ...]
 */
export function listDataCards(visualType) {
  const schema = VISUAL_SCHEMA[visualType]
  return schema?.data ? Object.keys(schema.data) : []
}

/**
 * Get every chrome card (always available on every visual).
 */
export function listChromeCards() {
  return Object.keys(COMMON_CHROME_CARDS)
}

/**
 * Look up a property's metadata for a (visualType, cardName, propName) tuple.
 * Returns null if unknown — caller should treat unknown as "schema-version-sensitive".
 */
export function getPropertyMeta(visualType, cardName, propName) {
  // Try chrome first
  if (COMMON_CHROME_CARDS[cardName]?.properties?.[propName]) {
    return COMMON_CHROME_CARDS[cardName].properties[propName]
  }
  // Then visual-specific data cards
  const card = VISUAL_SCHEMA[visualType]?.data?.[cardName]
  return card?.properties?.[propName] || null
}
