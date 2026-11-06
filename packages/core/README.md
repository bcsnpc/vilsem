# @vilsem/core

Current evaluation package: core **0.7.2 / renderer 4.42**, paired with MCP **0.7.3**. Private/public app-core suites each pass 1,357 tests; MCP passes 311. Native host acceptance remains blocked and the animated 5,000-point frame-rate target fails. See the repository Round 3 follow-up for live-tool, package and compatibility evidence. Earlier version-specific sections below are historical.

Shared, headless Vilsem visual primitives, declarative templates, DAX/row helpers, spec serialization and PBIR operations. The package contains no Electron or React imports and requires no browser globals.

Run `npm run core:build` from the workspace root before importing compiled ECharts compositions. `npm run powerbi:build` builds the renderer and refreshes `assets/renderer.pbiviz`. The root application build includes the workspace package in the Electron archive.

Exports: `@vilsem/core/primitives`, `/templates`, `/templates/examples`, `/dax`, `/spec`, `/spec/resolve`, and `/pbir`. Existing app paths provide compatibility facades where needed by exported applications.

`injectVisual({reportDir,pageName,visualName,spec,bindings,layout})` adds a new Vilsem visual to an existing PBIR page. Bindings contain `dimensions:[{table,column}]` and `measures:[{table,name}]`; layout uses pixel `x,y,width,height,z,tabOrder`. It refuses existing visual names and non-resolving specs. It validates against the bundled official Microsoft visual-container schema and adds renderer resources/registration only when missing. Existing pages, native visuals, slicers, bookmarks, filters and themes remain intact. This is separate from new-report export restrictions.

The published visual schema and its referenced schemas are vendored in `schemas/pbir-visual.json`, keyed by their original Microsoft URLs, for deterministic offline validation. Updating these schemas is an explicit versioned operation.

Composition resolution supports the ECharts composition types. DOM-adapter types do not resolve to ECharts options and are rejected by this headless entry point. Declarative templates use the same resolver as the renderer; formatter functions are constructed from an allowlist, never evaluated from caller code.

Structured `buildVisualDax` bindings qualify and escape model identifiers. `prepareVisualRows` shares report ordering with previews, preserving time-slot chronology and value ordering for ranked compositions.

## Standalone model connections

Install: `npm install https://github.com/bcsnpc/vilsem/releases/download/core-v0.6.0/vilsem-core-0.6.0.tgz`.

That installs the stable0.6 connection API. For the current expression/panel
evaluation features use
`npm install https://github.com/bcsnpc/vilsem/releases/download/core-v0.7.2/vilsem-core-0.7.2.tgz`.

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

## Core0.7 prerelease

Adds the closed JSON expression-series interpreter, bounded geometry/data
transforms, declarative race/timeline animation, image-statistics utilities and
renderer4.40. Specifications remain JSON; the package never accepts author
JavaScript, calls an LLM or writes model definitions. The renderer GUID and
`objects.semantica.primitiveSpec` property remain unchanged.

The expression grammar and budgets are documented in
`docs/expression-language.md` in the parent repository. Trusted runtime motion
helpers use the rendering engine's existing completion callbacks to finish a
hidden frame, including removing temporary Sankey entry clips; permanent plot
clips survive. Authored JSON cannot supply those callbacks.

This is an evaluation prerelease. Native physical interactions/export require
further verification and the5000-point60fps motion target is not met. See the
Round3 QA ledger and motion benchmark report for measured results and limits.

## Expressive template format 2

