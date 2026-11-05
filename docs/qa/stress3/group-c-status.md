# Round 3 Group C development status

Updated 2026-11-05. Group A/core-MCP0.5 and Group B/core-MCP0.6 are released. Group C is on
stress3 feature branches, not merged or released. Public source is synced to
the Group C candidate; production MCP dependency still points to core0.6 until
coordinated release assets exist. Do not confuse source sync with publication.

| Area | Current evidence | Remaining |
|---|---|---|
| Expression language | Closed JSON AST, bounds, typed diagnostics, renderer/SSR integration, fuzz/security contracts | Native acceptance and release packaging |
| Former (c) visuals | All11 have validate/explain/real-data preview/commit tool passes; inspected PNGs; see expression-results.md | Desktop marks/interaction verification; arbitrary area-proportional Euler fitting remains a separate gap |
| Weighted geometry | Voronoi area/order/lineage tests,50 probes and independent interior coverage; grid contour interpolation/saddle tests | Native resize/filter acceptance |
| Motion | Ten live-data tool cycles; actual browser-clock APNG; chart retention/handler, frame selection/index, nested formatting and visibility tests | Native acceptance;5000-point60fps; final visual inspection |
| Template memory | OS/shared-folder library, save/list/read/delete, commit saveAs and collision SDK tests; hardened file boundary | Published-artifact standalone verification |
| Reference images | Tableau, authored Figma-style mockup and licensed whiteboard photograph: live tool cycles and commits | Native acceptance; mockup outer-card styling remains partial |

Frozen private and public app/core:1332/1332 in117 files each, maxWorkers2,
cache/round3-c-frozen-core-tests.log and public cache/round3-c-frozen-public-tests.log.
Frozen MCP:295/295 in12 files using the canonical npm test command.
An earlier direct invocation omitted the existing30second timeout and had
three5second timeouts (292pass); the failed log is retained, not hidden.
Full Electron/UI/Fabric/native/NSIS build passed after the last source edit.
Two intervening full runs were interrupted for excessive concurrent load;
logs remain and are not passes. Do not treat checkpoint counts as release gates.

Renderer4.36 packaged successfully after visibility/flow changes and was
installed only into the owned QA copy. Its21 semantic-model files remain
SHA256-identical. GUID and semantica.primitiveSpec property remain unchanged.

Live model: Desktop57149, process-workspace-port-file discovery. Data queries
are read-only. Owned report: cache/qa-round3-theme-20261103/Stress3 Theme Light.
New pages: Stress3, Stress-Motion, Stress-Reference. Original PBIP untouched.
Some repeat exercise scripts may explicitly reuse the previously retrieved
schema only after checking the same live Desktop port; previews still query
the engine. Raw schema/data evidence stays private under MCP test-results.

Desktop remains hasUnsavedChanges:true. Reload checks stop before page changes
or reload. Computer Use native pipe/browser host are unavailable; no native
PASS is inferred from a successful SDK write or SSR image. The pending user
save/blank-window question has not been answered in this continuation.

Open correctness concerns: aggregate context-menu drill-through currently uses
one source identity (INTERACTION-CONTEXT-011). Chart retention and browser
interpolation capture have automated coverage; neither proves native behavior. Actual
Desktop cross-filter/highlight/bookmark/report-tooltip gestures are unverified.

The 5000-point real-clock canvas baseline FAILS:24.92 RAF fps,72.2ms p95.
A QA-only batched-path prototype improved this to55.95 RAF fps,18.2ms p95,
still below the>=57fps threshold. It is not enabled in the product; individual
styles, identity, resize/export and native interactions require parity tests.
See [batch-motion design](../../engineering/batch-motion.md). Browser-clock
APNG captures are not FPS measurements. Do not drop points/disable animation
to claim a performance pass.

Final unloaded-process repeat also FAILS: idle page54.79 RAF fps, regular
scatter20.36fps/107.8ms p95, experimental batch55.12fps/18.2ms p95. This laptop's
idle capture cadence is below60; that neither proves native performance nor
removes the regular rendering bottleneck. Earlier failures remain in evidence.

Paired local0.7 tarballs passed standalone install, Desktop schema/query,
browser APNG preview and commit without an app checkout or VILSEM_APP_PATH.
This used a local core override, not a published0.7 dependency URL. Repeat with
final artifacts and the real release URL before claiming release installation.
The final KPI retry passed validate/explain/real-data preview/commit with stat
records preserving aggregate source IDs and model number formatting.

Frozen-source audits: root6moderate; UI0; renderer tooling
13moderate+4low; MCP lock0; no high/critical. Complete build and21/21model hashes
passed. The generated installer is unsigned/default-icon and not published.
Frozen-code paired local tarball standalone install also passed; the production
release-URL install remains required. MCP still
uses a local development core link; production URL/lock remains core0.6 until
core0.7 is actually released. No new public release is claimed.
