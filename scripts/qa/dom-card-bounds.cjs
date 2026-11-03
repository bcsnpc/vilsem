const fs=require('node:fs'),path=require('node:path')
const {app,BrowserWindow}=require('electron/main')
app.setPath('userData',path.resolve('cache/qa-dom-card-bounds'));app.disableHardwareAcceleration()
const report={scope:'Actual bundled app Bullet/Progress components in native Chromium; compact text/track reachability',checks:[],errors:[]}
app.whenReady().then(async()=>{
 const win=new BrowserWindow({width:900,height:700,webPreferences:{backgroundThrottling:false}}),js=s=>win.webContents.executeJavaScript(s)
 win.webContents.on('console-message',e=>{if(e.level==='error')report.errors.push(e.message)})
 try{
  const file=path.resolve('cache/powerbi-dom/card-qa.html');fs.writeFileSync(file,'<html><body><div id="host"></div></body></html>');await win.loadFile(file)
  await js(`import('./powerbiDom.js').then(m=>{window.bridge=m})`)
  for(const type of ['bullet','progress'])for(const width of [80,160,480])for(const height of [60,120,320])for(const font of [28,60]){
   const state=await js(`(()=>{window.card?.dispose();const host=document.querySelector('#host');host.style.cssText='position:relative;width:${width}px;height:${height}px';window.card=bridge.mountPowerBIDomVisual(host,'${type}',[{_val:125,_val2:150}],{title:'Long title with Unicode 日本語 and longwordabcdefghijklmno',prefix:'Revenue ',suffix:' USD',valueFontSize:${font},maxValue:200});const viewport=host.firstElementChild,h=host.getBoundingClientRect();const texts=()=>{const out=[],walker=document.createTreeWalker(host,NodeFilter.SHOW_TEXT);while(walker.nextNode()){if(!walker.currentNode.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(walker.currentNode);out.push(...range.getClientRects())}return out};const initial=texts(),firstReachable=initial[0].top>=h.top-1;viewport.scrollTop=viewport.scrollHeight;const last=texts();return {firstReachable,lastReachable:last.at(-1).bottom<=h.bottom+1,withinWidth:last.every(r=>r.left>=h.left-1&&r.right<=h.right+1),text:host.innerText}})()`)
   report.checks.push({type,width,height,font,...state,pass:state.firstReachable&&state.lastReachable&&state.withinWidth})
  }
  for(const type of ['bullet','progress'])for(const val of [-20,0,50,250]){
   const state=await js(`(()=>{window.card.dispose();const host=document.querySelector('#host');host.style.cssText='width:480px;height:320px';const cfg={maxValue:200,barHeight:24,barRadius:7,barColor:'#ff0000',barEndColor:'#00ff00',trackColor:'#0000ff',trackRadius:9,targetWidth:6,targetColor:'#ff00ff',percentageFontSize:21,percentageColor:'#00ffff',contentGap:17};window.card=bridge.mountPowerBIDomVisual(host,'${type}',[{_val:${val},_val2:150}],cfg);const get=n=>host.querySelector('[data-format-target="'+n+'"]'),bar=get('value-bar'),track=get('track'),marker=get('target-marker'),pct=get('percentage');const before={width:bar.style.width,height:bar.style.height,radius:bar.style.borderRadius,background:bar.style.background,track:track.style.background,trackRadius:track.style.borderRadius,marker:marker?{left:marker.style.left,width:marker.style.width,color:marker.style.background}:null,pct:pct?{text:pct.textContent,size:pct.style.fontSize,color:pct.style.color}:null};card.update([{_val:${val},_val2:150}],{...cfg,targetValue:100,showTarget:false,showPercentage:false});return {before,hidden:!get('target-marker')&&!get('percentage')}})()`)
   const b=state.before,expected=Math.max(0,Math.min(100,val/200*100))+'%'
   const pass=b.width===expected&&b.radius==='7px'&&state.hidden&&(type==='bullet'?b.height==='24px'&&b.background==='rgb(255, 0, 0)'&&b.trackRadius==='9px'&&b.marker.width==='6px'&&b.marker.color==='rgb(255, 0, 255)'&&b.marker.left.includes('75%'):b.background.includes('rgb(255, 0, 0)')&&b.background.includes('rgb(0, 255, 0)')&&b.track==='rgb(0, 0, 255)'&&b.pct.size==='21px'&&b.pct.color==='rgb(0, 255, 255)')
   report.checks.push({type,val,formatting:true,...state,pass})
  }
 }catch(error){report.error=error.stack}
 fs.writeFileSync('docs/qa/evidence/dom-card-bounds.json',JSON.stringify(report,null,2));console.log(JSON.stringify({checks:report.checks.length,failed:report.checks.filter(c=>!c.pass).length,error:report.error}));app.exit(report.error||report.errors.length||report.checks.some(c=>!c.pass)?1:0)
})
