const fs=require('node:fs'),path=require('node:path'),{app,BrowserWindow}=require('electron/main')
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/qa/evidence/detailed-formatting.json'),report={checks:[],events:[],expectedQueryErrors:[]}
app.setPath('userData',path.join(root,'cache/qa-detailed-formatting'));app.disableHardwareAcceleration();app.commandLine.appendSwitch('disable-features','CalculateNativeWinOcclusion')
app.whenReady().then(async()=>{const w=new BrowserWindow({width:1500,height:1000,webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false}}),js=c=>w.webContents.executeJavaScript(c),call=(m,...a)=>js(`window.qaFull.${m}(...${JSON.stringify(a)})`);let scenario='startup';w.webContents.on('console-message',e=>{if(e.level==='error'){if(e.message==='[AppSpec qa] error: QA query failure')report.expectedQueryErrors.push({scenario,message:e.message});else report.events.push({scenario,message:e.message})}});const check=(name,pass,evidence)=>report.checks.push({name,pass,evidence});try{
await w.loadURL('http://127.0.0.1:5173/qa/full-audit.html');await js(`new Promise(r=>{const f=()=>window.qaFullReady?r():requestAnimationFrame(f);f()})`)

const schemas=await js(`(async()=>{const s=await import('/src/appspec/shared/detailedCardSchemas.js');const t=await import('/src/appspec/visuals/CompactTextBox.jsx');return {bullet:s.bulletFormatting,metric_tile:s.metricFormatting,stat_card:s.statFormatting,progress:s.progressFormatting,text_box:t.default.schema.slice(0,4)}})()`);
for(const host of ['editor','viewer'])for(const [type,fields] of Object.entries(schemas)){
 console.log(type+'/'+host);
 for(const f of fields){
 scenario=type+'/'+host+'/'+f.key;
 const spec=await call('makeSpec',type);Object.assign(spec.visuals[0].config,{subtitle:'Comparison context',maxValue:500});
 await call('mount',type,host,{spec,inspector:true,fixture:f.key==='trendDownColor'?'negative':'standard'});await call('tab',type==='text_box'?'text':f.tab||'style');await call('settle');
 const capture=()=>js(`document.querySelector('#qa-host').innerHTML`),before=await capture();
 const value=f.type==='boolean'?!f.default:f.type==='color'?'#123456':f.key==='maxValue'?1000:f.key==='targetValue'?100:f.key==='trendDecimals'?3:f.default===undefined?500:Number(Math.min(f.max,(f.default||0)+(f.step||1)*2).toFixed(4));
 await js(`(()=>{const label=[...document.querySelectorAll('#qa-inspector span')].find(e=>e.textContent===${JSON.stringify(f.label)});if(!label)throw Error('Missing control '+${JSON.stringify(f.label)});const e=label.parentElement.querySelector('input,button');if(typeof ${JSON.stringify(value)}==='boolean'){e.click();return}Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))})()`);
 await call('settle');const saved=(await call('snapshot')).spec,after=await capture();check(scenario+' saves and changes rendered DOM',saved.visuals[0].config[f.key]===value&&after!==before,{key:f.key,value,saved:saved.visuals[0].config[f.key],renderChanged:after!==before});
 await call('mount',type,host,{spec:saved,inspector:true,fixture:f.key==='trendDownColor'?'negative':'standard'});await call('settle');check(scenario+' retained on remount',(await call('snapshot')).spec.visuals[0].config[f.key]===value,{value});
 }
}
report.complete=true;fs.writeFileSync(out,JSON.stringify(report,null,2));app.exit(report.events.length||report.checks.some(c=>!c.pass)?1:0)
}catch(e){report.fatal=e.stack;fs.writeFileSync(out,JSON.stringify(report,null,2));app.exit(1)}})
