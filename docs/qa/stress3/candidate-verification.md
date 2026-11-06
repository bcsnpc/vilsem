# Group C candidate verification ledger

This ledger preserves historical development checkpoints. Updated2026-11-06:
private/public core1353/1353 each PASS after the real hidden-Sankey fix;
renderer4.40 and the complete app build PASS. Core/MCP0.7 is published as
an evaluation prerelease with explicit failed/blocked acceptance, as described
in round3-release-readiness.md. Final publication and package results are
appended below; older counts and local-override hashes remain historical.

| Gate | Command / evidence | Result |
|---|---|---|
| Private app/core | npm test -- --maxWorkers=2; round3-d-final-core-all.log | 1,351/1,351 PASS, 117 files |
| Public app/core | npm test -- --maxWorkers=2; round3-d-final-public-all.log | 1,351/1,351 PASS, 117 files |
| MCP direct command | vitest run --maxWorkers=2 without the package timeout | 292 PASS, 3 timeouts at 5 seconds; retained failure |
| MCP canonical command | npm test (configured 30-second timeout, one worker); round3-d-exact-final-mcp-all.log | 298/298 PASS,12files/418.18seconds, including exact final-PNG regression |
| App targets | npm run build; round3-d-final-app-build.log | Native/UI/Fabric/Electron/NSIS PASS; public native package also PASS |
| Dependencies | Frozen-source npm audit in all four package roots | Root 6 moderate; native tooling 13 moderate + 4 low; UI/MCP 0; zero high/critical |
| Model integrity | Owned renderer installation checks all baseline hashes before/after | 21/21 unchanged; original PBIP untouched |
| Independent set semantics | DAX FILTER/COUNTROWS for all eight Venn memberships | PASS, total 293 |
| Final KPI | Real-data validate/explain/preview/commit; final APNG frame inspected | PASS, formatted $24,914,587 |
| Timeline axis inheritance | Seven format regression tests and real911-row zoom retry | PASS; settled PNG and APNG currency ticks inspected |
| Standalone core | Fresh paired-tarball install outside repositories | PASS: Desktop62071,13tables/39measures,real positive revenue,expression compile,zero app imports |
| Standalone MCP | Same isolated install, real SDK connection/schema/preview/resource/expression/commit | PASS, browser-clock APNG and six real country rows |
| Native desktop | Reopened owned report PID20988/AS62071; 24 detail-page captures | All11 expression static marks and three references inspected; motion acceptance partial; physical gestures blocked by helper os error2 |
| 5,000-point animation | Real-clock canvas baseline / QA-only batched prototype | FAIL:24.92 /55.95 RAF fps; target>=57; not native host measurements |

Final repeat with build/tests stopped: idle54.79 RAF fps, normal20.36 fps
(107.8ms p95), prototype55.12 fps (18.2ms p95). FAIL remains; original logs
are retained. The prototype is not enabled in the product.

Private logs are under semantic_app/cache, the public worktree/cache and
vilsem-mcp/test-results/stress3. Raw schemas, rows, reference photographs and
model screenshots are not release attachments. Source templates use actual
field bindings; no returned model result snapshots are included.

The standalone install used an explicit local core0.7 override. Production
dependency URL still pins published core0.6. Final released-URL installation,
native interactions and performance acceptance remain open release gates.

Latest object-value formatting retry: morph, Figma and Tableau examples PASS
validate/explain/real-data preview against Desktop62071 (13tables,39measures;
6/6/3rows). All three PNGs inspected with currency axes. No report writes in
this retry. Native recheck remains open. Source target tests113/113 and the
full1351 suites cover this fix. Current reader floor is renderer4.39.

Desktop state is clean and21 model files remain unchanged. Snapshot blankness
may relate to the independently reported Microsoft capture-layout defect linked
in [native follow-up](native-follow-up.md); that is not proof that the unresolved
Sankey motion capture is correct.

Raster follow-up: the next MCP run hit30second bar/bubble example timeouts
under concurrent build load. That log is retained. Two later stale-import
failures came from adding tests during the already-failed process; its final
294pass/4fail is not a frozen-source gate. Bounded timeline raster batching and
final-image reuse now pass the four focused regression/original-example checks.
A new full unchanged-source MCP run now PASSES298/298 in412.55seconds.
This optimization preserves process isolation and sampled frames;
it does not address the separate5000-point animated-canvas FPS failure.

