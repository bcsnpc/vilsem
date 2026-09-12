# Vilsem audit bug log

Current repair status: [verified fixes and remaining work](fix-status.md). Reproduction descriptions below preserve before-fix behavior.

Audit started 2026-09-07. Verified fixes are recorded per issue and in fix-status.md. **Open** means unresolved, even when the defect was reproduced. Synthetic leaf-renderer checks do not establish end-to-end host behavior.

Full-audit continuation: [additional reproduced findings](full-audit-findings.md), including **PERSIST-001 (P0 project overwrite)**, **DATA-EDITOR-001**, AI slicer/patch defects and the resolved default-packaging precedence.

Further production-function regressions: [schema, filtering and layout findings](schema-filter-findings.md). Interpret all counts using [coverage limitations](audit-coverage-limitations.md).

Visually reviewed findings: [clipping defects](clipping-review.md) and [visual semantics/label defects](visual-review-findings.md), covering Heatmap, Sunburst, Stacked Area, Column, Waterfall, Narrative and Insight.

Further all-visual findings and fixes: [error propagation, Bar Race and Gauge](continuation-findings.md).

## VIS-LINE-001 — Hook order changes when data becomes empty

- **Status:** VERIFIED (local scope).
- **Fix and verification:** Run hooks before state returns. Line-family transitions pass in both hosts. See [fix status](fix-status.md).

- **Area / Category / Severity:** Line, Area, Stacked Area, Bump / Rendering / High (P1).
- **Description:** Data-dependent early returns precede a `useMemo` in the shared line renderer.
- **Steps:** Run the Vite server, then `node scripts/qa/launch-audit.cjs --renderers`. Transition mounted charts from standard rows to `[]`, then restore rows.
- **Input:** Four synthetic categories with two measures, followed by an empty result.
- **Expected:** Empty state, then successful recovery, without React errors.
- **Actual:** Chromium logs “Rendered fewer hooks than expected” for `CompactLineEcharts` and its wrappers. Error boundaries can reset fast enough to hide this from a later DOM snapshot.
- **Evidence:** `evidence/renderer-smoke.json`, `events`; `ui/src/appspec/visuals/CompactLineEcharts.jsx:18` early returns and `:25` useMemo.
- **Suspected root cause:** Conditional hook execution. All hooks must execute on every render.
- **Regression test:** Renderer transition harness captures console errors and fails its exit status. Add a focused assertion for loading/error/empty/populated transitions before fixing.

## VIS-FUNNEL-001 — Empty results display invented data

- **Status:** VERIFIED (local scope).
- **Fix and verification:** Replace demo fallback with empty/error state. Host zero/empty/error/recovery tests pass. See [fix status](fix-status.md).

- **Area / Category / Severity:** Funnel / Data / High (P1).
- **Description:** Empty rows fall back to demonstration stages; the `error` prop is ignored.
- **Steps:** Render Funnel with `rows=[]`, `loading=false`; repeat with a query error.
- **Input:** Empty result; error variant still needs runtime testing.
- **Expected:** Explicit no-data or query-error state. No invented business values.
- **Actual:** Stage 1=100, Stage 2=65, Stage 3=40 appear for empty data.
- **Evidence:** `evidence/renderer-smoke.json` empty/funnel; `CompactFunnel.jsx:27` fallback.
- **Suspected root cause:** Prototype demo fallback in the production renderer.
- **Regression test:** Add explicit empty/error text assertions to renderer fixture checks.

## SPEC-CUSTOM-001 — Registered custom visuals fail validation

- **Status:** VERIFIED (local scope).
- **Fix and verification:** Accept custom type and validate actual template. Production schema regression passes. See [fix status](fix-status.md).

- **Area / Category / Severity:** Custom visual / Spec, AI / High (P1).
- **Description:** `VISUAL_MAP.custom` exists but `VISUAL_TYPES` omits `custom`.
- **Steps:** Validate an otherwise valid App Spec containing a `custom` visual.
- **Input:** Synthetic custom visual with id, position, measures, config.
- **Expected:** Validate the custom template reference and supported bindings consistently with the renderer.
- **Actual:** Validator reports invalid visual type. AI refinement invokes this validator before accepting a result.
- **Evidence:** `evidence/renderer-smoke.json` contracts.customValidation; `schema.js:3`; `visuals/index.js` registry; `AppGenerator.jsx` refineSpec.
- **Suspected root cause:** Registry and validator are separate lists.
- **Regression test:** Cross-check registered types and validation using valid per-type fixtures, including custom definitions.

## VIS-TABLE-001 — Dimension-only table is removed by layout normalization

- **Status:** VERIFIED (local scope).
- **Fix and verification:** Preserve/query/render dimension-only tables without phantom measure. DAX and mounted host tests pass; live Fabric untested. See [fix status](fix-status.md).

- **Area / Category / Severity:** Table / Data, Layout / High (P1).
- **Steps:** Validate a table with dimensions and `measures: []`; run `normalizeLayout` with freeform unset.
- **Input:** QA[Category] dimension-only table.
- **Expected:** Preserve the valid dimension-only table.
- **Actual:** Validation succeeds; normalized visuals array is empty.
- **Evidence:** `evidence/renderer-smoke.json` contracts.dimensionOnlyTableValidation and dimensionOnlyTableAfterNormalize.
- **Suspected root cause:** `shared/layout.js` charts filter requires a nonempty measures array or a bare object.
- **Regression test:** Add dimension-only-table layout preservation assertion and view-mode host test.

## BUILD-001 — Conflicting release configurations include a secret-file risk

- **Area / Category / Severity:** Packaging / Architecture / High; P0 investigation gate before packaging.
- **Steps:** Compare `electron-builder.yml` with `package.json.build`; determine effective builder configuration before generating an installer.
- **Input:** Existing build files only; `.env` contents were not read.
- **Expected:** One effective release configuration, Vilsem branding, consistent destinations, credentials excluded.
- **Actual:** YAML names Semantica, outputs to dist/app and explicitly lists `.env`; package.json names Vilsem, outputs to release and excludes `.env`.
- **Evidence:** Both build files. No installer was created or examined.
- **Suspected root cause:** Legacy configuration left alongside newer package configuration.
- **Status:** Investigating; source conflict confirmed; effective packaging behavior unverified.
- **Fix:** None.
- **Regression test:** Inspect effective configuration and packaged file manifest without shipping any credentials.

## QA-BASELINE-001 — Existing suite is red

- **Area / Category / Severity:** Regression suite / Testing / Medium (P2; investigate before changing contracts).
- **Steps:** `npm.cmd test -- --reporter=json --outputFile=docs/qa/baseline-tests.json --silent`.
- **Input:** Repository baseline; installed dependencies.
- **Expected:** Passing tests aligned to agreed runtime behavior.
- **Actual:** 428 passed, 4 failed, 432 total; 25 passing files, 3 failing files. Two AppSpecToPowerBI layout expectations (304 vs >400; 108 vs 20), one axis-switcher source assertion (`data-axis-table`), one measure-name regex (hash suffix contains underscore).
- **Evidence:** `baseline-tests.json`; tests/appSpecToPowerBI.test.js:55, :89; tests/axisSwitcherParity.test.js:83; tests/tmdlInjector.test.js:62.
- **Suspected root cause:** Mix of stale source contracts and possibly changed output behavior. Not classified as four product regressions yet.
- **Status:** Investigating.
- **Fix:** None; assertions not weakened.
- **Regression test:** Existing four cases; review expectations against current publish paths.

## VIS-BOUNDS-001 — Leaf renderers report content beyond their allocated size

- **Area / Category / Severity:** Multiple visuals / Clipping / Medium, pending host reproduction (P1 investigation).
- **Steps:** Run renderer audit at 80×60, 160×600 and 800×100; inspect overflowCandidate and related screenshots.
- **Input:** Synthetic standard, long, empty, mixed and null rows.
- **Expected:** Marks respect plot bounds; labels have a deliberate readable truncation/scroll policy; tooltips remain usable.
- **Actual:** Several DOM/SVG renderers have scroll dimensions larger than their allocated box, including heatmap, funnel, waterfall, chord, waffle and card families.
- **Evidence:** `evidence/renderer-smoke.json` case dimensions and overflowCandidate. These are geometric candidates, not proof of visible escape through host clipping.
- **Suspected root cause:** Fixed labels, aspect ratios and font sizes competing with narrow/short containers; mixed per-renderer layout logic.
- **Status:** Investigating. Needs host-level screenshot and hit-testing evidence per visual.
- **Fix:** None. Blanket overflow hiding is not an accepted fix.
- **Regression test:** Promote each confirmed host defect into a named screenshot/geometry case.


