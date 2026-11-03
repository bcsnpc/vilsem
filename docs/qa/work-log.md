# Audit work log

## 2026-09-07 — All-visual follow-up and verified repairs

- User requested checking all visuals and proceeding. Added field-change coverage for all 41 registry IDs in both hosts: before fixes 225/299 passed; after fixes 299/299 pass with no console errors. Corrected removal assertion to allow empty series containers while rejecting stale data.
- Reproduced project rename overwrite with failing storage assertions, then prevented same-dataset collisions/ambiguous legacy saves. Verified Home error/retry and save through real IPC and an isolated disk database (3/3).
- Fixed shared editor invalidation, line hooks/Area/stack forwarding, Funnel demo fallback, hidden viewer errors, editor error propagation, Bar Race stale canvas, Gauge empty state, dimension-only table backend/layout/rendering, template/slicer validation, filter scope, positive KPI/drag bounds, tooltip text, Heatmap cells and Narrative comparison language.
- New failures during focused runtime tests exposed error concealment and stale empty-state rendering; logged before correcting. One test run was interrupted by hot reload during active edits; final runs used frozen product code and stable geometry.
- Verification: 22/22 focused unit assertions; full suite 450/454 (only four original failures). Focused runtime 52/52; authoring 10/10; native interactions 11/12 (Ctrl-click gap); AI/persistence contracts 11/15 (four unresolved patch/config issues).
- Reran 1,230 data/size cases after fixes. Only 36 intentionally injected query errors were logged; no unexpected runtime errors. 164 text-clipping candidates remain. Reviewed after-fix Area/Stacked Area/Heatmap/Narrative screenshots.
- Desktop, standalone and Fabric bundles passed into isolated cache outputs (50.49s, 28.26s, 23.15s). Existing dist/pbiviz/user scratch changes preserved.
- Updated individual bug records and fix-status.md with verification scope. Remaining: title/label clipping, AI operation validation, Ctrl-click support, four baseline failures, full conditional formatting/role/native coverage, live services, installer/publish, accessibility/performance and approved pixel baselines.

## 2026-09-07 — Full audit continuation

- Completed 5,178 inspector probes, 82 default host mounts, 22 host workflows; exported property-level evidence. Retested all 72 invalid Hex probes with valid values: 72 state updates. Documented fingerprint omissions and incomplete conditional/rich-text coverage.
- Completed 1,230 unique v3 data/size cases, after correcting ResizeObserver timing and disabling native window-occlusion throttling. Preserved earlier diagnostic reports with explicit supersession. Found 164 text-clipping candidates; reviewed all 41 standard editor screenshots.
- Reproduced Heatmap mark clipping and Sunburst label clipping with settled geometry/animation evidence. Traced dropped Stacked Area flag, Column/Waterfall label clipping and misleading Narrative comparison semantics. Added dedicated finding records.
- Native interaction audit: 9 passes, 3 failures; 28 custom-template host renders. Production AppGenerator audit: 10 passes covering create/duplicate/delete/bind/save/reopen/AI response/page creation/multi-page save with synthetic transports. Real sql.js persistence tested separately.
- Full Vitest: 432 passed, 12 failed / 444; eight new exposed defects plus four baseline failures. No tests skipped or failures relabeled as success. No product fixes applied.
- Added current full report, runtime matrix, property/AI contract CSVs, coverage limitations, clipping review, schema/filter and visual findings. Updated README's inaccurate no-local-data-copy claim to describe actual caching.
- Remaining acceptance: every conditional/property value with a semantic assertion, active rich text, all per-type native interactions, live model/provider, installer/publishing, accessibility/performance, approved screenshot baselines and prioritized fixes. Current documentation marks these gaps explicitly.

- User authorized full audit. Added mounted CanvasEditor/AppSpecRenderer/VisualInspector harness with deterministic query transport and per-control state/render fingerprint checks.
- Probe confirmed editor stale data on measure/filter change; viewer re-queries. Started all-type property enumeration across default/expanded configuration and style/text/layout tabs.
- Ran 15 production contract/persistence checks: 9 pass, 6 fail; 223 AI schema-field preservation/hint checks collected. Found rename collision overwrite, multi-select sanitizer downgrade, rejected measure removal/sequential patches, unvalidated config types/keys.
- Resolved packaging precedence using installed builder: package.json.build wins by default, excludes .env. Explicit legacy YAML remains risky; default release concern downgraded.
- Logged new issues immediately in full-audit-findings.md. Product code unchanged.

## 2026-09-07 — Initial investigation

- Inspected repository state, README, package/build files, Electron main/preload/IPC, React entry/router, authoring and rendering hosts, spec validation/editing, registry, primitives, defaults, filtering, row normalization, persistence and AI patch path.
- No AGENTS.md found in the repository scan. Existing generated-file modifications and user scratch files preserved; credentials and client datasets not read.
- Established 41 registry IDs, mixed rendering engines, and historical architecture documentation that predates current implementation.
- Started Vite via `npm.cmd run ui:dev`. `npm` initially failed because PowerShell execution policy blocks npm.ps1; npm.cmd succeeds without changing policy.
- Ran baseline Vitest suite: 428 passed / 4 failed. Repeated with JSON reporter to retain complete evidence after console truncation.
- Added isolated Electron startup and synthetic renderer audit entry points. Desktop sign-in and Service Principal tab exercised; screenshots saved under evidence. No live authentication performed.
- Executed 369 synthetic leaf-renderer cases; captured React hook-order failures on line-family data transitions, empty Funnel demo data, schema rejection of custom and dimension-only table normalization loss. Refined harness to capture transient console errors, inject correct area type, custom template and race row shapes.
- Logged unresolved bugs and packaging investigation before product changes. No visualization or state-management fixes performed.
- Production UI build checked with output redirected into cache/qa-build to preserve existing generated files. See regression-status.md for final command outcomes.
- Remaining: complete UI property coverage, host interaction/persistence testing, live model/AI flows, visual screenshot review, release configuration verification and prioritized fixes.
- Final baseline artifacts: architecture/product flow, all-ID visual inventory with 14 custom starters, primitive architecture, consistency/AI discovery matrices, per-visual test matrix, property discovery CSV, bugs/enhancements/priorities, engineering issues/conventions and initial report. README links current evidence and flags unresolved defects.
- Final renderer harness exits 1 with 33 captured console error events; 369 scenarios were executed. No product bugs fixed. Desktop/standalone/Fabric bundle checks all passed; installer not built.


### Visual consistency follow-up ? chart title typography
- Traced the inspector's titleFontFamily/titleFontSize/titleFontWeight/titleColor/titleUppercase writes through four independently styled host headers.
- Logged FORMAT-TITLE-002 before editing. Added shared chartTitleStyle; editor and all three viewer header branches now consume it. Preserved unset 12px/600/inherited-family/theme-color defaults and existing single-line ellipsis. No query, selection, field, or numeric-format logic changed.
- Added scripts/qa/title-consistency.cjs (`node scripts/qa/launch-audit.cjs --titles`), using native Electron computed styles over every registered type in editor/freeform viewer. Series values are checked separately from names, because changing radar's title intentionally updates its series name.
- Focused existing runtime regressions: 52/52 pass. Full unit suite: 450 pass, same four baseline failures (title-suite.json).
- Scope remaining: section/grid branches share the helper but were not separately mounted by this test; internal renderer typography, title positioning/alignment, inspector default discrepancies, axis/legend/value formats and clipping still need semantic verification. This is not full visual consistency certification.


### Full visibility follow-up and text-box defects
- Ran fresh 1,230-case before and after visibility sweeps across all41 types and both hosts. Reviewed all82 standard screenshots via contact sheets; animation-incomplete Sunburst baseline superseded by settled captures. DOM candidate count164?156; no unexpected console failures (36 intentionally injected query errors). Candidates are not automatically bugs or passes.
- Reproduced text-size CSS-mode defect and long-text loss using actual editing/inspector controls and direct computed geometry. Fixed narrowly; 24 dedicated assertions pass, including mixed-style reopening and base formatting.
- Reproduced column canvas label y=-6, waterfall label/header intrusion and Sunburst SVG label escape. Fixed label layout; six targeted checks pass and after screenshots visually inspected. Numeric data/domain logic preserved.
- Existing focused runtime52/52 and field-change299/299 pass. Native interaction11/12 (known Ctrl multi-select failure). Full unit450/454 (same four baseline failures). UI build passed with existing warnings.
- Added visibility-status.md, visibility-gallery.html, reproducible scripts and separate immutable before/after evidence. Logged viewer card-caption loss and boundary-point investigation. Navigation label failure found through screenshot parity, dedicated test reproduces it.
- Remaining:156 DOM candidate cases require classification; all formatting/selection/token/undo combinations and dense/tiny visual approval remain incomplete. No blanket visual certification.

- Extended active inspector testing to every font/size choice: found and fixed Source Serif 4 rejection (unquoted font-family) and inserted value remaining unresolved during editing (stale saved-HTML query dependencies). Final active toolbar50/50, separate text24/24, navigation3/3. Added partial-selection preservation and committed token reopening assertions. NAV-LABEL-001 fixed by preserving only navigation content label in viewer config; title deduplication remains unchanged. Title assertions remain240pass plus2 exclusions. Broad sweep predates these three focused fixes; documented explicitly.

