const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const {app,BrowserWindow}=require('electron/main')
app.setPath('userData',path.resolve('cache/qa-axis-number'));app.disableHardwareAcceleration()
const report={checks:[],events:[]}
app.whenReady().then(async()=>{
  const win=new BrowserWindow({width:1400,height:900,webPreferences:{backgroundThrottling:false}})
  win.webContents.on('console-message',e=>{if(e.level==='error')report.events.push(e.message)})
  const js=s=>win.webContents.executeJavaScript(s),call=(m,...args)=>js(`window.qaFull.${m}(...${JSON.stringify(args)})`)
  try{
    await win.loadURL('http://127.0.0.1:5173/qa/full-audit.html')
    await js(`new Promise((r,j)=>{const end=Date.now()+30000;const f=()=>window.qaFullReady?r():Date.now()>end?j(Error('Entry timeout')):requestAnimationFrame(f);f()})`)
    for(const type of ['bar','column','line','area','scatter','bubble'])for(const tiny of [false,true]){
      const rows=[1130,429,269].map((v,i)=>({'QA[Category]':['North','South','East'][i],Revenue:tiny?v/1e7:v,Cost:tiny?v/2e7:v/2,Units:10+i}))
      await js(`window.semantica.queryTable=async()=>({rows:${JSON.stringify(rows)}});true`)
      const spec=await call('makeSpec',type);Object.assign(spec.visuals[0].config,{showXAxis:true,showYAxis:true,secondaryAxisEnabled:['line','area'].includes(type)})
      await call('mount',type,'viewer',{spec,inspector:false})
      const axes=await js(`(()=>{const c=qaFull.getCharts()[0],o=c.getOption(),out=[];for(const key of ['xAxis','yAxis'])for(let i=0;i<(o[key]||[]).length;i++){if(o[key][i].type!=='value')continue;out.push({key,index:i,labels:c.getModel().getComponent(key,i).axis.getViewLabels().map(l=>l.formattedLabel)})}return out})()`)
      assert.ok(axes.length,`${type}: value axes exist`)
      for(const axis of axes){assert.ok(axis.labels.length>1);assert.equal(new Set(axis.labels).size,axis.labels.length,`${type}/${tiny}: ${axis.labels}`)}
      report.checks.push({type,tiny,axes,pass:true})
      if(type==='line'&&!tiny)fs.writeFileSync('docs/qa/evidence/axis-number-line-after.png',(await win.webContents.capturePage()).toPNG())
    }
  }catch(e){report.error=e.stack}
  fs.writeFileSync('docs/qa/evidence/axis-number.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));app.exit(report.error||report.events.length?1:0)
})