## FORMAT-TITLE-002 ? Chart title typography differs between hosts

- Area/category: shared chart headers / visual consistency
- Severity: Medium
- Status: Verified (editor/freeform viewer shared headers)
- Reproduce: create a titled bar; set titleFontFamily, titleFontSize, titleFontWeight, titleColor and titleUppercase; compare editor and freeform viewer.
- Input: synthetic QA category/Revenue data, title "Revenue by category".
- Expected: explicit typography is honored consistently; unset settings retain existing defaults; data and interactions are unaffected.
- Actual/source evidence: AppSpecRenderer freeform header hardcodes 12px/600/theme color; other headers ignore weight and uppercase.
- Root cause: four independently constructed title styles in CanvasEditor and AppSpecRenderer.
- Regression: scripts/qa/title-consistency.cjs; evidence/title-consistency.json ? 240 applicable assertions passed plus 2 internal-title exclusions, zero console errors. All 41 types mounted in both hosts.
- Fix: shared chartTitleStyle applied in all four host header branches; existing defaults retained. Separate section/grid mounting and renderer-owned typography remain untested by this check.


## TEXT-FORMAT-001 ? Selected size becomes 48px after italic
- Area/category: Text box / Formatting; severity High (P1).
- Status: Verified in local Electron.
- Steps: double-click text box, select all text, apply italic, choose 24px.
- Input: `<p>QA text <b>bold</b></p>`; native Electron rich-text command bridge.
- Expected: selected text becomes 24px while italic and bold are retained.
- Actual: browser emits CSS `font-size: xxx-large`, computed 48px; saved HTML retains incorrect size.
- Evidence: evidence/text-format-audit.json; scripts/qa/text-format-audit.cjs.
- Root cause: applyTextCmd enables styleWithCSS; applyTextFontSize only converts legacy font[size="7"] elements.
- Fix: Reset Chromium CSS mode for font-size conversion, then restore it; 24 text-format assertions pass including mixed formatting and reopening. Evidence: evidence/text-format-after.json. Regression: size after italic and committed HTML assertions now pass.

## TEXT-CLIP-001 ? Long text inaccessible outside box
- Area/category: Text box / Clipping; severity High (P1).
- Status: Verified in local Electron.
- Steps: create 240?160 text box, paste 50 repetitions of a long Unicode paragraph; leave default centered alignment.
- Expected: content stays inside box; overflow is accessible by scrolling without losing text or saved formatting.
- Actual: 1702px content is centered in 108px inner container, spanning y=-743 to959 while container spans54 to162. No scrollbar; host clips most text.
- Evidence: evidence/text-format-audit.json, editor/viewer geometry assertions.
- Root cause: unconstrained flex child height and overflow:visible outside editing.
- Fix: Bound text to available height and provide scrolling in view and edit modes; long paragraph accessibility passes in both hosts. Evidence: evidence/text-format-after.json. Regression: long-text accessibility assertions now pass.


## FORMAT-CARD-003 ? Viewer drops internal card captions and target context
- Area/category: Bullet, progress, stat card, metric tile, sparkline KPI / Host parity; severity Medium (P2).
- Status: Confirmed by standard screenshots and source; regression pending.
- Steps: create each type with a title and Revenue/Cost measures; compare editor to viewer.
- Expected: semantically useful information, including bullet target value, remains available in both hosts; avoid duplicate decorative titles through a deliberate shared policy.
- Actual: editor shows internal captions; viewer removes them. Bullet loses its target caption `(target: 150)` entirely.
- Evidence: evidence/visibility-contact-editor-3.png versus visibility-contact-viewer-3.png.
- Root cause: AppSpecRenderer clears title/label in all chartConfig branches; CanvasEditor retains them. CompactBullet conditions the target caption on title/label.
- Fix: pending; do not blindly restore duplicate titles across all charts. Regression: add host-parity assertions for meaningful secondary text.

## VIS-POINT-002 ? Boundary point visibility needs large-symbol validation
- Area/category: Scatter, bubble / Marks at extrema; severity Medium (P2).
- Status: Investigating, not yet confirmed as clipping.
- Steps: standard Revenue/Cost/Units fixture with maximum point at x=100,y=60; increase dot-size settings and enable labels; test 240?160 and480?320.
- Expected: boundary marks and labels remain accessible without crossing card bounds.
- Observation: standard screenshots place the final point on the upper/right plot edge. A circle at a plot edge is not alone proof of clipping; verify ZRender symbol bounds and clip paths at maximum sizes.
- Evidence: visibility-contact-editor-2.png / viewer-2.png; PointMarks grid top8/right16 and unpadded value domains.
- Fix: none pending reproducible failure; regression pending.


## NAV-LABEL-001 ? Viewer replaces configured button text
- Area/category: Navigation button / Rendering and host parity; severity High (P1).
- Status: Verified in local Electron.
- Steps/input: create nav_button with label "Go to detail" and targetPageId "page2"; switch editor to viewer.
- Expected: button retains configured label and navigates to page2.
- Actual: editor shows "Go to detail"; viewer shows "Button".
- Evidence: evidence/visibility-contact-editor-4.png and visibility-contact-viewer-4.png; CompactNavButton defaults undefined label to Button.
- Root cause: AppSpecRenderer chartConfig overwrites label with undefined despite nav_button consuming it as actual button content.
- Fix: Preserve nav_button label in all three viewer chartConfig branches; 3/3 label/navigation assertions pass in evidence/nav-label-after.json. Default freeform screenshots refreshed. Regression: label plus navigation assertions in both hosts; preserve chart-header deduplication.


## TEXT-FONT-002 ? Font family containing a number is ignored
- Area/category: Text box / Formatting; severity Medium (P2).
- Status: Verified in local Electron.
- Steps: edit/select text, choose Fraunces then Source Serif 4 in inspector font menu.
- Expected: selected CSS family becomes Source Serif 4.
- Actual: remains Fraunces. All other font choices in this probe apply.
- Evidence: evidence/text-controls.json, selection fontFamily Source Serif 4.
- Root cause: execCommand fontName receives an unquoted family with a numeric token, which Chromium rejects as CSS font-family.
- Fix: Quote the font family passed to Chromium; every offered font now applies. See evidence/text-controls-after.json. Regression: actual dropdown iteration across every offered font.

## TEXT-TOKEN-002 ? Newly inserted live value is unresolved during editing
- Area/category: Text box / Data editing; severity Medium (P2).
- Status: Verified in local Electron.
- Steps: edit/select text, use inspector Insert value ? Revenue, wait for queries/render settling.
- Input: deterministic Revenue scalar250.
- Expected: chip shows250 immediately and remains atomic; saved measure identity is Revenue.
- Actual: chip remains Revenue while editing.
- Evidence: evidence/text-controls.json; last assertion.
- Root cause: query dependencies derive from saved config.html, which is not updated until edit commit; inserted DOM token never triggers new measure extraction.
- Fix: Refresh measure extraction from editable DOM on input without replacing the DOM/caret; inserted values resolve while editing and after reopening. See evidence/text-controls-after.json. Regression: native contentEditable input and token text after settled query.


## FORMAT-AXIS-004 ? Axis typography saves but does not render
- Area/category: Cartesian ECharts visuals / Formatting; severity High (P1).
- Status: Verified for the tested local scenarios.
- Steps: bind QA Category/Revenue; Text ? Axis & Labels; set Axis Color #d946ef, Axis Size18 and Axis Font Sora; compare actual chart axis labels in editor/viewer.
- Expected: both visible axes consume explicit color/size/family, while unset defaults and numeric/category formatting remain unchanged.
- Actual: saved config changes but renderer axes retain original color/size and no explicit font family.
- Evidence: evidence/format-semantics-before.json; scripts/qa/format-semantics.cjs.
- Root cause: inspector writes axisTickColor/axisFontSize/axisFontFamily; renderers construct axisLabel objects without forwarding those fields. Bar race owns another independent setOption path.
- Fix: Shared immutable applyAxisTextConfig, forwarded through EChartsCanvas and the separate bar-race path. 188 applicable axis/legend apply/reset assertions pass;126 absent-element cases excluded. Regression: all41 types mounted in both hosts; targeted visible-axis and legend assertions; absent axes require applicability review, not a PASS.


