# Visual-by-visual target verification cycles

A target is verified only for named scenarios with evidence. Source tests do not establish deployed rendering parity.

## Cycle 1 - Bar and Column (2026-09-11)

Finding EXPORT-LOCAL-018: Power BI composeBarLike reserved top-label space for grouped bars only; default Column used 4px despite labelPosition=top. Reproduced in a focused composition test (expected >=20px, actual 4px). The fix applies the existing 28px clearance to every vertical bar variant with top labels. Horizontal bars, labels disabled and inside labels retain 4px. Data domain remains unchanged.

Validation: tests/power-bi-bar-layout.test.ts 4/4, local report builder 12/12, local project writer 20/20. First test draft incorrectly treated grid as an object and used an unsupported config key; corrected the test before reproducing the actual defect.

| Target/workflow | Current evidence | Remaining |
| --- | --- | --- |
| Vilsem Canvas | Historical renderer tests; source comparison shows top-label allowance | Fresh Bar/Column settings, small containers, negative data and font checks |
| Playground / Present | Historical suites only | Fresh Bar/Column workflow and clipping checks |
| Local Power BI | Historical 9-visual gallery; corrected composition passes regression | Rebuild package; regenerate report; Desktop screenshot and save/reopen |
| Power BI Service | Existing publisher preserved; shared Power BI composition changed | Validate new package in an isolated report; interaction/format checks |
| Existing Power BI report | Not tested in this cycle | Insert/update selected visual; preserve other pages, visuals, resources and bindings |
| Web export | Not tested in this cycle | Run exported app and compare data, typography and interactions |
| Fabric app | Not tested in this cycle | Actual deployment and data access verification |

Do not mark EXPORT-LOCAL-018 Verified yet: existing .pbiviz packages have not been rebuilt with this source correction.

## Next cycles

Continue Bar/Column target checks before declaring the cycle complete, then grouped/stacked bars, Line/Area, Pie/Donut, remaining chart families, tables/cards, and canvas objects/navigation/custom visuals. Each cycle includes formatting controls, AI mapping, realistic/edge data, interaction, persistence and source-model preservation.


## 2026-09-11 runtime follow-up

- Rebuilt .pbiviz after the Column margin correction. Fresh nine-visual Desktop report renders with the top Column label readable: evidence/cycle-1-desktop.png.
- Saved, closed and reopened that report in Desktop: all nine visuals render with dark theme and readable Column label: evidence/cycle-1-reopened.png. This closes the local Desktop scenario for EXPORT-LOCAL-018; Service and other target checks remain open.
- Area composition regression passes without a fix; actual gallery shows a faint fill. The initial suspected missing Area default was disproved by inspecting the later effective-chart calculation.

## Cycle 2 - grouped/stacked bar domains

Reproduced two domain bugs: [-8,-5] stacked used minimum -8 instead of -13; [8,-5] used maximum 3 instead of 8. Added shared barValueDomain used by app grouped/stacked components and Power BI composition. Same-sign values sum on their respective side of zero.

58 focused tests passed, including actual ECharts SVG runtime geometry for negative, positive and mixed-sign stacks. App UI build and Power BI package rebuild succeeded. Generated a dedicated Desktop report with QA-only negative measures added to an isolated model copy. Actual Desktop screenshot evidence/cycle-2-signed-stacks.png shows full negative and mixed-sign ranges. Original 157 source files unchanged.

Limitations: no fresh app UI interaction checks for signed data; no new Service publication, existing-report insertion, web deployment or Fabric deployment checks. Runtime suite initially emitted legend-name warnings for synthetic rows without measure names; fixture now provides realistic measure names and rerun passes.

Build quality: pbiviz packaging completes but reports four lint errors and missing pwsh for a development certificate, plus feature-support warnings. A standalone eslint invocation could not find a flat config; lint is NOT marked passed.

## Current hosted and local follow-up ? 2026-09-11 night

See [per-visual target coverage](target-coverage-by-visual.md) for all 41 IDs. Service now renders 19 primitives across four pages with standard, one-category and empty filters exercised. Local Desktop renders the same 19 default states; Save/reopen retains the report and dark page theme. The separate hosted Fabric app loads all 41 objects across seven pages, with real query and native bar selection/multi-select evidence. Compiled web/Fabric smoke: 82/82. These supersede the earlier per-cycle ?not tested? entries only within this stated scope.

Remaining: every property?s visual effect, all live target interactions/drill modes, 22 unsupported local types, static existing-report insertion and native-slicer preservation, placeholder chart semantics, clipping acceptance, AI and release checks.
