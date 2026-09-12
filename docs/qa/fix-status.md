# Verified fixes and remaining work

Updated 2026-09-07 after the user requested checking all visuals and proceeding. This supersedes the earlier audit's “no product changes” status. Original before-fix evidence remains available.

## Detailed formatting expansion

See [the per-visual formatting plan](detailed-formatting-plan.md) for the complete 41-type target and the implemented first five visual expansions. The latest control-level evidence is `evidence/detailed-formatting.json`; DOM-change and remount checks are narrower than visual approval or disk persistence testing. Previous unresolved findings remain open.

## Latest readability expansion verification

Axis controls now include separate fonts, maximum width, overflow and overlap suppression.520/520 Electron checks,165/165 pane checks,4/4 long-label review checks; unit suite457passed/4existing failures. All three builds passed. See detailed-formatting-plan.md for exact scope and pending acceptance.

## Latest axis expansion verification

Independent X/Y label controls:312/312 Electron assertions across13 built-in types and both hosts; all41 pane checks165/165. Unit suite456passed/4existing failures. Main UI, standalone and Fabric builds passed. Bar Race reset bug FORMAT-AXIS-008 verified. Extreme combinations and remaining formatting families remain open.

## Latest remaining-work pass

Bullet bounds6/6; detailed formatting152/152; value formatting98/98; native interactions16/16; production contract pipeline16pass/2open AI config failures. Full unit suite465pass/1open Power BI secondary-axis cross-filter failure. Three obsolete baseline assertions replaced with exact position and identifier stability/collision assertions. All three builds pass. See [remaining work](remaining-work.md) and bug-log.md for scope; the full audit is not complete.

## Latest pane consistency pass

SETTINGS-002 verified:42/42 moved-control checks,165/165 pane checks across41 visuals,40/40 legend and98/98 value-format checks. Full suite467pass/1existing failure; main UI build passes. Current all-visual organization is recorded in settings-feature-map.md. Overall per-feature acceptance remains incomplete.

## Latest full local round

See [full-round-report.md](full-round-report.md): Present7/7, Visual Playground30/30, query Playground3/3, built web/Fabric82/82 smoke checks, authoring10/10, interactions16/16, data299/299. Unit470pass/1existing Power BI failure. Three repairs verified; cloud publication and exhaustive feature parity remain unverified.

## Verification results

| Check | Result | Evidence |
|---|---|---|
| Full Vitest suite | **450 passed, 4 failed / 454** | evidence/fixed-suite.json; only the four original baseline failures remain |
| Focused regression tests | **22 passed / 22** | qa-audit-regressions, project-name-collision, dimension-table-query, narrative-comparison |
| All-visual field changes | **299 passed / 299**, no console errors | evidence/data-audit-after.json; 41 types, editor and viewer; synthetic transport |
| Focused renderer transitions | **52 passed / 52**, no unexpected console errors | evidence/visual-fix-regressions.json; explicit query-error injections retained separately |
| Home rename + actual IPC/storage | **3 passed / 3** | evidence/persistence-ui.json; fresh disk profile |
| AppGenerator authoring | **10 passed / 10** | evidence/product-audit-after.json; synthetic query/save/provider adapters |
| Native interactions | **11 passed, 1 failed / 12** | evidence/interaction-audit-after.json; remaining Ctrl-click multi-selection support gap |
| AI/persistence contracts | **11 passed, 4 failed / 15** | evidence/contract-audit-after.json; remaining config type/key and patch removal/sequencing failures |
| Desktop bundle | **PASS**, 50.49s | cache/qa-build/ui-after; 2,262.77 kB main JS, existing bundle warnings |
| Standalone/Fabric bundles | **PASS**, 28.26s / 23.15s | cache/qa-build/standalone-after and fabric-embed-after |
| All-visual data/resize rerun | **1,230 cases completed**, no unexpected console errors | evidence/edge-audit-after.json; 36 intentional query-error logs; 164 text-clipping candidates remain for review |

Screenshot and property acceptance are not implied by a successful mount or state update. After-fix Area, Stacked Area, Heatmap and Narrative screenshots were visually reviewed. The remaining clipping candidates are not relabeled as passing.

## VERIFIED issues

