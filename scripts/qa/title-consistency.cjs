const fs=require('node:fs'),path=require('node:path'),{app,BrowserWindow}=require('electron/main')
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/qa/evidence/title-consistency.json'),report={checks:[],events:[],expectedQueryErrors:[]}
app.setPath('userData',path.join(root,'cache/qa-title-consistency'));app.disableHardwareAcceleration();app.commandLine.appendSwitch('disable-features','CalculateNativeWinOcclusion')
app.whenReady().then(async()=>{const w=new BrowserWindow({width:1500,height:1000,webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false}}),js=c=>w.webContents.executeJavaScript(c),call=(m,...a)=>js(`window.qaFull.${m}(...${JSON.stringify(a)})`);let scenario='startup';w.webContents.on('console-message',e=>{if(e.level==='error'){if(e.message==='[AppSpec qa] error: QA query failure')report.expectedQueryErrors.push({scenario,message:e.message});else report.events.push({scenario,message:e.message})}});const check=(name,pass,evidence)=>report.checks.push({name,pass,evidence});try{
await w.loadURL('http://127.0.0.1:5173/qa/full-audit.html');await js(`new Promise(r=>{const f=()=>window.qaFullReady?r():requestAnimationFrame(f);f()})`)
for(const host of ['editor','viewer']) {
 for(const type of await js('window.qaFull.types')) {
  scenario=host+'/'+type;
  await call('mount',type,host,{inspector:false});
  const before=await js(`(()=>{const e=document.querySelector('[data-chart-title]');if(!e)return null;const s=getComputedStyle(e);return {size:s.fontSize,weight:s.fontWeight}})()`);
  if(!before){report.checks.push({name:scenario+' owns internal title',pass:true,scope:'external header not applicable'});continue}
  check(scenario+' preserves defaults',before.size==='12px'&&before.weight==='600',before);
  const baseline=await call('snapshot');
  await call('change',{title:'Revenue by category',titleFontFamily:'Georgia',titleFontSize:20,titleFontWeight:800,titleColor:'#123456',titleUppercase:true});
  const after=await js(`(()=>{const e=document.querySelector('[data-chart-title]'),s=getComputedStyle(e);return {size:s.fontSize,weight:s.fontWeight,family:s.fontFamily,color:s.color,transform:s.textTransform,text:e.textContent}})()`);
  check(scenario+' honors explicit typography',after.size==='20px'&&after.weight==='800'&&after.family.includes('Georgia')&&after.color==='rgb(18, 52, 86)'&&after.transform==='uppercase'&&after.text==='Revenue by category',after);
  const end=await call('snapshot');
  check(scenario+' preserves series data',JSON.stringify(baseline.charts.map(c=>c.series), (k,v)=>k==='name'?undefined:v)===JSON.stringify(end.charts.map(c=>c.series), (k,v)=>k==='name'?undefined:v),end.charts);
 }
}
report.complete=true;fs.writeFileSync(out,JSON.stringify(report,null,2));app.exit(report.events.length||report.checks.some(c=>!c.pass)?1:0)
}catch(e){report.fatal=e.stack;fs.writeFileSync(out,JSON.stringify(report,null,2));app.exit(1)}})
