## Round 3 current checkpoint - 2026-11-06

Core **0.7.2 / renderer 4.42** and MCP **0.7.3** are published evaluation
prereleases on public main. Private/public app-core suites each pass **1,357**
tests; the frozen MCP suite passes **311**. Full app build passes. Real Desktop
port **62071** was auto-detected; both newer-declared visuals pass real-data
edit/restore, and validation accepts **170/170** Vilsem visuals with two explicit
known-contract warnings. All **15 native fixture files / 21 model files** are
unchanged. Newer declarations are preserved; full declared-schema validation
is not claimed.

Native interaction, final paint/export and bookmark acceptance remains
**BLOCKED/UNVERIFIED** (supported helper pipe OS error 2). The **5,000-point
animated frame-rate target FAILS**. No point dropping, hidden motion disabling
or rejected batching is enabled. This is not full Round 3 production sign-off.
See [current evidence](stress3/round3-follow-up.md) and its native checklist.

## Stress round3 - core/MCP0.6 published; GroupC next

Core **core-v0.6.0** (`67899a3`) and MCP **v0.6.0** (`df7e783`) are pushed to public main and released. Clean public app/core **1168/1168**, MCP **225/225**, and renderer/UI/Fabric/Electron builds PASS. The69property contract includes independent axes and automatic bounds. Fresh standalone install uses the real public core URL, no app path/override; live Desktop schema, preview/variants, prompt/resource and commit/read/dry-run/update PASS. Published MCP hash matches. All21owned QA model definitions remain unchanged. Audits: root6moderate, native13moderate+4low, UI/MCP0;0high/critical.

Real-data Sankey before/after previews were inspected and polished; native Sankey/manual-pane acceptance remains **UNVERIFIED** because Windows ComputerUse cannot connect and SDK snapshots are blank/time out. Seeded manual formatting/query retention is tested, not claimed as a native gesture. Physical Ctrl-click/stale-selection retries and historical screenshot regeneration remain explicit limits. [GroupB evidence and limits](stress3/group-b-status.md), [GroupA evidence and limits](stress3/group-a-status.md). GroupC expression geometry, motion, template memory and reference-image work begins next.

---

## Stress round 2 - 2026-11-03

111/120 rendering PASS; nine exact category-(c) refusals. Private and clean public app/core suites:956/956 each. MCP:167/167. Native renderer4.31 selection/helper-opacity fix and Desktop filter/clear numerical change verified. All19 model definitions match baseline; original PBIP untouched. MCP audit0; app workspace45 unresolved. Core core-v0.4.0 and MCP v0.4.0 published; published-core MCP167/167 and isolated live install PASS, public Git-tag install/stdIO/catalog/scratch validation/fixture PNG PASS. Detailed evidence, limitations and all120 results: [stress2 status](stress2/status.md).

---

## Latest: MCP expressiveness cycle - 2026-11-02

- Ten new templates authored independently; nine pass validate_spec, explain_visual, real-data preview and commit_visual on the new Expressiveness page. Marimekko is the sole category-(c) refusal; its sandboxed-extension design is documented, not implemented.
- Native Desktop renderer 4.14.2.0 tested through actual import, external-change reload and saved report reopen. Explicit dark template backgrounds survive on a white native page. Core 0.3 includes relational/tree/facet/window/date shaping and preserves transformed row identities.
- Source gates: **843/843 app/core tests** in both private and sanitized public checkouts; **45/45 MCP tests**. Native renderer package command exited 0; JS in the release package matches the imported package.
- Saved containers: 10 valid Vilsem visuals (nine new + prior QA); native visuals excluded by design. All **19 model definition files byte-identical** after restoring Desktop culture normalization and reopening. No model changes were made by the MCP.
- Desktop auto-discovery: process-workspace-port-file, initial 62232 / reopened 57597. Evidence: ignored MCP test-results/expressiveness; detailed PASS/failure classes and verification limits in [expressiveness-gaps.md](../expressiveness-gaps.md).
- This is the ten-template expressiveness acceptance. It does not close broader Service/Fabric, interaction-variant, installer or certification backlog. Network/Gantt samples and prior-period semantics are explicit in the format documentation.

---

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

# Latest continuation evidence

