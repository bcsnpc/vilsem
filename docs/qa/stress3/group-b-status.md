# Round3 GroupB - candidate verification

GroupA0.5 and GroupB0.6 are published. Core [core-v0.6.0](https://github.com/bcsnpc/vilsem/releases/tag/core-v0.6.0) (`67899a3`) and MCP [v0.6.0](https://github.com/bcsnpc/vilsem-mcp/releases/tag/v0.6.0) (`df7e783`) are pushed to public main. Native Desktop acceptance remains explicitly partial. GroupC begins next.

## Implemented and tested

| Area | Result and evidence |
| --- | --- |
| Model context | Live Desktop port57149 via process-workspace-port-file;13tables,39measure expressions,10relationships,83profiled columns,0profile errors;13internal identities skipped. Composite-key field parameters use a tested read-only fallback. See group-b-live-context.json. |
| Design prompt/resources | SDK design_visual prompt, edit routing, summary context,1462-word design guide and workflow resource; no LLM call inside MCP. |
| Critique |16focused tests: null/zero series, palette count, rotation, empty slots, formatting, pies, dual-axis review, viewport/text overlap, ellipses, legend/actual plot intersection, page-background contrast and explicit interaction coverage. This is heuristic feedback, not host/accessibility certification. |
| Variants | One shared bound-data query, up to4specs, one labelled grid PNG, per-variant critique; mismatched queries/labels refused. |
| Validation |15broken-spec fixtures receive JSON pointers, expected shapes and fixes; scoped DAX errors have context/suggestions. |
| Saved visuals | PBIR-backed custom-only list/read/diff/update, RFC6902, dry-run default, etag/byte guards and writer lock. No separate manifest/list_recent. |
| Editing | Fresh stdio session listed116existing Vilsem visuals, read old Sankey49, dry-ran and wrote a style patch. Query unchanged; inspected real-data before/after PNGs, iterated spacing, final critique0findings. That target had0manual objects, so it does not prove a manual native gesture survived. |
| Formatting |69common properties, independent numeric-axis formats/colours, explicit automatic bounds and current-value pane display. Manual properties win over author formatting. Every property has a render contract test; DOM adapters show only Appearance/Title/Border. |
| Versioning | Pure forward migrations0.1..0.6, real string-DAX migration, wire-version validation, explicit future-version refusal. Historical app field-label metadata is distinguished from scoped DAX and preserved. |
| Preservation | Styling-only edits preserve PBIR queries/layout/manual groups; reset removes known formatting groups only and leaves unknown state. Native objects are refused by edit tools. |

## Tests and build gates

- Clean public app/core:1168/1168PASS across96files (round3-b-gated-public-tests.log).
- Packed-core MCP contract run:75/75PASS across4files; runtime import canaryPASS.
- Final full MCP run:225/225PASS across7files,187.50s, matching packed core (round3-b-gated-full-tests.log).
- Electron/renderer/UI/Fabric build:PASS (exit0). The
  installer is unsigned, uses the default icon and retains the existing beta
  application version; this is a build check, not a new installer release or
  clean-profile installation acceptance.
- Audits: private/public root6moderate, native13moderate+4low, UI0, MCP0;
  zero high/critical. See SECURITY.md for mitigations and limits.
- All21owned QA semantic-model definition files remain byte-identical. Supplied
  original PBIP/model files were not changed.

## Exact native limitations

ComputerUse26.1029still cannot connect to its native pipe (oserror2), including
2sretry and reset/reinitialization. No mouse/keyboard input was sent afterward.
Desktop's official SDK responds to application state and reload(false), but the
attempted page13snapshot was blank; after restoring the exact pages.json backup,
a current-page snapshot timed out. These are NOT native render passes.

Consequently the final native Sankey before/after, a newly performed manual
format-pane gesture, physical Ctrl-click and the final stale-selection/slicer
retry remain unverified. Native35 has source/host tests and packages successfully;
that does not certify the live UI. Existing reports/resources are never upgraded
implicitly by MCP; only the owned QA report was explicitly refreshed.

## Failures retained

The first edited Sankey preview exposed [object Object] labels. Semantic labels
had been treated as style objects. Fixed shared adapters/formatter fallback and
added a real-data regression; corrected preview was inspected. Native verification
of that fix remains open.

Two intermediate full MCP runs mixed an in-flight source change with a cached
transform/older installed core candidate (contrast expectation and missing
scopedMeasuresOf). They are retained as failed runs, not counted as acceptance.
The final pass must use one frozen source revision and its matching packed core.

Evidence: ../edit/round3-edit-acceptance.json and before/after preview PNGs;
blank native attempt is explicitly named round3-sankey-inactive-page-blank.png.

## Remaining after0.6

GroupC: bounded expression geometry and security/fuzz tests; former(c)stress
visuals; motion/lifecycle/previews/performance; user-template memory; mockup/image
statistics and comparison; final native acceptance and0.7release. Geographic map
assets and3D remain outside the expression-language scope.


## Public package acceptance

Fresh D:/vilsem-mcp-public-060 install uses the actual public core release URL;
no app path or local-core override. Published MCP asset hash matches the tested
tar. SDK handshake0.6, Desktop auto-port57149, summary/full schema13tables,
39expressions/10relationships, validation/explanation,3real-row preview,2variant
comparison, prompt/resource, commit/read/dry-run/update all PASS. Inspected the
three PNGs. Queries and a seeded18px manual pane object survive the14px author
patch; this is a fixture/SSR check, not a physical native gesture. The owned QA
page stress3_pkg060 was prepared by the harness outside MCP. Original model and
native report objects remain untouched. See public-package-060-acceptance.json.