Core 0.3 adds six category slots, ordered sum/lag/share windows, UTC dates, bounded samples, weighted links, hierarchies and facets with bounded repeat expansion. Renderer 4.14 registers native Sankey, sunburst and graph charts and preserves category bindings and transformed selection identities. See the MCP [spec-format reference](https://github.com/bcsnpc/vilsem-mcp/blob/main/docs/spec-format.md) and [expressiveness report](https://github.com/bcsnpc/vilsem-mcp/blob/main/docs/expressiveness-gaps.md). Templates never execute caller code; custom renderItem is rejected.

Core0.4 adds query-only visual-scoped DAX, format3 current-row/fallback formatting,
bounded temporal/statistical/layout operations and native renderer4.31. Operations
include OHLC/Heikin-Ashi, waterfall, partition/pack, multistage flows, streamgraph,
grouped intervals, conversion/calendar bands, EWMA, bins/boxes/ECDF, density,
collision layouts, QQ/hexbin, shares/subtotals, rebase/pivot/correlation/cohorts,
parameterized top-N, Pareto counts, fixed tiles and conservative word packing.
Feature floors prevent new specs silently targeting an older report renderer.
Existing renderer GUID and `objects.semantica.primitiveSpec` remain unchanged.
Transforms never execute caller code or persist measures to the model. Refer to
the versioned MCP spec-format reference for bounds, data-window assumptions and
native acceptance status; these additions are not a production certification.


### Query-only scoped measures

`buildVisualDax({dimensions, measures, scopedMeasures: spec.measures})` emits
`DEFINE MEASURE` before EVALUATE without any model write. `compileScopedMeasures`
lexes expressions, checks references against an optional supplied schema and
rejects cycles/shadowed model names. It is not a full DAX parser; the calling
connection must validate syntax/binding with the actual Analysis Services engine.
PBIR export uses inline `NativeMeasure` expressions, expanding local dependencies
with CALCULATE to preserve measure context transition. The Desktop host evaluates
these under report filters and delivers numbers to `rowsFromCategorical`; neither
JavaScript nor the visual executes DAX. Do not write a scoped definition to TMDL.
See the MCP `vilsem://docs/spec-format` for ratio/time-intelligence/ranking examples.


## Core0.5 correctness update

Report-native visuals default to a transparent background and the host palette.
The shared theme/format converter is used by native rendering and SSR. It
preserves categorical/share labels, raw numeric query values, explicit styling,
independent measure units and contributor identities for supported aggregates.
Report connections follow byPath Desktop/local schema or byConnection configured
Fabric/SSAS targets without Electron. Refer to the MCP spec-format documentation
for supported format strings, provenance rules and the native-font limitation.
Renderer4.34 is bundled; the existing GUID and primitiveSpec property remain
unchanged. Older registered renderers are rejected when a requested feature
requires the new version. No model definitions are written.

Mixed-unit scatter/bubble coordinates retain independent model formats even when
the primary measure uses General. Category labels keep their configured meaning.


## Versioned editing and common formatting (0.6)

`@vilsem/core/connect/context` exposes read-only schema enrichment and summary/full shaping. It returns measure expressions, formats/folders/descriptions, column types/keys/hidden flags, exact DAX cardinality/BLANK share/ranges, bounded samples and relationship metadata without exporting partition/data-source definitions. Internal row identities and unavailable provider fields are explicit. Composite-key field parameters use a tested projection fallback rather than model changes.

`@vilsem/core/spec/diagnostics` resolves the renderer grammar into structured errors with JSON pointers, expected/allowed shapes and fixes. `@vilsem/core/spec/migrate` provides pure, forward-only migrations from0.1 to0.6, including round2 string scoped measures into structured definitions. New PBIR writes retain binding provenance and specVersion; unknown future versions fail explicitly rather than rendering a substitute chart.

`@vilsem/core/formatting/pane` defines69common properties and applies authored spec.formatting with separate host overrides. The shared contract covers title, text, palette, labels, legend, independent axes, lines, theme/background and border. Manual properties win individually; resetting them must be explicit. The native package is renderer4.35 with the existing GUID/property unchanged. DOM adapters expose only their implemented Appearance/Title/Border subset. Expression geometry, motion and shared user-template storage remain Round3 GroupC work.

Core0.7.1 adds bounded viewportWidth/viewportHeight expression operations for responsive decorative panels. They require renderer4.41, expose no DOM/host reference, and retain the closed grammar and execution budgets. Other0.7 specs keep their4.40 floor. Native physical acceptance and the5000-point60fps target remain incomplete/failed; this remains an evaluation release.

Core0.7.2 / renderer4.42 preserves authored opacity for explicitly silent annotation leaves during selection/highlight, while ordinary data marks keep their existing dimming behavior. This prevents decorative viewport panels from inheriting a synthetic row selection. The flag combination has its own reader floor; viewport operations alone still require4.41.
