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

Not verified: native Windows 100%/150% scaling matrix beside native comparison visuals; measured native <300 ms response/no-flicker across zoom gestures; full native Ctrl-click/filter matrix for both painters; Power BI Service at browser zoom 100%/150%. Existing broader Round 3 acceptance limits remain until explicitly retested. Browser emulation does not close those items.
