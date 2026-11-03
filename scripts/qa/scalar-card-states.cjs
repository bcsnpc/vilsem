const fs=require('node:fs'),path=require('node:path')
const {app,BrowserWindow}=require('electron/main')
app.setPath('userData',path.resolve('cache/qa-scalar-states'));app.disableHardwareAcceleration()
const report={scope:'Actual editor/viewer scalar cards with deterministic query transport',checks:[]}
app.whenReady().then(async()=>{
 const win=new BrowserWindow({width:1000,height:700,show:false,webPreferences:{backgroundThrottling:false}}),js=s=>win.webContents.executeJavaScript(s)
 try{
  await win.loadURL('http://127.0.0.1:5173/qa/full-audit.html')
  await js(`new Promise((resolve,reject)=>{const end=Date.now()+30000;const check=()=>window.qaFullReady?resolve():Date.now()>end?reject(Error('QA startup timeout')):requestAnimationFrame(check);check()})`)
  for(const type of (process.argv.includes('--null-only')?[]:['stat_card','metric_tile']))for(const host of ['editor','viewer'])for(const fixture of ['error','standard','zero']){
   await js(`qaFull.mount('${type}','${host}',{fixture:'${fixture}',width:480,inspector:false})`)
   const text=await js(`document.querySelector('#qa-host').innerText`)
   const titleCount=text.toLowerCase().split(('QA '+type).toLowerCase()).length-1
   report.checks.push({type,host,fixture,titleCount,pass:titleCount===1})
   report.checks.push({type,host,fixture,text,pass:fixture==='error'?text.includes('QA query failure'):!text.includes('QA query failure')&&text.includes(fixture==='zero'?'0':'250')})
  }
  await js(`window.semantica.query=async()=>({data:{Revenue:null,Cost:100}});true`)
  for(const host of ['editor','viewer']) {
   await js(`qaFull.mount('stat_card','${host}',{width:480,inspector:false})`)
   const state=await js(`(()=>{const el=document.querySelector('#qa-host');return {text:el.innerText,comparison:!!el.querySelector('[data-format-target="comparison"]')}})()`)
   report.checks.push({host,nullCurrent:true,...state,pass:!state.comparison&&!state.text.includes('NaN')})
  }
 }catch(e){report.error=e.stack}
 fs.writeFileSync('docs/qa/evidence/'+(process.argv.includes('--null-only')?'scalar-card-null':'scalar-card-states')+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));app.exit(report.error||report.checks.some(c=>!c.pass)?1:0)
})
