const fs = require('node:fs')
const path = require('node:path')
const { app, BrowserWindow } = require('electron/main')
const root = path.resolve(__dirname, '../..')
const output = path.join(root, 'docs/qa/evidence')
const profile = path.join(root, 'cache/qa-renderer-profile')
fs.mkdirSync(output, { recursive: true })
fs.mkdirSync(profile, { recursive: true })
app.setPath('userData', profile)
app.disableHardwareAcceleration()
const report = { scope: 'Production leaf renderers with synthetic normalized rows. No host queries or live AI. Overflow metrics are candidates, not screenshot approvals.', cases: [], events: [] }
const persist = () => fs.writeFileSync(path.join(output, 'renderer-smoke.json'), JSON.stringify(report, null, 2))
const deadline = setTimeout(() => { report.events.push({ failure: '120 second deadline' }); persist(); app.exit(1) }, 120000)
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1560, height: 1000, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } })
  win.webContents.on('console-message', event => { if (event.level === 'error') report.events.push({ scenario: report.currentCase, console: event.message }) })
  try {
    await win.loadURL('http://127.0.0.1:5173/qa.html')
    await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
      const until = performance.now() + 20000;
      const check = () => window.qaReady ? resolve(true) : performance.now() > until ? reject(new Error('QA module did not load')) : requestAnimationFrame(check);
      check();
    })`)
    report.inventory = await win.webContents.executeJavaScript('window.qaInventory')
    report.contracts = await win.webContents.executeJavaScript('window.qaContracts()')
    for (const [fixture, width, height] of [['standard',480,320], ['empty',480,320], ['zero',480,320], ['mixed',480,320], ['nulls',480,320], ['long',480,320], ['standard',80,60], ['standard',160,600], ['standard',800,100]]) {
      report.currentCase = { fixture, width, height }
      report.cases.push(...await win.webContents.executeJavaScript(`window.qaRun(${JSON.stringify(fixture)},${width},${height})`))
      persist()
      if (fixture === 'empty' || (fixture === 'standard' && width === 480)) fs.writeFileSync(path.join(output, `renderers-${fixture}.png`), (await win.webContents.capturePage()).toPNG())
    }
    clearTimeout(deadline)
    persist()
    app.exit(report.events.length || report.cases.some(c => c.errorBoundary) ? 1 : 0)
  } catch (err) { report.events.push({ failure: err.stack }); persist(); clearTimeout(deadline); app.exit(1) }
})
