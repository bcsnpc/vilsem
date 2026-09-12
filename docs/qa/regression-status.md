# Current verification status ? 2026-09-11

Current target evidence is tracked in [visual cycles](visual-cycles.md) and [work log](work-log.md). The older baseline below is historical; its blanket untested statements are superseded by these scoped results.

- App: 299 data checks, 237 settings-pane checks, 40 interaction/tooltip/animation checks passed. Grouped/stacked/bar/column drill modes: 16 checks passed.
- Visibility: 1,230 scenarios executed; 156 DOM clipping candidates need classification. All 36 logged errors belong to deliberate query-failure fixtures.
- Compiled web/Fabric bundles: 82 smoke checks passed; this does not establish hosted parity.
- Service: isolated four-page report renders 19 primitive types. Standard/single-category/empty scenarios exercised; defects and retests tracked in bug-log.md. Default native category selection and deselection pass for 16 selectable types; see evidence/service-native-summary.json. Other Service paths, all properties, multi-select/drill/playback and every interaction remain incomplete.
- Fabric: isolated 41-object app loaded across seven pages inside the authenticated portal. Real dimension-only query, native bar selection/deselection/Ctrl-multiselection, radar selection/deselection, page navigation and theme switching pass. Pie clipping (VIS-PIE-034) is corrected and visually verified after deployment. Hosted pie native single/multi/remove/clear filtering also passes. Hosted scatter, bubble, lollipop and slope native selection/clear also pass (8 checks). Individual visual semantics, all formatting states and remaining interactions are not fully verified.
- Local Power BI: all 19 supported primitives render across four Desktop pages, including dark theme. Saved and reopened the separate QA report. Original 157 source files match their hashes. Unsupported local types, slicers and drill remain gaps.
- Build/package succeeds with unresolved pbiviz lint/certificate warnings. Latest unit suite: 625 passed, one known secondary-axis cross-filter failure (626 tests).

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