## Latest continuation ? 2026-09-12

- Full unit suite: **748 pass / 1 existing failure**. The remaining alternate category-axis Power BI filter contract is still open; it was not skipped or weakened.
- Line/Area independent value axis: **87 native inspector/lifecycle/resize/type-transition/tooltip checks pass**. Eighteen controls are opt-in; narrow dual-axis plots scroll. PBI composition and real Service/Fabric screenshots confirm independent scales.
- Number formatting: **218 focused tests + 12 native tick cases pass**. The Service screenshot now shows distinct 1k/1.2k ticks. Tiny nonzero values remain nonzero. All caller data/domain semantics remain unchanged.
- Waffle: **30 native data/layout cases pass**, including twelve single-value compact cases.
- Compiled web/Fabric: **86 checks pass**, including four painted secondary-axis states, with no console errors. Latest bundles rebuilt after Bullet/Progress compact-layout fixes.
- Service: full interaction run **39 checks pass**, including sixteen native select/clear pairs (`service-independent-axis-interactions.json`). A subsequent formatter-only update reran all four pages in standard/one/empty states (`cloud-gallery.json`).
- Hosted Fabric: latest bundle hash matches the local build; seven pages settled, real query, bar/pie/radar selection, navigation and themes pass (`fabric-portal-audit.json`).
- Local report: **9 UI/IPC/database/file checks + 7 Microsoft PBIR schema checks pass**. A new Bar/Line report created in Vilsem retains its independent-axis configuration in saved Vilsem state and exported PBIR. Power BI Desktop visibly renders both visuals and the saved Returns axis. Native Bar selection filters Line to Accessories; repeat click restores all categories. The initial diagnostic-flag launch stalled; normal launch succeeded.
- Original PBIP source: **157/157 file hashes unchanged**. Existing model structure and measures preserved.


### Latest DOM card / dependency cycles
- Power BI support: **22 supported / 19 rejected types**. Waffle, Bullet and Progress reuse the actual app components; all three rendered in Service and Desktop and passed local Vilsem creation/save/reopen/PBIP export.
- All 41 inspector export actions pass. Waffle adapter: 30 checks; Bullet/Progress data/format/compact bounds: 44 checks; package/binding/geometry: 62 tests. Local Bullet/Progress export passed 8 PBIR schema validations.
- Latest Service gallery: 22 visuals / 4 pages, standard/one/empty states verified. Prior 16 select/clear flows remain recorded separately; these three DOM cards have no mark-selection handlers.
- Generated Fabric dependency update: tar 7.5.22, zero critical findings; **43 findings remain**, including 12 high. Required dependency-update failures stop deployment. Upload fetch failures were retained; retries succeeded.
- First full test run had an additional 5387ms tooltip-test failure. Isolated reruns passed; compiled test source is now reused with fresh per-test VM state. Final serial full suite: 737 pass / 1 unchanged alternate-axis failure. Assertions and timeout were not relaxed.

Remaining: 19 unsupported package visual types, complete per-property/extreme-size acceptance, alternate category-axis cross-filtering, remaining target drill/multi-select states, placeholder semantics, generated Fabric dependency findings, release/installer acceptance, then AI editing and Ollama. This is not production certification.