| IDs | Smallest implemented change | Verification scope |
|---|---|---|
| PERSIST-001 | Reject rename collisions in the same dataset; refuse ambiguous legacy-name saves; keep rename dialog open with actionable error | Production SQL, reload and Home → real IPC → isolated database; same name across datasets still works |
| DATA-EDITOR-001 | Query guard includes complete data configuration, type and effective drill/axis inputs | All 36 data-bound types in both hosts; replace/filter/remove/restore |
| DATA-ERROR-001 | Editor propagates query errors; viewer keeps authored cards and positions on empty/error | Production host empty/error/recovery tests; query error is displayed rather than concealed |
| VIS-LINE-001 | All line-wrapper hooks run before conditional state rendering | Line, Area, Stacked Area and Bump transitions in both hosts |
| VIS-AREA-001 | Dedicated registry adapter supplies Area mode while preserving explicit chartType overrides | Actual host series options |
| VIS-STACKED-AREA-001 | Forward stacked config to LineMarks | Both series share stack total; explicit disabling still works |
| VIS-FUNNEL-001 | Remove invented demo rows; use shared empty/error states | Empty/error/zero/populated cases in both hosts |
| VIS-RACE-001 | Clear the always-mounted chart on empty/loading/error | All-visual measure-removal regression |
| VIS-GAUGE-001 | Show empty state instead of a zero gauge; keep size-observer root mounted across states | Empty state in both hosts; valid zero data still belongs to the populated path |
| VIS-TABLE-001 | Preserve dimension-only tables; query with empty measure arrays; sort DAX by dimensions; remove phantom value column | Production query handler with intercepted Fabric transport, real DAX builder, normalized layout and both mounted hosts; live Fabric acceptance untested |
| SPEC-CUSTOM-001 | Accept custom registry type and validate referenced/inline template using existing validator | Production schema assertion and custom runtime fixtures |
| SPEC-SLICER-001, AI-SLICER-001 | Align allowed multi_select type in schema and AI sanitizer | Schema and actual validate/apply/sanitize/reflow pipeline |
| SPEC-INPUT-001/002 | Validate element shape before dereference; apply slicer validation to nested pages | Malformed-null and invalid nested-page regression assertions |
| FILTER-001 | Keep excluded slicer keys out of the generic filter pass; honor mark-source behavior | Production filter-function tests; native unrelated cross-filter remains passing |
| LAYOUT-001 | Wrap KPI overflow to later rows with positive widths | Fourteen-card regression; broader compact-card readability remains a product concern |
| LAYOUT-DRAG-001 | Clamp dragged X to available width before persistence | Native 1,500px drag and resize |
| TOOLTIP-001 | Encode category, series name and formatted value text in HTML formatter | Production formatter and native tooltip path; not a complete security certification |
| VIS-HEATMAP-001 | Fit row and column tracks to available content dimensions instead of width-driven square cells | All four default marks measured within both host bounds; tiny/dense label policy remains under review |
| VIS-NARRATIVE-001 | Name the actual compared measure, handle zero denominator, avoid claiming first row is top-ranked | Three production-component tests and both host text assertions; explicit authored text preserved |

## Open work

- P2 AI patch removal, sequential operations and config type/key validation remain reproducible failures.
- Ctrl-click multi-selection is still unsupported in the tested desktop interaction path; no undocumented behavior was invented.
- Title-weight parity and Sunburst/Column/Waterfall label clipping remain open.
- The four baseline tests still fail: two Power BI layout expectations, an axis-switch source-text assertion, and a TMDL name assertion. No assertions were weakened to make the suite green.
- Full conditional-property semantics, every role combination, active rich-text editing, accessibility/performance, live Fabric/cloud AI, installer/publish and approved screenshot baselines remain incomplete.
- Viewer now retains empty/error cards; this deliberately changes the old auto-hide behavior so filters and failures cannot silently remove authored content. The editor and viewer share the same visible-state expectation.
- Saved project names remain the legacy save lookup. Collision protection closes the reproduced overwrite; a broader stable-ID save migration is deferred, and previously overwritten content is not reconstructed.

Use the before/after artifacts together. Original audit reports are historical findings, not current fix status. No production credentials or client data were accessed.


### Subsequent consistency work: chart headers
FORMAT-TITLE-002 aligns explicit title font family, size, weight, color and uppercase across shared chart headers. Existing defaults are retained. See [title evidence](evidence/title-consistency.json) and run `node scripts/qa/launch-audit.cjs --titles`. The focused 52 runtime regressions pass; unit results remain 450 passed / 4 baseline failures ([report](evidence/title-suite.json)). Other visual formatting and clipping gaps remain open; this change does not certify every property or renderer.


