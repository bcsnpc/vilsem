const { app, BrowserWindow } = require('electron/main')
const fs = require('node:fs'), path = require('node:path')
app.setPath('userData', path.resolve('cache/qa-text-token'))
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  let win
  try {
    win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } })
    await win.loadURL('data:text/html,<body></body>')
    const source = fs.readFileSync('ui/src/appspec/shared/measureToken.js', 'utf8').replaceAll('export function ', 'function ')
    const results = await win.webContents.executeJavaScript(`(() => {
      ${source}
      return ['Sales', '<b>Revenue</b>', 'A &quot; B', 'Sales "net" & tax', 'Unicode \u03b4'].map(name => {
        const editor = document.createElement('div')
        editor.innerHTML = '<i>' + measureTokenHtml(name, 'color:inherit') + '</i>'
        const token = editor.querySelector('[data-measure]')
        const extracted = extractMeasureTokens(editor.innerHTML + editor.innerHTML)
        return { name, pass: token.textContent === name && token.getAttribute('data-measure') === name && token.children.length === 0 && extracted.length === 1 && extracted[0] === name && token.parentElement.tagName === 'I' }
      })
    })()`)
    fs.mkdirSync('docs/qa/evidence', { recursive: true })
    fs.writeFileSync('docs/qa/evidence/text-token.json', JSON.stringify({ scope: 'Production token helpers in native Electron DOM', results }, null, 2))
    console.log(JSON.stringify(results))
    process.exitCode = results.every(r => r.pass) ? 0 : 1
  } catch (e) { console.error(e.message); process.exitCode = 1 }
  finally { win?.destroy(); app.exit(process.exitCode || 0) }
})
