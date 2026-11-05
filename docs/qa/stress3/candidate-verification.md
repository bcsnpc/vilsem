# Group C candidate verification ledger

This is a development checkpoint, not a release announcement. No 0.7 tag or
main merge is approved by these results alone.

| Gate | Command / evidence | Result |
|---|---|---|
| Private app/core | core build, vitest run --maxWorkers=2; round3-c-frozen-core-tests.log | 1,332/1,332 PASS, 117 files |
| Public app/core | vitest run --maxWorkers=2; round3-c-frozen-public-tests.log | 1,332/1,332 PASS, 117 files |
| MCP direct command | vitest run --maxWorkers=2 without the package timeout | 292 PASS, 3 timeouts at 5 seconds; retained failure |
| MCP canonical command | npm test (configured 30-second timeout, one worker) | 295/295 PASS, 12 files, 374.84 seconds |
| App targets | npm run build | Native/UI/Fabric/Electron/NSIS PASS |
| Dependencies | Frozen-source npm audit in all four package roots | Root 6 moderate; native tooling 13 moderate + 4 low; UI/MCP 0; zero high/critical |
| Model integrity | Owned renderer installation checks all baseline hashes before/after | 21/21 unchanged; original PBIP untouched |
| Independent set semantics | DAX FILTER/COUNTROWS for all eight Venn memberships | PASS, total 293 |
| Final KPI | Real-data validate/explain/preview/commit; final APNG frame inspected | PASS, formatted $24,914,587 |
| Standalone core | Fresh paired-tarball install outside repositories | PASS: Desktop57149,13tables/39measures,real positive revenue,expression compile,zero app imports |
| Standalone MCP | Same isolated install, real SDK connection/schema/preview/resource/expression/commit | PASS, browser-clock APNG and six real country rows |
| Native desktop | application.state.get and fresh Computer Use inventory retry | BLOCKED: unsaved edits; helper pipe unavailable (os error2); no reload/input |
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
