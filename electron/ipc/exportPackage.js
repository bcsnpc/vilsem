const { ipcMain, shell, app, dialog, BrowserWindow } = require('electron/main')
const path = require('path')
const fs = require('fs')

// In packaged app, app.getAppPath() returns the app root containing src/.
// In dev mode (launched via scripts/launch-electron.js), app.getAppPath() may
// return the electron/ subdir; walk up to find the one that contains src/.
function getAppRoot() {
  const tryPath = (p) => p && fs.existsSync(path.join(p, 'src', 'auth', 'auth.js')) ? p : null
  const candidates = []
  try { candidates.push(app.getAppPath()) } catch { /* ignore */ }
  candidates.push(process.cwd())
  // Walk up two levels from __dirname (electron/ipc/ → electron/ → repo root)
  candidates.push(path.resolve(__dirname, '..', '..'))
  for (const c of candidates) {
    const resolved = tryPath(c)
    if (resolved) return resolved
    // Walk up from the candidate itself in case it's a sub-dir
    if (c) {
      const parent = tryPath(path.resolve(c, '..'))
      if (parent) return parent
    }
  }
  // Last resort — return the first candidate so the error message is still useful
  return candidates[0] || process.cwd()
}
function getExportRoot() {
  try { return path.join(app.getPath('userData'), '..', '..', 'Desktop') } catch { return process.cwd() }
}

// Thin server entry point that reuses the real Semantica backend modules
const SERVER_ENTRY = `require('dotenv').config({ override: true });
const fastify = require('fastify')({ logger: { level: process.env.LOG_LEVEL || 'info' } });
const cors = require('@fastify/cors');
const { initAuth } = require('./src/auth/auth');
const previewRoute = require('./src/routes/preview');
const p = require('path'), f = require('fs');

async function start() {
  // 1. Auth — uses same service-principal flow as Semantica
  await initAuth();
  console.log('[server] Authentication complete');

  // 2. CORS
  await fastify.register(cors);

  // 3. Serve static files (index.html + assets)
  fastify.get('/', async (req, reply) => {
    reply.type('text/html').send(f.readFileSync(p.join(__dirname, 'index.html'), 'utf-8'));
  });
  fastify.get('/app-spec.json', async (req, reply) => {
    reply.type('application/json').send(f.readFileSync(p.join(__dirname, 'app-spec.json'), 'utf-8'));
  });
  // Serve public assets (JS/CSS bundles)
  fastify.get('/public/*', async (req, reply) => {
    const filePath = p.join(__dirname, req.url);
    if (!f.existsSync(filePath)) return reply.code(404).send('Not found');
    const ext = p.extname(filePath);
    const types = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' };
    reply.type(types[ext] || 'application/octet-stream').send(f.readFileSync(filePath));
  });

  // 4. Query routes (same as Semantica preview)
  await fastify.register(previewRoute);

  const port = parseInt(process.env.PORT, 10) || 3000;
  await fastify.listen({ port, host: '0.0.0.0' });
  console.log('\\n  App running at: http://localhost:' + port + '\\n');
}

start().catch(err => { console.error('Failed to start:', err.message); process.exit(1); });
`

// Backend source files to copy (preserving directory structure)
const BACKEND_FILES = [
  'src/auth/auth.js',
  'src/fabric/client.js',
  'src/fabric/translator.js',
  'src/fabric/xmla.js',
  'src/queue/limiter.js',
  'src/routes/preview.js',
]

