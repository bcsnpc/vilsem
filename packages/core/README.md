# @vilsem/core

Shared, headless Vilsem visual primitives, declarative templates, DAX/row helpers, spec serialization and PBIR operations. The package contains no Electron or React imports and requires no browser globals.

Run `npm run core:build` from the workspace root before importing compiled ECharts compositions. `npm run powerbi:build` builds the renderer and refreshes `assets/renderer.pbiviz`. The root application build includes the workspace package in the Electron archive.

Exports: `@vilsem/core/primitives`, `/templates`, `/templates/examples`, `/dax`, `/spec`, `/spec/resolve`, and `/pbir`. Existing app paths provide compatibility facades where needed by exported applications.

`injectVisual({reportDir,pageName,visualName,spec,bindings,layout})` adds a new Vilsem visual to an existing PBIR page. Bindings contain `dimensions:[{table,column}]` and `measures:[{table,name}]`; layout uses pixel `x,y,width,height,z,tabOrder`. It refuses existing visual names and non-resolving specs. It validates against the bundled official Microsoft visual-container schema and adds renderer resources/registration only when missing. Existing pages, native visuals, slicers, bookmarks, filters and themes remain intact. This is separate from new-report export restrictions.

The published visual schema and its referenced schemas are vendored in `schemas/pbir-visual.json`, keyed by their original Microsoft URLs, for deterministic offline validation. Updating these schemas is an explicit versioned operation.

Composition resolution supports the ECharts composition types. DOM-adapter types do not resolve to ECharts options and are rejected by this headless entry point. Declarative templates use the same resolver as the renderer; formatter functions are constructed from an allowlist, never evaluated from caller code.
