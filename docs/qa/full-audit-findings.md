# Full audit findings — continuation, 2026-09-07

Current repair status: [verified fixes and remaining work](fix-status.md). Reproduction descriptions below preserve before-fix behavior.

This log supplements bug-log.md. Current status is recorded per issue. Automated checks use production code with synthetic transport or disposable databases.

## DATA-EDITOR-001

- **Status:** VERIFIED (local scope).
- **Fix and verification:** Include all query inputs in dedup guard. data-audit-after.json: all 299 checks pass. See [fix status](fix-status.md).

- **Area / Category / Severity:** CanvasEditor / Data / High (P1).
- **Description:** Changing a bound measure or visual filter does not refresh editor data.
- **Reproduction:** Mount a bar in CanvasEditor; change measures from Revenue to Cost without changing groupBy/order/limit; then add Category=North filter.
- **Input:** QA four-category dataset, Revenue/Cost measures.
- **Expected:** New query for each changed data binding/filter; values reflect the selected measure/filter.
- **Actual:** Zero new requests for both operations; viewer host does request new data.
- **Evidence:** full-audit.json workflows editor/replace-measure and change-filter; viewer comparison. Probe run confirmed, full run repeats.
- **Root cause:** fetchedAxisRef axisKey includes axis/drill/play/order/limit, but excludes measures, dimensions and filters.
- **Regression:** full-audit.cjs retained-host workflows; add explicit query/value assertions before fixing.

## PERSIST-001

- **Status:** VERIFIED (local scope).
- **Fix and verification:** Reject colliding rename/ambiguous save; display rename errors. Storage tests and persistence-ui.json pass. See [fix status](fix-status.md).

- **Area / Category / Severity:** Project save/rename / Data corruption / Critical (P0).
- **Description:** Rename collision makes a subsequent save overwrite a different project.
- **Steps:** Save A and B in same dataset; rename B to A's name; save B's edited spec under that name.
- **Expected:** Reject duplicate name or save by B's stable ID. A retains its content.
- **Actual:** saveAppSpec returns A's ID and overwrites A; B's row remains separate.
- **Input:** Disposable qa-collision dataset, projects “Collision A” and “Collision B”.
- **Evidence:** contract-audit.json check “Persistence rename collision rejected or distinct identity retained”.
- **Root cause:** renameAppSpec allows collisions; saveAppSpec selects first row by name/dataset instead of stable project ID.
- **Regression:** Production database functions executed in isolated profile; add real Home rename/save workflow acceptance.

## AI-SLICER-001

- **Status:** VERIFIED (local scope).
- **Fix and verification:** Preserve multi_select through sanitizer. contract-audit-after.json passes this case. See [fix status](fix-status.md).

- **Area / Category / Severity:** AI editing / Interaction / High (P1).
- **Steps:** Start with a multi_select slicer and bar; apply a color-only JSON patch through production validation/apply/sanitize/reflow.
- **Expected:** Slicer remains multi-select with unchanged settings.
- **Actual:** sanitizer changes type to dropdown. General flat-spec validator also omits multi_select from allowed slicers.
- **Input:** Synthetic valid runtime slicer on QA[Category].
- **Evidence:** contract-audit.json color-only patch preservation check; llm.js sanitizeAppSpec validTypes; schema.js SLICER_TYPES.
- **Root cause:** Renderer, validator and sanitizer maintain inconsistent type lists.
- **Regression:** Deterministic patch pipeline check; no live provider needed to reproduce transformation.

## AI-PATCH-001

- **Area / Category / Severity:** AI patch validation / Functionality / Medium (P2).
- **Steps:** Submit remove /visuals/0/data/measures/0 to validatePatchOperations.
- **Expected:** Valid removal accepted, then complete-spec role validation decides whether remaining fields are valid.
- **Actual:** Patch is dropped because undefined remove value fails referenced-measure-name validation.
- **Input:** Revenue-bound visual.
- **Evidence:** contract-audit.json “AI remove measure is accepted”.
- **Root cause:** Add/replace value validation also applied to remove operations.
- **Status / Fix:** Verified in isolated production pipeline; see bug-log.md AI-PATCH-001/002.
- **Regression:** Deterministic private production helper exposed in audit process only.

## AI-PATCH-002

- **Area / Category / Severity:** AI patch validation / Architecture / Medium (P2).
- **Steps:** Add an object property then add its child in the same patch sequence.
- **Expected:** Validate patches sequentially against the evolving document.
- **Actual:** Second patch is dropped because parent is absent in the original document.
- **Input:** Valid categoryColors object followed by a North color override; final color asserted.
- **Evidence:** contract-audit.json sequential-parent check.
- **Root cause:** validatePatchOperations inspects currentSpec for every patch without advancing state.
- **Status / Fix:** Verified in isolated production pipeline; see bug-log.md AI-PATCH-001/002.
- **Regression:** Ordered patch sequence fixture.

## AI-CONFIG-001

