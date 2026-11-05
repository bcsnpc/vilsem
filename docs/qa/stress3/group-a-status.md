# Round 3 Group A acceptance

Status: release candidate verified with the explicit limits below; core/MCP0.5 release publication in progress. Group B/C have not started.

## Results

| Check | Result | Evidence |
| --- | --- | --- |
| Clean public app/core suite |1,055/1,055 PASS|`cache/round3-public-upper-header-tests-limited.log`|
| MCP final dependency suite |189/189 PASS,345.06s|`D:/vilsem-mcp/test-results/stress3/round3-upper-header-full-tests.log`|
| Theme/format/host focused tests |118/118 PASS|`cache/round3-treemap-upper-label-after.log`|
| Native renderer4.34 |Package PASS; GUID/property retained|`cache/round3-public-upper-header-build.log`|
| Light treemap leaf/header contrast |Verified native, internal markup removed|`theme-native/stress2_04{0,1}*.png`|
| Dark report palette/foreground |Verified native treemaps, bar and percentage heatmap|`theme-dark-final/`|
| Full currency bar label |Verified in Desktop and separate packaged SSR|`bar-model-format-{native,after}.png`|
| Actual native percentage tooltip |23.45% verified on renderer34|`matrix-native-tooltip-34.png`|
| Standalone packaged core/MCP |Desktop schema/validate/explain/preview PASS without app path|`packaged-preview-acceptance.json`; local candidate dependency override|
| Shipped thumbnails |120light+120dark rendered/reviewed; final treemap four-image refresh PASS|MCP `templates/thumbnails/*/manifest.json`|
| UI/web/Fabric builds |PASS|`cache/round3-final-general-{ui,standalone,fabric}-build.log`|
| Installer |Latest header-corrected build PASS; unsigned/default icon|`cache/round3-upper-header-installer-build.log`; not installed|
| Model integrity |21/21 original baseline hashes unchanged after normal close and all SDK reloads|`cache/round3-model-hashes.json`; original supplied PBIP untouched|

Core tarball:110files, SHA256 `70d40eb6e52baf582c2dc2927a1fb2c1913d4827c705a8ba321e7818f1b4e0f5`.
Audits: root15moderate, renderer tools16moderate/4low, UI0, MCP0; zero high/critical. Mitigations are in `SECURITY.md`.

## Failures retained and verification limits

- The default-concurrency public test run hit three5s timeouts while Desktop was starting (`round3-public-upper-header-tests.log`). Full retry with two workers passed1,055; no assertion bypass or timeout inflation.
- Earlier native treemap retry exposed literal rich-header markup. Before evidence is retained in `treemap-rich-header-before/`; a real SVG regression reproduced it, the shared formatter was corrected, and the final native light/dark retry passed. STRESS3-THEME-015 is verified for these paths.
- Windows Computer Use lost its native pipe after interruption. Required retry/reset did not recover it. The official Desktop SDK remained available; `file.reload/v1` with `reloadModelDefinition:false` and native snapshots verified rendering without model writes.
- A temporary project-pointer swap was not a reliable way to navigate; Dark-page capture timed out. Original project bytes were restored. Dark acceptance instead used a backed-up temporary theme/page fixture in the current owned report; captures were inspected, theme/page/project bytes restored, and only two exact temporary fixture files/directories removed.21model hashes remained unchanged. Native mouse activity was not inferred from these screenshots.
- Physical Ctrl-click and the final native stale-selection-to-slicer transition remain unverified because Computer Use is disconnected. Keyboard additive selection and other native interactions previously passed; source regressions cover Ctrl/clear, highlights, stale IDs, bookmarks, tooltip, context menu, empty state and resize. See [individual interaction results](../interactions/round3-status.md).
- Latest packaged Home startup was not repeated after this renderer-only refinement. Earlier Electron45 packaged Home/new-project chooser smoke passed; installer build/content checks are separate from installation and clean-profile certification.
- Arbitrary native report-font inheritance is unverified; bounded model formats are not a complete Excel/dynamic-format engine. Live SSAS is fixture-only; Fabric byConnection routing was tested using REST queries, not cloud XMLA transport.
- Historical screenshots remain historical before-state/cross-target evidence.111Stress2 current native counterparts exist;605original records were inventoried. Not every historical image has been regenerated, and no Service/Fabric screenshot is relabelled as current Desktop verification.

## Release gate

Publish the tested core artifact first, change MCP to its real public0.5 URL, verify public install/hash/protocol, then publish MCP. Record commits/tags/results below. Remaining native limitations must stay in release notes/README. This does not certify production readiness or complete Groups B/C.
