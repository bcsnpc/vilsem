# Bounded scatter motion: experiment and adoption requirements

The 5,000-point animated canvas baseline fails the Round 3 performance target.
A QA-only prototype batches points into ECharts' internal LargeSymbolPath and
animates one coordinate buffer. All 5,000 points remain present. It measured
55.95 RAF fps / 18.2 ms p95 against 24.92 fps / 72.2 ms baseline on this laptop.
Acceptance requires >=57 RAF fps and <=20 ms p95: both FAIL. Render callback
rate is not display frame rate. Neither run measures the Power BI host.

The prototype is not enabled in production. Private ECharts internals may change,
and a batched path loses individual display elements. No author callback or
executable spec is proposed; implementation must remain trusted runtime code.

| Requirement | Adoption gate |
|---|---|
| Point identity | Stable IDs across reorder and updates; click, Ctrl-select, context and native tooltip map to the correct source rows |
| Styling | Initially uniform symbols/size/style only; retain per-point color, opacity and selection or fall back before rendering |
| Interaction | Test moving hit targets, keyboard focus, highlights, bookmarks and clear in automation and the native host |
| Layout | Preserve plot clipping, resize, pixel ratio, hidden/resumed state and axis changes |
| Cancellation | New data, disposal and reduced motion settle/cancel prior animation without stale callbacks |
| Export | Preserve all points in SVG/PNG, browser APNG and native PDF/subscriptions |
| Targets | Core, app, exported web/Fabric and native adapter use equivalent eligibility and fallback |
| Dependencies | Pin ECharts or replace private imports with a maintained abstraction; add upgrade contracts |
| Performance | Repeat deterministic runs with an idle RAF baseline; measure native host separately |

Keep the regular scatter fallback and demonstrate parity before enabling
batching. Do not drop points or disable motion to claim the animated target.

Final repeat after build/test processes stopped: idle page54.79 RAF fps;
regular scatter20.36 fps/107.8ms p95; prototype55.12 fps/18.2ms p95. Both chart
runs still FAIL. The idle cadence is below60 too, so this laptop/browser run
cannot establish a60fps result. That does not excuse the regular-path cost or
approve the prototype's missing interaction/style parity. Earlier measurements
are retained rather than replacing failures with the best observed run.

A second QA-only experiment grouped identical translations while retaining all
5000 individual symbols, per-point styles and stable identities. Browser click,
hover and context-menu probes identified point246 correctly. It measured only
15.67 RAF fps /116.9ms p95, with180-341ms synchronous updates. It is rejected
for production adoption: correct identity mapping alone does not meet the
performance budget. Private reproducible source is MCP
`scripts/round3-group-motion-probe.mjs`; result is
`test-results/stress3/browser-motion/group-motion-probe.json`.

The final configuration comparison used Intel UHD620/ANGLE Direct3D11 with an
unmodified real animation clock. Idle measured60.41 RAF fps/17ms p95, but normal
canvas12.44fps/299.8ms, dirty-rectangle canvas12.51fps/233ms and SVG10.26fps/266.6ms.
Each retained5000 points with animation enabled. None meets the budget and none
is a native Power BI host measurement. Switching renderer or enabling dirty
rectangles is therefore not adopted as a fix. The earlier lower idle cadence
does not explain away the chart rendering cost. Private reproducible source and
results are `test-results/stress3/performance-options.mjs` and
`round3-e-performance-options.json` in the MCP checkout.

Core/MCP0.7 is an evaluation prerelease with this failed target explicitly
listed. It does not claim60fps or certify performance for production workloads.

## 2026-11-06 isolated follow-up

After build/test activity stopped, the portable synthetic benchmark retained
all 5,000 points, real animation and the unmodified clock. Idle: 60.42 RAF fps,
16.9ms p95. Canvas: 11.22 fps/266.5ms; dirty-rectangle canvas: 12.52/233.3ms;
SVG: 8.62/250ms. Every chart run FAILS the >=57fps / <=20ms p95 acceptance
budget. None is a Power BI host measurement. This run bypasses the declarative
spec interpreter, so it does not support blaming AST execution for the cost.
No rejected batch/grouping prototype, point dropping or hidden animation
disabling is enabled. Private result: MCP test-results/stress3/round3-f-performance.json.
The portable source is scripts/benchmark-motion.mjs in the MCP repository.