- Native app interactions: **41/41 pass**, including bar-race tooltip trigger/reset, modifier selection, drill and resize checks. `evidence/interaction-audit-after.json`.
- Hosted Service: latest isolated static-host run passes all **16 selectable types** for native category selection and deselection, plus table sorting/resize. `evidence/cloud-gallery.json` now records the latest four-page reload, standard/single/empty states, and 39 passing checks. An earlier run lost its development-host state and remains preserved as a failure.
- Text tokens: **5/5 native Electron DOM cases pass** for literal names, attributes, Unicode and surrounding formatting. Full caret workflow remains separate.
- Power BI package writer: four actual-template archive/spec/JavaScript tests pass, including replacement-sensitive titles. Build the renderer first; this integration suite explicitly skips without a template.
- Power BI package build succeeds; standalone lint now passes. Certificate/pwsh warning remains unresolved. Current fixes are not included in the published beta.3 installer.
- Per-control sweep completed: **41 visual types, 3,924 attempts**, one deliberate query-failure event and no unexpected errors. State/fingerprint screening is not semantic property certification. See [control coverage](format-control-coverage.md).
- Visibility sweep completed: **1,230 cases**, 36 deliberate query failures, no unexpected errors/image failures; **156 clipping candidates**, including 75 with non-ellipsis text. These remain review candidates, not 156 confirmed bugs.
- Fabric deployed bundle hash matched the local build. All seven gallery pages reached expected content after correcting premature screenshot readiness. Real-model dimension query, bar/pie/radar filtering, navigation and light/dark theme checks passed. `evidence/fabric-portal-audit.json`. The deployed bundle includes the Waffle allocation/layout and bar-race control changes. This is a gallery/default-state pass, not all-state hosted certification.
- Latest full unit suite: **711 pass / 1 known alternate-axis cross-filter failure** (712 total). Built web/Fabric smoke checks: **82/82**. Original PBIP source preservation: **157/157 hashes unchanged**.
- Bar-race playback controls: **16 editor/viewer size cases pass** with timeline input retained, after reproducing overflow in six narrow cases. `evidence/race-controls-before.json` and `evidence/race-controls.json`.
- Independent secondary-axis formatting/scales, legacy alternate-axis cross-filtering, unsupported local export types, all-state hosted acceptance and installer lifecycle remain open.

- Additional verified export checks: every registry type through inspector export (**41/41**): 19 supported types preserve their type; 22 unsupported types reject before Save. Package writer rejects malformed specs and unsupported types. This is a correctness boundary, not new renderer support.
- Waffle: **6 native data + 12 compact-layout cases pass**, with five allocation unit tests. Zero totals no longer show NaN and nonzero segments allocate exactly 100 cells. Current Fabric deployment shows the corrected real-data Waffle shares.
- Power BI title header: **5 native DOM cases pass** after adopting shared title styling; related 33 runtime/axis/playback tests pass. Latest package/lint build succeeds. This title-specific change is newer than the last Service gallery reload.
- Fabric existing-folder preservation: **8 automated deployment checks + 3 native dialog checks pass**. A new deployment cannot delete an existing local project folder; the dialog supports renaming and retrying.


---

# Current verification status ? 2026-09-11

Current target evidence is tracked in [visual cycles](visual-cycles.md) and [work log](work-log.md). The older baseline below is historical; its blanket untested statements are superseded by these scoped results.

- App: 299 data checks, 237 settings-pane checks, 40 interaction/tooltip/animation checks passed. Grouped/stacked/bar/column drill modes: 16 checks passed.
- Visibility: 1,230 scenarios executed; 156 DOM clipping candidates need classification. All 36 logged errors belong to deliberate query-failure fixtures.
- Compiled web/Fabric bundles: 82 smoke checks passed; this does not establish hosted parity.
- Service: isolated four-page report renders 19 primitive types. Standard/single-category/empty scenarios exercised; defects and retests tracked in bug-log.md. Default native category selection and deselection pass for 16 selectable types; see evidence/service-native-summary.json. Other Service paths, all properties, multi-select/drill/playback and every interaction remain incomplete.
- Fabric: isolated 41-object app loaded across seven pages inside the authenticated portal. Real dimension-only query, native bar selection/deselection/Ctrl-multiselection, radar selection/deselection, page navigation and theme switching pass. Pie clipping (VIS-PIE-034) is corrected and visually verified after deployment. Hosted pie native single/multi/remove/clear filtering also passes. Hosted scatter, bubble, lollipop and slope native selection/clear also pass (8 checks). Individual visual semantics, all formatting states and remaining interactions are not fully verified.
- Local Power BI: all 19 supported primitives render across four Desktop pages, including dark theme. Saved and reopened the separate QA report. Original 157 source files match their hashes. Unsupported local types, slicers and drill remain gaps.
- Build/package succeeds with unresolved pbiviz lint/certificate warnings. Latest unit suite: 625 passed, one known secondary-axis cross-filter failure (626 tests).

## Post-beta.3 table cycle

Seven production-method Electron table checks pass, including mouse resizing, sorting/reset, literal formatting and scalar values. Hosted Service sorting/reset and keyboard resize pass against the actual model. These changes are newer than the published beta.3 installer. Desktop-specific table retest and persistent widths/sort remain pending.

