const fs=require('node:fs'),path=require('node:path')
const {app,BrowserWindow}=require('electron/main')
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/qa/evidence'),profile=path.join(root,'cache/qa-edge-profile')
fs.mkdirSync(profile,{recursive:true});fs.mkdirSync(path.join(out,'screenshots'),{recursive:true})
app.setPath('userData',profile);app.disableHardwareAcceleration()
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.commandLine.appendSwitch('disable-features','CalculateNativeWinOcclusion')
let win
const report=fs.existsSync(path.join(out,process.argv.includes('--after')?'edge-audit-after.json':'edge-audit-v3.json'))?JSON.parse(fs.readFileSync(path.join(out,process.argv.includes('--after')?'edge-audit-after.json':'edge-audit-v3.json'),'utf8')):{scope:'Editor and viewer host data/size cases; clipped text metrics are candidates requiring policy review',cases:[],events:[],progress:'starting'}
if(report.events.some(e=>e.fatal)) report.resumeNote='Initial sweep interrupted by audit snapshot reading series before bar-race setOption. Snapshot now handles uninitialized option; recorded cases retained.'
const persist=()=>fs.writeFileSync(path.join(out,process.argv.includes('--after')?'edge-audit-after.json':'edge-audit-v3.json'),JSON.stringify(report,null,2))
const js=code=>win.webContents.executeJavaScript(code)
const call=(method,...args)=>js(`window.qaFull.${method}(...${JSON.stringify(args)})`)
const geometry=`(()=>{
  const host=document.getElementById('qa-host'),bounds=host.getBoundingClientRect();
  const clipped=[];const walker=document.createTreeWalker(host,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){
    const node=walker.currentNode;if(!node.textContent.trim()||['STYLE','SCRIPT'].includes(node.parentElement.tagName))continue;
    const range=document.createRange();range.selectNodeContents(node);const rect=range.getBoundingClientRect();if(!rect.width||!rect.height)continue;
    let parent=node.parentElement;
    while(parent&&parent!==host){const s=getComputedStyle(parent);if(['hidden','clip'].includes(s.overflowX)||['hidden','clip'].includes(s.overflowY)){
      const p=parent.getBoundingClientRect();if(rect.right>p.right+1||rect.bottom>p.bottom+1||rect.left<p.left-1||rect.top<p.top-1){clipped.push({text:node.textContent.slice(0,80),rect:{x:rect.x,y:rect.y,w:rect.width,h:rect.height},container:{x:p.x,y:p.y,w:p.width,h:p.height},ellipsis:s.textOverflow==='ellipsis'});break;}
    }parent=parent.parentElement;}
  }
  return {hostBounds:{width:bounds.width,height:bounds.height},clippedText:clipped.slice(0,30),imageFailures:[...host.querySelectorAll('img')].filter(i=>i.complete&&!i.naturalWidth).length,visualError:host.innerText.includes('Visual error')};
})()`
app.whenReady().then(async()=>{
  win=new BrowserWindow({width:1500,height:1000,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}})
  win.webContents.on('console-message',e=>{if(e.level==='error')report.events.push({scenario:report.progress,message:e.message})})
  try{
    await win.loadURL('http://127.0.0.1:5173/qa/full-audit.html')
    await js(`new Promise((r,j)=>{const end=performance.now()+30000;const c=()=>window.qaFullReady?r():performance.now()>end?j(Error('entry timeout')):requestAnimationFrame(c);c()})`)
    win.webContents.debugger.attach('1.3')
    const types=await js('window.qaFull.types')
    for(const type of types){
      console.log('edge '+type)
      for(const host of ['editor','viewer']){
        const cases=[...['standard','empty','error','one','zero','negative','mixed','nulls','long'].map(f=>[f,480,320]),...[[120,80],[240,160],[160,600],[900,120],[1800,1000]].map(([w,h])=>['standard',w,h]),['large-font',480,320]]
        for(const [fixture,width,height]of cases){
          if(report.cases.some(c=>c.type===type&&c.host===host&&c.fixture===fixture&&c.width===width&&c.height===height))continue
          report.progress=`${type}/${host}/${fixture}/${width}x${height}`
          const spec=await call('makeSpec',type);spec.visuals[0].position={x:0,y:0,w:12,h:(height+8)/88}
          if(fixture==='large-font')Object.assign(spec.visuals[0].config,{title:'Very long title '.repeat(15),titleFontSize:32,valueFontSize:96,labelFontSize:40,legendFontSize:30,dataLabels:true,showLabels:true})
          const result=await call('mount',type,host,{spec,width,inspector:false,fixture:fixture==='large-font'?'long':fixture})
          const metrics=await js(geometry)
          report.cases.push({type,host,fixture,width,height,...metrics,text:result.text,queries:result.requests,charts:result.charts})
          if(host==='editor'&&fixture==='standard'&&width===480){
            const image=await win.webContents.debugger.sendCommand('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:true,clip:{x:12,y:12,width:480,height:320,scale:1}})
            fs.writeFileSync(path.join(out,'screenshots',`${type}-editor-standard${process.argv.includes('--after')?'-after':''}.png`),Buffer.from(image.data,'base64'))
          }
        }
      }
      persist()
    }
    report.complete=true;report.progress='complete';persist();app.exit(report.events.length?1:0)
  }catch(e){report.events.push({fatal:e.stack});persist();app.exit(1)}
})
