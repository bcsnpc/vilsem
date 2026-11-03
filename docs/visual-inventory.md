# Visual inventory

## Current Line/Area formatting addition ? 2026-09-12

Both types use `secondaryAxis.js` through `EChartsCanvas` and the Power BI composition formatter. They expose 18 new secondary value-axis controls; the original discovery-time schema counts below are historical. This is opt-in for the second measure, with an independent automatic right-side scale. Stacked/ranked visual types exclude it. Tests and target limits are recorded in `qa/work-log.md` under FORMAT-AXIS-048.


Current runtime coverage and repair status: [verified fixes](qa/fix-status.md). Area now uses a dedicated `CompactArea` registry adapter over `CompactLineEcharts`; Stacked Area forwards its stack flag. Custom is accepted by the general schema with template validation. All 41 IDs were rerun in both hosts after fixes; the initial inventory below describes discovery-time implementation.

Initial audit: 2026-09-07. Source registry has **41 IDs**, including aliases and non-data objects. This is an implementation inventory, not a claim of 41 fully validated chart products. Sources: `visuals/index.js`, runtime-attached schemas, leaf source imports, `schema.js`, authoring palettes and AI maps.

Status: all IDs exercised in an isolated renderer harness across nine scenarios; every UI property, host interaction, persistence and live AI operation remains unverified. Lexically discovered config keys are a review index, not proof of an exposed or working control.

| ID | Runtime component | Engine | Schema fields attached | Distinct implementation |
|---|---|---|---:|---|
| kpi | [CompactKpi](../ui/src/appspec/visuals/CompactKpi.jsx) | DOM/CSS | 0 | DOM value card, optional SVG sparkline/progress/trend; may issue supporting queries. |
| bar | [CompactBarEcharts](../ui/src/appspec/visuals/CompactBarEcharts.jsx) | ECharts Canvas | 15 | Horizontal default; primitive composition; expand-in-place uses a separate option builder. |
| stacked_bar | [CompactStackedBarEcharts](../ui/src/appspec/visuals/CompactStackedBarEcharts.jsx) | ECharts Canvas | 15 | Multiple measures stacked; separate composition from single bar. |
| line | [CompactLineEcharts](../ui/src/appspec/visuals/CompactLineEcharts.jsx) | ECharts Canvas | 15 | Shared LineMarks; conditional hook defect VIS-LINE-001. |
| area | [CompactLineEcharts](../ui/src/appspec/visuals/CompactLineEcharts.jsx) | ECharts Canvas | 15 | Same component as line; host config.type or chartType supplies area mode. |
| donut | [CompactDonutEcharts](../ui/src/appspec/visuals/CompactDonutEcharts.jsx) | ECharts Canvas | 12 | PieMarks plus hand-built legend/center presentation. |
| pie | [CompactPie](../ui/src/appspec/visuals/CompactPie.jsx) | ECharts Canvas | 12 | Forces innerRadius=0 and center text off; unlike donut, still reads localStorage legacy renderer flag. |
| gauge | [CompactGaugeEcharts](../ui/src/appspec/visuals/CompactGaugeEcharts.jsx) | ECharts Canvas | 6 | GaugeMarks composition; gauge flag hardcoded on. |
| radar | [CompactRadarEcharts](../ui/src/appspec/visuals/CompactRadarEcharts.jsx) | ECharts Canvas | 5 | RadarMarks composition; radial axes owned by primitive. |
| scatter | [CompactScatterEcharts](../ui/src/appspec/visuals/CompactScatterEcharts.jsx) | ECharts Canvas | 6 | PointMarks; measures mapped to x/y, optional third measure to size. |
| bubble | [CompactBubbleEcharts](../ui/src/appspec/visuals/CompactBubbleEcharts.jsx) | ECharts Canvas | 6 | Scatter wrapper, third-measure size, different dot defaults. |
| treemap | [CompactTreemapEcharts](../ui/src/appspec/visuals/CompactTreemapEcharts.jsx) | ECharts Canvas | 10 | TreemapMarks; hierarchical layout delegated to ECharts. |
| funnel | [CompactFunnel](../ui/src/appspec/visuals/CompactFunnel.jsx) | DOM/CSS | 0 | DOM horizontal stages, not ECharts. Empty result invents sample stages: VIS-FUNNEL-001. |
| sankey | [CompactChord](../ui/src/appspec/visuals/CompactChord.jsx) | DOM + SVG | 0 | Alias of CompactChord: circular arcs, no source-target flow links. |
| table | [CompactTableEcharts](../ui/src/appspec/visuals/CompactTableEcharts.jsx) | DOM/CSS | 0 | Despite filename, HTML table; multi-dimension/value arrays, local sorting and local column widths. |
| column | [CompactColumnEcharts](../ui/src/appspec/visuals/CompactColumnEcharts.jsx) | ECharts Canvas | 15 | Delegates to bar with vertical defaults. |
| waterfall | [CompactWaterfall](../ui/src/appspec/visuals/CompactWaterfall.jsx) | DOM/CSS | 0 | DOM percentage-positioned cumulative bars, optional total, connectors and boundary labels. |
| lollipop | [CompactLollipopEcharts](../ui/src/appspec/visuals/CompactLollipopEcharts.jsx) | ECharts Canvas | 5 | Dedicated ECharts thin-bar stems plus scatter points; own schema. |
| bullet | [CompactBullet](../ui/src/appspec/visuals/CompactBullet.jsx) | DOM/CSS | 0 | DOM/SVG target/qualitative ranges card; not a BarMarks visual. |
| progress | [CompactProgressBar](../ui/src/appspec/visuals/CompactProgressBar.jsx) | DOM/CSS | 5 | DOM single-value progress card with independent schema. |
| heatmap | [CompactHeatmap](../ui/src/appspec/visuals/CompactHeatmap.jsx) | DOM/CSS | 0 | CSS square-cell grid over category/value rows, not a two-dimensional pivot. |
| ranked_list | [CompactRankedList](../ui/src/appspec/visuals/CompactRankedList.jsx) | DOM/CSS | 0 | DOM ranked rows with inline bars. |
| stat_card | [CompactStatCard](../ui/src/appspec/visuals/CompactStatCard.jsx) | DOM/CSS | 0 | DOM value and secondary-value trend. |
| metric_tile | [CompactMetricTile](../ui/src/appspec/visuals/CompactMetricTile.jsx) | DOM + SVG | 0 | Fixed SVG mini-ring and DOM value. |
| grouped_bar | [CompactGroupedBarEcharts](../ui/src/appspec/visuals/CompactGroupedBarEcharts.jsx) | ECharts Canvas | 15 | Separate composition with side-by-side series defaults. |
| stacked_area | [CompactStackedAreaEcharts](../ui/src/appspec/visuals/CompactStackedAreaEcharts.jsx) | ECharts Canvas | 15 | Line wrapper supplies area and stacked defaults, overridable. |
| sparkline_kpi | [CompactSparklineKpi](../ui/src/appspec/visuals/CompactSparklineKpi.jsx) | DOM/CSS | 0 | Calls CompactKpi directly with sparkline and trend forced on. |
| slope | [CompactSlopeEcharts](../ui/src/appspec/visuals/CompactSlopeEcharts.jsx) | ECharts Canvas | 6 | Dedicated ECharts lines joining two measure positions per category. |
| bump | [CompactBumpChartEcharts](../ui/src/appspec/visuals/CompactBumpChartEcharts.jsx) | ECharts Canvas | 15 | Inverted line axis; not a full rank-tracking multi-entity transformation. |
| chord | [CompactChord](../ui/src/appspec/visuals/CompactChord.jsx) | DOM + SVG | 0 | Fixed SVG arc diagram, at most 20 rows and 8 legend entries; no chord ribbons. |
| sunburst | [CompactSunburst](../ui/src/appspec/visuals/CompactSunburst.jsx) | Recharts SVG | 0 | Live Recharts donut approximation, not a hierarchical sunburst. |
| narrative | [CompactNarrative](../ui/src/appspec/visuals/CompactNarrative.jsx) | DOM/CSS | 0 | DOM sanitized narrative with optional generated text/number highlighting. |
| insight | [CompactNarrative](../ui/src/appspec/visuals/CompactNarrative.jsx) | DOM/CSS | 0 | Alias of narrative. |
| waffle | [CompactWaffle](../ui/src/appspec/visuals/CompactWaffle.jsx) | DOM/CSS | 0 | Fixed 10×10 DOM cells; multiple rows use largest-remainder allocation totaling 100 cells, scalar mode uses maxValue. Shared component also bundled for Power BI. |
| bar_race | [CompactBarRaceEcharts](../ui/src/appspec/visuals/CompactBarRaceEcharts.jsx) | ECharts Canvas | 9 | Own ECharts lifecycle and playback; _cats=[frame,category], cumulative mode, speed and top-N. |
| nav_button | [CompactNavButton](../ui/src/appspec/visuals/CompactNavButton.jsx) | DOM/CSS | 0 | Bare navigation element, host callback required. |
| text_box | [CompactTextBox](../ui/src/appspec/visuals/CompactTextBox.jsx) | DOM/CSS | 6 | Bare editable rich text; DOMPurify and text-edit bus. |
| shape | [CompactShape](../ui/src/appspec/visuals/CompactShape.jsx) | DOM + SVG | 6 | Bare decorative DOM/SVG element. |
| image | [CompactImage](../ui/src/appspec/visuals/CompactImage.jsx) | DOM/CSS | 5 | Bare image; embedded data or URL configuration. |
| divider | [CompactDivider](../ui/src/appspec/visuals/CompactDivider.jsx) | DOM/CSS | 4 | Bare divider element. |
| custom | [CompactCustom](../ui/src/appspec/visuals/CompactCustom.jsx) | ECharts Canvas | 0 | Declarative ECharts template from spec.customVisuals; params/slots, no arbitrary generated JavaScript; validator omission SPEC-CUSTOM-001. |