## FORMAT-LEGEND-005 ? Editor legend formatting stays stale
- Area/category: Grouped and stacked bar / Formatting; severity High (P1).
- Status: Verified for the tested local scenarios.
- Steps: Text ? Legend, change Text Color or Text Size; compare editor and viewer with Revenue/Cost series.
- Expected: current legend reflects saved settings immediately in both hosts.
- Actual: viewer updates; editor retains default color and11px size.
- Evidence: format-semantics-before.json and first after run; four matching editor failures.
- Root cause: legend config fields are consumed inside useMemo but omitted from dependencies. Viewer rerenders incidentally mask stale options.
- Fix: Include all consumed legend settings in grouped/stacked bar memo dependencies. Color/size/reset and all positions/show-hide now pass in editor and viewer. Regression: actual inspector ? state ? legend options in both hosts, including reset and toggle.

## FORMAT-VALUE-006 ? Value cards ignore text color and weight
- Area/category: Bullet, progress, stat card, metric tile, gauge / Formatting; severity High (P1).
- Status: Verified for the tested local scenarios.
- Steps: Text ? Value, set valueColor #d946ef and valueFontWeight500; retain Revenue scalar250.
- Expected: displayed value uses requested color/weight; explicit size and prefix/suffix remain intact.
- Actual: size applies, but value retains palette color and hardcoded weight.
- Evidence: value-format-semantics.json; direct computed value text styles.
- Root cause: CompactBullet, CompactProgressBar, CompactStatCard and CompactMetricTile omit valueColor/valueFontWeight.
- Fix: Honor explicit valueColor/valueFontWeight/valueFontFamily in the four DOM cards and gauge primitive/adapter, retaining unset defaults. 98 value-format assertions pass across seven types and both hosts. Regression: both-host value typography and standard/zero/negative prefix/suffix assertions.


## FORMAT-LEGEND-007 ? Pie/Donut Top position renders on right
- Area/category: Pie and Donut / Legend; severity Medium (P2).
- Status: Verified for the tested local scenarios.
- Steps: Text ? Legend ? Position ? Top, after testing Bottom and Right.
- Expected: horizontal legend at top; data and center text preserved.
- Actual: vertical legend at right; primitive only distinguishes bottom from right, despite UI offering top.
- Evidence: legend-control-semantics.json (corrected oracle allows renderer-specific edge padding; four Top failures remain).
- Root cause: PieMarks position union/schema/branch omit top.
- Fix: Add top to PieMarks types/schema/layout; top legend is horizontal and centered. All40 legend position/visibility checks pass; donut top screenshot inspected. Slice data preservation is unit tested. Regression: actual UI every position plus show/hide in both hosts.


## SETTINGS-001 ? Pane applicability and hidden schema controls
- Area: All visual settings / UX and functionality. Severity High (P1).
- Status: Verified for the tested pane changes.
- Reproduce: inspect Gauge/Progress Style (missing own schema settings); inspect Pie/Table/Text box Text (irrelevant Cartesian controls); compare text formatting locations.
- Expected: stable Data/Style/Text/Layout organization, relevant panels, every registered schema setting reachable without duplicate common controls.
- Actual: broad !isKpi checks expose dead controls; isKpi suppresses Gauge/Progress schemas; text-box rich/base formatting lives in Style.
- Root cause: VisualInspector uses broad type categories in place of per-feature applicability.
- Fix: shared settingsCapabilities rules, schema access for value cards, text formatting under Text, supported title-layout controls and accurate typography defaults. Saved config remains untouched. Evidence: settings-pane-audit.json and settings-schema-regressions.json; see settings-feature-map.md for remaining gaps. Regression: all41 panes, moved rich text controls, exposed gauge/progress controls, unchanged saved specs during browsing.


## FORMAT-AXIS-008 ? Bar Race retains cleared axis override
- Visual / Area: Bar Race / independent axis formatting.
- Category: Formatting / State. Severity: Medium. Priority: P2.
- Description: clearing a rotation override does not restore the default.
- Steps: create Bar Race using synthetic QA data; Text > X-axis labels > rotation = 30; clear the numeric input. Reproduces in editor and viewer.
- Input/Data: standard QA race fixture; xAxisLabelRotation becomes null.
- Expected: effective rotation returns to the original 0 degrees.
- Actual: ECharts retains 30 degrees.
- Evidence: initial axis-detail-regressions sweep, 310/312 checks passing; both clear-rotation checks failed (before 0, after 30).
- Root cause: CompactBarRaceEcharts calls setOption with default merge, retaining omitted axisLabel properties.
- Status: Verified. Final sweep:312/312 passing; both clear-rotation checks restore 0 degrees.
- Fix: replace axis components during option updates while keeping the series merge for race transitions.
- Regression: scripts/qa/axis-detail-regressions.cjs, both hosts, clear rotation.


## VIS-BULLET-009 ? Target/zero-domain geometry escapes track
- Area: Bullet. Category: Edge clipping / Data. Severity: Medium. Priority: P2.
- Reproduce: standard QA data; set maxValue500,targetValue500,targetWidth10. Then negative fixture with targetValue?100,maxValue500; then zero fixture with maxValue0,targetValue0. Both editor and viewer.
- Expected: finite bar geometry within the nonnegative track; marker remains wholly visible at either endpoint; signed numeric value remains visible. Invalid/nonpositive maximum falls back to a positive automatic domain.
- Actual: upper marker extends10px beyond track; negative marker starts56px before track; zero-domain marker/bar CSS positions are invalid/empty.
- Evidence: evidence/bullet-bounds-before.json, six failing cases.
- Root cause: division by zero and upper-only percentage clamping; marker width not included in endpoint positioning.
- Status: Verified. Six endpoint/domain cases pass in both hosts;2 unit tests pass; detailed formatting152/152 and value formatting98/98 pass.
- Fix: finite positive domain, bounded ratios, marker position capped by its width.
- Regression: scripts/qa/bullet-bounds.cjs.


## INTERACTION-MULTI-001 ? Ctrl-click replaces category selection
- Area: Bar-family viewer cross-filtering. Category: Interaction. Severity: Medium. Priority: P2.
- Steps: create Bar and KPI sharing QA data; click North; Ctrl-click South.
- Expected: sibling query receives both categories, both selected marks retain emphasis; Ctrl-click toggles membership; ordinary click replaces selection. Drill behavior retains priority.
- Actual: sibling receives South only. Wrapper discards native event modifiers and host always stores a scalar; BarMarks compares a single category.
- Evidence: evidence/interaction-multi-before.json native input regression failure.
- Status: Verified for Bar, Column, Grouped Bar and Stacked Bar in viewer. Native interaction suite16/16; selection membership/removal/clear/plain replacement and emphasis verified. Other visual families and Mac-native modifier input remain unverified.
- Fix: explicit modifier metadata, deterministic scalar/array filter transition, bar selection membership.
- Regression: scripts/qa/interaction-audit.cjs plus shared transition/mark unit tests.


## AI-PATCH-001 / AI-PATCH-002 ? Measure removal and sequential patch validation
- Area: AI spec editing. Category: Functionality / Architecture. Severity: Medium. Priority: P2.
- Reproduction: remove /visuals/0/data/measures/0; separately add config/categoryColors={} then config/categoryColors/North="#123456" in one batch.
- Expected: removal needs no replacement value; each accepted operation updates the state used to validate later operations. Unknown measures remain rejected.
- Actual before fix: removal rejected due to undefined value; child rejected because parent missing in original spec.
- Root cause: value validation applied to remove; validator never advanced its working document.
- Fix: skip value references for remove, clone input operations, apply accepted operations to an isolated working spec, reject primitive parents.
- Evidence: evidence/contract-patch-before.json and evidence/contract-audit-after.json; final tests assert accepted operations and resulting category color, immutable inputs, removed/scalar-parent rejection.
- Status: Verified through production patch/sanitizer pipeline in isolated Electron, without live provider calls. AI-CONFIG-001 invalid type/unknown key checks remain failing.
- Regression: scripts/qa/contract-audit.cjs.


