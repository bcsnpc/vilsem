/**
 * COMPREHENSIVE PBI Visual Format Property Catalog.
 *
 * Single source of truth for every native PBI visual type's formatting
 * cards + properties. Compiled from:
 *   - Microsoft theme schema 2.149 (powerbi-desktop-samples)
 *   - Apress pro-power-bi-theme-creation (FullTheme.json + per-visual)
 *   - MattRudy/PowerBI-ThemeTemplates (auto-updated monthly)
 *   - deldersveld/PowerBI-ThemeTemplates (per-visual snippets)
 *   - Microsoft Learn 2026 docs (Fluent 2 base theme, new card visual,
 *     advancedSlicerVisual state syntax)
 *   - Microsoft Fabric Community 2025-2026 schema-version notices
 *
 * Used by:
 *   - styleApplier.js: visual-type-aware write paths (don't write
 *     `gridlineShow` on a line chart that needs `gridLineShow`)
 *   - designDirector.js: gives the LLM the exact property names + types
 *     it can produce in a plan
 *   - auditEngine.js: validates rules against canonical property names
 *
 * Schema versioning: PBI bumps schema versions ~monthly. We treat unknown
 * properties as version-sensitive — applier writes them anyway (PBI ignores
 * keys it doesn't recognize) but the catalog represents the most-current
 * known names per visualType.
 *
 * Property types:
 *   bool      — true/false
 *   int       — integer (PBIR L suffix)
 *   double    — float (PBIR D suffix)
 *   string    — quoted text
 *   enum      — string from a fixed value set
 *   color     — hex color (PBIR solid.color wrapper)
 *   number    — int OR double (caller decides)
 */

// ── Universal chrome cards (every visual gets these via vcObjects/visualContainerObjects) ──

