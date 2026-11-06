# Round3 follow-up: responsive reference panels

The0.7 evaluation releases remain immutable. This follow-up prepares core/MCP
0.7.1 and renderer4.41, with the same GUID and legacy format-pane property.
It does not promote the evaluation releases to production acceptance.

## Change

`viewportWidth` and `viewportHeight` are zero-argument, bounded numeric
operations in the closed expression language. They call only trusted ECharts
dimension getters and recompute on resize. All existing AST budgets and
security restrictions remain. Specs using either operation require renderer
4.41; other0.7 specs retain their4.40 requirement.

The shipped Figma reference template now draws the inset rounded white panel
on its pale backdrop. It shrinks its inset/radius for tiny containers, does
not invent business axes or embed reference numbers, and preserves the actual
bar data. The decoration is silent, has no tooltip and sits below marks.

## Verification

Core tests cover changing dimensions, zero sizes, missing/invalid API values,
operation arity and the reader floor. A real Chromium regression resizes the
same chart900x550 ->320x240 ->40x24 ->900x550, checks panel bounds and exact
return geometry, and physically clicks a bar and the decoration. Only the bar
produces a data click. SSR uses the same interpreter. This verifies panel
geometry and input isolation, not readability of an entire chart at40x24.

## Remaining acceptance

Windows Computer Use was initialized and checked again: native pipe connection
fails with os error2. No UI input or unsupported replacement helper was used.
The Desktop bridge supports state, reload and capture, not interaction input;
its snapshots previously destabilized the native report. Those operations
cannot prove native click/Ctrl, slicer/highlight, drill-through, tooltips,
bookmarks, Edit Interactions None or PDF/subscription acceptance.

The5000-point animated performance target remains FAIL. The upstream ECharts
animation guidance recommends thresholds/disabling motion for large data;
that would not satisfy the requested animated target. Its older v6 large-data
regression21434 concerns jitter/progressive paths and was fixed upstream; it
does not establish a fix for this6.1 animated ordinary-scatter workload.
No points are removed, no animation is silently disabled and no rejected
batch prototype is enabled to relabel this failure.

Sources: https://echarts.apache.org/handbook/en/how-to/animation/transition/
and https://github.com/apache/echarts/issues/21434 .

Final test/build, package and live-tool results will be appended after runs.

## Core candidate verification (2026-11-06)

Private app/core1355/1355 PASS. Public app/core1355/1355 PASS with maxWorkers2 and unchanged deadlines/assertions; its initial overlapping run had one5000ms transpilation-test timeout, retained in round3-f-tests.log. Native packages built independently with identical resource contents. Full UI/Fabric/Electron/NSIS build exited0; installer remains unsigned/default-icon, app version1.0.0-beta.3, and is not a new installer release. Audits: root6moderate, UI0, native tooling13moderate/4low, zero high/critical.

Both built-in computer-use interfaces were checked. Both fail to connect to the native pipe with os error2; the alternate inventory also reports browser access host unavailable. This is not a foreground/window-selection issue.

Live candidate connect_model uses AS62071 via process-workspace-port-file; get_schema returns13tables/39measures. Validate, explain, real6row preview, read, dry-run update and saved update PASS on the owned Figma reference visual. The initial120second schema request timed out; the retry used the previous live-QA600second budget and succeeded. Neither request changed the model. All21model hashes remain unchanged. Native rendering/gestures remain UNVERIFIED.

A raster repeat probe produced six byte-identical PNGs for the same SVG. Raw real-model previews remain private. MCP full-suite finalization and public-package acceptance follow the core release.
