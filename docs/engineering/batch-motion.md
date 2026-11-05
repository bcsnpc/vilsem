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
