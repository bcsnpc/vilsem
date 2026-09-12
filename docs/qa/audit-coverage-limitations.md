# Audit evidence boundaries

Repair update: current results are in [fix status](fix-status.md). Product fixes have now been applied and locally verified; before-fix evidence and its limitations below remain historical. The all-type field/resize reruns do not constitute retesting every conditional formatting branch.

The full audit is in progress. Executed cases are not equivalent to approved visual behavior.

- `full-audit.json`: 82 default host mounts and 5,178 inspector input attempts across 41 types, default/expanded configurations and Style/Text/Layout. State changes and render fingerprints screen for ineffective controls; they do not validate each property's meaning. Selects exercise one alternative, not every option. Conditional branches are not exhaustive. Data-tab controls, active rich-text formatting and all custom slot combinations still need dedicated coverage.
- 72 initial Hex probes supplied invalid text. These are harness inputs, not product defects. `color-audit.json` retests with valid hex colors. Six inactive rich-text controls and two single-choice selects require separate classification.
- The original render fingerprint omits left/top coordinates, font family, border radius and some CSS properties. An unchanged fingerprint for those controls is not evidence of an ineffective setting. Conversely, a changed fingerprint can arise from timing or layout rather than the intended property. Confirm suspected defects with direct computed-style/option assertions and source tracing.
- `edge-audit.json` is an interrupted diagnostic with duplicate keys. Do not use its totals. `edge-audit-v2.json` has 1,230 unique cases but some measurements preceded ResizeObserver/ECharts settling. Its screenshots are not approved baselines. `edge-audit-v3.json` requires stable geometry before capturing and supersedes v2 once complete.
- Edge text metrics flag text extending beyond a clipping ancestor. Ellipsis, scrolling, and intentional plot clipping can be correct. Canvas-rendered text is not represented by DOM Range metrics. A zero `visualError` count does not negate captured React console failures.
- Requested widths describe the host viewport; viewer pageWidth caps and editor minimum sizes can change actual chart dimensions. Use recorded measured chart sizes when interpreting extreme-aspect cases.
- `interaction-audit.json`: native Electron input tests hover, category selection/deselection, cross-filtering, Ctrl-click, drag, resize, axis switch and three drill modes on selected representative visuals. This is not every interaction on every type.
- `contract-audit.json`: production patch validator/sanitizer and real sql.js persistence in an isolated temporary profile. Its 223 field checks prove acceptance/preservation of supplied values, not natural-language recognition or visible renderer parity. Forty-six field keys are absent from the inspected AI hint text.
- `product-audit.json`: actual AppGenerator/Inspector controls, synthetic metadata/data and in-memory save transport. Disk persistence is separately exercised by contract tests. Initial-spec reopening does not prove the Home saved-project picker works.
- No live Fabric/Power BI authentication, customer dataset, paid/cloud LLM request, installer or external publishing was exercised. These remain acceptance gaps; no credentials or production data were modified.
- Exploratory screenshots are diagnostic artifacts. Stable baselines need per-visual human review and approved expected states before screenshot-diff gates are useful.

Audit harnesses use production modules and browser events. They remain separate from packaged entry points. No visualization implementation was changed during discovery.