## kpi

- Registry symbol: `CompactKpi`; data roles: Primary measure; optional secondary / series.
- Primitive calls: No shared primitive function calls found in active source chain.
- Source chain: `ui/src/appspec/visuals/CompactKpi.jsx`.
- Attached schema keys: None; manual/dynamic inspector configuration needs separate mapping.
- Renderer config-key references: `align`, `animations`, `cardStyle`, `colorScheme`, `compact`, `countUp`, `countUpDuration`, `icon`, `iconColor`, `iconSize`, `label`, `maxValue`, `measureName`, `prefix`, `progressColor`, `progressHeight`, `progressMax`, `progressTrackColor`, `showGlow`, `showIcon`, `showProgress`, `showSparkline`, `showTitle`, `showTrend`, `sparklineAxis`, `sparklineColor`, `sparklineHeight`, `sparklinePosition`, `sparklineShowArea`, `sparklineWeight`, `sparklineWidth`, `subtitle`, `suffix`, `title`, `titleColor`, `titleFontFamily`, `titleFontSize`, `titleFontWeight`, `titlePosition`, `titleUppercase`, `trendDownColor`, `trendFontSize`, `trendUpColor`, `trendValue`, `valueColor`, `valueFontFamily`, `valueFontSize`, `valueFontWeight`.
- Selection callback reference: No _onBarClick found; do not assume cross-filter support. Tooltip reference: not found in leaf chain.
- AI: shared patch pipeline exists; exact per-property parity not verified. DOM value card, optional SVG sparkline/progress/trend; may issue supporting queries.

## bar

- Registry symbol: `CompactBar`; data roles: Category dimension + measure(s); exact role limits need UI verification.
- Primitive calls: CartesianFrame, CategoricalAxis, LinearAxis, BarMarks, Tooltip, Legend.
- Source chain: `ui/src/appspec/visuals/CompactBarEcharts.jsx`.
- Attached schema keys: `barRadius`, `maxBarSize`, `showBarBackground`, `gradient`, `rankOpacity`, `highlightMax`, `gridLines`, `gridStyle`, `stacked`, `secondaryColor`, `dataLabels`, `labelPosition`, `showAvgLine`, `avgLineColor`, `avgLineStyle`.
- Renderer config-key references: `animationDuration`, `animationEnabled`, `animations`, `avgLineColor`, `avgLineStyle`, `barCategoryGap`, `barRadius`, `categoryColors`, `colorScheme`, `conditionalColor`, `dataLabelColor`, `dataLabels`, `gradient`, `gradientTo`, `gridLines`, `gridStyle`, `highlightMax`, `label`, `labelPosition`, `limit`, `maxBarSize`, `measureName`, `orderBy`, `orientation`, `prefix`, `rankOpacity`, `showAvgLine`, `showBarBackground`, `showXAxis`, `showYAxis`, `suffix`, `targetLine`, `title`, `tooltipShowName`, `tooltipShowSwatch`, `tooltipShowTitle`, `tooltipShowValue`, `tooltipTitle`.
- Selection callback reference: _onBarClick found; host semantics not tested. Tooltip reference: present; content/edge behavior unverified.
- AI: shared patch pipeline exists; exact per-property parity not verified. Horizontal default; primitive composition; expand-in-place uses a separate option builder.

## stacked_bar

