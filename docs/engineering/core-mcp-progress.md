# Core and MCP kickoff ? 2026-11-02

Source instructions: `C:/Users/chait/Downloads/codex-kickoff-vilsem-mcp.md`, plus the subsequent renderer/interaction/custom-only scope changes.

## Completed locally
- Created `feat/core-package` from private main after fetching both remotes. Existing audit work preserved.
- Added npm workspace `@vilsem/core`; extracted primitives, compositions, templates/examples, row and DAX helpers, spec serialization and PBIR report/project logic.
- Renamed renderer folder/package/display name. GUID and `objects.semantica.primitiveSpec` retained. Version 4.13.0.0.
- Added native host interaction contracts on the ECharts path, no-data/focus/tooltip capabilities and filtered empty state. Harness tests cover highlights, selection callbacks, six category bindings, menus, tooltips, templates and keyboard.
- Implemented additive existing-report insertion, with official vendored PBIR schema validation and preservation tests. Existing-report UI insertion remains retired; this API is for the requested MCP workflow.
- Full Electron/renderer/UI/standalone/Fabric build passed; packaged core CJS imports passed a real Electron smoke test. Existing certificate/signing warnings persist.

## Verification and publication
- Initial core branch merged into private main (`c1b7299`) and ported into public main (`67944f9`) without importing private history. Both remotes have `core-v0.1.0`.
- Core 0.1.1 patch is merged and tagged in both repositories; public release artifacts are available. It adds the package license, patched ZIP dependency, structured identifier-safe DAX and shared preview/report ordering. Renderer patch version: 4.13.1.0.
- Full application suite: **788 passed, 0 failed** after the patch. Full Electron build rerun passed, including the packaged-core import smoke.
- New public repository: https://github.com/bcsnpc/vilsem-mcp. Server implementation has 27 passing tests, covering all 14 shared templates, PNG rendering, additive insertion, custom-only validation and real stdio transport.
- Live Fabric MCP acceptance passed against the app-configured model: 20 tables, 97 measures, all 79 columns sampled successfully with a maximum of 10 samples, plus a model-backed PNG preview. The old QA model returned 404; no claim is made for that removed/inaccessible target.
- Desktop query/reload acceptance is not run: no local Analysis Services engine is open. Live Service/Desktop tooltip, drill-through and bookmark acceptance remains separate from the renderer harness. DOM-adapter and every template-transform interaction are not certified.
- MCP main and v0.1.0 are published. A GitHub npx installation successfully launched over stdio and returned all 14 templates. The final MCP dependency audit reported zero vulnerabilities. The new server reuses the source checkout's model/auth adapters through VILSEM_APP_PATH; it does not independently decrypt Electron saved-workspace credentials.

## Evidence
`cache/core-final-tests.json`, `cache/core-packaged-smoke.json`; focused renderer/insertion suite: 50 passing. MCP private evidence is under its ignored `test-results/` directory; no model sample values or credentials are published in these notes.

## Delivered repositories and remaining acceptance

Public core/application: https://github.com/bcsnpc/vilsem (main; core-v0.1.0 and core-v0.1.1). Private application: bcsnpc/semantic_app (main; matching version tags, independent history). MCP: https://github.com/bcsnpc/vilsem-mcp (main and v0.1.0). Core releases contain portable npm tarballs; MCP uses the immutable core-v0.1.1 URL rather than a local path or unsupported monorepo Git subpath.

The requested extraction, renderer rename, host interaction code, additive injection API, MCP tools/resources/documentation and automated verification are delivered. Remaining environment acceptance: open a local Desktop model to test connection/reload/rendering, and exercise report-page tooltips, native sibling/slicer filtering, drill-through and bookmarks in an actual Power BI report. Existing broader visual-formatting/export/AI backlogs are not closed by this extraction. The new MCP has not been published to the npm registry; use the documented GitHub install.
