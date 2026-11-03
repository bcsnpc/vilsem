const fs = require('node:fs'), path = require('node:path')
const { app, BrowserWindow } = require('electron/main')
const profile = path.resolve('cache/qa-waffle')
fs.mkdirSync(profile, { recursive: true }); app.setPath('userData', profile); app.disableHardwareAcceleration()
const report = { checks: [] }
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1400, height: 1000, webPreferences: { backgroundThrottling: false } })
  const js = code => win.webContents.executeJavaScript(code)
  const call = (method, ...args) => js(`window.qaFull.${method}(...${JSON.stringify(args)})`)
  try {
    await win.loadURL('http://127.0.0.1:5173/qa/full-audit.html')
    await js(`new Promise((resolve,reject)=>{const end=Date.now()+30000;const f=()=>window.qaFullReady?resolve():Date.now()>end?reject(Error('entry timeout')):requestAnimationFrame(f);f()})`)
    for (const host of ['editor', 'viewer']) for (const values of [[1,1,1],[0,0,0],[25,50,75,100]]) {
      await js(`window.semantica.queryTable=async()=>({rows:${JSON.stringify(values.map((Revenue, i) => ({ 'QA[Category]': 'Category '+i, Revenue })))}});true`)
      const spec = await call('makeSpec', 'waffle'); spec.visuals[0].data.measures = ['Revenue']
      spec.visuals[0].config.customColors = ['#ff0000','#00ff00','#0000ff','#ffff00']
      await call('mount', 'waffle', host, { spec, width: 480, inspector: false })
      const state = await js(`(()=>{const host=document.querySelector('#qa-host'),grid=[...host.querySelectorAll('div')].find(e=>e.style.gridTemplateColumns.includes('repeat(10'));return {text:host.innerText,filled:[...grid.children].filter(e=>['rgb(255, 0, 0)','rgb(0, 255, 0)','rgb(0, 0, 255)','rgb(255, 255, 0)'].includes(e.style.background)).length}})()`)
      report.checks.push({host,values,...state,pass:!state.text.includes('NaN')&&state.filled===(values.some(Boolean)?100:0)})
    }
    for (const host of ['editor','viewer']) for (const width of [120,160,480]) for (const height of [80,320]) {
      const spec = await call('makeSpec','waffle'); spec.visuals[0].data.measures=['Revenue']
      spec.visuals[0].position={x:0,y:0,w:12,h:(height+8)/88}
      await call('mount','waffle',host,{spec,width,inspector:false})
      const state=await js(`(()=>{const host=document.querySelector('#qa-host'),grid=[...host.querySelectorAll('div')].find(e=>e.style.gridTemplateColumns.includes('repeat(10')),layout=grid.parentElement,viewport=layout.parentElement,legend=grid.nextElementSibling;viewport.scrollTop=viewport.scrollHeight;const v=viewport.getBoundingClientRect(),l=legend.getBoundingClientRect();grid.scrollLeft=grid.scrollWidth;const g=grid.getBoundingClientRect(),cell=grid.lastElementChild.getBoundingClientRect();return {legendWithinWidth:l.left>=v.left-1&&l.right<=v.right+1,lastLegendReachable:l.bottom<=v.bottom+1,lastCellReachable:cell.right<=g.right+1,scrollTop:viewport.scrollTop}})()`)
      report.checks.push({host,width,height,...state,pass:state.legendWithinWidth&&state.lastLegendReachable&&state.lastCellReachable})
      if(host==='viewer'&&width===160&&height===320) fs.writeFileSync('docs/qa/evidence/waffle-narrow.png',(await win.webContents.capturePage()).toPNG())
    }
    for(const host of ['editor','viewer'])for(const width of [120,160,480])for(const height of [80,320]){
      await js(`window.semantica.queryTable=async()=>({rows:[{'QA[Category]':'Only',Revenue:42}]});true`)
      const spec=await call('makeSpec','waffle');spec.visuals[0].data.measures=['Revenue'];spec.visuals[0].position={x:0,y:0,w:12,h:(height+8)/88}
      await call('mount','waffle',host,{spec,width,inspector:false})
      const state=await js(`(()=>{const grid=[...document.querySelectorAll('#qa-host div')].find(e=>e.style.gridTemplateColumns.includes('repeat(10')),layout=grid.parentElement,viewport=layout.parentElement;viewport.scrollTop=viewport.scrollHeight;grid.scrollLeft=grid.scrollWidth;const g=grid.getBoundingClientRect(),v=viewport.getBoundingClientRect(),last=grid.lastElementChild.getBoundingClientRect(),label=grid.nextElementSibling.getBoundingClientRect();return {firstCellReachable:grid.firstElementChild.getBoundingClientRect().top>=v.top-1||viewport.scrollTop>0,lastCellReachable:last.right<=g.right+1,labelReachable:label.bottom<=v.bottom+1,gridWithinWidth:g.left>=v.left-1&&g.right<=v.right+1}})()`)
      report.checks.push({host,width,height,singleValue:true,...state,pass:Object.values(state).every(Boolean)})
    }
  } catch (error) { report.error = error.message }
  fs.writeFileSync('docs/qa/evidence/waffle-audit.json', JSON.stringify(report,null,2))
  console.log(JSON.stringify(report)); app.exit(report.error || report.checks.some(c=>!c.pass) ? 1 : 0)
})
