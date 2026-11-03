const fs=require('node:fs'),path=require('node:path'),ts=require('typescript')
const {app,BrowserWindow}=require('electron/main')
app.setPath('userData',path.resolve('cache/qa-pbi-tooltip'));app.disableHardwareAcceleration()
const report={scope:'Production legacy Power BI tooltip in a native Electron viewport',checks:[]}
app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,width:400,height:260,webPreferences:{backgroundThrottling:false}})
 try{
  await win.loadURL('data:text/html,<html><body></body></html>')
  const code=ts.transpileModule(fs.readFileSync('vilsem-renderer/src/visual.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText
  await win.webContents.executeJavaScript(`(()=>{const exports={},require=n=>n==='echarts/core'?{use(){}}:{};${code};window.visual=Object.create(exports.Visual.prototype);visual.root=document.body})()`)
  for(const text of ['Short value', 'LongUnicodeCategory\u6f22\u5b57'.repeat(40),'Multiple rows\n'.repeat(60)]){
   for(const corner of ['top-left','bottom-right']){
    const result=await win.webContents.executeJavaScript(`(()=>{const el=visual.ensureTooltipEl();el.textContent=${JSON.stringify(text)};el.style.display='block';visual.positionTooltip(el,{clientX:${corner==='top-left'?'1':'innerWidth-1'},clientY:${corner==='top-left'?'1':'innerHeight-1'}});const r=el.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight,textPreserved:el.textContent===${JSON.stringify(text)}}})()`)
    report.checks.push({textLength:text.length,corner,...result,pass:result.textPreserved&&result.left>=0&&result.top>=0&&result.right<=result.width&&result.bottom<=result.height})
   }
  }
  const interaction=await win.webContents.executeJavaScript(`(()=>{
   const el=visual.ensureTooltipEl();el.textContent='Long content '.repeat(500);el.style.display='block';
   visual.scheduleTooltipHide();el.dispatchEvent(new MouseEvent('mouseenter'));
   const retained=visual.tooltipHideTimer===null;
   el.focus();el.scrollTop=el.scrollHeight;
   const scrollable=el.scrollTop>0&&getComputedStyle(el).pointerEvents==='auto'&&document.activeElement===el;
   el.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));const dismissed=el.style.display==='none';
   visual.scheduleTooltipHide();visual.destroy();
   return {retained,scrollable,dismissed,disposed:!document.body.contains(el)&&visual.tooltipHideTimer===null};
  })()`)
  for(const [name,pass] of Object.entries(interaction))report.checks.push({name,pass})
 }catch(e){report.error=e.stack}
 fs.writeFileSync('docs/qa/evidence/powerbi-tooltip-bounds.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));app.exit(report.error||report.checks.some(c=>!c.pass)?1:0)
})