- Registry symbol: `CompactStackedBar`; data roles: Category dimension + measure(s); exact role limits need UI verification.
- Primitive calls: CartesianFrame, CategoricalAxis, LinearAxis, BarMarks, Tooltip, Legend.
- Source chain: `ui/src/appspec/visuals/CompactStackedBarEcharts.jsx`.
- Attached schema keys: `barRadius`, `maxBarSize`, `showBarBackground`, `gradient`, `rankOpacity`, `highlightMax`, `gridLines`, `gridStyle`, `stacked`, `secondaryColor`, `dataLabels`, `labelPosition`, `showAvgLine`, `avgLineColor`, `avgLineStyle`.
- Renderer config-key references: `animationDuration`, `animationEnabled`, `animations`, `barCategoryGap`, `barRadius`, `colorScheme`, `dataLabelColor`, `dataLabels`, `gradient`, `gradientTo`, `gridLines`, `gridStyle`, `highlightMax`, `label`, `labelPosition`, `legendColor`, `legendFontSize`, `legendPosition`, `limit`, `maxBarSize`, `measureName`, `orderBy`, `orientation`, `prefix`, `rankOpacity`, `secondaryColor`, `secondaryMeasureName`, `showBarBackground`, `showLegend`, `showXAxis`, `showYAxis`, `stacked`, `suffix`, `title`, `tooltipShowName`, `tooltipShowSwatch`, `tooltipShowTitle`, `tooltipShowValue`, `tooltipTitle`.
- Selection callback reference: _onBarClick found; host semantics not tested. Tooltip reference: present; content/edge behavior unverified.
- AI: shared patch pipeline exists; exact per-property parity not verified. Multiple measures stacked; separate composition from single bar.

## line

- Registry symbol: `CompactLine`; data roles: Category dimension + measure(s); exact role limits need UI verification.
- Primitive calls: LineMarks.
- Source chain: `ui/src/appspec/visuals/CompactLineEcharts.jsx`.
- Attached schema keys: `chartType`, `smooth`, `strokeWidth`, `fillOpacity`, `stacked`, `primaryColor`, `secondaryColor`, `showDots`, `dotSize`, `showGrid`, `showXAxis`, `showYAxis`, `invertY`, `showAvgLine`, `targetLine`.
- Renderer config-key references: `animationEnabled`, `animations`, `chartType`, `colorScheme`, `dataLabels`, `dotSize`, `fillOpacity`, `gridLines`, `invertY`, `label`, `measureName`, `prefix`, `primaryColor`, `secondaryColor`, `secondaryMeasureName`, `showAvgLine`, `showDots`, `showXAxis`, `showYAxis`, `smooth`, `strokeWidth`, `suffix`, `targetLine`, `title`, `type`.
- Selection callback reference: _onBarClick found; host semantics not tested. Tooltip reference: present; content/edge behavior unverified.
- AI: shared patch pipeline exists; exact per-property parity not verified. Shared LineMarks; conditional hook defect VIS-LINE-001.

## area

- Registry symbol: `CompactLine`; data roles: Category dimension + measure(s); exact role limits need UI verification.
- Primitive calls: LineMarks.
- Source chain: `ui/src/appspec/visuals/CompactLineEcharts.jsx`.
- Attached schema keys: `chartType`, `smooth`, `strokeWidth`, `fillOpacity`, `stacked`, `primaryColor`, `secondaryColor`, `showDots`, `dotSize`, `showGrid`, `showXAxis`, `showYAxis`, `invertY`, `showAvgLine`, `targetLine`.
- Renderer config-key references: `animationEnabled`, `animations`, `chartType`, `colorScheme`, `dataLabels`, `dotSize`, `fillOpacity`, `gridLines`, `invertY`, `label`, `measureName`, `prefix`, `primaryColor`, `secondaryColor`, `secondaryMeasureName`, `showAvgLine`, `showDots`, `showXAxis`, `showYAxis`, `smooth`, `strokeWidth`, `suffix`, `targetLine`, `title`, `type`.
- Selection callback reference: _onBarClick found; host semantics not tested. Tooltip reference: present; content/edge behavior unverified.
- AI: shared patch pipeline exists; exact per-property parity not verified. Same component as line; host config.type or chartType supplies area mode.

## donut

- Registry symbol: `CompactDonut`; data roles: Category dimension + measure(s); exact role limits need UI verification.
- Primitive calls: PieMarks.
- Source chain: `ui/src/appspec/visuals/CompactDonutEcharts.jsx`.
- Attached schema keys: `innerRadius`, `outerRadius`, `paddingAngle`, `cornerRadius`, `showLegend`, `legendPosition`, `maxLegendItems`, `showLabels`, `labelStyle`, `showCenterText`, `centerFontSize`, `centerColor`.
- Renderer config-key references: `animationEnabled`, `categoryColors`, `centerColor`, `centerFontSize`, `colorScheme`, `cornerRadius`, `customColors`, `innerRadius`, `label`, `labelStyle`, `legendColor`, `legendFontSize`, `legendPosition`, `maxLegendItems`, `maxValue`, `outerRadius`, `paddingAngle`, `prefix`, `showCenterText`, `showLabels`, `showLegend`, `strokeColor`, `strokeWidth`, `suffix`, `title`, `valueFontSize`.
- Selection callback reference: _onBarClick found; host semantics not tested. Tooltip reference: present; content/edge behavior unverified.
- AI: shared patch pipeline exists; exact per-property parity not verified. PieMarks plus hand-built legend/center presentation.

## pie

- Registry symbol: `CompactPie`; data roles: Category dimension + measure(s); exact role limits need UI verification.
- Primitive calls: PieMarks.
- Source chain: `ui/src/appspec/visuals/CompactPie.jsx`, `ui/src/appspec/visuals/CompactDonutEcharts.jsx`.
- Attached schema keys: `innerRadius`, `outerRadius`, `paddingAngle`, `cornerRadius`, `showLegend`, `legendPosition`, `maxLegendItems`, `showLabels`, `labelStyle`, `showCenterText`, `centerFontSize`, `centerColor`.
- Renderer config-key references: `animationEnabled`, `categoryColors`, `centerColor`, `centerFontSize`, `colorScheme`, `cornerRadius`, `customColors`, `innerRadius`, `label`, `labelStyle`, `legendColor`, `legendFontSize`, `legendPosition`, `maxLegendItems`, `maxValue`, `outerRadius`, `paddingAngle`, `prefix`, `showCenterText`, `showLabels`, `showLegend`, `strokeColor`, `strokeWidth`, `suffix`, `title`, `valueFontSize`.
- Selection callback reference: _onBarClick found; host semantics not tested. Tooltip reference: present; content/edge behavior unverified.
- AI: shared patch pipeline exists; exact per-property parity not verified. Forces innerRadius=0 and center text off; unlike donut, still reads localStorage legacy renderer flag.

## gauge

