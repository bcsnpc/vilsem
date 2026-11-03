# Vilsem audit bug log

Current repair status: [verified fixes and remaining work](fix-status.md). Reproduction descriptions below preserve before-fix behavior.

Audit started 2026-09-07. Verified fixes are recorded per issue and in fix-status.md. **Open** means unresolved, even when the defect was reproduced. Synthetic leaf-renderer checks do not establish end-to-end host behavior.

Full-audit continuation: [additional reproduced findings](full-audit-findings.md), including **PERSIST-001 (P0 project overwrite)**, **DATA-EDITOR-001**, AI slicer/patch defects and the resolved default-packaging precedence.

Further production-function regressions: [schema, filtering and layout findings](schema-filter-findings.md). Interpret all counts using [coverage limitations](audit-coverage-limitations.md).

Visually reviewed findings: [clipping defects](clipping-review.md) and [visual semantics/label defects](visual-review-findings.md), covering Heatmap, Sunburst, Stacked Area, Column, Waterfall, Narrative and Insight.

Further all-visual findings and fixes: [error propagation, Bar Race and Gauge](continuation-findings.md).

## VIS-LINE-001 â€” Hook order changes when data becomes empty

- **Status:** VERIFIED (local scope).
- **Fix and verification:** Run hooks before state returns. Line-family transitions pass in both hosts. See [fix status](fix-status.md).

- **Area / Category / Severity:** Line, Area, Stacked Area, Bump / Rendering / High (P1).
- **Description:** Data-dependent early returns precede a `useMemo` in the shared line renderer.
- **Steps:** Run the Vite server, then `node scripts/qa/launch-audit.cjs --renderers`. Transition mounted charts from standard rows to `[]`, then restore rows.
- **Input:** Four synthetic categories with two measures, followed by an empty result.
- **Expected:** Empty state, then successful recovery, without React errors.
- **Actual:** Chromium logs â€œRendered fewer hooks than expectedâ€ for `CompactLineEcharts` and its wrappers. Error boundaries can reset fast enough to hide this from a later DOM snapshot.
- **Evidence:** `evidence/renderer-smoke.json`, `events`; `ui/src/appspec/visuals/CompactLineEcharts.jsx:18` early returns and `:25` useMemo.
- **Suspected root cause:** Conditional hook execution. All hooks must execute on every render.
- **Regression test:** Renderer transition harness captures console errors and fails its exit status. Add a focused assertion for loading/error/empty/populated transitions before fixing.

## VIS-FUNNEL-001 â€” Empty results display invented data

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

## SPEC-CUSTOM-001 â€” Registered custom visuals fail validation

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

## VIS-TABLE-001 â€” Dimension-only table is removed by layout normalization

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

## BUILD-001 â€” Conflicting release configurations include a secret-file risk

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

## QA-BASELINE-001 â€” Existing suite is red

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

## VIS-BOUNDS-001 â€” Leaf renderers report content beyond their allocated size

- **Area / Category / Severity:** Multiple visuals / Clipping / Medium, pending host reproduction (P1 investigation).
- **Steps:** Run renderer audit at 80Ã—60, 160Ã—600 and 800Ã—100; inspect overflowCandidate and related screenshots.
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
- Evidence: vilsem-renderer/src/visual.ts renderHtmlWithSelection, secondary-axis branch; existing axisSwitcherParity test remains failing.
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
- Source fix: vilsem-renderer/src/compositions.ts applies 28px top clearance to all vertical bar variants with top labels, using the existing grouped-bar allowance. Domain unchanged.
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
- **Evidence / Root cause:** ui/src/appspec/visuals/CompactTableEcharts.jsx versus vilsem-renderer/src/visual.ts renderTableIntoArea. Service and Desktop default table screenshots establish rendering, not this feature's parity.
- **Status:** Verified for header sorting and resizing in production-method Electron tests and the live Service QA report (service-table-interactions.json). Sorting cycles descending/ascending/source order; widths align headers and rows, survive data updates, and reset when bound fields change. Mouse/keyboard resize tested locally; Service DOM sorting/keyboard resize tested on real model data. Saved-width/sort persistence and row cross-filter selection remain unsupported. Desktop-specific retest remains pending.

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
- **Reproduce / Input:** Run npm run lint in vilsem-renderer using the installed dependencies.
- **Expected:** Lint source files and report actionable file/line violations.
- **Actual:** ESLint 10.2.0 exits 1 because eslint.config.js/mjs/cjs is missing. The separate pbiviz package lint step reports four errors but continues packaging.
- **Evidence:** Command output in this audit; package.json lint command invokes eslint src --ext .ts.
- **Root cause:** Installed standalone ESLint and project configuration are not aligned; the package tool uses its own recommended configuration.
- **Status:** Open. No dependency/configuration migration made without tracing package-tool compatibility.
- **Regression test:** Pending a reproducible lint command and release failure gate.

## FORMAT-TABLE-044 - Power BI table interprets formatting text as HTML
- **Area / Category / Severity:** Power BI table / Text integrity / High (P1).
- **Reproduce / Input:** Set a table value prefix to `<b data-qa="literal">$` and render values in the Power BI table method.
- **Expected:** The prefix is displayed literally, as in the app's React renderer.
- **Actual:** The formatter is inserted into innerHTML without escaping; the prefix creates markup.
- **Evidence:** scripts/qa/powerbi-table.cjs, powerbi-table-before.json: literal-text assertion fails.
- **Root cause:** renderTableIntoArea interpolates fmtV directly into row markup.
- **Fix:** Escape formatted values at the HTML boundary.
- **Status:** Verified in production-method Electron DOM test; live Service retest pending.
- **Regression test:** scripts/qa/powerbi-table.cjs literal formatting text.

## DATA-TABLE-045 - Measure-only Power BI table drops its values
- **Area / Category / Severity:** Power BI table / Data / High (P1).
- **Reproduce / Input:** Bind one scalar measure with value 42 and no category column.
- **Expected:** Render one value row without inventing a category column.
- **Actual:** Table renders zero rows because row count comes only from categories.
- **Evidence:** powerbi-table.cjs measure-only test fails with 0 rows instead of 1.
- **Root cause:** renderTableIntoArea derives nRows exclusively from catCols[0].
- **Fix:** Derive row count from bound dimension and measure columns; omit the fabricated Category header when no category is bound.
- **Status:** Verified through the production-method Electron regression; all seven table checks pass. Live scalar table export acceptance remains separate.
- **Regression test:** scripts/qa/powerbi-table.cjs.