## QA-BASELINE-002 ? Obsolete export layout and measure naming assertions
- Area: Regression tests. Category: Test contract drift. Severity: Low.
- Reproduce: baseline appSpecToPowerBI section-layout/missing-layout tests and tmdlInjector alphanumeric-only naming test.
- Expected: published positions preserve authored grid coordinates; generated measure names remain stable and distinct for IDs with matching truncated prefixes.
- Actual tests: demand automatic full-width KPI reflow and omit the deliberate hash-separator underscore.
- Evidence/root cause: AppSpecToPowerBI mapSinglePage gridToPx; tmdlMeasureInjector measureNameForVisual full-ID hash. Existing tests already require other authored layout behavior and retained measures on republish.
- Fix: replace obsolete assertions with exact pixel coordinates/spans and stable/noncolliding identifier assertions. No product layout/naming behavior changed.
- Status: Verified; final full suite465passed/1remaining unrelated failure.
- Regression: tests/appSpecToPowerBI.test.js, tests/tmdlInjector.test.js.

## EXPORT-AXIS-010 ? Secondary-axis Power BI HTML selection does not cross-filter
- Area: Power BI HTML renderer. Category: Interaction / Export parity. Severity: Medium. Priority: P2.
- Steps: export a multi-axis Bar; switch to a secondary axis; click a category alongside another visual.
- Expected: sibling filters target the selected secondary dimension without breaking native slicer routing.
- Actual: source implements section-local dim only. Prior filter approach was reverted because it broke routing. Runtime Power BI service scenario not tested here.
- Evidence: pbiviz-semantica-renderer/src/visual.ts renderHtmlWithSelection, secondary-axis branch; existing axisSwitcherParity test remains failing.
- Status: Open, source-confirmed capability gap; needs Power BI runtime verification.
- Fix: Pending compatible multi-role binding/filter contract; do not restore reverted filter calls blindly.
- Regression: retain failing tests/axisSwitcherParity.test.js expectation until behavior is implemented; add native Power BI integration coverage.


## SETTINGS-002 ? Split typography and duplicate legend controls
- Area: Formatting pane; Treemap, Radar, Pie/Donut. Category: UX / Consistency. Severity: Medium. Priority: P2.
- Reproduce: inspect Style and Text for these visuals. Treemap tile text styles, Radar label size, Pie/Donut center typography appear under Style; Pie/Donut legend visibility and position appear in both tabs.
- Expected: typography under Text; one authoritative legend section with available visual-specific controls.
- Actual: inconsistent discovery and duplicated editing controls for the same saved keys.
- Root cause: primitive schemas lack inspector tab placement and repeat controls provided by the common Text panel.
- Status: Verified for the reproduced placement/duplication issues.42/42 focused checks in both hosts;165/165 all-visual pane checks;40/40 legend and98/98 value-format regressions.
- Fix: explicit inspector placement helper, common-field deduplication and inline legend extras. Saved keys/defaults/renderers unchanged.
- Regression: pane sweep and typography placement/renderer assertions.


## SETTINGS-005 ? Pie exposes invisible center typography
- Area: Pie formatting. Category: UX / Applicability. Severity: Medium.
- Reproduce: Pie > Text > center size/color; edit either control.
- Expected: expose center styling only for a renderer that displays center text.
- Actual: options update but no visible result; CompactPie forces innerRadius0 and showCenterTextfalse.
- Root cause: applicability hides center visibility but not its font/color fields. Earlier option-only tests missed the invisible output.
- Fix: hide center size/color for Pie, preserve saved values and Donut controls.
- Status: Verified. Regression: schema-placement-regressions.cjs asserts absence for Pie and live Donut center control behavior; final focused suite68/68.


## WEB-DATA-011 ? Dimension-only tables rejected by web query route
- Area: Web/preview server. Category: Data / Export parity. Severity: High.
- Reproduce: POST /query-table with groupBy [QA[Category],QA[Product]] and measures []. Desktop supports this binding.
- Expected: distinct dimension rows sorted by the requested dimension direction, no fabricated measure.
- Actual: HTTP400 measures required. Existing DAX builder would also emit [undefined] if validation were bypassed.
- Evidence: tests/web-dimension-table.test.js initially1failure/2pass using production route with isolated query transport.
- Root cause: desktop dimension-only support had not been applied to src/routes/preview.js.
- Status: Verified via production route regression3/3 and desktop related regression4/4.


## PLAYGROUND-012 ? Calendar preview crashes before required bindings
- Area: Visual Playground. Category: Rendering / Empty state. Severity: High.
- Reproduce: load Calendar Heatmap starter before binding a date field and measure; switch to KPI Delta. ECharts reports CalendarView._getEdgesPoints reading undefined.slice.
- Expected: clear binding/empty state until required fields and rows are available; switching templates must discard incompatible coordinate systems.
- Actual: empty date range is sent to Calendar; prior calendar components can persist across template switches.
- Evidence: playground-round.json captured error stack; initial attribution to KPI Delta corrected by stack inspection.
- Fix: guard unbound/no-row previews; key chart lifecycle to template ID.
- Status: Verified: final Playground round30/30 includes14 bound starter transitions; no captured renderer errors. Empty-date preview guard also covers bound fields before dated rows arrive.


## UX-CANVAS-013 ? Grid background shorthand conflict
- Area: Authoring canvas. Category: CSS / Consistency. Severity: Low.
- Reproduce: open existing app then create/select visuals in product-audit; React warns Updating background backgroundSize.
- Expected: theme fill and grid properties update independently without resetting one another.
- Actual: background shorthand conflicts with explicit image/size properties on the canvas.
- Fix: use backgroundColor for solid canvas fills where backgroundImage/backgroundSize are explicit.
- Status: Verified: product audit10/10, no captured console warnings; Present7/7, no captured console warnings.


## UX-PLAYGROUND-014 - Narrow layout and save feedback
- Area: Visual Playground. Category: UX / Recovery. Severity: Medium.
- Reproduce: resize Playground below 1000px; save with a slow, failing or absent library callback.
- Input: valid starter template and synthetic save transport.
- Expected: panels remain reachable and readable; one save in flight; failures permit retry; absent persistence never reports success.
- Actual: fixed three-column layout squeezes panels; repeated saves allowed; optional callback can report false success.
- Root cause: VisualPlayground.jsx fixed grid and unguarded optional save callback.
- Status: Verified for scoped scenarios: all14 starter transitions, save in-flight/failure/retry/missing-handler and viewport pane bounds at640/900/1500px;37/37 runtime checks, zero captured console errors. Extreme short heights and full keyboard accessibility remain untested.
- Fix: responsive single-column scroll below1000px, minimum pane sizes, wrapping toolbars, synchronous save guard, disabled busy/unavailable save action and live status feedback.
- Regression: scripts/qa/playground-round.cjs (extended runtime scenarios).


## EXPORT-LOCAL-015 - Existing Power BI mapping drops canvas objects
- Area: Power BI export. Category: Feature parity / Data loss. Severity: High.
- Reproduce: author a report with text_box, shape, image, divider or nav_button and pass it through appSpecToPowerBIPages.
- Input: any positioned canvas object alongside a measure visual.
- Expected: preserve every report element or provide an explicit unsupported-element result before export.
- Actual: mapSinglePage skips navigation and OBJECT_TYPES; additional binding filter excludes zero-measure visuals.
- Evidence/root cause: ui/src/pages/AppSpecToPowerBI.js lines106-109 and234 (static trace).
- Status: Open. Not verified in a newly generated local Desktop report; local exporter is not implemented.
- Fix: pending enhanced PBIR mapping and compatibility reporting; do not silently reuse this mapper for all-visual local export.
- Regression: pending per-type local report generation and Desktop acceptance.


## UX-SHELL-016 - Home discovery and shared dialog keyboard behavior
- Area: Home/shared Modal. Category: UX / Accessibility. Severity: Medium.
- Reproduce: search existing projects for a missing title; inspect a multi-page project count; open a shared modal and navigate with Tab or Escape with nested modals.
- Expected: distinguish no matches from no saved projects; count page visuals; accessible dialog name, contained focus, only top dialog closes and opener regains focus.
- Actual: generic no-projects message, root-only visual count, no labelledby or focus handling; each modal installs an Escape handler.
- Evidence/root cause: Home.jsx and ui/Modal.jsx static inspection. Canvas baseline10/10 passed before changes.
- Status: Verified for scoped Home/dialog scenarios via scripts/qa/shell-ux.cjs11/11. Native keyboard injection did not reach the QA window; DOM keyboard handlers verified, native-keyboard acceptance remains pending.
- Fix: correct search empty state and clear action, page-aware counts, accessible project open/delete buttons preserving row clicks, labelled dialogs with focus wrap/restore and top-modal Escape, scrollable dialog body and nonshrinking wrapping footer.
- Regression: shell-ux.json; short-viewport screenshot shell-ux-modal.png inspected. Authoring10/10, Present7/7, visual Playground37/37, query Playground3/3, settings237/237, interactions16/16 passed.


