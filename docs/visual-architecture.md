# Visual construction and shared primitives

Initial source/runtime audit, 2026-09-07. See [inventory](visual-inventory.md) for each ID's component, primitive call chain, schema keys and renderer key references.

## Common host contract

Visual type → App Spec record → host layout and data query → normalized rows plus runtime chartConfig → registry component → renderer-specific primitives/markup → card/page surface.

Titles and card chrome are often owned by CanvasEditor/AppSpecRenderer, while KPI-family titles live inside leaf components. Both hosts build config/context and own loading/error/selection state independently. `VisualBoundary` isolates React render failures; it cannot make effect/event failures or invalid data semantically correct.

## Primitive-based ECharts family

| Layer | Implementation | Behavior |
|---|---|---|
| Fragment contract | primitives/contract.ts | option fragments plus optional scale/legend contributions |
| Composition | primitives/composer.ts | Deep merge options; concatenate series; combine scale extents and legend data |
| Plot/grid | cartesian-frame | ECharts grid options, margins and containment configuration |
| Category axis | categorical-axis | Category ticks/text and orientation |
| Numeric axis | linear-axis | Value axis/domain/ticks |
| Marks | bar-marks, line-marks, point-marks, pie-marks, radar-marks, gauge-marks, treemap-marks | ECharts series and mark-specific labels/styles; some also build tooltips/axes |
| Legend | legend or leaf DOM | Not universally composed through one primitive |
| Tooltip | tooltip primitive, inline primitive options, applyTooltipConfig | Common enabled/trigger overrides; multiple content/position implementations |
| Surface | shared/EChartsCanvas.jsx | CanvasRenderer registered; resize observer; option updates; click forwarding; disposal |

Bar composes frame/category axis/linear axis/BarMarks/Tooltip/Legend. Its expand-in-place route bypasses the ordinary composition through expandBarOption. Column supplies vertical defaults. Grouped and stacked bars have their own assembly. Line/area/stacked-area/bump share LineMarks through line wrappers. Scatter/bubble share PointMarks. Donut/pie share PieMarks, although pie retains a legacy localStorage branch. Gauge, radar and treemap have dedicated marks primitives. Lollipop and slope compose dedicated options; bar race has its own ECharts instance/playback loop.

EChartsCanvas uses replaceMerge for series/xAxis/yAxis/tooltip, preserves other merged component state and uses notMerge for universalTransition. Turning options off then on needs tests for stale merged state. `dimensions` passed into primitives can be zero-valued placeholders; many layout decisions remain ECharts-percentage-based, not explicit measured typography.

## DOM, SVG and remaining Recharts paths

Table is a scrollable HTML table with local sort/column resize state. Funnel is DOM bars; waterfall is absolutely positioned DOM cumulative bars. Heatmap is a CSS grid. Chord/sankey use SVG arcs, not flow ribbons/links. Waffle is a fixed cell grid. KPI/cards/progress/bullet/narrative mix DOM and small SVG marks. Sunburst actively imports Recharts and renders a donut approximation. Text/image/shape/divider/navigation are bare objects. Custom templates instantiate ECharts options from JSON slots and params.

This is not one universal visual primitive system. Some equivalent concepts are shared, some duplicated and some only superficially similar. A marks schema does not describe all host chrome, every manual inspector control, or every runtime callback.

## Boundaries and clipping

There is no universal SVG root or common clipPath across all visuals. ECharts grid/series containment, fixed SVG viewBoxes, DOM overflow, host card overflow and page bounds are separate mechanisms. The shared tooltip primitive sets confine:true; that alone cannot guarantee readable tooltips in a tiny card. Native title and Recharts tooltips behave differently.

The initial harness deliberately renders leaves in bounded but unclipped boxes to locate overflow candidates. This must be followed by the actual CanvasEditor and viewer hosts, where clipping may hide content instead of allowing escape. Snapshot scroll dimensions cannot detect canvas marks clipped inside ECharts, text contrast or overlap.

Expected policy for subsequent fixes: marks remain inside their plot except explicitly designed reference annotations; titles truncate/wrap deliberately with recoverable full text; legends scroll/wrap without consuming the plot completely; tooltips stay readable in the viewport; tiny sizes provide an intentional compact/empty state or minimum-size constraint. Do not hide all overflow to suppress symptoms.