Final main UI, standalone and Fabric embed builds all passed in isolated cache/qa-build/*-visibility-final outputs (25.93s /22.00s /17.54s). Existing chunk-size/toolchain warnings remain. No installer was built.


### Color, format and text-control semantic testing
- Catalogued2115 visual/config pairs and148 keys from inspector discovery; added per-control acceptance CSV with explicit pending/applicability states.
- Traced actual inspector axis/legend writes to ECharts options; reproduced78 axis failures plus4 editor legend failures. Shared axis typography forwarding and memo dependency fixes preserve renderer defaults and data.
- Expanded value tests to actual inspector inputs and DOM/canvas oracles; reproduced26 typography failures across affected cards. Corrected font/color/weight forwarding, including gauge primitive typing. All98 checks now pass.
- Tested every offered legend position and show/hide; found Pie/Donut top mapping missing. Added schema/type/layout support and protected slice values in unit test. All40 checks pass; top donut screenshot inspected.
- Final axis/legend apply/reset sweep:188 applicable pass,126 exclusions; no console errors. Value98/98 and legend40/40 pass. Existing runtime52/52 and field-change299/299 rerun after initial repairs. Unit/build completion recorded below.
- Corrected harness-only issues (unavailable Georgia select option, DOM-only gauge text, overly strict zero-pixel legend offset); final artifacts supersede incomplete probes. No broad rewrite, no client data changes.

Final verification:455 unit tests pass, same4 baseline failures (`evidence/format-final-suite.json`). Main UI/standalone/Fabric builds passed in isolated cache/qa-build/*-format-final outputs (54.51s/46.65s/39.54s); existing toolchain/chunk warnings remain. Source diff whitespace and new QA script syntax checks passed. Current control CSV links97 visual/config pairs to tested values, marks63 for applicability review and1955 pending consolidation; these are control-pair counts, not runtime assertion counts or overall product approval.


### Settings pane standardization
Reviewed all41 panes and added settings-feature-map.md. Shared applicability rules hide unrelated axes/grid/labels/gradients and KPI-only features. Gauge/Progress registered schemas are now reachable; text-box formatting moved to Text with a Style navigation button. Dead header paint controls removed from UI only; saved config unchanged. Title-layout applicability and font placeholders corrected. Rich-text50/50, text-box24/24 and schema22/22 checks pass. All-feature certification remains incomplete; see the map's explicit gaps.

Final verification:165/165 pane assertions across41 types,22/22 schema-control assertions,98/98 value formatting assertions,50/50 rich-text and24/24 text-box checks,10/10 authoring workflows. Unit suite455passed/4existing failures; main UI build passed (34.27s, existing toolchain/chunk warnings). Text-tab screenshot visually inspected; additional pane screenshots saved in evidence/screenshots/*-settings-*.png. Initial root-directory build used the wrong config and was not counted; subsequent builds ran from ui. Source whitespace and QA script syntax checks passed. Full per-feature acceptance remains open as detailed above.


### Detailed per-visual formatting expansion
- Added a 41-type formatting target in detailed-formatting-plan.md, explicitly separating planned depth from implemented controls.
- Added/exposed 38 descriptors across Bullet (9), Metric Tile (10), Stat Card (9), Progress (6) and Text Box (4). Wired ring/marker/fill/track/comparison/subtitle/paragraph styles while preserving defaults. Typography descriptors use the Text tab; geometry and paint use Style. Optional Bullet numeric fields clear to automatic calculation.
- Added shared detailedCardSchemas.js and an Electron inspector regression runner. Actual input edits change rendered DOM and saved config; remount retains each value in editor and viewer: 152/152 checks, no console errors. These checks do not certify every style combination or actual disk persistence. Initial four failures were a floating-point test expectation (1.5999999999999999 vs 1.6); normalized the intended input to four decimals and reran successfully.
- Rechecked all 41 panes:165/165; existing value formatting:98/98; text-box formatting:24/24. Main UI production build passed (33.65s), with existing toolchain/chunk warnings. QA script syntax and touched tracked source whitespace checks passed.
- Not rerun this expansion: full unit suite, standalone/Fabric builds, live AI provider operations, rich-text toolbar sweep. Earlier four baseline unit failures remain unresolved. Remaining families, formatting extremes/combinations, visual screenshot approval and full AI parity remain pending; no all-features certification.


### Independent X/Y axis formatting
- Added ten optional per-axis label controls (color, size, weight, rotation, spacing) in named Text sections. Shared defaults remain authoritative unless overridden; numeric clearing returns to automatic. Shared option adapter preserves formatter/domain/data and handles zero values without mutating source options.
- Updated shared ECharts memo and Bar Race effect dependencies for immediate edits. Logged/reproduced FORMAT-AXIS-008 (Bar Race reset retained rotation); replacing only axes during ECharts update fixes reset while leaving series merge intact. Verified by actual inspector clear action in both hosts.
- Electron axis sweep:312/312 checks across13 built-in chart types and both hosts, no console errors. Checks all ten controls, ECharts option values, unchanged series data, remount and rotation clear. Initial runner serialization failed on formatter functions; changed evidence serialization to only inspected primitive fields, then exposed two real reset failures before fixing them.
- All41 settings panes:165/165. Unit suite456pass/4fail; failures match existing appSpecToPowerBI(2),axisSwitcherParity(1),tmdlInjector(1). Final main/standalone/Fabric builds passed (56.16s/44.55s/36.64s), existing toolchain/chunk warnings remain.
- Inspected evidence/screenshots/axis-detail-pane.png: independent rotated X labels and colored/bold Y labels visible; pane groups legible. Screenshot is a scrolled QA page, not a clipping certification. Animation quality, extreme text combinations, custom-template-specific axes, AI mapping and full disk persistence for the new keys remain unverified.


### Axis label readability controls
- Added eight optional per-axis fields: font family, maximum width, overflow mode and hide overlap. Extended shared adapter and both update dependency paths; defaults remain unchanged. Logged enhancement FORMAT-DETAIL-003 before changes.
- Expanded existing real-inspector sweep:520/520,13 chart types ? both hosts; series data unchanged. All41 settings panes165/165. Focused unit5/5, full suite457/4 with the same four baseline failures.
- Long Unicode-label review4/4: displayed ellipsis, word/character wrapping mappings, default reset and retained20 categories/values. Inspected chart/pane screenshots. Review uses direct config for initial screenshot, actual select input for overflow variants; does not certify every size/wrapping combination.
- Main UI/standalone/Fabric builds passed43.26s/38.48s/32.76s with existing warnings. Shared changes are compiled in all targets. Remaining formatting families, extreme clipping combinations, AI parity and full reset/persistence acceptance remain open.


### Remaining areas ? bounds, interaction, AI patch semantics and baseline review
- Reproduced Bullet upper-bound overflow10px, negative marker56px outside, and zero-domain invalid CSS in both hosts (6 failures). Added finite zero-based geometry and width-aware marker placement; all6 now pass. Signed numeric values retained. Unit2/2; detailed formatting152/152; value formatting98/98.
- Reproduced Ctrl-click replacing selection. Added modifier metadata only for bar-family paths, immutable scalar/array selection transitions and mark membership. Native16/16 suite verifies four viewer types add/remove/clear/plain replacement and emphasis; existing hover/drill/axis-switch/drag/resize tests remain passing. Editor drill behavior unchanged. Other families and native Mac Meta input not certified.
- Production isolated AI contract tests reproduce and fix remove-value validation and original-state-only validation. Accepted edits advance an isolated working spec; primitive parents rejected; caller inputs unchanged. Updated sequential fixture from invalid numeric targetLine-object semantics to supported categoryColors parent/child; resulting color asserted. Final contract16pass/2fail: unknown key and invalid config type still accepted. No live provider request.
- Reviewed four baseline failures. Three were obsolete tests: exact authored export positions replace outdated auto-reflow expectations; stable hash-separated measure naming tests now assert truncated-prefix and punctuation collision resistance. No product layout/naming change. Remaining Power BI secondary-axis local-only selection is a source-confirmed capability gap; retained failing test and logged EXPORT-AXIS-010.
- Final full suite465pass/1fail (remaining-baseline-suite.json). Main/standalone/Fabric builds pass47.81s/39.95s/34.35s; existing warnings. Source whitespace and Electron syntax checks pass. All external/provider/Power BI service actions remain unperformed.
- Added remaining-work.md covering every requested area and explicit unresolved acceptance; this pass does not complete the whole product audit.


### Pane typography and legend consistency
- Logged SETTINGS-002 before reorganizing: Treemap/Radar/Pie/Donut typography remained under Style; Pie/Donut duplicated legend visibility/position across tabs.
- Added schemaPlacement.js for explicit inspector placement and common-control deduplication. Moved tile/center/label typography to Text; legend-specific Max items now appears inside the one common Legend section. Schema keys/defaults and renderer behavior unchanged; custom parameter schemas keep their existing path.
- Actual inspector edits and ECharts option values verified for moved controls in both hosts:42/42, including remount snapshot. All41 panes165/165; legend40/40; value formatting98/98. Full unit suite467pass/1existing Power BI secondary-axis failure. Main UI build passed17.49s; export-host builds not rerun because this change is inspector-only.
- Regenerated all41 rows in settings-feature-map.md from current runtime evidence. Inspected Treemap screenshot showing typography under Text; saved Donut/Radar screenshots as diagnostic evidence. Remaining repeated Appearance headings and visibility/typography grouping refinements are not marked resolved.


### Shared section naming and palette accessibility
- SETTINGS-003: renamed shared Appearance section to Colors & container to distinguish palette/card styling from schema-driven mark appearance. Added explicit color-scheme names and button type to palette swatches; no config, renderer or event behavior changes.
- Expanded all41 pane sweep with heading uniqueness and accessible swatch-name assertions: 237/237 pass, no console errors. Existing spec-preservation assertions still pass. Regenerated settings-feature-map.md.
- Main UI build passed29.51s; existing toolchain/chunk warnings. Source whitespace and runner syntax checks pass. Full unit/renderer sweeps were not rerun for this heading/accessibility-only change; last full suite467pass/1existing Power BI secondary-axis failure remains the baseline. Full keyboard/screen-reader usability review remains pending.


### Label visibility/content placement and Pie applicability
- SETTINGS-004: showLabels/showValues/showCenterText/labelStyle now share Text placement with typography. Existing keys/defaults/renderers unchanged. Tested tile labels/values and slice/center toggles in both directions, category-name formatting, saved config and remount.
- Found SETTINGS-005: Pie forcibly disables center text but still exposed center font/color. Hid these unsupported fields for Pie; Donut retains them. Corrects prior option-only evidence that mistakenly treated invisible Pie center styling as a working feature.
- Final focused suite68/68, all41 panes237/237, legend40/40, placement unit2/2. Initial focused run failed on hidden Pie center toggle (inapplicable fixture); later four name-format assertions failed because the audit left labels disabled. Corrected fixture to re-enable labels before checking formatter, reran successfully. No formatter product fix needed.
- Main UI build passed42.88s; existing warnings remain. Full unit/export builds not rerun for inspector placement/applicability-only changes; last full suite467pass/1existing Power BI secondary-axis failure. Other label families and extreme combinations remain pending.


### Full local round: authoring, Present, Playgrounds and output runtimes
- Traced both Playground implementations and web/Fabric entry points. Read caller normalization before confirming WEB-DATA-011: multi-dimension refs are retained, but web route rejected empty measure arrays. Added failing production-route test, fixed dimension sorting/validation,7/7 web+desktop regressions.
- Added actual built-artifact HTTP harness:82/82 smoke cases (41web+41Fabric), synthetic endpoints, no cloud actions. Added Visual Playground harness:30/30 across14 starters with bound preview, save callbacks, invalid JSON and close. Fixed Calendar empty-range/unbound crash and keyed preview lifecycle (PLAYGROUND-012).
- Data-query Playground3/3; Present7/7 including tall scrolling and widths. Native Escape did not deliver events, so only dispatched handler certified. Earlier tall remount stall retained and isolated process terminated; fresh-fixture test passed. See full-round-report.md for audit fixture corrections and limitations.
- Existing authoring10/10, interactions16/16, data299/299. Fixed CSS background shorthand warning (UX-CANVAS-013); final authoring/Present no captured console errors. Final unit470pass/1existing Power BI secondary-axis failure. UI/web/Fabric builds pass; Power BI TypeScript noEmit passes. Syntax/whitespace checks pass.
- Full report separates successful local checks from untested tenant publication, library disk persistence, live AI and exhaustive visual acceptance. No blanket full-product certification.


### Playground usability round - 2026-09-07
- Inspected current Playground layout/save flow and remaining product backlog. Logged UX-PLAYGROUND-014 before runtime verification.
- Improved narrow-window pane layout, toolbar wrapping, keyboard focus indication, editor accessible name and announced save state. Prevent concurrent saves and false success when persistence is absent.
- Electron playground-round:37/37, all14 starters plus save fault/retry and640/900/1500px pane bounds; zero captured console errors. First sizing test timed out because outer window size differs from content size; corrected harness to setContentSize and retained playground-ux-first-run.json.
- UI production build passed16.36s in cache/qa-build/playground-ux. Existing CJS/module metadata, Browserslist freshness and bundle-size warnings remain.
- Added product-experience-plan.md with guided setup, discoverable formatting, recoverable editing and export acceptance priorities.
- Limits: no live provider/cloud publish, actual library disk roundtrip, comprehensive keyboard/short-height or pixel equivalence verification this round. Full unit suite not rerun for these localized JSX/layout changes.


### Local Power BI request - 2026-09-07
- Read Home/connection/query/provider paths and current Power BI mapper/publisher/report builders; checked Microsoft PBIP/PBIR contracts.
- Established PBIX conversion via Desktop, distinction between byPath editing and live Fabric connection, and current publisher's generated-measure remote write dependency.
- Logged EXPORT-LOCAL-015 for silent object omission; recorded design/acceptance in engineering/local-power-bi-projects.md.
- Requested clarification of local model source (folder vs running Desktop vs published model). Connection implementation depends on this answer. No product code changed or local-export runtime tests executed this investigation.


### Local Power BI source clarification and foundation - 2026-09-07
- User confirmed fourth local report output and two Home project sources: Fabric or local PBIP folder.
- Added src/powerbi/localProject.js for actual project/reference resolution and exclusive local package writing. No cloud or source-model mutation.
- Added17 passing synthetic filesystem tests: TMDL/BIM resolution, stable identity, invalid/missing/ambiguous references, binary preservation, source preservation, collisions and unsafe paths.
- Found installed Store Power BI Desktop, no running PBIDesktop/msmdsrv process and no repository PBIP fixture. Requested selected local PBIP path for live verification.
- Still pending: model metadata/query provider, persistence/reopen switching, full PBIR visual generation and compatibility, both UI integrations and Desktop acceptance. No claim of a working user-facing local export yet.


### Shared Home/dialog UX round - 2026-09-07
- Ran canvas baseline, inspected Home/Modal and logged UX-SHELL-016 before fixes.
- Improved search feedback, multi-page counts, project button semantics, shared dialog title/focus/stack behavior and short-window scrolling.
- Added shell-ux harness11/11 and inspected screenshot. Broader rerun: authoring10, Present7, Playground37, query Playground3, settings237, interactions16 all pass.321 checks total.
- Production build passed33.41s; final row-click preservation adjustment shell-retested. Native keyboard injection failure recorded; DOM handlers verified without claiming native keyboard completion.
- See ui-ux-round.md for scope, evidence and remaining acceptance. No cloud data or publish operations.


### Remaining-work continuation: Home recovery
- Reproduced hidden project-storage failures with synthetic production Home callbacks; logged UX-HOME-017.
- Added explicit project-loading failure/retry, named deletion/cancel, in-flight guard and failure/retry feedback. Source model is never deleted by project deletion.
- shell-ux16/16 passed, including failed load, cancel, failed deletion and successful retry preserving other projects.
- Full unit suite487pass/1fail: unchanged EXPORT-AXIS-010 non-primary Power BI axis cross-filter capability gap. Evidence remaining-round-suite.json.
- Formatting discoverability, full export fidelity, local PBIP UI/query integration and other acceptance areas remain outstanding; this continuation does not complete the full backlog.


### Broad loaded-app test round
- Launched actual Electron entry with isolated profile; inspected startup and9standard visual screenshots.
- Ran16 production UI/format/interaction suites, isolated persistence5/5, rebuilt web/Fabric smoke82/82.1652 scoped checks passed excluding units/contracts.
- Added --fresh visibility execution; completed1230 new cases,156clipping candidates,36expected query errors, no unexpected console events or visual error boundary output.
- Unit487/1 and contract16/2 failures remain open (Power BI secondary-axis filtering and AI config validation).
- Fixed QA artifact readiness and missing persistence-preload delete forwarding after preserving initial failed evidence. No product-code edits this round.
- All3builds and Power BI TypeScript passed. Logged confirmed flow placeholder VIS-FLOW-018. See broad-runtime-report.md for evidence and limits.


### Local Power BI IPC integration
- Registered select-local-power-bi-model in Electron main and exposed a dedicated preload method. Native folder/exact-project selection uses the existing validated resolver and returns cancellation/errors explicitly without changing active connections.
-22/22 local filesystem/IPC tests passed; real isolated Electron startup passed after registration.
- Confirmed existing Home/create/reopen and metadata/query paths assume Fabric. No Home local creation or fourth-export completion claim; provider routing and report generation remain unfinished.
- Power BI Desktop installed; .NET8runtime available, no dotnet SDK listed. Actual user PBIP path still unavailable for live-model acceptance.


### User-provided AdventureWorks local PBIP
- Found new pbip folder, resolved actual report byPath reference and local cached TMDL model.
- Hashed157source files; opened only a separate QA copy in Power BI Desktop.
- Installed ADOMD client connected to Desktop engine;4/4 read-only checks passed (existing measures, categories and filter consistency). No measures added, no refresh/mutation.
- Rehashed original source:157unchanged, no added/removed files. QA copy left open for review.
- Added local-pbip-connect.ps1 and local-pbip-connection-report.md; application provider/Home/export integration remains pending.


### Local model new-report authoring integration
- Added Windows Desktop ADOMD session discovery, definition matching, local metadata and query routing; no model write/refresh operations.
- Home Fabric/local choice and Setup local entry; persisted source reference on new report Save and reconnect branch on reopen. Local-to-Fabric opening fails closed pending reconnect.
- Tested real production Home -> new blank report -> Library Bar -> measure/category binding -> database Save/reload -> new chart remount using AdventureWorks QA engine. Actual expected data values required before checks/capture.
- Corrected QA selectors for lowercase CSS-capitalized Library, required Group By, and stale chart readiness; final compositor screenshot shows three correct bars. Initial attempts were harness failures, not reported as completion.
- shell16/16, authoring10/10, full unit492/1existingfailure, UI build30.26s. Added PS unpack config; installer not tested.
- Original157files rehashed unchanged. No source report/model changes or new measures. Fourth PBIP export and advanced local capabilities still pending; see local-vilsem-report-workflow.md.


### 2026-09-07 - Source-specific output restrictions
- Traced the current local writer and modern PBIR builder. The writer exists, but the renderer builder still depends on an organizational custom visual; complete local file generation remains pending. No cloud publishing or model mutation was attempted.
- Local reports now exclude cloud Power BI publishing, web export, Fabric deployment, and the inspector custom-visual export action. Persisted local-source identity protects reopened reports. Fabric chooser paths remain available under their existing capability flags.
- Output chooser explicitly distinguishes Vilsem Save from the unavailable Power BI file generator; no placeholder success/download action was added.
- Validation: 29 focused unit tests passed; loaded Electron local workflow 6/6 passed with no console errors; production UI build passed (existing bundle-size/tooling warnings). Source SHA256 check: all 157 original files unchanged.
- Still pending: self-contained PBIP/PBIR generation and Desktop validation, backend-wide output restrictions, loaded Fabric chooser regression, and the broader priority backlog.


### 2026-09-07 - Enhanced PBIR generator investigation
- Added localReportBuilder: enhanced report/page/visual files, bundled private custom visual resources, direct bindings to existing model measures and columns. Unsupported visual types/slicers/drill are rejected, rather than silently omitted. This is an internal prototype, not a released export action. Additional formatting/filter/interaction parity remains to be implemented.
- Added saveBoundReport: active-connection identity validation, local relative model reference or Fabric Desktop connection string, exclusive new report folder. No model measure installation or remote update.
- Generated actual PBIP/PBIR from the previously saved Vilsem QA Bar report. Initial schema validation found missing themeCollection; corrected it and added a regression assertion. Fresh generated report passes all six Microsoft schema checks.
- Opened generated reports in installed Power BI Desktop. Fresh isolated model copy loads with CategoryName/Quantity Sold bindings, but the custom visual remains blank. NOT verified as a usable report; UI file export remains unavailable. Evidence: local-pbir-desktop-fresh.png, local-generated-report.json, local-pbir-schema-validation.json.
- Tests: 40 focused tests passed. Original source integrity: all 157 files unchanged (local-export-source-integrity.json). Generated artifacts only under cache. No production build needed for unused generator modules; actual Desktop runtime remains the failing check.
- QA probe initially picked bundled versions lexicographically (4.9 before 4.12); corrected to numeric comparison. The corrected bundle selection has NOT been rerun in Desktop yet; this is the next diagnostic check.


### 2026-09-07 - Preserve report theme in local Power BI export
- Explicit opaque page background and matching outspace now follow the Vilsem canvas: dark #0b0b12, light #FFFFFF. Every page receives the same saved report mode; primitive renderer spec carries that mode and native visual-container background is disabled.
- Added dark/light/default and multi-page theme regression checks; 43 focused tests pass. Fresh generated artifact passes all six Microsoft schema checks. Validation caught a legacy vcObjects property; corrected to enhanced-PBIR visualContainerObjects and retested.
- Confirmed the generated package now embeds renderer 4.12.0.0. The QA SSR generator no longer scans unrelated repository HTML files for dependencies.
- Latest Desktop test launched against a fresh copied model. Screenshot local-pbir-dark-theme.png was captured during loading; it is NOT evidence of final dark rendering. EXPORT-LOCAL-017 remains open and production file export remains unavailable.


### 2026-09-07 - Resolved local PBIR Bar blank rendering
- Researched official Microsoft PBIP/PBIR documentation and compared Service legacy serialization with enhanced local output. Saved the isolated QA artifact through Desktop to inspect native serialization.
- Found Desktop normalizes the custom-visual resource item path to a basename, matching the working Service builder. Corrected local builder; no Service renderer/publishing changes.
- Fresh Desktop artifact renders the actual three-category Bar and dark page/chart. Final evidence: local-pbir-resource-fix.png. EXPORT-LOCAL-017 verified for this scenario; full product export remains pending.
- Validation: 31 focused unit tests, six published schema checks. Detailed comparison: local-pbir-format-investigation.md.


### 2026-09-08 - Full-page local Power BI visual gallery
- Extended generate-local-probe.cjs --full-page to create a 3x3 page: Bar, Column, Line, Area, Donut, Pie, Treemap, Radar, Table. Real Quantity Sold by CategoryName, separate copied semantic model. Spec saved as evidence/local-full-page-spec.json.
- Generated and opened actual PBIP in Desktop; all nine visual types show rendered output on a dark page. Screenshot: evidence/local-pbir-full-page.png; artifact path: evidence/local-generated-report.json. This is rendering smoke coverage, not complete per-visual correctness/parity verification.
- 32 builder/writer tests pass, including nine retained visuals and container bounds; all 14 report definition schema checks pass. Original 157 source files unchanged.
- Corrected capture-power-bi.ps1 to declare DPI awareness: prior captures cropped the physical window at Windows display scaling. Native zoom dialog automation initially queried before the dialog was available; retried after it appeared.
- Follow-ups: Column top label clipping, Area fill appearance, full formatting/interaction, light mode and save/reopen, remaining visual types, product UI export integration.


### 2026-09-08 - Product Save as Power BI preview
- Added the UI preview flow, destination-picker IPC, actual exclusive PBIP/PBIR writes, busy/retry/cancel feedback and saved-file path. Ordinary Vilsem Save preserved. Added workspace display name to Fabric connection context for Desktop live references.
- Exposed the existing bundled renderer loader for reuse; Service publication behavior unchanged. Local/cloud output restrictions remain in place.
- 47 focused tests pass; final UI production build passes (existing tooling/bundle warnings). An initial root-directory Vite invocation built unrelated root HTML; it was not treated as UI validation and the correct ui-directory build was run.
- Loaded Electron QA: 7/7 checks pass, including production IPC file export. QA source is now a copied semantic model, allowing Desktop follow-up without touching original files. Earlier copied-model display-name wait failed; evidence retained in local-export-ui-fixture-name-failure.json and corrected fixture rerun passed.
- Opened the UI-generated PBIP in Desktop for follow-up; validation ongoing. Full phase tracker: phase-status.md. No claim that all phases or complete export parity are done.

- Follow-up Desktop verification passed for the actual UI-generated Bar report: screenshot local-export-ui-desktop.png shows expected three values with dark page/chart. This validates the connected UI -> file -> Desktop path for that case; it does not complete all visual/format/persistence coverage.


### 2026-09-11 - Bar/Column cycle started
- Compared Canvas composition with Power BI composition; reproduced missing Column top-label clearance.
- Corrected Power BI composeBarLike margin selection without changing domains or the horizontal/inside-label cases.
- 36 focused tests passed (4 layout, 12 report builder, 20 writer). Initial test-shape mistakes corrected before the red/green defect reproduction.
- Added visual-cycles.md with per-target evidence and remaining checks. No new .pbiviz built or deployed; Desktop/Service visual verification remains pending.


### 2026-09-11 - Runtime cycles continued
- Rebuilt package, generated nine-visual report, visually verified Column clearance in Desktop, saved/closed/reopened and confirmed rendering/theme.
- Continued into signed stacked bars: reproduced two domain failures, shared the corrected function across app and Power BI; rebuilt both; 58 tests passed including ECharts rendering geometry.
- Created isolated QA negative measures and verified actual signed-stack report in Desktop. No source-model measures added.
- Area missing-fill hypothesis disproved; retained regression and observed fill.
- Package succeeds with unresolved lint/development-certificate warnings; standalone ESLint config mismatch recorded. No deployment checks claimed. See visual-cycles.md.

## 2026-09-11 evening - full target cycles resumed
- Confirmed saved QA workspace authentication against live Power BI reports/datasets and Fabric items APIs. Evidence: cloud-access.json. No existing report/model changes.
- Started Vite; agent-browser rendered grouped bar and captured cycles-browser-start.png; no browser errors returned. Initial QA harness is intentionally empty until mounted.
- Fresh native interaction suite: 16/16 pass. Added grouped-drill.cjs: four user-facing modes across four bar types, 16/16 pass including return controls and restored chart data. This uses deterministic transport, not cloud data.
- Fresh all-visual data invalidation suite completed (data-audit-after.json); settings and 1,230-case visibility sweeps running.
- Full unit run: 528 pass, one existing axisSwitcherParity failure. Not a clean suite; non-primary Power BI HTML axis selections still only dim locally.
- Reproduced five Fabric setup failures continuing to publication. Added stage-specific failure returns; six pipeline tests and seven Fabric export tests pass. Live deployment remains to verify.
- Generated a four-page, 19-primitive Power BI gallery using existing AdventureWorks measures. Starting isolated live Service report creation; model is not modified.

## 2026-09-11 evening - live targets and reproduced regressions
- Created isolated Service report 5ff48629-1c28-49c7-a04b-bfea105d9821 in the existing QA workspace, referencing Test_Adventure without model changes. Four pages contain 19 supported primitives. Actual screenshots and frame content reviewed; host rendered events alone initially captured blank custom frames, fixed harness readiness/capture.
- Live Service update reproduced EXPORT-SERVICE-023 (HTTP 400 .platform requirement). Request now enables metadata updates only when .platform exists; two regression tests pass and live retry succeeded.
- Service standard/single-category/empty loops exposed stacked/slope label overlap, bar-race missing playback validation, red error styling for ordinary empty results, and one-category pie changing into a silent progress ring. Logged EXPORT-LABEL-021, EXPORT-RACE-022, EXPORT-EMPTY-024, VIS-PIE-025.
- Added real ECharts label bounding-box tests; bar and slope fixes suppress colliding labels with ECharts LabelLayout. Pie preserves categorical mode for one/null category while scalar progress remains supported. Rebuilding/redeploying for live verification.
- Fabric CLI sign-in completed by user. Deployed QA app 3340d5cf-f8e0-489c-9068-085790a558af; generated spec retains all 41 visuals (log counts 36 measure-bearing). Portal browser sign-in remains pending. CLI schema-query transport requires Azure CLI, unlike embedded SDK auth; not treated as an app runtime failure.
- Fresh web/Fabric bundle smoke run: 82/82 checks, zero events. This is local compiled-artifact execution, not hosted Fabric acceptance.
- Reproduced DATA-CATEGORY-026: category text conversion loses leading zeros/precision. REST/local and Fabric shim now preserve dimension strings; six regression tests pass.
- Preserved failed post-HMR interaction run as interaction-hmr-failure.json. Harness now resolves ECharts from its canonical import rather than a hard-coded Vite dependency URL; rerun underway, with added one-category pie/donut native clicks.

## 2026-09-11 night - authenticated hosted verification
- Fabric portal login completed; inspected all seven pages with actual semantic model results. Added fabric-portal-audit.cjs using the existing local QA browser CDP connection; no credential reads. Captures include both ends of scrolling pages and stable canvas-paint checks.
- Found duplicate dimensions and invalid navigation destination in the generated QA fixture; corrected those separately from product fixes.
- Reproduced Fabric dimension-only table [undefined] query (EXPORT-FABRIC-027); added two regression tests, corrected shim, 12 related query tests pass. Redeploy in progress.
- Refreshed hosted app confirms stacked-label overlap fix. Service screenshot readiness now waits for stable paint; apparent truncated slope was an unfinished animation, and the settled line is complete.
- Pie tests 34/34 pass after correcting the legacy scalar fixture; native interaction suite remains 18/18.
- Generated separate four-page local report with all 19 supported primitive visuals using a copy of the original model; opened in Desktop for verification (local-all-visuals-report.json). Original model remains untouched.
- Generated Fabric template npm audit reports 44 dependency vulnerabilities (2 low, 29 moderate, 12 high, 1 critical); not assessed or fixed. No clean security-audit claim.

## 2026-09-11 night - target persistence and insertion safety
- Hosted Fabric native bar click/deselect/reselect and Ctrl-click multi-select pass; KPI totals 57.8k, 84.2k and 71.7k match real categories. Four-member dimension-only SDK query passes after deployment.
- All 19 local primitive visuals reviewed across four Desktop pages; Save invoked and file reopened with page four retained and race rendered. local-all-page1..4.png and local-all-reopened.png. Original 157 files unchanged, zero additions.
- Fresh compiled web/Fabric artifacts: 82 smoke checks completed; no failing checks or events. Full unit baseline after excluding generated cache apps: 553 pass / one known secondary-axis test failure before new insertion tests.
- Reproduced binary report resource corruption on fetch/update (EXPORT-PARTS-028); retain original base64 and re-encode only edited text, preserve payload metadata through report builders. Reproduced four insertion preparation failures writing empty measures (EXPORT-INJECT-029); stop before model/report writes. Twenty focused update/insertion/TMDL tests pass. Live isolated QA resource roundtrip in progress.
- Logged static existing-report injection parity gap EXPORT-INJECT-030; corrected obsolete modern-PBIR comment without enabling an unverified migration.

## 2026-09-11 night - cross-filter identity defects reproduced
- Live Service no-op roundtrip preserved all 30 report parts byte-for-byte (service-resource-roundtrip.json); all 19 visuals still render afterward.
- Live Service native bar click filters another visual to Accessories correctly. Native treemap click on Accessories instead filters Bikes; retained before evidence and logged INTERACTION-PBI-031.
- Fourteen production-method selection tests now cover sorted-category IDs, treemap virtual-root index, slope series identity, radar spoke direction, callback formatting and lollipop coordinate arrays. Original twelve routing/format tests failed as expected; fixes pass with related rendering tests (23/23).
- Selection preserves formatter/symbolSize functions and resolves visible categories to original DataView IDs. Rebuilding .pbiviz for live acceptance.
- Hosted Fabric bar remove-from-multiselection/clear and navigation button also pass. Full unit baseline before latest selection tests: 562 passed / one known secondary-axis failure. UI and standalone build pass.

- Latest full unit suite: 576 passed / one known secondary-axis failure. Native Service radar selects Bikes at the Bikes spoke and repeat-click restores all categories; native app radar and Ctrl selection pass (19/19 suite).
- Fabric redeployment includes app radar correction. First subsequent portal capture timed out while Desktop/build jobs were active; harness records failure, brings the QA portal to front and allows a bounded 45-second screenshot timeout. This is not counted as a product pass or product defect.

### Continued live-target review
- Fabric sign-in confirmed; hosted radar selection/clear returns correct real-model values (13929/84174). Navigation and light/dark switching pass functional checks.
- Latest compiled web/Fabric screening: 82/82 checks, no console error events. This run includes the radar interaction fix, before the subsequent pie layout change.
- Local rebuilt report: native treemap Accessories selection matches table and gauge; scoped evidence updated.
- Logged VIS-PIE-034 from hosted light-theme screenshot. Actual ECharts tests reproduce 20/30 failing bounds cases; shared series-layout correction passes 31 geometry/transition checks and 34 existing pie regressions. Hosted rebuild/retest underway.
- Latest full unit baseline before pie bounds additions: 576 passed, one known secondary-axis cross-filter failure. No blanket release or all-interaction certification.

- VIS-PIE-034 hosted retest: deployment deploy-20260912015839-8a4b3c6c; dark and light screenshots show the complete circle. Seven-page portal run and native bar/radar/navigation/theme checks passed. Main UI and Power BI package build; Service 19-type three-state cycle completed.
- Added pie/donut Ctrl selection lifecycle tests: both fail before correction (South replaces North). Logged INTERACTION-MODIFIER-035; testing modifier forwarding fix.

- INTERACTION-MODIFIER-035: six affected types pass native add/remove/clear selection; total 25/25 app checks. Deployed Fabric pie lifecycle passes against real totals 57809 / 71738 / 13929 / 84174. React review: existing hook dependencies and event subscription structure preserved; no new effects or data fetches.
- EXPORT-INJECT-036: five failing preflight cases reproduced; destination/visual validation added before model writes, legacy first-page fallback removed. Twelve insertion tests pass, including correct legacy page preservation. Main UI build passes.
- Latest rebuilt web/Fabric bundles: 82/82 smoke checks, no error events. Full unit run before the seven new insertion cases: 607 passed, one known secondary-axis cross-filter failure.
- Expanded Service native QA to 16 selectable primitive types with coordinates derived from production ECharts layouts and actual host CSV filter verification; run underway. Gauge/table/playback interactions are separate outstanding cases.

- Service expanded native run: 10/16 chart types select the expected category and clear correctly. Line/area/stacked-area/bump/scatter/bubble clicks did not filter the witness; checking small-mark coordinates before classifying product defects. First-run evidence retained in service-all-interactions-first.json.
- Logged EXPORT-TABLE-037: Power BI table lacks app header sorting and resize handlers (source-confirmed; native comparative acceptance pending).
- Full unit suite after insertion guards: 614 passed / 1 known failure / 615.

- Service default selection/deselection now verified for all 16 selectable primitive chart types. Small-mark harness uses native font metrics plus actual painted primary-mark pixels; initial failures were coordinate misses, including stacked-area secondary line without symbols. See service-native-summary.json and individual CSV evidence.
- TOOLTIP-TEXT-038: five primitive failures reproduced with harmless markup. Shared escaping applied to inline tooltip category/series/value text and both radar overrides. Six primitive tests, Power BI radar formatter regression and eight app DOM tooltip checks pass; app suite total 32 checks.
- Full unit result: 621 passed / 1 known secondary-axis cross-filter failure / 622. Latest package/Fabric deployment succeeds; final target acceptance underway.

- FORMAT-PBI-039: live Service tooltip hidden/shown checks pass; default QA report restored. New immutable tooltip configuration result is retained in the renderer.
- INTERACTION-POINT-040: native app tests reproduced missing scatter/bubble/slope/lollipop click forwarding. Added category-aware adapters with Ctrl/Meta; slope uses series identity, lollipop uses the category coordinate.
- FORMAT-MOTION-041: slope/lollipop ignored animation controls in app and Power BI. Reproduced renderer-state failures, then added explicit animation options and app memo dependencies. Both host checks pass.
- App suite now 40/40: includes new point selection lifecycles, vertical lollipop, slope right endpoint and animation toggles. React hook review confirms callbacks precede early returns and use relevant dependencies; authoring canvas retains its existing drill-only behavior. Hosted point-chart verification underway.

### Latest hosted interaction and bundle verification
- Authenticated Fabric: scatter/bubble/lollipop/slope native selection and clear passed against actual semantic-model results (8 checks). The first harness attempt clicked before the renderer committed; the rerun waits for rendering after the query result. Both attempts retained.
- Latest compiled web/Fabric bundles: 82 smoke checks passed. Current app suite: 40 interaction/tooltip/animation checks; full unit suite: 624 passed, one known secondary-axis failure.
- Updated per-visual target coverage and regression status. No claim of all-property or all-target parity; local unsupported types and static existing-report insertion remain open.

### Donut field-transition regression
- Reproduced stale categorical legend on scalar progress (VIS-PIE-042) with the actual app merge policy; added explicit legend reset.
- Verified category/scalar/category transition and restored interaction availability; 66 focused tests and 40 app interaction checks pass. Full suite: 625 passed / 1 known secondary-axis failure / 626.
- Source PBIP preservation rechecked: 157 unchanged, zero missing or added files. Main/standalone, Fabric and Power BI rebuilds started; this small final transition fix is not yet reverified in cloud hosts.

- Latest main/standalone and Fabric builds passed; Power BI packaging reports success with existing lint/certificate warnings. Standalone Power BI npm run lint independently fails on missing ESLint flat configuration (BUILD-LINT-043), now logged.

### Source-control checkpoint
- Checked in product sources, regression tests, QA harnesses and audit documentation together. Generated build files, local PBIP input, workbook, browser profiles and raw QA evidence remain local. Evidence links in these documents refer to those local audit outputs; regenerate with scripts/qa where applicable.
- Validation carried forward from the immediately preceding run: 625 unit passes / 1 known failure, 40 app checks, 66 focused pie/donut checks; builds passed with the documented package/lint warnings. Staged whitespace check passed. This checkpoint is not release certification.

### v1.0.0-beta.3 release preparation
- Merged the engineering checkpoint in an isolated release checkout; bumped package and lockfile versions. Added Power BI renderer build to the installer build chain.
- Clean Windows checkout exposed four LF-only harness failures; corrected import removal to accept CRLF, then reran all 626 tests: 625 passed, one documented secondary-axis failure.
- Desktop/standalone, Fabric and Power BI builds completed. Built unsigned Windows x64 NSIS installer; archive integrity and extracted payload startup/preload/sign-in checks passed with isolated profiles. Required assets and local bridge present; no credential or PBIP input files found in app.asar. Interactive installation/upgrade/uninstall not tested.
- Public source update preserves the separate public history and excludes private historical/scratch files. Release notes retain feature and test limitations.

### Post-beta.3 Power BI table parity cycle
- Traced the remaining secondary-axis test to the legacy HTML local-highlight fallback; native-slicer-safe cross-filter support still needs a separate design/test cycle.
- Reproduced missing Power BI table sorting/resizing and interpreted value prefixes. Added stable descending/ascending/reset sorting, mouse/keyboard width controls, horizontal scrolling, field-change state reset, and literal formatted values.
- Production-method Electron checks pass: seven scenarios, including native drag, minimum width, field/data changes and measure-only values. Fixed measure-only row loss discovered during this cycle.
- Updated isolated Service report: actual-model header sorting/reset and keyboard resize pass (service-table-interactions.json). No original model/report modified. Desktop-specific retest and persisted table settings remain pending.
- TypeScript check and initial package build pass; final scalar-row correction package rebuild passed. These post-release fixes are not part of the already-published beta.3 installer.

- Final full suite with two workers: 625 passed / one known secondary-axis failure. An additional tooltip test failure during the concurrent package build is retained in unit-table-concurrent-build.json; it did not recur with reduced concurrency.

### Work order corrected
- User specified non-AI gaps first, AI editing second, local LLM last. Preserved incomplete Ollama changes under cache/deferred-ollama and restored only its two tracked source edits to HEAD. Existing table fixes remain active. No Ollama service started.
- Continuing export preservation and interaction parity investigation.

### Non-AI continuation - insertion destination metadata
- Traced existing-report insertion: static HTML remains active; primitive branch is disabled. Live insertion/filter parity remains open (EXPORT-INJECT-030).
- Reproduced UX-INJECT-046: supporting PBIR files inflate destination visual counts (3 instead of 2).
- Fixed distinct-folder counting in injectorFlow.js; regression covers part order and empty pages.
- Validation: insertion preservation suite failed on the new reproduction before the fix, then passed all 13 tests. No model or report writes performed in this cycle.

### Remove direct insertion; retain custom visual export
- Removed the existing-report insertion Home card, command-palette command, route and import. Updated README/product flow/priority plan; insertion parity is retired by user request, not marked fixed.
- Traced retained VisualInspector -> exportVisualPbiviz -> desktop package writer/import guide. Fixed EXPORT-GUIDE-047 after a failing reproduction: ten table measures now all appear in Content.
- Validation: app and standalone production builds passed (before the final guide-only change); full unit run 626 passed / one known secondary-axis failure. Subsequent focused guide and preservation suites: 15 passed.
- React review: removed unused import/prop/action, no hook order or state mutation changes.
- Remaining: custom package import runtime acceptance, secondary-axis filtering, unsupported local report types/drill/slicers, formatting/clipping and release checks. AI and Ollama remain later phases.

### Detailed formatting requirement expanded
- User explicitly requested every visual detail, including secondary-axis colors, and precise AI prompt editing.
- Traced VisualInspector -> axisFormattingSchema -> EChartsCanvas -> applyAxisTextConfig and LineMarks.
- Confirmed secondary series color is supported separately from dual-axis capability: LineMarks emits one Y-axis; shared typography applies the same Y settings to every axis.
- Added detailed-formatting-plan.md with per-control rendering/reset/persistence/target acceptance and subsequent real-prompt AI coverage.
- No rendering behavior changed in this investigation; no additional runtime tests claimed. Continue non-AI first, AI next, Ollama last.

### Axis typography across Power BI compositions
- Reproduced FORMAT-PBI-049 in 11 chart types before changes.
- Integrated the existing axisTextConfig helper at the Power BI composeOption boundary and added it to copy-primitives manifest; no duplicated typography implementation.
- Validation: 24 focused axis, line/area and bar-layout tests pass. Test comparison was corrected to compare series data/type/axis assignments rather than distinct formatter function identities generated by separate composition calls.
- Hosted Service/Desktop and playback-specific acceptance remain pending; this does not implement independent secondary axes or certify all formatting controls.

### Playback formatting continuation
- Traced bar-race and drill bypasses of standard chart composition.
- Reproduced FORMAT-RACE-050 using production renderBarRace and actual scrub callback with a mocked chart sink.
- Applied shared axis/tooltip helpers on every frame draw, preserving sorting, values and playback controls.
- Race and eleven composition formatting tests pass. Selection regression and TypeScript checks run alongside; hosted visual acceptance remains pending.

### Drill integrity and formatting cycle
- Reproduced and corrected DRILL-PBI-051: all hierarchy levels preserved using qualified field keys; leaf aggregation regression passes for same-named columns across tables.
- Reproduced and corrected FORMAT-DRILL-052: replace/panel redraws now receive the same explicit axis/tooltip settings.
- Verification covers production methods and data aggregation; hosted multi-level navigation and screenshots remain pending. No customer model/report modified.

### Release checks, tooltip integrity and export capacity
- BUILD-LINT-043: added flat ESLint configuration matching the installed packaging tool. Standalone lint now passes. Replaced empty root HTML clears with textContent, renamed a frame-array variable mistaken for filesystem fs, and removed tooltip HTML reparsing. Existing legacy HTML renderer remains unchanged.
- Tooltip regression verifies literal category fallback and cloning of existing formatted content nodes. The initial package build passed with the known certificate/pwsh warning; it preceded completion of these final changes, so it is not final-release evidence.
- Single-visual export accepted excess measures/categories while its binding guide silently truncated them. Three failing-before tests reproduced the gap; export now rejects above 3 chart measures / 10 table measures / 6 categories before invoking the writer. All five export-guide tests pass.
- Full regression results are recorded in evidence/unit-latest.json; hosted target acceptance remains pending. No installer release or customer report/model write performed.

### Additional verification
- Native Electron production table harness: all seven checks passed, including pointer resize, sort/reset, literal formatted text and scalar table rows.
- Standalone Power BI lint passes after final changes; TypeScript validation passes.
- Preserved the concurrent development test result as evidence/unit-during-export-capacity-fix.json (643 passed, four failed: known axis failure plus three new capacity tests before their fix). Final-source rerun follows in unit-latest.json.

- Final-source full unit run: 646 passed / 1 failed. Failures: Axis Switcher — render-path parity non-primary axis bar click uses host.applyJsonFilter for cross-visual filter.

### Export/import drill continuation
- Traced the outstanding secondary-axis failure: legacy alternate-axis selection still highlights locally; no unsafe filter API restoration or test weakening.
- Fixed EXPORT-DRILL-054: import guide now lists the bar-family hierarchy in the renderer's expected field order.
- Fixed DRILL-BINDING-055: partial category binding receives a neutral actionable status instead of entering incomplete drill rendering.
- Reproduced both gaps before fixes; targeted export, local report and selection tests run after changes. Original models/reports untouched; hosted acceptance pending.

### Runtime verification and text/race formatting
- Rebuilt latest Power BI package successfully; known certificate/pwsh warning remains. Regenerated isolated 19-type/four-page gallery and updated only the QA report.
- Hosted run: gallery render and table controls passed; bar/stacked-bar native select/clear passed. Grouped-bar readiness timed out and later operations failed; preserved original failure report.
- Strengthened readiness to fail on timeout and moved Service host off Vite onto isolated static loopback server. Added lifecycle diagnostics; smaller retry in progress.
- Fixed text token literal-name preservation and extraction. Five real Electron DOM cases passed.
- Reproduced live app bar-race tooltip trigger mismatch; shared-helper fix passed three browser transitions. Added native interaction regression.
- App and standalone builds passed after text-token change, before the subsequent race-tooltip change.

### Stable hosted sweep and package writer verification
- Stable-host Service run: all 16 selectable chart types passed native category identity and deselection; table controls passed. Preserved result in service-static-host-all-types.json separately from failed initial run.
- Native app interaction sweep: 41/41 passed. Fabric deployed-app traversal/interaction/theme checks completed; latest frontend text/race changes have not been deployed there.
- Production export writer tests reproduced replacement-token corruption in three special-title cases; literal callback fix passes four actual archive/spec/JavaScript checks and four existing resource-preservation tests.
- Small text-box sample (48px, 1.8 line height, narrow container): all 1110 characters retained and scroll end reachable; screenshot retained. SVG axis overlap reproduction passed unchanged, so screenshot crowding remains a review candidate, not a confirmed overlap defect.
- Long per-control app sweep continues with source held stable; no blanket formatting certification.

### Completed sweeps and next clipping repair
- Full control sweep completed: 41 types, 3,924 attempts, one intentional failure-fixture event, no unexpected console errors. Refreshed control-level CSV and coverage document.
- Visibility sweep completed: 1,230 cases; 156 clipping candidates (75 non-ellipsis), 36 intentional errors, no unexpected/image/visual errors. Kept classification open.
- Fabric post-deploy bundle hash matched. Corrected premature QA page readiness (QA-FABRIC-060); all seven pages and real-model interaction/theme checks passed. Three readiness regressions pass.
- Reproduced bar-race control overflow at six narrow editor/viewer sizes; responsive controls now pass eight sizes with scrubber state checks (VIS-RACE-061). This later UI change is not yet redeployed.
- Current full unit baseline 653 pass / 1 known alternate-axis failure; standalone artifacts 82 pass and original PBIP 157 hashes unchanged. No current changes released.

### Waffle correction and compact controls
- VIS-WAFFLE-062 reproduced natively: equal thirds rendered 99 cells and all-zero rows displayed NaN%. Five allocation unit cases and six editor/viewer data cases now pass; negative values retain prior magnitude semantics.
- Multi-segment Waffle grid/legend reflows and scrolls within bounds; 12 width/height/host checks pass. Inspected narrow screenshot. Single-value Waffle compact policy remains pending.
- Expanded bar-race verification to 16 cases including 80px height, last-control scroll reachability and input-to-frame behavior. Inspected narrow screenshot; all 41 native interaction checks still pass after the control change.
- Rebuilding frontend and compiled exports for the new Waffle/bar-race changes. These are newer than the last hosted Fabric verification and published installer.

### Target and preservation follow-up
- Updated Power BI's separate race controls after reproducing the same narrow overflow. Eight native-DOM layout/frame cases and the existing axis/tooltip frame test pass. Package/lint succeed; certificate/pwsh warning remains. Hosted race import not yet verified.
- Rebuilt app/standalone/Fabric bundles; 82 compiled-artifact smoke checks pass with no events. Full unit suite 661 pass / one known alternate-axis failure before the new preservation test.
- Found and reproduced existing-folder deletion in Fabric scaffold using disposable files. Removed destructive cleanup; PROJECT_EXISTS preserves originals. Eight deployment failure/success/preservation tests pass (EXPORT-FABRIC-063).
- Latest UI deployed to the existing isolated Fabric QA app; post-deployment browser checks running. Original semantic model and reports were not edited.

### Reusable QA and deployment recovery
- Added `npm run qa:native` to run isolated local suites sequentially with aggregate failure status. Selected runner smoke: race controls, Waffle, Fabric dialog.
- Fabric dialog now permits changing app name after PROJECT_EXISTS, rejects blank names, and retains the report spec on retry (3 native UI checks). Updated outdated one-visual/starter-template copy and dialog accessibility labels. Inspected screenshot using application styles.
- Latest app build succeeds. Fabric deployed renderer SHA matches local build; seven gallery pages, real dimension query, bar/pie/radar filters, navigation and theme checks pass after Waffle/race changes. No blanket all-state certification.
- Latest Power BI package includes responsive race controls; lint/build pass, certificate/pwsh warning remains. No current installer release or source push performed.

### Honest custom-package support boundaries
- EXPORT-TYPE-064 reproduced: unsupported Waffle spec rendered through bar fallback. Shared 19-type manifest now guards authoring and desktop package writer; unsupported compositions report an error.
- All 41 registry types tested through native inspector export (19 accepted, 22 rejected before IPC). Seventy focused tests pass, including all supported spec types, unsupported types, invalid JSON, and actual-package spec preservation.
- Latest full suite: 711 pass / one known legacy alternate-axis cross-filter failure (712 total). No test was disabled to hide that failure.
- App/standalone and Power BI package builds succeed. Reloading the latest package into the isolated Service QA report and rerunning page/data/interaction states; final result pending.

### Service retest and title parity
- Latest Service gallery reload passed all 39 recorded checks: four-page supported-type report, standard/single-category/empty states, table sorting/resize, and native select/clear for 16 types. Evidence: cloud-gallery.json. This does not certify every formatting/playback/drill state.
- FORMAT-PBI-065 reproduced two title style failures: weight stayed 600 and uppercase was ignored. Power BI header now reuses chartTitleStyle; five native DOM cases pass including defaults, reset, hidden/plain behavior. This title change is newer than the last Service reload.
- Confirmed original local PBIP still matches 157/157 source hashes. Published installer remains unchanged.

### Final verification for the current changes
- Latest full suite after the shared Power BI title helper: results in `evidence/unit-latest.json`; known alternate-axis test remains explicitly open.
- Final Power BI package and lint succeeded, with the existing certificate/pwsh warning. App build succeeded; standalone/Fabric renderer hashes were unchanged by the later dialog and package-boundary changes.
- No source/client model files were changed; 157 source hashes passed. No installer release, merge or push was performed during this continuation.
- Remaining work: semantic validation of individual formatting controls, remaining clipping/visual-semantics issues, independent secondary axes, alternate-axis host filtering, missing local/custom-package renderer types, complete hosted drill/multiselect/playback coverage, deployment dependency audit and installer lifecycle. AI and Ollama remain deferred behind non-AI work.

## 2026-09-12 � independent secondary value-axis validation

- FORMAT-AXIS-048: added an opt-in independent second-measure axis for unstacked Line and Area, with 18 organized controls for visibility, title, labels, font, ticks, grid and number decorations. Stacked Area and Bump do not expose incompatible controls. Area stacking and independent scales are mutually exclusive.
- Native inspector validation: 72 individual control assertions plus four field/remount/reset lifecycles pass. Six narrow/medium/wide plot checks pass after reproducing a zero-width plot at 79px and adding a horizontally scrollable minimum drawing width. Shared Power BI renderer uses the same width policy.
- Focused shared/PBI selection and formatting suite: 39 passing tests. Screenshot review confirms narrow charts retain plotted data with a scroll affordance. Hosted Service/Fabric and local Desktop validation of these new axis controls is still pending; older target evidence does not cover this change.

### Waffle follow-up and broad regression

- Single-value Waffle: reproduced compact cell/value clipping; added scrolling and value wrapping. All 30 allocation/layout checks now pass, including 12 newly added single-value cases. Original allocation/data semantics remain unchanged.
- Shared chart-container interaction regression passes 41 checks. Full unit run: 718 pass, one existing alternate category-axis cross-filter contract failure remains. It was not skipped or weakened.
- Restricted independent-axis rendering explicitly to Line/Area to prevent stale configuration changing Slope after a visual-type switch. Inverted scales and independent scales now deactivate each other in the inspector.

### Cross-target and local-file acceptance � 2026-09-12

- Independent value axes: **85 native checks pass**, including 72 inspector controls across Line/Area and editor/viewer, lifecycle tests, six resize cases, and three stale-config exclusions. Invert/stack transitions are exercised inside lifecycle cases.
- Service QA report: **39 checks pass** over all four pages / 19 supported package types, standard/one/empty data, table sort/resize, and 16 native select/clear pairs. `service-page1.png` visibly shows independent Returns scales on Line/Area. No model writes.
- Hosted Fabric: newest deployed bundle hash matches local build; seven pages settle, dimension-only query, bar/pie/radar interaction, navigation and theme checks pass. The bottom-page screenshot shows Line/Area secondary-axis styling. This run predates the numeric tick precision repair below.
- Compiled web/Fabric: **86 checks pass**, including four additional Line/Area states with painted secondary-axis color verified. These artifacts predate the final numeric formatter repair and will be rebuilt.
- Local report: **9 production UI/IPC/database/file checks pass**. Started a new report from a copied local model, created Bar and Line through the library, assigned actual measures/category, enabled/titled the second axis in the pane, saved/reopened, and exported a real PBIP/PBIR retaining the configuration. `local-report-ui.json` records the isolated file path. This does not prove the new exported file has rendered in Power BI Desktop.
- Original PBIP source: **157/157 file hashes unchanged** (`local-pbip-preservation-latest.json`).
- FORMAT-NUMBER-066: Service screenshot review exposed duplicate `1k` ticks and unit tests exposed tiny values shown as zero. Shared formatter now retains six significant digits. **218 primitive/formatter/PBI tests and 12 native tick-label cases pass**. Final affected builds/hosted checks are in progress.

### Final formatter target round

- Full unit suite now **729 pass / 1 unchanged alternate category-axis contract failure**.
- App + standalone + Fabric embed + Power BI package builds pass; package lint passes. Existing certificate-tool and bundle-size warnings remain documented.
- Latest compiled artifacts: **86/86 checks pass**, zero events. Latest Fabric hosted renderer hash matches local; seven pages and real interactions pass.
- Service numeric formatter update: all four pages and standard/one/empty states rerun. Screenshot visually confirms `1k` / `1.2k` are distinct. Earlier full native selection run remains preserved separately (39/39 checks).
- Local exported two-visual report: seven Microsoft PBIR schema validations pass after the nine production UI/IPC/file checks. Desktop launch is being inspected separately. Debugging approach reference: https://learn.microsoft.com/en-us/microsoft-edge/webview2/how-to/debug-visual-studio-code (process-local environment only; no registry changes).

### Desktop independent-axis opening confirmed

The normal Power BI Desktop launch opened the two-visual report created through Vilsem. Screenshot `local-secondary-desktop-render.png` visibly shows Bar plus a two-series Line chart with the saved right-hand Returns axis, using the preserved local model. The first process-local diagnostic-flag launch remained at the splash screen; it was closed normally and the failure screenshot is retained. Retrying without diagnostic flags succeeded. This is observed default-state rendering, not complete Desktop interaction acceptance. The report file in that screenshot predates the last numeric formatter build; regenerating the local test report with the latest package next.

### Desktop and narrow-tooltip continuation

- Latest numeric formatter report visibly renders in Desktop: `local-secondary-desktop-latest.png` shows Bar, two-series Line, Returns title and separate 1k/1.2k ticks. Native Accessories selection filters Line to one category; repeat click restores all three (`local-secondary-desktop-selected.png`, `local-secondary-desktop-cleared.png`, selection JSON). Original model remains untouched.
- FORMAT-AXIS-067 reproduced: the new small-width scroll container clipped its default HTML tooltip. Shared repair appends to the current document body, clamps for chart transforms, and wraps long popup content within the viewport. Native suite now **87 pass**; related shared/PBI suite **41 pass**. Full unit result **730 pass / 1 existing failure**.
- Narrow Service Line/Area click/clear pass. Initial hover probes missed axis tooltips at the outer edge of the first dot; preserved failed evidence and reran a probe inside the plot. Do not mark hosted tooltip acceptance until its bounds assertion passes.

### Narrow Service tooltip verification

`service-secondary-tooltip.json` now passes all twelve checks: both 96px-wide Line/Area frames show a tooltip within their viewport, without scroll-ancestor clipping, and preserve category select/clear. Moving the hover probe five pixels inside the plot resolved the original QA probe failure; outer dot geometry is clickable outside the axis-tooltip trigger region. The normal-width gallery has been restored after this focused test.

### Exported measure-label follow-up

FORMAT-PBI-068 reproduced in Service (`Value`/`Secondary` instead of bound field names) and in four failing production-runtime cases. Power BI now derives automatic primary/secondary labels from the same DataView column positions used for values, with explicit user labels taking precedence. Rendering does not mutate the stored spec. Four chart-family rebinding/override cases now pass; related runtime/axis suite is 39/39. Rebuilding the package and checking actual hosted tooltip names next.

### Completed measure-label cycle

- FORMAT-PBI-068: **22 hosted Service checks pass** for Line, Area, Grouped Bar and Stacked Bar: named tooltips, visible popup bounds, category identity and deselection. Latest package build/lint pass. Evidence preserved as `service-measure-labels.json`.
- Full unit suite: **734 pass / 1 known alternate category-axis filtering failure**. No test skipped or weakened.
- Latest compiled web/Fabric check remains **86/86**, hosted Fabric bundle/hash/query/interactions pass. These targets do not use the Power BI-only label enrichment changed in this last cycle.
- Original local model still matches **157/157** recorded hashes. Desktop's two-visual report and selection evidence remain intact. No installer/release or Git push performed in this continuation.

### Waffle Power BI renderer pilot (2026-09-12)
- Traced Waffle dependencies and Power BI lifecycle; documented `docs/engineering/powerbi-dom-renderers.md`. Added a build-time ESM bridge importing the actual app component, explicit type allowlist, disposal before redraw/destroy, and matching theme/data mapping. Public export remains gated pending target acceptance.
- Native production-adapter verification: 29 checks PASS, zero console errors (`evidence/powerbi-waffle.json`); existing selection/axis/allocation tests: 44 PASS. Package build PASS. Initial lint scanned bundled React internals and reported 33 findings; generated artifact is now excluded like third-party dependencies, authored Power BI sources still linted. Lint rerun PASS. This is not a certification claim.
- Service pilot underway in the isolated QA report. No original semantic model changes.

- Waffle Service pilot: standard 69/16/15% allocation, single-category and empty-data states rendered; screenshots reviewed. Local Desktop also rendered the shared visual on a dark page. Enabled Waffle in the shared export registry (20 supported / 21 rejected).
- Found/fixed VIS-WAFFLE-069 (empty custom palette hides cells) and UX-WAFFLE-070 (missing library entry). Native adapter 30 PASS; app Waffle 30 PASS; full local UI creation/save/reopen/export PASS. Service/Desktop pilot screenshots predate the empty-palette patch; native regression verifies that fix.
- Package tool ignores project ESLint config; moved generated React bundle outside authored src/, so both package lint and direct lint pass without suppressing authored-source rules. Final package builds successfully; existing development certificate/pwsh warning remains.

### Fabric dependency follow-up
- Traced tar 7.5.16 to @microsoft/rayfin-tools-common 1.33.1 (~7.5.15); verified upstream advisories. Targeted npm update tar --ignore-scripts resolves 7.5.22 within that range; audit changes from 44 findings / 1 critical to 43 / 0 critical (12 high remain). Evidence: fabric-dependencies-after-tar.json.
- Deployment now installs dependencies and refreshes tar before semantic-model CLI setup and publication. Update/install failure stops the workflow; 9 failure/order tests PASS. Hosted QA deployment is underway; not yet marked verified.
- Waffle expanded Service gallery finished: 20 visuals, 4 pages, 39 checks PASS including 16 existing select/clear flows. Current full gallery restored after the focused pilot.
- Export QA previously stalled with background throttling; stopped that owned test process, disabled throttling, reran all 41 export controls PASS. No product behavior changed for this QA fix.

- First Fabric upload after tar update failed with fetch failed after successful model generation/build/archive packaging; evidence fabric-tar-deploy-first-failure.json retained. Retrying same isolated QA app; do not claim hosted verification yet.

- Fabric retry deployed successfully through the production pipeline after compatible tar update. The first upload failure remains in fabric-tar-deploy-first-failure.json. Final authenticated portal verification is running.
- Dependency scope: this fixes the generated project lockfile. Vilsem root/electron-builder dependencies and separately cached npx CLI trees are separate audits; no claim that all dependency findings are resolved.

- Fabric final portal verification PASS: deployed bundle hash matches, all 7 pages settled, dimension query and Bar/Pie/Radar selection/multi-selection/clear/navigation/theme checks passed. Marked DEP-FABRIC-071 verified only for generated-project tar; 43 remaining dependency findings stay open.

### Bullet / Progress cycle
- Traced the two DOM renderers and added them to the internal Power BI bridge pilot; export registry remains gated.
- Reproduced VIS-CARDS-072: 26/36 compact text bounds failures. Added shared layout policy (wrapping text, scrollable min-height content, non-shrinking tracks) without changing value/target math. After: 44 native bundled-component data/format/bounds checks PASS. Service packaging/real-model checks underway.

- Bullet/Progress actual Service pilot PASS with scalar standard/one/empty filters; Desktop screenshot confirms matching value/target/percentage/colors and dark page. Added library entries and enabled both export types (22 supported / 19 rejected). Local UI creation/binding/save/reopen/PBIP export PASS, 8 Microsoft schema validations PASS. Evidence: service-dom-card-pilot.json, local-dom-cards-desktop.png, local-dom-cards-ui.json.
- Regression: 62 package/binding/geometry tests PASS; all 41 inspector export controls PASS; DOM cards 44 PASS; Waffle 30 PASS after bridge extension. Final expanded gallery and rebuilt app/web/Fabric checks underway.

- Expanded Service gallery: all 22 visuals in standard/one/empty states PASS. Compiled app/web/Fabric build and 86 artifact smoke checks PASS, zero events. Original model 157/157 hashes unchanged.
- Full suite first run: 736 PASS / 2 failures (known alternate-axis contract plus tooltip runtime test at 5387ms). Isolated tooltip rerun PASS. Removed redundant per-test TypeScript compilation while keeping fresh VM/host/visual state and assertions/timeouts unchanged; full serial rerun underway. First full-run evidence retained in unit-dom-cards-first-run.json.
- Latest Fabric cards upload failed with fetch failed after successful packaging; retained fabric-dom-cards-first-upload-failure.json and retried same QA app.

- Final full unit rerun: 737 PASS / 1 unchanged alternate-axis cross-filter failure. Tooltip test stabilization retains all assertions and isolated state. Latest cards Fabric upload retry succeeded; final portal check underway.

- Final Fabric portal verification PASS: latest bundle hash matches, 7 pages settled, real query, tested selections/navigation/themes passed. Screenshot review of Bullet/Progress exposed a PBI-only duplicate-title mapping (FORMAT-DOM-073); corrected earlier caption interpretation after tracing AppSpecRenderer title/label clearing.
- Adapter now clears component title/label after drawing header. Six new title visibility/ownership cases PASS (36 native adapter checks total); rebuilding package for final hosted comparison. No app/Fabric renderer change in this title-only correction.

- Final package built and uploaded into full 22-visual Service QA report. Live Bullet/Progress title ownership assertion PASS: exactly one title, no duplicate footer; screenshot reviewed (service-dom-title-final.png). FORMAT-DOM-073 verified. Desktop screenshots predate this title-only correction. No installer/release or source-model changes in this continuation.


### Alternate category-axis selection cleanup
- Traced the remaining cross-filter failure: legacy alternate-axis bars still use local dimming; no host filter API changes made.
- Reproduced INTERACTION-AXIS-074 in native Electron: returning to an axis left an unselected sibling dim. Preserved failing evidence, then verified both native checks after clearing all local-selection attributes.
- Added reusable axis-switch-state QA suite; corrected priority-plan counts to 19 unsupported Power BI types / 43 generated Fabric dependency findings.
- Alternate-axis cross-filter compatibility remains unresolved; this fix only addresses stale local highlighting.

- Power BI selection runtime suite: 24 PASS; renderer lint PASS after axis cleanup.
- Reproduced legacy tooltip overflow in four of six native corner/long-content cases. Added bounded wrapping and coordinate clamping; six bounds checks pass. Logged remaining long-content interaction limitation separately in VIS-TOOLTIP-075; no claim of full tooltip accessibility or hosted acceptance.


### Legacy tooltip usability and lifetime
- Continued VIS-TOOLTIP-075: enabled interaction with bounded tooltip content, cancellable pointer-exit dismissal, focus and Escape handling, and cleanup during renderer disposal.
- powerbi-tooltip-bounds.cjs: 10 PASS in Electron; power-bi-selection-runtime.test.ts: 24 PASS; Power BI renderer lint PASS.
- Native assertions establish containment and interaction state, not live Service pointer/screen-reader acceptance. No hosted publication in this cycle.
- Power BI package build completed successfully. Existing development-certificate generation error (missing PFX / pwsh unavailable) and recommended-feature warnings remain; no installer or hosted release published.


### Legacy background selection handler lifecycle
- Reproduced INTERACTION-LIFETIME-076: three redraws caused three host clear calls from one background click. Replaced accumulating anonymous handlers in both legacy paths with a single owned handler, cleared on disposal.
- Regression covers HTML and fallback bar paths; native tooltip suite remains 10 PASS after renderer cleanup change. Renderer lint PASS.
- An initial edit command failed on Windows default text encoding before writing; repeated with explicit UTF-8. No product changes from the failed command.
- Hosted pointer/keyboard interaction verification remains pending; this cycle addressed the independently reproduced event-handler defect.


### Scalar card data integrity and editor title parity
- DATA-CARDS-077: Stat Card/Metric Tile ignored error and empty inputs. Four component assertions failed before fix; six pass after shared EmptyState guards. Valid zero remains rendered.
- Native editor/viewer query-error, standard, and zero checks: 12 PASS. Aggregate empty query fixtures intentionally return zero, so direct empty-row behavior is covered separately by component tests.
- Native output exposed duplicate editor titles; preserved before-title evidence and corrected title ownership for these two cards in CanvasEditor (FORMAT-CARDS-078).
- App and standalone export builds PASS for data-state fix (before the subsequent editor title-only adjustment). Existing bundle-size/tooling warnings remain.
- React checklist: no new effects/hooks/dependencies; shared atoms reused; authored configs not mutated; patch limited to demonstrated defects.

- FORMAT-CARDS-078 and DATA-CARDS-077: 24 native checks PASS (both hosts, both types, three states, title/data assertions).
- DATA-STAT-079: null current produced fabricated -100%, undefined produced NaN. Missing-current guard added; valid zero comparison preserved. Nine component checks PASS and two native editor/viewer null-result checks PASS.
- Broad suite launched before the null-comparison repair captured 746 PASS / 3 FAIL (known axis gap plus two freshly reproduced null cases). Preserved as unit-before-null-comparison-fix.json; a fresh full run is executing against final source.

- Final-source full unit suite: 748 PASS / 1 known alternate-axis cross-filter failure. New regression assertions all pass; no skips or weakened assertions.
- Final-source app and standalone web export builds both PASS. Bundle-size and existing tooling warnings remain. No cloud deployment, installer publication, or source-model modification in this cycle.


### Axis interaction research and local multi-selection
- Read Microsoft selection/filter API documentation: https://learn.microsoft.com/en-us/power-bi/developer/visuals/selection-api and https://learn.microsoft.com/en-us/power-bi/developer/visuals/filter-api.
- Traced current capabilities, legacy HTML axis metadata, and package binding guide. Alternate axes are generated as HTML sections; package guide does not bind config.axisOptions. Cross-target support requires a field-binding/rendering design and host tests, not merely restoring applyJsonFilter. Known failure remains open.
- INTERACTION-AXIS-080 reproduced for Ctrl and Command: second mark replaced first. Fixed local toggle/replacement logic without changing host API/capabilities. Production selection runtime: 28 PASS.


### Bound alternate-axis selection routing (major gap remains in progress)
- Added exact bound queryName resolution using axis table/column metadata; alternate marks now use the matching DataViewCategoryColumn with Selection API. Identical labels across fields no longer imply the same identity.
- Missing, ambiguous, and unbound fields retain local-only selection. Capabilities, field bindings and measures unchanged; no summing across extra dimensions introduced.
- Added positive click-routing/modifier/highlight and negative missing/ambiguous binding tests: 30 production-runtime tests + 11 parity checks PASS; renderer lint PASS.
- Replaced the old source-text assertion demanding applyJsonFilter with bound-selection routing assertions and runtime behavior coverage. That check becoming green DOES NOT establish export axis support or hosted slicer compatibility.
- Pending for this major issue: package/report alternate-field binding and independent per-axis measure evaluation, axis-switch persistence/reset, Service native-slicer and sibling-visual verification. Do not mark the overall axis gap Verified.


### Completed export coverage cycle: Stat Card / Metric Tile
- Added both real app components to the shared Power BI DOM bridge and supported-type registry; added discoverable library entries.
- Native adapter 48 PASS, focused export/package/scalar 71 PASS, Power BI package build PASS.
- Published only the existing isolated Service QA report: 24 visuals across four pages, default/one/empty states. Reviewed service-scalar-cards.png; cards display 84.2k and retained title/theme.
- Ran actual local-model Vilsem create/bind/save/reopen/PBIP export: 10 PASS, 8 Microsoft schemas PASS, source manifest 157 hashes unchanged.
- Support increased from 22 to 24; rejected types decreased from 19 to 17. New Desktop opening, latest hosted Fabric deployment, and exhaustive formatting/size acceptance are not claimed.
- Axis/export architectural investigation remains open; Microsoft mapping docs consulted. No unsafe client summation or capability change introduced to claim axis support.


### Nine additional app renderers in Power BI
- Added Funnel, Waterfall, Heatmap, Ranked List, Chord/Sankey, Sunburst, Narrative/Insight to the explicit DOM bridge and export registry.
- Native production adapter: 120 checks PASS, including 72 new theme/data-state cases. Export guide/package tests: 70 PASS. Package build PASS, existing certificate/optional feature warnings retained.
- Service readiness now counts mounted DOM adapter roots rather than assuming every non-ECharts visual has a value bar or Waffle grid. Gallery types come from the shared registry.
- Existing Sankey-as-Chord and single-ring Sunburst semantics remain explicit limitations, not silently claimed fixed.
- Eight remaining types and concrete dependencies recorded in engineering/powerbi-remaining-renderers.md. They remain gated.

- Service 33-visual/six-page run completed standard/one/empty states; visually reviewed new pages 5 and 6. Evidence preserved in service-33-visuals.json. Eight types remain explicitly gated, not declared complete.


### Shape / Divider no-data lifecycle
- Consulted Microsoft no-dataroles and landing-page documentation: supportsEmptyDataView and supportsLandingPage allow updates without field bindings.
- Added no-data update dispatch for baked Shape/Divider only; unbound data charts retain empty state. Reuse real SVG/CSS app components with no added card chrome.
- Added opt-in static-object mapping for direct PBIR construction and zero-measure allowance only for these types. Legacy generated-measure mapping remains unchanged by default.
- Renderer runtime 33 PASS; mapping/local report/export guide 78 PASS; native adapter 122 PASS; package build PASS with existing certificate/tooling warnings.
- A 35-type Service run is executing against a new six-page QA report definition; no source semantic-model changes.

- Service retry succeeded: 35 visuals / six pages; visually inspected star and divider with no field bindings. First ECONNRESET upload retained as failure evidence.
- Native adapter expanded to 137 PASS: all 11 shapes, six divider orientation/styles. Full unit suite 766 PASS / 0 FAIL.
- Actual local Vilsem object creation/save/reopen/export: 10 PASS; 8 PBIR schemas PASS; 157 original source hashes unchanged.
- Six gated types remain. No claim of complete alternate-axis export, Desktop opening, newest hosted Fabric acceptance or all-property coverage.


2026-11-02: Core/MCP kickoff underway on feat/core-package. Extracted headless workspace, renamed renderer preserving GUID/spec key, added native ECharts interaction contracts and additive PBIR insertion. Focused 50 checks passed; complete Electron build and packaged-core smoke passed. See docs/engineering/core-mcp-progress.md for scope and remaining work.

2026-11-02: Core follow-up shares ranking/time-template ordering and adds structured escaped DAX bindings. Full suite 788 PASS. MCP fixture/stdio/template suite 26 PASS; live configured Fabric schema + all 79 column samples + PNG preview passed. No Desktop engine was running. Public and private core main/tag publication completed for 0.1.0; patch distribution underway.

2026-11-02 delivery: application/core 788 PASS in both checkouts; complete Electron build and packaged imports PASS. Both repos main + core-v0.1.0/core-v0.1.1 published, renderer 4.13.1.0 retains GUID/spec key. New public vilsem-mcp main + v0.1.0 published: 27 tests PASS, dependency audit 0, GitHub npx/stdio smoke PASS, live Fabric schema/79 samples/qualified scalar PNG PASS. Desktop no-engine response verified; successful Desktop connection/reload and live native host interactions remain unverified. Original local PBIP data was not edited.


### 2026-11-02 - standalone model connections
- Extracted Desktop discovery/ADOMD, Fabric introspection, DAX and Microsoft auth into @vilsem/core/connect; Electron compatibility wrappers delegate to core. No renderer/IPC dependency.
- MCP no longer loads app checkouts. Added explain_visual. Device code uses scoped private home refresh-token cache and correct polling; SP and injected PKCE are retained.
- Desktop core connection: port 61645, process-workspace-port-file, 13 tables / 39 measures. No model changes.
- Initial app suite: 795 passed; focused final connection/auth suite: 8 passed; MCP suite: 28 passed. Fixed advisory Desktop process inspection timeout blocking insertion.
- Releases, packaged smoke and live Desktop visual/reload/cross-filter acceptance remain in progress.

- Final release gates: 797/797 tests passed in both private and sanitized public checkouts; nine connection/auth tests included. Full renderer/UI/standalone/Fabric/Electron installer build passed. Packaged Electron core bridge auto-discovered Desktop and returned 42 from real DAX. Standalone Fabric SP smoke read 20 tables/97 measures and returned 42. No credentials/model IDs/sample values published. Existing app dependency audit (45 findings) and unsigned installer are unchanged limitations.
- Added explicit ESM entry point after import smoke found missing direct named exports. Public core tarball packed from the public release source. Desktop host reload/render/cross-filter acceptance is next after releases.

### 2026-11-02 - live Desktop acceptance and OAuth completion
- Published core-v0.2.0 and MCP v0.2.0; isolated GitHub install proved connections need no app checkout. Added explain_visual.
- Live Desktop checklist passed: process-workspace-port-file on 61645; 13 tables / 39 measures; real three-category PNG; additive commit; actual reload banner and confirmation; real host render. Accessories selected in Vilsem changed a native revenue card from $25M to $907K (906673.107); empty-area click restored $25M. Saved/reopened Vilsem MCP QA page.
- Fixed live schema failures: 13 internal row identities explicitly skipped and field-parameter composite keys sampled via row projection. MCP v0.2.1: 30 tests; live and fresh GitHub-installed server retests had zero sampling failures. Reopened engine auto-detected on 62232.
- Desktop save rewrote culture/synonym metadata. Backed it up, closed normally, restored it, and verified all 19 model-definition files match their initial hashes. Original supplied PBIP source folder untouched.
- Final source audit found remaining OAuth protocol blocks in Electron. Moved PKCE/state/redirect/code exchange and scoped OneLake SP auth to core; Electron retains only its browser lifecycle/IPC. Fixed reauth promise not resolving after it claimed the redirect before close. Added protocol, browser-handoff and auth-error compatibility regression tests. Final suites and packaged smoke running before core 0.2.1 follow-up release.

- Final OAuth completion gates: 811/811 tests passed in both private and sanitized public checkouts; 23 focused auth/connection tests included. Latest Electron directory package built and actual packaged OAuth API + ADOMD query smoke passed on reopened port 62232. Core 0.2.1 tarball packed from tested public source. Full initial renderer/UI/standalone/Fabric/installer build also passed. Live browser device-code/PKCE login remains not tested; protocol, refresh, state validation and UI handoff use automated regressions.
- All requested Desktop checklist steps passed, including real native cross-filter and deselection. A fresh GitHub-installed MCP 0.2.1 confirmed zero schema sample failures after report reopen; validate_visuals also passed on the Desktop-saved container.

- Published/merged/pushed final follow-ups: core-v0.2.1 on both app remotes and MCP v0.2.2. Requested 0.2.0 tags remain available; MCP 0.2.1 contains the sampling correction. Final fresh GitHub v0.2.2 install outside app checkout passed: core 0.2.1, ten tools, auto-detected 62232, real three-row preview and saved-visual validation, no app-path or cloud-auth environment variables. Source gates: 811 tests in each app checkout; 30 MCP tests; MCP audit zero. All 19 model definitions still byte-identical. No requested Desktop checklist item remains unverified; live browser authentication and broader host interaction variants remain explicitly outside the completed acceptance.

### 2026-11-02 - template expressiveness and live Desktop cycle
- Inspected core resolver, template shaping, row normalization, MCP tools/resources, renderer category boundary/chart registry and existing tests; authored ten scratch specs using freshly discovered sample-model fields.
- Captured exact baseline failures through MCP stdio. Added six category slots; weighted links, hierarchy, UTC dates/take, ordered sum/lag/share and facet/repeat; bounded expansion, strict names/tokens, null reference handling and transformed source-row identities. Added native Sankey/sunburst/graph registration and explicit template backgrounds.
- Real PNG inspection caught a blank Gantt caused by ADOMD /Date serialization; fixed ISO output and verified an independent DAX date query. Empty previews caught markLine null-coordinate crashes. Desktop caught forced-transparent backgrounds and stale renderer instances; fixed backgrounds and verified save/reopen. Sankey label overlap handled by labelLayout.hideOverlap and retested through all four MCP tools.
- Created Expressiveness page in Desktop UI and committed nine passing visuals; Marimekko refused explicitly. Recorded category-(c) sandbox design and security requirements; no imperative callback implemented.
- Gates: private/public source suites 843 pass each; MCP 44 pass; final renderer native package exit 0. All 19 model definitions match original hashes after normal close/restoring Desktop culture normalization/reopen. Original supplied PBIP untouched.
- Shipped examples/resource catalog and format docs updated in MCP. Release/isolated-install acceptance recorded after publishing below.
- Final authored-template correction: Desktop revealed a profit target above the automatic axis extent. Reused existing calculate to include the reference domain, added an SVG/domain regression and verified the 825,829.77 line in actual Desktop. MCP release suite increased to 45 passing tests against the published core tarball. Minor default axis endpoint labels can retain long numeric precision; exhaustive formatting polish remains outside this ten-template expressiveness acceptance.
- Published core-v0.3.0 and MCP v0.3.0; both app remotes and MCP main updated. Shipped MCP archive contains exactly nine passing templates; failed Marimekko spec remains a documented fixture. Isolated GitHub install under D:/cache has no application-path setting and no dependency on a local app checkout; final live smoke is recorded next.
