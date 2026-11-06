# Round3 Group C: 0.7 evaluation prerelease

> Current checkpoint: core 0.7.2 / renderer 4.42 and MCP 0.7.3 are published
> evaluation patches. App-core 1,357 tests per checkout and MCP 311 tests pass.
> Real-data edits and 170/170 custom-visual validation pass; two known-contract
> warnings are explicit. Native acceptance is blocked; the animated 5,000-point
> target fails. See [current follow-up](round3-follow-up.md). Earlier results
> below are historical.


Updated2026-11-06. Groups A/B are published as0.5/0.6. Group C is
published as an evaluation prerelease; stable0.6 remains the previous release
channel. Publication does not certify native behavior or the failed FPS target.
See round3-release-readiness.md and round3-report.md for scope and limitations.

| Area | Evidence | Remaining/limits |
|---|---|---|
| Core correctness | Private/public1353/1353 tests each PASS;1000valid/1000invalid AST fuzz probes included | Native physical acceptance is separate |
| Build | Renderer4.40 and complete UI/Fabric/Electron/NSIS build PASS | Installer remains unsigned/default-icon and is not a new installer release |
| Expressions | All11 former(c) families pass real-data tools/SSR; native static marks inspected | Title/bounds/resize/filter gestures partial or unverified |
| Motion | Ten real-data cycles; controlled-clock APNG;299full MCP tests PASS with public core | Native motion/export and5000point60fps remain unverified/FAIL |
| Hidden Sankey | Actual entry-clip regression fails before fix and matches settled static canvas exactly afterwards | Desktop PDF/subscription check unverified |
| Formatting |71pane properties; independent axes; currency inheritance and named-value fixes tested | Final native currency-axis recheck pending |
| Memory | OS/shared library; save/list/read/delete/saveAs with hardened file boundary | Shared-folder permissions belong to the user/admin |
| References | Three real-data reference workflows complete; native static examples inspected | Mockup outer-card fidelity partial |
| Thumbnails |144light +144dark synthetic thumbnails regenerated without failures | Original before-state screenshots remain historical |
| Distribution | Both0.7 GitHub prereleases published and public main branches updated; downloaded hashes match | Evaluation release, not production/certification completion |

The original PBIP is untouched. All21 owned QA model-definition files remain
SHA256-identical. Desktop20988/AS62071 was discovered through
process-workspace-port-file; the report is open and clean. Twenty-four owned
detail pages isolate the new exercises. Raw schemas, model rows, reference
photographs and native screenshots remain private QA evidence.

Computer Use still cannot connect to its native pipe (os error2), including a
fresh client reset. Native click/Ctrl-click, slicer/highlight, drill-through,
report-page/native tooltips, bookmarks and Edit Interactions None are therefore
UNVERIFIED. Bridge captures have returned partial/blank pages despite the user
seeing charts; repeated capture was stopped after finding the independently
reported Microsoft capture-layout issue. No unsupported input workaround is used.

Renderer4.40 fixes an actual hidden-Sankey bug: stopAnimation(true) aborted the
callback removing the temporary entry clip. Trusted normal clip completion now
runs before flushing; permanent clipping survives. Elements are snapshotted
before callbacks remove siblings. Browser canvas equality is a real regression
check, but is not a Desktop gesture/export result.

Performance remains FAIL. Normal animated5000point scatter was about20-25RAFfps
in earlier runs; batch/grouped experiments also failed adoption gates. A final
Intel UHD620/D3D11 comparison measured idle60.41fps but canvas12.44fps,
dirty-rectangle canvas12.51fps and SVG10.26fps. All5000points and animation were
preserved. These are not Power BI host measurements and no experiment is enabled
in production. See docs/engineering/batch-motion.md.

Arbitrary exact area-proportional Euler fitting, unshipped geo assets and3D
remain explicit limits. Venn circles are schematic. Historical605 before-state
and cross-target image records are not relabelled as current native evidence.
MCP299/299 passed with the actual downloaded core. A fresh normal install from
both public URLs has audit0 and passes live Desktop/schema/preview/commit,
expression/resource and final-PNG/APNG/contact-sheet checks, without an app
checkout link or dependency override. URLs/hashes/publication commits are
recorded in candidate-verification.md.
