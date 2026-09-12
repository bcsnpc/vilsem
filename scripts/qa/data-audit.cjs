const fs=require('node:fs'),path=require('node:path'),{app,BrowserWindow}=require('electron/main')
const root=path.resolve(__dirname,'../..'),report={scope:'All registered production hosts with deterministic data; field invalidation and non-data navigation',checks:[],events:[]}
app.setPath('userData',path.join(root,'cache/qa-data-profile'));app.disableHardwareAcceleration();app.commandLine.appendSwitch('disable-features','CalculateNativeWinOcclusion')
const output=path.join(root,'docs/qa/evidence',process.argv.includes('--after')?'data-audit-after.json':'data-audit-before.json')
app.whenReady().then(async()=>{const win=new BrowserWindow({width:1500,height:1000,webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false}}),js=c=>win.webContents.executeJavaScript(c),call=(m,...args)=>js(`window.qaFull.${m}(...${JSON.stringify(args)})`);let scenario='startup';win.webContents.on('console-message',e=>{if(e.level==='error')report.events.push({scenario,message:e.message})});try{
await win.loadURL('http://127.0.0.1:5173/qa/full-audit.html');await js(`new Promise(r=>{const c=()=>window.qaFullReady?r():requestAnimationFrame(c);c()})`)
const types=await js('window.qaFull.types')
for(const type of types){for(const host of ['editor','viewer']){
 scenario=type+'/'+host;await call('mount',type,host,{inspector:false})
 if(['nav_button','text_box','shape','image','divider'].includes(type)){const r=await call('snapshot');report.checks.push({type,host,name:'non-data visual makes no query',pass:r.requests.length===0});if(type==='nav_button'&&host==='viewer'){await js(`document.querySelector('#qa-host button').click()`);const r=await call('snapshot');report.checks.push({type,host,name:'page navigation dispatch',pass:r.navigation==='page2'})}continue}
 let r=await call('setData',{measures:['Cost']});report.checks.push({type,host,name:'replace measure queries Cost',pass:r.requests.some(q=>q.params.measures?.length===1&&q.params.measures[0]==='Cost'),requests:r.requests})
 r=await call('setData',{filters:[{table:'QA',column:'Category',value:'North'}]});report.checks.push({type,host,name:'filter edit requeries North',pass:r.requests.some(q=>q.params.filters?.['QA[Category]']==='North'),requests:r.requests})
 r=await call('setData',{measures:[]});report.checks.push({type,host,name:'remove measures clears chart data',pass:r.charts.every(c=>c.series.every(s=>!s.data?.length)),charts:r.charts})
 r=await call('setData',{measures:['Revenue']});report.checks.push({type,host,name:'restore measures requeries Revenue',pass:r.requests.some(q=>q.params.measures?.includes('Revenue')),requests:r.requests})
}console.log(type);fs.writeFileSync(output,JSON.stringify(report,null,2))}
report.complete=true;fs.writeFileSync(output,JSON.stringify(report,null,2));app.exit(report.checks.some(c=>!c.pass)||report.events.length?1:0)
}catch(e){report.events.push({fatal:e.stack,scenario});fs.writeFileSync(output,JSON.stringify(report,null,2));app.exit(1)}})
