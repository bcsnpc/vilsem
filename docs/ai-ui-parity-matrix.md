# AI / UI parity matrix

## New UI capability requiring AI acceptance ? 2026-09-12

Line/Area now expose 18 `secondaryAxis*` settings in the primitive schema. UI control and shared renderer tests pass. **AI editing is not verified** for these new keys: prompt/tool discovery, sanitizer behavior, mutual-exclusion semantics, generated patches and user feedback still require explicit acceptance. Do not infer prompt parity from schema presence. Non-AI work remains the current priority.


Repair update: multi_select preservation and custom validation now pass production regressions. The after-fix contract suite has 11 passes / 4 failures: config type/key rejection, measure removal and sequential patches remain unresolved. The tables below preserve before-fix parity evidence; see [current fix status](qa/fix-status.md).

## Runtime contract results

No live provider prompt was submitted. Production patch acceptance/preservation was exercised for **223 schema fields**; all supplied values survived, while **46 keys were absent from the inspected hint text**. This proves permissive patch transport, not semantic UI parity. Exact rows: [AI field contract results](qa/ai-field-contract-results.csv).

| Capability | UI | AI production boundary | Result |
|---|---|---|---|
| Selected title edit | Actual AppGenerator + Inspector exercised | Deterministic provider response traverses refine, validation, merge and rerender | PASS locally; live intent untested |
| Preserve multi-select on unrelated edit | Runtime supports multi_select | Sanitizer changes to dropdown | FAIL AI-SLICER-001 |
| Remove measure | UI removal exists | Validator tests absent remove value against measures | FAIL AI-PATCH-001 |
| Sequential parent/child addition | Object config mutations possible | Validation checks original parent structure | FAIL AI-PATCH-002 |
| Reject invalid config type/key | UI constrains inputs | Unknown keys and wrong types accepted | FAIL AI-CONFIG-001 |
| Change title weight visibly | Inspector changes spec | Supplied key preserved | FAIL renderer parity for shared non-KPI headers; FORMAT-TITLE-001 |
| Edit with another incomplete card | UI creates/saves draft | Whole-document validation blocks unrelated title edit | UX-006; draft policy needed |

See [continued findings](qa/full-audit-findings.md) for failure locations. The initial discovery matrix below remains useful as a map of source hints, not a PASS list.

Initial audit. **No provider-backed prompt operation has been tested.** Literal mentions in llm.js are discovery evidence only: they do not prove schema acceptance, state mutation or rendering. Inspector-scoped refinement requests config-only changes; whole-page refinement has wider scope. See architecture.md for validation stages.

| Capability | UI evidence | AI evidence | Result |
|---|---|---|---|
| Create visual | Palette and add handlers | generate-app-spec / sanitizer | Not tested end to end |
| Edit selected visual config | VisualInspector updateConfig | refineSpec(scopedVisualId) → patch-app-spec | Not tested end to end |
| Assign dimensions/measures | updateData | page-level patch and measure validation | Not equivalent to config-only inspector prompt |
| Position/page editing | updatePos / editSpec | patch → sanitize → reflow | Preservation requires tests |
| Custom visuals | template slots/params | custom template generation; general validator rejects custom | FAIL at validator: SPEC-CUSTOM-001 |
| Playback speed/mode | bar_race attached schema | VISUAL_SCHEMA_MAP uses generic bar schema | Partial schema reference; prompt test pending |
| Slope/lollipop/waterfall | dedicated schema or manual controls | generic line/bar schema aliases | Mapping review needed |
| Image URL | inspector allows URL | config patch possible | Desktop CSP img-src self/data/blob conflicts with remote URL; reproduce before classifying |

## Literal inspector property index

This index covers literal updateConfig keys, not dynamic schema fields, slot editors, page controls, or conditional visibility. Never convert a mention into PASS.

