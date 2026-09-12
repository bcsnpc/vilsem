const fs=require('node:fs'),path=require('node:path'),{app,BrowserWindow}=require('electron/main')
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/qa/evidence/bullet-bounds.json'),report={checks:[],events:[],expectedQueryErrors:[]}
app.setPath('userData',path.join(root,'cache/qa-bullet-bounds'));app.disableHardwareAcceleration();app.commandLine.appendSwitch('disable-features','CalculateNativeWinOcclusion')
app.whenReady().then(async()=>{const w=new BrowserWindow({width:1500,height:1000,webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false}}),js=c=>w.webContents.executeJavaScript(c),call=(m,...a)=>js(`window.qaFull.${m}(...${JSON.stringify(a)})`);let scenario='startup';w.webContents.on('console-message',e=>{if(e.level==='error'){if(e.message==='[AppSpec qa] error: QA query failure')report.expectedQueryErrors.push({scenario,message:e.message});else report.events.push({scenario,message:e.message})}});const check=(name,pass,evidence)=>report.checks.push({name,pass,evidence});try{
await w.loadURL('http://127.0.0.1:5173/qa/full-audit.html');await js(`new Promise(r=>{const f=()=>window.qaFullReady?r():requestAnimationFrame(f);f()})`)

for(const host of ['editor','viewer'])for(const [name,config,fixture] of [['upper-bound',{maxValue:500,targetValue:500,targetWidth:10},'standard'],['negative-target',{maxValue:500,targetValue:-100},'negative'],['zero-domain',{maxValue:0,targetValue:0},'zero']]){
 scenario=host+'/'+name;const spec=await call('makeSpec','bullet');Object.assign(spec.visuals[0].config,config);await call('mount','bullet',host,{spec,inspector:true,fixture});await call('settle');
 const r=await js(`(()=>{const marker=document.querySelector('#qa-host [data-format-target="target-marker"]'),track=marker.parentElement,b=track.getBoundingClientRect(),m=marker.getBoundingClientRect(),bar=track.children[1];return {left:m.left-b.left,right:m.right-b.right,markerPosition:marker.style.left,barWidth:bar.style.width,trackWidth:b.width,text:document.querySelector('#qa-host').innerText}})()`);check(scenario,r.left>=-0.5&&r.right<=0.5&&r.markerPosition!==''&&r.barWidth!=='',r);
}
report.complete=true;fs.writeFileSync(out,JSON.stringify(report,null,2));app.exit(report.events.length||report.checks.some(c=>!c.pass)?1:0)
}catch(e){report.fatal=e.stack;fs.writeFileSync(out,JSON.stringify(report,null,2));app.exit(1)}})