- Registry symbol: `CompactGauge`; data roles: Primary measure; optional secondary / series.
- Primitive calls: GaugeMarks.
- Source chain: `ui/src/appspec/visuals/CompactGaugeEcharts.jsx`.
- Attached schema keys: `minValue`, `maxValue`, `arcWidth`, `gaugeSize`, `showMinMax`, `valueFontSize`.
- Renderer config-key references: `animationEnabled`, `arcWidth`, `colorScheme`, `colorZones`, `gaugeSize`, `maxValue`, `minValue`, `prefix`, `showMinMax`, `suffix`, `valueFontSize`.
- Selection callback reference: No _onBarClick found; do not assume cross-filter support. Tooltip reference: present; content/edge behavior unverified.
- AI: shared patch pipeline exists; exact per-property parity not verified. GaugeMarks composition; gauge flag hardcoded on.

## radar

- Registry symbol: `CompactRadar`; data roles: Category dimension + measure(s); exact role limits need UI verification.
- Primitive calls: RadarMarks.
- Source chain: `ui/src/appspec/visuals/CompactRadarEcharts.jsx`.
- Attached schema keys: `fillOpacity`, `strokeWidth`, `showDots`, `radarRadius`, `labelFontSize`.
- Renderer config-key references: `animationEnabled`, `colorScheme`, `fillOpacity`, `label`, `labelFontSize`, `prefix`, `radarRadius`, `showDots`, `strokeWidth`, `suffix`, `title`.
- Selection callback reference: _onBarClick found; host semantics not tested. Tooltip reference: present; content/edge behavior unverified.
- AI: shared patch pipeline exists; exact per-property parity not verified. RadarMarks composition; radial axes owned by primitive.

## scatter

- Registry symbol: `CompactScatter`; data roles: Category + x/y measures; optional size measure.
- Primitive calls: PointMarks.
- Source chain: `ui/src/appspec/visuals/CompactScatterEcharts.jsx`.
- Attached schema keys: `dotSize`, `fillOpacity`, `showGrid`, `showXAxis`, `showYAxis`, `showLabels`.
- Renderer config-key references: `animationEnabled`, `colorScheme`, `dotSize`, `dotSizeMax`, `fillOpacity`, `gridLines`, `label`, `measureName`, `secondaryMeasureName`, `showLabels`, `showXAxis`, `showYAxis`, `title`.
- Selection callback reference: No _onBarClick found; do not assume cross-filter support. Tooltip reference: present; content/edge behavior unverified.
- AI: shared patch pipeline exists; exact per-property parity not verified. PointMarks; measures mapped to x/y, optional third measure to size.

## bubble

- Registry symbol: `CompactBubble`; data roles: Category + x/y measures; optional size measure.
- Primitive calls: PointMarks.
- Source chain: `ui/src/appspec/visuals/CompactBubbleEcharts.jsx`, `ui/src/appspec/visuals/CompactScatterEcharts.jsx`.
- Attached schema keys: `dotSize`, `fillOpacity`, `showGrid`, `showXAxis`, `showYAxis`, `showLabels`.
- Renderer config-key references: `animationEnabled`, `colorScheme`, `dotSize`, `dotSizeMax`, `fillOpacity`, `gridLines`, `label`, `measureName`, `secondaryMeasureName`, `showLabels`, `showXAxis`, `showYAxis`, `title`.
- Selection callback reference: No _onBarClick found; do not assume cross-filter support. Tooltip reference: present; content/edge behavior unverified.
- AI: shared patch pipeline exists; exact per-property parity not verified. Scatter wrapper, third-measure size, different dot defaults.

## treemap

- Registry symbol: `CompactTreemap`; data roles: Category dimension + measure(s); exact role limits need UI verification.
- Primitive calls: TreemapMarks.
- Source chain: `ui/src/appspec/visuals/CompactTreemapEcharts.jsx`.
- Attached schema keys: `showLabels`, `labelColor`, `labelFontSize`, `showValues`, `valueColor`, `valueFontSize`, `colorMode`, `borderRadius`, `borderWidth`, `padding`.
- Renderer config-key references: `animationEnabled`, `borderColor`, `borderRadius`, `borderWidth`, `categoryColors`, `colorMode`, `colorScheme`, `customColors`, `label`, `labelColor`, `labelFontSize`, `padding`, `prefix`, `showLabels`, `showValues`, `suffix`, `title`, `valueColor`, `valueFontSize`.
- Selection callback reference: _onBarClick found; host semantics not tested. Tooltip reference: present; content/edge behavior unverified.
- AI: shared patch pipeline exists; exact per-property parity not verified. TreemapMarks; hierarchical layout delegated to ECharts.

## funnel

- Registry symbol: `CompactFunnel`; data roles: Category dimension + measure(s); exact role limits need UI verification.
- Primitive calls: No shared primitive function calls found in active source chain.
- Source chain: `ui/src/appspec/visuals/CompactFunnel.jsx`.
- Attached schema keys: None; manual/dynamic inspector configuration needs separate mapping.
- Renderer config-key references: `animationEnabled`, `barGap`, `barHeight`, `barRadius`, `colorScheme`, `gradient`, `labelWidth`, `prefix`, `showConversion`, `showPercentage`, `showValues`, `suffix`.
- Selection callback reference: No _onBarClick found; do not assume cross-filter support. Tooltip reference: not found in leaf chain.
- AI: shared patch pipeline exists; exact per-property parity not verified. DOM horizontal stages, not ECharts. Empty result invents sample stages: VIS-FUNNEL-001.

## sankey

- Registry symbol: `CompactChord`; data roles: Category dimension + measure(s); exact role limits need UI verification.
- Primitive calls: No shared primitive function calls found in active source chain.
- Source chain: `ui/src/appspec/visuals/CompactChord.jsx`.
- Attached schema keys: None; manual/dynamic inspector configuration needs separate mapping.
- Renderer config-key references: `colorScheme`, `customColors`, `label`, `prefix`, `suffix`, `title`.
- Selection callback reference: No _onBarClick found; do not assume cross-filter support. Tooltip reference: not found in leaf chain.
- AI: shared patch pipeline exists; exact per-property parity not verified. Alias of CompactChord: circular arcs, no source-target flow links.

## table

- Registry symbol: `CompactTableEcharts`; data roles: dimensions[] + measures[]; _cats/_vals arrays.
- Primitive calls: No shared primitive function calls found in active source chain.
- Source chain: `ui/src/appspec/visuals/CompactTableEcharts.jsx`.
- Attached schema keys: None; manual/dynamic inspector configuration needs separate mapping.
- Renderer config-key references: `colorScheme`, `heatmap`, `length`, `measureName`, `miniBars`, `prefix`, `rankColumn`, `secondaryMeasureName`, `slice`, `suffix`, `title`.
- Selection callback reference: No _onBarClick found; do not assume cross-filter support. Tooltip reference: not found in leaf chain.
- AI: shared patch pipeline exists; exact per-property parity not verified. Despite filename, HTML table; multi-dimension/value arrays, local sorting and local column widths.