## UX-HOME-017 - Project storage errors hidden
- Area: Home. Category: Persistence / Recovery. Severity: Medium.
- Reproduce: make getAppSpecs or deleteAppSpec reject; load Home or delete a project.
- Expected: distinguish storage failure from empty library, preserve visible projects, expose retry and identify destructive target.
- Actual: catch blocks hide both errors; delete has no recovery feedback.
- Evidence: Home.loadProjects and handleDelete static trace.
- Status: Verified via shell-ux.cjs16/16, including storage-load failure/retry and delete cancel/failure/retry.
- Fix: separate retryable load error; named deletion dialog, busy guard, visible retryable failure, remove only the successful target from current list.
- Regression: docs/qa/evidence/shell-ux.json; synthetic storage callbacks, not a new disk-persistence certification.


## VIS-FLOW-018 - Sankey and Chord use a donut-like renderer
- Area: Sankey/Chord. Category: Visual semantics. Severity: High.
- Reproduce: create either visual with QA Category and Revenue25/50/75/100; render in viewer.
- Expected: corresponding flow/ribbon representation with supported source/target roles, or clearly disclosed unsupported capability.
- Actual: both display the same circular category-total diagram and legend; no source-target flow links.
- Evidence: screenshots/sankey-viewer-standard-visibility-broad-round.png and chord-viewer-standard-visibility-broad-round.png freshly inspected.
- Root cause: visuals/index.js maps both IDs to CompactChord.jsx. Existing placeholder concern reconfirmed; no semantic rewrite attempted during test-only round.
- Status: Open. Related overview: visual-review-findings.md / visual-architecture.md.
- Fix/regression: pending supported flow data contract, layout and per-visual acceptance; loading smoke must not certify semantics.


## EXPORT-LOCAL-016 - Local report offers unsupported output targets
- **Visual / Area:** Report output chooser and inspector
- **Category:** UX / Export
- **Severity:** High
- **Description:** A report connected to a local PBIP model offered cloud publication and web/Fabric export flows that require a published model. Ordinary Save was easily confused with Power BI file output.
- **Steps to reproduce:** Create a local PBIP report, add and bind a Bar visual, then open Export / Publish.
- **Input/Data:** AdventureWorks local QA copy; Quantity Sold by CategoryName.
- **Expected result:** Local report offers only Power BI file output; availability is truthful, and Vilsem project Save is distinguished from file creation.
- **Actual result before change:** Cloud/web targets were shown regardless of source identity.
- **Evidence:** evidence/local-report-ui.json (six passing checks); tests/output-policy.test.js; evidence/output-policy-source-integrity.json.
- **Root cause:** AppGenerator output chooser tested bridge capabilities/flags without checking report source.
- **Status:** Verified (local chooser restriction only).
- **Fix:** Source-aware chooser/dialog guards and inspector export visibility. Explicit unavailable file-output explanation until the generator is implemented.
- **Regression test:** scripts/qa/local-report-ui.cjs; tests/output-policy.test.js.
- **Remaining scope:** File generator is not delivered; backend-wide restrictions and loaded Fabric chooser checks remain pending.


## EXPORT-LOCAL-017 - Generated enhanced report custom visual renders blank
- **Visual / Area:** New local PBIP/PBIR export prototype, Bar
- **Category:** Export / Rendering
- **Severity:** High
- **Description:** Enhanced report loads its model and existing field bindings but the bundled private renderer shows no bars.
- **Steps to reproduce:** Run `node scripts/qa/generate-local-probe.cjs`, validate with `python scripts/qa/validate-local-pbir.py`, open the generated Report.pbip path from evidence/local-generated-report.json in Power BI Desktop.
- **Input/Data:** Saved Vilsem QA report, Quantity Sold by Product Categories Lookup.CategoryName; isolated copy of supplied AdventureWorks model.
- **Expected result:** Three bars reflecting 57,809 Accessories, 13,929 Bikes and 12,436 Clothing, with the Vilsem formatting.
- **Actual result:** Model and report load; visual container and both field bindings are present; chart is blank.
- **Evidence:** evidence/local-pbir-desktop-fresh.png; evidence/local-pbir-schema-validation.json; evidence/local-generated-report.json.
- **Suspected root cause:** Private custom visual resource loading or runtime/data-view binding. QA bundle selection also selected older 4.9 package; numeric version sorting corrected, pending another Desktop run. Root cause is not established.
- **Status:** Investigating
- **Fix:** Not verified. Public UI export remains unavailable.
- **Regression test:** tests/local-report-builder.test.js covers definitions and rejection of dropped content; Desktop rendering regression is still needed.


### EXPORT-LOCAL-017 verification update - 2026-09-07
- **Status:** Verified for the generated Bar report's blank-rendering failure. Broader export delivery remains pending.
- **Root cause identified:** Enhanced PBIR resource item used `resources/<guid>.pbiviz.json`. Desktop's own serializer and the working Service publisher use just `<guid>.pbiviz.json` for the item path; package contents remain under CustomVisuals/<guid>/resources/.
- **Fix:** Corrected resource registration path without rewriting renderer or changing the Service publisher. Added regression assertion using realistic nested bundle paths.
- **Verification:** Fresh separate report opened in Desktop with bundled 4.12.0.0; three bars with expected rounded values 57.8k/13.9k/12.4k; dark page and dark chart. Evidence: local-pbir-resource-fix.png, local-generated-report.json; 31 focused unit tests and six schema checks pass.
- **Remaining:** Save/reopen, interaction, light theme, other visuals, and integrated product Save as Power BI workflow.


## EXPORT-LOCAL-018 - Column upper value label appears clipped
- **Visual / Area:** Column in full-page local Power BI QA gallery
- **Category:** Rendering / Edge clipping
- **Severity:** Medium
- **Description:** The largest column reaches the plot's upper edge and its value label appears clipped.
- **Steps to reproduce:** Generate `node scripts/qa/generate-local-probe.cjs --full-page`; open recorded PBIP; inspect top-middle Column at readable zoom.
- **Input/Data:** Quantity Sold by CategoryName; maximum Accessories 57,809.
- **Expected result:** Value label remains readable with adequate domain/layout headroom.
- **Actual result:** Upper label appears cut at the top boundary; smaller values are visible.
- **Evidence:** evidence/local-pbir-full-page.png; generated spec evidence/local-full-page-spec.json.
- **Suspected root cause:** Column domain/label headroom in the packaged primitive renderer; requires isolated larger-zoom confirmation.
- **Status:** Investigating
- **Fix:** Pending
- **Regression test:** Pending; existing bounds test verifies containers only.


### EXPORT-LOCAL-018 update (2026-09-11)
- Reproduced the layout defect in tests/power-bi-bar-layout.test.ts: default Column top labels received only 4px of plot clearance.
- Source fix: pbiviz-semantica-renderer/src/compositions.ts applies 28px top clearance to all vertical bar variants with top labels, using the existing grouped-bar allowance. Domain unchanged.
- Regression: 4/4 layout checks passed; 32 related builder/writer tests passed.
- Status: Investigating / source fix tested. Packaged-renderer rebuild and Desktop screenshot verification still required before Verified.


### EXPORT-LOCAL-018 - Desktop verification (2026-09-11)
**Status:** Verified for the tested local Desktop Column scenario. Rebuilt the custom visual; regenerated nine-visual report; visually confirmed maximum label readability; saved, closed and reopened successfully. Evidence: cycle-1-desktop.png, cycle-1-reopened.png. Other targets remain unverified.

## VIS-STACK-019 - Signed stacked bars clipped by incorrect domains
- **Visual / Area:** Stacked bars; grouped bars when stacking enabled; app and Power BI composition
- **Category:** Rendering / Data / Clipping
- **Severity:** High
- **Description:** Domain used individual minima and algebraic totals, omitting negative stack extent or cancelling opposite signs.
- **Steps:** Render two measures [-8,-5] in one category, then [8,-5].
- **Input/Data:** Synthetic regression pairs; Desktop QA measures negative Quantity Sold and negative half Quantity Sold in an isolated model copy.
- **Expected:** Negative endpoint -13 for first pair; positive extent at least 8 for second.
- **Actual before fix:** Min -8; max 3 respectively.
- **Root cause:** Duplicated range calculation did not follow separate positive/negative stacking.
- **Fix:** Shared barValueDomain function used by app grouped/stacked and Power BI compositions.
- **Regression:** tests/power-bi-bar-layout.test.ts; tests/bar-render-runtime.test.ts.
- **Status:** Verified by ECharts runtime geometry and local Desktop signed-stack scenario. Fresh app interaction and cloud targets remain unverified.
- **Evidence:** cycle-2-signed-stacks.png; 58 focused tests pass.