### Visibility and text-box follow-up
See [per-visual visibility status](visibility-status.md) and [screenshot gallery](visibility-gallery.html). Fresh before/after sweeps completed1230 cases each; DOM clipping candidates164?156, still requiring review. TEXT-FORMAT-001, TEXT-CLIP-001, VIS-COLUMN-001, VIS-WATERFALL-001 and VIS-SUNBURST-001 are locally verified for their reproduced scenarios. Text checks24/24; targeted clipping6/6; existing runtime52/52; field changes299/299; unit450pass/4baselinefail; native interactions11pass/1knownfail. UI build passed. Full visual/property acceptance remains incomplete.

Final focused additions: NAV-LABEL-001, TEXT-FONT-002 and TEXT-TOKEN-002 verified. Active toolbar50/50 (all offered fonts/sizes plus partial selection/live-token reopening), separate text24/24, navigation3/3. Final unit results remain450pass/4baselinefail. The1230-case sweep predates these last three focused repairs; see visibility-status.md for boundaries.

Final main UI, standalone and Fabric embed builds all passed in isolated cache/qa-build/*-visibility-final outputs (25.93s /22.00s /17.54s). Existing chunk-size/toolchain warnings remain. No installer was built.


### Formatting controls follow-up
See [format control status](format-control-status.md) and [per-control matrix](control-acceptance-matrix.csv). Four reproduced issues repaired;326 applicable semantic assertions pass,126 applicability exclusions are not passes. Every exposed setting remains the acceptance target; the inventory is not a full-test claim.

Final verification:455 unit tests pass, same4 baseline failures (`evidence/format-final-suite.json`). Main UI/standalone/Fabric builds passed in isolated cache/qa-build/*-format-final outputs (54.51s/46.65s/39.54s); existing toolchain/chunk warnings remain. Source diff whitespace and new QA script syntax checks passed. Current control CSV links97 visual/config pairs to tested values, marks63 for applicability review and1955 pending consolidation; these are control-pair counts, not runtime assertion counts or overall product approval.


### Settings pane standardization
Reviewed all41 panes and added settings-feature-map.md. Shared applicability rules hide unrelated axes/grid/labels/gradients and KPI-only features. Gauge/Progress registered schemas are now reachable; text-box formatting moved to Text with a Style navigation button. Dead header paint controls removed from UI only; saved config unchanged. Title-layout applicability and font placeholders corrected. Rich-text50/50, text-box24/24 and schema22/22 checks pass. All-feature certification remains incomplete; see the map's explicit gaps.

Final verification:165/165 pane assertions across41 types,22/22 schema-control assertions,98/98 value formatting assertions,50/50 rich-text and24/24 text-box checks,10/10 authoring workflows. Unit suite455passed/4existing failures; main UI build passed (34.27s, existing toolchain/chunk warnings). Text-tab screenshot visually inspected; additional pane screenshots saved in evidence/screenshots/*-settings-*.png. Initial root-directory build used the wrong config and was not counted; subsequent builds ran from ui. Source whitespace and QA script syntax checks passed. Full per-feature acceptance remains open as detailed above.


### Playground usability round - 2026-09-07
- Inspected current Playground layout/save flow and remaining product backlog. Logged UX-PLAYGROUND-014 before runtime verification.
- Improved narrow-window pane layout, toolbar wrapping, keyboard focus indication, editor accessible name and announced save state. Prevent concurrent saves and false success when persistence is absent.
- Electron playground-round:37/37, all14 starters plus save fault/retry and640/900/1500px pane bounds; zero captured console errors. First sizing test timed out because outer window size differs from content size; corrected harness to setContentSize and retained playground-ux-first-run.json.
- UI production build passed16.36s in cache/qa-build/playground-ux. Existing CJS/module metadata, Browserslist freshness and bundle-size warnings remain.
- Added product-experience-plan.md with guided setup, discoverable formatting, recoverable editing and export acceptance priorities.
- Limits: no live provider/cloud publish, actual library disk roundtrip, comprehensive keyboard/short-height or pixel equivalence verification this round. Full unit suite not rerun for these localized JSX/layout changes.