## column

- Registry symbol: `CompactColumn`; data roles: Category dimension + measure(s); exact role limits need UI verification.
- Primitive calls: CartesianFrame, CategoricalAxis, LinearAxis, BarMarks, Tooltip, Legend.
- Source chain: `ui/src/appspec/visuals/CompactColumnEcharts.jsx`, `ui/src/appspec/visuals/CompactBarEcharts.jsx`.
- Attached schema keys: `barRadius`, `maxBarSize`, `showBarBackground`, `gradient`, `rankOpacity`, `highlightMax`, `gridLines`, `gridStyle`, `stacked`, `secondaryColor`, `dataLabels`, `labelPosition`, `showAvgLine`, `avgLineColor`, `avgLineStyle`.
- Renderer config-key references: `animationDuration`, `animationEnabled`, `animations`, `avgLineColor`, `avgLineStyle`, `barCategoryGap`, `barRadius`, `categoryColors`, `colorScheme`, `conditionalColor`, `dataLabelColor`, `dataLabels`, `gradient`, `gradientTo`, `gridLines`, `gridStyle`, `highlightMax`, `label`, `labelPosition`, `limit`, `maxBarSize`, `measureName`, `orderBy`, `orientation`, `prefix`, `rankOpacity`, `showAvgLine`, `showBarBackground`, `showXAxis`, `showYAxis`, `suffix`, `targetLine`, `title`, `tooltipShowName`, `tooltipShowSwatch`, `tooltipShowTitle`, `tooltipShowValue`, `tooltipTitle`.
- Selection callback reference: _onBarClick found; host semantics not tested. Tooltip reference: present; content/edge behavior unverified.
- AI: shared patch pipeline exists; exact per-property parity not verified. Delegates to bar with vertical defaults.

## waterfall

- Registry symbol: `CompactWaterfall`; data roles: Category dimension + measure(s); exact role limits need UI verification.
- Primitive calls: No shared primitive function calls found in active source chain.
- Source chain: `ui/src/appspec/visuals/CompactWaterfall.jsx`.
- Attached schema keys: None; manual/dynamic inspector configuration needs separate mapping.
- Renderer config-key references: `barRadius`, `colorScheme`, `connectorColor`, `connectorLines`, `dataLabels`, `decreaseColor`, `increaseColor`, `label`, `prefix`, `showTotal`, `suffix`, `title`, `totalColor`.
- Selection callback reference: No _onBarClick found; do not assume cross-filter support. Tooltip reference: not found in leaf chain.
- AI: shared patch pipeline exists; exact per-property parity not verified. DOM percentage-positioned cumulative bars, optional total, connectors and boundary labels.

## lollipop

- Registry symbol: `CompactLollipop`; data roles: Category dimension + measure(s); exact role limits need UI verification.
- Primitive calls: No shared primitive function calls found in active source chain.
- Source chain: `ui/src/appspec/visuals/CompactLollipopEcharts.jsx`.
- Attached schema keys: `orientation`, `dotSize`, `lineWidth`, `gridLines`, `dataLabels`.
- Renderer config-key references: `categoryColors`, `colorScheme`, `dataLabels`, `dotSize`, `gridLines`, `label`, `limit`, `lineWidth`, `orientation`, `prefix`, `suffix`, `title`.
- Selection callback reference: No _onBarClick found; do not assume cross-filter support. Tooltip reference: present; content/edge behavior unverified.
- AI: shared patch pipeline exists; exact per-property parity not verified. Dedicated ECharts thin-bar stems plus scatter points; own schema.

## bullet

- Registry symbol: `CompactBullet`; data roles: Primary measure; optional secondary / series.
- Primitive calls: No shared primitive function calls found in active source chain.
- Source chain: `ui/src/appspec/visuals/CompactBullet.jsx`.
- Attached schema keys: None; manual/dynamic inspector configuration needs separate mapping.
- Renderer config-key references: `barHeight`, `colorScheme`, `label`, `maxValue`, `prefix`, `ranges`, `suffix`, `targetValue`, `title`, `valueFontFamily`, `valueFontSize`.
- Selection callback reference: No _onBarClick found; do not assume cross-filter support. Tooltip reference: not found in leaf chain.
- AI: shared patch pipeline exists; exact per-property parity not verified. DOM/SVG target/qualitative ranges card; not a BarMarks visual.

## progress

- Registry symbol: `CompactProgressBar`; data roles: Primary measure; optional secondary / series.
- Primitive calls: No shared primitive function calls found in active source chain.
- Source chain: `ui/src/appspec/visuals/CompactProgressBar.jsx`.
- Attached schema keys: `maxValue`, `barHeight`, `barRadius`, `showPercentage`, `valueFontSize`.
- Renderer config-key references: `barHeight`, `barRadius`, `colorScheme`, `label`, `maxValue`, `prefix`, `showPercentage`, `suffix`, `title`, `valueFontSize`.
- Selection callback reference: No _onBarClick found; do not assume cross-filter support. Tooltip reference: not found in leaf chain.
- AI: shared patch pipeline exists; exact per-property parity not verified. DOM single-value progress card with independent schema.

## heatmap

- Registry symbol: `CompactHeatmap`; data roles: Category dimension + measure(s); exact role limits need UI verification.
- Primitive calls: No shared primitive function calls found in active source chain.
- Source chain: `ui/src/appspec/visuals/CompactHeatmap.jsx`.
- Attached schema keys: None; manual/dynamic inspector configuration needs separate mapping.
- Renderer config-key references: `cellGap`, `cellRadius`, `colorScheme`, `columns`, `highColor`, `label`, `lowColor`, `prefix`, `showValues`, `suffix`, `title`.
- Selection callback reference: No _onBarClick found; do not assume cross-filter support. Tooltip reference: present; content/edge behavior unverified.
- AI: shared patch pipeline exists; exact per-property parity not verified. CSS square-cell grid over category/value rows, not a two-dimensional pivot.

## ranked_list

- Registry symbol: `CompactRankedList`; data roles: Category dimension + measure(s); exact role limits need UI verification.
- Primitive calls: No shared primitive function calls found in active source chain.
- Source chain: `ui/src/appspec/visuals/CompactRankedList.jsx`.
- Attached schema keys: None; manual/dynamic inspector configuration needs separate mapping.
- Renderer config-key references: `colorScheme`, `label`, `limit`, `prefix`, `showBar`, `showRank`, `suffix`, `title`.
- Selection callback reference: No _onBarClick found; do not assume cross-filter support. Tooltip reference: not found in leaf chain.
- AI: shared patch pipeline exists; exact per-property parity not verified. DOM ranked rows with inline bars.

## stat_card