## Historical baseline

# Regression status — 2026-09-07

**Audit and repairs in progress; not release-ready certification.**

Current results: [verified fixes](fix-status.md). **450/454 unit tests pass**, with only four original failures remaining. **299/299 all-type field-change checks**, **52/52 focused host regressions**, **10/10 authoring checks**, and **3/3 Home/IPC/storage checks** pass. Native interactions: **11/12**, remaining Ctrl-click gap. AI/persistence contracts: **11/15**, remaining patch/type/key issues.

All **1,230** after-fix data/size cases completed across 41 types in both hosts. The only 36 console errors are intentionally injected query failures; clipping acceptance remains partial (164 DOM text candidates). Desktop, standalone and Fabric bundles pass. See `*-after.json`, `fixed-suite.json`, and `visual-fix-regressions.json` under evidence.

## Before-fix continuation results

Current results are maintained in [full audit report](full-audit-report.md) and [runtime matrix](runtime-test-matrix.md), with [evidence limitations](audit-coverage-limitations.md).

- Full Vitest suite: **432 passed / 12 failed / 444**. Four original failures plus eight new expected-behavior regressions.
- 82 default production host mounts; 5,178 inspector attempts. All 72 corrected valid Hex inputs update state. These are screening results, not every-property correctness certification.
- Production contracts: **9 passed / 6 failed / 15**. All 41 visual specs survive ordinary isolated disk save/reload; rename collision overwrites another project.
- Native interactions: **9 passed / 3 failed / 12**; 28 custom-template host renders.
- AppGenerator workflow: **10 passed / 10** using synthetic transports, including create, duplicate, delete, measure assignment, save, initial-spec reopen, selected AI title response and multi-page preservation.
- Edge v3 completed **1,230 unique cases**, with 164 text-clipping candidates and 454 console events. It supersedes v2 timing-limited results. All 41 standard editor screenshots were reviewed; Sunburst additionally waits for label animation completion. See clipping-review.md and visual-review-findings.md.
- Active default builder config verified to exclude .env. Installer remains untested; explicit legacy YAML still differs.

## Initial checkpoint evidence (historical)

| Check | Outcome | Evidence / scope |
|---|---|---|
| Repository/entry tracing | Partially inspected | architecture.md and visual-inventory.md; not every branch audited |
| Existing Vitest suite | FAIL: 428 passed, 4 failed / 432; 25 passing, 3 failing files | baseline-tests.json; QA-BASELINE-001 |
| Desktop launch | PASS for isolated unconfigured profile | evidence/desktop-smoke.json; real electron/main.js and preload |
| Sign-in UI interaction | PASS for Service Principal tab transition | desktop-startup.png, desktop-service-principal.png; no credentials submitted |
| Production leaf renderer scenarios | Executed 369; FAIL due to runtime console errors | renderer-smoke.json: 41 IDs × 9 cases, 33 console events; line-family hook-order failure |
| Empty Funnel | Reproduced defect | Stage 1/2/3 with 100/65/40 for rows=[] |
| Custom App Spec validator | Reproduced defect | Registered custom type rejected |
| Dimension-only table normalization | Reproduced defect | Validator accepts; normalizeLayout removes visual |
| Overflow candidate scan | Partially tested | Scroll metrics only; no host clipping or visual-approval claim |
| Desktop UI production bundle | PASS | Vite 5.4.21, 3,329 transformed modules, 43.24s; separate cache output |
| Standalone production bundle | PASS | 1,467 transformed modules, 29.01s; separate cache output |
| Fabric renderer production bundle | PASS | 1,464 transformed modules, 23.86s; separate cache output |
| Installer/package manifest | Not tested | BUILD-001 conflicting configuration investigated before packaging |
| Clean dependency install | Not tested | Existing installed dependencies used |
| Every formatting control | Not tested | property-coverage.csv is a discovery backlog, not coverage proof |
| Full creation/field binding/resize UI | Not tested | Leaf tests bypass authoring host |
| Cross-filter/multi-select/drill | Not tested end to end | Source trace and existing tests only |
| Save/load/reopen and failures | Not tested end to end | Isolated profile startup only |
| Live model/data and cloud AI | Not tested | No development account/provider session established |
| Power BI/Fabric publish | Not tested | No external resources modified |
| Approved visual regression snapshots | Not established | Exploratory viewport captures only; not every visual captured |

