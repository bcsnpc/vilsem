const fs=require('node:fs'),path=require('node:path'),{app,BrowserWindow}=require('electron/main')
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/qa/evidence'),report={checks:[],events:[]}
app.setPath('userData',path.join(root,'cache/qa-review-profile'));app.disableHardwareAcceleration();app.commandLine.appendSwitch('disable-features','CalculateNativeWinOcclusion')
app.whenReady().then(async()=>{const win=new BrowserWindow({width:1500,height:1000,webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false}}),js=c=>win.webContents.executeJavaScript(c);try{
await win.loadURL('http://127.0.0.1:5173/qa/full-audit.html');await js(`new Promise(r=>{const c=()=>window.qaFullReady?r():requestAnimationFrame(c);c()})`);win.webContents.debugger.attach('1.3')
for(const type of ['heatmap','sunburst','stacked_area','column','waterfall'])for(const host of ['editor','viewer']){
 await js(`(async()=>{const s=window.qaFull.makeSpec('${type}');s.visuals[0].position={x:0,y:0,w:12,h:(320+8)/88};await window.qaFull.mount('${type}','${host}',{spec:s,width:480,inspector:false})})()`)
 if(type==='sunburst')await js(`new Promise((r,j)=>{const end=performance.now()+10000;const c=()=>document.querySelectorAll('.recharts-pie-label-text').length===4?r():performance.now()>end?j(Error('sunburst labels never settled')):requestAnimationFrame(c);c()})`)
 const metrics=await js(`(()=>{const root=document.getElementById('qa-host');return {text:root.innerText,cells:[...root.querySelectorAll('div[title]')].filter(e=>/North:|South:|East:|West:/.test(e.title)).map(e=>{const b=e.getBoundingClientRect();let p=e.parentElement;const clips=[];while(p&&p!==root){const s=getComputedStyle(p),r=p.getBoundingClientRect();if(s.overflow==='hidden'&&(b.bottom>r.bottom+1||b.top<r.top-1))clips.push({height:r.height,top:r.top,bottom:r.bottom});p=p.parentElement}return {title:e.title,top:b.top,bottom:b.bottom,height:b.height,clips}}),labels:[...root.querySelectorAll('.recharts-pie-label-text')].map(e=>e.textContent)}})()`)
 metrics.labelBounds=await js(`(()=>{return [...document.querySelectorAll('.recharts-pie-label-text')].map(e=>{const b=e.getBoundingClientRect(),s=e.closest('svg').getBoundingClientRect();return {text:e.textContent,bounds:{left:b.left,right:b.right,top:b.top,bottom:b.bottom},svg:{left:s.left,right:s.right,top:s.top,bottom:s.bottom},outside:b.left<s.left||b.right>s.right||b.top<s.top||b.bottom>s.bottom}})})()`)
 metrics.charts=await js('window.qaFull.snapshot().charts')
 report.checks.push({type,host,metrics})
 const img=await win.webContents.debugger.sendCommand('Page.captureScreenshot',{format:'png',fromSurface:true,clip:{x:12,y:12,width:480,height:320,scale:1}});fs.writeFileSync(path.join(out,'screenshots',`${type}-${host}-settled.png`),Buffer.from(img.data,'base64'))
}
report.complete=true;fs.writeFileSync(path.join(out,'review-audit.json'),JSON.stringify(report,null,2));app.exit(0)
}catch(e){report.events.push(e.stack);fs.writeFileSync(path.join(out,'review-audit.json'),JSON.stringify(report,null,2));app.exit(1)}})