The next installed-package pixel check found83 differing pixels along the
timeline control when reusing the last sampled PNG. Final-image reuse was
removed; sampled-frame batching remains. A regression reproduces the mismatch
before the fix and passes afterwards (all4 motion-preview tests PASS). Final
unchanged-source full run PASSES298/298 in418.18seconds. The fresh installed
package passes real Desktop schema/validate/explain/browser-APNG/resource/commit
and synthetic timeline batch/final-pixel equality, APNG and contact-sheet checks.
All21 semantic-model files remain unchanged.

Final paired local candidate fingerprints (not published release assets):

* Core0.7 SHA256: `2fb5085dfc8f225585109a2bc8139c3309f8f8b03d0e3cdbf6e278c625306e1d`.
* MCP0.7 SHA256: `c11400b9bf534ef79fb6cecb0e8fe7afabdfcb18c4ed31817080465cb5fd93fa`.

The installed MCP uses a local core override. This is not verification of a
published0.7 dependency URL. Native physical interactions/export and5000-point
motion performance remain open release gates; no0.7 release/main merge is claimed.

## Final0.7 evaluation prerelease publication -2026-11-06

The preceding local-override checkpoint is historical. The final distribution
uses the actual public URLs, with no override or application checkout link.

| Gate | Final result |
|---|---|
| Private/public app-core |1353/1353 each PASS; round3-e-final-core-all.log / final-public-all.log |
| MCP with downloaded public core |299/299 PASS in562.60s; round3-e-public-core-full-tests.log |
| Builds | Complete native/UI/Fabric/Electron/NSIS and independent public native PASS |
| Native package |4.40; independent resource contents identical; permanent clips preserved |
| Catalog thumbnails |144light +144dark regenerated from synthetic fixtures; zero failures |
| Audits | Root6moderate; native13moderate+4low; UI/MCP0; high/critical0 |
| Model integrity |21/21 unchanged after final live public-install acceptance |
| Public core |87458f3 on public main; core-v0.7.0 GitHub prerelease |
| Public MCP |c9f887c on main; v0.7.0 GitHub prerelease |
| Downloaded assets | Core, native renderer and MCP SHA256 match tested archives |
| Fresh public-URL install | Normal npm install audit0; no overrides or VILSEM_APP_PATH |
| Live installed MCP | Desktop62071,process-workspace-port-file;13tables/39measures; validate/explain/real6row browser-APNG preview/resource/commit PASS |
| Installed final-frame contract | Batch/final PNG equality, two states, APNG11189bytes/contact-sheet9484bytes PASS |
| Documented Git-tag install | Normal npm install of git+https tag v0.7.0 PASS/audit0; stdio handshake0.7,19tools,1prompt, spec validation and expression resource PASS; no app link |

The fresh real-data PNG was inspected: currency axes and six country revenue
bars are readable. The owned report accepted a clean report-only reload of4.40;
that is not proof of native paint or physical interactions.

Published assets:

* [Core0.7](https://github.com/bcsnpc/vilsem/releases/tag/core-v0.7.0), SHA256
  `62b8e18d590f7bd7abc5c8546c4a6be743a6992f56857a264c3863991564f8a9`.
* Renderer4.40, SHA256 `cebeb4e055ada77d6a3f3c6c3a5289cf3ec03ed6d28937d5a7d936159bae0b6c`.
* [MCP0.7](https://github.com/bcsnpc/vilsem-mcp/releases/tag/v0.7.0), SHA256
  `dec2d3aed1de0a8bef09d25cf89f002014e6c8a1d3e5dd215471a81965df5c0f`.

Both releases are explicitly prereleases and do not replace stable0.6.
Native physical interaction/export checks remain UNVERIFIED,5000point60fps
remains FAIL and mockup card fidelity remains PARTIAL. These are retained in
READMEs/release notes, not hidden by publication. Portable synthetic benchmark
source is MCP scripts/benchmark-motion.mjs; it exits1 on the unmet target.
