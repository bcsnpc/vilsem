// ─────────────────────────────────────────────────────────────────────────────
// fabric.config.js — THE SINGLE SOURCE OF TRUTH for every Rayfin / Fabric Apps
// preview-volatile value. When Rayfin changes format (it will — public preview,
// announced 2026-06-02), you edit THIS FILE ONLY. No Rayfin string literals live
// anywhere else in the codebase.
//
// Confidence legend (Rayfin is post-training-cutoff; values sourced from live
// Microsoft Learn docs + microsoft/rayfin repo, 2026-07):
//   [OK]      documented + high confidence
//   [VERIFY]  documented but must be confirmed against a real `npm create` scaffold
//   [GUESS]   inferred convention — WILL almost certainly need editing on first run
//
// Sources:
//   learn.microsoft.com/fabric/apps/create-app-with-cli
//   learn.microsoft.com/fabric/apps/data-apps-template
//   learn.microsoft.com/fabric/apps/project-structure
//   github.com/microsoft/rayfin
// ─────────────────────────────────────────────────────────────────────────────

// [OK — OBSERVED via `npm view`] There is NO bare `rayfin` package and no
// `@microsoft/rayfin`. The scaffolder is `@microsoft/create-rayfin` (invoked by
// `npm create @microsoft/rayfin`); the CLI (bin `rayfin`) ships in
// `@microsoft/rayfin-cli`. So `npx rayfin …` 404s — we must npx the real package.
// Bump CLI_VER when the preview moves (or set to 'latest').
const CLI_PKG = '@microsoft/rayfin-cli'
const CLI_VER = '1.33.2'
const CLI = `${CLI_PKG}@${CLI_VER}`