- Registry symbol: `CompactStatCard`; data roles: Primary measure; optional secondary / series.
- Primitive calls: No shared primitive function calls found in active source chain.
- Source chain: `ui/src/appspec/visuals/CompactStatCard.jsx`.
- Attached schema keys: None; manual/dynamic inspector configuration needs separate mapping.
- Renderer config-key references: `colorScheme`, `label`, `prefix`, `subtitle`, `suffix`, `title`, `valueFontFamily`, `valueFontSize`.
- Selection callback reference: No _onBarClick found; do not assume cross-filter support. Tooltip reference: not found in leaf chain.
- AI: shared patch pipeline exists; exact per-property parity not verified. DOM value and secondary-value trend.

## metric_tile

- Registry symbol: `CompactMetricTile`; data roles: Primary measure; optional secondary / series.
- Primitive calls: No shared primitive function calls found in active source chain.
- Source chain: `ui/src/appspec/visuals/CompactMetricTile.jsx`.
- Attached schema keys: None; manual/dynamic inspector configuration needs separate mapping.
- Renderer config-key references: `colorScheme`, `label`, `maxValue`, `prefix`, `suffix`, `title`, `valueFontSize`.
- Selection callback reference: No _onBarClick found; do not assume cross-filter support. Tooltip reference: not found in leaf chain.
- AI: shared patch pipeline exists; exact per-property parity not verified. Fixed SVG mini-ring and DOM value.

## grouped_bar

- Registry symbol: `CompactGroupedBar`; data roles: Category dimension + measure(s); exact role limits need UI verification.
- Primitive calls: CartesianFrame, CategoricalAxis, LinearAxis, BarMarks, Tooltip, Legend.
- Source chain: `ui/src/appspec/visuals/CompactGroupedBarEcharts.jsx`.
- Attached schema keys: `barRadius`, `maxBarSize`, `showBarBackground`, `gradient`, `rankOpacity`, `highlightMax`, `gridLines`, `gridStyle`, `stacked`, `secondaryColor`, `dataLabels`, `labelPosition`, `showAvgLine`, `avgLineColor`, `avgLineStyle`.
- Renderer config-key references: `animationDuration`, `animationEnabled`, `animations`, `barCategoryGap`, `barRadius`, `colorScheme`, `dataLabelColor`, `dataLabels`, `gradient`, `gradientTo`, `gridLines`, `gridStyle`, `highlightMax`, `label`, `labelPosition`, `legendColor`, `legendFontSize`, `legendPosition`, `limit`, `maxBarSize`, `measureName`, `orderBy`, `orientation`, `prefix`, `rankOpacity`, `secondaryColor`, `secondaryMeasureName`, `showBarBackground`, `showLegend`, `showXAxis`, `showYAxis`, `stacked`, `suffix`, `title`, `tooltipShowName`, `tooltipShowSwatch`, `tooltipShowTitle`, `tooltipShowValue`, `tooltipTitle`.
- Selection callback reference: _onBarClick found; host semantics not tested. Tooltip reference: present; content/edge behavior unverified.
- AI: shared patch pipeline exists; exact per-property parity not verified. Separate composition with side-by-side series defaults.

## stacked_area

- Registry symbol: `CompactStackedArea`; data roles: Category dimension + measure(s); exact role limits need UI verification.
- Primitive calls: LineMarks.
- Source chain: `ui/src/appspec/visuals/CompactStackedAreaEcharts.jsx`, `ui/src/appspec/visuals/CompactLineEcharts.jsx`.
- Attached schema keys: `chartType`, `smooth`, `strokeWidth`, `fillOpacity`, `stacked`, `primaryColor`, `secondaryColor`, `showDots`, `dotSize`, `showGrid`, `showXAxis`, `showYAxis`, `invertY`, `showAvgLine`, `targetLine`.
- Renderer config-key references: `animationEnabled`, `animations`, `chartType`, `colorScheme`, `dataLabels`, `dotSize`, `fillOpacity`, `gridLines`, `invertY`, `label`, `measureName`, `prefix`, `primaryColor`, `secondaryColor`, `secondaryMeasureName`, `showAvgLine`, `showDots`, `showXAxis`, `showYAxis`, `smooth`, `strokeWidth`, `suffix`, `targetLine`, `title`, `type`.
- Selection callback reference: _onBarClick found; host semantics not tested. Tooltip reference: present; content/edge behavior unverified.
- AI: shared patch pipeline exists; exact per-property parity not verified. Line wrapper supplies area and stacked defaults, overridable.

## sparkline_kpi

- Registry symbol: `CompactSparklineKpi`; data roles: Primary measure; optional secondary / series.
- Primitive calls: No shared primitive function calls found in active source chain.
- Source chain: `ui/src/appspec/visuals/CompactSparklineKpi.jsx`, `ui/src/appspec/visuals/CompactKpi.jsx`.
- Attached schema keys: None; manual/dynamic inspector configuration needs separate mapping.
- Renderer config-key references: `align`, `animations`, `cardStyle`, `colorScheme`, `compact`, `countUp`, `countUpDuration`, `icon`, `iconColor`, `iconSize`, `label`, `maxValue`, `measureName`, `prefix`, `progressColor`, `progressHeight`, `progressMax`, `progressTrackColor`, `showGlow`, `showIcon`, `showProgress`, `showSparkline`, `showTitle`, `showTrend`, `sparklineAxis`, `sparklineColor`, `sparklineHeight`, `sparklinePosition`, `sparklineShowArea`, `sparklineWeight`, `sparklineWidth`, `subtitle`, `suffix`, `title`, `titleColor`, `titleFontFamily`, `titleFontSize`, `titleFontWeight`, `titlePosition`, `titleUppercase`, `trendDownColor`, `trendFontSize`, `trendUpColor`, `trendValue`, `valueColor`, `valueFontFamily`, `valueFontSize`, `valueFontWeight`.
- Selection callback reference: No _onBarClick found; do not assume cross-filter support. Tooltip reference: not found in leaf chain.
- AI: shared patch pipeline exists; exact per-property parity not verified. Calls CompactKpi directly with sparkline and trend forced on.

## slope

- Registry symbol: `CompactSlopeChart`; data roles: Category dimension + measure(s); exact role limits need UI verification.
- Primitive calls: No shared primitive function calls found in active source chain.
- Source chain: `ui/src/appspec/visuals/CompactSlopeEcharts.jsx`.
- Attached schema keys: `leftLabel`, `rightLabel`, `showValues`, `showLegend`, `lineWidth`, `dotSize`.
- Renderer config-key references: `customColors`, `dotSize`, `label`, `leftLabel`, `limit`, `lineWidth`, `prefix`, `rightLabel`, `showLegend`, `showValues`, `suffix`, `title`.
- Selection callback reference: No _onBarClick found; do not assume cross-filter support. Tooltip reference: present; content/edge behavior unverified.
- AI: shared patch pipeline exists; exact per-property parity not verified. Dedicated ECharts lines joining two measure positions per category.

