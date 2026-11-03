const fs=require('node:fs'),path=require('node:path'),supported=require('@vilsem/core/spec/types')
const {app,BrowserWindow}=require('electron/main')
app.setPath('userData',path.resolve('cache/qa-export-types'));app.disableHardwareAcceleration()
const report={scope:'Every registry type through production inspector export; IPC intercepted, no files saved',checks:[]}
app.whenReady().then(async()=>{
  const win=new BrowserWindow({width:1500,height:1000,webPreferences:{backgroundThrottling:false}});const js=s=>win.webContents.executeJavaScript(s)
  const call=(method,...args)=>js(`window.qaFull.${method}(...${JSON.stringify(args)})`)
  const wait=expression=>js(`new Promise((resolve,reject)=>{const end=Date.now()+10000;const f=()=>${expression}?resolve():Date.now()>end?reject(Error('UI state timeout')):requestAnimationFrame(f);f()})`)
  try {
    await win.loadURL('http://127.0.0.1:5173/qa/full-audit.html');await wait('window.qaFullReady')
    await js(`window.qaExports=[];window.semantica.pbiExportVisualPackage=async p=>{window.qaExports.push(p);return {success:true,path:'QA/test.pbiviz'}};true`)
    for(const type of await js('window.qaFull.types')){
      await call('mount',type,'editor',{inspector:true});await js('window.qaExports=[]')
      await js(`document.querySelector('button[title="Export this visual as a Power BI custom visual (.pbiviz)"]').click()`)
      await wait(`document.body.innerText.includes('Export failed')||document.body.innerText.includes('Exported for Power BI')`)
      const result=await js(`({calls:window.qaExports.length,type:window.qaExports[0]?JSON.parse(window.qaExports[0].spec).type:null,unsupported:document.body.innerText.includes('not supported')})`)
      const expected=supported.includes(type)
      report.checks.push({type,expectedSupported:expected,...result,pass:expected?result.calls===1&&result.type===type:result.calls===0&&result.unsupported})
    }
  }catch(error){report.error=error.message}
  fs.writeFileSync('docs/qa/evidence/export-type-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify({checks:report.checks.length,failed:report.checks.filter(c=>!c.pass),error:report.error}));app.exit(report.error||report.checks.some(c=>!c.pass)?1:0)
})
