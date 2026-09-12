const fs=require('node:fs'),path=require('node:path')
const root=path.resolve(__dirname,'../..'),qa=path.join(root,'docs/qa'),evidence=path.join(qa,'evidence')
const read=n=>JSON.parse(fs.readFileSync(path.join(evidence,n+'.json'),'utf8'))
const full=read('full-audit'),colors=read('color-audit'),contracts=read('contract-audit'),interactions=read('interaction-audit'),product=read('product-audit'),suite=read('full-suite'),edge=read('edge-audit-v3')
const types=[...new Set(full.hosts.map(h=>h.type))],count=(items,key)=>items.reduce((r,x)=>(r[x[key]]=(r[x[key]]||0)+1,r),{})
const csv=rows=>rows.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n')+'\n'
fs.writeFileSync(path.join(qa,'property-runtime-results.csv'),csv([['visual','variant','tab','control','input','status','changed_paths','render_fingerprint_changed','evidence'],...full.properties.map(p=>[p.typeId,p.variant,p.tab,p.label,p.input,p.status,(p.diff||[]).map(d=>d.path).join(';'),p.renderChanged,'full-audit.json']),...colors.properties.map(p=>[p.typeId,p.variant,p.tab,p.label,p.input,p.status,(p.diff||[]).map(d=>d.path).join(';'),p.renderChanged,'color-audit.json (supersedes invalid Hex probes)'])]))
fs.writeFileSync(path.join(qa,'ai-field-contract-results.csv'),csv([['visual','config_key','mentioned_in_hint','patch_accepted','value_preserved','live_prompt_tested'],...contracts.parity.map(p=>[p.type,p.key,p.hintContainsKey,p.accepted,p.preserved,false])]))
let matrix='# Runtime visual test matrix\n\nUpdated 2026-09-07. Counts mean executed probes, not approved behavior. See [coverage limitations](audit-coverage-limitations.md). All 41 types have an isolated production persistence roundtrip; the actual authoring workflow covers Bar.\n\n| Visual | Default host mounts | Settled edge cases | Inspector attempts | State updated (initial) | Valid Hex retests | Visual acceptance |\n|---|---:|---:|---:|---:|---:|---|\n'
for(const type of types){const p=full.properties.filter(p=>p.typeId===type);matrix+=`| ${type} | ${full.hosts.filter(h=>h.type===type).length} | ${edge.cases.filter(c=>c.type===type).length}/30 | ${p.length} | ${p.filter(p=>p.status==='STATE_UPDATED').length} | ${colors.properties.filter(p=>p.typeId===type).length} | Pending |\n`}
matrix+='\nNine initial leaf scenarios per type are retained in renderer-smoke.json. Property coverage includes default and expanded Style/Text/Layout controls, with one alternative per select. Data-tab binding, active rich text, all conditional branches and per-visual interactions remain partial. All fifteen edge cases per host are listed in scripts/qa/edge-audit.cjs.\n'
fs.writeFileSync(path.join(qa,'runtime-test-matrix.md'),matrix)
const statuses=count(contracts.checks,'status'),iStatuses=count(interactions.checks,'status')
const report=`# Full audit progress report — 2026-09-07

**Current repair results:** [verified fixes and remaining work](fix-status.md). The report below preserves before-fix audit evidence; its no-product-changes statements and failure totals describe that checkpoint.

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
| Existing + new Vitest tests | ${suite.numPassedTests} pass, ${suite.numFailedTests} fail / ${suite.numTotalTests} | evidence/full-suite.json; four original failures and eight exposed defects |
| Default production host mounts | ${full.hosts.length} across 41 types | evidence/full-audit.json |
| Inspector probes | ${full.properties.length} attempts; ${JSON.stringify(count(full.properties,'status'))} | property-runtime-results.csv |
| Valid Hex retests | ${colors.properties.length}; ${JSON.stringify(count(colors.properties,'status'))} | evidence/color-audit.json |
| Settled data/size cases | ${edge.cases.length}/1230; complete=${!!edge.complete} | evidence/edge-audit-v3.json |
| Production AI/persistence contracts | ${JSON.stringify(statuses)} | evidence/contract-audit.json |
| AI field preservation | ${contracts.parity.length} checked; ${contracts.parity.filter(p=>!p.hintContainsKey).length} absent from inspected hint text | ai-field-contract-results.csv; no live natural-language claims |
| Native interaction checks | ${JSON.stringify(iStatuses)} | evidence/interaction-audit.json |
| Custom starter templates | ${interactions.templates.length} host renders | evidence/interaction-audit.json |
| Production authoring UI | ${product.checks.filter(c=>c.pass).length}/${product.checks.length} pass; complete=${!!product.complete} | evidence/product-audit.json; synthetic data/save/provider adapters |
| Desktop startup | Passed isolated real main/preload sign-in and tab transition | evidence/desktop-smoke.json |
| Bundles | Desktop, standalone, Fabric builds passed | regression-status.md; installer untested |

Authoring UI checks cover open initial spec, add Bar, duplicate, delete, bind Revenue through Inspector, Save, reopen saved spec and selected AI title edit through production refine logic with a deterministic provider response. Actual sql.js roundtrip for every visual is tested separately. No cloud service was called.

## Interpretation and next work

The property sweep measures state mutations and output fingerprints. It does not establish that every setting renders correctly. Six inactive rich-text controls, conditional branches, every select value, all data-role combinations and every per-type interaction still need deeper checks. Edge measurements require policy review; DOM text metrics do not capture canvas label clipping. Earlier edge reports and pre-resize screenshots are diagnostic, not approved baselines.

Default electron-builder configuration was resolved from the installed builder: package.json.build wins and excludes .env. The conflicting legacy YAML remains an explicit-configuration issue; a default credential-packaging leak was not demonstrated.

Live Fabric/Power BI authentication and data, cloud LLM behavior, installer, publishing, accessibility, performance and approved visual screenshot regressions remain unverified. See [coverage limitations](audit-coverage-limitations.md), [runtime matrix](runtime-test-matrix.md) and [priority plan](priority-plan.md). No bug is marked fixed or verified merely because its regression test exists.
`
fs.writeFileSync(path.join(qa,'full-audit-report.md'),report)
console.log(JSON.stringify({edge:edge.cases.length,complete:edge.complete,properties:full.properties.length,contracts:statuses,interactions:iStatuses,product:product.checks.length}))