## UX-INJECT-046 - Destination page picker overcounts visuals
- **Area / Category / Severity:** Existing-report insertion / UX / Low (P3).
- **Reproduce / Input:** Load a PBIR page with two visual folders, one containing both visual.json and a supporting mobile.json part.
- **Expected:** Page picker reports two visuals regardless of part order.
- **Actual:** Three visuals reported because every file increments the count.
- **Evidence:** tests/injector-preservation.test.js reproduced expected 2 / actual 3 before the fix.
- **Root cause:** extractPagesFromParts counts parts rather than distinct visual folders.
- **Fix:** Track distinct folder IDs per page; preserve public page metadata shape.
- **Status:** Verified through the production parser regression. All 13 insertion preservation tests pass; no live destination write required for this metadata-only change.
- **Regression test:** tests/injector-preservation.test.js, distinct visual folders and reversed part order.

### Existing-report insertion retired by product decision
- User requested removal in favor of exporting .pbiviz visuals and importing them into existing reports.
- Removed Home entry, command-palette command, and App route/import. Historical implementation is unlinked; shared model/report utilities remain used by other export flows.
- EXPORT-INJECT-030 is retired from the active backlog, not verified as fixed. Historical insertion-only acceptance work is no longer a release requirement. Export/import parity remains required.

## EXPORT-GUIDE-047 - Table custom-visual export guide omits measures
- **Area / Category / Severity:** Export Visuals / Field binding UX / Medium (P2).
- **Reproduce / Input:** Export a table with ten measures and read its field-binding guide.
- **Expected:** All ten measures listed in authored order under Content, matching the renderer capabilities and local-report bindings.
- **Actual:** Only three measures listed, using Content/Secondary/Tertiary; seven measures omitted.
- **Evidence:** tests/visual-export-guide.test.js failed before the change with four guide entries instead of eleven including the category.
- **Root cause:** bindingGuideFor applies chart three-measure roles to tables.
- **Fix:** Table guide uses the ten-measure Content well; other chart roles are unchanged.
- **Status:** Verified through guide/spec regression tests. Manual Power BI import with ten measures remains untested.
- **Regression test:** tests/visual-export-guide.test.js (table ordered bindings/spec retention; scatter roles).

## FORMAT-AXIS-048 - No independent secondary-axis typography contract
- **Area / Category / Severity:** Cartesian formatting / Configuration consistency / Medium (P2).
- **Reproduce / Input:** Pass two Y-axis entries to applyAxisTextConfig and set yAxisLabelColor.
- **Expected:** Shared defaults may apply to both, with a separate supported override for secondary-axis styling when a visual has two axes.
- **Actual:** The same Y-label override applies to both; the pane schema contains only X/Y settings, no secondary-axis overrides.
- **Evidence:** ui/src/appspec/shared/axisTextConfig.js and axisFormattingSchema.js source trace.
- **Root cause:** Configuration is keyed by axis orientation, not axis index/role.
- **Status:** Open, source-confirmed; live dual-axis acceptance pending. Line/Area currently render one Y-axis, so exposing a secondary control alone would not deliver dual-axis support.
- **Fix / Regression test:** Pending shared contract, consuming renderer support and independent-style/domain-preservation tests.

## FORMAT-PBI-049 - Power BI compositions ignore shared axis typography
- **Area / Category / Severity:** Power BI rendering parity / Formatting / High (P1).
- **Reproduce / Input:** Compose bar, column, grouped/stacked bar, line, area, stacked area, scatter, bubble, slope or lollipop with explicit X-label color and Y-label font size/family.
- **Expected:** Apply the same explicit typography contract as the app without changing domains, categories or series values.
- **Actual:** Power BI composition does not call the shared axis helper; requested family/color/size are absent.
- **Evidence:** tests/power-bi-axis-formatting.test.ts: all 11 cases failed before integration.
- **Root cause:** EChartsCanvas applies axisTextConfig, while Power BI composeOption bypasses it.
- **Fix:** Wrap the Power BI composition entry point with the shared helper; include helper in the build copy manifest. Drill paths calling composeOption also inherit the helper.
- **Status:** Verified through production composition tests, 24 focused checks pass. Actual hosted/desktop rendering, playback-specific paths and package acceptance remain pending.
- **Regression test:** tests/power-bi-axis-formatting.test.ts plus tests/axis-text-config.test.js.

