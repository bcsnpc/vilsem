# QA strategy and commands

## Current repair regression commands

Run the Vite development server first, and avoid editing product files while an Electron sweep is active: hot reload invalidates a test run.

```powershell
npm.cmd test -- --reporter=json --outputFile=docs/qa/evidence/fixed-suite.json
node scripts/qa/launch-audit.cjs --data --after
node scripts/qa/launch-audit.cjs --fixes
node scripts/qa/launch-audit.cjs --persistence
node scripts/qa/launch-audit.cjs --product --after
node scripts/qa/launch-audit.cjs --interactions --after
node scripts/qa/launch-audit.cjs --contracts --after
node scripts/qa/launch-audit.cjs --edges --after
```

After-fix reports preserve the baseline artifacts. Edge runs resume completed cases; use a new output filename for a new code revision rather than treating old cases as rerun. Edge exit status remains nonzero for intentionally injected query-error console logs; inspect exact events and completed cases. The focused regression harness separately classifies those expected failures and asserts the visible error state. Current results and unresolved checks: [fix status](fix-status.md).

## Initial audit runbook

Initial audit baseline, 2026-09-07. Follow understand → document → audit → test → log → prioritize → fix → retest. Product changes are not part of this initial checkpoint.

## Reproduce locally

Use npm.cmd in PowerShell when execution policy blocks npm.ps1. Existing dependencies were used; a clean install has not been tested. Lockfiles exist at root, ui and the Power BI custom visual package.

```powershell
# Clean dependency installation, when needed
npm.cmd ci
npm.cmd --prefix ui ci

# Normal development / desktop
npm.cmd run electron:dev
# UI alone (does not supply desktop IPC)
npm.cmd run ui:dev
# Desktop with existing built UI
npm.cmd run electron

# Existing unit/contract suite
npm.cmd test
# Evidence reporter
npm.cmd test -- --reporter=json --outputFile=docs/qa/baseline-tests.json --silent

# Keep Vite running in another terminal for these isolated checks
node scripts/qa/launch-audit.cjs
node scripts/qa/launch-audit.cjs --renderers
node scripts/qa/document-inventory.cjs
```

The audit launchers use disposable profiles under cache, leave product main/renderers unchanged, and write evidence under docs/qa/evidence. Renderer failures are detected through console errors as well as boundary DOM: React boundaries may recover between render and observation. The renderer audit currently exits 1 because it reproduces product failures. Screenshots are exploratory, not approved regression baselines.

## Builds

Normal scripts: ui:build builds desktop UI plus standalone; standalone:build and fabric-embed:build are separate; build adds electron-builder. Existing dist changes were preserved by overriding output paths:

```powershell
# Run in ui/
node node_modules/vite/bin/vite.js build --outDir ../cache/qa-build/ui
node node_modules/vite/bin/vite.js build --config vite.standalone.config.js --outDir ../cache/qa-build/standalone
node node_modules/vite/bin/vite.js build --config vite.fabric-embed.config.js --outDir ../cache/qa-build/fabric-embed
```

Installer generation is not validated: resolve BUILD-001 first. Several scripts/test-* files authenticate and modify remote reports/models; they are not safe local regression commands. They were inspected, not run against existing client resources.

## Layers and evidence

1. **Pure contracts:** validation, normalization, domain/scale math, formatter semantics, filters, patch acceptance and persistence boundaries. Test production functions, not copied implementations.
2. **Leaf renderer fixtures:** deterministic synthetic rows, stable themes/fonts, zero animations where supported, valid per-type bindings, populated→empty/error/loading→populated transitions. Assert meaningful output, not merely lack of crashes.
3. **Host workflows:** editor/viewer/standalone transport adapters with deterministic responses, field/config changes, pointer resize, zoom, filtering, drill, navigation and save/reopen. Use semantic selectors; add stable identifiers where needed after the audit.
4. **Desktop integration:** fresh userData profile and no developer .env; actual main/preload IPC; disposable database. Test auth failure and cache/persistence independently from real remote services.
5. **Live acceptance:** explicitly identified development model/provider and disposable publish target, read-only model checks first. Record prompt/request/accepted changes without storing keys or private rows.
6. **Visual regression:** approved snapshots per visual/host/size/data state, controlled fonts/DPR/animations and readiness. Compare pixels plus geometry/data assertions; review diffs. The initial captures do not meet this release gate.

No Playwright dependency/framework exists in root/ui manifests. The initial Electron harness uses native webContents to avoid installing new technology before evaluating current behavior. For durable workflows, evaluate Playwright Electron against this installed Electron version, then use a locked dependency and isolated launch fixtures. No Playwright compatibility claim has been made.

## Coverage accounting

Full runtime commands (Vite must be running):

```powershell
node scripts/qa/launch-audit.cjs --full
node scripts/qa/launch-audit.cjs --edges
node scripts/qa/launch-audit.cjs --interactions
node scripts/qa/launch-audit.cjs --contracts
node scripts/qa/launch-audit.cjs --product
node scripts/qa/launch-audit.cjs --colors
node scripts/qa/summarize-audit.cjs
npm.cmd test -- --reporter=json --outputFile=docs/qa/evidence/full-suite.json
```

Product and color audit entry points also run under Electron through the common launcher. Edge v3 resumes completed unique cases and disables native window occlusion throttling. Geometry must stabilize over successive animation frames; do not replace readiness with arbitrary sleep. See audit-coverage-limitations.md before interpreting results. The inventory generator describes the initial source snapshot; do not overwrite manually updated audit documents with it.

The initial inventory records 98 literal inspector updateConfig keys and 223 attached schema entries across types. These overlap and exclude dynamic/control-gated paths; they are not a total count of all exposed properties. property-coverage.csv marks each discovery NOT_TESTED. Resolve type visibility, conditional values and template parameters through UI enumeration before declaring every control covered.

Release criteria: all registered supported visuals have valid fixtures and role contracts; every exposed control has a behavior assertion; empty/error transitions are safe; host clipping/interaction/save/reopen pass; AI operation mapping has deterministic tests plus live acceptance where needed; packaging manifest is verified; remaining failures are explicit, never relabelled as passing.


## Visibility acceptance follow-up
A successful mount or absence of console errors is not visual approval. Fresh visibility evidence is written to `evidence/visibility-audit.json`, separate from previous runs, with default screenshots for both hosts. Each of 41 types exercises nine data states, five additional sizes/aspect ratios, and a large-font state (1,230 cases). DOM clipping candidates require classification; canvas labels require renderer display-list bounds and screenshot review.

Acceptance: content must fit, intentionally truncate with access to full information, scroll accessibly, or present a deliberate compact/empty state. Losing labels above a header, centering long text outside the box, and silently ignoring a formatting control fail. Preserve data, selection, sorting, explicit formats and saved rich text during repairs.

Dedicated text-box checks enter editing through the actual double-click handler, select text, operate inspector italic/size controls, inspect computed font size and commit using Escape. Long-paragraph checks cover both hosts. Subsequent coverage must include partial selection, all font/colour/alignment choices, keyboard-only use, live-value insertion/filter refresh, mixed-format persistence, and undo. These are not all covered by the initial text probe.
