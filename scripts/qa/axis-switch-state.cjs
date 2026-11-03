const fs=require('node:fs'),path=require('node:path'),ts=require('typescript')
const {app,BrowserWindow}=require('electron/main')
app.setPath('userData',path.resolve('cache/qa-axis-switch-state'));app.disableHardwareAcceleration()
const report={scope:'Actual Power BI wireAxisPills in Electron DOM; local highlighting only, not host cross-filter acceptance',checks:[]}
app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,webPreferences:{backgroundThrottling:false}})
 try{
  await win.loadURL('data:text/html,<html><body></body></html>')
  const code=ts.transpileModule(fs.readFileSync('vilsem-renderer/src/visual.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText
  const result=await win.webContents.executeJavaScript(`(()=>{
   const exports={},require=n=>n==='echarts/core'?{use(){}}:{};
   ${code}
   document.body.innerHTML='<div class="sbar-axis-pills"><button data-axis-idx="0">Primary</button><button data-axis-idx="1">Alternate</button></div><div data-axis-section="0"><div data-sbar-cat="A">A</div><div data-sbar-cat="B">B</div></div><div data-axis-section="1"><div data-sbar-cat="C" data-sbar-local-selected="1" style="opacity:1">C</div><div data-sbar-cat="D" data-sbar-local-selected="0" style="opacity:0.35">D</div></div>';
   const visual=Object.create(exports.Visual.prototype);visual.root=document.body;visual.wireAxisPills();
   const pills=[...document.querySelectorAll('button')],sections=[...document.querySelectorAll('[data-axis-section]')];
   pills[0].click();pills[1].click();
   return {bars:[...sections[1].children].map(e=>({opacity:e.style.opacity,selected:e.getAttribute('data-sbar-local-selected')})),display:sections.map(e=>e.style.display),active:pills.map(e=>e.getAttribute('data-axis-active'))};
  })()`)
  report.checks.push({name:'Returning to an alternate axis clears selection and every sibling dim',...result,pass:result.bars.every(b=>b.opacity===''&&b.selected==='0')})
  report.checks.push({name:'Axis visibility and active pill remain correct',pass:result.display.join(',')==='none,flex'&&result.active.join(',')==='0,1'})
 }catch(e){report.error=e.stack}
 fs.writeFileSync('docs/qa/evidence/axis-switch-state.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));app.exit(report.error||report.checks.some(c=>!c.pass)?1:0)
})