## FORMAT-RACE-050 - Power BI playback bypasses formatting overrides
- **Area / Category / Severity:** Bar race / Formatting and interaction consistency / High (P1).
- **Reproduce / Input:** Set yAxisLabelColor=#ff00ff, yAxisLabelSize=19 and tooltipEnabled=false, then scrub between two frames.
- **Expected:** Initial and subsequent frames honor the chosen axis typography and hidden tooltip, preserving frame values.
- **Actual:** Axis uses theme color/default size and tooltip remains enabled; playback bypasses the standard composition path.
- **Evidence:** tests/power-bi-race-formatting.test.ts executes production renderBarRace and the scrub handler; failed before fix (#999 versus #ff00ff).
- **Root cause:** draw() sends a raw option directly to setOption.
- **Fix:** Apply shared axis and tooltip helpers on every frame draw.
- **Status:** Verified through production-method regression with a mocked chart sink. Hosted Power BI/Desktop visual acceptance remains pending.
- **Regression test:** tests/power-bi-race-formatting.test.ts verifies initial/scrubbed formatting and next-frame data.

## DRILL-PBI-051 - Deeper hierarchy fields disappear or overwrite parents
- **Area / Category / Severity:** Power BI drill / Data integrity / High (P1).
- **Reproduce / Input:** Bind Region[Name], Product[Name], Product[SKU] and measure 25; prepare finest drill rows and aggregate at path West/Bikes.
- **Expected:** Preserve West, Bikes and Road-1 as distinct hierarchy values; leaf aggregate is 25.
- **Actual:** Preparation reads only two category columns and keys by bare column name, producing Bikes/Bikes/undefined.
- **Evidence:** tests/power-bi-selection-runtime.test.ts failing-before reproduction.
- **Fix:** Read all declared bound levels and use table-qualified keys with the matching colOf accessor.
- **Status:** Verified through production data-preparation and leaf-aggregation regression; hosted multi-level navigation remains pending.
- **Regression test:** preserves all drill levels including equal column names in different tables.

## FORMAT-DRILL-052 - Drill redraw ignores axis/tooltip overrides
- **Area / Category / Severity:** Power BI replace/panel drill / Formatting / Medium (P2).
- **Reproduce / Input:** Apply explicit Y-label color and disable tooltip, then use drill redraw.
- **Expected:** Redraw retains explicit settings and series data.
- **Actual:** styleChartOption applies only background and base font; shared overrides bypassed.
- **Evidence:** production-method regression failed with default #999 instead of #ff00ff.
- **Fix:** Pass config into both redraw call sites and apply shared axis/tooltip helpers.
- **Status:** Production-method regression verified; hosted click-to-drill acceptance pending.
- **Regression test:** applies formatting to the shared drill redraw boundary in tests/power-bi-selection-runtime.test.ts.

## EXPORT-CAPACITY-053 - Custom visual export silently exceeds field-well capacity
- **Area / Category / Severity:** Single visual export / Data completeness / High (P1).
- **Reproduce / Input:** Export a line with four measures, table with eleven measures, or table with seven category fields.
- **Expected:** Reject unsupported capacity before writing, with actionable feedback.
- **Actual:** Spec includes all fields, while the binding guide truncates fields beyond supported wells.
- **Evidence:** Three failing-before cases in tests/visual-export-guide.test.js.
- **Root cause:** specForExport does not validate guide/renderer capacity.
- **Fix:** Explicit measure/category capacity errors before invoking package writer.
- **Status:** Verified through five export-guide tests; no runtime import claimed for rejected inputs.
- **Regression test:** tests/visual-export-guide.test.js.

### BUILD-LINT-043 follow-up
Standalone lint now runs and passes with the installed tool's recommended configuration. Empty container clears use textContent, race frame variable no longer triggers a filesystem false positive, and floating legacy tooltips clone existing nodes or use literal fallback text. Tooltip content preservation is covered in power-bi-selection-runtime.test.ts. Certificate generation and dependency findings remain separate open issues.

## EXPORT-DRILL-054 - Custom visual import guide omits drill hierarchy fields
- **Area / Category / Severity:** Export Visuals / Drill bindings / High (P1).
- **Reproduce / Input:** Export grouped bar with Region[Name] -> Product[Name] -> Product[SKU], Sales, replace drill.
- **Expected:** Guide lists all three category wells in hierarchy order and retains the same hierarchy in the baked spec.
- **Actual:** Only the ordinary groupBy is listed; following the guide leaves drill fields unbound.
- **Evidence:** visual-export-guide.test.js failed before fix, returning only Region[Name].
- **Fix:** Bar-family export guides prioritize the complete declared hierarchy, with existing six-category capacity validation.
- **Status:** Verified through binding-guide/spec tests; actual exported package import remains pending.
- **Regression test:** guides all drill levels in hierarchy order instead of only the base dimension.

## DRILL-BINDING-055 - Partially bound hierarchy enters drill rendering
- **Area / Category / Severity:** Power BI drill / Incomplete field assignment / Medium (P2).
- **Reproduce / Input:** Import a three-level bar hierarchy but bind only two category fields.
- **Expected:** Actionable message identifies the required category count before attempting drill.
- **Actual:** nCats>=2 passes the drill guard irrespective of declared depth.
- **Evidence:** production renderer test observes no missing-field message before fix.
- **Fix:** Require all hierarchy categories when drill is enabled; preserve explicit off behavior.
- **Status:** Production entry-point regression verified; hosted UI acceptance pending.
- **Regression test:** reports an incomplete imported drill hierarchy before drawing partial data.

## FORMAT-TEXT-056 - Measure token insertion interprets field names as HTML
- **Area / Category / Severity:** Text box / Text integrity / High (P1).
- **Reproduce / Input:** Insert live measure names containing <b>Revenue</b>, literal &quot;, quotes/ampersands, or Unicode.
- **Expected:** Visible label and data-measure attribute preserve the exact name; surrounding rich text is retained.
- **Actual:** Visible name is interpolated into insertHTML without escaping; extraction also only decodes selected entities using a regex.
- **Fix:** Build token markup with DOM attributes/textContent; extract names from inert parsed token elements.
- **Status:** Five native Electron DOM cases pass. Full caret/editor interaction acceptance remains pending.
- **Regression test:** scripts/qa/text-token.cjs, evidence/text-token.json.

## FORMAT-RACE-057 - App bar race ignores tooltip trigger setting
- **Area / Category / Severity:** App/web bar race / Formatting / Medium (P2).
- **Reproduce / Input:** Set tooltipTrigger=axis via the live app configuration.
- **Expected:** ECharts tooltip trigger becomes axis and resets to item for auto.
- **Actual:** Live chart retained item while stored configuration said axis.
- **Fix:** Apply shared tooltip helper, track tooltip settings in redraw dependencies, and replace tooltip option on update.
- **Status:** Browser live-option validation passed hide/axis -> show/item -> show/auto. Broader native interaction rerun underway.
- **Regression test:** scripts/qa/interaction-audit.cjs, bar race tooltip changes apply immediately and reset to auto.

## QA-HOST-058 - Hosted visual verification can lose state during source edits
- **Area / Category / Severity:** Hosted test harness / Verification reliability / Medium (P2).
- **Reproduce / Input:** Service embed used the Vite full-audit page while application source changes trigger development updates.
- **Expected:** Hosted acceptance is independent of development hot reload and fails on readiness timeout.
- **Actual:** Latest run rendered four pages then lost frame readiness at grouped_bar; subsequent browser calls failed. HMR is a suspected cause, not established by the failed run.
- **Fix:** Isolated static loopback host, explicit readiness timeout failure, navigation/crash diagnostics.
- **Status:** Retry underway. Retained failure: evidence/cloud-gallery-before-static-host.json. No all-visual interaction pass claimed.

## EXPORT-TEXT-059 - Replacement-sensitive text corrupts custom visual packages
- **Area / Category / Severity:** Power BI package export / Serialization / High (P1).
- **Reproduce / Input:** Export a visual with a title containing $&, $` or $'.
- **Expected:** Bake the exact JSON spec literally into the bundled renderer and preserve valid JavaScript.
- **Actual:** String.replace interprets replacement tokens; $& leaves the placeholder and other tokens insert unrelated bundle text. Three production writer tests failed before correction.
- **Root cause:** String replacement value passed directly rather than through a callback.
- **Fix:** Use a replacement callback returning JSON.stringify(spec).
- **Status:** Four actual-template package-content tests pass, including generated JavaScript syntax validation; four report resource-preservation tests also pass. No hosted import of these special-title packages claimed.
- **Regression test:** tests/visual-package-content.test.js. Requires a built renderer template; explicitly skipped on clean checkouts without one.

### QA-HOST-058 retry result
Isolated static-host retry passed all 16 selectable types' native category selection/deselection plus hosted table sorting/resize. Evidence: evidence/service-static-host-all-types.json. Prior failed run remains retained. This supports using the isolated host; the precise cause of the earlier lost state remains inferred rather than proven.

## QA-FABRIC-060 — Gallery screenshots captured before data arrived
- Area/category: Hosted Fabric QA / regression harness
- Severity: High (invalid rendering evidence)
- Description: Stable page titles could satisfy screenshot readiness while every chart remained unmounted.
- Reproduction/input: Reload the deployed QA app, navigate its seven real-model gallery pages, run the former text/fingerprint stability loop.
- Expected: Capture only after the page-specific data/chart contract is ready; timeout is a failing audit.
- Actual: First four pages were recorded with zero charts; later revisiting page one rendered normally and interaction checks passed.
- Evidence: `evidence/fabric-before-readiness-guard.json`.
- Root cause: `scripts/qa/fabric-portal-audit.cjs` treated stable empty DOM as ready.
- Fix: Require expected chart counts and data-bearing text before stability; fail on timeout. This validates fixture readiness, not all visual semantics.
- Regression: `tests/fabric-page-readiness.test.js` (3 pass); rerun `evidence/fabric-portal-audit.json` (seven pages ready, real-model interactions pass).
- Status: Verified (QA harness).

## VIS-RACE-061 — Playback controls escape narrow visuals
- Area/category: Bar race / clipping and interaction
- Severity: Medium
- Reproduction/input: Create bar race with time frames; resize editor/viewer to 120, 160 or 240 px width.
- Expected: Play, timeline and current frame remain reachable within the visual; scrubbing still changes frames.
- Actual: Range input's intrinsic 129 px minimum plus fixed date width forced controls beyond the visual. Six of eight width/host cases failed.
- Evidence: `evidence/race-controls-before.json`.
- Root cause: `CompactBarRaceEcharts.jsx` unwrapped flex row with intrinsic input minimum and fixed date minimum.
- Fix: Allow control wrapping, shrink the timeline, truncate long dates with full title, and permit vertical control scrolling in very short containers. Added accessible timeline name.
- Regression: `scripts/qa/race-controls.cjs`: eight editor/viewer widths pass and input-to-frame state remains responsive. `evidence/race-controls.json`.
- Status: Verified for app editor/viewer; newly built web/Fabric and hosted validation pending. Separate Power BI renderer has its own controls.

## VIS-WAFFLE-062 — Waffle allocation and compact layout need correction
- Area/category: Waffle / data and clipping
- Severity: Medium
- Reproduction/input: Multiple equal categories, all-zero categories, or narrow 120/160 px cards; use long legend values as a separate case.
- Expected: Finite displayed percentages, exactly 100 allocated cells for nonzero totals, and reachable legends within compact cards.
- Actual: Source independently rounds each segment (three equal shares allocate 99 cells); zero total divides by zero. Broad runtime geometry places narrow-card legend text beyond the visible container.
- Evidence: `evidence/visibility-broad-round.json` waffle cases; `CompactWaffle.jsx` segment count and fixed-width horizontal layout. Focused runtime regression pending.
- Root cause: Independent Math.round allocation, no zero-total guard, fixed cell grid alongside unwrapped legend.
- Status: Verified for multi-segment app editor/viewer cases; other targets and single-value compact layout remain pending.
- Fix: Largest-remainder allocation fills 100 cells for nonzero totals; zero totals allocate none. Normalization prevents overflow. Legend wraps under the grid and scrolls in short cards. Negative-magnitude semantics preserved.
- Regression: tests/waffle-allocation.test.js (5 pass); scripts/qa/waffle-audit.cjs (6 data + 12 layout cases pass). Evidence: waffle-audit-before.json, waffle-audit.json, visually inspected waffle-narrow.png.

## EXPORT-FABRIC-063 — Fresh scaffold deleted an existing local app folder
- Area/category: Fabric deployment / preservation
- Severity: High (local file loss)
- Reproduction/input: Place a file in parentDir/qa; deploy with appName qa and no explicit reuseExisting. Regression uses disposable temporary files only.
- Expected: Preserve existing files and return an actionable collision error before starting any command.
- Actual: The scaffold branch recursively removed the folder before invoking the CLI; the original test file disappeared.
- Evidence: Failing-before/passing-after `tests/fabric-deploy-failures.test.js`, preservation test.
- Root cause: `electron/fabric/runRayfin.js` unconditionally cleaned existing projectDir when reuseExisting was false/absent.
- Fix: Removed recursive cleanup. Return PROJECT_EXISTS and preserve the folder on collision; explicit reuse retains the established pipeline.
- Regression: Eight deployment prerequisite/preservation tests pass, including success with explicit reuse and failures before publishing. Real filesystem bytes preserved; subprocesses mocked in this test.
- Status: Verified through automated filesystem regression. Native UI error display, blank-name guard, and rename/retry preservation now pass (scripts/qa/fabric-dialog.cjs; 3 checks).

### VIS-RACE-061 Power BI follow-up
The separate Power BI race method had the same intrinsic range-input overflow. Eight native-DOM size cases now pass after the matching wrapped-control change, with frame options still updating on scrub. Chart painting is mocked in this focused harness. Existing axis/tooltip frame regression passes; custom visual package build and lint pass. Hosted custom-package race import remains pending. Evidence: `powerbi-race-controls-before.json`, `powerbi-race-controls.json`.

## EXPORT-TYPE-064 — Custom visual package silently substitutes unsupported types
- Area/category: Power BI custom visual export / target correctness
- Severity: High
- Reproduction/input: Export Waffle, Sankey, KPI, text box or an unknown type through specForExport; feed the resulting type to Power BI composition.
- Expected: Supported type retains its renderer; unsupported type returns an explicit message before opening Save or writing a package.
- Actual: Export accepted all types, while composition's default branch drew a bar. Six focused assertions failed before repair.
- Root cause: Custom-package export bypassed isPrimitiveCovered; renderer default silently composed bar marks.
- Status: Verified for export-boundary behavior; missing renderers remain an open feature gap.
- Fix/regression: Shared 19-type JSON manifest drives authoring and package-writer checks; unsupported composition now throws an explicit diagnostic. All 41 registry types pass native inspector export checks (19 accepted with exact type, 22 rejected without IPC). Seventy focused unit/integration tests pass, including malformed spec/no Save and four actual archive/spec cases. Native evidence: export-type-audit.json. This limitation is specific to baked-spec custom-package/local export; Service's legacy live-DAX path has separate coverage.

## FORMAT-PBI-065 — Chart title weight and uppercase were ignored
- Area/category: Power BI primitive header / formatting parity
- Severity: Medium
- Reproduction/input: Export a supported visual with titleFontWeight 900 or 300 and titleUppercase true. Compare the app header with Power BI's primitive header.
- Expected: Explicit title weight and text transform match the saved configuration; default, hidden and plain-card behavior remain intact.
- Actual: Production Power BI header always used weight 600 and no uppercase transformation. Two native DOM cases failed; font size/family/color already worked.
- Evidence: `evidence/powerbi-title-before.json`; `scripts/qa/powerbi-title.cjs` loads the actual header and shared chrome helpers in native Electron DOM.
- Root cause: `renderPrimitiveChart` hand-built a partial title style instead of using `chartTitleStyle`.
- Status: Verified in native DOM; hosted title-variant acceptance remains pending.
- Fix/regression: Power BI now uses the same chartTitleStyle helper as editor/viewer. Five native DOM cases pass, including default, explicit font/color/weight/uppercase, reset, hidden title and plain card. Evidence: powerbi-title.json. The helper is copied by the package build manifest.

## FORMAT-AXIS-048 follow-up — 2026-09-12

**Status: Partially tested.** Independent right value-axis support now exists for two-series, unstacked Line and Area. Eighteen controls cover scale enablement, visibility, title, title styling, label styling, axis line, grid and axis number prefix/suffix. Existing charts retain their shared scale by default. Stacked/rank/custom multi-axis options are excluded.

**Evidence:** `evidence/secondary-axis.json` has 82 passing native checks (72 control assertions, four lifecycle checks, six resize checks); `tests/secondary-axis.test.js` and `tests/power-bi-axis-formatting.test.ts` validate shared and exported composition behavior. A 79px drawing width originally collapsed the plot; the app and package now provide a scrollable minimum drawing width when the independent axis is visible. Screenshot evidence is `evidence/secondary-axis-160.png`.

**Remaining:** hosted Service/Fabric and local Desktop acceptance of this addition, extended extreme typography/height coverage, and independent number-format control beyond axis prefix/suffix. This is unrelated to the still-failing alternate category-axis cross-filter contract.

## VIS-WAFFLE-062 follow-up: single-value compact layout

**Status: Verified locally.** The single-value path also overflowed horizontally at 120px and lost its first cells/value text at 80px height. Preserved cell sizing and added reachable horizontal/vertical scrolling plus wrapping value text, matching the multi-segment layout policy.

**Evidence:** `evidence/waffle-single-before.json` reproduces the compact failures; `evidence/waffle-audit.json` now passes all 30 checks, including 12 single-value size/host combinations. Hosted acceptance of this latest single-value change remains pending.

## FORMAT-NUMBER-066 - Compact axis rounding hides distinct ticks

- **Area/category/severity:** Shared numeric axis formatter / Formatting / Medium.
- **Reproduce/input:** Render Line or Area with values 1,130 and an automatic tick range including 1,000 and 1,200. Also format 0.0001.
- **Expected:** Representative adjacent ticks remain distinguishable; small nonzero values are not labelled zero.
- **Actual:** 1,000 and 1,200 both display `1k`; 0.0001 displays `0` under default locale rounding.
- **Evidence:** `evidence/axis-number-service-before.png`; seven of ten new `tests/axis-number-format.test.js` cases fail before repair.
- **Root cause:** `ui/src/appspec/shared/formatters.js::fmtAxisNumber` uses whole thousands and the default three locale decimal places. Callers include linear/line/point primitives, Recharts fallbacks, and the copied Power BI helper.
- **Status:** Verified for the regression cases described below.
- **Fix/acceptance:** Retain compact units with up to six significant digits, preserving signs and finite-value guards. Data values and domains must remain unchanged. Retest caller suites and painted app/export labels.

## FORMAT-NUMBER-066 verification update

The shared formatter now retains up to six significant digits for compact units and small values. **Verified locally:** all ten dedicated unit cases pass (seven failed before), 218 related primitive/formatter/Power BI cases pass, and twelve native axis-label checks pass across Bar, Column, Line, Area, Scatter and Bubble with normal and tiny data. Evidence: `evidence/axis-number.json`, `evidence/axis-number-line-after.png`. Display precision remains finite; this is not an arbitrary-precision numeric formatter. Final hosted acceptance is pending.


### Final target verification for FORMAT-NUMBER-066 / FORMAT-AXIS-048

Latest app, standalone, Fabric and package builds pass. Service screenshot `service-page1.png` now shows distinct 1k/1.2k ticks. Compiled web/Fabric checks pass 86/86. Hosted Fabric uses the matching renderer hash and passes query, interaction, navigation and theme checks. Service independent-axis native selection evidence is retained in `service-independent-axis-interactions.json` (39 checks pass).

The local Bar/Line report passes nine production UI/save/export checks and seven PBIR schema checks. Normal Power BI Desktop launch visibly renders both visuals and the saved Returns axis (`local-secondary-desktop-render.png`). The initial diagnostic-flag launch stayed at the splash screen; normal retry succeeded. This proves the observed default render, not all Desktop interactions. A final local file is being regenerated with the newest numeric formatter package.

## FORMAT-AXIS-067 - Narrow dual-axis scrolling clips hover tooltips

- **Area/category/severity:** Line/Area independent axes / Interaction and clipping / Medium.
- **Reproduce:** Enable the new independent axis, narrow the visual to a 79px drawing viewport, and hover its first point.
- **Expected:** The tooltip remains readable; drawing scrollbars must not clip a legitimate popup.
- **Actual:** Tooltip bounds extend past the scrolling ancestor and are clipped.
- **Evidence:** `evidence/secondary-axis-tooltip-before.json` records the failing native check, after earlier axis-control and resize checks passed.
- **Root cause:** New drawing-width scroll container also contains ECharts' default HTML tooltip.
- **Fix in verification:** Append the tooltip to its own document body and clamp its position to that viewport, accounting for chart scaling and scroll position. Shared helper covers app and Power BI iframe; preserve formatter, visibility, data and domains. Maximum popup dimensions wrap/scroll within the document.
- **Status:** Verified in native app and hosted Service narrow-frame checks. `tests/secondary-axis.test.js` and native narrow hover checks cover the repair.

## FORMAT-PBI-068 - Exported series use generic measure labels

- **Area/category/severity:** Power BI primitive charts / Formatting and UX / Medium.
- **Reproduce/input:** Export Line/Area with Quantity Sold and Quantity Returned; hover a category. Repeat grouped/stacked bars with bound measures.
- **Expected:** Series/tooltip labels use bound display names unless the user explicitly overrides them; changing the binding updates the automatic label.
- **Actual:** Service tooltip reads Value / Secondary. `service-secondary-tooltip.json` preserves the observed text.
- **Root cause:** `renderPrimitiveChart` passes saved config directly to composers without the dynamic measure-name enrichment provided by Vilsem's canvas hosts.
- **Status:** Verified in production-runtime tests and hosted Service. Regression cases exercise production rendering with bound names, rebinding and explicit overrides in `tests/power-bi-selection-runtime.test.ts`.

### FORMATTING verification scope at end of latest builds

- FORMAT-AXIS-067: **Verified in native app and hosted Service**. `secondary-axis.json`: 87 checks, including live opt-in after initial chart creation. `service-secondary-tooltip.json`: Line and Area tooltips remain in a 96px iframe, with category select/clear preserved. App/standalone/Fabric/package builds and latest 86 compiled checks pass. The Desktop screenshots predate this specific hover-placement patch; they verify independent axes and numeric labels, not narrow Desktop tooltips.
- FORMAT-PBI-068: automatic bound display names are now supplied at the production renderer boundary; four failing-before/passing-after chart-family cases verify binding changes, explicit overrides, and unchanged input spec. Hosted label acceptance is underway.

### FORMAT-PBI-068 hosted verification

Verified with the latest package in Service: **22/22 checks pass** across Line, Area, Grouped Bar and Stacked Bar. Tooltips contain Quantity Sold / Quantity Returned, stay within the visual frame, and category selection/clear remain correct. Evidence: `evidence/service-measure-labels.json` and `service-native-*-tooltip.png`. Four production-runtime cases cover automatic labels, rebinding, explicit overrides and input-spec preservation. The label-only patch was not separately reopened in Desktop; Desktop's preceding axis/numeric/selection observations remain scoped to that prior exported package.


## VIS-WAFFLE-069 - Empty custom palette hides Waffle cells
- Area: Waffle; category: Rendering / Formatting; severity: Medium.
- Reproduce: save config.customColors=[] and bind multiple nonzero categories (1,2,3).
- Expected: absent custom colors use the default palette. Actual: all 100 cells have no background.
- Evidence: evidence/waffle-empty-palette-before.json, empty palette check FAIL (colored=0).
- Root cause: CompactWaffle.jsx treats an empty array as a valid palette and indexes modulo zero.
- Status: Verified in native Chromium using the production Power BI adapter and actual app component (30 checks PASS).
- Fix: absent/empty custom palettes use MULTI_COLORS. Regression: scripts/qa/powerbi-waffle.cjs, empty custom palette case. Hosted/Desktop screenshots from the pilot predate this fallback patch.


## UX-WAFFLE-070 - Waffle missing from chart library
- Area: Visual creation; category: UX / Functionality; severity: Medium.
- Reproduce: open a project, open Library, look for Waffle. Existing renderer cannot be created from this menu.
- Expected: supported Waffle renderer can be added through the library. Actual: hard-coded VISUAL_PALETTE omits it.
- Evidence: evidence/local-waffle-library-before.json (native UI creation timeout and captured menu text).
- Root cause: ui/src/pages/AppGenerator.jsx VISUAL_PALETTE. Status: Verified.
- Fix: add Waffle to the library. Regression: local-report-ui.cjs --waffle; native creation, binding, save/reopen and actual PBIP/PBIR export PASS (evidence/local-waffle-ui.json).


## DEP-FABRIC-071 - Generated Fabric project retains vulnerable tar lock entry
- Area: Fabric deployment tooling; category: Dependencies; severity: High.
- Reproduce: inspect generated QA project after ordinary npm install; npm ls tar resolves 7.5.16 under @microsoft/rayfin-tools-common 1.33.1 (~7.5.15).
- Expected: regenerate the compatible tar lock entry to a patched version before deployment. Actual: npm install preserves the vulnerable locked version.
- Evidence: evidence/fabric-dependencies-audit.json (one critical tar finding and other advisories). No exploit execution was attempted.
- Source: https://github.com/isaacs/node-tar/security/advisories/GHSA-23hp-3jrh-7fpw and https://github.com/isaacs/node-tar/security/advisories/GHSA-r292-9mhp-454m .
- Status: Verified for the generated-project tar dependency. npm update tar --ignore-scripts resolves 7.5.22; audit now has zero critical findings (43 others remain). Deployment prerequisite regression tests: 9 PASS. Hosted retry succeeded and portal bundle/query/interactions/theme checks passed; first upload fetch failure retained. Root dependencies and separate npx caches are outside this fix.


## VIS-CARDS-072 - Bullet and Progress crop large text in compact containers
- Area: Bullet / Progress; category: Clipping / Formatting; severity: High.
- Input: widths 80/160/480, heights 60/120/320, value fonts 28/60, long title and Revenue prefix / USD suffix.
- Expected: text wraps within width; all content remains reachable vertically. Actual: centered fixed-height content begins outside the top and/or ends outside the bottom; long text escapes horizontally.
- Evidence: dom-card-bounds-before.json: 26 of 36 native bundled-component cases fail.
- Root cause: CompactBullet.jsx and CompactProgressBar.jsx fixed-height centered flex layouts without scrolling/wrapping.
- Status: Verified in native Chromium against the bundled app components. Fix: wrapping text and scrollable minimum-height content, retaining fixed track height. Regression: scripts/qa/dom-card-bounds.cjs, 44 checks PASS. Hosted targets pending for this change.


## FORMAT-DOM-073 - Power BI repeats component titles beneath card header
- Area: Bullet / Progress Power BI adapter; category: Cross-target formatting; severity: Medium.
- Reproduce: export a titled Bullet or Progress; Power BI shows title in header and inside component while app/Fabric show it only in header.
- Expected: same title ownership and visibility as AppSpecRenderer. Actual: adapter forwards config.title/config.label unchanged.
- Evidence: service-dom-cards.png versus fabric-live-visuals-19-24.png.
- Root cause: AppSpecRenderer clears title/label in chartConfig; new DOM bridge adapter did not.
- Fix: clear component title/label after Power BI draws the shared header. Regression: six title ownership cases in powerbi-waffle.cjs. Status: Verified by six native title cases and actual Service title assertion (service-dom-title-final.json).


## INTERACTION-AXIS-074 - Alternate-axis siblings stay dim after switching away and back
- Visual / Area: Power BI legacy HTML category-axis switcher.
- Category: Interaction. Severity: Medium.
- Description: Switching axes resets the selected bar but retains opacity 0.35 on its siblings.
- Steps: Select a bar on an alternate axis, switch to the primary axis, then return.
- Input: Two axis sections; alternate section contains selected C and unselected D.
- Expected: Returning shows all bars at normal opacity with no stale local selection.
- Actual: D stays dim despite both bars being unselected.
- Evidence: docs/qa/evidence/axis-switch-state-before.json (one failing native DOM assertion).
- Root cause: wireAxisPills cleared only elements whose local-selected attribute was 1; dimmed siblings have value 0.
- Fix: Clear all elements carrying the local selection attribute in the hidden section.
- Regression: scripts/qa/axis-switch-state.cjs; two native Electron DOM checks pass in axis-switch-state.json.
- Status: Verified in native Electron DOM using the production Power BI class. Service deployment not tested for this change. Alternate-axis host cross-filter support remains open.


## VIS-TOOLTIP-075 - Legacy Power BI tooltip extends beyond frame
- Area: HTML visual hover tooltip. Category: Edge Clipping. Severity: Medium.
- Steps: Hover an 840-character category at either corner of a 386 x 197 viewport.
- Expected: Tooltip stays inside the sandbox viewport with literal content preserved.
- Actual: Tooltip reaches more than 4,000 pixels beyond the right edge.
- Evidence: powerbi-tooltip-bounds-before.json: four of six native cases fail.
- Root cause: nowrap content without maximum size; positioning only clamps minimum coordinates.
- Fix: Wrap long content, bound popup dimensions, clamp both coordinate limits.
- Regression: scripts/qa/powerbi-tooltip-bounds.cjs, six native Chromium bounds checks.
- Status: Partially tested. Frame containment verified; long overflowing content still needs an accessible hover/scroll interaction (legacy tooltip uses pointer-events:none). Hosted Service verification pending.


### VIS-TOOLTIP-075 interaction follow-up
- Added pointer interaction, a short cancellable exit grace period, focusability, and Escape dismissal. Tooltip content can now scroll; switching render modes/destroying the visual cancels pending dismissal and removes the body-level popup.
- Native regression now passes 10 checks: six containment/literal-content cases plus pointer-entry retention, focus/scroll capability, Escape dismissal and destruction cleanup.
- Corrected the synthetic Unicode test string to explicit Unicode escapes (the original shell-written file contained question marks).
- Scope: native DOM assertions, including programmatic focus and scroll; actual pointer travel/wheel and screen-reader workflows in Power BI Service remain untested. Full accessibility is not claimed.


## INTERACTION-LIFETIME-076 - Background clear handlers accumulate after legacy redraws
- Area: Power BI legacy HTML selection and fallback bar renderer.
- Category: Interaction / lifecycle. Severity: Medium.
- Steps: Render the legacy visual three times, then click its background once.
- Input: One category A with value 10; repeated rendering into the same root container.
- Expected: One host selection-clear request; none from a retired renderer after disposal.
- Actual: Three clear requests from one click, retaining closures over detached marks.
- Root cause: Both legacy render paths add an anonymous root click listener every render. Replacing child HTML does not remove root listeners.
- Evidence: Failing regression: expected one clear call, received three.
- Fix: Assign one owned root onclick handler and clear it at renderer disposal.
- Regression: tests/power-bi-selection-runtime.test.ts exercises both HTML and fallback bar repeated rendering, background clear, and disposal.
- Status: Verified through production-class runtime tests. Hosted acceptance remains pending.


## DATA-CARDS-077 - Stat Card and Metric Tile ignore error and empty input
- Area: Stat Card / Metric Tile. Category: Data / UX. Severity: High.
- Steps: Render either component with a failed query and previous rows, or with an empty row array.
- Input: error "QA connection unavailable" with stale value 98765; separately rows [].
- Expected: Existing shared error/empty state, while a valid value of zero remains a rendered result.
- Actual: Query error is ignored; stale values remain visible. Empty Metric Tile displays a zero-percent ring and Stat Card a normal value placeholder.
- Evidence: Four failing-before assertions in tests/scalar-card-states.test.jsx; legitimate zero assertions passed before and after.
- Root cause: Both components only checked loading and ignored their error prop and empty rows.
- Fix: Use shared EmptyState after loading, before value output. Preserve legitimate zero and existing formatting.
- Regression: Six component rendering assertions PASS. Native editor/viewer transport-state checks tracked in scalar-card-states.json.
- Status: Component tests verified; running-app acceptance being recorded separately.


## FORMAT-CARDS-078 - Editor duplicates Stat Card and Metric Tile titles
- Area: CanvasEditor / scalar cards. Category: Cross-host formatting. Severity: Medium.
- Steps: Create a titled Stat Card or Metric Tile; compare editor and viewer.
- Expected: One shared title in both hosts, retaining value and comparison formatting.
- Actual: Editor includes both shared header and component caption; viewer only has the header.
- Evidence: scalar-card-states-before-title.json records duplicate text for editor standard/zero cases.
- Root cause: CanvasEditor forwarded title/label to both cards after drawing the common header.
- Fix: Clear component title/label for these two types only; authored config remains intact.
- Regression: Native scalar-card-states.cjs asserts one title across both hosts and error/standard/zero states.
- Status: Running-app verification in progress; other visual title contracts are not changed by this fix.


### DATA-CARDS-077 / FORMAT-CARDS-078 verification
- 24 native editor/viewer checks PASS: query-error/standard/zero states and single-title ownership for both visual types. Evidence: scalar-card-states.json.
- Both issues VERIFIED within the app editor/viewer and component-test scope. Fabric and export artifacts were not deployed in this cycle.

## DATA-STAT-079 - Missing current value fabricates comparison
- Area: Stat Card. Category: Data correctness. Severity: High.
- Steps: Render current value null or undefined with previous value 100.
- Expected: Missing-value placeholder without a comparison percentage. A legitimate current zero must still show a 100 percent decrease.
- Actual: null produces a fabricated 100 percent decrease; undefined produces NaN comparison.
- Root cause: Trend calculation checked only previous value, allowing coercion of missing current values.
- Fix: Require a present current value before computing trend. Existing comparison calculation unchanged for valid data.
- Regression: tests/scalar-card-states.test.jsx: missing null/undefined and legitimate zero assertions. All nine scalar component checks PASS.
- Evidence: scalar-card-null.json, two native editor/viewer checks PASS; before-fix assertions retained in unit-before-null-comparison-fix.json.
- Status: VERIFIED in component tests and running editor/viewer. No hosted deployment acceptance claimed.


## INTERACTION-AXIS-080 - Alternate-axis local selection ignores modifiers
- Area: Legacy Power BI axis-switch bars. Category: Interaction. Severity: Medium.
- Steps: Select A on an alternate axis, then Ctrl-click or Command-click B.
- Expected: Both stay locally selected; modifier-click removes one; removing the last restores all opacity. Plain click replaces selection and repeated plain click clears it.
- Actual: B replaces A even with the modifier; multi-selection cannot be created.
- Root cause: Modifier value is read but ignored by the local fallback path.
- Fix: Track the selected sibling set, apply modifier toggle or plain replacement, and derive dimming from the resulting set.
- Regression: Two failing-before modifier scenarios in power-bi-selection-runtime.test.ts; all 28 selection runtime checks pass after fix.
- Status: Verified through production-class runtime tests. This only fixes local highlighting; alternate-axis host cross-filtering and native-slicer acceptance remain open.


### Alternate-axis cross-filter implementation checkpoint
- Status: Investigating / partially implemented, not Verified.
- Legacy renderer can now route bound alternate categories through field-specific Selection IDs. Test coverage includes duplicate category labels across different fields, absent/ambiguous bindings, modifier preservation and selected opacity.
- 41 focused selection/parity tests PASS, renderer lint PASS. No capabilities or export bindings changed yet.
- Exporter still omits alternate-axis fields; enabling fields indiscriminately risks changing distinct-count/ratio measure semantics. Independent per-axis query design and hosted slicer verification remain required.
- The former failing source-string test demanded applyJsonFilter specifically; replaced with supported bound-Selection-API contract and runtime checks. This does not close the broader functionality gap.


## MCP-SCHEMA-001 - Desktop engine identities and field-parameter samples
- Visual / Area: MCP model schema discovery.
- Category / Severity: Data / Medium.
- Description: get_schema attempted VALUES queries for unqueryable engine RowNumber columns and composite-key field-parameter display columns.
- Steps / Input: Open AdventureWorks PBIP in Desktop; connect_model with kind desktop and no port; call get_schema. The model has 13 tables, 39 measures, 96 columns, 13 internal row identities and two field-parameter display columns.
- Expected: Return useful typed schema with bounded real samples, explicitly skip engine-only identities, and handle parameter display columns.
- Actual: 15 sampleError entries in the first live run.
- Evidence: Private MCP test-results/live-desktop-v020/02-get_schema.json; patched-schema-summary.json; fresh GitHub v0.2.1 stdio retest under live-desktop-v021.
- Root cause: D:/vilsem-mcp/src/models.ts assumed every DMV column supported VALUES over a single column.
- Status: Verified (live and automated).
- Fix: Explicit RowNumber sampleSkipped metadata; composite-key fallback to bounded SELECTCOLUMNS/TOPN row projection, keeping data types and limiting distinct returned samples. No model changes.
- Regression: MCP tests/server.test.ts, skips engine row identities and samples field-parameter composite keys through row projection. Live retests returned zero sampling failures; MCP suite 30 passed.

## AUTH-REA-001 - Microsoft reauthentication did not resolve after redirect
- Visual / Area: Electron Microsoft account reauthentication.
- Category / Severity: Authentication / High.
- Description: The handler claimed settled=true before closing the login window, then called a settle function that refused to resolve an already-claimed request.
- Steps / Input: Invoke reauth-microsoft; deliver a valid Microsoft redirect and token response. Window close callback fires before the exchange completes.
- Expected: Update the active workspace tokens and resolve success; return a clear failure or cancellation when appropriate.
- Actual: The promise could remain pending after token exchange.
- Evidence / Root cause: electron/ipc/connection.js reauth-microsoft callback; extracted and covered with fake browser-window lifecycle events.
- Status: Verified (automated); real browser sign-in not performed in this cycle.
- Fix: Protocol/PKCE/state/code exchange now resides in core createMicrosoftLogin; Electron owns only the browser lifecycle and resolves the claimed callback directly. Refresh retains the original public Microsoft client/common authority when switching from SP credentials.
- Regression: tests/core-microsoft-ui.test.js success/failure/cancel for both login handlers; packages/core/src/connect/microsoft.test.ts protocol and workspace-switch refresh; tests/core-auth-route.test.js preserves AUTH_FAILED response classification.
## EXP-FMT-001 - Declarative relational and ordered data could not be expressed
- Visual / Area: Sankey, Gantt, waterfall, sunburst, small multiples, network; core template resolver.
- Category / Severity: Architecture / High.
- Description: Templates could only calculate one row at a time, shape two category fields, and use a small formatter allowlist. Required links, trees, dates, ordered totals and facets failed validation.
- Steps / Input: Author the expressiveness templates; bind the existing sample-model fields listed in docs/expressiveness-gaps.md; call validate_spec, explain_visual and preview_visual.
- Expected: Resolve supported native chart structures from real fields without caller code.
- Actual: Exact initial errors include `each transform needs a string "calculate" and an "as" name`, the third-dimension rejection and unknown label/date formatters.
- Evidence / Root cause: Core instantiate.js shapeSlots/applyTransforms/validateTemplate; ignored MCP expressiveness baseline tool outputs.
- Status: Verified (automated and real-data MCP preview); Desktop acceptance recorded in the expressiveness report.
- Fix: Six category slots; date/take/window/links/hierarchy/facet transforms; bounded repeat; explicit nullable annotation handling; native chart module registration. No imperative custom callback added.
- Regression: tests/expressiveness.test.js; MCP tests/expressiveness.test.ts; all older template tests remain enabled.

## EXP-HOST-002 - Template renderer discarded additional category bindings
- Visual / Area: Renderer buildRowsFromDataView; multi-level templates.
- Category / Severity: Data / High.
- Steps / Input: Deliver categorical data with three category columns and resolve a three-level sunburst or task/start/end Gantt.
- Expected: All bound category levels reach core in the same order as preview normalization; transformed selection maps back to source rows.
- Actual: Renderer emitted only _cat; preview's _cats was absent. Additional bindings could not reach template slots.
- Evidence / Root cause: vilsem-renderer/src/visual.ts buildRowsFromDataView and selection routing.
- Status: Verified (automated); live rendered acceptance is recorded separately.
- Fix: Carry _cats, _cat2 and _sourceIndex; map transformed rowIndexes after ordering. Aggregate selections send all contributing identities.
- Regression: tests/power-bi-selection-runtime.test.ts (six-level row boundary and sorted aggregate selection/tooltip identity cases); core hierarchy/link tests.

## EXP-REF-003 - Missing reference measure crashed empty-data preview
- Visual / Area: Bullet and dual-axis templates; markLine.
- Category / Severity: Rendering / High.
- Steps / Input: previewRows on the shipped bullet or dual-axis spec with no rows / a null target.
- Expected: No reference line when its measure is absent; no invented zero and no exception.
- Actual: ECharts reported invalid markLine data and `Cannot read properties of undefined (reading 'coord')`.
- Evidence / Root cause: Empty scalar tokens resolved to null annotation coordinates in instantiateVisual.
- Status: Verified (automated).
- Fix: Omit markLine records with missing coordinate tokens while preserving configured styles and real reference values.
- Regression: Core empty-reference test; MCP shipped-template empty-data previews for all nine specs.

## EXP-THEME-004 - Explicit template backgrounds were overridden in Desktop
- Visual / Area: All dark templates on a white native report page.
- Category / Severity: Rendering / High.
- Steps / Input: Preview a dark template with backgroundColor=$theme.background; commit it to the Expressiveness page with plain card chrome; reload Desktop.
- Expected: Explicit template background survives; text/axes retain preview contrast independently of the report theme.
- Actual: The renderer unconditionally forced transparent, leaving pale labels on white despite a dark preview.
- Evidence / Root cause: Actual Desktop gallery captured before the fix; renderPrimitiveChart background override.
- Status: Verified (automated); final live acceptance tracked in docs/expressiveness-gaps.md.
- Fix: Honor an explicit background for templates; keep legacy composition transparency unchanged. Shipped examples explicitly request their theme background.
- Regression: Renderer harness background/legacy-transparency test, plus real Desktop gallery acceptance.

## EXP-DOMAIN-005 - Authored reference line was above the automatic profit domain
- Visual / Area: Expressiveness dual-axis template in vilsem-mcp.
- Category / Severity: Rendering / Medium.
- Steps / Input: Bind monthly Total Revenue, Total Profit and Profit Target; preview and commit the scratch dual-axis spec with the profit axis left on automatic extent.
- Expected: The reference measure remains visible on its own axis, including when it exceeds every plotted profit value.
- Actual: Target 825,829.77 exceeded the automatically selected 800,000 maximum; the markLine existed in the option but was outside the visible plot.
- Evidence / Root cause: Native Desktop before/after captures, desktop-dual-axis-check.png / desktop-dual-axis-fixed.png in ignored expressiveness evidence. The initial authored skeleton omitted a domain contribution from its unplotted reference measure.
- Status: Verified (automated and actual Desktop).
- Fix: Compose existing calculate `max(profit,target)*1.1` and bind its maximum to the profit axis. This is expressible in the existing arithmetic format; no custom callback or new core operation was needed.
- Regression: vilsem-mcp/tests/expressiveness.test.ts checks the derived bound, retained reference coordinate and SVG reference label. Final native Desktop capture shows the target line at 825,829.77.