## bump

- Registry symbol: `CompactBumpChart`; data roles: Category dimension + measure(s); exact role limits need UI verification.
- Primitive calls: LineMarks.
- Source chain: `ui/src/appspec/visuals/CompactBumpChartEcharts.jsx`, `ui/src/appspec/visuals/CompactLineEcharts.jsx`.
- Attached schema keys: `chartType`, `smooth`, `strokeWidth`, `fillOpacity`, `stacked`, `primaryColor`, `secondaryColor`, `showDots`, `dotSize`, `showGrid`, `showXAxis`, `showYAxis`, `invertY`, `showAvgLine`, `targetLine`.
- Renderer config-key references: `animationEnabled`, `animations`, `chartType`, `colorScheme`, `dataLabels`, `dotSize`, `fillOpacity`, `gridLines`, `invertY`, `label`, `measureName`, `prefix`, `primaryColor`, `secondaryColor`, `secondaryMeasureName`, `showAvgLine`, `showDots`, `showXAxis`, `showYAxis`, `smooth`, `strokeWidth`, `suffix`, `targetLine`, `title`, `type`.
- Selection callback reference: _onBarClick found; host semantics not tested. Tooltip reference: present; content/edge behavior unverified.
- AI: shared patch pipeline exists; exact per-property parity not verified. Inverted line axis; not a full rank-tracking multi-entity transformation.

## chord

- Registry symbol: `CompactChord`; data roles: Category dimension + measure(s); exact role limits need UI verification.
- Primitive calls: No shared primitive function calls found in active source chain.
- Source chain: `ui/src/appspec/visuals/CompactChord.jsx`.
- Attached schema keys: None; manual/dynamic inspector configuration needs separate mapping.
- Renderer config-key references: `colorScheme`, `customColors`, `label`, `prefix`, `suffix`, `title`.
- Selection callback reference: No _onBarClick found; do not assume cross-filter support. Tooltip reference: not found in leaf chain.
- AI: shared patch pipeline exists; exact per-property parity not verified. Fixed SVG arc diagram, at most 20 rows and 8 legend entries; no chord ribbons.

## sunburst

- Registry symbol: `CompactSunburst`; data roles: Category dimension + measure(s); exact role limits need UI verification.
- Primitive calls: No shared primitive function calls found in active source chain.
- Source chain: `ui/src/appspec/visuals/CompactSunburst.jsx`.
- Attached schema keys: None; manual/dynamic inspector configuration needs separate mapping.
- Renderer config-key references: `colorScheme`, `customColors`, `innerRadius`, `label`, `outerRadius`, `prefix`, `showLabels`, `suffix`, `title`.
- Selection callback reference: No _onBarClick found; do not assume cross-filter support. Tooltip reference: present; content/edge behavior unverified.
- AI: shared patch pipeline exists; exact per-property parity not verified. Live Recharts donut approximation, not a hierarchical sunburst.

## narrative

- Registry symbol: `CompactNarrative`; data roles: Category dimension + measure(s); exact role limits need UI verification.
- Primitive calls: No shared primitive function calls found in active source chain.
- Source chain: `ui/src/appspec/visuals/CompactNarrative.jsx`.
- Attached schema keys: None; manual/dynamic inspector configuration needs separate mapping.
- Renderer config-key references: `accentWords`, `align`, `colorScheme`, `icon`, `label`, `measureName`, `narrativeFontSize`, `narrativeFontWeight`, `narrativeLineHeight`, `narrativeText`, `prefix`, `showIcon`, `subtitle`, `suffix`, `title`, `titleFontFamily`.
- Selection callback reference: No _onBarClick found; do not assume cross-filter support. Tooltip reference: not found in leaf chain.
- AI: shared patch pipeline exists; exact per-property parity not verified. DOM sanitized narrative with optional generated text/number highlighting.

## insight

- Registry symbol: `CompactNarrative`; data roles: Category dimension + measure(s); exact role limits need UI verification.
- Primitive calls: No shared primitive function calls found in active source chain.
- Source chain: `ui/src/appspec/visuals/CompactNarrative.jsx`.
- Attached schema keys: None; manual/dynamic inspector configuration needs separate mapping.
- Renderer config-key references: `accentWords`, `align`, `colorScheme`, `icon`, `label`, `measureName`, `narrativeFontSize`, `narrativeFontWeight`, `narrativeLineHeight`, `narrativeText`, `prefix`, `showIcon`, `subtitle`, `suffix`, `title`, `titleFontFamily`.
- Selection callback reference: No _onBarClick found; do not assume cross-filter support. Tooltip reference: not found in leaf chain.
- AI: shared patch pipeline exists; exact per-property parity not verified. Alias of narrative.

## waffle

- Registry symbol: `CompactWaffle`; data roles: Category dimension + measure(s); exact role limits need UI verification.
- Primitive calls: No shared primitive function calls found in active source chain.
- Source chain: `ui/src/appspec/visuals/CompactWaffle.jsx`.
- Attached schema keys: None; manual/dynamic inspector configuration needs separate mapping.
- Renderer config-key references: `cellGap`, `cellRadius`, `cellSize`, `colorScheme`, `customColors`, `maxValue`, `prefix`, `suffix`.
- Selection callback reference: No _onBarClick found; do not assume cross-filter support. Tooltip reference: not found in leaf chain.
- AI: shared patch pipeline exists; exact per-property parity not verified. Fixed 10×10 DOM cells; multiple rows use largest-remainder allocation totaling 100 cells, scalar mode uses maxValue. Shared component also bundled for Power BI.

## bar_race

- Registry symbol: `CompactBarRace`; data roles: Frame + category dimensions; measure.
- Primitive calls: No shared primitive function calls found in active source chain.
- Source chain: `ui/src/appspec/visuals/CompactBarRaceEcharts.jsx`.
- Attached schema keys: `raceMode`, `playSpeed`, `autoPlay`, `loopPlayback`, `barColorMode`, `raceControlColor`, `dataLabels`, `valuePrefix`, `valueSuffix`.
- Renderer config-key references: `autoPlay`, `barColorMode`, `categoryColors`, `colorScheme`, `dataLabels`, `limit`, `loopPlayback`, `playAxis`, `playSpeed`, `raceControlColor`, `raceMode`, `tooltipEnabled`, `valuePrefix`, `valueSuffix`.
- Selection callback reference: No _onBarClick found; do not assume cross-filter support. Tooltip reference: present; content/edge behavior unverified.
- AI: shared patch pipeline exists; exact per-property parity not verified. Own ECharts lifecycle and playback; _cats=[frame,category], cumulative mode, speed and top-N.