Runtime versions observed: host Node 24.14.0; Electron 41.10.7 with embedded Node 24.18.0; Vitest 3.2.7; Vite 5.4.21. Installed versions can differ from manifest lower bounds.

Build warnings: Vite CJS API deprecation, PostCSS module-type warning, stale Browserslist data and large chunks. Desktop JS is ~2,260 KB minified; standalone ~1,628 KB; Fabric IIFE ~1,627 KB. These are build measurements, not startup/performance benchmarks.

No bugs are marked FIXED or VERIFIED. Transient error boundary recovery does not turn console failures into passes. The initial renderer harness was corrected to report console failures in its exit code, supply a valid custom template, shape bar-race rows and pass area type context. Final evidence reflects that corrected harness.

Next gate: inspect effective packaging config, then focused regressions and minimal fixes for line transitions, fabricated empty data, table normalization and custom validation. Host-level visual/property/AI testing remains substantial work.


### Formatting controls follow-up
See [format control status](format-control-status.md) and [per-control matrix](control-acceptance-matrix.csv). Four reproduced issues repaired;326 applicable semantic assertions pass,126 applicability exclusions are not passes. Every exposed setting remains the acceptance target; the inventory is not a full-test claim.

## Waffle cross-target acceptance update (2026-09-12)
- Power BI export now supports 20 types (21 still rejected). Waffle shares the app component and was verified in native Chromium (30 checks), actual Service standard/one/empty states, Desktop default rendering, and local Vilsem creation/save/reopen/PBIP export (9 checks, 7 schema validations).
- Expanded Service gallery: 20 visuals over 4 pages; 39 checks PASS, including 16 existing select/clear flows and table controls. Waffle does not implement mark selection.
- App Waffle 30 PASS; inspector export all 41 types PASS; compiled web/Fabric 86 PASS with zero events; full unit suite 734 PASS / 1 unchanged alternate-axis cross-filter failure. Original PBIP 157/157 hashes unchanged.
- DEP-FABRIC-071 dependency remediation is underway and is not yet verified.

### Final Bullet / Progress verification
Latest app/web/Fabric builds and 86 compiled smoke states PASS. Hosted Fabric bundle hash matches; seven pages settled and tested query/selection/navigation/theme flows PASS. Native Power BI DOM adapter now has 36 checks, including six header/title ownership cases. Latest full suite: 737 PASS / one known alternate-axis failure; subsequent title-only adapter change passed all 24 runtime tests. Final package build and actual Service title ownership assertion PASS (service-dom-title-final.json). Desktop screenshots predate this title-only correction.


### Follow-up: legacy Power BI axis state and tooltip bounds
- INTERACTION-AXIS-074: 2 native Electron checks PASS; returning to an alternate axis now clears all stale dimming. Existing 24 selection runtime checks PASS and renderer lint PASS.
- VIS-TOOLTIP-075: 6 native tooltip bounds checks PASS after four reproduced failures. Long overflowing hover content accessibility and hosted acceptance remain pending.
- These checks exercise the production legacy class in Electron DOM; they do not resolve the known alternate-axis host cross-filter failure.


### Tooltip interaction follow-up
Legacy Power BI tooltip native coverage is now **10 PASS** (six bounds cases plus hover retention, focus/scroll capability, Escape and lifecycle cleanup). Selection runtime **24 PASS**; renderer lint **PASS**. Pointer travel/wheel and screen-reader acceptance in the hosted Service remain pending; keyboard discovery from the chart marks is not yet covered.
- Power BI export package rebuild: PASS. Development-certificate generation and optional-feature warnings remain.


### Legacy selection handler lifecycle
INTERACTION-LIFETIME-076: repeated legacy HTML/fallback bar rendering now retains one background-clear handler and removes it on disposal. Focused production-class regressions cover both paths; native tooltip suite remains 10 PASS. Hosted acceptance remains pending.