const FABRIC_CONFIG = {
  // Bumps let us see at a glance which preview format this config targets.
  previewTargetedAt: '2026-07',
  cliPackage: CLI_PKG,
  cliVersion: CLI_VER,

  // vilsem colorScheme → hex (for chart series + KPI accent).
  colors: {
    teal: '#14B8A6', blue: '#3B82F6', gold: '#F59E0B', green: '#22C55E',
    purple: '#A855F7', violet: '#8B5CF6', rose: '#F43F5E', red: '#EF4444',
    orange: '#F97316', amber: '#F59E0B',
  },
  colorDefault: '#58AECB',

  // ── Prerequisites the deploy needs on PATH ──────────────────────────────────
  // [OK] Node ≥20 + npm; Rayfin runs via `npx` (no global install). bun optional.
  prereqs: {
    node:  { cmd: 'node', versionArg: '--version', minMajor: 20, required: true,  label: 'Node.js ≥ 20' },
    npm:   { cmd: 'npm',  versionArg: '--version', required: true,  label: 'npm' },
    // Rayfin is invoked through npx; a global binary is NOT required. We still probe
    // it so the UI can say "will be fetched via npx" vs "found globally".
    rayfin:{ cmd: 'rayfin', versionArg: '--version', required: false, label: 'Rayfin CLI (optional — npx fetches @microsoft/rayfin-cli)' },
    bun:   { cmd: 'bun',  versionArg: '--version', required: false, label: 'bun (optional)' },
  },

  // ── CLI commands ────────────────────────────────────────────────────────────
  // Kept as argv arrays (never shell strings) so runRayfin can spawn without a shell.
  cli: {
    // [OK] Scaffold a data-app project. `{appName}` / `{workspace}` substituted by
    // generateProject. Non-interactive form documented in data-apps-template.
    //   npm create @microsoft/rayfin@latest -- "<appName>" --template dataapp --workspace <workspace>
    create: {
      cmd: 'npm',
      // --overwrite: scaffold even if the target dir has leftovers (we also clean it
      // first). [VERIFY] flag name against the CLI's help if a version changes it.
      args: ['create', '@microsoft/rayfin@latest', '--', '{appName}', '--template', 'dataapp', '--workspace', '{workspace}', '--overwrite'],
    },
    // [OK] Deploy + run. `npx rayfin up`. --dry-run supported for preview.
    // [OK — OBSERVED] npx the real CLI package (works from any cwd; the scaffolded
    // project also has it locally). `up` runs from the project dir.
    up:        { cmd: 'npx', args: [CLI, 'up'] },
    upDryRun:  { cmd: 'npx', args: [CLI, 'up', '--dry-run'] },
    upStatus:  { cmd: 'npx', args: [CLI, 'up', 'status', '--json'] },
    // [OK] Auth — browser sign-in that caches a machine-level session. Must be run
    // once in an interactive TERMINAL first (a GUI child has no TTY to sign in).
    login:     { cmd: 'npx', args: [CLI, 'login'] },
    logout:    { cmd: 'npx', args: [CLI, 'logout'] },
    // [VERIFY] init into an existing empty dir (alternative to `create`).
    init:      { cmd: 'npx', args: [CLI, 'init', '.'] },
    // [OK — from `fabric-app-data add --help`] Wire the semantic-model connection
    // alias into fabric.yaml, then regenerate. fabric-app-data is a LOCAL dep of the
    // scaffolded project, so these run from the project dir. {alias}/{workspaceId}/
    // {itemId} substituted by runRayfin. Alt: --from-url <fabric portal model url>.
    addConnection: { cmd: 'npx', args: ['fabric-app-data', 'add', 'semanticModel', '{alias}', '--workspace', '{workspaceId}', '--item', '{itemId}'] },
    generateConn:  { cmd: 'npx', args: ['fabric-app-data', 'generate'] },
    // Build vilsem's renderer bundle (dist/fabric-embed/) — run from the REPO ROOT
    // before a full-app inject so the deployed app matches the current vilsem code.
    // (Not a Rayfin command; lives here so all deploy-pipeline commands are in one place.)
    buildEmbed:    { cmd: 'npm', args: ['run', 'fabric-embed:build'] },
  },

  // ── Template selection ──────────────────────────────────────────────────────
  templateName: 'dataapp', // [OK] the semantic-model-connected template

  // ── Project layout (paths RELATIVE to the scaffolded project root) ──────────
  // [OK] base layout; [VERIFY]/[GUESS] the chart-unit paths (data-app frontend,
  // Copilot-generated in the official flow — confirm on first real scaffold).
  layout: {
    rayfinYml:   'rayfin/rayfin.yml',          // [OK]
    envFile:     'rayfin/.env',                // [OK]
    dataDir:     'rayfin/data',                // [OK] backend @entity() DB — unused for a pure model dashboard
    frontendSrc: 'src',                        // [OK] React+Vite frontend

    // [VERIFY] fabric.yaml (workspace + semantic-model connection). Referenced by
    // the data-app docs but not shown in the base structure doc — confirm name+location.
    fabricYaml:  'fabric.yaml',

    // [OK — READ FROM A REAL SCAFFOLD] Query units live in src/queries/<group>/;
    // React chart components live in src/components/; the dashboard is App.tsx.
    queriesDir:    'src/queries/vilsem',   // {chartId}.dax + {chartId}.ts factory
    componentsDir: 'src/components',       // {chartId}.tsx (our ECharts component)
    appTsx:        'src/App.tsx',          // replace <EmptyStatePreview/> with our chart
    chartUnit: {
      daxFile:     '{chartId}.dax',        // plain-text standalone EVALUATE (vilsem DAX drops in as-is)
      factoryFile: '{chartId}.ts',         // exports { connection, query, columnMetadata }
      componentFile: '{chartId}.tsx',      // ECharts component using useSemanticModelQuery → data.table.rows
    },
    // [OK] The connection is an ALIAS resolved from fabric.yaml via `npx fabric-app-data`.
    // Its `default` profile is empty on scaffold — the model must be wired (see connectionSetup).
    connectionAlias: 'vilsemModel',
    // [GUESS] central style file the template themes through.
    globalCss:   'src/global.css',
    // [OK] agent-convention files worth reading on first scaffold (Microsoft's conventions).
    agentDocs:   ['AGENTS.md', '.mcp.json'],

    // ── Full-app (parity) deploy — drops vilsem's REAL renderer + a Fabric-SDK
    // window.semantica shim into the scaffold, so the deployed app matches the web
    // export exactly (all visuals + drill + interactions). ──────────────────────
    // Prebuilt renderer bundle location, RELATIVE TO THE VILSEM REPO ROOT
    // (built by `npm run fabric-embed:build`). Copied into the Fabric project's
    // public/ so the static host serves it.
    embedBundle: { srcDir: 'dist/fabric-embed', jsFile: 'vilsem-renderer.js', cssFile: 'vilsem-renderer.css' },
    // Destination paths INSIDE the scaffolded project.
    appAssetsDir: 'public/vilsem',           // renderer.js + renderer.css + spec.json land here
    specFile:     'public/vilsem/spec.json', // the App Spec the renderer mounts
    shimFile:     'src/lib/semantica-shim.ts', // installs window.semantica → Fabric SDK
    // Public URLs the generated App.tsx loads them from (public/ → served at root).
    assetUrls:    { js: '/vilsem/vilsem-renderer.js', css: '/vilsem/vilsem-renderer.css', spec: '/vilsem/spec.json' },
    // Template BODIES for the two generated Fabric-app files (paths relative to
    // electron/fabric). Kept as files (not inline template literals) because the
    // shim is dense TS with its own template literals; config still owns the
    // volatile wiring (alias + URLs substituted into the __PLACEHOLDER__ tokens).
    shimTemplate: 'templates/semantica-shim.ts.tmpl',   // token: __CONNECTION_ALIAS__
    appTemplate:  'templates/App.tsx.tmpl',             // tokens: __RENDERER_JS__ __RENDERER_CSS__ __SPEC_URL__
  },

  // ── DAX parameterization convention ─────────────────────────────────────────
  // [OK] Rayfin `.dax` files use {{TOKEN}} string-replacement; the factory does the
  // find/replace at runtime. For a single no-filter visual we emit static DAX and
  // leave an optional {{FILTERS}} seam for later.
  dax: {
    filtersToken: '{{FILTERS}}',   // [VERIFY] exact token spelling
    // When true, generateProject appends a `{{FILTERS}}` line the factory can replace.
    emitFiltersSeam: false,
  },

  // ── rayfin.yml we write/patch (minimal, model-dashboard oriented) ───────────
  // [OK] field names from project-structure doc. We disable the backend DB (data)
  // since a semantic-model dashboard queries the model, not a Rayfin SQL DB, and
  // enable Fabric brokered auth so the deployed app SSOs the viewer to the model.
  rayfinYml: (appName) => ({
    id: slug(appName),
    name: appName,
    version: '1.0.0',
    services: {
      auth:          { enabled: true, fabric: { enabled: true } }, // [VERIFY] brokered-auth key path
      data:          { enabled: false, dialect: 'mssql' },         // [OK] off — no Rayfin DB needed
      storage:       { enabled: false },
      staticHosting: { enabled: true, root: '.', folder: 'dist', buildCommand: 'npm run build', indexDocument: 'index.html' },
    },
  }),

  // ── fabric.yaml (workspace + semantic model connection) ─────────────────────
  // [VERIFY] shape entirely — the docs describe its PURPOSE ("which workspace and
  // semantic model you connect to") but not its fields. This is a best-effort
  // placeholder to be corrected against a real scaffold. workspaceId/datasetId come
  // from the vilsem connection (the same ids vilsem already holds).
  fabricYaml: ({ workspaceId, datasetId }) => ({
    workspace: workspaceId || '${FABRIC_WORKSPACE_ID}',
    semanticModel: datasetId || '${FABRIC_DATASET_ID}',
  }),

  // ── Deployment env vars written by `rayfin up` ──────────────────────────────
  // [OK] read-only reference so the UI can explain what appears post-deploy.
  deployEnv: {
    itemIdVar:    'VITE_FABRIC_ITEM_ID',
    workspaceVar: 'VITE_FABRIC_WORKSPACE_ID',
    writtenTo:    '.env.fabric-<workspace> (and .env.fabric)',
  },

  // ── Runtime data path ───────────────────────────────────────────────────────
  // [OK] Execute Queries REST API — SAME api + limits vilsem uses. Informational:
  // the deployed Rayfin app calls this itself (brokered auth), we do not proxy it.
  runtime: {
    executeQueriesUrl: 'https://api.powerbi.com/v1.0/myorg/datasets/{datasetId}/executeQueries',
    tenantSettingName: 'Semantic Model Execute Queries REST API',
  },

  // ── Chart-unit file TEMPLATES (the ECharts port) ────────────────────────────
  // [GUESS] These reproduce the documented `.dax`/factory pattern but the exact
  // query-client call + component props contract are NOT documented — they must be
  // read off a real scaffold and corrected here. Kept as pure string builders so
  // there are zero Rayfin literals elsewhere.
  // [OK — MATCHED TO A REAL SCAFFOLD + its AGENTS.md]. The template renders with
  // Vega-Lite by default; we swap in an ECharts component (docs allow other libs).
  // The factory exports { connection, query, columnMetadata }; the component fetches
  // via useSemanticModelQuery and reads data.table.rows.
  templates: {
    // Plain-text DAX (standalone EVALUATE from dax.js). Dropped in as-is.
    daxFile: (daxQuery) => `${daxQuery}\n`,

    // Factory .ts — imports the .dax as raw text and exports the query contract.
    // columnMetadata MUST be keyed by the EXACT column names from the query result
    // (table.columns[].name). We seed from the visual's dim/measure names; if a real
    // query shows bracketed names (e.g. "Product[Category]"), fix the keys here.
    factoryTs: ({ chartId, connectionAlias, columns }) => `// AUTO-GENERATED by vilsem Deploy-to-Fabric.
import baseQuery from './${chartId}.dax?raw'
import type { ColumnMetadataMap } from '@/lib/to-data-table'

// [VERIFY] connection alias must exist in fabric.yaml (wire via: npx fabric-app-data …)
const connection = '${connectionAlias}'

// [VERIFY] keys must match table.columns[].name verbatim from the query result.
export const columnMetadata: ColumnMetadataMap = {
${(columns || []).map(c => `  ${JSON.stringify(c)}: { name: ${JSON.stringify(c)}, displayName: ${JSON.stringify(c)} },`).join('\n')}
}

export function ${chartId}() {
  return { connection, query: baseQuery, columnMetadata }
}
`,

    // ECharts component — uses the template's own query hook + data.table.rows.
    componentTsx: ({ chartId, echartsOption }) => `// AUTO-GENERATED ECharts component (vilsem Deploy-to-Fabric).
import React, { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import { useSemanticModelQuery } from '@/hooks/use-semantic-model-query'
import { ${chartId} } from '@/queries/vilsem/${chartId}'

export default function ${cap(chartId)}() {
  const { connection, query } = ${chartId}()
  const { data, isLoading, error } = useSemanticModelQuery({ connection, query })
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current || data?.status !== 'success') return
    // Derive keys from the ACTUAL result columns (e.g. "Product[Category]", "[Total Sales]")
    // and handle rows that are objects (keyed by col name) OR positional arrays.
    const table: any = data.table
    const cols: string[] = (table.columns || []).map((c: any) => c.name)
    const catKey = cols[0]
    const valIdx = Math.min(1, cols.length - 1) // first measure column (dim is col 0)
    const valKey = cols[valIdx]
    const rows: any[] = table.rows || []
    const cell = (r: any, key: string, idx: number) => (Array.isArray(r) ? r[idx] : r[key])
    const cats = rows.map((r) => String(cell(r, catKey, 0)))
    const vals = rows.map((r) => Number(cell(r, valKey, valIdx)) || 0)
    const chart = echarts.init(ref.current)
    chart.setOption(${echartsOption})
    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); chart.dispose() }
  }, [data])
  if (error) return <div style={{ padding: 16, color: '#F43F5E' }}>Query error: {String(error.message)}</div>
  if (isLoading || data?.status !== 'success') return <div style={{ padding: 16 }}>Loading…</div>
  return <div ref={ref} style={{ width: '100%', height: '100%', minHeight: 220 }} />
}
`,

    // App.tsx — single-chart (spike) variant.
    appTsx: ({ chartId }) => `// AUTO-GENERATED by vilsem Deploy-to-Fabric — renders the injected chart.
import ${cap(chartId)} from './components/${chartId}'
export default function App() {
  return <div style={{ padding: 16 }}><${cap(chartId)} /></div>
}
`,

    // KPI card — scalar query → big formatted value + label.
    kpiComponentTsx: ({ chartId, title, colorHex }) => `// AUTO-GENERATED KPI card (vilsem Deploy-to-Fabric).
import React from 'react'
import { useSemanticModelQuery } from '@/hooks/use-semantic-model-query'
import { ${chartId} } from '@/queries/vilsem/${chartId}'

function fmt(n: number): string {
  const a = Math.abs(n)
  if (a >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (a >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (a >= 1e3) return (n / 1e3).toFixed(1) + 'k'
  return String(Math.round(n * 100) / 100)
}

export default function ${cap(chartId)}() {
  const { connection, query } = ${chartId}()
  const { data } = useSemanticModelQuery({ connection, query })
  let value = '—'
  if (data?.status === 'success') {
    const t: any = data.table
    const r = (t.rows || [])[0]
    const cols: string[] = (t.columns || []).map((c: any) => c.name)
    const v = r == null ? null : (Array.isArray(r) ? r[r.length - 1] : r[cols[cols.length - 1]])
    if (v != null) value = fmt(Number(v))
  }
  return (
    <div style={{ height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(150deg, ${colorHex}22 0%, #0a0a12 62%)', border: '1px solid rgba(255,255,255,0.08)', borderTop: '2px solid ${colorHex}', borderRadius: 14 }}>
      <div style={{ fontSize: 34, fontWeight: 700, color: '${colorHex}' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{${JSON.stringify(title)}}</div>
    </div>
  )
}
`,

    // Dashboard App.tsx — CSS grid over the 12-col vilsem layout.
    dashboardAppTsx: ({ importLines, cells }) => `// AUTO-GENERATED dashboard (vilsem Deploy-to-Fabric) — full layout from the App Spec.
import React from 'react'
${importLines}

export default function App() {
  return (
    <div style={{ minHeight: '100vh', background: '#0b0b12', padding: 16, boxSizing: 'border-box' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gridAutoRows: '80px', gap: 12 }}>
${cells}
      </div>
    </div>
  )
}
`,
  },

  // [OK — from AGENTS.md] Wiring the model connection is a `npx fabric-app-data`
  // step inside the project (its `default` fabric.yaml profile is empty on scaffold).
  // The alias in factoryTs must resolve to your model's workspace/item id. Test a
  // query with:  npx fabric-app-data query <alias> --query '<DAX>'  — the printed
  // column names are what columnMetadata must be keyed by. `npm run build` runs
  // `npx fabric-app-data generate` to regenerate src/fabric.generated.ts.
  connectionSetup: 'npx fabric-app-data (define <alias> in fabric.yaml → resolves the semantic model)',

  // ── Error → user-facing message mapping (matched against streamed CLI output) ─
  // [VERIFY] the exact substrings once we see real CLI failures — edit here.
  errorMatchers: [
    // [OK — observed] scaffold + deploy both need a cached Rayfin/Fabric session,
    // established by an interactive `rayfin login` (a GUI child process has no TTY).
    { test: /no cached fabric session|not a tty|rayfin login/i,  code: 'LOGIN_REQUIRED',    message: 'Sign in once in a terminal:  npx @microsoft/rayfin-cli@latest login  — a browser sign-in that caches your Fabric session. Then Deploy again.' },
    { test: /command not found|is not recognized|ENOENT/i,      code: 'CLI_MISSING',       message: 'Rayfin CLI / npm not found. Install Node ≥20 + npm; Rayfin is fetched via npx.' },
    // A 403 with "feature is not available" means the Fabric Apps workload isn't
    // enabled/available for this tenant or capacity (preview, region-limited) —
    // NOT an auth failure. Must be BEFORE the generic 401/403 matcher.
    { test: /feature is not available|workload|not enabled.*app|Fabric Apps/i, code: 'WORKLOAD_OFF', message: 'Fabric Apps is not enabled/available for this tenant or capacity. A Fabric admin must enable "Fabric Apps (preview)" in the Admin portal → Tenant settings. It is a region-limited preview — if that setting is absent, your tenant/region may not have access yet.' },
    { test: /execute ?queries|execute dax|tenant setting/i,     code: 'TENANT_SETTING_OFF', message: 'Enable the "Semantic Model Execute Queries REST API" tenant setting in the Fabric admin portal.' },
    { test: /contributor|not authorized|access.*denied/i,       code: 'PERMISSION',        message: 'Insufficient workspace permission (need Contributor/Member/Admin) or model Build/Read.' },
    { test: /401|403|unauthor|sign ?in/i,                       code: 'AUTH_REQUIRED',     message: 'Sign-in required or expired. Complete the browser sign-in, or run  npx @microsoft/rayfin-cli@latest logout  then retry.' },
  ],
  errorFallback: { code: 'DEPLOY_FAILED', message: 'Deploy failed. See the streamed CLI output above for details.' },
}

// ── tiny pure helpers (no Rayfin specifics) ──────────────────────────────────
function slug(s) { return String(s || 'vilsem-app').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'vilsem-app' }
function cap(s)  { return String(s || 'Chart').replace(/[^A-Za-z0-9]/g, '').replace(/^[a-z]/, c => c.toUpperCase()) || 'Chart' }

module.exports = { FABRIC_CONFIG, slug, cap }