| Config key | UI | AI source literal | Validation |
|---|---|---|---|
| accentColor | updateConfig reference | Not found | Not tested |
| align | updateConfig reference | Mentioned | Not tested |
| animationDuration | updateConfig reference | Mentioned | Not tested |
| animationPreset | updateConfig reference | Mentioned | Not tested |
| animations | updateConfig reference | Mentioned | Not tested |
| axisFontFamily | updateConfig reference | Not found | Not tested |
| axisFontSize | updateConfig reference | Not found | Not tested |
| axisOptions | updateConfig reference | Mentioned | Not tested |
| axisTickColor | updateConfig reference | Not found | Not tested |
| bgOpacity | updateConfig reference | Not found | Not tested |
| borderRadius | updateConfig reference | Mentioned | Not tested |
| cardStyle | updateConfig reference | Mentioned | Not tested |
| categoryColors | updateConfig reference | Not found | Not tested |
| color | updateConfig reference | Mentioned | Not tested |
| colorScheme | updateConfig reference | Mentioned | Not tested |
| compact | updateConfig reference | Mentioned | Not tested |
| dataLabelColor | updateConfig reference | Mentioned | Not tested |
| dataLabels | updateConfig reference | Mentioned | Not tested |
| drillStyle | updateConfig reference | Not found | Not tested |
| filterColumn | updateConfig reference | Mentioned | Not tested |
| filterMode | updateConfig reference | Mentioned | Not tested |
| filterValue | updateConfig reference | Mentioned | Not tested |
| flat | updateConfig reference | Mentioned | Not tested |
| fullWidth | updateConfig reference | Mentioned | Not tested |
| gradient | updateConfig reference | Mentioned | Not tested |
| gridLines | updateConfig reference | Mentioned | Not tested |
| gridLinesColor | updateConfig reference | Mentioned | Not tested |
| gridLinesOpacity | updateConfig reference | Not found | Not tested |
| headerBg | updateConfig reference | Not found | Not tested |
| heatmap | updateConfig reference | Mentioned | Not tested |
| highlightMax | updateConfig reference | Mentioned | Not tested |
| hoverEffect | updateConfig reference | Not found | Not tested |
| icon | updateConfig reference | Mentioned | Not tested |
| iconColor | updateConfig reference | Mentioned | Not tested |
| iconSize | updateConfig reference | Not found | Not tested |
| label | updateConfig reference | Mentioned | Not tested |
| labelColor | updateConfig reference | Not found | Not tested |
| labelPosition | updateConfig reference | Mentioned | Not tested |
| legendColor | updateConfig reference | Not found | Not tested |
| legendFontSize | updateConfig reference | Not found | Not tested |
| legendPosition | updateConfig reference | Mentioned | Not tested |
| limit | updateConfig reference | Mentioned | Not tested |
| miniBars | updateConfig reference | Not found | Not tested |
| modalPageId | updateConfig reference | Mentioned | Not tested |
| navTarget | updateConfig reference | Mentioned | Not tested |
| playAxis | updateConfig reference | Mentioned | Not tested |
| prefix | updateConfig reference | Mentioned | Not tested |
| progressColor | updateConfig reference | Mentioned | Not tested |
| progressHeight | updateConfig reference | Not found | Not tested |
| progressMax | updateConfig reference | Mentioned | Not tested |
| progressTrackColor | updateConfig reference | Mentioned | Not tested |
| rankColumn | updateConfig reference | Not found | Not tested |
| rankOpacity | updateConfig reference | Mentioned | Not tested |
| sectionColors | updateConfig reference | Not found | Not tested |
| showAccentStrip | updateConfig reference | Mentioned | Not tested |
| showDots | updateConfig reference | Mentioned | Not tested |
| showGlow | updateConfig reference | Mentioned | Not tested |
| showIcon | updateConfig reference | Mentioned | Not tested |
| showLegend | updateConfig reference | Mentioned | Not tested |
| showProgress | updateConfig reference | Mentioned | Not tested |
| showSparkline | updateConfig reference | Mentioned | Not tested |
| showTitle | updateConfig reference | Not found | Not tested |
| showTrend | updateConfig reference | Mentioned | Not tested |
| size | updateConfig reference | Mentioned | Not tested |
| smooth | updateConfig reference | Mentioned | Not tested |
| sparklineAxis | updateConfig reference | Mentioned | Not tested |
| sparklineColor | updateConfig reference | Mentioned | Not tested |
| sparklineHeight | updateConfig reference | Not found | Not tested |
| sparklinePosition | updateConfig reference | Mentioned | Not tested |
| sparklineShowArea | updateConfig reference | Not found | Not tested |
| sparklineWeight | updateConfig reference | Not found | Not tested |
| sparklineWidth | updateConfig reference | Not found | Not tested |
| subtitle | updateConfig reference | Mentioned | Not tested |
| suffix | updateConfig reference | Mentioned | Not tested |
| targetPageId | updateConfig reference | Mentioned | Not tested |
| title | updateConfig reference | Mentioned | Not tested |
| titleColor | updateConfig reference | Mentioned | Not tested |
| titleFontFamily | updateConfig reference | Mentioned | Not tested |
| titleFontSize | updateConfig reference | Mentioned | Not tested |
| titleFontWeight | updateConfig reference | Mentioned | Not tested |
| titlePosition | updateConfig reference | Mentioned | Not tested |
| titleUppercase | updateConfig reference | Mentioned | Not tested |
| tooltipEnabled | updateConfig reference | Not found | Not tested |
| tooltipShowName | updateConfig reference | Not found | Not tested |
| tooltipShowSwatch | updateConfig reference | Not found | Not tested |
| tooltipShowTitle | updateConfig reference | Not found | Not tested |
| tooltipShowValue | updateConfig reference | Not found | Not tested |
| tooltipTitle | updateConfig reference | Not found | Not tested |
| tooltipTrigger | updateConfig reference | Not found | Not tested |
| trendDownColor | updateConfig reference | Not found | Not tested |
| trendFontSize | updateConfig reference | Not found | Not tested |
| trendUpColor | updateConfig reference | Mentioned | Not tested |
| url | updateConfig reference | Mentioned | Not tested |
| valueColor | updateConfig reference | Mentioned | Not tested |
| valueFontFamily | updateConfig reference | Mentioned | Not tested |
| valueFontSize | updateConfig reference | Mentioned | Not tested |
| valueFontWeight | updateConfig reference | Mentioned | Not tested |
| variant | updateConfig reference | Mentioned | Not tested |

## Missing support trace

The patch path is prompt text + provider JSON response, not a universal strongly typed per-property tool. VISUAL_SCHEMA_MAP is handwritten separately from primitive schemas. validatePatchOperations checks op/path/parent and measure names; it does not establish that a renderer consumes a config key. sanitizer/reflow can additionally modify results before frontend validation. Next: resolve each visible control to its allowed operation, schema key, mutation result and actual renderer output using recorded deterministic provider responses, then run a small live-provider acceptance set.
