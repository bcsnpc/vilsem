# Agent playbook and native sharpness evaluation (0.8)

## Shipped changes

Core 0.8 / renderer 4.43: zoom-aware canvas pixel ratio (device DPR times rendered/logical width, clamped 1-4), 0.05 change threshold and 120 ms debounce, optional SVG through `config.renderer`, and an Appearance > Render mode override. Canvas-only trail/blend effects explicitly fall back to canvas. The existing visual GUID and semantica.primitiveSpec property are unchanged. SSR preview rendering is unchanged.

MCP 0.8: short initialization instructions, three packaged skill resources, design-prompt reference, opt-in `install-skill` command, and renderer-fallback critique. Installation never copies skills to the home directory automatically. Default invocation remains stdio. The independent Label-format issue remains open with its supplied workaround.

## Upgrade registered reports

Package installation does not replace existing report resources. Save Desktop work before external edits. With no pending external changes: Home > More visuals > From my files > installed `@vilsem/core/assets/renderer.pbiviz`; accept Update, save, close and reopen. New specs requesting SVG require renderer 4.43. Automatic in the format pane follows the spec, whose default is canvas. Dense charts and animation may be slower with SVG.

## Verification on 2026-11-06

- Private and public app/core: each 1,367 tests passed across 118 files; native production packaging passed in both worktrees. Their bundled JS and CSS hashes match.
- Packaged native painter, headless Edge: 20/20 tests passed: four layouts, both painters, two device pixel densities, physical pointer/Ctrl selection, tooltip/context/clear, zoom recreation preserving IDs, expression geometry, short motion, highlight/data redraw. These are browser host fixtures, not Power BI Service certification.
- Additional before/after browser matrix: 24/24 cases passed against actual 4.42 and 4.43 bundles.
- Desktop: actual 4.42 KPI hero, leaderboard and calendar baselines captured in tool transcript. Manual import offered 4.42 -> 4.43, completed, saved and reopened. All three render real values afterward. SVG selected through the new format dropdown renders the calendar, responds to zoom, and opens native Include/Exclude context menu. A native tooltip was observed on canvas.
- Owned QA model: all 21 baseline model files remain byte-identical. Original source report/model folders were not edited.
- MCP: final public-core 0.8 full suite 338/338 PASS across 17 files. Fresh packed installation, CLI/stdIO/resource checks and actual Claude Code initialization plus all three resource reads PASS. No home skill-folder changes during npm install.
- Fabric Service: a separate six-page canvas/SVG QA report was successfully created with real configured-model data (4 categorical rows, 45 calendar dates), without model edits. Browser access host is unavailable; Service rendering remains unverified pending manual check.

## Performance and unverified acceptance

Actual packaged native bundle, headless Edge, 5,000 scatter marks, host scale 1.5, device DPR 1, animation enabled and real frame clock: 4.42 canvas 11.84 RAF fps / 516 ms p95; 4.43 canvas 9.07 / 816 ms; 4.43 SVG 4.11 / 1,216 ms. All 5,000 marks remain. Canvas backing DPR rises from 1 to 1.5, trading raster work for sharpness. This single machine/run is not a robust benchmark, and the no-noticeable-slowdown target has NOT passed. Do not advertise 60 fps or production performance.

Not verified: native Windows 100%/150% scaling matrix beside native comparison visuals; measured native <300 ms response/no-flicker across zoom gestures; full native Ctrl-click/filter matrix for both painters; the full cross-visual Service interaction matrix. Service six-page browser zoom checks were subsequently completed below. Existing broader Round 3 acceptance limits remain until explicitly retested. Browser emulation does not close those items.

## Published packages

- [Core 0.8 evaluation](https://github.com/bcsnpc/vilsem/releases/tag/core-v0.8.0) includes renderer 4.43.
- [MCP 0.8 evaluation](https://github.com/bcsnpc/vilsem-mcp/releases/tag/v0.8.0) uses the immutable public core archive. Public MCP archive download matches SHA256 `ec62ad8aedfec177b976ff16d74cad8e15558bb19594470907811927ccfeec6b`; installation and actual stdio/three-resource/CLI smoke checks from that public archive passed with npm audit 0. Source changes are merged to each repository's main branch. Existing release assets/tags were preserved.

Service manual confirmation (2026-11-06): the user confirmed seeing all six pages in the separate Service QA report. This confirms page availability by user observation; it does not independently verify numeric correctness, every chart element, zoom 100%/150%, or interactions. Automated Service inspection remains unavailable.


## Live Edge Service follow-up (2026-11-06)

The already-open Edge window exposed its current app.powerbi.com URL through supported Computer Use. Earlier browser-access errors did not recur on this surface. Twelve visual inspections completed: hero, leaderboard and calendar in canvas/SVG, each at browser zoom 100% and 150%. Browser zoom 150% was explicitly visible in Edge; it is distinct from Power BI Fit-to-page scaling (59% at browser 100%, 31% at browser 150%). The full plot/title/legend remained inside the visible chart areas, and no error placeholder or blank visual was observed. Evidence: live screenshots and accessibility states in the session transcript, not headless-browser screenshots.

Both hero variants displayed 1,556,641. Both leaderboard variants displayed 859,980 / 374,283 / 201,258 / 121,120, also present in SVG accessibility text. A separate live read-only DAX query confirmed those four values and grand total. Calendar SVG exposed all 45 numeric labels; the painted calendar canvas showed the corresponding arrangement. This is not an independent cell-by-cell reconciliation.

Canvas and SVG leaderboard click selection visibly dimmed other marks; empty-area clicks restored all marks. Both displayed native tooltips with category and measure values and native Include/Exclude context menus on right-click. Only menu presence was tested; Include/Exclude actions were not applied. No report edits were saved. Browser zoom was restored to 100%, the SVG hero page was restored, and selection was cleared.

Sharpness remains partially accepted: SVG text was visibly cleaner; tiny canvas labels were still soft at small Fit-to-page scales, especially the 31% page scale at browser 150%. No claim of equal-to-native sharpness or universal clipping coverage is made. This follow-up clears the six-page Service rendering/zoom blocker and simple selection/tooltip/context/clear checks. It does NOT close cross-filtering to another/native visual (these six pages contain a single visual), physical Ctrl-click, bookmarks, drill-through, native Windows scaling 100%/150%, export checks, measured sub-300 ms timing or the failing 5,000-point performance target.


## Ordinary-chart motion follow-up (2026-11-06)

After the user clarified entrance animation rather than racing, a separate Normal chart motion page was added to the same owned Service QA report. It contains fixed-data bar (4 rows), annual line (7 rows, 2026 marked partial), donut (4 rows) and scatter (4 rows). All use canvas and declarative formatVersion 4 motion, with no race transform, timeline or frame options. MCP validation/explanation and actual-browser motion previews passed for each; the previews had no critique findings and their final images were inspected. The initial caller spec used formatVersion 2 and was correctly refused, then corrected to 4; this was not a product fix.

A guarded Fabric definition update preserved 22 original parts and the seven existing pages, adding four custom visuals on the eighth page. The operation succeeded. Live Edge showed all four settled charts, and page re-entry captured a partially drawn line and entering scatter points followed by settled marks. This confirms ordinary animation exists; it is not every-series/host/reduced-motion/frame-rate acceptance. No model edits were made. Preview/evidence artifacts remain local QA files; the README's generic recipes do not depend on this model.

For the current summary of verified and incomplete checks, read the [release README acceptance section](../../README.md#current-release-acceptance-and-limitations).
