# Architecture issues

Current repairs address the demonstrated query/config forwarding, template/schema, error-state, filtering and rename-collision defects without consolidating the entire architecture. See [verified fix scopes](../qa/fix-status.md). Duplicated rendering hosts and legacy name-based save remain architectural debt; the initial issue descriptions below record why focused fixes were prioritized.

Initial audit, 2026-09-07. No broad refactors performed.

Runtime follow-up confirms ARCH-002 (stale editor data and missing Area mode), ARCH-004 (ineffective title weight), ARCH-005 (invalid AI config accepted), and ARCH-008 (rename collision overwrite). Default builder precedence in ARCH-010 is resolved: package.json.build excludes .env; legacy explicit configuration still differs. Tooltip encoding and nested validation now have failing production regressions. See docs/qa/full-audit-report.md for current evidence.

| ID | Evidence | Risk | Focused next step |
|---|---|---|---|
| ARCH-001 | Registry, schema.VISUAL_TYPES, authoring palettes and llm.VISUAL_SCHEMA_MAP are separate | Unsupported/rejected types and property drift | Contract inventory + parity tests; custom is a reproduced mismatch |
| ARCH-002 | CanvasEditor and AppSpecRenderer duplicate queries/config assembly; viewer has multiple render branches | Editing vs viewing differences in defaults, area mode, clipping and errors | Test identical specs across hosts before extracting shared helpers |
| ARCH-003 | AppGenerator and specEditing.js have parallel document/page mutation logic | Root/page changes can diverge | Behavioral tests around page isolation and root preservation |
| ARCH-004 | Primitive schemas, manual inspector controls and visualDefaults maps overlap | Controls that show wrong defaults or do nothing | Enumerate actual control visibility and effective values |
| ARCH-005 | ChartConfig has open index signature; leaf JSX is largely untyped | Misspelled config fields pass through silently | Type and validate demonstrated public operation boundaries first |
| ARCH-006 | Large AppGenerator/VisualInspector/llm modules combine multiple workflows | High change impact and weak localized tests | Split only after mapping dependencies and confirming behavior seams |
| ARCH-007 | Shared ECharts lifecycle vs bar-race-owned instance; Recharts/DOM/SVG coexist | Resize and selection contracts differ | Lifecycle and transition tests, especially hook ordering |
| ARCH-008 | sql.js persistDb exports and writes synchronously; save upserts by dataset/name | Atomicity, write failure and duplicate-name behavior untested | Isolated persistence/fault tests before storage changes |
| ARCH-009 | Existing tests include copied cache algorithm and source regex contracts | Green tests can miss production regressions | Test production APIs and observable effects |
| ARCH-010 | Conflicting Electron builder files | Branding/output/security uncertainty | BUILD-001 release gate |
| ARCH-011 | Retained legacy flags/imports and April architecture snapshot | False reachability assumptions and stale rollback claims | Annotate actual live branches; pie and sunburst still have Recharts paths |

Additional inspection candidates: preload listeners without symmetric unsubscribe in root StrictMode effects; live image URL controls vs desktop CSP; title weight default vs hardcoded CanvasEditor header; slash-command detection/insertion regex differences; tooltip HTML escaping; high-category normalization/layout behavior. These are not verified bugs yet.

Dependency rules: changes to a public config key require reviewing renderer, inspector, defaults, AI prompts/sanitizer, custom templates, persisted specs and export mapping. A renderer/primitive refactor requires all wrappers and host layouts in the test set. Do not migrate every visual to a single engine solely for consistency of filenames.
