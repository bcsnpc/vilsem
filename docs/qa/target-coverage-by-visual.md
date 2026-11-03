## Latest: Shape / Divider without data bindings

**35 types supported, six still gated** (KPI, Sparkline KPI, navigation button, text box, image, custom).

- Full unit suite: **766 PASS / 0 FAIL**. This does not close alternate-axis export/host acceptance; its remaining requirements are outside the implemented bound-selection contract.
- Native adapter: **137 PASS**, including 11 shape variants and six divider orientation/style cases without data.
- Service: **35 visuals / six pages**, standard/one/empty states exercised; no-data Shape/Divider visibly rendered. `service-35-visuals.json`, `service-static-objects.png`.
- Actual local Vilsem create/save/reopen/PBIR export: **10 PASS**, **8 Microsoft schemas PASS**, zero data projections for Shape/Divider. `local-static-objects-ui.json`.
- Original PBIP: **157/157 hashes unchanged**. Package build PASS; existing development certificate/tooling warnings remain.
- First Service upload failed ECONNRESET; preserved in service-static-first-upload-failure.json. Retry completed. New Desktop opening, full legacy generated-measure publish parity and newest Fabric deployment remain unverified.

Earlier sections are historical.

## Latest coverage: 33 Power BI types, eight still gated

Nine additional types now reuse the actual app renderer in Power BI: Funnel, Waterfall, Heatmap, Ranked List, Chord, Sankey, Sunburst, Narrative and Insight.

- 120 native adapter checks PASS (including 72 new data/theme cases).
- 70 export-guide/package tests PASS; package build PASS.
- Service gallery: 33 visuals / six pages, standard/single-category/empty-filter runs completed. New pages visually reviewed. Evidence: `service-33-visuals.json`, `service-page5.png`, `service-page6.png`.
- Existing semantics remain: Sankey uses the app Chord component; Sunburst uses one ring. These are export parity additions, not semantic redesigns or exhaustive interaction/property approval.
- New Desktop/Fabric acceptance is not claimed. Eight types remain gated: KPI, Sparkline KPI, navigation button, text box, shape, image, divider, custom. Concrete dependencies: `docs/engineering/powerbi-remaining-renderers.md`.

Earlier counts below are historical.

## Latest export coverage cycle: Stat Card and Metric Tile

Power BI support is now **24 supported / 17 rejected types**. Both added types use the actual app components inside the Power BI bundle.

- Native adapter: **48 checks PASS**, including 12 new scalar-card dark/light, zero/null/value, formatting and title cases.
- Export guide/package/scalar tests: **71 PASS**. Release-format custom visual package build PASS; existing certificate/tooling warnings remain.
- Service: **24 visuals / four pages**, standard/single-category/empty filters exercised; both new cards render real model values. Evidence: `service-scalar-cards-gallery.json`, `service-scalar-cards.png` (visually reviewed).
- Local Vilsem: **10 UI/IPC/save/reopen/export checks PASS**, **8 PBIR schema checks PASS**. Stat Card and Metric Tile created through the library and preserved in the new local report. Evidence: `local-scalar-cards-ui.json`.
- Source PBIP: **157/157 original hashes unchanged**. New Desktop-file opening and hosted Fabric verification for these latest changes remain pending; do not infer them from Service or schema validation.
- Neither scalar card has mark-selection behavior in the app; none is claimed for Power BI. Extreme-size/every-property acceptance remains separate.

Earlier sections below retain their historical scope and counts.

## Scalar card follow-up
Stat Card and Metric Tile: 24 native editor/viewer checks pass for error/standard/zero rendering and single-title ownership. Stat Card additionally passes two native missing-current checks without fabricated comparison. Nine component tests cover error, empty rows, zero and missing values. These are app checks; Power BI export support remains disabled for both types.

## Shared DOM card coverage update ? 2026-09-12

Power BI supported type count is now **22**, with **19** remaining rejected types. Waffle uses the actual app React component in the package: 30 native checks pass; Service standard/one/empty filters and Desktop default rendering verified. Local Vilsem creation/save/reopen/PBIP export passed. Waffle has no mark selection in the app or Power BI. Bullet and Progress also passed native compact/format checks, Service standard/one/empty data, Desktop default rendering, and local creation/save/export. Other rows below retain their historical scope.

# Per-visual target coverage ? 2026-09-11

This is a coverage record, not release certification. ?Loaded? means the actual hosted visual mounted and data settled; placeholder semantics, readability and interaction acceptance are separate. Settings screening does not prove every formatting control changes the intended pixels.

