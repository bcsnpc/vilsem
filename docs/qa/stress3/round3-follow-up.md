# Round3 follow-up: responsive reference panels

The0.7.0 evaluation releases remain immutable. This follow-up publishes core/MCP
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

Test/build, package and live-tool results are recorded below.

## Core candidate verification (2026-11-06)

Private app/core1355/1355 PASS. Public app/core1355/1355 PASS with maxWorkers2 and unchanged deadlines/assertions; its initial overlapping run had one5000ms transpilation-test timeout, retained in round3-f-tests.log. Native packages built independently with identical resource contents. Full UI/Fabric/Electron/NSIS build exited0; installer remains unsigned/default-icon, app version1.0.0-beta.3, and is not a new installer release. Audits: root6moderate, UI0, native tooling13moderate/4low, zero high/critical.

Both built-in computer-use interfaces were checked. Both fail to connect to the native pipe with os error2; the alternate inventory also reports browser access host unavailable. This is not a foreground/window-selection issue.

Live candidate connect_model uses AS62071 via process-workspace-port-file; get_schema returns13tables/39measures. Validate, explain, real6row preview, read, dry-run update and saved update PASS on the owned Figma reference visual. The initial120second schema request timed out; the retry used the previous live-QA600second budget and succeeded. Neither request changed the model. All21model hashes remain unchanged. Native rendering/gestures remain UNVERIFIED.

A raster repeat probe produced six byte-identical PNGs for the same SVG. Raw real-model previews remain private. MCP full-suite finalization and public-package acceptance follow the core release.

##0.7.2 correctness follow-up

Final dark-thumbnail inspection found REFERENCE-CONTRAST-027: the intentionally
light reference card inherited near-white axes in a dark report theme. The
MCP template now explicitly colors its category/value labels and axis name.
The rendered-text regression passes both themes; the0.7.1 release notes disclose
the issue and its artifacts remain immutable.

Selection review also found REFERENCE-SELECTION-028. The native adapter styles
all series data, including a decorative panel's synthetic invocation row.
Core0.7.1 then multiplied that inherited opacity into the panel. The actual
browser reproducer measured panel opacity0.25 with ordinary bars0.25/1; a
separate core test reproduced authored0.6 becoming0.15. Both fail before the
shared-interpreter fix and pass afterwards. Explicitly silent annotation leaves
now retain authored leaf opacity; ordinary/interactive marks still dim. The
actual browser also verifies that clicking the panel remains a blank-area
click, permitting the native adapter's existing clear path.

Core0.7.2 / renderer4.42 carries that narrow rule and a reader floor for literal
or parameterized/conditional silent annotations. Viewport operations alone
retain their4.41 floor; other0.7 specs retain4.40. GUID and legacy pane property
are unchanged. Private/public core1357tests each PASS; full app build exits0,
including native/UI/Fabric/Electron/NSIS. Independently built renderer42 resource
contents match. The owned report's resource update preserves21model hashes.
MCP's full contrast-only checkpoint passes301tests on public core0.7.1; final
301-test acceptance against actual public core0.7.2 follows publication.

The native fixtures/checklist are now prepared in the owned QA copy: six new
pages,19visuals (4Vilsem/15native), schema/bounds/reference checks PASS,
report settings and existing pages/visuals preserved during fixture creation,
21model files unchanged and clean report-only reload accepted. Physical
interaction, paint, bookmark capture and export acceptance remain UNVERIFIED.
See native-interaction-checklist.md. No native authoring operation was added
to MCP and no fake bookmark selection state was written.

The isolated real-clock repeat still FAILS: idle60.42RAFfps/p95=16.9ms;
canvas11.22/266.5ms; dirty rectangle12.52/233.3ms; SVG8.62/250ms. All5000points
and animation remain enabled. This bypasses the spec interpreter and is not a
Power BI host measurement. npm's latest ECharts remains6.1.0 as of this check;
no dependency upgrade or configuration-only fix is available from that check.
Rejected batching remains disabled pending interaction/style/native parity.
