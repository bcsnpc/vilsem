#!/usr/bin/env node
/**
 * Launcher script that ensures ELECTRON_RUN_AS_NODE is not set,
 * then spawns the real Electron binary pointing directly at main.js.
 *
 * Using an absolute path to main.js instead of '.' avoids the native
 * ACCESS_VIOLATION crash that occurs when Electron resolves the app
 * directory via package.json on this system.
 */
const { spawn } = require('child_process')
const path = require('path')

const electronBin = require(path.join(__dirname, '../node_modules/electron'))
const mainJs = path.join(__dirname, '../electron/main.js')

// Build child env explicitly. ELECTRON_RUN_AS_NODE in the parent process
// causes electron.exe to behave as a plain Node.js binary instead of
// launching the GUI app. Empty string is still TRUTHY for Electron, so
// we must DELETE the key entirely — not set to '' or '0'.
//
// CRITICAL: Windows env vars are CASE-INSENSITIVE (so the OS treats
// `electron_run_as_node=1` and `ELECTRON_RUN_AS_NODE=1` as the same
// variable), but Node's `process.env` preserves whatever casing the
// variable was originally set with. A literal `k === 'ELECTRON_RUN_AS_NODE'`
// check therefore MISSES lowercase/mixed-case variants and lets the var
// through to the child. We compare uppercase to catch all casings.
const SKIP_KEYS = new Set([
  'ELECTRON_RUN_AS_NODE',
  'ELECTRON_NO_ATTACH_CONSOLE',
  'ELECTRON_FORCE_IS_PACKAGED',
])
const env = {}
for (const [k, v] of Object.entries(process.env)) {
  if (SKIP_KEYS.has(k.toUpperCase())) continue
  env[k] = v
}

if (process.argv.includes('--dev')) {
  env.VITE_DEV_SERVER = '1'
}

// Diagnostic: log final env state for ELECTRON_* keys so future crashes
// are debuggable.
const electronKeys = Object.keys(env).filter(k => k.startsWith('ELECTRON_'))
console.log('[launcher] electron env:',
  electronKeys.length ? electronKeys.map(k => `${k}=${JSON.stringify(env[k])}`).join(', ') : '(none)',
  '· ELECTRON_RUN_AS_NODE present:', 'ELECTRON_RUN_AS_NODE' in env)

const extraArgs = process.argv.slice(2).filter(a => a !== '--dev')

const args = [
  mainJs,
  '--no-sandbox',
  '--disable-gpu',
  ...extraArgs,
]

const child = spawn(electronBin, args, {
  stdio: 'inherit',
  env,
  cwd: path.join(__dirname, '..'),
})

child.on('close', code => process.exit(code ?? 0))
child.on('error', err => {
  console.error('[launcher] Failed to spawn Electron:', err.message)
  process.exit(1)
})