export const UNIVERSAL_CHROME = {
  background: {
    show:         { type: 'bool' },
    color:        { type: 'color' },
    transparency: { type: 'int',   range: [0, 100] },
    image:        { type: 'string' },
  },
  border: {
    show:   { type: 'bool' },
    color:  { type: 'color' },
    radius: { type: 'int', range: [0, 50] },
    weight: { type: 'int', range: [0, 10] },
  },
  dropShadow: {
    show:         { type: 'bool' },
    color:        { type: 'color' },
    position:     { type: 'enum', values: ['Outer', 'Inner', 'Custom'] },
    preset:       { type: 'enum', values: ['Default', 'Outer', 'Inner', 'Custom'] },
    angle:        { type: 'int',  range: [0, 360] },
    distance:     { type: 'int',  range: [0, 50] },
    blur:         { type: 'int',  range: [0, 50] },
    transparency: { type: 'int',  range: [0, 100] },
  },
  padding: {
    top:    { type: 'int', range: [0, 100] },
    right:  { type: 'int', range: [0, 100] },
    bottom: { type: 'int', range: [0, 100] },
    left:   { type: 'int', range: [0, 100] },
  },
  paddingUniform: { type: 'int', range: [0, 100], notes: 'Fluent 2 — sets all 4 sides' },
  title: {
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
  subTitle: {
    show:       { type: 'bool', notes: 'Fluent 2 default visible on many visuals' },
    text:       { type: 'string' },
    fontFamily: { type: 'string' },
    fontSize:   { type: 'double' },
    fontColor:  { type: 'color' },
    alignment:  { type: 'enum', values: ['Left', 'Center', 'Right'] },
  },
  divider: {
    show:          { type: 'bool' },
    color:         { type: 'color' },
    style:         { type: 'enum', values: ['solid', 'dashed', 'dotted'] },
    width:         { type: 'int' },
    ignorePadding: { type: 'bool' },
  },
  spacing: {
    customizeSpacing:    { type: 'bool' },
    verticalSpacing:     { type: 'int' },
    spaceBelowTitle:     { type: 'int' },
    spaceBelowSubTitle:  { type: 'int' },
    spaceBelowTitleArea: { type: 'int' },
  },
  visualHeader: {
    show:                          { type: 'bool', recommendedForPublished: false, notes: 'HIDE in viewer mode — biggest "premium" polish lever' },
    background:                    { type: 'color' },
    border:                        { type: 'color' },
    foreground:                    { type: 'color' },
    transparency:                  { type: 'int', range: [0, 100] },
    showVisualInformationButton:   { type: 'bool' },
    showVisualWarningButton:       { type: 'bool' },
    showVisualErrorButton:         { type: 'bool' },
    showDrillRoleSelector:         { type: 'bool' },
    showDrillToggleButton:         { type: 'bool' },
    showDrillUpButton:             { type: 'bool' },
    showDrillDownLevelButton:      { type: 'bool' },
    showDrillDownExpandButton:     { type: 'bool' },
    showPinButton:                 { type: 'bool' },
    showFocusModeButton:           { type: 'bool' },
    showFilterRestatementButton:   { type: 'bool' },
    showSeeDataLayoutToggleButton: { type: 'bool' },
    showOptionsMenu:               { type: 'bool' },
    showTooltipButton:             { type: 'bool' },
  },
  visualHeaderTooltip: {
    show:           { type: 'bool' },
    text:           { type: 'string' },
    titleFontColor: { type: 'color' },
    valueFontColor: { type: 'color' },
    fontSize:       { type: 'double' },
    fontFamily:     { type: 'string' },
    background:     { type: 'color' },
    transparency:   { type: 'int' },
    themedBackground: { type: 'bool' },
  },
  visualTooltip: {
    type:           { type: 'enum', values: ['Default', 'Page', 'None'] },
    pageId:         { type: 'string' },
    titleFontColor: { type: 'color' },
    valueFontColor: { type: 'color' },
    background:     { type: 'color' },
    transparency:   { type: 'int' },
  },
  lockAspect: {
    show: { type: 'bool' },
  },
  stylePreset: {
    name: { type: 'string', notes: 'Fluent 2 named presets per visual' },
  },
  general: {
    responsive:     { type: 'bool' },
    keepLayerOrder: { type: 'bool' },
    altText:        { type: 'string' },
    outline:        { type: 'string' },
    bookmark:       { type: 'string' },
  },
}

// ── Bar / Column charts ──────────────────────────────────────────────────────

const CARTESIAN_BASE = {
  legend: {
    show:        { type: 'bool' },
    position:    { type: 'enum', values: ['Top', 'Bottom', 'Left', 'Right', 'TopCenter', 'BottomCenter', 'RightCenter', 'LeftCenter'] },
    showTitle:   { type: 'bool' },
    titleText:   { type: 'string' },
    legendColor: { type: 'color', notes: 'Bar/column uses legendColor; line/area uses labelColor' },
    fontFamily:  { type: 'string' },
    fontSize:    { type: 'double' },
    bold:        { type: 'bool' },
    italic:      { type: 'bool' },
  },
  categoryAxis: {
    show:                   { type: 'bool' },
    axisType:               { type: 'enum', values: ['Categorical', 'Continuous'] },
    position:               { type: 'enum', values: ['Left', 'Right', 'Bottom', 'Top'] },
    color:                  { type: 'color' },
    fontSize:               { type: 'double' },
    fontFamily:             { type: 'string' },
    preferredCategoryWidth: { type: 'int' },
    maxMarginFactor:        { type: 'double' },
    innerPadding:           { type: 'int' },
    concatenateLabels:      { type: 'bool' },
    showAxisTitle:          { type: 'bool' },
    axisStyle:              { type: 'enum', values: ['both', 'showTitleOnly', 'showUnitOnly'] },
    titleColor:             { type: 'color' },
    titleText:              { type: 'string' },
    titleFontSize:          { type: 'double' },
    titleFontFamily:        { type: 'string' },
    labelDisplayUnits:      { type: 'enum', values: ['Auto', 0, 1000, 1000000, 1000000000, 1000000000000] },
    labelPrecision:         { type: 'string' },
  },
  valueAxis: {
    show:               { type: 'bool' },
    position:           { type: 'enum', values: ['Left', 'Right'] },
    axisScale:          { type: 'enum', values: ['Linear', 'Log'] },
    start:              { type: 'double' },
    end:                { type: 'double' },
    labelColor:         { type: 'color' },
    fontSize:           { type: 'double' },
    fontFamily:         { type: 'string' },
    labelDisplayUnits:  { type: 'enum', values: ['Auto', 0, 1000, 1000000, 1000000000, 1000000000000] },
    labelPrecision:     { type: 'string' },
    showAxisTitle:      { type: 'bool' },
    axisStyle:          { type: 'enum' },
    color:              { type: 'color' },
    titleText:          { type: 'string' },
    titleFontSize:      { type: 'double' },
    titleFontFamily:    { type: 'string' },
    // Gridlines — column/bar uses lowercase l, line/area uses capital L
    gridlineShow:       { type: 'bool',   variant: 'column-bar' },
    gridLineShow:       { type: 'bool',   variant: 'line-area',  notes: 'Capital L variant — line/area' },
    gridLineColor:      { type: 'color',  variant: 'line-area' },
    gridlineColor:      { type: 'color',  variant: 'column-bar' },
    gridLineThickness:  { type: 'int' },
    gridlineThickness:  { type: 'int' },
    gridlineStyle:      { type: 'enum', values: ['Solid', 'Dashed', 'Dotted'] },
  },
  zoom: {
    show:            { type: 'bool' },
    showOnValueAxis: { type: 'bool' },
    showLabels:      { type: 'bool' },
    showTooltip:     { type: 'bool' },
  },
  labels: {
    show:                   { type: 'bool' },
    color:                  { type: 'color' },
    labelDisplayUnits:      { type: 'enum' },
    labelPrecision:         { type: 'number' },
    labelPosition:          { type: 'enum', values: ['Auto', 'InsideEnd', 'InsideCenter', 'InsideBase', 'OutsideEnd', 'Above', 'Below'] },
    labelOverflow:          { type: 'bool' },
    labelOrientation:       { type: 'enum', values: ['horizontal', 'vertical'] },
    fontFamily:             { type: 'string' },
    fontSize:               { type: 'double' },
    bold:                   { type: 'bool' },
    italic:                 { type: 'bool' },
    enableBackground:       { type: 'bool' },
    backgroundColor:        { type: 'color' },
    backgroundTransparency: { type: 'int' },
    preserveWhitespace:     { type: 'bool' },
  },
  dataPoint: {
    defaultColor:      { type: 'color' },
    showAllDataPoints: { type: 'bool' },
    fill:              { type: 'color', notes: 'Per-series via selector.metadata' },
    fillRule:          { type: 'object', notes: 'Gradient — minimum/center/maximum' },
  },
  plotArea: {
    transparency: { type: 'int' },
    scaling:      { type: 'enum', values: ['Fill', 'Fit', 'Normal'] },
  },
  plotAreaBackground: {
    show:         { type: 'bool' },
    color:        { type: 'color' },
    transparency: { type: 'int' },
    image:        { type: 'string' },
  },
}

const STACKED_TOTALS = {
  Totals: {
    show:                   { type: 'bool' },
    color:                  { type: 'color' },
    labelDisplayUnits:      { type: 'enum' },
    labelPrecision:         { type: 'number' },
    fontSize:               { type: 'double' },
    fontFamily:             { type: 'string' },
    enableBackground:       { type: 'bool' },
    backgroundColor:        { type: 'color' },
    backgroundTransparency: { type: 'int' },
    showPositiveAndNegative:{ type: 'bool' },
  },
}

// Line chart adds: legendMarkerRendering, matchLineColor, defaultToCircle, lineStyles, y2Axis
const LINE_LEGEND_EXTRAS = {
  legendMarkerRendering: { type: 'enum', values: ['lineOnly', 'lineWithMarker', 'markerOnly'] },
  matchLineColor:        { type: 'bool' },
  defaultToCircle:       { type: 'bool' },
}

const LINE_STYLES = {
  lineStyles: {
    strokeWidth:      { type: 'int',  range: [1, 10] },
    strokeLineJoin:   { type: 'enum', values: ['Bevel', 'Round', 'Miter'] },
    lineStyle:        { type: 'enum', values: ['Solid', 'Dashed', 'Dotted', 'lineOnly'] },
    showMarker:       { type: 'bool' },
    markerShape:      { type: 'enum', values: ['circle', 'square', 'diamond', 'triangle', 'longDash'] },
    markerSize:       { type: 'int' },
    markerColor:      { type: 'color' },
    stepped:          { type: 'bool' },
    showSeries:       { type: 'bool' },
  },
  y2Axis: {
    show:               { type: 'bool' },
    secStart:           { type: 'double' },
    secEnd:             { type: 'double' },
    secAxisScale:       { type: 'enum', values: ['Linear', 'Log'] },
    secLabelColor:      { type: 'color' },
    secFontSize:        { type: 'double' },
    secFontFamily:      { type: 'string' },
    secLabelPrecision:  { type: 'number' },
    secLabelDisplayUnits: { type: 'enum' },
    secShowAxisTitle:   { type: 'bool' },
    secAxisStyle:       { type: 'enum' },
    secColor:           { type: 'color' },
    secTitleText:       { type: 'string' },
    secTitleFontSize:   { type: 'double' },
    secTitleFontFamily: { type: 'string' },
  },
  // Analytics cards (line/area)
  forecast: {
    show:                { type: 'bool' },
    lineColor:           { type: 'color' },
    confidenceBandStyle: { type: 'enum' },
    transparency:        { type: 'int' },
  },
  trend: {
    show:         { type: 'bool' },
    lineColor:    { type: 'color' },
    transparency: { type: 'int' },
    style:        { type: 'enum' },
  },
  referenceLine: {
    show:             { type: 'bool' },
    value:            { type: 'double' },
    lineColor:        { type: 'color' },
    transparency:     { type: 'int' },
    style:            { type: 'enum' },
    labelColor:       { type: 'color' },
    labelText:        { type: 'string' },
  },
  referenceBand: {
    show:             { type: 'bool' },
    fill:             { type: 'color' },
    transparency:     { type: 'int' },
  },
}

// ── Pie / Donut ──────────────────────────────────────────────────────────────

const PIE_DONUT_BASE = {
  legend:    CARTESIAN_BASE.legend,
  labels:    CARTESIAN_BASE.labels,
  dataPoint: CARTESIAN_BASE.dataPoint,
  detailLabels: {
    show:          { type: 'bool' },
    color:         { type: 'color' },
    fontFamily:    { type: 'string' },
    fontSize:      { type: 'double' },
    labelStyle:    { type: 'enum', values: ['Category', 'Data value', 'Category, percent of total', 'Both', 'Percent of total', 'Data value, percent of total'] },
    labelPosition: { type: 'enum', values: ['Outside', 'Inside'] },
  },
  slices: {
    innerRadiusRatio: { type: 'int', range: [0, 95], notes: 'Donut hole percentage' },
    strokeColor:      { type: 'color' },
    strokeWidth:      { type: 'int' },
  },
  rotation: {
    value: { type: 'int', range: [0, 360] },
  },
}

// ── Specialty (waterfall, ribbon, funnel, scatter, treemap) ──────────────────

const SCATTER_EXTRAS = {
  bubbles: {
    bubbleSize: { type: 'int', range: [-100, 100] },
  },
  fillPoint: {
    show: { type: 'bool' },
  },
  colorByCategory: {
    show: { type: 'bool' },
  },
}

const RIBBON_EXTRAS = {
  ribbonChartSeries: {
    ribbonRatio:      { type: 'double' },
    transparency:     { type: 'int' },
    matchSeriesColor: { type: 'bool' },
    strokeColor:      { type: 'color' },
    strokeWidth:      { type: 'int' },
    spacing:          { type: 'int' },
  },
}

const WATERFALL_EXTRAS = {
  sentimentColors: {
    increaseFill: { type: 'color' },
    decreaseFill: { type: 'color' },
    totalFill:    { type: 'color' },
    otherFill:    { type: 'color' },
  },
}

const FUNNEL_EXTRAS = {
  percentBarLabel: {
    color:    { type: 'color' },
    fontSize: { type: 'double' },
    show:     { type: 'bool' },
  },
}

// ── Card (legacy single-value) ───────────────────────────────────────────────

const CARD_DATA = {
  // The big number (DON'T confuse with chart `labels`)
  labels: {
    color:             { type: 'color' },
    labelDisplayUnits: { type: 'enum' },
    labelPrecision:    { type: 'number' },
    fontSize:          { type: 'double', notes: 'Card hero — typically 32-45pt' },
    fontFamily:        { type: 'string' },
    bold:              { type: 'bool' },
  },
  categoryLabels: {
    show:       { type: 'bool' },
    color:      { type: 'color' },
    fontSize:   { type: 'double', notes: 'Card label — typically 11-13pt' },
    fontFamily: { type: 'string' },
  },
  wordWrap: { show: { type: 'bool' } },
  accentBar: {
    show:   { type: 'bool' },
    color:  { type: 'color' },
    weight: { type: 'int' },
  },
}

// ── CardVisual (new card, GA Nov 2025) ───────────────────────────────────────

const CARD_VISUAL_DATA = {
  callout: {
    fontFamily: { type: 'string' },
    fontSize:   { type: 'double', notes: 'New card hero — Fluent 2 defaults to ~24pt' },
    bold:       { type: 'bool' },
    color:      { type: 'color' },
    alignment:  { type: 'enum' },
  },
  referenceLabels: {
    show:     { type: 'bool', notes: 'Fluent 2 default: hide background for cleaner look' },
    color:    { type: 'color' },
    fontSize: { type: 'double' },
    backgroundColor: { type: 'color' },
    backgroundTransparency: { type: 'int' },
  },
  cards: {
    cornerRadius:     { type: 'int', notes: 'Per-card corner radius (Fluent 2)' },
    padding:          { type: 'int' },
    paddingUniform:   { type: 'int', notes: 'Fluent 2 — sets all 4 sides at once' },
    gap:              { type: 'int' },
    backgroundColor:  { type: 'color' },
  },
  multiCardLayout: {
    layoutType:  { type: 'enum', values: ['Horizontal', 'Vertical', 'Grid'] },
    cardSize:    { type: 'enum', values: ['Auto', 'Fixed'] },
    cardWidth:   { type: 'int' },
    cardHeight:  { type: 'int' },
  },
  multiCategoryLayout: {},
  image: {},
}

// ── KPI ──────────────────────────────────────────────────────────────────────

const KPI_DATA = {
  indicator: {
    fontFamily: { type: 'string' },
    fontSize:   { type: 'double' },
    color:      { type: 'color' },
  },
  trendline: {
    show:         { type: 'bool' },
    transparency: { type: 'int' },
  },
  goals: {
    goalText:     { type: 'string' },
    distanceText: { type: 'string' },
    color:        { type: 'color' },
  },
  directionAndStatus: {
    direction:    { type: 'enum', values: ['PositiveIsGood', 'NegativeIsGood'] },
    statusColors: { type: 'object' },
  },
  dateLabel: {
    color:    { type: 'color' },
    fontSize: { type: 'double' },
  },
}

// ── Multi-row card ───────────────────────────────────────────────────────────

const MULTI_ROW_CARD_DATA = {
  dataLabels: CARTESIAN_BASE.labels,
  categoryLabels: CARD_DATA.categoryLabels,
  cardTitle: {
    color:      { type: 'color' },
    fontFamily: { type: 'string' },
    fontSize:   { type: 'double' },
  },
  card: {
    outline:        { type: 'enum', values: ['None', 'BottomOnly', 'Frame'] },
    outlineColor:   { type: 'color' },
    outlineWeight:  { type: 'int' },
    barShow:        { type: 'bool' },
    barColor:       { type: 'color' },
    cardPadding:    { type: 'int' },
    cardBackground: { type: 'color' },
  },
}

// ── Gauge ────────────────────────────────────────────────────────────────────

const GAUGE_DATA = {
  axis: {
    min:    { type: 'double' },
    max:    { type: 'double' },
    target: { type: 'double' },
  },
  dataPoint: {
    fillColor:   { type: 'color' },
    targetColor: { type: 'color' },
  },
  labels: CARTESIAN_BASE.labels,
  calloutValue: {
    color:      { type: 'color' },
    fontSize:   { type: 'double' },
    fontFamily: { type: 'string' },
  },
  targetValue: {
    color: { type: 'color' },
  },
}

// ── Slicer (classic) ─────────────────────────────────────────────────────────

const SLICER_DATA = {
  general: {
    outlineColor:  { type: 'color' },
    outlineWeight: { type: 'int' },
    orientation:   { type: 'enum', values: ['horizontal', 'vertical'] },
    responsive:    { type: 'bool' },
  },
  data: {
    mode:           { type: 'enum', values: ['Basic', 'Dropdown', 'Between', 'Before', 'After', 'List', 'Relative'] },
    relativeRange:  { type: 'string' },
    relativePeriod: { type: 'string' },
  },
  selection: {
    selectAllCheckboxEnabled: { type: 'bool' },
    singleSelect:             { type: 'bool' },
    selfFilterEnabled:        { type: 'bool' },
  },
  header: {
    show:          { type: 'bool' },
    fontColor:     { type: 'color' },
    background:    { type: 'color' },
    outline:       { type: 'enum', deprecated: true, values: ['None', 'Frame', 'BottomOnly', 'TopOnly'] },
    outlineStyle:  { type: 'int',  notes: '1=Top, 2=Right, 3=Top-Right, 4=Bottom, 15=Frame', range: [0, 15] },
    outlineColor:  { type: 'color' },
    outlineWeight: { type: 'int' },
    textSize:      { type: 'double' },
    fontFamily:    { type: 'string' },
    bold:          { type: 'bool' },
  },
  items: {
    fontColor:    { type: 'color' },
    background:   { type: 'color' },
    outline:      { type: 'enum', deprecated: true },
    outlineStyle: { type: 'int' },
    textSize:     { type: 'double' },
    fontFamily:   { type: 'string' },
    padding:      { type: 'int' },
  },
  slider: {
    color: { type: 'color' },
  },
  date:      { fontColor: { type: 'color' }, background: { type: 'color' }, fontSize: { type: 'double' } },
  dateRange: { textSize: { type: 'double' } },
  numericInputStyle: { background: { type: 'color' } },
}

// ── AdvancedSlicerVisual (newer, state-discriminated) ────────────────────────

const ADVANCED_SLICER_DATA = {
  // State-discriminated cards using newer `state:` syntax (replacing $id)
  // Each state takes { background, fontColor, border, padding }
  '_stateCards': ['header', 'items', 'background', 'border'],
  '_states':     ['default', 'hover', 'active', 'selected', 'disabled'],

  pillCornerRadius: { type: 'int' },
  searchBox: {
    show:       { type: 'bool' },
    fontColor:  { type: 'color' },
    background: { type: 'color' },
  },
  selectionControls: {
    show: { type: 'bool' },
  },
}

const TEXT_SLICER_DATA = {
  inputText: {
    pillCornerRadius: { type: 'int',    notes: 'Microsoft documented PBIR example — "4L"' },
    background:       { type: 'color' },
    fontColor:        { type: 'color' },
    placeholderText:  { type: 'string' },
    border:           { type: 'color' },
  },
}

// ── Table ────────────────────────────────────────────────────────────────────

const TABLE_DATA = {
  grid: {
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
  columnHeaders: {
    fontColor:           { type: 'color' },
    backColor:           { type: 'color' },
    outline:             { type: 'enum', values: ['None', 'BottomOnly', 'Frame', 'TopOnly'] },
    wordWrap:            { type: 'bool' },
    autoSizeColumnWidth: { type: 'bool' },
    bold:                { type: 'bool' },
    fontFamily:          { type: 'string' },
    fontSize:            { type: 'double' },
    alignment:           { type: 'enum', values: ['Left', 'Center', 'Right'] },
    urlIcon:             { type: 'bool' },
    columnSeparator:     { type: 'bool' },
  },
  values: {
    fontColor:           { type: 'color' },
    backColor:           { type: 'color' },
    backColorPrimary:    { type: 'color', notes: 'Banded rows — primary' },
    backColorSecondary:  { type: 'color', notes: 'Banded rows — secondary' },
    bandedRowBackColors: { type: 'bool' },
    urlIcon:             { type: 'bool' },
    wordWrap:            { type: 'bool' },
    imageHeight:         { type: 'int' },
    fontSize:            { type: 'double' },
    fontFamily:          { type: 'string' },
  },
  total: {
    totals:         { type: 'bool' },
    fontColor:      { type: 'color' },
    backColor:      { type: 'color' },
    bold:           { type: 'bool' },
    applyToHeaders: { type: 'bool' },
    outline:        { type: 'enum', values: ['None', 'BottomOnly', 'TopOnly', 'TopBottom', 'Frame'] },
  },
  subTotals: {
    rowSubtotals:           { type: 'bool' },
    columnSubtotals:        { type: 'bool' },
    applyToHeaders:         { type: 'bool' },
    levelSubtotalEnabled:   { type: 'bool' },
    rowSubtotalsPosition:   { type: 'enum', values: ['Top', 'Bottom'] },
  },
}

// ── Matrix (pivotTable) — table superset ─────────────────────────────────────

const MATRIX_DATA = {
  ...TABLE_DATA,
  rowHeaders: {
    stepped:                  { type: 'bool' },
    steppedLayoutIndentation: { type: 'int' },
    fontColor:                { type: 'color' },
    backColor:                { type: 'color' },
    outline:                  { type: 'enum' },
    bold:                     { type: 'bool' },
    fontFamily:               { type: 'string' },
    fontSize:                 { type: 'double' },
    alignment:                { type: 'enum' },
    wordWrap:                 { type: 'bool' },
  },
}

// ── Action Button (state-discriminated, newer `state:` syntax) ───────────────

const ACTION_BUTTON_DATA = {
  '_stateCards': ['outline', 'fill', 'icon', 'text'],
  '_states':     ['default', 'hover', 'selected', 'disabled'],

  outline: {
    transparency: { type: 'int' },
    weight:       { type: 'int' },
    roundEdge:    { type: 'int', notes: 'Border radius in px' },
    lineColor:    { type: 'color' },
  },
  fill: {
    show:         { type: 'bool' },
    transparency: { type: 'int' },
    fillColor:    { type: 'color' },
  },
  icon: {
    iconColor:    { type: 'color' },
    lineWeight:   { type: 'int' },
    placement:    { type: 'enum', values: ['Left', 'Right', 'Above', 'Below'] },
    type:         { type: 'enum' },
  },
  text: {
    fontColor:  { type: 'color' },
    fontFamily: { type: 'string' },
    fontSize:   { type: 'double' },
    bold:       { type: 'bool' },
    alignment:  { type: 'enum' },
  },
  shape: {
    roundEdge: { type: 'int' },
  },
}

// ── The catalog map ──────────────────────────────────────────────────────────

/**
 * For each visualType:
 *   data:      data-bound formatting cards (visual.objects / singleVisual.objects)
 *   chrome:    universal chrome (always UNIVERSAL_CHROME — included implicitly)
 *
 * Use `getVisualCatalog(visualType)` for a merged view including chrome.
 */
export const VISUAL_PROPERTY_CATALOG = {
  // Cartesian
  barChart:                       { data: { ...CARTESIAN_BASE } },
  columnChart:                    { data: { ...CARTESIAN_BASE, ...STACKED_TOTALS } },
  clusteredBarChart:              { data: { ...CARTESIAN_BASE } },
  clusteredColumnChart:           { data: { ...CARTESIAN_BASE } },
  stackedBarChart:                { data: { ...CARTESIAN_BASE, ...STACKED_TOTALS } },
  hundredPercentStackedBarChart:  { data: { ...CARTESIAN_BASE, ...STACKED_TOTALS } },
  hundredPercentStackedColumnChart: { data: { ...CARTESIAN_BASE, ...STACKED_TOTALS } },

  // Line / Area family — legend has extras + lineStyles + analytics
  lineChart:                      { data: { ...CARTESIAN_BASE, legend: { ...CARTESIAN_BASE.legend, ...LINE_LEGEND_EXTRAS }, ...LINE_STYLES } },
  areaChart:                      { data: { ...CARTESIAN_BASE, legend: { ...CARTESIAN_BASE.legend, ...LINE_LEGEND_EXTRAS }, ...LINE_STYLES } },
  stackedAreaChart:               { data: { ...CARTESIAN_BASE, legend: { ...CARTESIAN_BASE.legend, ...LINE_LEGEND_EXTRAS }, ...LINE_STYLES, ...STACKED_TOTALS } },
  hundredPercentStackedAreaChart: { data: { ...CARTESIAN_BASE, legend: { ...CARTESIAN_BASE.legend, ...LINE_LEGEND_EXTRAS }, ...LINE_STYLES, ...STACKED_TOTALS } },
  lineStackedColumnComboChart:    { data: { ...CARTESIAN_BASE, legend: { ...CARTESIAN_BASE.legend, ...LINE_LEGEND_EXTRAS }, ...LINE_STYLES, ...STACKED_TOTALS } },
  lineClusteredColumnComboChart:  { data: { ...CARTESIAN_BASE, legend: { ...CARTESIAN_BASE.legend, ...LINE_LEGEND_EXTRAS }, ...LINE_STYLES } },
  ribbonChart:                    { data: { ...CARTESIAN_BASE, ...LINE_STYLES, ...RIBBON_EXTRAS } },
  waterfallChart:                 { data: { ...CARTESIAN_BASE, ...WATERFALL_EXTRAS } },

  // Part-to-whole
  pieChart:        { data: PIE_DONUT_BASE },
  donutChart:      { data: PIE_DONUT_BASE },
  treemap:         { data: { ...PIE_DONUT_BASE, dataPoint: CARTESIAN_BASE.dataPoint } },
  funnel:          { data: { dataPoint: CARTESIAN_BASE.dataPoint, labels: CARTESIAN_BASE.labels, ...FUNNEL_EXTRAS } },

  // Point / scatter
  scatterChart:    { data: { ...CARTESIAN_BASE, ...SCATTER_EXTRAS } },

  // Indicator family
  card:            { data: CARD_DATA },
  cardVisual:      { data: CARD_VISUAL_DATA },
  multiRowCard:    { data: MULTI_ROW_CARD_DATA },
  kpi:             { data: KPI_DATA },
  gauge:           { data: GAUGE_DATA },
  scorecard:       { data: KPI_DATA },

  // Slicers
  slicer:                 { data: SLICER_DATA },
  advancedSlicerVisual:   { data: ADVANCED_SLICER_DATA },
  textSlicer:             { data: { ...SLICER_DATA, ...TEXT_SLICER_DATA } },
  listSlicer:             { data: { ...SLICER_DATA } },

  // Table / matrix
  tableEx:    { data: TABLE_DATA },
  pivotTable: { data: MATRIX_DATA },

  // Action button + shape (state-discriminated)
  actionButton: { data: ACTION_BUTTON_DATA },
  basicShape:   { data: { fill: { color: { type: 'color' } }, line: { color: { type: 'color' }, weight: { type: 'int' } } } },
  shape:        { data: { fill: { color: { type: 'color' } }, line: { color: { type: 'color' }, weight: { type: 'int' } } } },
  image:        { data: { imageScaling: { type: 'enum', values: ['Normal', 'Fit', 'Fill'] } } },
  textbox:      { data: { /* uses rich-text JSON, not card-based */ } },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get the merged catalog (data + universal chrome) for a visualType.
 * Returns null for unknown types.
 */
export function getVisualCatalog(visualType) {
  const entry = VISUAL_PROPERTY_CATALOG[visualType]
  if (!entry) return null
  return {
    visualType,
    data:   entry.data || {},
    chrome: UNIVERSAL_CHROME,
  }
}

/**
 * List every formatting card available for a visualType (data + chrome).
 */
export function listAllCards(visualType) {
  const cat = getVisualCatalog(visualType)
  if (!cat) return []
  return [...Object.keys(cat.data), ...Object.keys(cat.chrome)]
}

/**
 * Look up a property's metadata (type, range, enum values) for a
 * (visualType, cardName, propName) tuple. Returns null if unknown.
 */
export function getPropertyMeta(visualType, cardName, propName) {
  const cat = getVisualCatalog(visualType)
  if (!cat) return null
  const card = cat.chrome[cardName] || cat.data[cardName]
  return card?.[propName] || null
}

/**
 * Validate a property value against its catalog meta. Returns null if valid,
 * or a string error message describing the issue.
 *
 *   validatePropertyValue('lineChart', 'lineStyles', 'strokeWidth', 5)  → null
 *   validatePropertyValue('lineChart', 'lineStyles', 'strokeWidth', 99) → 'out of range [1, 10]'
 */
export function validatePropertyValue(visualType, cardName, propName, value) {
  const meta = getPropertyMeta(visualType, cardName, propName)
  if (!meta) return null  // unknown — let PBI ignore gracefully
  if (meta.type === 'bool' && typeof value !== 'boolean') return `expected bool, got ${typeof value}`
  if ((meta.type === 'int' || meta.type === 'double' || meta.type === 'number') && typeof value !== 'number') return `expected number, got ${typeof value}`
  if (meta.range && typeof value === 'number' && (value < meta.range[0] || value > meta.range[1])) {
    return `out of range [${meta.range[0]}, ${meta.range[1]}]`
  }
  if (meta.values && !meta.values.includes(value)) return `not in allowed values: ${meta.values.join(', ')}`
  return null
}

/**
 * Get the canonical gridline-show property for a chart (handles the
 * column/bar vs line/area casing inconsistency).
 *
 *   gridlineProperty('lineChart')   → 'gridLineShow'   (capital L)
 *   gridlineProperty('barChart')    → 'gridlineShow'   (lowercase l)
 */
export function gridlineProperty(visualType, propBase = 'Show') {
  const lineFamily = ['lineChart', 'areaChart', 'stackedAreaChart', 'hundredPercentStackedAreaChart',
                      'lineStackedColumnComboChart', 'lineClusteredColumnComboChart', 'ribbonChart']
  if (lineFamily.includes(visualType)) {
    return `gridLine${propBase}`   // capital L
  }
  return `gridline${propBase}`     // lowercase l
}
