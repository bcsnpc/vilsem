#!/usr/bin/env node
/**
 * copy-primitives.js — bring the web app's primitives into the .pbiviz build.
 *
 * Copies the shared @vilsem/core primitive tree and pure helpers before packaging.
 * The React DOM adapter is bundled separately from its existing app components.
 *
 * Run manually or via the npm "prebuild" / "prepackage" hook.
 */

const fs   = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
execFileSync(process.execPath,[path.resolve(__dirname,'../../packages/core/scripts/sync-pane-capabilities.mjs')],{stdio:'inherit'})

// Build the actual app DOM renderer on every package/start; never reuse a stale bundle.
const UI_ROOT = path.resolve(__dirname, '..', '..', 'ui')
execFileSync(process.execPath, [path.join(UI_ROOT, 'node_modules/vite/bin/vite.js'), 'build', '--config', 'vite.powerbi-dom.config.js'], { cwd: UI_ROOT, stdio: 'inherit' })
const DOM_DST = path.resolve(__dirname, '../generated/powerbiDom.js')
fs.mkdirSync(path.dirname(DOM_DST), { recursive: true })
fs.copyFileSync(path.resolve(UI_ROOT, '../cache/powerbi-dom/powerbiDom.js'), DOM_DST)
// Remove the former generated location; authored sources stay under src/.
const OLD_DOM_DST = path.resolve(__dirname, '../src/powerbiDom.js')
if (fs.existsSync(OLD_DOM_DST)) fs.unlinkSync(OLD_DOM_DST)

const PRIMITIVES_SRC = path.resolve(__dirname, '..', '..', 'packages', 'core', 'src', 'primitives')
const PRIMITIVES_DST = path.resolve(__dirname, '..', 'src', 'primitives')

// Primitives import from `../../appspec/shared/palettes.js` and `formatters.js`
// using a relative path. To keep those imports working without rewriting them,
// we mirror the same folder structure inside pbiviz/src/.
const SHARED_SRC = path.resolve(__dirname, '..', '..', 'ui', 'src', 'appspec', 'shared')
const SHARED_DST = path.resolve(__dirname, '..', 'src', 'appspec', 'shared')
const SHARED_FILES = ['palettes.js', 'formatters.js', 'drill.js', 'expandBarOption.js', 'chrome.js', 'chartTitle.js', 'applyTooltipConfig.js', 'axisTextConfig.js', 'secondaryAxis.js']

// contract.ts also pulls a type from ../appspec/getThemeTokens — type-only
// import but TS needs the file to resolve. Mirror it alongside the shared/ dir.
const APPSPEC_SRC = path.resolve(__dirname, '..', '..', 'ui', 'src', 'appspec')
const APPSPEC_DST = path.resolve(__dirname, '..', 'src', 'appspec')
const APPSPEC_FILES = ['getThemeTokens.ts']

function rmrf(p) {
  if (!fs.existsSync(p)) return
  for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
    const child = path.join(p, entry.name)
    if (entry.isDirectory()) { rmrf(child); fs.rmdirSync(child) }
    else fs.unlinkSync(child)
  }
}

function copyDir(src, dst) {
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dst, entry.name)
    if (entry.isDirectory()) {
      copyDir(s, d)
    } else if (entry.isFile()) {
      // Skip test files — pbiviz doesn't need them and shouldn't compile them
      if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) continue
      fs.copyFileSync(s, d)
    }
  }
}

if (!fs.existsSync(PRIMITIVES_SRC)) {
  console.error(`[copy-primitives] source not found: ${PRIMITIVES_SRC}`)
  process.exit(1)
}

console.log(`[copy-primitives] cleaning ${PRIMITIVES_DST}`)
rmrf(PRIMITIVES_DST)
console.log(`[copy-primitives] copying ${PRIMITIVES_SRC} → ${PRIMITIVES_DST}`)
copyDir(PRIMITIVES_SRC, PRIMITIVES_DST)

// Copy the shared helpers the primitives depend on (palettes, formatters).
// Keep the same folder shape so the relative imports inside primitives work
// without modification (../../appspec/shared/...).
console.log(`[copy-primitives] copying shared helpers → ${SHARED_DST}`)
if (!fs.existsSync(SHARED_DST)) fs.mkdirSync(SHARED_DST, { recursive: true })
for (const name of SHARED_FILES) {
  const s = ['palettes.js', 'formatters.js'].includes(name) ? path.resolve(__dirname, '../../packages/core/src/shared', name) : path.join(SHARED_SRC, name)
  const d = path.join(SHARED_DST, name)
  if (!fs.existsSync(s)) {
    console.error(`[copy-primitives] shared file missing: ${s}`)
    process.exit(1)
  }
  fs.copyFileSync(s, d)
}

// Copy the appspec/ files the primitives type-import (getThemeTokens.ts).
console.log(`[copy-primitives] copying appspec helpers → ${APPSPEC_DST}`)
if (!fs.existsSync(APPSPEC_DST)) fs.mkdirSync(APPSPEC_DST, { recursive: true })
for (const name of APPSPEC_FILES) {
  const s = name === 'getThemeTokens.ts' ? path.resolve(__dirname, '../../packages/core/src/shared/theme.ts') : path.join(APPSPEC_SRC, name)
  const d = path.join(APPSPEC_DST, name)
  if (!fs.existsSync(s)) {
    console.error(`[copy-primitives] appspec file missing: ${s}`)
    process.exit(1)
  }
  fs.copyFileSync(s, d)
}

console.log('[copy-primitives] done')

// Shared pure helpers imported by the extracted primitives.
copyDir(path.resolve(__dirname, '../../packages/core/src/shared'), path.resolve(__dirname, '../src/shared'))