## nav_button

- Registry symbol: `CompactNavButton`; data roles: No data; host/context for navigation/editing.
- Primitive calls: No shared primitive function calls found in active source chain.
- Source chain: `ui/src/appspec/visuals/CompactNavButton.jsx`.
- Attached schema keys: None; manual/dynamic inspector configuration needs separate mapping.
- Renderer config-key references: `borderRadius`.
- Selection callback reference: No _onBarClick found; do not assume cross-filter support. Tooltip reference: not found in leaf chain.
- AI: shared patch pipeline exists; exact per-property parity not verified. Bare navigation element, host callback required.

## text_box

- Registry symbol: `CompactTextBox`; data roles: No data; host/context for navigation/editing.
- Primitive calls: No shared primitive function calls found in active source chain.
- Source chain: `ui/src/appspec/visuals/CompactTextBox.jsx`.
- Attached schema keys: `fontFamily`, `fontSize`, `fontWeight`, `color`, `align`, `vAlign`.
- Renderer config-key references: None discovered.
- Selection callback reference: No _onBarClick found; do not assume cross-filter support. Tooltip reference: not found in leaf chain.
- AI: shared patch pipeline exists; exact per-property parity not verified. Bare editable rich text; DOMPurify and text-edit bus.

## shape

- Registry symbol: `CompactShape`; data roles: No data; host/context for navigation/editing.
- Primitive calls: No shared primitive function calls found in active source chain.
- Source chain: `ui/src/appspec/visuals/CompactShape.jsx`.
- Attached schema keys: `shape`, `fillColor`, `borderColor`, `borderWidth`, `borderRadius`, `opacity`.
- Renderer config-key references: None discovered.
- Selection callback reference: No _onBarClick found; do not assume cross-filter support. Tooltip reference: not found in leaf chain.
- AI: shared patch pipeline exists; exact per-property parity not verified. Bare decorative DOM/SVG element.

## image

- Registry symbol: `CompactImage`; data roles: No data; host/context for navigation/editing.
- Primitive calls: No shared primitive function calls found in active source chain.
- Source chain: `ui/src/appspec/visuals/CompactImage.jsx`.
- Attached schema keys: `imageUrl`, `fit`, `borderRadius`, `opacity`, `alt`.
- Renderer config-key references: None discovered.
- Selection callback reference: No _onBarClick found; do not assume cross-filter support. Tooltip reference: not found in leaf chain.
- AI: shared patch pipeline exists; exact per-property parity not verified. Bare image; embedded data or URL configuration.

## divider

- Registry symbol: `CompactDivider`; data roles: No data; host/context for navigation/editing.
- Primitive calls: No shared primitive function calls found in active source chain.
- Source chain: `ui/src/appspec/visuals/CompactDivider.jsx`.
- Attached schema keys: `orientation`, `thickness`, `color`, `style`.
- Renderer config-key references: None discovered.
- Selection callback reference: No _onBarClick found; do not assume cross-filter support. Tooltip reference: not found in leaf chain.
- AI: shared patch pipeline exists; exact per-property parity not verified. Bare divider element.

## custom

- Registry symbol: `CompactCustom`; data roles: Template dimension/measure slots.
- Primitive calls: No shared primitive function calls found in active source chain.
- Source chain: `ui/src/appspec/visuals/CompactCustom.jsx`.
- Attached schema keys: None; manual/dynamic inspector configuration needs separate mapping.
- Renderer config-key references: `animations`, `colorScheme`, `dataLabels`, `fontFamily`, `gridLines`, `label`, `sectionColors`, `showLegend`, `title`, `titleFontFamily`.
- Selection callback reference: No _onBarClick found; do not assume cross-filter support. Tooltip reference: present; content/edge behavior unverified.
- AI: shared patch pipeline exists; exact per-property parity not verified. Declarative ECharts template from spec.customVisuals; params/slots, no arbitrary generated JavaScript; validator omission SPEC-CUSTOM-001.

## Custom starter templates

These are additional template designs behind the single `custom` renderer, not additional registry IDs. Slots and params come directly from shipped JSON; every variant still needs host UI/persistence checks.

| Template | Slots | Parameters |
|---|---|---|
| bullet | value: measure × 1 | target, poor, good, max |
| calendar_heatmap | time: time × 1; value: measure × 1 | minColor, maxColor |
| diverging_bar | category: dimension × 1; value: measure × 1 | positiveColor, negativeColor |
| donut | category: dimension × 1; value: measure × 1 | innerRadius, outerRadius |
| dumbbell | category: dimension × 1; start: measure × 1; end: measure × 1 | dotSize |
| heatmap_2d | xDim: dimension × 1; yDim: dimension × 1; value: measure × 1 | minColor, maxColor |
| heat_strip | time: time × 1; value: measure × 1 | minColor, maxColor |
| kpi_delta | value: measure × 1; time: time × 1 | caption |
| kpi_sparkline | value: measure × 1; time: time × 1 | caption |
| lollipop | category: dimension × 1; value: measure × 1 | dotSize |
| pictogram | category: dimension × 1; value: measure × 1 | symbol |
| radial_bar | category: dimension × 1; value: measure × 1 | barWidth |
| range_bar | category: dimension × 1; low: measure × 1; high: measure × 1 | barColor |
| rose | category: dimension × 1; value: measure × 1 | innerRadius, outerRadius |

## Slicers and other surfaces

Runtime branches handle dropdown, buttons, date_range and multi_select. `SLICER_TYPES` lists only the first three. Slicers are separate from VISUAL_MAP. Injector offers a deliberately restricted 16-type palette; custom templates expose additional ECharts series families. Legacy Power BI HTML templates and retained Recharts files must not be counted as new desktop visual IDs. A standalone `combo` ID is absent; line chart configuration provides related mixed-series options that need dedicated field-role validation.

### Waffle implementation update (2026-09-12)
`ui/src/standalone/powerbi-dom.jsx` bundles the existing component for Power BI; `visual.ts` supplies sorted primary category/value rows and theme tokens, and unmounts React before redraw/destroy. App, web, Fabric and Power BI use the same cell allocation and compact scroll layout. The library now exposes Waffle. Empty custom palettes fall back to default colors. Native formatting checks cover cell size/gap/radius, custom colors, prefix/suffix and maxValue; exhaustive settings acceptance is still pending.

### Bullet / Progress implementation update (2026-09-12)
Both are now available in the chart library and use the shared build-time React bridge in Power BI. Bullet has 9 visual-specific schema fields; Progress has 11 (in addition to shared card/value controls). Both have wrapping text and vertically scrollable content for compact bounds. No click/selection handlers exist. The package preserves Bullet secondary-measure targets and Progress configured maxima. Native style checks and actual Service/Desktop/local-file acceptance are recorded in the QA evidence.
