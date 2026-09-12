# Full audit progress report — 2026-09-07

**Current repair results:** [verified fixes and remaining work](fix-status.md). The report below preserves before-fix audit evidence; its “no product changes” statements and failure totals describe that checkpoint.

**Audit in progress; production readiness is not verified.** Repository and runtime investigation now covers all 41 registered visual IDs, both production hosts, inspector controls, AI patch contracts and isolated persistence. No product implementation has been changed.

## Verified findings that drive priority

1. **P0 PERSIST-001:** rename collision followed by save overwrites a different project. Fix stable identity and collision handling first.
2. **P1:** editor field/filter changes can retain stale queried data; line-family transitions violate hook ordering; Area can render unfilled lines; Stacked Area drops its stack flag; empty Funnel displays invented demo stages.
3. **P1:** custom types and multi-select slicers disagree with validation; dimension-only tables disappear during normalization; unrelated AI edits downgrade multi-select slicers.
4. **P1:** native far-right drag saves zero width; crowded KPI normalization violates grid bounds; slicer affects scope is overridden; tooltip text is interpreted as HTML.
5. **P1/P2 visual review:** Heatmap hides lower marks, Sunburst/Column/Waterfall clip labels, and Narrative describes an unrelated second measure as a previous period. All 41 standard editor screenshots were inspected.
6. **P2:** AI patch removal/sequencing and config validation gaps; ineffective title formatting; incomplete drafts block unrelated AI edits; malformed nested specs are inconsistently validated.

See [bug log](bug-log.md), [continued findings](full-audit-findings.md), [schema/filter findings](schema-filter-findings.md), [clipping review](clipping-review.md), [visual review](visual-review-findings.md), and [enhancements](enhancement-log.md) for expected behavior, reproduction, evidence and status.

## Executed evidence

| Check | Result | Evidence |
|---|---|---|
| Existing + new Vitest tests | 432 pass, 12 fail / 444 | evidence/full-suite.json; four original failures and eight exposed defects |
| Default production host mounts | 82 across 41 types | evidence/full-audit.json |
| Inspector probes | 5178 attempts; {"STATE_UPDATED":5098,"NO_STATE_CHANGE":78,"NO_ALTERNATIVE":2} | property-runtime-results.csv |
| Valid Hex retests | 72; {"STATE_UPDATED":72} | evidence/color-audit.json |
| Settled data/size cases | 1230/1230; complete=true | evidence/edge-audit-v3.json |
| Production AI/persistence contracts | {"PASS":9,"FAIL":6} | evidence/contract-audit.json |
| AI field preservation | 223 checked; 46 absent from inspected hint text | ai-field-contract-results.csv; no live natural-language claims |
| Native interaction checks | {"PASS":9,"FAIL":3} | evidence/interaction-audit.json |
| Custom starter templates | 28 host renders | evidence/interaction-audit.json |
| Production authoring UI | 10/10 pass; complete=true | evidence/product-audit.json; synthetic data/save/provider adapters |
| Desktop startup | Passed isolated real main/preload sign-in and tab transition | evidence/desktop-smoke.json |
| Bundles | Desktop, standalone, Fabric builds passed | regression-status.md; installer untested |

Authoring UI checks cover open initial spec, add Bar, duplicate, delete, bind Revenue through Inspector, Save, reopen saved spec and selected AI title edit through production refine logic with a deterministic provider response. Actual sql.js roundtrip for every visual is tested separately. No cloud service was called.

## Interpretation and next work

The property sweep measures state mutations and output fingerprints. It does not establish that every setting renders correctly. Six inactive rich-text controls, conditional branches, every select value, all data-role combinations and every per-type interaction still need deeper checks. Edge measurements require policy review; DOM text metrics do not capture canvas label clipping. Earlier edge reports and pre-resize screenshots are diagnostic, not approved baselines.

Default electron-builder configuration was resolved from the installed builder: package.json.build wins and excludes .env. The conflicting legacy YAML remains an explicit-configuration issue; a default credential-packaging leak was not demonstrated.

Live Fabric/Power BI authentication and data, cloud LLM behavior, installer, publishing, accessibility, performance and approved visual screenshot regressions remain unverified. See [coverage limitations](audit-coverage-limitations.md), [runtime matrix](runtime-test-matrix.md) and [priority plan](priority-plan.md). No bug is marked fixed or verified merely because its regression test exists.
