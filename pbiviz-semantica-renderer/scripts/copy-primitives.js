#!/usr/bin/env node
/**
 * copy-primitives.js — bring the web app's primitives into the .pbiviz build.
 *
 * Phase 5.1 strategy: file copy at build time. Symlinks don't survive `git clone`
 * cleanly on Windows, and a real shared package is Phase 6 cleanup work. Until
 * then, this script keeps the .pbiviz bundle in sync with `ui/src/primitives/`
 * by copying the entire tree before `pbiviz package` runs.
 *
 * Run manually or via the npm "prebuild" / "prepackage" hook.
 */

const fs   = require('fs')
const path = require('path')

const PRIMITIVES_SRC = path.resolve(__dirname, '..', '..', 'ui', 'src', 'primitives')
const PRIMITIVES_DST = path.resolve(__dirname, '..', 'src', 'primitives')

// Primitives import from `../../appspec/shared/palettes.js` and `formatters.js`
// using a relative path. To keep those imports working without rewriting them,
// we mirror the same folder structure inside pbiviz/src/.
const SHARED_SRC = path.resolve(__dirname, '..', '..', 'ui', 'src', 'appspec', 'shared')
const SHARED_DST = path.resolve(__dirname, '..', 'src', 'appspec', 'shared')
const SHARED_FILES = ['palettes.js', 'formatters.js', 'drill.js', 'expandBarOption.js', 'chrome.js', 'applyTooltipConfig.js']

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
  const s = path.join(SHARED_SRC, name)
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
  const s = path.join(APPSPEC_SRC, name)
  const d = path.join(APPSPEC_DST, name)
  if (!fs.existsSync(s)) {
    console.error(`[copy-primitives] appspec file missing: ${s}`)
    process.exit(1)
  }
  fs.copyFileSync(s, d)
}

console.log('[copy-primitives] done')
