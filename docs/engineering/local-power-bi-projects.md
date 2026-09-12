# Local Power BI projects and export

Status: source-folder resolution and local package writer implemented and unit tested; no export UI or local query provider implemented yet.

## Requested behavior

- Export the authored dashboard as a local Power BI project, with all pages, visuals, formatting and data bindings.
- Open the PBIP or report definition in Power BI Desktop; retain live model queries rather than baking a screenshot/static data result.
- Create a Vilsem project against a local Power BI semantic model and persist its connection identity.
- Preserve current authoring features and report their target compatibility precisely.

## Supported file contracts

Microsoft documents PBIP as the project entry point and definition.pbir as a directly openable report entry point. Enhanced PBIR stores the report/page/visual definitions as documented JSON files. A PBIR entry point alone is not a complete report: its definition folder and resources must accompany it.

PBIX conversion is through Power BI Desktop File > Save As; Vilsem should label its generated artifact PBIP/PBIR, not create a renamed ZIP and label it PBIX.

A report byPath connection references a semantic-model folder using a relative forward-slash path, opening that model for editing. It is not the same as a live connection to an already running Desktop model. A byConnection reference documented for reports points to a Fabric-hosted model. Do not put localhost into the Fabric byConnection contract without a separately validated Analysis Services model-reference design.

Sources checked2026-09-07:
- https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-overview
- https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report

## Repository dependencies established

- Home.jsx creates projects after connectDataset against a Fabric workspace/dataset.
- electron/ipc/connection.js loads model metadata using the Fabric provider.
- electron/ipc/query.js uses src/fabric/client.js for scalar/table queries; the client obtains a cloud token and calls the dataset executeQueries endpoint. A local file pointer alone cannot make existing authoring query that model.
- AppSpecToPowerBI.js currently omits nav_button and OBJECT_TYPES and removes visuals without measures in appSpecToPowerBIPagesWithBindings. Reusing it unchanged cannot meet all-visual export acceptance.
- publishCustomVisualFlow.js fetches data, generates DAX, merges generated measures into model TMDL, updates the remote model, embeds the bundled custom visual, then creates/updates a legacy report. Calling this path for a local export would perform remote writes and would inherit rendering gaps.
- The generated _SemanticaGenerated measures must exist in the model or be replaced by validated supported report-level/direct binding architecture. Exporting only report files would otherwise create unresolved bindings.
- reportBuilder.js contains an older enhanced PBIR path with historical custom-visual registration changes; it is not established as the current working Desktop export implementation.

## Implementation order

1. Source mode resolved by user: Home > New project must offer Fabric model or a local PBIP model folder. Export must have a fourth output option saving a local report. Running arbitrary PBIX sessions is not a separate requested source option.
2. Define persistent provider identity and isolate metadata/query/cache behavior by model. For running Desktop, discover/reconnect the session rather than persist an ephemeral port as a permanent identity.
3. Build a pure enhanced PBIR report generator and a per-visual compatibility report. Preserve canvas objects and page navigation; never silently drop unsupported elements.
4. Handle generated measures without changing the user's source model as an incidental effect of Export. Where model changes are necessary, prepare a separate copy or an explicit reviewable operation.
5. Write a new destination project containing PBIP, report definition/resources, connection reference and a Vilsem source snapshot. Fail safely on collisions; validate all file paths; no credentials in the artifact.
6. Add Export > Local Power BI project and New project > Local semantic model, with connection and compatibility feedback.
7. Validate schemas, package completeness, model references, all41 visual mappings, preservation of fields/settings and failure cleanup; then open in actual Power BI Desktop and exercise live filters, refresh, cross-filter, page navigation, save/reopen and PBIX Save As.

## Acceptance gates

No all-features claim until every registered visual is tested in the resulting Desktop report. Local automated file tests are necessary but do not prove Desktop loading or rendering. Retain the existing Power BI secondary-axis interaction defect and other parity findings in the acceptance list. Full offline authoring also requires explicit behavior for AI providers and cloud-only publish operations.

## Foundation delivered

src/powerbi/localProject.js resolves PBIP -> report -> semantic-model references, or accepts a direct model folder. It distinguishes remote report bindings, ambiguous folders, missing models and invalid absolute references. Model identity is a stable hash of the resolved folder path. It recognizes TMDL/BIM file layout; it does not yet parse model semantics or evaluate DAX.

