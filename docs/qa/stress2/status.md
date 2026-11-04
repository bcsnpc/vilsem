# Stress round 2 - acceptance status

111/120 rendering PASS; nine category-(c) refusals. See [all 120 results](results.md), [format additions](format-additions.md), and [extension gaps](https://github.com/bcsnpc/vilsem-mcp/blob/main/docs/expressiveness-gaps.md).

Every PASS has actual validate_spec, explain_visual, preview_visual and commit_visual evidence against the real AdventureWorks model, followed by an individually inspected 900x600 native Desktop screenshot. All 111 new passing templates are shipped alongside nine earlier examples. The supplied original PBIP was not modified.

Task 1 query-only scoped measures were live verified. All 19 model-definition files match their pre-audit SHA256 values after the final normal QA report close; no Desktop culture restoration was required at that final check. No persistent measure/model writes were made.

Final renderer 4.31 preserves the existing GUID and semantica.primitiveSpec property. Native word selection dims unrelated labels without revealing invisible helper symbols. On QA page Stress2-B2-C1, with target interaction explicitly set to Filter, selecting road changed United States revenue from 7,938,999.42 to 3,240,355.21; empty-area clear restored 7,938,999.42. The report initially used Highlight. This was temporary Desktop interaction configuration, discarded on close; MCP does not edit report interactions. Native host tooltips were inspected directly. Selection-style/clear semantics also have regression tests. This does not claim native-slicer or Service coverage.

Desktop auto-detection used process-workspace-port-file, latest isolated-consumer port 56276 (previous live acceptance port60535). Port numbers are ephemeral.

Verification: private app/core 956/956; clean public app/core 956/956; MCP 167/167, including populated/empty renders of the final catalog and stdio protocol tests against locally packed core 0.4.0. Public first run lacked nested UI/renderer dependencies; after installing them one concurrent run had a cold filesystem schema test timeout. That unchanged suite passed isolated, followed by the entire suite passing with one worker. No timeout was raised. Logs remain in ignored local QA directories.

Audits: MCP zero vulnerabilities; app workspace 45 (19 moderate,21 high,5 critical), unresolved. See audit-summary.json. The resvg crash is isolated to a worker, not eliminated. Fixed-size word/swarm layouts do not promise arbitrary resize collision guarantees. CI assumptions and bounded cohort population are disclosed in format-additions.md. Rendering acceptance is not exhaustive formatting, clipping, interaction, cloud-target, accessibility, installer or certification acceptance.

Core core-v0.4.0 and MCP v0.4.0 are published and their source changes are on public main. Published-core suite167/167 and isolated release-tarball live acceptance PASS; Public Git-tag installation, stdio/catalog/scratch validation/fixture PNG PASS. See release-status.md.

Published-core rerun checkpoint:165/167, two30s timing failures (Cleveland dots32.225s; six-render statistical batch34.698s). Both unchanged tests passed isolated in14.86s after closing owned QA Desktop; no timeout increase or assertion changes. The unchanged full-suite retry subsequently passed167/167 in408.30s.

Final published-core full-suite retry:167/167 PASS in408.30s; no source, assertion or timeout changes after the two isolated retries. Core core-v0.4.0 and MCP v0.4.0 are pushed to their public main histories. See release-status.md for artifact/install acceptance.