## EXPORT-FABRIC-020 - Deployment continues after required setup fails
- **Area / Category / Severity:** Fabric app / Export correctness / High (P1).
- **Description:** Build, renderer injection, connection add/generation and dependency installation failures do not prevent `rayfin up` or a success result.
- **Reproduce / Input:** Run the deployment with a failing renderer build, missing bundle, failed semantic-model connection command, or failed npm install. Deterministic child-process failure fixtures reproduce each path without publishing.
- **Expected:** Stop at the failed stage, return a useful error, preserve the generated project for retry; never publish a fallback starter app as the user's report.
- **Actual:** Five failure scenarios return ok:true after invoking deployment.
- **Root cause:** electron/fabric/runRayfin.js logs errors and continues.
- **Evidence / Regression:** tests/fabric-deploy-failures.test.js: initial run five failures, successful path passes.
- **Status:** Verified for pipeline failure handling through seven automated tests and successful isolated live redeployment. Individual app features are tracked separately.
- **Fix / Regression:** Required build/injection/model/dependency failures now stop deployment; tests/fabric-deploy-failures.test.js.

## EXPORT-LABEL-021 - Stacked and slope labels overlap in live Service
- **Area / Category / Severity:** Power BI stacked bar and slope / Rendering / Medium (P2).
- **Reproduce / Input:** Open isolated Service QA gallery with Quantity Sold / Quantity Returned by CategoryName; examine stacked bar end labels and slope end labels.
- **Expected:** Readable labels with overlap suppression or placement appropriate to each segment; values remain available through tooltips.
- **Actual:** Adjacent small stack labels overlap; slope endpoints cluster and text crosses adjacent labels.
- **Evidence:** service-page1.png and service-page3.png, live Test_Adventure data.
- **Root cause:** Label collision handling in shared marks/compositions needs tracing.
- **Status:** Verified for the reproduced stacked/slope overlap at the QA gallery size.
- **Fix / Regression:** Shared LabelLayout registration and hideOverlap on bar/slope series; tests/bar-render-runtime.test.ts. Settled live Service screenshots service-page1.png and service-page3.png; refreshed hosted Fabric stacked-bar capture fabric-live-visuals-1-6.png. Initial partial slope line was animation capture, not a renderer defect; harness now checks stable pixels. Extreme-size coverage remains separate.

## EXPORT-RACE-022 - Missing playback field creates undefined category in Power BI
- **Area / Category / Severity:** Local/Service primitive bar race / Field validation / Medium (P2).
- **Reproduce / Input:** Export bar_race with CategoryName groupBy and Quantity Sold but no playAxis/frameBy.
- **Expected:** Ask for a playback field or reject incomplete export; never render undefined as a category.
- **Actual:** Power BI shows a timeline of categories and a bar labelled undefined.
- **Evidence:** Initial live Service page4 capture; generator fixture corrected separately to include Calendar Lookup[Year].
- **Root cause:** localReportBuilder accepts one category role; visual.ts assumes two categories.
- **Status:** Verified through export validation tests; valid two-role race renders in live Service.
- **Fix / Regression:** Reject missing playback/category pair in localReportBuilder; tests/local-report-builder.test.js. service-page4.png.

## EXPORT-SERVICE-023 - Updating generated report fails without .platform metadata
- **Area / Category / Severity:** Existing Power BI report updates / Export / High (P1).
- **Reproduce:** Create QA gallery from generated PBIR parts, then update its definition through the production updateReportDefinition function.
- **Input:** Valid report definition parts without .platform.
- **Expected:** Update report content while preserving its existing name and metadata.
- **Actual:** HTTP 400 InvalidInput: UpdateMetadata is true but .platform file was not provided.
- **Evidence:** Live request 2974bb2f-601e-4bac-8ffa-bf2a82e8ac84; cloud-gallery.json failure record.
- **Root cause:** electron/ipc/powerbi.js unconditionally sets updateMetadata=true.
- **Reference:** https://learn.microsoft.com/en-us/rest/api/fabric/report/items/update-report-definition
- **Status:** Verified by two request regression tests and successful live update of the isolated QA report.
- **Fix / Regression:** Only request metadata updates when .platform is present; tests/power-bi-update.test.js. Original failure retained in service-update-failure.json.

## EXPORT-EMPTY-024 - Empty query results shown as renderer errors
- **Area / Category / Severity:** Power BI primitive visuals / Empty state UX / Medium (P2).
- **Reproduce:** Apply CategoryName filter __Vilsem_QA_empty__ to the live Service QA gallery.
- **Expected:** Neutral no-data state with guidance to change filters; actual composition exceptions remain errors.
- **Actual:** Red 'Semantica renderer error (...): No data to display' despite a successful query with no rows.
- **Evidence:** cloud-gallery.json per-page empty states and service-page*-empty.png.
- **Root cause:** visual.ts routes ordinary empty compositions and race frames through renderError.
- **Status:** Verified for ordinary empty compositions and empty race frames in live Service.
- **Fix / Regression:** Neutral status styling/message, preserving error styling for exceptions. service-page1-empty.png and service-page4-empty.png. Gauge/table retain their existing distinct empty behavior; missing-field messaging still needs separate review.

## VIS-PIE-025 - Single category changes pie/donut into noninteractive progress ring
- **Area / Category / Severity:** Pie and donut, shared app and Power BI primitive / Rendering and Interaction / High (P1).
- **Reproduce:** Filter a categorical pie/donut to Accessories in the live Service gallery.
- **Expected:** Same chart type, configured radii, category legend, labels and slice interactions with one category representing 100 percent.
- **Actual:** Pie gains a hole; both charts shrink into a progress ring with filled/remainder pseudo-categories, silent:true, and no legend.
- **Evidence:** service-page2-one.png.
- **Root cause:** PieMarks selects radial-progress mode solely from rows.length===1; callers also change font size solely on row count.
- **Status:** Verified through 34 pie tests, native Electron click/deselect cases, and live Service single-category screenshot review.
- **Fix / Regression:** Distinguish absent category from one categorical row; scalar progress remains supported. tests/pie-single-category.test.ts, interaction-audit-after.json, service-page2-one.png. Live Service slice-to-other-visual filtering is not covered by this status.

## DATA-CATEGORY-026 - Numeric-looking text categories lose identity
- **Area / Category / Severity:** Fabric/local query parsing and Fabric app shim / Data and Filtering / High (P1).
- **Reproduce / Input:** SDK/REST row with Product[Code] = "00123" or a long numeric identifier stored as text.
- **Expected:** Preserve exact category text so labels and filter predicates identify the original member.
- **Actual:** Both adapters coerce every numeric-looking string to Number, dropping leading zeros and potentially losing integer precision.
- **Root cause:** src/fabric/client.js parseFabricResponseMulti and electron/fabric/templates/semantica-shim.ts.tmpl toRows.
- **Evidence:** Source tracing; regression fixture required. CLI live literal query blocked by missing Azure CLI auth; this is not claimed as a live-data reproduction.
- **Status:** Verified through six adapter regression tests; included in hosted deployment.
- **Fix / Regression:** Preserve qualified dimension strings while coercing numeric measures; tests/category-identity.test.js. Live leading-zero model members have not been tested.

## EXPORT-FABRIC-027 - Dimension-only table builds an undefined measure
- **Area / Category / Severity:** Fabric exported table / Query parity / High (P1).
- **Reproduce / Input:** Create a table with one or more dimensions and no measures, then export as a Fabric app.
- **Expected:** Query distinct dimension combinations with deterministic dimension sorting, matching the Electron table path.
- **Actual:** Fabric shim unconditionally builds TOPN/ORDER BY using measures[0], producing [undefined]. Found while tracing a separate duplicate-dimension error in the live QA fixture.
- **Root cause:** electron/fabric/templates/semantica-shim.ts.tmpl buildTableDAX lacks the dimension-only branch implemented in electron/ipc/query.js.
- **Evidence:** tests/fabric-dimension-table.test.js; fabric-portal-audit.json dimensionOnly result.
- **Status:** Verified through two regression tests and the real hosted Fabric SDK query returning all four category members.
- **Fix / Regression:** Mirror Electron dimension sorting for measure-free tables; tests/fabric-dimension-table.test.js.

