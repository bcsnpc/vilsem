# Round3 engineering report

Core/MCP0.5 and0.6 completed Groups A/B. Group C is published as the0.7
evaluation prerelease; publication results are recorded in the verification
ledger. Failed or blocked acceptance below remains failed or blocked.

## Tools and prompt

| Tool/prompt | Round3 result |
|---|---|
| connect_model | Follows local or live-connection report bindings without editing them. |
| get_schema | Summary/full metadata, profiles, DAX/format context, relationships and page bindings. |
| design_visual prompt | Structured design/edit brief with optional reference image; no LLM call inside MCP. |
| validate_spec | Path-specific diagnostics and bounded expression checking before preview. |
| explain_visual | Shows actual query/bindings and resolved structure. |
| preview_visual | Real-data PNG, critique, interaction assessment, controlled-browser APNG or labelled state fallback. |
| preview_variants | Up to four candidates using the same queried data. |
| list_visuals | Reads existing custom visuals across pages; no separate manifest/list_recent. |
| read_visual | Recovers editable spec, bindings, layout, manual formatting and live PNG. |
| diff_visual | Reports proposed changes with before/after previews without writing. |
| update_visual | ETag-protected JSON Patch, dry run and manual-format preservation. |
| commit_visual | Writes one custom visual; optional saveAs stores its reusable template. |
| validate_visuals | Reports only Vilsem visuals and reader incompatibility; native objects untouched. |
| list_templates | Lists shipped and user-library templates with source. |
| save_template | Saves a validated spec in OS user data or the approved shared directory. |
| delete_template | Deletes a named user template only. |
| extract_design_tokens | Bounded PNG/JPEG statistics, not image understanding or copied business data. |
| compare_preview | Reference/render comparison with live model values and structural feedback. |

`run_dax` stays read-only and `list_pages` stays read-only. The MCP does not
author native visuals, slicers, filters, bookmarks, themes or model changes.

## Resources

* `vilsem://docs/design-guide`:1424-word analytical design guidance and worked examples.
* `vilsem://docs/workflow`: new/edit/reference loops and the never-write-model rule.
* `vilsem://docs/spec-format`: documented transforms, slots, formatting and motion.
* `vilsem://docs/expression-language`: complete closed grammar, examples and limits.
* `vilsem://docs/motion-capture`: capture modes, isolation, limits and fallback semantics.
* `vilsem://templates/<id>` and `vilsem://templates/user/<name>`: reusable specifications.

## Critique and safety

Critique covers label overlap/clipping, rotation, excess colours, empty slots,
all-null/zero data, truncation, legend overlap, number-format context, contrast,
pie cardinality, dual-axis review and long/dense animation. Findings identify
editable paths and include interaction limitations. Conservative geometry and
contrast checks are assistance, not accessibility or host certification.
Fixtures live in MCP tests/critique.test.ts and related rendering/SDK suites.

Expression series use a JSON AST with arithmetic, comparisons, conditionals,
bounded strings/date/number formatting, colours and a small chart API allowlist.
Outputs are bounded graphic trees, not JavaScript. Limits: depth32,16000 AST
nodes,2000 elements/item,50000 elements/visual,50000 steps/item and2000000 total
steps. Paths, text, arrays and coordinates have separate bounds. No eval,
Function, arbitrary property traversal, callbacks, loops, DOM or network are
available to authored specifications.

The full core suite includes1000 valid arithmetic fuzz trees and1000 invalid
capability/prototype/shape mutations, plus accessor/cycle, budget and malformed
path probes. Trusted rendering-engine completion callbacks are runtime code;
they are not an author-visible expression capability.

## Visual exercises

All11 former(c) families pass real-data validate/explain/preview/commit and
inspected SSR output: Marimekko, mosaic, violin, ridgeline, beeswarm, hexbin,
contour, weighted Voronoi treemap, flame, word cloud and Venn. All11 also have
native static mark/geometry captures; title/bounds and physical interactions
remain partial/unverified. Exact per-visual evidence is in expression-results.md.

All ten motion exercises and three reference exercises pass real-data tool
cycles. The line first-point fix is natively inspected. Renderer4.40's hidden
Sankey completion has an exact real-browser static-frame regression; this is
not a Desktop export test. See motion-reference-results.md for each result.

## Verification and limitations

Private/public app-core each1353 tests PASS; full Electron/native/UI/Fabric/NSIS
build PASS. MCP299tests PASS with downloaded public core;144light/144dark
thumbnails regenerated. Fresh public-URL install/live checks PASS without
overrides or an app link. Artifact hashes and commits are in the candidate
ledger.21 owned QA semantic-model files remain byte-identical; original PBIP
and model are untouched. Audits have zero high/critical findings; remaining
moderate/low toolchain findings are documented in SECURITY.md.

Both tagged GitHub releases are marked prerelease: core-v0.7.0 (87458f3) and
v0.7.0 (c9f887c). Downloaded hashes match. The documented Git-tag install also
passes audit0, stdio handshake0.7,19tools/1prompt, validation and expression
resource access without an app checkout link. Stable0.6 remains available.

Native physical gestures and PDF/subscription acceptance are not completed:
Computer Use cannot connect to its native pipe and bridge snapshots are
unreliable.5000-point60fps remains FAIL after regular, batch, grouped, dirty-
rectangle and SVG probes; no point dropping or silent motion disabling masks
that result. These limits must accompany the prerelease.

Reference mockup outer-card fidelity remains partial. Venn circles are
schematic; arbitrary exact area-proportional Euler fitting, unshipped geographic
assets and3D are not supported. Historical605 before-state/cross-target images
remain historical; current counterparts and regenerated shipped thumbnails do
not relabel those old captures as current native acceptance.
