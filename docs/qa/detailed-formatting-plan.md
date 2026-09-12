# Detailed formatting specification and implementation status

This is the formatting target for all 41 registered visual types. It is not a claim that all controls below exist or have passed testing. The target is driven by Vilsem?s visual semantics, rather than a competitor?s feature list.

## Consistent organization

Keep Data for fields, aggregation, ordering and limits; Style for geometry, fills, borders and effects; Text for typography and label formatting; Layout for position, sizing and responsive behavior. Within each tab, use named sections with common concepts in the same order. Visual-specific sections follow common sections. A setting must have a renderer consumer before it is exposed.

Common targets: title; value and number/date formatting; palette and per-series overrides; axes/ticks/grid where applicable; marks; labels; legend; tooltip; selection emphasis; container spacing and appearance; responsive layout and clipping; accessibility. Advanced controls should be discoverable without overwhelming initial setup. Preserve saved configuration keys and current defaults when reorganizing controls.

## Per-visual target

| Visual types | Detailed target and current expansion |
|---|---|
| bar, column, grouped_bar, stacked_bar | Per-series/category colors; bar width, gap, corners and borders; stack normalization; negative baseline; value/category labels; axes, grids, legend and selection. |
| line, area, stacked_area | Per-series stroke, dash and opacity; interpolation; markers; area fill; null gaps; stacking; endpoint labels; date/number scales and crosshair. |
| scatter, bubble | Size scale and limits; point shape, opacity and outlines; category palette; reference lines; point labels; axis domains and tooltip fields. |
| pie, donut | Inner/outer radius; start angle and direction; slice spacing and borders; label value/percentage/category; leader lines; center content; legend wrapping. |
| gauge | Domain and target; arc geometry; threshold bands; pointer; value typography; ticks and min/max labels. |
| bullet | Scale and target; qualitative ranges; value bar and target marker geometry/colors; value typography. First expansion implemented: nine descriptors. |
| progress | Target; bar geometry; start/end fill and track colors; percentage typography; spacing. Six additional descriptors implemented. |
| metric_tile | Target; ring diameter, stroke, fill/track colors and visibility; percentage typography and visibility; spacing. Ten descriptors implemented. |
| stat_card | Comparison visibility, precision, positive/negative colors and typography; subtitle typography; spacing. Nine descriptors implemented. |
| kpi, sparkline_kpi | Value units and precision; comparison semantics; sparkline geometry/colors; target progress; icon; title and value hierarchy. |
| radar | Domain per axis; polygon/circle grids; series fills and strokes; markers; axis labels and legend. |
| treemap, sunburst | Hierarchy depth; level colors; borders/gaps; parent and leaf labels; fit/ellipsis rules; drill feedback and breadcrumb. |
| funnel | Stage order and widths; spacing; stage palette; inside/outside labels; conversion percentages and connectors. |
| sankey, chord | Node/segment colors and sizes; link color rules, opacity and curvature; label placement; selected/unselected emphasis. |
| table, ranked_list | Column widths/alignment; header/body typography; row density and stripes; borders; number/date formats; conditional colors; totals and overflow. |
| waterfall | Increase/decrease/total colors; subtotal semantics; connectors; bar geometry; label placement; baseline and axes. |
| lollipop | Stem thickness/color; head shape/size; category spacing; labels; axes and grid. |
| heatmap | Sequential/diverging scale; explicit bounds and midpoint; missing-value color; cells, gaps and borders; labels and color legend. |
| slope, bump | Series strokes and markers; start/end/rank labels; collision rules; highlight behavior; rank direction and axes. |
| waffle | Grid dimensions; cell geometry/gap; filled/unfilled colors; rounding semantics; legend and value text. |
| bar_race | Duration and transitions; ranking count; stable category colors; current-period text; bars, labels and axis. |
| narrative, insight | Heading/body/emphasis typography; paragraph spacing; semantic positive/negative styles; wrapping and scroll behavior. |
| nav_button | Text and icon; alignment and padding; shape/border/shadow; hover/focus/disabled states; destination feedback. |
| text_box | Base and selected-text typography; paragraph line height, tracking, padding and case; alignment; links and mixed formatting. Four paragraph descriptors added. |
| shape, image, divider | Object-specific fill/stroke/opacity; image fit/crop and aspect ratio; divider thickness/dash; bounds and accessible description. |
| custom | Schema-declared typed controls with groups/defaults/ranges; no arbitrary code mutation; primitive capability validation and deterministic reset. |