function register() {
  ipcMain.handle('export-app-package', async (_e, { spec, appName, credentials, exportFolderName }) => {
    const hasContent = spec?.visuals?.length || spec?.pages?.some(p => p?.visuals?.length)
    if (!hasContent) throw new Error('No app spec to export')

    // Folder name priority: explicit exportFolderName from the dialog → appName → spec.title → "app".
    // Same sanitizer as before so path-unsafe chars can't slip through.
    const rawName = (exportFolderName || appName || spec.title || 'app').toString()
    const safeName = rawName.replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'app'
    const folderSlug = safeName.replace(/ /g, '-')
    const appRoot = getAppRoot()

    // Let user pick export location via OS folder picker
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win, {
      title: 'Choose export location',
      defaultPath: path.join(app.getPath('desktop'), folderSlug),
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: 'Export Here',
    })
    if (result.canceled || !result.filePaths?.length) {
      return { canceled: true }
    }
    const exportDir = path.join(result.filePaths[0], folderSlug)
    // Clean the target folder if it exists — prevents stale files from
    // previous exports (different JS hashes) from conflicting.
    if (fs.existsSync(exportDir)) {
      fs.rmSync(exportDir, { recursive: true, force: true })
    }
    fs.mkdirSync(exportDir, { recursive: true })

    // 1. App Spec JSON
    fs.writeFileSync(path.join(exportDir, 'app-spec.json'), JSON.stringify(spec, null, 2), 'utf-8')

    // 2. Standalone React app (same AppSpecRenderer as Semantica)
    const standaloneSrc = path.join(appRoot, 'dist', 'app', 'standalone')
    console.log('[export] appRoot:', appRoot, '| standaloneSrc:', standaloneSrc, '| exists:', fs.existsSync(standaloneSrc))
    if (fs.existsSync(standaloneSrc)) {
      // Copy all standalone build files
      const copyDir = (src, dest) => {
        fs.mkdirSync(dest, { recursive: true })
        for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
          const srcPath = path.join(src, entry.name)
          const destPath = path.join(dest, entry.name)
          if (entry.isDirectory()) copyDir(srcPath, destPath)
          else fs.copyFileSync(srcPath, destPath)
        }
      }
      // Copy assets
      const assetsDir = path.join(standaloneSrc, 'assets')
      if (fs.existsSync(assetsDir)) copyDir(assetsDir, path.join(exportDir, 'public', 'assets'))
      // Copy and rename standalone.html → index.html
      const htmlSrc = path.join(standaloneSrc, 'standalone.html')
      if (fs.existsSync(htmlSrc)) {
        let html = fs.readFileSync(htmlSrc, 'utf-8')
        // Fix asset paths (Vite outputs ./assets/..., serve from /public/assets/...)
        html = html.replace(/\.\/assets\//g, './public/assets/')
        fs.writeFileSync(path.join(exportDir, 'index.html'), html, 'utf-8')
      }
    } else {
      // Fallback: use legacy preview.html
      const previewSrc = path.join(appRoot, 'dist', 'app', 'preview.html')
      if (fs.existsSync(previewSrc)) {
        let html = fs.readFileSync(previewSrc, 'utf-8')
        html = html.replace(/const res = await fetch\(`\$\{API_BASE\}\/preview-spec`/, 'const res = await fetch(`${API_BASE}/app-spec.json`')
        html = html.replace(/headers: \{ 'X-Api-Key': API_KEY \},\n/, 'headers: {},\n')
        fs.writeFileSync(path.join(exportDir, 'index.html'), html, 'utf-8')
      }
    }

    // 3. server.js — thin entry point that reuses real backend modules
    fs.writeFileSync(path.join(exportDir, 'server.js'), SERVER_ENTRY, 'utf-8')

    // 4. Copy real backend source files (preserving directory structure).
    // Missing files are a HARD error — server.js requires these and running
    // without them dies with "Cannot find module './src/auth/auth'". A silent
    // warning here used to let the export claim success with a broken bundle.
    const projectRoot = appRoot
    const missing = []
    for (const relPath of BACKEND_FILES) {
      const srcFile = path.join(projectRoot, relPath)
      const destFile = path.join(exportDir, relPath)
      if (fs.existsSync(srcFile)) {
        fs.mkdirSync(path.dirname(destFile), { recursive: true })
        fs.copyFileSync(srcFile, destFile)
      } else {
        missing.push(relPath)
      }
    }
    if (missing.length > 0) {
      throw new Error(
        `Export failed: required backend files not found at appRoot=${projectRoot}. ` +
        `Missing: ${missing.join(', ')}. ` +
        `If you're running in a packaged/asar build, these files must be declared in electron-builder extraResources.`
      )
    }

    // 5. package.json
    fs.writeFileSync(path.join(exportDir, 'package.json'), JSON.stringify({
      name: safeName.toLowerCase().replace(/ /g, '-'),
      version: '1.0.0',
      private: true,
      description: `${safeName} — generated by Semantica App Generator`,
      main: 'server.js',
      scripts: { start: 'node server.js' },
      dependencies: {
        'fastify': '^5.3.3',
        '@fastify/cors': '^11.0.1',
        'axios': '^1.8.4',
        'dotenv': '^16.5.0',
      },
    }, null, 2), 'utf-8')

    // 6. Credentials
    // .env.example — always placeholder-only (safe for git)
    fs.writeFileSync(path.join(exportDir, '.env.example'), `# ${safeName} — Environment Configuration
AUTH_MODE=service_principal
FABRIC_TENANT_ID=your-tenant-id-here
FABRIC_CLIENT_ID=your-client-id-here
FABRIC_CLIENT_SECRET=your-client-secret-here
FABRIC_WORKSPACE_ID=your-workspace-id-here
FABRIC_DATASET_ID=your-dataset-id-here
PORT=3000
`, 'utf-8')

    // .env — only created if user explicitly provided credentials via the export dialog
    const creds = credentials
    const hasCreds = creds && creds.tenantId && creds.clientId && creds.clientSecret && creds.workspaceId && creds.datasetId
    if (hasCreds) {
      fs.writeFileSync(path.join(exportDir, '.env'), `# Auto-generated by Semantica Export — ready to run
AUTH_MODE=service_principal
FABRIC_TENANT_ID=${creds.tenantId}
FABRIC_CLIENT_ID=${creds.clientId}
FABRIC_CLIENT_SECRET=${creds.clientSecret}
FABRIC_WORKSPACE_ID=${creds.workspaceId}
FABRIC_DATASET_ID=${creds.datasetId}
PORT=3000
LOG_LEVEL=info
`, 'utf-8')
      console.log('[export] .env created with user-provided credentials')
    } else {
      console.log('[export] No credentials provided — user must create .env from .env.example')
    }

    // 7. README.md
    const visualTypes = [...new Set(spec.visuals?.map(v => v.type) || [])].join(', ')
    fs.writeFileSync(path.join(exportDir, 'README.md'), `# ${safeName}

Generated by **Semantica App Generator**.

## Quick Start

\`\`\`bash
npm install
${hasCreds ? 'npm start          # .env is pre-configured' : 'cp .env.example .env   # fill in your Fabric credentials\nnpm start'}
\`\`\`

Open **http://localhost:3000**

${hasCreds ? '> Credentials were pre-filled from your active Semantica workspace. The app is ready to run after `npm install`.' : `## Credentials needed in .env

| Variable | Description |
|----------|-------------|
| FABRIC_TENANT_ID | Azure AD / Entra ID tenant ID |
| FABRIC_CLIENT_ID | App registration client ID |
| FABRIC_CLIENT_SECRET | App registration client secret |
| FABRIC_WORKSPACE_ID | Fabric workspace ID |
| FABRIC_DATASET_ID | Semantic model (dataset) ID |`}

## Dashboard: ${spec.visuals?.length || 0} visuals (${visualTypes}), ${spec.slicers?.length || 0} slicers
`, 'utf-8')

    // 8. .gitignore
    fs.writeFileSync(path.join(exportDir, '.gitignore'), `.env
node_modules/
`, 'utf-8')

    // Don't open the export folder — auto-run preview handles the browser.
    // Opening the folder steals focus and hides the loading toast sequence.
    // shell.openPath(exportDir)

    return {
      exportDir,
      files: ['app-spec.json', 'index.html', 'server.js', 'package.json', '.env.example', 'README.md', '.gitignore',
              ...BACKEND_FILES],
    }
  })

  // ── Auto-run web preview ──────────────────────────────────────────────
  // Runs npm install + node server.js in the exported folder, then opens
  // the browser. Returns a process handle so the UI can stop it later.

  const { spawn } = require('child_process')
  let previewProcess = null

  ipcMain.handle('run-web-preview', async (_e, { exportDir }) => {
    if (!exportDir || !fs.existsSync(path.join(exportDir, 'server.js'))) {
      return { success: false, message: 'Export directory not found or missing server.js' }
    }

    // Kill any existing preview (tracked or orphaned from previous session)
    if (previewProcess) {
      try { previewProcess.kill() } catch { /* ignore */ }
      previewProcess = null
    }
    // Also kill any orphaned process on port 3000 (e.g. from a previous Electron session)
    try {
      const { execSync } = require('child_process')
      if (process.platform === 'win32') {
        const out = execSync('netstat -ano | findstr :3000 | findstr LISTENING', { encoding: 'utf-8', timeout: 3000 }).trim()
        const pids = [...new Set(out.split('\n').map(l => l.trim().split(/\s+/).pop()).filter(p => p && p !== '0'))]
        for (const pid of pids) {
          try { execSync(`taskkill /PID ${pid} /T /F`, { timeout: 3000 }) } catch { /* ignore */ }
        }
        console.log('[preview] Killed orphaned processes on port 3000:', pids)
      } else {
        execSync('lsof -ti:3000 | xargs kill -9 2>/dev/null || true', { timeout: 3000 })
      }
    } catch { /* no process on port — fine */ }

    try {
      // Step 1: npm install (sync-ish — wait for exit)
      console.log('[preview] Running npm install in', exportDir)
      await new Promise((resolve, reject) => {
        const npm = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--no-audit', '--no-fund'], {
          cwd: exportDir,
          stdio: 'pipe',
          shell: true,
        })
        npm.stdout?.on('data', (d) => console.log('[preview npm]', d.toString().trim()))
        npm.stderr?.on('data', (d) => console.warn('[preview npm]', d.toString().trim()))
        npm.on('close', (code) => code === 0 ? resolve() : reject(new Error(`npm install exited with code ${code}`)))
        npm.on('error', reject)
        setTimeout(() => { try { npm.kill() } catch {} reject(new Error('npm install timed out (60s)')) }, 60000)
      })

      // Brief pause to let port 3000 release after kill
      await new Promise(r => setTimeout(r, 500))

      // Step 2: node server.js (background — keep running).
      // Run it like a clean manual terminal: strip the parent (Electron) auth
      // env so the exported folder's own .env is authoritative. Otherwise an
      // interactive Semantica session leaks AUTH_MODE=interactive (+ FABRIC_*)
      // into the child, and since dotenv doesn't override existing env, the
      // exported .env's AUTH_MODE=service_principal is ignored -> the headless
      // server fails with "interactive mode requires tokens". (This is why
      // running the exported folder manually worked but the tool didn't.)
      const childEnv = { ...process.env, PORT: '3000' }
      for (const k of ['AUTH_MODE', 'FABRIC_TENANT_ID', 'FABRIC_CLIENT_ID', 'FABRIC_CLIENT_SECRET', 'FABRIC_ACCESS_TOKEN', 'FABRIC_REFRESH_TOKEN']) {
        delete childEnv[k]
      }
      console.log('[preview] Starting server in', exportDir)
      const server = spawn('node', ['server.js'], {
        cwd: exportDir,
        stdio: 'pipe',
        shell: true,
        env: childEnv,
      })
      previewProcess = server

      // Capture output for diagnostics + detect the bound URL (port may differ).
      let serverUrl = 'http://localhost:3000'
      let stderrBuf = ''
      let serverExited = false
      server.stdout?.on('data', (d) => {
        const line = d.toString()
        console.log('[preview server]', line.trim())
        const match = line.match(/http:\/\/localhost:\d+/)
        if (match) serverUrl = match[0]
      })
      server.stderr?.on('data', (d) => { const s = d.toString(); stderrBuf += s; console.warn('[preview server]', s.trim()) })
      server.on('exit', (code) => { serverExited = true; if (code) stderrBuf += `\n[server exited with code ${code}]` })

      // Poll the server until it ACTUALLY responds before opening the browser.
      // Opening optimistically (old behavior) caused ERR_CONNECTION_REFUSED when
      // the browser beat the server to the port — especially because the
      // "running at" stdout line isn't reliably piped under shell:true on Windows.
      // The exported server binds IPv4 (host '0.0.0.0'), but Node resolves
      // 'localhost' to ::1 (IPv6) on Windows — so polling/opening 'localhost'
      // hits IPv6 and gets ECONNREFUSED even though the server is up. Poll and
      // open 127.0.0.1 explicitly (same IPv4/IPv6 fix as the dev server).
      const http = require('http')
      const openUrl = serverUrl.replace('localhost', '127.0.0.1')
      const candidates = [openUrl, serverUrl]
      const ping = (url) => new Promise((res) => {
        const req = http.get(url, (r) => { r.resume(); res(true) })
        req.on('error', () => res(false))
        req.setTimeout(1500, () => { req.destroy(); res(false) })
      })
      const deadline = Date.now() + 25000
      let reachable = null
      while (Date.now() < deadline && !serverExited && !reachable) {
        for (const url of candidates) { if (await ping(url)) { reachable = url; break } }
        if (!reachable) await new Promise(r => setTimeout(r, 500))
      }

      if (!reachable) {
        try { server.kill() } catch { /* ignore */ }
        previewProcess = null
        const tail = stderrBuf.trim().split('\n').slice(-4).join(' ')
        return { success: false, message: `Preview server didn't start on ${openUrl}.${tail ? ' ' + tail : ''}` }
      }

      // Step 3: open in system browser — only once it's actually serving.
      // Open 127.0.0.1 so the browser doesn't try IPv6 first.
      shell.openExternal(openUrl)

      return { success: true, url: openUrl, pid: server.pid }
    } catch (e) {
      return { success: false, message: e?.message || 'Failed to start preview' }
    }
  })

  ipcMain.handle('stop-web-preview', async () => {
    let killed = false
    if (previewProcess) {
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/PID', String(previewProcess.pid), '/T', '/F'], { shell: true })
        } else {
          previewProcess.kill('SIGTERM')
        }
      } catch { /* ignore */ }
      previewProcess = null
      killed = true
    }
    // Also kill any orphaned process on port 3000
    try {
      const { execSync } = require('child_process')
      if (process.platform === 'win32') {
        const out = execSync('netstat -ano | findstr :3000 | findstr LISTENING', { encoding: 'utf-8', timeout: 3000 }).trim()
        const pids = [...new Set(out.split('\n').map(l => l.trim().split(/\s+/).pop()).filter(p => p && p !== '0'))]
        for (const pid of pids) {
          try { execSync(`taskkill /PID ${pid} /T /F`, { timeout: 3000 }) } catch { /* ignore */ }
        }
        if (pids.length) killed = true
      }
    } catch { /* no process on port */ }
    return killed ? { success: true } : { success: false, message: 'No preview running' }
  })
}

module.exports = { register }
