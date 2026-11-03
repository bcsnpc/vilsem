# Shared DOM renderers in Power BI

Waffle is the first candidate for sharing an existing React visual with the Power BI package. Its renderer depends on React, theme tokens, palettes, formatting, and deterministic cell allocation. It does not query data or implement mark selection. The Power BI adapter supplies categorical rows and the saved configuration; it must not introduce a second Waffle implementation.

The bridge bundles React and the component at build time as an ES module. Power BI owns the card/title and data mapping. Each bridge mount owns one React root and must unmount before the host clears its container, switches rendering modes, or destroys the visual. Existing ECharts and table paths remain independent.

Acceptance before exposing export: build from source; render single/multiple/empty/zero/negative data; verify colors and cell formatting; verify compact scrolling; update and dispose repeatedly; validate the packaged visual in hosted Power BI and local report output. Until those checks pass, the export registry remains unchanged. App Waffle has no mark selection or cross-filtering; this pilot does not claim those interactions.

## Acceptance update
Waffle export is enabled following native adapter tests, actual Service standard/one/empty data, actual Desktop rendering, and Vilsem local creation/save/reopen/export. The package bundles the bridge under generated/ (not authored src/), so the packaging tool does not lint third-party React internals as application code. The prepackage hook always rebuilds it from UI source. `npm run qa:native -- powerbi-waffle` needs this build first. No React runtime download or dynamic evaluation is used by the product.

## Bullet / Progress pilot
Both use DOM/CSS with no queries or mark-selection handlers. Bullet reads primary value plus optional second-measure target (config target overrides it); Progress reads primary value and configured maxValue. Formatting schemas are attached to the same components. Power BI will supply rows/theme through the existing bridge; public exports remain gated until acceptance. Both current layouts center fixed content in height:100% and need compact-boundary testing before release.

### Bullet / Progress acceptance
Export enabled after 44 native compact/format/data checks, actual Service filtering, Desktop rendering, and Vilsem UI creation/save/reopen/PBIP export. No mark selection was added. Layout wraps long text and scrolls vertically while preserving track height; math and target precedence are unchanged. Further typography/control states remain in the audit backlog.


Stat Card and Metric Tile now also use this bridge. Power BI owns the outer title, components receive title/label cleared. They consume scalar _val (and _val2 for Stat Card comparison); they make no additional data requests. Native, Service and local save/export acceptance is recorded in regression-status.md.


The bridge now also includes Funnel, Waterfall, Heatmap, Ranked List, Chord/Sankey, Sunburst, Narrative/Insight. Recharts and DOMPurify are bundled locally where required. The adapter root carries data-powerbi-dom-visual for deterministic readiness detection. New renderer Service acceptance is in service-33-visuals.json; existing semantic limitations are retained and documented.
