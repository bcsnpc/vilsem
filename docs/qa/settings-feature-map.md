# Settings pane feature map

Every registered visual was mounted and its Data, Style, Text, Layout and AI panes inspected. This maps reachable panels; it is not approval of every renderer feature or property combination.

Common organization: Data for bindings, Style for appearance and visual-specific features, Text for typography and rich text, Layout for placement/animation, AI for assisted editing. Existing config keys are unchanged.

| Visual | Style panels | Text panels |
|---|---|---|
| kpi | Colors & container, Features | Title, Value |
| bar | Category colours, Colors & container, Chart Features, Tooltip, Appearance, Lines | Title, Axis & Labels, X-axis labels, Y-axis labels |
| stacked_bar | Colors & container, Chart Features, Tooltip, Appearance | Title, Axis & Labels, X-axis labels, Y-axis labels, Legend |
| line | Colors & container, Chart Features, Tooltip, Shape, Colors, Markers, Axes, Reference | Title, Axis & Labels, X-axis labels, Y-axis labels |
| area | Colors & container, Chart Features, Tooltip, Shape, Colors, Markers, Axes, Reference | Title, Axis & Labels, X-axis labels, Y-axis labels |
| donut | Category colours, Colors & container, Chart Features, Tooltip, Shape | Title, Legend, Labels |
| pie | Category colours, Colors & container, Chart Features, Tooltip, Shape | Title, Legend, Labels |
| gauge | Colors & container, Scale, Appearance, Labels | Title, Value |
| radar | Colors & container, Chart Features, Tooltip, Appearance | Title, Labels |
| scatter | Colors & container, Chart Features, Tooltip, Appearance, Axes | Title, Axis & Labels, X-axis labels, Y-axis labels, Labels |
| bubble | Colors & container, Chart Features, Tooltip, Appearance, Axes | Title, Axis & Labels, X-axis labels, Y-axis labels, Labels |
| treemap | Category colours, Colors & container, Chart Features, Tooltip, Appearance | Title, Labels |
| funnel | Colors & container, Chart Features, Tooltip | Title |
| sankey | Colors & container, Chart Features, Tooltip | Title |
| table | Colors & container, Table Options, Chart Features, Tooltip | Title |
| column | Category colours, Colors & container, Chart Features, Tooltip, Appearance, Lines | Title, Axis & Labels, X-axis labels, Y-axis labels |
| waterfall | Colors & container, Chart Features, Tooltip | Title |
| lollipop | Category colours, Colors & container, Chart Features, Tooltip, Appearance | Title, Axis & Labels, X-axis labels, Y-axis labels |
| bullet | Colors & container, Scale & target, Value bar, Target marker, Track | Title, Value |
| progress | Colors & container, Fill, Track, Spacing, Scale, Appearance, Labels | Title, Value, Percentage |
| heatmap | Colors & container, Chart Features, Tooltip | Title |
| ranked_list | Colors & container, Chart Features, Tooltip | Title |
| stat_card | Colors & container, Comparison, Spacing | Title, Value, Comparison text, Subtitle |
| metric_tile | Colors & container, Scale, Ring, Spacing | Title, Value, Percentage |
| grouped_bar | Colors & container, Chart Features, Tooltip, Appearance | Title, Axis & Labels, X-axis labels, Y-axis labels, Legend |
| stacked_area | Colors & container, Chart Features, Tooltip, Shape, Colors, Markers, Axes, Reference | Title, Axis & Labels, X-axis labels, Y-axis labels |
| sparkline_kpi | Colors & container, Features | Title, Value |
| slope | Colors & container, Chart Features, Tooltip, Labels, Appearance | Title, Axis & Labels, X-axis labels, Y-axis labels, Labels |
| bump | Colors & container, Chart Features, Tooltip, Shape, Colors, Markers, Axes, Reference | Title, Axis & Labels, X-axis labels, Y-axis labels |
| chord | Colors & container, Chart Features, Tooltip | Title |
| sunburst | Colors & container, Chart Features, Tooltip | Title |
| narrative | Colors & container, Chart Features, Tooltip | Title |
| insight | Colors & container, Chart Features, Tooltip | Title |
| waffle | Colors & container, Chart Features, Tooltip | Title |
| bar_race | Category colours, Colors & container, Tooltip, Race, Appearance, Labels | Title, Axis & Labels, X-axis labels, Y-axis labels |
| nav_button | Button, Style | Title |
| text_box | Text box | Text formatting, Paragraph, Text, Title |
| shape | Shape | Title |
| image | Image | Title |
| divider | Divider | Title |
| custom | Section colours, Chart options, Colors & container, Chart Features, Tooltip, Custom visual | Title, Axis & Labels, X-axis labels, Y-axis labels |

## Verified changes

- Relevant Cartesian text controls are shared across the supported renderers; custom templates retain axis controls because their axes are template-dependent.
- Unsupported generic grid/data-label/gradient controls are excluded by explicit capability sets; visual-specific schema controls remain available.
- Gauge and Progress expose their registered scale, geometry and label controls; common Value font-size controls are not duplicated in their schema sections.
- Text-box base and selected-text formatting live under Text, with a navigation button from Style.
- KPI-only features are limited to KPI and Sparkline KPI. Header paint controls with no runtime consumer are removed from the pane, without deleting saved fields.
- Title layout controls are shown only for internal KPI layouts; chart title and value size/weight placeholders match their existing rendering defaults.

## Remaining gaps

Feature-by-feature functional acceptance remains tracked in visual-inventory.md, control-acceptance-matrix.csv and the bug log. Fixed-on Sparkline KPI trend/sparkline behavior still needs clearer controls. Some visuals (including Bullet) have renderer-specific config without complete registered schemas; this pass does not invent those settings. Tooltip and animation applicability, conditional schema branches, all custom templates and style combinations need further review. The older control CSV is historical discovery and must be reconciled with this pane map rather than assumed current.

Tests: settings-pane-audit.cjs checks all41 types, panel applicability and unchanged specs during tab navigation. settings-schema-regressions.cjs exercises nine newly reachable Gauge/Progress settings in both hosts, including state and rendering checks. Existing rich-text50 and text-box24 assertions pass using the Text tab.

Final verification:165/165 pane assertions across41 types,22/22 schema-control assertions,98/98 value formatting assertions,50/50 rich-text and24/24 text-box checks,10/10 authoring workflows. Unit suite455passed/4existing failures; main UI build passed (34.27s, existing toolchain/chunk warnings). Text-tab screenshot visually inspected; additional pane screenshots saved in evidence/screenshots/*-settings-*.png. Initial root-directory build used the wrong config and was not counted; subsequent builds ran from ui. Source whitespace and QA script syntax checks passed. Full per-feature acceptance remains open as detailed above.


Latest map regenerated from settings-pane-audit.json after SETTINGS-002. Treemap/Radar/Pie/Donut typography moved to Text; legend extras share the common Legend section. The shared Appearance section is now Colors & container; visual-specific Appearance sections remain separate (SETTINGS-003).

SETTINGS-004/005: schema label visibility/content now accompany typography in Text; Pie center styling is hidden because its renderer disables center text. Donut center controls remain available.
