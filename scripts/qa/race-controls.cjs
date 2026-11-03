const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const { app, BrowserWindow } = require('electron/main')
const profile = path.resolve('cache/qa-race-controls')
fs.mkdirSync(profile, { recursive: true }); app.setPath('userData', profile); app.disableHardwareAcceleration()
const report = { checks: [] }
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1400, height: 1000, webPreferences: { backgroundThrottling: false } })
  const js = code => win.webContents.executeJavaScript(code)
  const call = (method, ...args) => js(`window.qaFull.${method}(...${JSON.stringify(args)})`)
  try {
    await win.loadURL('http://127.0.0.1:5173/qa/full-audit.html')
    await js(`new Promise((resolve,reject)=>{const end=Date.now()+30000;const check=()=>window.qaFullReady?resolve():Date.now()>end?reject(Error('entry timeout')):requestAnimationFrame(check);check()})`)
    for (const host of ['editor', 'viewer']) for (const width of [120, 160, 240, 480]) for (const height of [80, 320]) {
      const spec = await call('makeSpec', 'bar_race')
      spec.visuals[0].position = { x: 0, y: 0, w: 12, h: (height + 8) / 88 }
      await call('mount', 'bar_race', host, { spec, width, inspector: false })
      const result = await js(`(()=>{const input=document.querySelector('#qa-host input[type=range]'),bar=input.parentElement,bounds=bar.getBoundingClientRect();return {width:bounds.width,children:[...bar.children].map(e=>{const r=e.getBoundingClientRect();return {tag:e.tagName,left:r.left-bounds.left,right:r.right-bounds.left,width:r.width}})}})()`)
      const pass = result.children.every(e => e.left >= -1 && e.right <= result.width + 1 && e.width > 0)
      report.checks.push({ host, requestedWidth: width, height, pass, ...result })
      const reachable = await js(`(()=>{const e=document.querySelector('#qa-host input[type=range]').parentElement;e.scrollTop=e.scrollHeight;const r=e.getBoundingClientRect(),last=e.lastElementChild.getBoundingClientRect();return {bottom:last.bottom,viewportBottom:r.bottom,scrollTop:e.scrollTop}})()`)
      assert.ok(reachable.bottom <= reachable.viewportBottom + 1, 'Last control cannot be reached by scrolling')
      // The scrubber must still update the frame using the normal input event.
      const scrub = await js(`(()=>{const e=document.querySelector('#qa-host input[type=range]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,e.max);e.dispatchEvent(new Event('input',{bubbles:true}));return {max:e.max,disabled:e.disabled}})()`)
      await js(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`)
      const value = await js(`document.querySelector('#qa-host input[type=range]').value`)
      assert.equal(value, scrub.max); assert.equal(scrub.disabled, false)
      if (host === 'viewer' && width === 160 && height === 320) {
        const image = await win.webContents.capturePage()
        fs.writeFileSync('docs/qa/evidence/race-controls-narrow.png', image.toPNG())
      }
    }
    assert.ok(report.checks.every(c => c.pass), 'Playback controls extend outside the visual')
  } catch (error) { report.error = error.message }
  fs.writeFileSync('docs/qa/evidence/race-controls.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report)); app.exit(report.error ? 1 : 0)
})
