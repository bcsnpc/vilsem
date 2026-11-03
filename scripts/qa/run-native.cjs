// Run isolated native-DOM/renderer QA without inheriting Electron's Node mode.
const { spawn } = require('node:child_process')
const path = require('node:path')
const allowed = new Set(['scalar-card-states','powerbi-tooltip-bounds','axis-switch-state','dom-card-bounds','axis-number','secondary-axis','race-controls','powerbi-race-controls','powerbi-title','powerbi-waffle','waffle-audit','fabric-dialog','export-type-audit','text-token','text-format-audit','powerbi-table','interaction-audit'])
const requested = process.argv.slice(2)
const suites = requested.length ? requested : [...allowed]
if (suites.some(name => !allowed.has(name))) {
  console.error(`Choose local suites from: ${[...allowed].join(', ')}`)
  process.exitCode = 1
} else {
  const root = path.resolve(__dirname, '../..')
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^ELECTRON_/i.test(key)))
  ;(async () => {
    try {
      const response = await fetch('http://127.0.0.1:5173/qa/full-audit.html', { signal: AbortSignal.timeout(5000) })
      if (!response.ok) throw Error('QA entry unavailable')
    } catch {
      console.error('Start the Vilsem dev server with npm run ui:dev, then retry npm run qa:native.')
      process.exitCode = 1; return
    }
    const results = []
    for (const name of suites) {
      console.log(`Running native QA: ${name}`)
      const code = await new Promise(resolve => {
        const child = spawn(require('electron'), [path.join(__dirname, name + '.cjs'), '--after'], { cwd: root, env, stdio: 'inherit' })
        child.on('error', error => { console.error(error.message); resolve(1) })
        child.on('exit', (code, signal) => resolve(signal || code == null ? 1 : code))
      })
      results.push({ suite: name, pass: code === 0 })
    }
    console.log(JSON.stringify(results))
    process.exitCode = results.some(result => !result.pass) ? 1 : 0
  })().catch(error => { console.error(error.message); process.exitCode = 1 })
}
