const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{app,BrowserWindow}=require('electron/main')
const root=path.resolve(__dirname,'../..'),profile=fs.mkdtempSync(path.join(root,'cache/qa-persistence-ui-')),out=path.join(root,'docs/qa/evidence/persistence-ui.json')
app.setPath('userData',profile);process.env.SEMANTICA_DATA_DIR=profile;app.disableHardwareAcceleration();app.commandLine.appendSwitch('disable-features','CalculateNativeWinOcclusion')
const report={scope:'Actual Home, production dashboard IPC and isolated disk database',checks:[]}
app.whenReady().then(async()=>{let win;try{
const db=require(path.join(root,'src/cache/sqlite.js'));await db.initCache();const a=db.saveAppSpec('QA A','qa',{title:'A',visuals:[]}),b=db.saveAppSpec('QA B','qa',{title:'B',visuals:[]});require(path.join(root,'electron/ipc/dashboard.js')).register()
win=new BrowserWindow({width:1400,height:900,webPreferences:{preload:path.join(__dirname,'persistence-preload.cjs'),contextIsolation:true,sandbox:true,backgroundThrottling:false}})
const js=c=>win.webContents.executeJavaScript(c),wait=c=>js(`new Promise((r,j)=>{const end=performance.now()+10000;const f=()=>(${c})?r():performance.now()>end?j(Error('Timeout '+${JSON.stringify(c)})):requestAnimationFrame(f);f()})`)
await win.loadURL('http://127.0.0.1:5173/qa/full-audit.html');await wait('window.qaFullReady')
await js(`(async()=>{const {default:R}=await import('/node_modules/.vite/deps/react.js'),{default:DOM}=await import('/node_modules/.vite/deps/react-dom_client.js'),{default:Home}=await import('/src/pages/Home.jsx');Object.assign(window.semantica,window.qaPersistence);DOM.createRoot(document.getElementById('qa-root')).render(R.createElement(Home,{onOpenProject:p=>window.qaOpened=p}))})()`)
await wait(`document.body.innerText.includes('QA B')`)
await js(`(()=>{const e=[...document.querySelectorAll('*')].find(e=>e.textContent==='QA B');e.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:300,clientY:300}))})()`)
await wait(`[...document.querySelectorAll('button')].some(b=>b.textContent==='Rename')`)
await js(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Rename').click()`)
await wait(`document.querySelector('input[value="QA B"]')`)
const write=value=>js(`(()=>{const e=document.querySelector('input[value="QA B"]')||[...document.querySelectorAll('input')].at(-1);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`)
await write('QA A');await js(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Rename').click()`);await wait(`document.querySelector('[role="alert"]')`)
assert.match(await js(`document.querySelector('[role="alert"]').textContent`),/already exists/);report.checks.push({name:'collision remains in dialog with actionable error',pass:true})
assert.equal(db.getAppSpecs('qa').find(p=>p.id===b).name,'QA B');report.checks.push({name:'collision leaves disk identities intact',pass:true})
await write('QA C');await js(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Rename').click()`);await wait(`document.body.innerText.includes('QA C')&&!document.body.innerText.includes('Rename project')`)
await js(`window.qaPersistence.saveAppSpec({name:'QA C',datasetId:'qa',spec:{title:'Edited B',visuals:[]}})`);await db.initCache();assert.equal(db.getAppSpecs('qa').find(p=>p.id===a).spec.title,'A');assert.equal(db.getAppSpecs('qa').find(p=>p.id===b).spec.title,'Edited B');report.checks.push({name:'renamed project saves across IPC and reload without overwriting peer',pass:true})
await js(`document.querySelector('[aria-label="Delete QA C"]').click()`);await wait(`document.querySelector('[role="dialog"]')`);
assert.ok(db.getAppSpecs('qa').some(p=>p.id===b));await js(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Cancel').click()`);await wait(`!document.querySelector('[role="dialog"]')`);assert.ok(db.getAppSpecs('qa').some(p=>p.id===b));report.checks.push({name:'cancel deletion preserves disk project',pass:true});
await js(`document.querySelector('[aria-label="Delete QA C"]').click()`);await wait(`document.querySelector('[role="dialog"]')`);await js(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Delete project').click()`);await wait(`!document.querySelector('[aria-label="Delete QA C"]')`);await db.initCache();assert.ok(!db.getAppSpecs('qa').some(p=>p.id===b));assert.equal(db.getAppSpecs('qa').find(p=>p.id===a).spec.title,'A');report.checks.push({name:'confirmed deletion persists across reload and preserves peer',pass:true});
report.complete=true;fs.writeFileSync(out,JSON.stringify(report,null,2));app.exit(0)
}catch(e){report.fatal=e.stack;if(win)report.body=await win.webContents.executeJavaScript('document.body.innerText');fs.writeFileSync(out,JSON.stringify(report,null,2));app.exit(1)}})
