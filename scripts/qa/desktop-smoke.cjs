// Initial audit: launch the real Electron entry with disposable local state.
// Run through launch-audit.cjs while the Vite server is listening on 5173.
const fs = require('node:fs')
const path = require('node:path')
const { app } = require('electron/main')
const root = path.resolve(__dirname, '../..')
const output = path.join(root, 'docs/qa/evidence')
const profile = path.join(root, 'cache/qa-profile')
fs.mkdirSync(output, { recursive: true })
fs.mkdirSync(profile, { recursive: true })
app.setPath('userData', profile)
process.chdir(profile) // dotenv must not load the developer's .env.
for (const key of Object.keys(process.env)) {
  if (/^(FABRIC_|AUTH_MODE$|ANTHROPIC_API_KEY$|OPENAI_API_KEY$|GEMINI_API_KEY$|GROQ_API_KEY$)/i.test(key)) delete process.env[key]
}
process.env.VITE_DEV_SERVER = '1'
const evidence = { mode: 'real Electron entry, isolated profile, no credentials', events: [] }
const record = (type, detail) => evidence.events.push({ type, detail })
const persist = () => fs.writeFileSync(path.join(output, 'desktop-smoke.json'), JSON.stringify(evidence, null, 2))
async function capture(win, filename) {
  // CDP captures the current compositor surface; capturePage can lag a DOM transition.
  if (!win.webContents.debugger.isAttached()) win.webContents.debugger.attach('1.3')
  const shot = await win.webContents.debugger.sendCommand('Page.captureScreenshot', { format: 'png', fromSurface: true })
  fs.writeFileSync(path.join(output, filename), Buffer.from(shot.data, 'base64'))
}
const deadline = setTimeout(() => {
  record('failure', 'Timed out waiting for mounted application (60 seconds)')
  persist()
  app.exit(1)
}, 60000)
app.on('browser-window-created', (_event, win) => {
  win.webContents.on('render-process-gone', (_e, detail) => record('renderer-crash', detail))
  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2) record('console', message)
  })
  win.webContents.once('did-finish-load', async () => {
    try {
      const state = await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
        const ready = () => {
          const text = document.body.innerText;
          if (!text.includes('Sign in with Microsoft')) return false;
          resolve({ title: document.title, text, buttons: [...document.querySelectorAll('button')].map(b => b.innerText), bridge: typeof window.semantica?.query });
          return true;
        };
        if (ready()) return;
        const observer = new MutationObserver(() => { if (ready()) observer.disconnect(); });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => { observer.disconnect(); reject(new Error('No mounted UI within 20 seconds')); }, 20000);
      })`)
      evidence.initial = state
      await win.webContents.executeJavaScript('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))')
      await capture(win, 'desktop-startup.png')
      evidence.servicePrincipal = await win.webContents.executeJavaScript(`(async () => {
        const button = [...document.querySelectorAll('button')].find(b => b.innerText === 'Service Principal');
        if (!button) throw new Error('Service Principal tab missing');
        button.click();
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        return { text: document.body.innerText, inputs: [...document.querySelectorAll('input')].map(i => ({ type: i.type, placeholder: i.placeholder })) };
      })()`)
      if (evidence.servicePrincipal.inputs.length !== 3 || !evidence.servicePrincipal.inputs.some(i => i.type === 'password')) throw new Error('Service Principal credential form did not mount')
      await capture(win, 'desktop-service-principal.png')
      persist()
      clearTimeout(deadline)
      app.exit(0)
    } catch (err) {
      record('failure', err.message)
      persist()
      clearTimeout(deadline)
      app.exit(1)
    }
  })
})
require(path.join(root, 'electron/main.js'))
