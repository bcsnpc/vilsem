# Broad running-app test round

Ran the real Electron main/preload/renderer using a disposable unauthenticated profile, then exercised production application components with deterministic synthetic model data. No client datasets, credentials or tenant writes were used. Source product code was held unchanged during the sweeps.

## Results

| Area | Result |
|---|---|
| Real Electron startup and sign-in modes | Passed; screenshots captured, startup inspected |
| Home recovery and dialogs |16/16|
| Authoring creation, binding, duplicate/delete, save/reopen |10/10|
| Present |7/7|
| Visual Playground14 starters and save/retry |37/37|
| Query Playground |3/3|
| All41 visual data changes, both hosts |299/299|
| All41 settings applicability |237/237|
| Chart interactions |16/16|
| Value formatting |98/98|
| Legends |40/40|
| Schema placement |68/68|
| Detailed card/text formatting |152/152|
| Axis formatting |520/520|
| Text controls |50/50|
| Focused clipping and Bullet bounds |6/6 +6/6|
| Real isolated disk persistence |5/5|
| Fresh web/Fabric bundle smoke |82/82|
| Unit suite |487 passed,1 failed|
| AI/persistence contracts |16 passed,2 failed|
| UI/web/Fabric builds |Passed20.90s/18.59s/16.20s|
| Power BI renderer TypeScript |Passed|

The workflow/format suites above total1652 passing scoped checks, excluding units/contracts and the diagnostic sweep. Passing counts are not exhaustive feature coverage.

## Fresh size/data sweep

Completed1230 combinations:41 visual types x2hosts x15cases. Covered standard, empty, failed query, one point, zero, negative, mixed, null, long labels, five extra sizes/aspect ratios and large-font configuration. Captured82 fresh standard-state screenshots.

No visual error boundary output, broken image elements or unexpected console errors were recorded.36 intentional failed-query console messages caused the current harness to exit1; retained raw evidence in visibility-broad-round.json. These are deliberately injected failures, not an assertion that live services succeed.

156 cases have DOM text-clipping candidates:82large-font,54standard (mostly constrained sizes),10long-label and10other-data cases. These require policy/visual review, not blanket overflow hiding. The geometry probe does not inspect glyphs painted inside canvas. Standard-size Table candidates also need distinction between header truncation and actual information loss.

Inspected fresh standard screenshots for Bar, Donut, Table, Waterfall, Sunburst, Heatmap, Text box, Sankey and Chord, plus real startup. Other captured screenshots have not all been visually reviewed this round. Sankey/Chord remain donut-like placeholders, and Sunburst's single-ring output does not establish hierarchical semantics.

## Failures and harness repairs

- Existing EXPORT-AXIS-010: Power BI non-primary axis cross-filter contract still fails.
- Existing AI-CONFIG-001: invalid config type and unknown config key are still accepted.
- Initial artifact run81/82: Fabric grouped_bar was sampled with rootChildren0. The stability probe accepted an unchanged blank page. Now waits for a mounted root; full rebuilt82-case rerun passed. Initial artifact-broad-initial.json retained. This proves startup smoke, not exact target equivalence.
- Initial new persistence delete test lacked deleteAppSpec in its QA preload. Production Home correctly displayed storage-unavailable feedback. Added forwarding to the production IPC;5/5 disk tests passed. Initial persistence-broad-initial.json retained. Expected rename-collision error appeared in console during the passing rejection test.

## Remaining acceptance

Live Microsoft/AI sign-in, actual cloud data, full template-library-to-canvas persistence, every formatting combination, native modal keyboard delivery, complete screenshot review, deployed Power BI/Fabric/web behavior and local PBIP workflows remain unverified or unfinished. Rebuilt web/Fabric smoke is not pixel/data/interaction parity. Local model-folder and export foundations are not user-facing complete features.

Evidence: broad-runtime-run-summary.json records command results; per-suite JSON and fresh screenshots are under docs/qa/evidence. Product fixes must continue from the open bug/priority logs.
