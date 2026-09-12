const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const {app,BrowserWindow}=require('electron/main')
const root=path.resolve(__dirname,'../..'),report={at:new Date().toISOString(),scope:'Native Electron grouped/stacked/bar/column drill interaction; production viewer with deterministic query transport',checks:[]}
app.setPath('userData',path.join(root,'cache/qa-grouped-drill'));app.disableHardwareAcceleration()
app.commandLine.appendSwitch('disable-features','CalculateNativeWinOcclusion')
app.whenReady().then(async()=>{
 const win=new BrowserWindow({width:1500,height:1000,webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false}})
 const js=c=>win.webContents.executeJavaScript(c),call=(m,...a)=>js(`window.qaFull.${m}(...${JSON.stringify(a)})`)
 async function click(p){for(const type of ['mouseMove','mouseDown','mouseUp'])win.webContents.sendInputEvent({type,x:Math.round(p.x),y:Math.round(p.y),...(type==='mouseMove'?{}:{button:'left',clickCount:1})});await call('settle')}
 async function mark(){return js(`(async()=>{const ec={getInstanceByDom:el=>window.qaFull.getCharts().find(c=>c.getDom()===el)},el=document.querySelector('#qa-host [_echarts_instance_]'),c=ec.getInstanceByDom(el),p=c.getModel().getSeriesByIndex(0).getData().getItemLayout(0),r=el.getBoundingClientRect();return{x:r.x+p.x+p.width/2,y:r.y+p.y+p.height/2}})()`)}
 async function back(style){const p=await js(`(()=>{const b=[...document.querySelectorAll('#qa-host button')].find(b=>${style==='expand'?"b.innerText==='Collapse'":style==='panel'?"/close/i.test(b.title+' '+b.getAttribute('aria-label'))":"b.title==='Drill up'"});if(!b)throw Error('Missing return control');const r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await click(p)}
 try{
 await win.loadURL('http://127.0.0.1:5173/qa/full-audit.html');await js(`new Promise(r=>{const f=()=>window.qaFullReady?r():requestAnimationFrame(f);f()})`)
 for(const type of ['grouped_bar','stacked_bar','bar','column'])for(const style of ['replace','expand','panel','off']){
  const name=type+'/'+style
  try{
   const spec=await call('makeSpec',type);spec.visuals[0].data.drill=[{table:'QA',column:'Category'},{table:'QA',column:'Product'}];spec.visuals[0].config.drillStyle=style
   spec.visuals.push({id:'other',type:'kpi',position:{x:8,y:0,w:4,h:4},data:{measures:['Revenue']},config:{animations:false,countUp:false}})
   await call('mount',type,'viewer',{spec,inspector:false});const before=await call('snapshot');await click(await mark());const after=await call('snapshot')
   if(style==='off') {assert.equal(after.requests.filter(q=>q.method==='query').at(-1)?.params.filters?.['QA[Category]'],'North');await click(await mark());assert.deepEqual((await call('snapshot')).requests.filter(q=>q.method==='query').at(-1)?.params.filters,{})}
   else {
    assert.ok(after.requests.some(q=>q.params.groupBy?.includes('QA[Product]')),'Child dimension not requested')
    if(style==='replace'||style==='panel')assert.ok(after.requests.some(q=>q.params.groupBy?.includes('QA[Product]')&&q.params.filters?.['QA[Category]']==='North'),'Ancestor filter missing')
    if(style==='expand')assert.ok(after.text.includes('Collapse'),'Expansion control missing')
    await back(style)
    const restored=await call('snapshot');assert.ok(!restored.text.includes('Collapse'),'Expansion not cleared')
    assert.deepEqual(restored.charts.map(c=>c.series.map(s=>s.data)),before.charts.map(c=>c.series.map(s=>s.data)),'Main chart did not restore original data')
   }
   report.checks.push({name,status:'PASS',queries:after.requests})
  }catch(e){report.checks.push({name,status:'FAIL',message:e.message})}
  console.log(JSON.stringify(report.checks.at(-1)));fs.writeFileSync(path.join(root,'docs/qa/evidence/grouped-drill.json'),JSON.stringify(report,null,2))
 }
 report.complete=true
 }catch(e){report.fatal=e.stack}
 fs.writeFileSync(path.join(root,'docs/qa/evidence/grouped-drill.json'),JSON.stringify(report,null,2));app.exit(report.fatal||report.checks.some(c=>c.status==='FAIL')?1:0)
})
