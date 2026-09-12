const fs=require('node:fs'),path=require('node:path'),{app,BrowserWindow}=require('electron/main')
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/qa/evidence',process.argv.includes('--after')?'format-semantics-after.json':'format-semantics-before.json'),report={checks:[],events:[],expectedQueryErrors:[]}
app.setPath('userData',path.join(root,'cache/qa-format-semantics'));app.disableHardwareAcceleration();app.commandLine.appendSwitch('disable-features','CalculateNativeWinOcclusion')
app.commandLine.appendSwitch('disable-renderer-backgrounding');app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.whenReady().then(async()=>{const w=new BrowserWindow({width:1500,height:1000,webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false}}),js=c=>w.webContents.executeJavaScript(c),call=(m,...a)=>js(`window.qaFull.${m}(...${JSON.stringify(a)})`);let scenario='startup';w.webContents.on('console-message',e=>{if(e.level==='error'){if(e.message==='[AppSpec qa] error: QA query failure')report.expectedQueryErrors.push({scenario,message:e.message});else report.events.push({scenario,message:e.message})}});const check=(name,pass,evidence)=>report.checks.push({name,pass,evidence});try{
await w.loadURL('http://127.0.0.1:5173/qa/full-audit.html');await js(`new Promise(r=>{const f=()=>window.qaFullReady?r():requestAnimationFrame(f);f()})`)
const options=()=>js(`(async()=>{const ec=await import('/node_modules/.vite/deps/echarts_core.js');return [...document.querySelectorAll('#qa-host [_echarts_instance_]')].map(e=>{const o=ec.getInstanceByDom(e).getOption();return {axes:[...(o.xAxis||[]),...(o.yAxis||[])].filter(a=>a.show!==false&&a.axisLabel?.show!==false).map(a=>({color:a.axisLabel?.color,fontSize:a.axisLabel?.fontSize,fontFamily:a.axisLabel?.fontFamily})),legends:(o.legend||[]).filter(a=>a.show!==false).map(a=>a.textStyle)}})})()`);
for(const type of await js('window.qaFull.types'))for(const host of ['editor','viewer']){
 scenario=type+'/'+host;await call('mount',type,host,{inspector:true});await call('tab','text');const initial=await options();
 for(const [label,key,value,optionKey,kind]of [['Axis Color','axisTickColor','#d946ef','color','axes'],['Axis Size','axisFontSize',18,'fontSize','axes'],['Axis Font','axisFontFamily','Sora','fontFamily','axes'],['Text Color','legendColor','#d946ef','color','legends'],['Text Size','legendFontSize',18,'fontSize','legends']]){
 const present=await js(`!![...document.querySelectorAll('#qa-inspector span')].find(e=>e.textContent===${JSON.stringify(label)})`);
 if(!present)continue;
 if(!initial.some(c=>c[kind].length)){report.checks.push({name:scenario+'/'+key,pass:true,status:'NOT_APPLICABLE',reason:'Inspector control has no visible matching ECharts element in this fixture; applicability needs review'});continue}
 const baseline=await call('snapshot');
 const wrote=await js(`(()=>{const p=[...document.querySelectorAll('#qa-inspector span')].find(e=>e.textContent===${JSON.stringify(label)}).parentElement,e=p.querySelector('select,input');if(!e)return false;const proto=e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));if(e.tagName!=='SELECT')e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
 await call('settle');const after=await options(),snap=await call('snapshot'),targets=after.flatMap(c=>c[kind]);check(scenario+'/'+key,wrote&&snap.spec.visuals[0].config[key]===value&&targets.length>0&&targets.every(t=>t[optionKey]===value),{requested:value,saved:snap.spec.visuals[0].config[key],rendered:targets});
 await call('setSpec',baseline.spec);const reset=await options();check(scenario+'/'+key+'/reset',JSON.stringify(reset)===JSON.stringify(initial),{initial,reset});
 }
 console.log(scenario);fs.writeFileSync(out,JSON.stringify(report,null,2));
}
report.complete=true;fs.writeFileSync(out,JSON.stringify(report,null,2));app.exit(report.events.length||report.checks.some(c=>!c.pass)?1:0)
}catch(e){report.fatal=e.stack;fs.writeFileSync(out,JSON.stringify(report,null,2));app.exit(1)}})
