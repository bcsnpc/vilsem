// Read-only cloud readiness probe. Never serialize credentials or response headers.
const { app, safeStorage } = require('electron/main')
const fs = require('node:fs'), path = require('node:path'), axios = require('axios')
const root = path.resolve(__dirname, '../..')
app.setPath('userData', path.join(process.env.APPDATA, 'vilsem'))
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('disable-features','CalculateNativeWinOcclusion')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.whenReady().then(async () => {
  const report = { at: new Date().toISOString(), scope: process.argv.includes('--gallery') ? 'Isolated Service report using existing measures; no semantic-model changes' : 'Read-only cloud access; no publication or model changes', checks: [] }
  let stage = 'saved workspace'
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'workspaces.json'), 'utf8'))
    const ws = cfg.workspaces.find(w => w.id === cfg.activeWorkspace)
    if (cfg.loggedOut || !ws) throw Error('No active signed-in workspace')
    report.workspace = ws.workspaceName; report.model = ws.datasetName
    if (ws.authMode !== 'interactive') throw Error('Probe currently supports saved interactive authentication')
    stage = 'refresh saved sign-in'
    const refresh = ws.refreshTokenEnc ? safeStorage.decryptString(Buffer.from(ws.refreshTokenEnc, 'base64')) : ws.refreshTokenPlain
    const auth = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', new URLSearchParams({client_id:'ea0616ba-638b-4df5-95b9-636659ae5121',grant_type:'refresh_token',refresh_token:refresh,scope:'https://analysis.windows.net/powerbi/api/.default offline_access'}).toString(), {timeout:30000})
    const headers = {Authorization: `Bearer ${auth.data.access_token}`}
    for (const [name,url] of [
      ['Power BI reports',`https://api.powerbi.com/v1.0/myorg/groups/${ws.workspaceId}/reports`],
      ['Power BI datasets',`https://api.powerbi.com/v1.0/myorg/groups/${ws.workspaceId}/datasets`],
      ['Fabric items',`https://api.fabric.microsoft.com/v1/workspaces/${ws.workspaceId}/items`],
    ]) {
      stage = name
      try { const r=await axios.get(url,{headers,timeout:30000}); report.checks.push({name,status:'PASS',items:(r.data.value||[]).map(x=>({id:x.id,name:x.name||x.displayName,type:x.type}))}) }
      catch(e) {report.checks.push({name,status:'BLOCKED',httpStatus:e.response?.status,code:e.response?.data?.error?.code||e.response?.data?.errorCode||e.code})}
    }
    if(process.argv.includes('--gallery')) {
      stage='Gallery model query'
      const query=await axios.post(`https://api.powerbi.com/v1.0/myorg/groups/${ws.workspaceId}/datasets/${ws.datasetId}/executeQueries`,{queries:[{query:'EVALUATE SUMMARIZECOLUMNS(\'Product Categories Lookup\'[CategoryName], "Quantity Sold", [Quantity Sold], "Quantity Returned", [Quantity Returned], "Total Orders", [Total Orders])'}]},{headers,timeout:30000})
      report.checks.push({name:stage,status:'PASS',rows:query.data.results?.[0]?.tables?.[0]?.rows})
      const parts=JSON.parse(fs.readFileSync(path.join(root,'cache/qa-target-gallery/report-parts.json'),'utf8'))
      if(process.argv.includes('--tooltip-off')){
        if(!process.argv.includes('--reuse')||!process.argv.includes('--update'))throw Error('Tooltip variant requires updating the existing QA report')
        const part=parts.find(p=>p.path==='definition/pages/page1/visuals/visual1/visual.json')
        const visual=JSON.parse(part.content),literal=visual.visual.objects.semantica[0].properties.primitiveSpec.expr.Literal
        const spec=JSON.parse(literal.Value.slice(1,-1).replaceAll("''","'"));spec.config.tooltipEnabled=false
        literal.Value="'"+JSON.stringify(spec).replaceAll("'","''")+"'";part.content=JSON.stringify(visual)
      }
      parts.push({path:'definition.pbir',content:JSON.stringify({version:'4.0',datasetReference:{byConnection:{connectionString:null,pbiServiceModelId:null,pbiModelVirtualServerName:'sobe_wowvirtualserver',pbiModelDatabaseName:ws.datasetId,name:'EntityDataSource',connectionType:'pbiServiceXmlaStyleLive'}}})})
      process.env.AUTH_MODE='interactive'
      require('../../src/auth/auth').setInteractiveTokens(auth.data.access_token,auth.data.refresh_token,auth.data.expires_in)
      stage='Create isolated Service gallery'
      const name=`Vilsem QA gallery ${new Date().toISOString().replace(/[:.]/g,'-')}`
      const previous=process.argv.includes('--reuse')?JSON.parse(fs.readFileSync(path.join(root,'cache/qa-target-gallery/cloud-manifest.json'),'utf8')):null
      const created=previous?{success:true,reportId:previous.reportId}:await require('../../electron/ipc/powerbi').createReport({workspaceId:ws.workspaceId,reportName:name,parts,description:'Isolated Vilsem renderer QA: 19 primitive visual types. Existing semantic model is read-only.'})
      report.gallery=previous
      if(previous && process.argv.includes('--update')){
        if(!previous.name.startsWith('Vilsem QA gallery ') || previous.workspaceId!==ws.workspaceId)throw Error('Only the recorded QA gallery may be updated')
        const updated=await require('../../electron/ipc/powerbi').updateReportDefinition({workspaceId:ws.workspaceId,reportId:previous.reportId,parts})
        if(!updated.success)throw Error(updated.message||'QA gallery update failed')
      }
      report.gallery={name:previous?.name||name,reportId:created.reportId,success:created.success,workspaceId:ws.workspaceId,message:created.message}
      fs.writeFileSync(path.join(root,'cache/qa-target-gallery/cloud-manifest.json'),JSON.stringify(report.gallery,null,2))
      fs.writeFileSync(path.join(root,process.argv.includes('--interactions-only')?'docs/qa/evidence/cloud-interactions.json':'docs/qa/evidence/cloud-gallery.json'),JSON.stringify(report,null,2))
      if(!created.success||!created.reportId)throw Error(created.message||'Report creation did not return an ID')
      report.checks.push({name:stage,status:'PASS'})
      if(process.argv.includes('--roundtrip')) {
        stage='Existing QA report resource roundtrip'
        if(!report.gallery.name.startsWith('Vilsem QA gallery '))throw Error('Roundtrip is restricted to the QA report')
        const api=require('../../electron/ipc/powerbi')
        const before=await api.getReportDefinitionV2({workspaceId:ws.workspaceId,reportId:created.reportId,format:'PBIR'})
        if(!before.success)throw Error(before.message||'Cannot read QA report')
        const updated=await api.updateReportDefinition({workspaceId:ws.workspaceId,reportId:created.reportId,parts:before.parts})
        if(!updated.success)throw Error(updated.message||'QA report roundtrip failed')
        const after=await api.getReportDefinitionV2({workspaceId:ws.workspaceId,reportId:created.reportId,format:'PBIR'})
        if(!after.success)throw Error(after.message||'Cannot re-read QA report')
        const changed=before.parts.filter(p=>after.parts.find(q=>q.path===p.path)?.payload!==p.payload).map(p=>p.path)
        const added=after.parts.filter(p=>!before.parts.some(q=>q.path===p.path)).map(p=>p.path)
        report.roundtrip={before:before.parts.length,after:after.parts.length,changed,added,status:changed.length||added.length?'REVIEW':'PASS'}
        fs.writeFileSync(path.join(root,'docs/qa/evidence/service-resource-roundtrip.json'),JSON.stringify(report.roundtrip,null,2))
        report.checks.push({name:stage,status:report.roundtrip.status})
      }
      stage='Render Service gallery'
      const meta=await axios.get(`https://api.powerbi.com/v1.0/myorg/groups/${ws.workspaceId}/reports/${created.reportId}`,{headers,timeout:30000})
      const {BrowserWindow}=require('electron/main')
      const win=new BrowserWindow({width:1600,height:1100,webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false}})
      app.commandLine.appendSwitch('disable-features','CalculateNativeWinOcclusion')
      report.hostLifecycle=[]
      win.webContents.on('render-process-gone',(_event,details)=>report.hostLifecycle.push({event:'render-process-gone',reason:details.reason,exitCode:details.exitCode}))
      win.webContents.on('did-navigate',(_event,url)=>{try{const u=new URL(url);report.hostLifecycle.push({event:'did-navigate',origin:u.origin,path:u.pathname})}catch{}})
      // A Vite application shell can reload when unrelated source edits arrive.
      // Give hosted acceptance an isolated, static loopback document instead.
      const hostServer=require('node:http').createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><html><head><title>Vilsem Service QA</title></head><body style="margin:0"></body></html>')})
      await new Promise((resolve,reject)=>{hostServer.once('error',reject);hostServer.listen(0,'127.0.0.1',resolve)})
      app.once('will-quit',()=>hostServer.close())
      await win.loadURL(`http://127.0.0.1:${hostServer.address().port}/`)

      const sdk=await axios.get('https://cdn.jsdelivr.net/npm/powerbi-client@2.23.1/dist/powerbi.js',{timeout:30000})
      await win.webContents.executeJavaScript(sdk.data)
      const config={type:'report',id:created.reportId,embedUrl:meta.data.embedUrl,accessToken:auth.data.access_token,tokenType:0,settings:{panes:{filters:{visible:false}},visualRenderedEvents:true}}
      await win.webContents.executeJavaScript(`document.body.innerHTML='<div id="embed" style="height:100vh"></div>';window.qaEvents=[];window.qaReport=powerbi.embed(document.getElementById('embed'),${JSON.stringify(config)});['loaded','rendered','error','visualRendered'].forEach(n=>qaReport.on(n,e=>qaEvents.push({name:n,detail:n==='error'?e.detail:undefined})));`)
      await win.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const deadline=Date.now()+90000;const timer=setInterval(()=>{if(qaEvents.some(e=>e.name==='rendered')){clearInterval(timer);resolve()}else if(Date.now()>deadline){clearInterval(timer);reject(Error('Service render timeout'))}},250)})`)
      const pages=await win.webContents.executeJavaScript(`qaReport.getPages().then(p=>p.map(x=>({name:x.name,displayName:x.displayName})))`)
      report.servicePages=[]
      // Host 'rendered' can fire before a custom visual's async ECharts paint.
      // Inspect actual child-frame content instead of treating host events as pixels.
      async function readyFrames(expected) {
        const deadline=Date.now()+30000;let frames=[],previousPaint='',stablePaint=0
        while(Date.now()<deadline){
          frames=[]
          for(const frame of win.webContents.mainFrame.framesInSubtree){try{frames.push(await Promise.race([frame.executeJavaScript(`({text:document.body?.innerText?.slice(0,1400),charts:document.querySelectorAll('[_echarts_instance_]').length,domCards:document.querySelectorAll('[data-powerbi-dom-visual]').length,waffle:Array.from(document.querySelectorAll('div')).filter(e=>e.style.gridTemplateColumns.includes('repeat(10')&&e.children.length===100).length,svg:document.querySelectorAll('svg').length,canvas:document.querySelectorAll('canvas').length})`),new Promise((_,reject)=>setTimeout(()=>reject(Error('Frame unavailable')),1000))]))}catch{}}
          if(frames.reduce((n,f)=>n+f.charts+(f.domCards||0)+(f.text?.startsWith('table\n')?1:0),0)>=expected){
            // A chart instance exists before its animated lines reach their endpoints.
            // Require stable painted pixels, not just a host rendered event.
            const paint=[]
            for(const frame of win.webContents.mainFrame.framesInSubtree){try{paint.push(await Promise.race([frame.executeJavaScript(`Array.from(document.querySelectorAll('canvas')).map(c=>{let s=c.toDataURL(),h=0;for(let i=0;i<s.length;i+=97)h=(h*31+s.charCodeAt(i))|0;return h})`),new Promise((_,reject)=>setTimeout(()=>reject(Error('Frame unavailable')),1000))]))}catch{}}
            const signature=JSON.stringify(paint);stablePaint=signature===previousPaint?stablePaint+1:0;previousPaint=signature
            if(stablePaint>=3)return frames
          }
          await new Promise(r=>setTimeout(r,250))
        }
        const observed=frames.reduce((n,f)=>n+f.charts+(f.domCards||0)+(f.text?.startsWith('table\n')?1:0),0)
        throw Error(`Service visual readiness timed out: expected ${expected} settled visuals, observed ${observed}; stable paint samples ${stablePaint}.`)
      }
      for(const page of process.argv.includes('--interactions-only')?[]:pages){
        await win.webContents.executeJavaScript(`qaEvents=[];qaReport.setPage(${JSON.stringify(page.name)})`)
        const visuals=await win.webContents.executeJavaScript(`qaReport.getActivePage().then(p=>p.getVisuals()).then(v=>v.map(x=>({name:x.name,type:x.type,title:x.title})))`)
        const frames=await readyFrames(visuals.length)
        fs.writeFileSync(path.join(root,`docs/qa/evidence/service-${page.name}.png`),(await win.webContents.capturePage()).toPNG())
        const entry={...page,visuals,frames,events:await win.webContents.executeJavaScript('qaEvents'),states:[]}
        report.servicePages.push(entry)
        for(const value of ['Accessories','__Vilsem_QA_empty__']){
          const filter={$schema:'http://powerbi.com/product/schema#basic',target:{table:'Product Categories Lookup',column:'CategoryName'},operator:'In',values:[value],filterType:1}
          await win.webContents.executeJavaScript(`qaEvents=[];qaReport.setFilters([${JSON.stringify(filter)}])`)
          await win.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const deadline=Date.now()+30000;const timer=setInterval(()=>{if(qaEvents.some(e=>e.name==='rendered')){clearInterval(timer);resolve()}else if(Date.now()>deadline){clearInterval(timer);reject(Error('Filter render timeout'))}},250)})`)
          const state=await readyFrames(value==='Accessories'?visuals.length:0)
          entry.states.push({filter:value,frames:state,events:await win.webContents.executeJavaScript('qaEvents')})
          fs.writeFileSync(path.join(root,`docs/qa/evidence/service-${page.name}-${value==='Accessories'?'one':'empty'}.png`),(await win.webContents.capturePage()).toPNG())
        }
        await win.webContents.executeJavaScript('qaEvents=[];qaReport.removeFilters()')
        await readyFrames(visuals.length)
        fs.writeFileSync(path.join(root,process.argv.includes('--interactions-only')?'docs/qa/evidence/cloud-interactions.json':'docs/qa/evidence/cloud-gallery.json'),JSON.stringify(report,null,2))
      }
      report.checks.push({name:stage,status:'PASS',note:'Rendered events and screenshots only; individual chart content and interactions require review.'})
      if(process.argv.includes('--dom-title-check')) {
        await win.webContents.executeJavaScript(`qaReport.setPage(${JSON.stringify(pages.at(-1).name)})`)
        const expected=await win.webContents.executeJavaScript('qaReport.getActivePage().then(p=>p.getVisuals()).then(v=>v.length)')
        await readyFrames(expected)
        const cards=[]
        for(const frame of win.webContents.mainFrame.framesInSubtree){try{
          const card=await frame.executeJavaScript(`(()=>{if(!document.querySelector('[data-format-target="value-bar"]'))return null;const text=document.body.innerText,type=text.startsWith('bullet')?'bullet':text.startsWith('progress')?'progress':null;return type?{type,text,titles:text.split(type).length-1,caption:text.includes('(target:')}:null})()`)
          if(card)cards.push(card)
        }catch{}}
        const pass=cards.length===2&&new Set(cards.map(c=>c.type)).size===2&&cards.every(c=>c.titles===1&&!c.caption)
        report.checks.push({name:'DOM cards use one shared title',status:pass?'PASS':'FAIL',cards})
        fs.writeFileSync(path.join(root,'docs/qa/evidence/service-dom-title-final.png'),(await win.webContents.capturePage()).toPNG())
        if(!pass)throw Error('DOM title ownership mismatch')
      }
      if(process.argv.includes('--table-interactions')) {
        await win.webContents.executeJavaScript(`qaReport.setPage(${JSON.stringify(pages[2].name)})`)
        await readyFrames(6)
        let tableFrame
        for(const frame of win.webContents.mainFrame.framesInSubtree){try{if(await frame.executeJavaScript(`!!document.querySelector('[data-table-grid]')`)){tableFrame=frame;break}}catch{}}
        if(!tableFrame)throw Error('Updated Service table controls not found')
        const result=await tableFrame.executeJavaScript(`(()=>{
          const rows=()=>Array.from(document.querySelectorAll('[data-table-row]')).map(r=>({category:r.children[1].textContent.trim(),values:Array.from(r.children).slice(2).map(c=>c.textContent.trim())}));
          const before=rows(), states=[];
          for(let i=0;i<3;i++){document.querySelector('[data-table-sort="val-0"]').click();states.push(rows())}
          const handle=document.querySelector('[data-table-resize="dim-0"]');handle.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
          return {before,states,header:document.querySelector('[data-table-header]').style.gridTemplateColumns,row:document.querySelector('[data-table-row]').style.gridTemplateColumns,handles:document.querySelectorAll('[data-table-resize]').length}
        })()`)
        const pass=result.states[0][0].category==='Accessories'&&result.states[1][0].category==='Clothing'&&JSON.stringify(result.states[2])===JSON.stringify(result.before)&&result.header===result.row&&result.header.includes('160px')
        fs.writeFileSync(path.join(root,'docs/qa/evidence/service-table-interactions.json'),JSON.stringify({status:pass?'PASS':'FAIL',scope:'Hosted Service DOM header clicks and keyboard resize, actual model',...result},null,2))
        fs.writeFileSync(path.join(root,'docs/qa/evidence/service-table-interactions.png'),(await win.webContents.capturePage()).toPNG())
        report.checks.push({name:'Hosted table sorting and resize',status:pass?'PASS':'FAIL'})
        if(!pass)throw Error('Hosted table interaction assertion failed')
      }
      if(process.argv.includes('--interactions')||process.argv.includes('--all-interactions')) {
        const requested=process.argv.find(a=>a.startsWith('--selection-type='))?.split('=')[1]||'bar'
        const selectionTypes=process.argv.includes('--all-interactions')?['bar','stacked_bar','grouped_bar','column','line','area','stacked_area','bump','donut','pie','scatter','bubble','treemap','radar','slope','lollipop']:requested.split(',')
        const locate=await require('./service-mark-point.cjs')()
        report.nativeSelections=[]
        win.webContents.debugger.attach('1.3')
        for(const selectionType of selectionTypes) { try {
        console.log('Native Service interaction: '+selectionType)
        const selectionPage=['treemap','radar','slope','lollipop'].includes(selectionType)?'page3':['stacked_area','bump','donut','pie','scatter','bubble'].includes(selectionType)?'page2':'page1'
        await win.webContents.executeJavaScript(`qaReport.setPage(${JSON.stringify(selectionPage)})`)
        await readyFrames(6)
        const witness=selectionType==='column'?'visual1':selectionType==='pie'?'visual5':'visual4'
        const exported=()=>win.webContents.executeJavaScript(`qaReport.getActivePage().then(p=>p.getVisuals()).then(v=>v.find(x=>x.name===${JSON.stringify(witness)}).exportData()).then(r=>({data:r.data})).catch(e=>({error:e.message||String(e)}))`)
        report.nativeSelection={type:selectionType,before:await exported()}
        if(report.nativeSelection.before.error)throw Error(report.nativeSelection.before.error)
        const send=(method,params={},session)=>win.webContents.debugger.sendCommand(method,params,session)
        const targets=await send('Target.getTargets')
        let barSession
        for(const t of targets.targetInfos.filter(t=>t.type==='iframe')) {
          const attached=await send('Target.attachToTarget',{targetId:t.targetId,flatten:true})
          const body=await send('Runtime.evaluate',{expression:'document.body.innerText',returnByValue:true},attached.sessionId)
          if(body.result.value===selectionType){barSession=attached.sessionId;break}
        }
        if(!barSession)throw Error(`Cannot locate the live ${selectionType} iframe for native selection`)
        const doc=await send('DOM.getDocument',{},barSession)
        const node=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'canvas'},barSession)
        const b=(await send('DOM.getBoxModel',{nodeId:node.nodeId},barSession)).model.content
        const canvasMetrics=(await send('Runtime.evaluate',{expression:`(()=>{const c=document.querySelector('canvas');return{clientWidth:c.clientWidth,clientHeight:c.clientHeight,width:c.width,height:c.height,dpr:devicePixelRatio,bounds:c.getBoundingClientRect().toJSON()}})()`,returnByValue:true},barSession)).result.value
        const nativeTextWidths=(await send('Runtime.evaluate',{expression:`(()=>{const ctx=document.createElement('canvas').getContext('2d'),out={},texts=new Set(['国','a','Accessories','Bikes','Clothing','Quantity Sold','Quantity Returned','Total Orders','Value','Secondary','0','1k','1.2k','1.5k']);for(let n=0;n<=100000;n+=100)texts.add(String(n));for(let n=0;n<=100;n++)texts.add(n+'k');for(let n=0;n<=20;n++)texts.add((n/10).toFixed(1)+'k');for(let size=8;size<=22;size++)for(const weight of [400,500,600,700,800]){ctx.font=weight+' '+size+'px Inter, "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif';for(const text of texts)out[size+'|'+weight+'|'+text]=ctx.measureText(text).width}return out})()`,returnByValue:true},barSession)).result.value
        const point=locate(selectionType,b[2]-b[0],b[5]-b[1],nativeTextWidths)
        if(['line','area','stacked_area','bump','scatter','bubble'].includes(selectionType)) {
          const probe=(await send('Runtime.evaluate',{expression:`(()=>{const c=document.querySelector('canvas'),ctx=c.getContext('2d'),sx=c.width/c.clientWidth,sy=c.height/c.clientHeight,data=ctx.getImageData(0,0,c.width,c.height).data,points=[];for(let y=Math.max(0,Math.floor((${point.y}-20)*sy));y<Math.min(c.height,(${point.y}+20)*sy);y++)for(let x=Math.max(0,Math.floor((${point.x}-20)*sx));x<Math.min(c.width,(${point.x}+20)*sx);x++){const i=(y*c.width+x)*4;if(data[i]<35&&data[i+1]>130&&data[i+2]>100&&data[i+3]>100)points.push([x/sx,y/sy])}if(!points.length)return null;const minX=Math.min(...points.map(p=>p[0])),minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));const candidates=${JSON.stringify(['scatter','bubble'].includes(selectionType))}?points:points.filter(p=>p[0]<=minX+3&&(${JSON.stringify(selectionType)}==='bump'?p[1]>=maxY-4:p[1]<=minY+4));return candidates.length?{minX,minY,maxY,count:points.length,x:candidates.reduce((s,p)=>s+p[0],0)/candidates.length,y:candidates.reduce((s,p)=>s+p[1],0)/candidates.length}:null})()`,returnByValue:true},barSession)).result.value
          report.nativeSelection.pixelProbe=probe
          report.nativeSelection.predictedPoint={...point}
          if(!probe)throw Error(`No visible ${selectionType} mark near the predicted position`)
          point.x=['scatter','bubble'].includes(selectionType)?probe.x:probe.minX+1.25;point.y=['scatter','bubble'].includes(selectionType)?probe.y:selectionType==='bump'?probe.maxY-1.25:probe.minY+1.25
        }
        const x=b[0]+point.x,y=b[1]+point.y,expectedCategory=point.category
        report.nativeSelection.point=point
        report.nativeSelection.canvasMetrics=canvasMetrics
        report.nativeSelection.canvasBox=b
        await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y},barSession)
        if(process.argv.includes('--tooltip-check')){
          // The first line dot extends left of the plot. Axis-trigger tooltips
          // require a point inside the grid even though its outer dot is clickable.
          if(['line','area'].includes(selectionType))await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:x+5,y},barSession)
          const expected=!process.argv.includes('--tooltip-off')
          const tooltip=(await send('Runtime.evaluate',{expression:`new Promise(resolve=>{const until=Date.now()+3000;let frames=0;const check=()=>{const visible=Array.from(document.querySelectorAll('div')).filter(e=>e.style.zIndex==='9999999'&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none'&&Number(getComputedStyle(e).opacity)>0).map(e=>e.innerText);if(${expected}&&visible.length||!${expected}&&++frames>=3||Date.now()>until)resolve({visible,bounds:Array.from(document.querySelectorAll('div')).filter(e=>e.style.zIndex==='9999999'&&getComputedStyle(e).visibility!=='hidden'&&Number(getComputedStyle(e).opacity)>0).map(e=>{const r=e.getBoundingClientRect();let clipped=false;for(let p=e.parentElement;p&&p!==document.body;p=p.parentElement){const s=getComputedStyle(p),b=p.getBoundingClientRect();if(/auto|hidden|scroll/.test(s.overflowX)&&(r.left<b.left-1||r.right>b.right+1))clipped=true}return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,clipped,inViewport:r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1}})});else requestAnimationFrame(check)};requestAnimationFrame(check)})`,returnByValue:true,awaitPromise:true},barSession)).result.value
          report.nativeSelection.tooltip={...tooltip,expectedVisible:expected,status:(tooltip.visible.length>0)===expected&&(!expected||tooltip.bounds.every(b=>b.inViewport&&!b.clipped))?'PASS':'FAIL'}
          report.checks.push({name:`Native ${selectionType} tooltip ${expected?'shown':'hidden'}`,status:report.nativeSelection.tooltip.status})
          if(process.argv.includes('--measure-label-check')){
            const text=tooltip.visible.join('\n')
            report.checks.push({name:`Native ${selectionType} bound measure labels`,status:['Quantity Sold','Quantity Returned'].every(name=>text.includes(name))?'PASS':'FAIL'})
          }
          fs.writeFileSync(path.join(root,`docs/qa/evidence/service-native-${selectionType}-tooltip.png`),(await win.webContents.capturePage()).toPNG())
        }
        await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1},barSession)
        await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1},barSession)
        await readyFrames(6)
        report.nativeSelection.after=await exported()
        const selectedRows=report.nativeSelection.after.data?.trim().split(/\r?\n/).slice(1)||[]
        report.nativeSelection.expectedCategory=expectedCategory
        report.nativeSelection.status=selectedRows.length===1&&selectedRows[0].endsWith(','+expectedCategory)?'PASS':'FAIL'
        await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1},barSession)
        await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1},barSession)
        await readyFrames(6)
        report.nativeSelection.deselected=await exported()
        report.nativeSelection.deselectStatus=report.nativeSelection.deselected.data===report.nativeSelection.before.data?'PASS':'FAIL'
        fs.writeFileSync(path.join(root,`docs/qa/evidence/service-native-${selectionType}-selection.json`),JSON.stringify(report.nativeSelection,null,2))
        fs.writeFileSync(path.join(root,`docs/qa/evidence/service-native-${selectionType}-selection.png`),(await win.webContents.capturePage()).toPNG())
        report.checks.push({name:`Native ${selectionType} category identity`,status:report.nativeSelection.status})
        report.checks.push({name:`Native ${selectionType} deselection`,status:report.nativeSelection.deselectStatus})
        report.nativeSelections.push(report.nativeSelection)
        }catch(e){report.checks.push({name:`Native ${selectionType} interaction`,status:'FAIL',message:e.message})}
        }
      }
    }
  } catch(e) { report.checks.push({name:stage,status:'BLOCKED',httpStatus:e.response?.status,code:e.response?.data?.error||e.code,message:e.response ? 'Saved authentication could not be refreshed; sign-in required.' : e.message}) }
  fs.writeFileSync(path.join(root,'docs/qa/evidence/cloud-access.json'),JSON.stringify(report,null,2))
  if(process.argv.includes('--gallery'))fs.writeFileSync(path.join(root,process.argv.includes('--interactions-only')?'docs/qa/evidence/cloud-interactions.json':'docs/qa/evidence/cloud-gallery.json'),JSON.stringify(report,null,2))
  console.log(JSON.stringify(report)); app.exit(report.checks.some(c=>c.status!=='PASS')?1:0)
})
