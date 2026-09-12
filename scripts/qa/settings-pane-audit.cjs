const fs=require('node:fs'),path=require('node:path'),{app,BrowserWindow}=require('electron/main')
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/qa/evidence/settings-pane-audit.json'),report={checks:[],events:[],expectedQueryErrors:[]}
app.setPath('userData',path.join(root,'cache/qa-settings-pane'));app.disableHardwareAcceleration();app.commandLine.appendSwitch('disable-features','CalculateNativeWinOcclusion')
app.whenReady().then(async()=>{const w=new BrowserWindow({width:1500,height:1000,webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false}}),js=c=>w.webContents.executeJavaScript(c),call=(m,...a)=>js(`window.qaFull.${m}(...${JSON.stringify(a)})`);let scenario='startup';w.webContents.on('console-message',e=>{if(e.level==='error'){if(e.message==='[AppSpec qa] error: QA query failure')report.expectedQueryErrors.push({scenario,message:e.message});else report.events.push({scenario,message:e.message})}});const check=(name,pass,evidence)=>report.checks.push({name,pass,evidence});try{
await w.loadURL('http://127.0.0.1:5173/qa/full-audit.html');await js(`new Promise(r=>{const f=()=>window.qaFullReady?r():requestAnimationFrame(f);f()})`)
report.inventory=[];
for(const type of await js('window.qaFull.types')){
 scenario=type;const initial=await call('mount',type,'editor',{inspector:true}),cap=await js(`(async()=> (await import('/src/appspec/shared/settingsCapabilities.js')).settingsCapabilities('${type}'))()`),tabs={};
 for(const tab of ['data','style','text','layout','ai']){await call('tab',tab);tabs[tab]=await js(`(()=>{const root=document.getElementById('qa-inspector');return {panels:[...root.querySelectorAll('[data-settings-panel]')].map(e=>e.dataset.settingsPanel),text:root.innerText,controls:[...root.querySelectorAll('input,select,textarea')].map(e=>({type:e.type,value:e.value}))}})()`)}
 const end=await call('snapshot');check(type+' browsing settings preserves spec',JSON.stringify(initial.spec)===JSON.stringify(end.spec));
 check(type+' axes applicability',tabs.text.panels.includes('Axis & Labels')===cap.axisText,tabs.text.panels);
 check(type+' excludes unused header paint',!tabs.text.panels.includes('Card Header'));
 if(!cap.kpiFeatures)check(type+' no unrelated KPI feature panel',!tabs.style.panels.includes('Features'),tabs.style.panels);
 if(type==='gauge')check('gauge scale and arc settings reachable',tabs.style.text.includes('Min value')&&tabs.style.text.includes('Arc width (px)'));
 if(type==='progress')check('progress schema settings reachable',tabs.style.text.includes('Bar height'));
 if(type==='text_box')check('text box formatting in Text only',tabs.text.panels.includes('Text formatting')&&!tabs.style.panels.includes('Text formatting'));
 if(tabs.style.panels.includes('Colors & container')) {check(type+' shared appearance heading is distinct',tabs.style.panels.filter(p=>p==='Colors & container').length===1);await call('tab','style');const swatches=await js(`Array.from(document.querySelectorAll('#qa-inspector button[title^="Color scheme:"]')).map(e=>({label:e.getAttribute('aria-label'),title:e.title,type:e.type}))`);check(type+' palette swatches have accessible names',swatches.length>0&&swatches.every(s=>s.label===s.title&&s.type==='button'),swatches)}
 report.inventory.push({type,capabilities:cap,tabs});console.log(type)
}
report.complete=true;fs.writeFileSync(out,JSON.stringify(report,null,2));app.exit(report.events.length||report.checks.some(c=>!c.pass)?1:0)
}catch(e){report.fatal=e.stack;fs.writeFileSync(out,JSON.stringify(report,null,2));app.exit(1)}})
