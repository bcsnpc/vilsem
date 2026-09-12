# Full local verification round ? 2026-09-07

This round covers production authoring, Present, both Playgrounds, built web/Fabric renderers and Power BI source checks. It does not certify all features or cloud publication. No credentials, client data, tenant resources or existing projects were changed.

## Results

| Area | Result | Evidence / practical boundary |
|---|---|---|
| Authoring |10/10|product-audit-after.json; production AppGenerator, synthetic metadata/save/provider adapters |
| Interactions |16/16|interaction-audit-after.json; native bar-family selection lifecycle, drill, axis switch, hover, drag and resize |
| Visual field changes |299/299|data-audit-after.json; all41 visual types, both hosts |
| Present |7/7|present-round.json; production renderer,640/1280 widths, tall-page scrolling, Exit and dispatched Escape handler, unchanged authored spec |
| Visual Playground |30/30|playground-round.json; all14 starters load/validate/save callback and bound preview with series or graphics; invalid JSON blocks saving; Close callback |
| Data-query Playground |3/3|query-playground-round.json; required-measure validation, visible successful query, error recovery |
| Built web bundle |41/41 smoke checks|artifact-round.json; served standalone build over isolated HTTP, synthetic query endpoints |
| Built Fabric bundle |41/41 smoke checks|artifact-round.json; actual IIFE mount with synthetic host transport |
| Web dimension-only query |3/3|tests/web-dimension-table.test.js; production route and DAX with mocked Fabric query execution |
| Desktop dimension-only regression |4/4|tests/dimension-table-query.test.js |
| Full unit suite |470 passed,1 failed|full-round-final-suite.json; existing Power BI secondary-axis cross-filtering gap remains |
| Builds |UI, standalone, Fabric pass|cache/qa-build/full-round-*; existing build warnings remain |
| Power BI source compilation |Passed|TypeScript --noEmit on current pbiviz source; no repackaging, tenant publish or service-runtime verification |

## Verified repairs

- **WEB-DATA-011:** web query route accepts dimension-only table queries and orders by dimensions instead of emitting an undefined measure. Existing measured queries and invalid-input rejection remain tested.
- **PLAYGROUND-012:** required bindings/no-row/date-range states no longer send invalid empty calendar options to ECharts. Preview chart is remounted when template ID changes, clearing incompatible old coordinate systems. All14 starter transitions pass with no captured renderer errors.
- **UX-CANVAS-013:** independent backgroundColor avoids React shorthand conflicts with grid image/size properties. Authoring rerun has no captured console warnings.

## Evidence limitations and corrections

- Present native Escape injection delivered no keyboard events (`nativeKeys: []`). The actual Escape handler was verified with a dispatched DOM KeyboardEvent; native keyboard delivery is not certified.
- A tall-page remount audit stalled after six checks; preserved as present-round-interrupted.json and terminated only its isolated QA process. The final tall-page run starts with that fixture in a fresh authoring instance. Repeated remount stress remains unverified.
- Playground's calendar error initially surfaced during transition to KPI Delta. Captured stack identified CalendarView and empty date range; KPI Delta legitimately renders graphic elements rather than series.
- Playground checks wait for rendered preview after binding, respecting its debounced query. Reused bindings may reuse existing rows. Save callback checks are not actual library disk persistence or drag-to-canvas verification.
- The query Playground intentionally allows Run with no selection and shows a validation message; it is not required to disable that button.
- Web dimensions are converted to groupBy references upstream: adapter field omission was not a defect. The confirmed defect was server rejection of an empty measure array.
- Artifact smoke checks establish mounting, requests and absence of captured renderer errors. They do not approve every mark, screenshot, interaction, font, clipping edge or deployment permission.

## Still required

Actual Power BI import/service behavior and secondary-axis cross-filtering; Fabric tenant deployment, SDK/auth/data access; generated full web server package startup and endpoint failure behavior; multi-page/modal navigation across targets; actual custom-library save/reload/drag-to-canvas; live AI generation and repair; comprehensive narrow-screen Playground usability; native Present keyboard/fullscreen/print; complete cross-visual property, extreme-size and screenshot acceptance. These remain open in remaining-work.md and bug-log.md.
