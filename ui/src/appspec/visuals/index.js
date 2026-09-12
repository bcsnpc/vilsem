// VISUAL_MAP — visual.type string → Compact* component. The canonical
// registry. AppSpecRenderer.jsx re-exports this so downstream importers
// (CanvasEditor.jsx, InspectorPanel.jsx) see the symbol at its original
// import path.

import React from 'react'
import CompactKpi from './CompactKpi.jsx'
import CompactBarRecharts from './CompactBarRecharts.jsx'
import CompactBarEcharts from './CompactBarEcharts.jsx'
import CompactStackedBarRecharts from './CompactStackedBarRecharts.jsx'
import CompactStackedBarEcharts from './CompactStackedBarEcharts.jsx'
import CompactLineRecharts from './CompactLineRecharts.jsx'
import CompactLineEcharts from './CompactLineEcharts.jsx'
import CompactDonutRecharts from './CompactDonutRecharts.jsx'
import CompactDonutEcharts from './CompactDonutEcharts.jsx'
import CompactPie from './CompactPie.jsx'
import CompactGaugeSvg from './CompactGaugeSvg.jsx'
import CompactGaugeEcharts from './CompactGaugeEcharts.jsx'
import CompactRadarRecharts from './CompactRadarRecharts.jsx'
import CompactRadarEcharts from './CompactRadarEcharts.jsx'
import CompactScatterRecharts from './CompactScatterRecharts.jsx'
import CompactScatterEcharts from './CompactScatterEcharts.jsx'
import CompactBubbleRecharts from './CompactBubbleRecharts.jsx'
import CompactBubbleEcharts from './CompactBubbleEcharts.jsx'
import CompactTreemapRecharts from './CompactTreemapRecharts.jsx'
import CompactTreemapEcharts from './CompactTreemapEcharts.jsx'
import CompactFunnel from './CompactFunnel.jsx'
import CompactChord from './CompactChord.jsx'
import CompactTable from './CompactTable.jsx'
import CompactTableEcharts from './CompactTableEcharts.jsx'
import CompactColumnRecharts from './CompactColumnRecharts.jsx'
import CompactColumnEcharts from './CompactColumnEcharts.jsx'
import CompactWaterfall from './CompactWaterfall.jsx'
import CompactLollipopSvg from './CompactLollipopSvg.jsx'
import CompactLollipopEcharts, { schema as lollipopSchema } from './CompactLollipopEcharts.jsx'
import CompactBullet from './CompactBullet.jsx'
import CompactProgressBar, { schema as progressSchema } from './CompactProgressBar.jsx'
import CompactHeatmap from './CompactHeatmap.jsx'
import CompactRankedList from './CompactRankedList.jsx'
import CompactStatCard from './CompactStatCard.jsx'
import CompactMetricTile from './CompactMetricTile.jsx'
import CompactGroupedBarRecharts from './CompactGroupedBarRecharts.jsx'
import CompactGroupedBarEcharts from './CompactGroupedBarEcharts.jsx'
import CompactStackedAreaRecharts from './CompactStackedAreaRecharts.jsx'
import CompactStackedAreaEcharts from './CompactStackedAreaEcharts.jsx'
import CompactSparklineKpi from './CompactSparklineKpi.jsx'
import CompactSlopeChartSvg from './CompactSlopeChartSvg.jsx'
import CompactSlopeEcharts, { schema as slopeSchema } from './CompactSlopeEcharts.jsx'
import CompactBumpChartRecharts from './CompactBumpChartRecharts.jsx'
import CompactBumpChartEcharts from './CompactBumpChartEcharts.jsx'
import CompactSunburst from './CompactSunburst.jsx'
import CompactNarrative from './CompactNarrative.jsx'
import CompactWaffle from './CompactWaffle.jsx'
import CompactNavButton from './CompactNavButton.jsx'
import CompactCustom from './CompactCustom.jsx'
import CompactTextBox from './CompactTextBox.jsx'
import CompactShape from './CompactShape.jsx'
import CompactImage from './CompactImage.jsx'
import CompactDivider from './CompactDivider.jsx'
import CompactBarRaceEcharts, { schema as barRaceSchema } from './CompactBarRaceEcharts.jsx'

import { FLAGS } from '../shared/feature-flags.js'
import { schema as barMarksSchema }     from '../../primitives/bar-marks/index'
import { schema as radarMarksSchema }   from '../../primitives/radar-marks/index'
import { schema as gaugeMarksSchema }   from '../../primitives/gauge-marks/index'
import { schema as pointMarksSchema }   from '../../primitives/point-marks/index'
import { schema as treemapMarksSchema } from '../../primitives/treemap-marks/index'
import { schema as pieMarksSchema }     from '../../primitives/pie-marks/index'
import { schema as lineMarksSchema }    from '../../primitives/line-marks/index'

// Phase 6 (2026-04-25, modified scope): every wrapper hardcodes the ECharts
// component. The Recharts variants stay imported so the source files remain
// reachable on disk (re-enable path / safety net), but no runtime path leads
// to them. The feature-flag function and FLAGS export stay too — disabling
// dispatch without deleting plumbing means we can flip back by editing this
// one file if a regression surfaces post-cutover. The original scope (delete
// Recharts entirely) was de-scoped per user request.
function readEchartsFlag(_name) { return true }  // always ECharts; kept for API compat

function CompactRadar(props) { return React.createElement(CompactRadarEcharts, props) }
CompactRadar.schema = radarMarksSchema

function CompactBar(props) { return React.createElement(CompactBarEcharts, props) }
CompactBar.schema = barMarksSchema

