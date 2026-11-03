# vilsem Renderer

The Power BI custom visual renders Vilsem specifications using `@vilsem/core` compositions and the shared DOM adapter. Its GUID remains `semanticaRenderer4A7F2D9B8C3E1F5A6D4B2C8E9F1A3B7D` so existing reports remain compatible.

## Specification property

Set the JSON string in `objects.semantica.primitiveSpec` (the property name is retained for compatibility):

```json
{"version":1,"type":"bar","canvasTheme":"dark","config":{"title":"Sales"},"measures":{"primary":"Sales","all":["Sales"]}}
```

Bind category fields to `category` through `category6` and numeric measures to `content`, `secondary`, and `tertiary`. Power BI evaluates those measures in the report filter context. Shape and Divider also support updates without bound data. Older HTML-based packages remain supported for existing reports; new integrations should use the specification property.

## Build

From the repository root run `npm install`, then `npm run powerbi:build`. The prebuild compiles core and the DOM adapter, and copies primitives from `packages/core/src/primitives`. Generated copies under `src/primitives`, `src/shared`, and `src/appspec` are not source files to edit. The `.pbiviz` is written to `vilsem-renderer/dist`.

## Interactions and verification

The ECharts path routes click/Ctrl selection, background clearing, context menus, native tooltips, incoming highlights and selection restoration through Power BI host services. Selection identities include all bound category levels. The root accepts arrow-key point navigation, Enter/Space selection, and Escape clearing. Filtered zero-row views show an explicit empty state.

Harness coverage is in `tests/power-bi-selection-runtime.test.ts`. Host-integrated verification is still required for report-page tooltip resolution, drill-through eligibility, bookmark behavior and all DOM-adapter visual types. Declaring capabilities and passing harness tests does not establish certification.

## Compatibility

Version 4.13 keeps the GUID and `semantica.primitiveSpec` stable. Display and package names changed to vilsem Renderer / vilsemRenderer. Canvas-specific navigation/query callbacks are not available in the Power BI sandbox. Supported export types remain controlled by the core visual registry.