### Scalar card correctness and consistency
- DATA-CARDS-077 / FORMAT-CARDS-078: 24 native editor/viewer assertions PASS for error/standard/zero state and one title.
- DATA-STAT-079: two native missing-current cases PASS without fabricated comparison; legitimate zero comparison retained by component regression.
- Nine scalar component tests PASS. Native deterministic transport exercises actual editor/viewer renderers, not live Fabric data.
- Power BI support count remains 22 supported / 19 rejected. No additional target enabled or published in this cycle.
- Final-source full unit suite: 748 PASS / 1 known alternate-axis failure. App and standalone web export builds PASS after all three card fixes.

### Alternate-axis modifier selection
INTERACTION-AXIS-080: 28 focused selection runtime tests PASS, including Ctrl/Command addition, removal, plain replacement and deselection. Renderer lint PASS. Alternate-axis host cross-filtering remains open; full-suite baseline above predates these two added tests.


### Bound alternate-axis selection checkpoint
41 focused selection/parity tests PASS and renderer lint PASS. Bound alternate fields now use their own Selection IDs. The historical applyJsonFilter source-text failure is superseded by runtime identity tests; the full suite has not been rerun at this checkpoint. **Major axis gap remains open:** export field binding, independent measure semantics, switch/reset lifecycle and hosted slicer acceptance are pending. No additional export support or hosted verification is claimed.


### 2026-11-02 - standalone core/MCP and actual Desktop acceptance
- Scope: model connections and Microsoft auth extraction, custom-only MCP authoring, Desktop acceptance. This does not close the broader visual-product backlog above.
- Requested core-v0.2.0 / MCP v0.2.0 tags published. Live sampling fix published as MCP v0.2.1. Remaining OAuth protocol extraction is included in core 0.2.1 follow-up; final package gates recorded in work-log.md.
- Isolated GitHub MCP install: no Vilsem checkout, no app-path environment requirement. Desktop discovery used CIM -> Desktop-owned msmdsrv -> workspace port file. Checklist port 61645; after saved-report reopen, 62232 was auto-detected by the same method.
- Live get_schema / explain_visual / preview_visual / commit_visual / validate_visuals: passed. Fresh installed v0.2.1 schema: 13 tables / 39 measures / 96 columns, 13 explicit internal skips, zero sample errors.
- Desktop reload banner and confirmation observed and applied. Actual render captured. Accessories selection changed native revenue card $25M -> $907K (906673.107); empty-area click restored $25M. QA page saved/reopened successfully.
- Additive MCP write: all 135 pre-existing report files byte-identical immediately after insertion. Source PBIP folder untouched. Desktop's culture rewrite was backed up/restored after normal close; all 19 model definition files match initial hashes after reopening.
- Private evidence: D:/vilsem-mcp/test-results/live-desktop-v020 and live-desktop-v021; open report is the cache QA copy, page Vilsem MCP QA. Customer samples/credentials are not published.
- Not live verified: browser device-code/PKCE sign-in, incoming cross-highlight variants, drill-through destinations, bookmarks and every tooltip configuration. These have narrower automated coverage; the cross-filter OUT checklist is live verified.

- Final release outcome: core 0.2.1 and MCP 0.2.2 published; main pushed in private/public app repos and MCP repo. Both app/core suites 811 passed; MCP 30 passed; full MCP audit zero. Fresh installed latest server confirmed port 62232, real-data PNG and persisted visual validation without an app checkout. Desktop checklist complete; saved QA page remains open with selection cleared.

2026-11-06 skill/sharpness evaluation: app/core 1367/1367 tests per checkout, MCP 338/338, native packaged browser 20/20; fresh public package/stdIO/skill CLI and Claude resource reads PASS. Core0.8/renderer4.43 and MCP0.8 prereleases published, main branches updated. Native manual renderer upgrade/three real-data layouts plus SVG calendar context/zoom checked. Six-page Service QA created; rendering/manual scaling checks unverified, dense performance target FAIL. See skill-sharpness-080.md.

2026-11-06 - Live Edge Service rendering follow-up supersedes earlier browser-access blocker: all6QA layouts at browser100/150 visible; hero/leaderboard DAX values match. Both painters selection/clear/native tooltip/context menu checked. Tiny canvas text at small Fit remains soft. Native cross-filter fixture/Ctrl/bookmarks/Windows scaling and dense performance remain unverified/failing respectively; see skill-sharpness-080.md.
