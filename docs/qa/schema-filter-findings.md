# Schema, filtering and layout findings

Current repair status: [verified fixes and remaining work](fix-status.md). Reproduction descriptions below preserve before-fix behavior.

The current status is recorded per finding below. Evidence is the failing expected-behavior assertion with the same ID in `tests/qa-audit-regressions.test.js`, recorded in `evidence/qa-regressions.json` and `evidence/full-suite.json`.

## SPEC-SLICER-001

- **Status:** VERIFIED (local scope).
- **Fix and verification:** Accept supported multi_select type. Production schema regression passes. See [fix status](fix-status.md).

- Area/category/severity: Spec validation / Architecture, interaction / High (P1).
- Reproduce/input: Validate a bar spec with a `multi_select` slicer bound to `QA[Category]` and a valid position.
- Expected: A slicer type implemented by the running renderer is accepted, or is migrated through an explicit documented conversion preserving selection semantics.
- Actual: Validation rejects the type.
- Root cause: Allowed slicer types in `ui/src/appspec/schema.js` differ from runtime support. AI sanitizer downgrade is separately logged as AI-SLICER-001.

## SPEC-INPUT-001

- **Status:** VERIFIED (local scope).
- **Fix and verification:** Guard invalid visual element shape. Regression passes. See [fix status](fix-status.md).

- Area/category/severity: Imported/generated spec / Validation / Medium (P2).
- Reproduce/input: Call `validateAppSpec({version:'1.0',title:'QA',visuals:[null],slicers:[]})`.
- Expected: Structured invalid result with an actionable error.
- Actual: Validator throws while accessing null visual properties.
- Root cause: Element shape is not checked before dereference in `ui/src/appspec/schema.js`.

## SPEC-INPUT-002

- **Status:** VERIFIED (local scope).
- **Fix and verification:** Validate nested page slicers. Regression passes. See [fix status](fix-status.md).

- Area/category/severity: Multi-page spec / Validation / Medium (P2).
- Reproduce/input: Validate a pages[] document whose page has a valid bar and `slicers:[{id:'broken',type:'unknown'}]`.
- Expected: Reject the missing dimension and unsupported slicer type at the page path.
- Actual: Validator returns valid.
- Root cause: Nested-page slicers do not receive equivalent root-slicer validation in `ui/src/appspec/schema.js`.

## FILTER-001

- **Status:** VERIFIED (local scope).
- **Fix and verification:** Prevent excluded slicer keys re-entering generic filter pass. Production regression passes. See [fix status](fix-status.md).

- Area/category/severity: Slicer scope / Data, interaction / High (P1).
- Reproduce/input: Slicer bound to QA Category has `affects:['included']`; global filter is `{'QA[Category]':'North'}` with no mark-source entry. Build filters for visual `excluded`.
- Expected: No filter from that slicer reaches the excluded visual.
- Actual: The global filter is returned for the excluded visual.
- Root cause: `ui/src/appspec/shared/filters.js` considers affects, then reapplies the same key through the global-filter loop.

## LAYOUT-001

- **Status:** VERIFIED (local scope).
- **Fix and verification:** Wrap excess KPIs to additional positive-width rows. Fourteen-KPI regression passes. See [fix status](fix-status.md).

- Area/category/severity: Automatic KPI layout / Layout / High (P1).
- Reproduce/input: Normalize a non-freeform document with fourteen KPI visuals, each with one valid measure.
- Expected: Every card has positive width and stays inside the twelve-column grid, wrapping to later rows.
- Actual: At least one resulting card fails positive-width/in-grid bounds.
- Root cause: KPI row placement in `ui/src/appspec/shared/layout.js` assumes the KPI row fits the available columns.