The low-level writer accepts already prepared enhanced PBIR parts and a binding. It validates paths, duplicate names, required report/version/binding files, and local model existence; preserves binary resources; refuses to overwrite destination folders; writes the PBIP entry point last. A write failure retains incomplete output for diagnosis. This is structural validation, not full schema or visual compatibility validation. It neither generates visual definitions nor installs generated measures.

Tests: tests/local-power-bi-project.test.js17/17 passed. Synthetic files only. No application workflow or Power BI Desktop open/refresh/save verified yet. Power BI Desktop Store installation found, but no running Desktop model or repository PBIP fixture found during environment inspection. Requested a user-selected PBIP path for end-to-end verification; do not auto-select unrelated client files.


## Electron selection boundary

Implemented electron/ipc/localPowerBI.js and preload selectLocalPowerBIModel. Supports a native folder picker or exact .pbip/.pbir selection, returns source identity and resolved paths, and distinguishes cancel/invalid selection. It does not switch model connections. Dedicated IPC tests5/5 plus file tests17/17 pass; Electron startup passed. Home integration is pending a working local metadata/query provider, so no misleading create button is enabled yet.


## Core authoring integration delivered

Home now exposes Fabric/local source choices; Setup allows entering Home for local work. localRuntime.js/localBridge.ps1 discover matching open Desktop PBIP sessions and query using ADOMD. Metadata/query/workspace handlers route to the active local provider. AppGenerator persists _localSource, and App reconnects local saved projects using that source rather than a saved port. The canvas starts empty: original report visuals are not imported. New report creation, real-data Bar rendering, database save and remount verified. See docs/qa/local-vilsem-report-workflow.md for exact scope and limitations. Export generation remains pending.


### Enhanced report prototype checkpoint (2026-09-07)
`ui/src/pages/powerbi/localReportBuilder.js` now generates new enhanced PBIR definitions with private renderer resources and existing-field bindings. `saveBoundReport` in `src/powerbi/localProject.js` supplies the active model reference and writes a separate PBIP entry point. No model mutations occur.

This implementation is not yet exposed through the product UI: an actual generated report opens in Desktop but its custom visual is blank (EXPORT-LOCAL-017). Unsupported visuals are rejected, and advanced formatting, filters, navigation, slicers and complete visual parity remain unfinished. Schema-valid does not imply Desktop-valid.

Reproduce with `node scripts/qa/generate-local-probe.cjs` (copies the supplied QA semantic model) and `python scripts/qa/validate-local-pbir.py` (requires Python jsonschema and network access). The generated artifact path is recorded in docs/qa/evidence/local-generated-report.json. Microsoft format reference: https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report .


### Report theme requirement
The exported report must preserve Vilsem's saved theme mode: dark page #0b0b12 or light page #FFFFFF, opaque page fill, matching Power BI outspace, and the same mode in each custom renderer's primitiveSpec. Container backgrounds must not introduce white rectangles. This concerns report content; Power BI Desktop's own ribbon/application theme is controlled by Power BI. tests/local-report-builder.test.js validates both modes across multiple pages. Actual Desktop appearance is still pending EXPORT-LOCAL-017 resolution.


### Save as Power BI preview connected (2026-09-08)
The product output chooser now includes Save as Power BI (Preview). Restart Electron after updating main/preload code. In an open report choose Export / Publish -> Save as Power BI -> Choose destination and save. The native picker chooses a parent directory; Vilsem creates a new timestamped report folder and displays Report.pbip's path. Ordinary Save remains Vilsem persistence. Power BI Desktop can open the PBIP; PBIX creation uses Desktop Save As.

The flow uses the production bundled renderer loader, localReportBuilder, save-local-power-bi-report IPC and saveBoundReport. The handler verifies model identity before and after the picker. It never overwrites an existing project folder or updates the semantic model. Existing unsupported-type/slicer/drill preflight errors are surfaced to the user. Other advanced formatting/interaction parity remains under testing; this is explicitly a preview. Fabric reference export requires workspace/model names and remains unverified against a real Fabric model.

Loaded Electron test local-report-ui.json now includes actual file creation through production IPC and writer (7 checks). Native picker selection is stubbed only for unattended QA; data queries, renderer package loading and disk writes are real.
