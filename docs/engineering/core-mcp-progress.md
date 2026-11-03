# Core and MCP kickoff ? 2026-11-02

Source instructions: `C:/Users/chait/Downloads/codex-kickoff-vilsem-mcp.md`, plus the subsequent renderer/interaction/custom-only scope changes.

## Completed locally
- Created `feat/core-package` from private main after fetching both remotes. Existing audit work preserved.
- Added npm workspace `@vilsem/core`; extracted primitives, compositions, templates/examples, row and DAX helpers, spec serialization and PBIR report/project logic.
- Renamed renderer folder/package/display name. GUID and `objects.semantica.primitiveSpec` retained. Version 4.13.0.0.
- Added native host interaction contracts on the ECharts path, no-data/focus/tooltip capabilities and filtered empty state. Harness tests cover highlights, selection callbacks, six category bindings, menus, tooltips, templates and keyboard.
- Implemented additive existing-report insertion, with official vendored PBIR schema validation and preservation tests. Existing-report UI insertion remains retired; this API is for the requested MCP workflow.
- Full Electron/renderer/UI/standalone/Fabric build passed; packaged core CJS imports passed a real Electron smoke test. Existing certificate/signing warnings persist.

## In progress / not claimed complete
- Final full suite: **783 passed, 0 failed**.
- Logical commit, remote push/merge/tag; public main has a separate sanitized history and must not receive private history indiscriminately.
- MCP repository/server/tools/resources/configuration docs and stdio/integration tests.
- Live Service/Desktop verification of new interaction contracts; DOM-adapter and drill-mode parity is not established by the ECharts harness.

## Evidence
`cache/core-final-tests.json`, `cache/core-packaged-smoke.json`; focused suite 50 passing tests. Final full suite: 783 passing.
