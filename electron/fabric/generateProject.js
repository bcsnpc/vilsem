// generateProject.js — turn a vilsem App Spec into the Rayfin data-app chart unit
// (the "inject" half of scaffold-then-inject). Consumes the SAME App-Spec model the
// web export uses (visual.data.*) — the data model is not forked. All Rayfin-shaped
// strings come from fabric.config.js; this file has no Rayfin literals of its own.
const fs = require('fs')
const path = require('path')
const { FABRIC_CONFIG, slug, cap } = require('./fabric.config')
const { buildVisualDax, resultColumns } = require('./dax')

function collectVisuals(spec) {
  if (Array.isArray(spec?.visuals)) return spec.visuals
  if (Array.isArray(spec?.pages)) return spec.pages.flatMap(p => p.visuals || [])
  return []
}

// The spike deploys ONE visual: the first chart with a dimension + measure.
function pickTargetVisual(spec) {
  const visuals = collectVisuals(spec)
  return visuals.find(v => v?.data?.measures?.length &&
    (v.data.groupBy?.column || v.data.dimensions?.[0]?.column)) || visuals[0] || null
}

// ECharts `option` expression that consumes `cats` (string[]) and `vals` (number[])
// — the component derives those from data.table.columns/rows at runtime (robust to
// the SDK's real, bracketed column names + array-or-object rows).
function buildEchartsOptionSource(visual, colorHex) {
  const type = visual.type
  const pal = `color: ${JSON.stringify([colorHex || '#58AECB'])}, `
  const dark = "textStyle: { color: 'rgba(255,255,255,0.65)' }, "
  const axisDark = "axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } }, axisLabel: { color: 'rgba(255,255,255,0.6)' }"
  if (type === 'pie' || type === 'donut') {
    return `{ ${pal}${dark}tooltip: { trigger: 'item' }, series: [{ type: 'pie', radius: ${type === 'donut' ? "['45%','70%']" : "'70%'"}, data: cats.map((name, i) => ({ name, value: vals[i] })), label: { color: 'rgba(255,255,255,0.7)' } }] }`
  }
  if (type === 'line' || type === 'area') {
    return `{ ${pal}${dark}tooltip: { trigger: 'axis' }, grid: { left: 56, right: 20, top: 20, bottom: 28 }, xAxis: { type: 'category', data: cats, ${axisDark} }, yAxis: { type: 'value', ${axisDark} }, series: [{ type: 'line', smooth: true, ${type === 'area' ? 'areaStyle: {}, ' : ''}data: vals }] }`
  }
  const horizontal = type === 'bar'
  return `{ ${pal}${dark}tooltip: { trigger: 'axis' }, ${horizontal ? `grid: { left: 130, right: 24, top: 16, bottom: 28 }, yAxis: { type: 'category', data: cats, ${axisDark} }, xAxis: { type: 'value', ${axisDark} },` : `grid: { left: 56, right: 24, top: 16, bottom: 40 }, xAxis: { type: 'category', data: cats, ${axisDark} }, yAxis: { type: 'value', ${axisDark} },`} series: [{ type: 'bar', data: vals, itemStyle: { borderRadius: ${horizontal ? '[0,4,4,0]' : '[4,4,0,0]'} } }] }`
}

// ── minimal YAML emitter (simple objects/arrays/scalars only) ────────────────
function scalar(v) {
  if (v === true) return 'true'
  if (v === false) return 'false'
  if (v == null) return 'null'
  if (typeof v === 'number') return String(v)
  const s = String(v)
  return /[:#{}[\],&*?|<>=!%@`"']/.test(s) || s.includes('${') ? JSON.stringify(s) : s
}
function toYaml(obj, indent = 0) {
  const pad = '  '.repeat(indent)
  if (Array.isArray(obj)) return obj.map(v => `${pad}- ${scalar(v)}`).join('\n')
  if (obj && typeof obj === 'object') {
    return Object.entries(obj).map(([k, v]) =>
      (v && typeof v === 'object') ? `${pad}${k}:\n${toYaml(v, indent + 1)}` : `${pad}${k}: ${scalar(v)}`
    ).join('\n')
  }
  return `${pad}${scalar(obj)}`
}
function writeYaml(projectDir, relPath, obj) {
  const p = path.join(projectDir, relPath)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, toYaml(obj) + '\n', 'utf8')
  return relPath
}

