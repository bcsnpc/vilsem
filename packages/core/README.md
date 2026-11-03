# @vilsem/core

Shared, headless Vilsem visual primitives, declarative templates, DAX/row helpers, spec serialization and PBIR operations. The package contains no Electron or React imports and requires no browser globals.

Run `npm run core:build` from the workspace root before importing compiled ECharts compositions. `npm run powerbi:build` builds the renderer and refreshes `assets/renderer.pbiviz`. The root application build includes the workspace package in the Electron archive.

Exports: `@vilsem/core/primitives`, `/templates`, `/templates/examples`, `/dax`, `/spec`, `/spec/resolve`, and `/pbir`. Existing app paths provide compatibility facades where needed by exported applications.

`injectVisual({reportDir,pageName,visualName,spec,bindings,layout})` adds a new Vilsem visual to an existing PBIR page. Bindings contain `dimensions:[{table,column}]` and `measures:[{table,name}]`; layout uses pixel `x,y,width,height,z,tabOrder`. It refuses existing visual names and non-resolving specs. It validates against the bundled official Microsoft visual-container schema and adds renderer resources/registration only when missing. Existing pages, native visuals, slicers, bookmarks, filters and themes remain intact. This is separate from new-report export restrictions.

The published visual schema and its referenced schemas are vendored in `schemas/pbir-visual.json`, keyed by their original Microsoft URLs, for deterministic offline validation. Updating these schemas is an explicit versioned operation.

Composition resolution supports the ECharts composition types. DOM-adapter types do not resolve to ECharts options and are rejected by this headless entry point. Declarative templates use the same resolver as the renderer; formatter functions are constructed from an allowlist, never evaluated from caller code.

Structured `buildVisualDax` bindings qualify and escape model identifiers. `prepareVisualRows` shares report ordering with previews, preserving time-slot chronology and value ordering for ranked compositions.

## Standalone model connections

Install: `npm install https://github.com/bcsnpc/vilsem/releases/download/core-v0.3.0/vilsem-core-0.3.0.tgz`.

```js
import { createConnector } from '@vilsem/core/connect';
const models = createConnector();
const connection = await models.connect({kind:'desktop'});
const schema = await models.schema(connection);
const rows = await models.query(connection, 'EVALUATE ROW("Value", 1)', 200);
```

Fabric uses `{kind:'fabric',workspaceId,datasetId}`. Credentials come from `FABRIC_TENANT_ID`, `FABRIC_CLIENT_ID`, `FABRIC_CLIENT_SECRET` with `AUTH_MODE=service_principal`. Otherwise `AUTH_MODE=device_code` prints login instructions to stderr and caches only a refresh token in `~/.vilsem/auth/` (0700 directory, atomic 0600 file; Windows user-profile ACLs apply). Cache keys include tenant/client/resource. No app checkout, Electron or IPC is used. `createAuth({onDeviceCode})` customizes notifications. Compatibility subpaths preserve query parsing, PKCE token injection and local project fingerprinting; app registry caching stays in the app.

Desktop discovery uses CIM to identify `msmdsrv.exe` with a Desktop parent and reads its `-s` workspace `msmdsrv.port.txt`. No PBIP command-line argument is required. Multiple engines require an explicit port. ADOMD is loaded from the installed Desktop distribution. Metadata and DAX queries do not modify the model.

`createMicrosoftLogin()` owns Microsoft authorization URL generation, S256 PKCE, state validation and authorization-code exchange. It exposes `authorizationUrl`, `matchesRedirect(url)` and `completeRedirect(url)`; the app owns its browser surface, and core has no Electron/UI dependency. Duplicate navigation callbacks exchange only once. `createAuth({resource})` supports other Microsoft resources such as Azure Storage while keeping cache scopes separate. Core auth failures preserve the application's AUTH_FAILED classification. Browser completion/cancel/failure handoff tests cover both first login and reauthentication.

## Expressive template format 2

Core 0.3 adds six category slots, ordered sum/lag/share windows, UTC dates, bounded samples, weighted links, hierarchies and facets with bounded repeat expansion. Renderer 4.14 registers native Sankey, sunburst and graph charts and preserves category bindings and transformed selection identities. See the MCP [spec-format reference](https://github.com/bcsnpc/vilsem-mcp/blob/main/docs/spec-format.md) and [expressiveness report](https://github.com/bcsnpc/vilsem-mcp/blob/main/docs/expressiveness-gaps.md). Templates never execute caller code; custom renderItem is rejected.
