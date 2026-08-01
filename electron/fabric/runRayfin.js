// runRayfin.js — orchestrates the scaffold-then-inject-then-deploy pipeline as
// child processes, streaming all CLI output to `onOutput` for the UI. Every command
// string comes from fabric.config.js.
const { spawn } = require('child_process')
const os = require('os')
const path = require('path')
const fs = require('fs')
const { FABRIC_CONFIG, slug } = require('./fabric.config')
const { injectFullApp } = require('./generateProject')

// Repo root (runRayfin lives in electron/fabric) — where the vilsem renderer bundle
// is built + read from.
const REPO_ROOT = path.resolve(__dirname, '..', '..')

// Run one argv command in cwd, streaming stdout/stderr lines to onOutput.
// shell:true so Windows resolves npm.cmd/npx.cmd; args come only from config +
// slug()'d names (no raw user text is interpolated into a shell string).
// Quote an arg for a shell:true command LINE. Passing our own pre-quoted string
// (rather than an args array) avoids Node's Windows cmd.exe re-escaping, which
// mangled spaces in e.g. a workspace name into ^^^"vilsem^^^ test^^^".
function quoteArg(a) {
  const s = String(a)
  return /[\s"&|<>^]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function runStreamed(cmd, args, cwd, onOutput) {
  return new Promise((resolve) => {
    let output = ''
    let child
    const line = [cmd, ...args].map(quoteArg).join(' ')
    try {
      // Single pre-quoted command string + shell:true → the shell parses OUR quoting
      // verbatim (spaces in args survive). npm_config_yes auto-confirms npx installs.
      child = spawn(line, { cwd, windowsHide: true, shell: true, env: { ...process.env, npm_config_yes: 'true' } })
    } catch (err) {
      onOutput?.({ stream: 'stderr', text: String(err.message) + '\n' })
      return resolve({ code: -1, output: String(err.message), spawnError: true })
    }
    const push = (chunk, stream) => { const t = chunk.toString(); output += t; onOutput?.({ stream, text: t }) }
    child.stdout?.on('data', d => push(d, 'stdout'))
    child.stderr?.on('data', d => push(d, 'stderr'))
    child.on('error', (err) => { push(String(err.message) + '\n', 'stderr'); resolve({ code: -1, output, spawnError: true }) })
    child.on('close', (code) => resolve({ code, output }))
  })
}

function mapError(output) {
  for (const m of FABRIC_CONFIG.errorMatchers) {
    if (m.test.test(output)) return { code: m.code, message: m.message }
  }
  return FABRIC_CONFIG.errorFallback
}

// Full pipeline. `spec` = vilsem App Spec. opts = { appName, workspace, workspaceId,
// datasetId, dryRun?, parentDir? }. onOutput({stream,text}) streams to the UI.
async function deployToFabric(spec, opts = {}, onOutput = () => {}) {
  const C = FABRIC_CONFIG
  const log = (text, stream = 'stdout') => onOutput({ stream, text: text.endsWith('\n') ? text : text + '\n' })

  const appName = opts.appName || spec?.title || 'vilsem-app'
  const appSlug = slug(appName)
  const workspace = opts.workspace || opts.workspaceName
  if (!workspace) return { ok: false, error: { code: 'NO_WORKSPACE', message: 'A target Fabric workspace name is required.' } }

  const parentDir = opts.parentDir || path.join(os.tmpdir(), 'vilsem-fabric')
  fs.mkdirSync(parentDir, { recursive: true })
  const projectDir = path.join(parentDir, appSlug)

  // 1) Scaffold via the official create command (unless the project already exists).
  //    NOTE [VERIFY]: `npm create` may prompt to install the create pkg the first
  //    time ("Ok to proceed?"). npx caches after run 1; if it hangs, pre-warm with
  //    `npm create @microsoft/rayfin@latest` once, or add a confirm flag in config.
  if (!fs.existsSync(projectDir) || !opts.reuseExisting) {
    // Clean any leftovers from a prior run — create-rayfin declines to scaffold into
    // a non-empty directory ("target directory … is not empty and overwrite declined").
    try { fs.rmSync(projectDir, { recursive: true, force: true }); log(`Cleaned prior target ${projectDir}`) } catch (e) { log(`⚠ Could not clean ${projectDir}: ${e.message}`, 'stderr') }
    const createArgs = C.cli.create.args.map(a => a.replace('{appName}', appSlug).replace('{workspace}', workspace))
    log(`$ ${C.cli.create.cmd} ${createArgs.join(' ')}`)
    const scaffold = await runStreamed(C.cli.create.cmd, createArgs, parentDir, onOutput)
    if (scaffold.code !== 0) return { ok: false, projectDir, stage: 'scaffold', error: scaffold.spawnError ? { code: 'CLI_MISSING', message: 'Could not launch npm. Install Node ≥20 + npm.' } : mapError(scaffold.output) }
  } else {
    log(`Reusing existing project at ${projectDir}`)
  }

  // 2) Inject the FULL vilsem app — vilsem's real renderer bundle + a Fabric-SDK
  //    window.semantica shim + the App Spec. The deployed app matches the web export
  //    exactly (all visuals + drill + interactions). BEST-EFFORT: if it throws or the
  //    caller asked for a template-only deploy, we still proceed so you SEE an app.
  let injected = null
  if (opts.injectChart === false) {
    log('Skipping vilsem app injection (template-only deploy).')
  } else {
    try {
      // Build the renderer bundle first so the deploy carries the CURRENT vilsem code.
      const be = C.cli.buildEmbed
      log(`$ ${be.cmd} ${be.args.join(' ')}  (building vilsem renderer bundle)`)
      const built = await runStreamed(be.cmd, be.args, REPO_ROOT, onOutput)
      if (built.code !== 0) log('⚠ Renderer bundle build returned non-zero — using existing bundle if present.', 'stderr')

      injected = injectFullApp(projectDir, spec, { appName, workspaceId: opts.workspaceId, datasetId: opts.datasetId })
      log(`Injected full vilsem app (${injected.visualCount} visuals, ${Math.round(injected.bundleBytes / 1024)}KB renderer, ${injected.written.length} files): ${injected.written.join(', ')}`)
    } catch (e) {
      log(`⚠ App injection skipped (${e.message}). Deploying the scaffolded template as-is.`, 'stderr')
    }
    if (injected) {
      // Wire the semantic-model connection alias so the shim's queries resolve.
      // The model's OWN workspace + item id (not the deploy workspace) — vilsem has
      // these from its connection. Auto-wire when provided; else print the command.
      const alias = injected.connectionAlias
      const modelWs = opts.modelWorkspaceId
      const modelItem = opts.datasetId
      if (modelWs && modelItem) {
        const addArgs = C.cli.addConnection.args.map(a => a.replace('{alias}', alias).replace('{workspaceId}', modelWs).replace('{itemId}', modelItem))
        log(`$ ${C.cli.addConnection.cmd} ${addArgs.join(' ')}`)
        await runStreamed(C.cli.addConnection.cmd, addArgs, projectDir, onOutput)
        await runStreamed(C.cli.generateConn.cmd, C.cli.generateConn.args, projectDir, onOutput)
      } else {
        log(`ℹ Model ids not passed — wire the connection once in ${projectDir}:`)
        log(`    npx fabric-app-data add semanticModel ${alias} --from-url "<your Power BI semantic model URL>"`)
        log(`  then re-deploy. (The app will show a query error until the alias resolves.)`, 'stderr')
      }
      // Ensure deps are installed before `rayfin up` builds (create usually installs;
      // the renderer bundle is self-contained, so no extra deps are added).
      log('$ npm install')
      const inst = await runStreamed('npm', ['install'], projectDir, onOutput)
      if (inst.code !== 0) log('⚠ npm install non-zero — build may fail.', 'stderr')
    }
  }

  // 3) Deploy — `npx rayfin up` (opens a browser sign-in on first run). --dry-run to preview.
  const upCmd = opts.dryRun ? C.cli.upDryRun : C.cli.up
  log(`$ ${upCmd.cmd} ${upCmd.args.join(' ')}`)
  const up = await runStreamed(upCmd.cmd, upCmd.args, projectDir, onOutput)
  if (up.code !== 0) return { ok: false, projectDir, injected, stage: 'deploy', error: up.spawnError ? { code: 'CLI_MISSING', message: 'Could not launch npx/rayfin.' } : mapError(up.output) }

  log('✓ Deploy finished. Look above for the hosted app URL + Fabric portal link.')
  return { ok: true, projectDir, injected }
}

// Force a fresh sign-in (used by the 401/403 recovery path).
async function rayfinLogout(cwd, onOutput) {
  const c = FABRIC_CONFIG.cli.logout
  return runStreamed(c.cmd, c.args, cwd || os.tmpdir(), onOutput)
}

// Interactive Fabric sign-in FROM the app — spawns `rayfin login`, which opens a
// browser (auth-code flow, no stdin needed) and caches a machine-level session.
// Streams output so the UI shows the sign-in URL/progress. Replaces the "open a
// separate PowerShell" step. NOTE: if a future CLI switches to a device-code flow
// that reads stdin, this spawned form can't complete it — fall back to a terminal.
async function rayfinLogin(cwd, onOutput) {
  const c = FABRIC_CONFIG.cli.login
  return runStreamed(c.cmd, c.args, cwd || os.tmpdir(), onOutput)
}

module.exports = { deployToFabric, rayfinLogout, rayfinLogin, runStreamed }
