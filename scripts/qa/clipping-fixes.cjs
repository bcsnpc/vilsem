const fs=require('node:fs'),path=require('node:path'),{app,BrowserWindow}=require('electron/main')
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/qa/evidence',process.argv.includes('--after')?'clipping-fixes-after.json':'clipping-fixes-before.json'),report={checks:[],events:[],expectedQueryErrors:[]}
app.setPath('userData',path.join(root,'cache/qa-clipping-fixes'));app.disableHardwareAcceleration();app.commandLine.appendSwitch('disable-features','CalculateNativeWinOcclusion')
app.whenReady().then(async()=>{const w=new BrowserWindow({width:1500,height:1000,webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false}}),js=c=>w.webContents.executeJavaScript(c),call=(m,...a)=>js(`window.qaFull.${m}(...${JSON.stringify(a)})`);let scenario='startup';w.webContents.on('console-message',e=>{if(e.level==='error'){if(e.message==='[AppSpec qa] error: QA query failure')report.expectedQueryErrors.push({scenario,message:e.message});else report.events.push({scenario,message:e.message})}});const check=(name,pass,evidence)=>report.checks.push({name,pass,evidence});try{
await w.loadURL('http://127.0.0.1:5173/qa/full-audit.html');await js(`new Promise(r=>{const f=()=>window.qaFullReady?r():requestAnimationFrame(f);f()})`)
w.webContents.debugger.attach('1.3');
for(const host of ['editor','viewer'])for(const type of ['column','waterfall','sunburst']){
 scenario=host+'/'+type;const spec=await call('makeSpec',type);spec.visuals[0].position={x:0,y:0,w:12,h:(320+8)/88};await call('mount',type,host,{spec,width:480,inspector:false});
 if(type==='sunburst')await js(`new Promise((r,j)=>{const end=performance.now()+10000;const f=()=>document.querySelectorAll('.recharts-pie-label-text').length===4?r():performance.now()>end?j(Error('labels not ready')):requestAnimationFrame(f);f()})`);
 const labels=await js(`(async()=>{
 const root=document.getElementById('qa-host');
 if('${type}'==='column'){
  const ec=await import('/node_modules/.vite/deps/echarts_core.js');const e=root.querySelector('[_echarts_instance_]'),c=ec.getInstanceByDom(e);
  return c.getZr().storage.getDisplayList(true).filter(e=>e.style?.text==='100').map(e=>{const r=e.getBoundingRect().clone();if(e.transform)r.applyTransform(e.transform);return {text:e.style.text,x:r.x,y:r.y,width:r.width,height:r.height,visible:r.y>=0&&r.y+r.height<=c.getHeight()&&r.x>=0&&r.x+r.width<=c.getWidth()}})
 }
 const elements='${type}'==='sunburst'?[...root.querySelectorAll('.recharts-pie-label-text')]:[...root.querySelectorAll('div')].filter(e=>e.children.length===0&&['25','50','75','100','250'].includes(e.textContent));
 return elements.map(e=>{const r=e.getBoundingClientRect();let p=e.parentElement,visible=true;while(p&&p!==root){const s=getComputedStyle(p),b=p.getBoundingClientRect();if((['hidden','clip'].includes(s.overflowY)||p.tagName.toLowerCase()==='svg')&&(r.top<b.top-1||r.bottom>b.bottom+1||r.left<b.left-1||r.right>b.right+1))visible=false;p=p.parentElement}return {text:e.textContent,x:r.x,y:r.y,width:r.width,height:r.height,visible}})
 })()`);
 check(scenario+' labels fully inside clipping boundaries',labels.length>0&&labels.every(l=>l.visible),labels);
 const img=await w.webContents.debugger.sendCommand('Page.captureScreenshot',{format:'png',fromSurface:true,clip:{x:12,y:12,width:480,height:320,scale:1}});fs.writeFileSync(path.join(root,'docs/qa/evidence/screenshots',type+'-'+host+'-clipping-'+(process.argv.includes('--after')?'after':'before')+'.png'),Buffer.from(img.data,'base64'));
}
report.complete=true;fs.writeFileSync(out,JSON.stringify(report,null,2));app.exit(report.events.length||report.checks.some(c=>!c.pass)?1:0)
}catch(e){report.fatal=e.stack;fs.writeFileSync(out,JSON.stringify(report,null,2));app.exit(1)}})
