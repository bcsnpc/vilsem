const fs=require('node:fs'),path=require('node:path'),ts=require('typescript')
const {app,BrowserWindow}=require('electron/main')
app.setPath('userData',path.resolve('cache/qa-pbi-title'));app.disableHardwareAcceleration()
const report={scope:'Production Power BI card/header and table in native DOM; shared styling helpers loaded from source',checks:[]}
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,allowJs:true}}).outputText
app.whenReady().then(async()=>{
  const win=new BrowserWindow({width:1000,height:700});const js=s=>win.webContents.executeJavaScript(s)
  win.webContents.on('console-message',e=>{if(e.level==='error')console.error(e.message)})
  try {
    await win.loadURL('data:text/html,<html><body><div id="pbi" style="position:relative;width:480px;height:320px"></div></body></html>')
    const helpers={
      './palettes.js':compile('ui/src/appspec/shared/palettes.js'),
      './appspec/shared/chrome.js':compile('ui/src/appspec/shared/chrome.js'),
      './appspec/shared/chartTitle.js':compile('ui/src/appspec/shared/chartTitle.js'),
      './appspec/getThemeTokens':compile('ui/src/appspec/getThemeTokens.ts'),
    }
    await js(`(()=>{const modules=${JSON.stringify(helpers)};const require=n=>{if(modules[n]){const exports={};new Function('exports','require',modules[n])(exports,require);return exports}return n==='echarts/core'?{use(){}}:{}};const exports={};${compile('vilsem-renderer/src/visual.ts')};window.visual=Object.create(exports.Visual.prototype);visual.root=document.querySelector('#pbi');window.draw=config=>visual.renderPrimitiveChart({categorical:{categories:[],values:[]}},{type:'table',canvasTheme:'dark',config:{title:'Header gyp',...config}})})()`)
    for(const cfg of [{},{titleFontWeight:900,titleUppercase:true,titleFontSize:24,titleFontFamily:'serif',titleColor:'#ff00ff'},{titleFontWeight:300,titleUppercase:false,titleFontSize:12},{showTitle:false},{cardStyle:'plain'}]){
      const state=await js(`(()=>{draw(${JSON.stringify(cfg)});const span=[...document.querySelectorAll('#pbi span')].find(e=>e.textContent==='Header gyp');if(!span)return {present:false};const s=getComputedStyle(span);return {present:true,weight:s.fontWeight,transform:s.textTransform,size:s.fontSize,family:s.fontFamily,color:s.color}})()`)
      const expectedVisible=cfg.showTitle!==false&&cfg.cardStyle!=='plain'
      const pass=state.present===expectedVisible&&(!expectedVisible||(state.weight===String(cfg.titleFontWeight??600)&&state.transform===(cfg.titleUppercase?'uppercase':'none')&&state.size===`${cfg.titleFontSize||12}px`&&(!cfg.titleFontFamily||state.family===cfg.titleFontFamily)&&(!cfg.titleColor||state.color==='rgb(255, 0, 255)')))
      report.checks.push({config:cfg,...state,pass})
    }
  }catch(error){report.error=error.message}
  fs.writeFileSync('docs/qa/evidence/powerbi-title.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));app.exit(report.error||report.checks.some(c=>!c.pass)?1:0)
})