## Acceptance requirements

For every exposed control: validate its default, an explicit value, bounds, reset behavior, editor/viewer rendering, and saved/reopened configuration. Colors need theme and contrast review; text needs long strings, Unicode, mixed formatting and large fonts. Geometry needs tiny, narrow, short and large containers. Validate combinations as well as individual controls. AI parity requires a typed supported operation and a renderer result, not merely acceptance of an arbitrary configuration key.

## Current implementation boundary

The first detailed expansion adds/exposes 38 descriptors across Bullet, Metric Tile, Stat Card, Progress and Text Box. Typography descriptors can declare `tab: 'text'`; the inspector retains one configuration store and renders them after common text sections. Optional Bullet target/domain inputs return to automatic calculation when cleared.

Other families retain their existing controls and the targets above remain planned. The previous audit?s unresolved clipping, interaction and AI validation findings remain open. Individual DOM-change tests establish that controls are active, but do not establish correct appearance for every combination or pixel-perfect cross-visual consistency.

Evidence: `evidence/detailed-formatting.json` records actual inspector edits and remount checks in both rendering hosts. The script is `scripts/qa/detailed-formatting.cjs`; run `node scripts/qa/launch-audit.cjs --detailed` with the UI development server running. Consult that report?s completion, failures and console events before treating any check as verified.

### Latest verification

152/152 control edit/render-change/remount checks passed across both hosts; 165/165 pane checks passed across all 41 visual types. Existing value formatting 98/98 and text-box formatting 24/24 passed. Main UI build passed. Reset, extreme combinations and screenshot approval are still required for full acceptance of the expansion. Full unit suite and export-host builds were not rerun in this expansion.


## Independent axis formatting expansion

The Text tab now contains X-axis labels and Y-axis labels sections. Each provides color, size (6?48), weight (100?900), rotation (?90?90 degrees), and spacing (0?48). Empty numeric inputs mean automatic; empty colors inherit shared axis styling. Explicit zero rotation/spacing are valid. The adapter preserves series, domains, formatter functions and visibility, and does not create axes on non-Cartesian visuals.

The controls apply through the shared ECharts host and Bar Race?s separate update path. The acceptance runner `node scripts/qa/launch-audit.cjs --axis-detail` tests all ten actual inputs across 13 built-in Cartesian types in both hosts, checks ECharts options and unchanged series data, then remounts and clears rotation. Custom visuals retain template-dependent applicability and are not included in that built-in sweep. Large rotated labels still require clipping/overlap review; exposing rotation does not guarantee every layout is readable.

Axis expansion verification:312/312 Electron checks,165/165 settings-pane checks; unit suite456passed/4existing failures; all three renderer builds passed. FORMAT-AXIS-008 reset regression verified. Screenshot reviewed: `evidence/screenshots/axis-detail-pane.png`.


## Axis label readability

Each axis now additionally offers font family, maximum label width (10?500 pixels), overflow (Default / Ellipsis / Wrap words / Wrap characters), and hide overlapping labels. Width and overflow work together; wrapping may need additional chart height. Empty width and Default restore renderer behavior. Overlap suppression can intentionally omit labels without removing categories or marks. Existing defaults are unchanged unless explicitly configured.

Verification:520/520 actual-input/option/data/remount/reset checks across13 types in editor/viewer,165/165 all-visual pane checks. Long Unicode categories show ellipsis in the inspected `evidence/screenshots/axis-readability-chart.png`; review runner4/4 checks includes both wrapping modes and default reset while retaining20 categories/values. Wrap-mode checks verify option mapping and retained data, not all line-layout combinations. Unit suite457pass/4existing failures. Main UI/standalone/Fabric builds pass. Custom-template-specific behavior, full per-control reset coverage, extreme combinations, AI parity and disk persistence remain pending.