// Gauge: hardcoded ECharts since Phase 4.2 — no Recharts fallback (CompactGaugeSvg
// remains as the legacy non-ECharts path; the migration replaced it entirely).
const CompactGauge = FLAGS.useEchartsGauge ? CompactGaugeEcharts : CompactGaugeSvg
CompactGauge.schema = gaugeMarksSchema

function CompactScatter(props) { return React.createElement(CompactScatterEcharts, props) }
CompactScatter.schema = pointMarksSchema

// Phase 4.5: Bubble — same PointMarks primitive + schema as Scatter; defaults
// differ (bigger dotSize/dotSizeMax) for bubble-style display.
function CompactBubble(props) { return React.createElement(CompactBubbleEcharts, props) }
CompactBubble.schema = pointMarksSchema

function CompactTreemap(props) { return React.createElement(CompactTreemapEcharts, props) }
CompactTreemap.schema = treemapMarksSchema

// Donut + Pie. CompactPie wraps CompactDonut via its own wrapper (sets
// innerRadius=0 to render as a pie).
function CompactDonut(props) { return React.createElement(CompactDonutEcharts, props) }
CompactDonut.schema = pieMarksSchema
CompactPie.schema   = pieMarksSchema

// Line + Area — wrapper resolves chartType from config (legacy visual.type='area'
// still triggers area mode).
function CompactLine(props) { return React.createElement(CompactLineEcharts, props) }
CompactLine.schema = lineMarksSchema

function CompactArea(props) {
  return React.createElement(CompactLineEcharts, { ...props, config: { ...props.config, chartType: props.config?.chartType || 'area' } })
}
CompactArea.schema = lineMarksSchema

// StackedArea — wrapper supplies area+stacked defaults.
function CompactStackedArea(props) { return React.createElement(CompactStackedAreaEcharts, props) }
CompactStackedArea.schema = lineMarksSchema

// StackedBar — Inspector exposes "Stack series" toggle and "Secondary color"
// picker via the extended barMarksSchema.
function CompactStackedBar(props) { return React.createElement(CompactStackedBarEcharts, props) }
CompactStackedBar.schema = barMarksSchema

// BumpChart — reuses LineMarks with invertY:true. Real multi-series rank-
// tracking bump chart deferred to Phase 8 per KB-015.
function CompactBumpChart(props) { return React.createElement(CompactBumpChartEcharts, props) }
CompactBumpChart.schema = lineMarksSchema

// GroupedBar — sibling of StackedBar. Wrapper opts out of stacking so two
// series render side-by-side per category.
function CompactGroupedBar(props) { return React.createElement(CompactGroupedBarEcharts, props) }
CompactGroupedBar.schema = barMarksSchema

// Column — vertical bar. Rides BarMarks + barMarksSchema; wrapper supplies
// vertical orientation + top label defaults.
function CompactColumn(props) { return React.createElement(CompactColumnEcharts, props) }
CompactColumn.schema = barMarksSchema

// Slope — dedicated ECharts composition (one line per category, two x-positions).
// CompactSlopeChartSvg kept on disk as the legacy fallback path.
function CompactSlopeChart(props) { return React.createElement(CompactSlopeEcharts, props) }
CompactSlopeChart.schema = slopeSchema

// Lollipop — dedicated ECharts composition (thin bar stem + scatter dot).
// CompactLollipopSvg kept on disk as the legacy fallback path.
function CompactLollipop(props) { return React.createElement(CompactLollipopEcharts, props) }
CompactLollipop.schema = lollipopSchema

// Progress — kept as a DOM/CSS card (not ECharts); schema attached so the
// inspector surfaces its controls.
CompactProgressBar.schema = progressSchema

// Bar race (interaction · playback) — Play/scrub timeline over a time dimension;
// bars re-rank each frame. Owns its ECharts instance for frame-to-frame animation.
function CompactBarRace(props) { return React.createElement(CompactBarRaceEcharts, props) }
CompactBarRace.schema = barRaceSchema

export const VISUAL_MAP = {
  kpi: CompactKpi, bar: CompactBar, stacked_bar: CompactStackedBar,
  line: CompactLine, area: CompactArea,
  donut: CompactDonut, pie: CompactPie, gauge: CompactGauge, radar: CompactRadar,
  scatter: CompactScatter, bubble: CompactBubble, treemap: CompactTreemap,
  funnel: CompactFunnel, sankey: CompactChord,
  table: CompactTableEcharts,
  column: CompactColumn,
  waterfall: CompactWaterfall,
  lollipop: CompactLollipop,
  bullet: CompactBullet,
  progress: CompactProgressBar,
  heatmap: CompactHeatmap,
  ranked_list: CompactRankedList,
  stat_card: CompactStatCard,
  metric_tile: CompactMetricTile,
  grouped_bar: CompactGroupedBar,
  stacked_area: CompactStackedArea,
  sparkline_kpi: CompactSparklineKpi,
  slope: CompactSlopeChart,
  bump: CompactBumpChart,
  chord: CompactChord,
  sunburst: CompactSunburst,
  narrative: CompactNarrative,
  insight: CompactNarrative,
  waffle: CompactWaffle,
  bar_race: CompactBarRace,
  nav_button: CompactNavButton,
  // Canvas objects — non-data authorable elements.
  text_box: CompactTextBox,
  shape: CompactShape,
  image: CompactImage,
  divider: CompactDivider,
  // Playground Spike: one declarative-template component behind every custom
  // visual. Additive — the template rides inside spec.customVisuals, so every
  // render path (canvas, present, standalone export) resolves it identically.
  custom: CompactCustom,
}

// Default fallback used by render paths when visual.type isn't in VISUAL_MAP.
export { CompactKpi as DefaultFallback }