| Visual | App data / pane | Compiled web | Hosted Fabric | Service gallery | Local Desktop | Remaining focus |
|---|---|---|---|---|---|---|
| kpi | Screened | Smoke pass | Loaded | Not tested in legacy/static export | Unsupported, export rejects | All formatting states, edge-size review and target interactions |
| bar | Screened | Smoke pass | Loaded; select / Ctrl-add / remove / clear passed | Standard / one / empty exercised; native select/clear passed | Default rendered | App drill modes tested; live Fabric bar selection/multi-select passed; remaining target drill/axis coverage |
| stacked_bar | Screened | Smoke pass | Loaded | Standard / one / empty exercised; native select/clear passed | Default rendered | App drill modes and Service select/clear tested; remaining target drill/axis/multi-select coverage |
| line | Screened | Smoke pass | Loaded | Standard / one / empty exercised; native select/clear passed | Default rendered | All formatting states, edge-size review and target interactions |
| area | Screened | Smoke pass | Loaded | Standard / one / empty exercised; native select/clear passed | Default rendered | All formatting states, edge-size review and target interactions |
| donut | Screened | Smoke pass | Loaded | Standard / one / empty exercised; native select/clear passed | Default rendered | Single-category and circle-bound fixes verified; large labels/legend text and remaining interactions pending |
| pie | Screened | Smoke pass | Loaded; select / Ctrl-add / remove / clear passed | Standard / one / empty exercised; native select/clear passed | Default rendered | Single-category and circle-bound fixes verified; large labels/legend text and remaining interactions pending |
| gauge | Screened | Smoke pass | Loaded | Standard / one / empty exercised | Default rendered | All formatting states, edge-size review and target interactions |
| radar | Screened | Smoke pass | Loaded; select / clear passed | Standard / one / empty exercised; native select/clear passed | Default rendered | All formatting states, edge-size review and target interactions |
| scatter | Screened | Smoke pass | Loaded; select / clear passed | Standard / one / empty exercised; native select/clear passed | Default rendered | All formatting states, edge-size review and target interactions |
| bubble | Screened | Smoke pass | Loaded; select / clear passed | Standard / one / empty exercised; native select/clear passed | Default rendered | All formatting states, edge-size review and target interactions |
| treemap | Screened | Smoke pass | Loaded | Standard / one / empty exercised; native select/clear passed | Default rendered; native Accessories selection passed | All formatting states, edge-size review and target interactions |
| funnel | Screened | Smoke pass | Loaded | Not tested in legacy/static export | Unsupported, export rejects | All formatting states, edge-size review and target interactions |
| sankey | Screened | Smoke pass | Loaded | Not tested in legacy/static export | Unsupported, export rejects | Semantic limitations/placeholders: loaded output is not full visual acceptance |
| table | Screened | Smoke pass | Loaded | Standard / one / empty exercised | Default rendered | Power BI header sorting/reset and keyboard resize verified in Service (EXPORT-TABLE-037); Desktop retest and full formatting acceptance pending |
| column | Screened | Smoke pass | Loaded | Standard / one / empty exercised; native select/clear passed | Default rendered | App drill modes and Service select/clear tested; remaining target drill/axis/multi-select coverage |
| waterfall | Screened | Smoke pass | Loaded | Not tested in legacy/static export | Unsupported, export rejects | All formatting states, edge-size review and target interactions |
| lollipop | Screened | Smoke pass | Loaded; select / clear passed | Standard / one / empty exercised; native select/clear passed | Default rendered | All formatting states, edge-size review and target interactions |
| bullet | Compact/format checks; local UI creation/save/export pass | Rebuilt smoke pass | Loaded; latest deployed bundle verified | Standard / one / empty verified with shared React renderer | Default rendered on dark page | Exhaustive settings acceptance remains; no mark selection implemented |
| progress | Compact/format checks; local UI creation/save/export pass | Rebuilt smoke pass | Loaded; latest deployed bundle verified | Standard / one / empty verified with shared React renderer | Default rendered on dark page | Exhaustive settings acceptance remains; no mark selection implemented |
| heatmap | Screened | Smoke pass | Loaded | Not tested in legacy/static export | Unsupported, export rejects | All formatting states, edge-size review and target interactions |
| ranked_list | Screened | Smoke pass | Loaded | Not tested in legacy/static export | Unsupported, export rejects | All formatting states, edge-size review and target interactions |
| stat_card | Screened | Smoke pass | Loaded | Not tested in legacy/static export | Unsupported, export rejects | All formatting states, edge-size review and target interactions |
| metric_tile | Screened | Smoke pass | Loaded | Not tested in legacy/static export | Unsupported, export rejects | All formatting states, edge-size review and target interactions |
| grouped_bar | Screened | Smoke pass | Loaded | Standard / one / empty exercised; native select/clear passed | Default rendered | App drill modes and Service select/clear tested; remaining target drill/axis/multi-select coverage |
| stacked_area | Screened | Smoke pass | Loaded | Standard / one / empty exercised; native select/clear passed | Default rendered | All formatting states, edge-size review and target interactions |
| sparkline_kpi | Screened | Smoke pass | Loaded | Not tested in legacy/static export | Unsupported, export rejects | All formatting states, edge-size review and target interactions |
| slope | Screened | Smoke pass | Loaded; select / clear passed | Standard / one / empty exercised; native select/clear passed | Default rendered | All formatting states, edge-size review and target interactions |
| bump | Screened | Smoke pass | Loaded | Standard / one / empty exercised; native select/clear passed | Default rendered | Semantic limitations/placeholders: loaded output is not full visual acceptance |
| chord | Screened | Smoke pass | Loaded | Not tested in legacy/static export | Unsupported, export rejects | Semantic limitations/placeholders: loaded output is not full visual acceptance |
| sunburst | Screened | Smoke pass | Loaded | Not tested in legacy/static export | Unsupported, export rejects | Semantic limitations/placeholders: loaded output is not full visual acceptance |
| narrative | Screened | Smoke pass | Loaded | Not tested in legacy/static export | Unsupported, export rejects | All formatting states, edge-size review and target interactions |
| insight | Screened | Smoke pass | Loaded | Not tested in legacy/static export | Unsupported, export rejects | All formatting states, edge-size review and target interactions |
| waffle | 30 data/layout checks; local UI creation/save/export pass | Rebuilt smoke pass | Loaded; current deployed bundle verified | Standard / one / empty verified with shared React renderer | Default rendered on dark page | Exhaustive formatting states remain; no mark selection implemented |
| bar_race | Screened | Smoke pass | Loaded | Standard / one / empty exercised | Default rendered | All formatting states, edge-size review and target interactions |
| nav_button | Screened | Smoke pass | Loaded | Not tested in legacy/static export | Unsupported, export rejects | Hosted destination navigation passed; modal/link/invalid-target states remain |
| text_box | Screened | Smoke pass | Loaded | Not tested in legacy/static export | Unsupported, export rejects | All formatting states, edge-size review and target interactions |
| shape | Screened | Smoke pass | Loaded | Not tested in legacy/static export | Unsupported, export rejects | All formatting states, edge-size review and target interactions |
| image | Screened | Smoke pass | Loaded | Not tested in legacy/static export | Unsupported, export rejects | All formatting states, edge-size review and target interactions |
| divider | Screened | Smoke pass | Loaded | Not tested in legacy/static export | Unsupported, export rejects | All formatting states, edge-size review and target interactions |
| custom | Screened | Smoke pass | Loaded | Not tested in legacy/static export | Unsupported, export rejects | All formatting states, edge-size review and target interactions |