## EXPORT-PARTS-028 - Existing report binary resources are decoded as UTF-8
- **Area / Category / Severity:** Existing Power BI report update / Data preservation / Critical (P0).
- **Reproduce / Input:** Fetch an existing report definition containing a PNG/image or other non-UTF-8 resource, then update it through the insertion pipeline.
- **Expected:** Untouched report resources survive byte-for-byte; edited JSON is updated.
- **Actual:** Definition fetch discards original base64 and decodes every part as text. Re-encoding replaces invalid UTF-8 bytes; several report builders also drop payload metadata when copying parts.
- **Root cause:** electron/ipc/powerbi.js fetchDefinitionInFormat/encodeParts and pass-through mappings in report builders/injectorFlow.
- **Evidence:** tests/power-bi-update.test.js, tests/report-resource-builders.test.js, tests/injector-preservation.test.js, service-resource-roundtrip.json.
- **Status:** Verified through binary-byte roundtrip, report-builder and insertion preservation tests; live QA report roundtrip preserves all 30 parts byte-for-byte. Full user-facing insertion acceptance remains separate.

## EXPORT-INJECT-029 - Failed visual preparation can publish empty content
- **Area / Category / Severity:** Existing report visual insertion / Error handling / High (P1).
- **Reproduce / Input:** Inject a visual when its data query or HTML preparation throws.
- **Expected:** Stop before modifying the semantic model or report; identify the failing visual.
- **Actual:** Catch handler generates an empty content measure and continues dataset/report updates; error-shaped query results are not rejected.
- **Root cause:** ui/src/pages/injector/injectorFlow.js baked HTML preparation loop.
- **Evidence:** tests/injector-preservation.test.js: query exception/error-result, render exception and empty output reject before any write.
- **Status:** Verified by four fail-before-write regression cases, plus successful insertion preparation. UI build passes; cloud failure simulation was not performed on user data.

## EXPORT-INJECT-030 - Existing-report insertion still exports static substitutes
- **Area / Category / Severity:** Existing Power BI report insertion / Target parity / High (P1).
- **Reproduce / Input:** Insert grouped bar, slope, waterfall or bar race into an existing report using PbiInjector.
- **Expected:** Preserve the visual's semantics and supported interactions, or clearly identify unsupported capabilities before export.
- **Actual:** usePrimitive=false forces static HTML. Several types alias to ordinary bar/line templates; data is baked into a string measure, so report filters cannot recalculate the chart values.
- **Root cause:** injectorFlow.js retains an older fallback. Its original assumption that modern PBIR cannot serve private visuals has been disproved by the current 19-visual Service gallery. Migrating the injector requires separate binding/resource/native-slicer tests.
- **Evidence:** injectorFlow.js and htmlTemplates/index.js; live gallery cloud-gallery.json establishes modern PBIR rendering, not injector parity.
- **Status:** Open. Primitive insertion is not enabled by this audit finding.

## INTERACTION-PBI-031 - Primitive click indexes can select a different category
- **Area / Category / Severity:** Power BI primitive selection / Interaction and data identity / High (P1).
- **Reproduce / Input:** Bind categories in an order different from descending measure order and click the first sorted bar; also test treemap tiles and slope endpoints.
- **Expected:** Filter by the category visibly clicked, regardless of sorting or chart-specific event indexes.
- **Actual:** Renderer sorts rows, then indexes unsorted DataView selection IDs using ECharts dataIndex. Treemap includes a root node; slope dataIndex is an endpoint index, not the category.
- **Root cause:** visual.ts renderPrimitiveChart generic click handler and applyChartSelection assume matching indexes.
- **Evidence:** Live Service Accessories tile incorrectly filtered Bikes: service-native-treemap-selection-before.json/png. tests/power-bi-selection-runtime.test.ts reproduces sorting, treemap, slope and radar identity errors.
- **Status:** Verified for the reproduced treemap mismatch in live Service after rebuild: Accessories now filters Accessories. Production-method tests cover the other listed mappings; live acceptance for each remains in progress.

## FORMAT-PBI-032 - Selection removes functional chart formatting
- **Area / Category / Severity:** Power BI chart selection / Formatting / High (P1).
- **Reproduce / Input:** Select a chart with function-based label formatting or bubble symbolSize.
- **Expected:** Selection changes emphasis only; labels, tooltip formatting and bubble-size encoding remain intact.
- **Actual:** applyChartSelection clones the full option via JSON serialization, dropping functions; only the top-level tooltip formatter is restored.
- **Root cause:** visual.ts applyChartSelection JSON.parse/JSON.stringify.
- **Evidence:** tests/power-bi-selection-runtime.test.ts; selection now structurally copies changed branches instead of JSON cloning.
- **Status:** Fixed; production-method regression verifies formatter/symbolSize preservation, unchanged original option and lollipop coordinate values. Live rebuilt-package retest pending.

## INTERACTION-RADAR-033 - App radar uses polygon name instead of spoke category
- **Area / Category / Severity:** Canvas/viewer/web/Fabric radar / Interaction and tooltip / High (P1).
- **Reproduce / Input:** Four-category radar; click the South spoke, then Ctrl-click East.
- **Expected:** Filter South, then South + East; tooltip identifies the visible spoke.
- **Actual:** No expected category reaches the sibling KPI. Click reads the polygon/series name; hover angle runs clockwise while ECharts indicators run counterclockwise. Modifier keys are not forwarded.
- **Root cause:** CompactRadarEcharts.jsx handleChartReady/handleClick.
- **Evidence:** interaction-radar-before.json; native Electron mouse events against real chart layouts.
- **Status:** Verified through native Electron South-spoke and Ctrl-East selection; 19/19 native interaction checks pass. Hosted Fabric Bikes-spoke selection produces an actual model query returning Quantity Sold 13929; repeat-click clears the filter and restores 84174. Evidence: fabric-portal-audit.json. Uses indicator identity and forwards Ctrl/Meta.

## VIS-PIE-034 - Legend-shifted circles escape narrow or short containers
- **Area / Category / Severity:** Shared pie/donut renderer / Edge clipping / High (P1).
- **Reproduce / Input:** Hosted Fabric gallery page 7-12, light theme, pie with right legend at approximately 274 x 366. Also resize a chart with top/bottom legend to a wide, short container; outer radius 95%.
- **Expected:** Entire circular mark remains within its allocated chart area, with space reserved for the legend. Preserve configured radius proportions and center text alignment.
- **Actual:** Center shifts toward an edge while radius uses the full container, so the circle crosses that edge.
- **Evidence:** docs/qa/evidence/fabric-theme-light.png; tests/pie-bounds-runtime.test.ts exercises actual ECharts geometry.
- **Root cause:** ui/src/primitives/pie-marks/index.ts uses shifted center without a corresponding series layout rectangle.
- **Fix:** Reserve a series layout rectangle beside/above/below the legend; radius is relative to that rectangle. Preserve existing center-text position. Explicitly clear reserved bounds when hiding the legend or switching to scalar mode.
- **Status:** Fixed with 31 actual ECharts geometry/transition checks (20 of the original 30 size cases failed before the change); verified after deployment by reviewing fabric-theme-light.png and fabric-live-visuals-7-12.png. Service updated gallery standard/single-category/empty cycles also completed. Legend text, large center text and hover bounds require separate checks.

## INTERACTION-MODIFIER-035 - Several visual adapters discard modifier keys
- **Area / Category / Severity:** Pie/donut/line/area/stacked-area/treemap cross-filtering / Interaction consistency / High (P1).
- **Reproduce / Input:** Select North, then Ctrl-click South in a four-category pie or donut with a sibling KPI.
- **Expected:** Both categories filter the sibling; Ctrl-click removes a category and clearing the last selection restores all data.
- **Actual:** South replaces North because the click adapter discards modifier keys.
- **Evidence:** interaction-audit.json records two native failures; scripts/qa/interaction-audit.cjs.
- **Root cause:** CompactDonutEcharts.jsx, CompactLineEcharts.jsx and CompactTreemapEcharts.jsx handleClick forward category only. Native tests also reproduce all four line/area/stacked-area/treemap failures.
- **Fix:** Forward Ctrl/Meta modifiers through the existing supported selection operation, matching the bar-family adapter.
- **Status:** Verified: all six affected types pass native add/remove/clear lifecycles; 25/25 app interaction checks pass. Deployed Fabric pie also passes real-model single/multi/remove/clear (57809, 71738, 13929, 84174). Other affected hosted adapters are compiled but not individually clicked yet.

