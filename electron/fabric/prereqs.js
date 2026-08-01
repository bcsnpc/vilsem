// prereqs.js — verify the runtimes/CLIs a Fabric deploy needs are on PATH, BEFORE
// attempting anything. Returns a structured result the UI renders as a checklist.
const { execFile } = require('child_process')
const { FABRIC_CONFIG } = require('./fabric.config')

// Probe `cmd --version`. shell:true so Windows resolves npm.cmd / npx.cmd etc.
// (args are static strings from fabric.config — no user input, safe from injection).
function probe(cmd, versionArg) {
  return new Promise((resolve) => {
    execFile(cmd, [versionArg], { timeout: 6000, windowsHide: true, shell: true }, (err, stdout) => {
      if (err) return resolve({ found: false, version: null })
      resolve({ found: true, version: String(stdout || '').trim().split('\n')[0] })
    })
  })
}

async function checkPrereqs() {
  const results = {}
  const missing = []
  let ok = true

  for (const [key, spec] of Object.entries(FABRIC_CONFIG.prereqs)) {
    const r = await probe(spec.cmd, spec.versionArg)
    let versionOk = r.found
    if (r.found && spec.minMajor) {
      const major = parseInt(String(r.version).replace(/^v/, '').split('.')[0], 10)
      versionOk = Number.isFinite(major) && major >= spec.minMajor
    }
    results[key] = {
      label: spec.label, required: !!spec.required,
      found: r.found, version: r.version, versionOk, minMajor: spec.minMajor || null,
    }
    if (spec.required && !versionOk) { ok = false; missing.push(spec.label) }
  }

  return { ok, missing, results }
}

module.exports = { checkPrereqs }
