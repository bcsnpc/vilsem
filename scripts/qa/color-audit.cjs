const fs=require('node:fs'),path=require('node:path'),{app,BrowserWindow}=require('electron/main')
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/qa/evidence/color-audit.json'),report={scope:'Valid hex input retest of initial invalid-input probes',properties:[],events:[]}
app.setPath('userData',path.join(root,'cache/qa-color-profile'));app.disableHardwareAcceleration()
app.whenReady().then(async()=>{const w=new BrowserWindow({width:1500,height:1000,webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false}}),js=c=>w.webContents.executeJavaScript(c);try{
await w.loadURL('http://127.0.0.1:5173/qa/full-audit.html');await js(`new Promise(r=>{const f=()=>window.qaFullReady?r():requestAnimationFrame(f);f()})`)
const types=await js('window.qaFull.types');for(const type of types){for(const variant of ['default','expanded'])report.properties.push(...await js(`window.qaFull.properties(${JSON.stringify(type)},${JSON.stringify(variant)},['Hex'])`));console.log(type)}
report.complete=true;fs.writeFileSync(out,JSON.stringify(report,null,2));app.exit(0)
}catch(e){report.events.push(e.stack);fs.writeFileSync(out,JSON.stringify(report,null,2));app.exit(1)}})