- **Area / Category / Severity:** AI property mapping / Architecture / Medium (P2).
- **Steps:** Patch barRadius to a nonnumeric string or add nonexistentQaProperty.
- **Expected:** Supported-operation validation rejects invalid types/unknown controls with useful feedback.
- **Actual:** Both accepted and preserved through sanitizer; frontend type validation is not per-config schema validation.
- **Input:** Isolated bar spec.
- **Evidence:** contract-audit.json invalid-type and unknown-key checks.
- **Root cause:** AI hint schema is advisory; patch validation mostly checks op/pointer/measure names.
- **Status / Fix:** Open / none.
- **Regression:** Typed operation tests, then all discovered inspector settings against renderer semantics.

## BUILD-001 update

Executed installed app-builder-lib getConfig for default and explicit YAML paths. **Default uses package.json.build**, Vilsem branding, release output and .env exclusions. Earlier P0 default-packaging suspicion is not confirmed. Explicit --config electron-builder.yml selects Semantica config with .env inclusion. Keep legacy configuration cleanup as P2; no installer contents have been validated.

## Positive evidence

All 41 registry-type specs survive production sql.js save and database reload with Unicode title/font/color settings. Same-name updates, dataset separation, ordinary rename and deletion passed isolated function checks. These do not establish the full UI persistence journey or crash atomicity.

## LAYOUT-DRAG-001

- **Status:** VERIFIED (local scope).
- **Fix and verification:** Clamp X using visual width. Native far-right drag/resize pass. See [fix status](fix-status.md).

- **Area / Category / Severity:** CanvasEditor / Resize, data integrity / High (P1).
- **Steps:** Grab bar chart title with a real mouse-down; drag 1,500 pixels beyond the right canvas edge; release.
- **Input:** Visual at x=0,w=8 on 12-column canvas.
- **Expected:** Clamp movement while retaining a valid positive width.
- **Actual:** Persisted position becomes x=12,w=0,h=4; visual disappears and violates minimum width.
- **Evidence:** interaction-audit.json native drag check.
- **Root cause:** pxToGrid clamps x to 12; pointer-up then sets w=12-x.
- **Regression:** Native pointer drag case, not a direct coordinate-helper test.

## TOOLTIP-001

- **Status:** VERIFIED (local scope).
- **Fix and verification:** Encode data text in HTML formatter. Unit and native tooltip checks pass. See [fix status](fix-status.md).

- **Area / Category / Severity:** Shared tooltip / Rendering, security boundary / High (P1).
- **Steps:** Format a category containing benign `<b data-qa-markup="yes">North</b>`; inspect resulting tooltip fragment.
- **Expected:** Category/measure names display as literal data text.
- **Actual:** Category markup is interpreted as an HTML element. No executable payload was used.
- **Evidence:** interaction-audit.json; tests/qa-audit-regressions.test.js.
- **Root cause:** Tooltip primitive interpolates category/seriesName into HTML without escaping.
- **Regression:** Native tooltip path and production formatter tests; inspect other formatter implementations before a shared fix.

## VIS-AREA-001

- **Status:** VERIFIED (local scope).
- **Fix and verification:** Provide Area registry adapter. Actual series area options verified. See [fix status](fix-status.md).

- **Area / Category / Severity:** Area visual / Rendering / High (P1).
- **Steps:** Mount an area-type spec without explicitly setting config.type/config.chartType in editor and viewer.
- **Expected:** Filled area series for the registered area type.
- **Actual:** Both hosts produce line series with no areaStyle.
- **Input:** QA Category with Revenue and Cost; visual.type='area'.
- **Evidence:** full-audit.json hosts where type=area; charts.series[].area=false.
- **Root cause:** Registry aliases area to line, but host config assembly does not pass visual.type; line wrapper resolves area only from config.
- **Regression:** Actual host option inspection; leaf fixture previously supplied type and masked this mismatch.

## FORMAT-TITLE-001

- **Area / Category / Severity:** Chart title controls / Formatting, UX / Medium (P2).
- **Steps:** In Text tab, change title Weight from 500 to 700 for a bar and other chart types.
- **Expected:** Header font-weight follows the saved setting.
- **Actual:** Spec updates; chart header stays at hardcoded fontWeight 600. Full sweep shows no render fingerprint change for non-KPI title-weight changes; KPI changes do affect output.
- **Evidence:** full-audit.json property titleFontWeight changes; CanvasEditor chart header inline style.
- **Root cause:** Shared inspector exposes controls that host headers do not consume.
- **Status / Fix:** Open / none.
- **Regression:** Assert computed header font-weight after actual inspector edit; audit alignment/uppercase/position separately.

## INTERACTION-MULTI-001

- **Area / Category / Severity:** Desktop mark selection / Interaction parity / Medium (P2, expected-support decision).
- **Steps:** Click North, then Ctrl-click South in viewer with another KPI.
- **Expected under multi-selection support:** Both categories filter the other visual.
- **Actual:** Latest filter is scalar 'South'; North is replaced.
- **Evidence:** interaction-audit.json. Click/deselect, three drill modes, axis switch and native resizing passed other scenarios.
- **Root cause:** Leaf click callback carries category only, not modifier state; host tracks one scalar category.
- **Status / Fix:** Open support-gap decision / none. Do not call it a regression of documented desktop multi-selection without confirming the contract.
- **Regression:** Existing native Ctrl-click scenario.