Evidence: [Fabric portal](evidence/fabric-portal-audit.json), [Service gallery](evidence/cloud-gallery.json), [local report](evidence/local-all-visuals-report.json), [compiled artifacts](evidence/artifact-round.json), [app interactions](evidence/interaction-audit-after.json), [bar drill modes](evidence/grouped-drill.json).

Existing-report insertion is a separate path: currently static HTML with visual-family substitutions (EXPORT-INJECT-030). Binary preservation and fail-before-write fixes have regression tests; full live insertion and native-slicer compatibility remain outstanding.

Local export currently supports 19 primitive types and rejects the other 22, slicers and saved drill/filter configurations. This is a material feature gap against the requested all-target parity, not a tested success.

Native Service summary: [16 category selection/clear checks](evidence/service-native-summary.json). This does not cover every multi-selection, drill, playback, or formatting state.

Hosted point interaction evidence: [8 native selection/clear checks](evidence/fabric-point-interactions.json). Latest rebuilt web/Fabric smoke suite: 82 passed.

## Custom-package export boundary follow-up

All 41 registry types were exercised through the actual inspector export action with file-writing IPC intercepted. The 19 supported primitive/package types preserve their authored type; 22 unsupported types return an explicit message without invoking Save. `src/powerbi/primitiveVisualTypes.json` is shared by the UI and desktop writer. Existing-package unsupported specs now produce a diagnostic instead of a silent bar-chart substitution. See EXPORT-TYPE-064 and `evidence/export-type-audit.json`.

This guard does not implement the missing renderers. Service live-DAX rendering, local report export and baked custom packages remain distinct paths requiring their own coverage.