// Inject the chart unit + config into an already-scaffolded Rayfin project.
// opts: { visual?, appName?, workspaceId?, datasetId? }
function injectChartUnit(projectDir, spec, opts = {}) {
  const C = FABRIC_CONFIG
  const visual = opts.visual || pickTargetVisual(spec)
  if (!visual) throw new Error('No chartable visual found in the App Spec.')

  const chartId = (slug(visual.config?.title || visual.id || 'chart').replace(/-/g, '_')) || 'chart1'
  const dax = buildVisualDax(visual)
  const echartsOption = buildEchartsOptionSource(visual)
  const { category, measures } = resultColumns(visual)
  const columns = [category, ...measures].filter(Boolean) // seed columnMetadata keys

  const queriesDir = path.join(projectDir, C.layout.queriesDir)
  const componentsDir = path.join(projectDir, C.layout.componentsDir)
  fs.mkdirSync(queriesDir, { recursive: true })
  fs.mkdirSync(componentsDir, { recursive: true })

  const unit = C.layout.chartUnit
  const written = []
  const write = (dir, name, content) => {
    const p = path.join(dir, name)
    fs.writeFileSync(p, content, 'utf8')
    written.push(path.relative(projectDir, p).replace(/\\/g, '/'))
  }

  write(queriesDir, unit.daxFile.replace('{chartId}', chartId), C.templates.daxFile(dax))
  write(queriesDir, unit.factoryFile.replace('{chartId}', chartId), C.templates.factoryTs({ chartId, connectionAlias: C.layout.connectionAlias, columns }))
  write(componentsDir, unit.componentFile.replace('{chartId}', chartId), C.templates.componentTsx({ chartId, echartsOption }))

  // Replace App.tsx's empty-state with our chart (the template says to do exactly this).
  fs.writeFileSync(path.join(projectDir, C.layout.appTsx), C.templates.appTsx({ chartId }), 'utf8')
  written.push(C.layout.appTsx)

  // Ensure echarts is a dependency so the component compiles (runRayfin installs after inject).
  try {
    const pkgPath = path.join(projectDir, 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    if (!pkg.dependencies?.echarts) {
      pkg.dependencies = { ...(pkg.dependencies || {}), echarts: '^5.5.0' }
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
      written.push('package.json (+echarts)')
    }
  } catch { /* non-fatal */ }

  // NOTE: the model connection alias must be wired via `npx fabric-app-data` (its
  // fabric.yaml default profile is empty on scaffold) — see fabric.config.connectionSetup.
  return { chartId, visualId: visual.id, visualType: visual.type, dax, columns, connectionAlias: C.layout.connectionAlias, written }
}

// ── Full-dashboard generation (every visual + grid layout) ───────────────────
const KPI_TYPES = new Set(['kpi', 'stat_card', 'metric_tile', 'sparkline_kpi', 'bullet', 'progress', 'gauge'])
const isKpiType = (t) => KPI_TYPES.has(t)

function colorHexFor(visual, C) {
  const scheme = visual.config?.colorScheme
  if (typeof scheme === 'string' && scheme.startsWith('#')) return scheme
  return (C.colors && C.colors[scheme]) || C.colorDefault
}

function sanitizeJsxText(s) { return String(s || '').replace(/[<>{}]/g, '') }

// Emit a query + component for EVERY visual with measures, and an App.tsx that lays
// them out on the same 12-column grid as vilsem (from each visual's position).
function injectDashboard(projectDir, spec, opts = {}) {
  const C = FABRIC_CONFIG
  const visuals = collectVisuals(spec).filter(v => Array.isArray(v?.data?.measures) && v.data.measures.length)
  if (!visuals.length) throw new Error('No visuals with measures in the App Spec.')

  const queriesDir = path.join(projectDir, C.layout.queriesDir)
  const componentsDir = path.join(projectDir, C.layout.componentsDir)
  fs.mkdirSync(queriesDir, { recursive: true })
  fs.mkdirSync(componentsDir, { recursive: true })

  const written = []
  const write = (dir, name, content) => {
    const p = path.join(dir, name)
    fs.writeFileSync(p, content, 'utf8')
    written.push(path.relative(projectDir, p).replace(/\\/g, '/'))
  }

  const importLines = []
  const cells = []
  const used = new Set()

  visuals.forEach((v, i) => {
    let chartId = (slug(v.config?.title || v.id || ('v' + i)).replace(/-/g, '_')) || ('v' + i)
    while (used.has(chartId)) chartId = `${chartId}_${i}`
    used.add(chartId)
    const Comp = cap(chartId)
    const title = v.config?.title || v.config?.label || chartId
    const colorHex = colorHexFor(v, C)
    const isKpi = isKpiType(v.type)
    const dax = buildVisualDax(v)
    const { category, measures } = resultColumns(v)
    const columns = [category, ...measures].filter(Boolean)
    const unit = C.layout.chartUnit

    write(queriesDir, unit.daxFile.replace('{chartId}', chartId), C.templates.daxFile(dax))
    write(queriesDir, unit.factoryFile.replace('{chartId}', chartId), C.templates.factoryTs({ chartId, connectionAlias: C.layout.connectionAlias, columns }))
    write(componentsDir, unit.componentFile.replace('{chartId}', chartId),
      isKpi ? C.templates.kpiComponentTsx({ chartId, title, colorHex })
            : C.templates.componentTsx({ chartId, echartsOption: buildEchartsOptionSource(v, colorHex) }))

    importLines.push(`import ${Comp} from './components/${chartId}'`)

    const pos = v.position || {}
    const x = Number(pos.x) || 0, y = Number(pos.y) || 0
    const w = Math.min(Number(pos.w) || 3, 12), h = Number(pos.h) || 3
    const g = `gridColumn: '${x + 1} / span ${w}', gridRow: '${y + 1} / span ${h}'`
    if (isKpi) {
      cells.push(`        <div style={{ ${g} }}><${Comp} /></div>`)
    } else {
      cells.push(`        <div style={{ ${g}, background: 'linear-gradient(150deg, ${colorHex}12 0%, #0a0a12 55%)', border: '1px solid rgba(255,255,255,0.08)', borderTop: '2px solid ${colorHex}', borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#E8ECF1', marginBottom: 8 }}>${sanitizeJsxText(title)}</div>
          <div style={{ flex: 1, minHeight: 0 }}><${Comp} /></div>
        </div>`)
    }
  })

  fs.writeFileSync(path.join(projectDir, C.layout.appTsx),
    C.templates.dashboardAppTsx({ importLines: importLines.join('\n'), cells: cells.join('\n') }), 'utf8')
  written.push(C.layout.appTsx)

  // echarts dep (runRayfin installs after inject).
  try {
    const pkgPath = path.join(projectDir, 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    if (!pkg.dependencies?.echarts) {
      pkg.dependencies = { ...(pkg.dependencies || {}), echarts: '^5.5.0' }
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
      written.push('package.json (+echarts)')
    }
  } catch { /* non-fatal */ }

  return { visualCount: visuals.length, connectionAlias: C.layout.connectionAlias, written }
}

// ── Full-app (parity) injection ───────────────────────────────────────────────
// Drops vilsem's REAL renderer bundle + a Fabric-SDK window.semantica shim + the
// App Spec into the scaffold, so the deployed app matches the web export exactly
// (all visuals + drill + interactions). No per-visual codegen — the renderer reads
// the spec at runtime, same as the web export.
const REPO_ROOT = path.resolve(__dirname, '..', '..')

function injectFullApp(projectDir, spec, opts = {}) {
  const C = FABRIC_CONFIG
  const L = C.layout

  // 1) Locate the prebuilt renderer bundle (built by `npm run fabric-embed:build`).
  const bundleDir = path.join(REPO_ROOT, L.embedBundle.srcDir)
  const bundleJs = path.join(bundleDir, L.embedBundle.jsFile)
  const bundleCss = path.join(bundleDir, L.embedBundle.cssFile)
  if (!fs.existsSync(bundleJs)) {
    throw new Error(`Renderer bundle not found at ${bundleJs}. Run: npm run fabric-embed:build`)
  }

  const written = []
  const writeFile = (abs, content) => {
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, content)
    written.push(path.relative(projectDir, abs).replace(/\\/g, '/'))
  }

  // 2) Copy renderer.js (+ .css) into the app's public assets dir.
  const assetsDir = path.join(projectDir, L.appAssetsDir)
  fs.mkdirSync(assetsDir, { recursive: true })
  fs.copyFileSync(bundleJs, path.join(assetsDir, L.embedBundle.jsFile))
  written.push(path.join(L.appAssetsDir, L.embedBundle.jsFile).replace(/\\/g, '/'))
  if (fs.existsSync(bundleCss)) {
    fs.copyFileSync(bundleCss, path.join(assetsDir, L.embedBundle.cssFile))
    written.push(path.join(L.appAssetsDir, L.embedBundle.cssFile).replace(/\\/g, '/'))
  }

  // 3) Write the App Spec the renderer mounts (full dashboard — all pages/visuals).
  writeFile(path.join(projectDir, L.specFile), JSON.stringify(spec))

  // 4) Write the window.semantica shim (Fabric SDK), substituting the connection alias.
  const shimSrc = fs.readFileSync(path.join(__dirname, L.shimTemplate), 'utf8')
    .replace(/__CONNECTION_ALIAS__/g, L.connectionAlias)
  writeFile(path.join(projectDir, L.shimFile), shimSrc)

  // 5) Replace App.tsx with the loader (imports shim, loads bundle, mounts spec).
  const appSrc = fs.readFileSync(path.join(__dirname, L.appTemplate), 'utf8')
    .replace(/__RENDERER_JS__/g, L.assetUrls.js)
    .replace(/__RENDERER_CSS__/g, L.assetUrls.css)
    .replace(/__SPEC_URL__/g, L.assetUrls.spec)
  writeFile(path.join(projectDir, L.appTsx), appSrc)

  const visualCount = collectVisuals(spec).filter(v => v?.data?.measures?.length).length
  return { mode: 'full-app', visualCount, connectionAlias: L.connectionAlias, bundleBytes: fs.statSync(bundleJs).size, written }
}

module.exports = { injectChartUnit, injectDashboard, injectFullApp, pickTargetVisual, collectVisuals, buildEchartsOptionSource, isKpiType }
