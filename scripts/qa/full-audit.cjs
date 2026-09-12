const fs=require('node:fs'),path=require('node:path')
const {app,BrowserWindow}=require('electron/main')
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/qa/evidence')
const profile=path.join(root,'cache/qa-full-profile')
fs.mkdirSync(profile,{recursive:true});fs.mkdirSync(out,{recursive:true})
app.setPath('userData',profile);app.disableHardwareAcceleration()
const report={scope:'Actual editor/viewer/inspector with synthetic transport; no live services',properties:[],hosts:[],workflows:[],events:[],progress:'starting'}
const persist=()=>fs.writeFileSync(path.join(out,'full-audit.json'),JSON.stringify(report,null,2))
let win
const js=code=>win.webContents.executeJavaScript(code)
const call=(method,...args)=>js(`window.qaFull.${method}(...${JSON.stringify(args)})`)
const mark=progress=>{report.progress=progress;persist();console.log(progress)}
app.whenReady().then(async()=>{
  win=new BrowserWindow({width:1500,height:1000,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}})
  win.webContents.on('console-message',event=>{if(event.level==='error')report.events.push({scenario:report.progress,message:event.message})})
  win.webContents.on('render-process-gone',(_e,d)=>{report.events.push({crash:d});persist();app.exit(1)})
  try{
    await win.loadURL('http://127.0.0.1:5173/qa/full-audit.html')
    await js(`new Promise((resolve,reject)=>{const end=performance.now()+30000;const check=()=>window.qaFullReady?resolve(true):performance.now()>end?reject(Error('QA entry timeout')):requestAnimationFrame(check);check()})`)
    const types=await js('window.qaFull.types')
    const selected=process.argv.includes('--probe')?['bar']:types
    for(const type of selected){
      for(const host of ['editor','viewer']){
        mark(`host ${type} ${host}`)
        report.hosts.push({type,host,scenario:'standard',result:await call('mount',type,host,{inspector:false})})
      }
      for(const variant of ['default','expanded']){
        mark(`properties ${type} ${variant}`)
        report.properties.push(...await call('properties',type,variant))
        persist()
      }
    }
    // Regression probes retain the host instance so its query invalidation is exercised.
    for(const host of ['editor','viewer']){
      mark(`workflows ${host}`)
      report.workflows.push({host,name:'initial',result:await call('mount','bar',host)})
      report.workflows.push({host,name:'replace-measure',result:await call('setData',{measures:['Cost']})})
      report.workflows.push({host,name:'change-filter',result:await call('setData',{filters:[{table:'QA',column:'Category',value:'North'}]})})
      report.workflows.push({host,name:'remove-measures',result:await call('setData',{measures:[]})})
      report.workflows.push({host,name:'restore-measures',result:await call('setData',{measures:['Revenue']})})
      report.workflows.push({host,name:'empty',result:await call('setFixture','empty')})
      report.workflows.push({host,name:'error',result:await call('setFixture','error')})
      report.workflows.push({host,name:'recover',result:await call('setFixture','standard')})
      await call('mount','bar',host)
      report.workflows.push({host,name:'title-weight',result:await call('change',{titleFontWeight:900})})
      report.workflows.push({host,name:'click-category',result:await call('chartClick',0)})
      report.workflows.push({host,name:'deselect-category',result:await call('chartClick',0)})
    }
    mark('complete');report.complete=true;persist()
    app.exit(report.events.length?1:0)
  }catch(err){report.events.push({fatal:err.stack,scenario:report.progress});report.progress='failed';persist();app.exit(1)}
})
