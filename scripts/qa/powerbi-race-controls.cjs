const fs=require('node:fs'),path=require('node:path'),ts=require('typescript')
const {app,BrowserWindow}=require('electron/main')
app.setPath('userData',path.resolve('cache/qa-pbi-race'));app.disableHardwareAcceleration()
const report={scope:'Production Power BI race method in native DOM; chart paint mocked, frame options recorded',checks:[]}
app.whenReady().then(async()=>{
  const win=new BrowserWindow({width:1000,height:700});const js=s=>win.webContents.executeJavaScript(s)
  try {
    await win.loadURL('data:text/html,<html><body><div id="race"></div></body></html>')
    const source=ts.transpileModule(fs.readFileSync('vilsem-renderer/src/visual.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText
    await js(`(()=>{const exports={};const require=n=>n==='echarts/core'?{use(){},init(){return {setOption(o){window.lastOption=o}}}}:n.endsWith('/axisTextConfig.js')?{applyAxisTextConfig:o=>o}:n.endsWith('/applyTooltipConfig.js')?{applyTooltipConfig:o=>o}:{};${source};window.visual=Object.create(exports.Visual.prototype)})()`)
    for(const width of [92,132,212,452])for(const height of [40,280]){
      const result=await js(`(()=>{const area=document.querySelector('#race');area.textContent='';area.style.cssText='width:${width}px;height:${height}px';const root=document.createElement('div');area.append(root);visual.renderBarRace(area,root,{categorical:{categories:[{values:['2024','2025']},{values:['North','South']}],values:[{values:[10,20]}]}},{},{textMuted:'#999',headerBorder:'#555'},true,'#14b8a6');const input=area.querySelector('input'),bar=input.parentElement;bar.scrollTop=bar.scrollHeight;const b=bar.getBoundingClientRect();const children=[...bar.children].map(e=>{const r=e.getBoundingClientRect();return {left:r.left-b.left,right:r.right-b.left,width:r.width,bottom:r.bottom}});input.value='1';input.dispatchEvent(new Event('input',{bubbles:true}));return {width:b.width,bottom:b.bottom,children,frame:window.lastOption.yAxis.data,value:window.lastOption.series[0].data[0].value}})()`)
      report.checks.push({width,height,...result,pass:result.children.every(c=>c.left>=-1&&c.right<=result.width+1&&c.width>0)&&result.children.at(-1).bottom<=result.bottom+1&&result.frame[0]==='South'&&result.value===20})
    }
  }catch(e){report.error=e.message}
  fs.writeFileSync('docs/qa/evidence/powerbi-race-controls.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));app.exit(report.error||report.checks.some(c=>!c.pass)?1:0)
})