## EXPORT-INJECT-036 - Invalid insertion targets are accepted after model writes
- **Area / Category / Severity:** Existing-report insertion / Data preservation / Critical (P0).
- **Reproduce / Input:** Supply a deleted target page, malformed/missing report.json, duplicate incoming visual IDs, or a mixture containing a measure-free visual.
- **Expected:** Reject the request before modifying the semantic model or report; do not silently drop visuals or choose another page.
- **Actual:** Five regression cases resolve as success. Malformed report JSON is replaced by an empty object; absent page paths are appended; duplicate IDs share generated measure mappings; measure-free visuals are filtered out. Legacy selection additionally falls back to the first page.
- **Evidence:** tests/injector-preservation.test.js (five failures before correction).
- **Root cause:** injectorFlow.js validates too little before pbismUpdateDefinition; legacy target selection uses sections[0] fallback.
- **Status:** Verified by 12 insertion regression tests, including missing/valid legacy destinations and successful preservation. Invalid requests fail before writes; full live insertion parity remains EXPORT-INJECT-030.

## EXPORT-TABLE-037 - Power BI table omits app header sorting and column resize
- **Area / Category / Severity:** Table / Cross-target interaction parity / High (P1).
- **Reproduce / Input:** Create the three-measure category table in Vilsem, sort by a header or resize a column, then compare the exported primitive table in Service/Desktop.
- **Expected:** Preserve supported table interaction capabilities across targets; document any persisted-width/sort limitations explicitly.
- **Actual:** App CompactTableEcharts has toggleSort header handlers and column resize handles. Power BI renderTableIntoArea emits fixed-flex header/row HTML and hover handlers only; it has no header sorting or resize operation.
- **Evidence / Root cause:** ui/src/appspec/visuals/CompactTableEcharts.jsx versus pbiviz-semantica-renderer/src/visual.ts renderTableIntoArea. Service and Desktop default table screenshots establish rendering, not this feature's parity.
- **Status:** Open, source-confirmed missing implementation. Native comparative acceptance still required. Table is not included in the 16 mark-selection checks because neither reviewed table implementation provides row cross-filter selection.

## TOOLTIP-TEXT-038 - Inline tooltip formatters interpret category markup
- **Area / Category / Severity:** Pie/donut, line/area, scatter/bubble, treemap, radar / Data text integrity / High (P1).
- **Reproduce / Input:** Use a category named `<b data-qa="category">A & B</b>` and hover a mark.
- **Expected:** Display the exact category text literally, including angle brackets and ampersands.
- **Actual:** Five primitive formatters return category text unescaped inside HTML; unlike the shared bar tooltip, they interpret markup. Radar wrappers also replace the primitive tooltip with another unescaped formatter.
- **Evidence:** tests/tooltip-literal-data.test.ts: five failures before correction, using harmless markup.
- **Root cause:** Inline formatter string interpolation bypasses the escaping implemented only in the Tooltip primitive.
- **Status:** Verified through six primitive escaping tests, the actual Power BI radar formatter, and app runtime DOM checks for bar/line/pie/donut/scatter/bubble/treemap/radar. The 32-check app interaction/tooltip suite passes. One shared escapeHtml helper now handles category, series and formatted-value HTML boundaries; canvas labels and ECharts marker markup remain unchanged. Updated cloud bundle acceptance is underway.

## FORMAT-PBI-039 - Tooltip overrides are calculated but discarded
- **Area / Category / Severity:** Power BI primitive formatting / UI-target parity / High (P1).
- **Reproduce / Input:** Export a chart with tooltipEnabled=false or tooltipTrigger=axis.
- **Expected:** Power BI honors the same visibility/trigger options as the app.
- **Actual:** renderPrimitiveChart calls applyTooltipConfig without using its returned option. The helper returns a new object for overrides, so the original tooltip remains unchanged.
- **Evidence:** tests/power-bi-selection-runtime.test.ts reproduces ignored visibility using the actual helper and production Visual method.
- **Root cause:** visual.ts discarded immutable helper result.
- **Status:** Verified: production-method tests cover visibility/trigger, and live Service hover tests confirm hidden and shown states (service-tooltip-disabled.json, service-tooltip-enabled.json). Default QA report restored; native bar selection/deselection also passes in both states.

## INTERACTION-POINT-040 - Several app chart wrappers omit category selection
- **Area / Category / Severity:** Scatter/bubble/slope/lollipop / Interaction parity / High (P1).
- **Reproduce / Input:** Create a four-category chart and sibling KPI in the viewer. Click North, then Ctrl-click South.
- **Expected:** Filter the sibling by the clicked category, preserving Ctrl/Meta add/remove behavior as in bar and Power BI.
- **Actual:** None of these four visual types sends the initial category filter. Their EChartsCanvas instances receive no onClick handler, although AppSpecRenderer supplies the selection operation.
- **Evidence:** scripts/qa/interaction-audit.cjs; four native failures with undefined filter instead of North.
- **Root cause:** CompactScatterEcharts, CompactSlopeEcharts and CompactLollipopEcharts omit click adapters. Slope needs series identity; lollipop needs the category coordinate, not the numeric dot value.
- **Status:** Verified in the app: all four new category adapters pass native initial/Ctrl-add/remove/clear, with vertical lollipop and slope right-endpoint checks. The 40-check app suite passes. Deployed Fabric native selection/clear also passes for all four types (8 checks; evidence/fabric-point-interactions.json).

## FORMAT-MOTION-041 - Slope/lollipop ignore animation controls
- **Area / Category / Severity:** Slope and lollipop / Formatting controls / Medium (P2).
- **Reproduce / Input:** Set animations=false and animationEnabled=false, then inspect the running ECharts option; toggle the controls on and off.
- **Expected:** Both aliases disable animation when false; changing the control updates the renderer.
- **Actual:** App compositions omit the animation property and its memo dependencies. ECharts remains at its default auto animation setting.
- **Evidence:** scripts/qa/interaction-audit.cjs records two failed renderer-state assertions. Moving lollipop marks also exposed a geometry-only readiness limitation in the native click test.
- **Root cause:** CompactSlopeEcharts/CompactLollipopEcharts option construction.
- **Status:** Verified: app renderer-state checks pass false/true/false transitions, and Power BI composition tests honor both aliases. Both hosts now set animation explicitly; app memo dependencies include the controls. New packages are built; cloud animation-state inspection remains separate.

## VIS-PIE-042 - Scalar progress retains the previous categorical legend
- **Area / Category / Severity:** Donut field replacement / Rendering state / Medium (P2).
- **Reproduce / Input:** Render a category donut with Accessories, replace the category/value rows with a scalar measure, then restore categorical rows.
- **Expected:** Scalar progress has no categorical legend; restoring categories restores a correct interactive legend.
- **Actual:** Scalar options omit legend, so the app merge retains the previous visible legend and ECharts warns that its entries no longer exist.
- **Evidence:** tests/pie-bounds-runtime.test.ts reproduces show=true where false is expected using the same replaceMerge list as EChartsCanvas.
- **Root cause:** PieMarks scalar branch omits a reset for the merged legend component.
- **Fix:** Scalar progress explicitly emits legend.show=false and an empty legend data array.
- **Status:** Verified through an actual ECharts categorical/scalar/categorical merge test; all 66 focused pie/donut tests and 40 app interaction checks pass. Latest hosted scalar-transition acceptance remains untested.

## BUILD-LINT-043 - Power BI standalone lint command cannot load configuration
- **Area / Category / Severity:** Power BI renderer release checks / Build tooling / Medium (P2).
- **Reproduce / Input:** Run npm run lint in pbiviz-semantica-renderer using the installed dependencies.
- **Expected:** Lint source files and report actionable file/line violations.
- **Actual:** ESLint 10.2.0 exits 1 because eslint.config.js/mjs/cjs is missing. The separate pbiviz package lint step reports four errors but continues packaging.
- **Evidence:** Command output in this audit; package.json lint command invokes eslint src --ext .ts.
- **Root cause:** Installed standalone ESLint and project configuration are not aligned; the package tool uses its own recommended configuration.
- **Status:** Open. No dependency/configuration migration made without tracing package-tool compatibility.
- **Regression test:** Pending a reproducible lint command and release failure gate.
