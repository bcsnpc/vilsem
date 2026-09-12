const fs=require('node:fs'),path=require('node:path'),{app,BrowserWindow}=require('electron/main')
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/qa/evidence',process.argv.includes('--after')?'text-format-after.json':'text-format-audit.json'),report={checks:[],events:[],expectedQueryErrors:[]}
app.setPath('userData',path.join(root,'cache/qa-text-format'));app.disableHardwareAcceleration();app.commandLine.appendSwitch('disable-features','CalculateNativeWinOcclusion')
app.whenReady().then(async()=>{const w=new BrowserWindow({width:1500,height:1000,webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false}}),js=c=>w.webContents.executeJavaScript(c),call=(m,...a)=>js(`window.qaFull.${m}(...${JSON.stringify(a)})`);let scenario='startup';w.webContents.on('console-message',e=>{if(e.level==='error'){if(e.message==='[AppSpec qa] error: QA query failure')report.expectedQueryErrors.push({scenario,message:e.message});else report.events.push({scenario,message:e.message})}});const check=(name,pass,evidence)=>report.checks.push({name,pass,evidence});try{
await w.loadURL('http://127.0.0.1:5173/qa/full-audit.html');await js(`new Promise(r=>{const f=()=>window.qaFullReady?r():requestAnimationFrame(f);f()})`)
scenario='text-box formatting';await call('mount','text_box','editor',{inspector:true});await call('tab','text');
await js(`document.querySelector('[title="Double-click to edit text"]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`);await call('settle');
check('double click starts editing',await js(`!!document.querySelector('#qa-host [contenteditable="true"]')`));
const select=()=>js(`(async()=>{const e=document.querySelector('#qa-host [contenteditable="true"]');const r=document.createRange();r.selectNodeContents(e);const s=getSelection();s.removeAllRanges();s.addRange(r);(await import('/src/appspec/shared/textEditBus.js')).saveTextRange()})()`);
await select();await js(`(async()=>{[...document.querySelectorAll('[data-text-toolbar] button')].find(e=>e.textContent==='I').click()})()`);
await select();await js(`(async()=>{const e=[...document.querySelectorAll('[data-text-toolbar] select')].find(e=>[...e.options].some(o=>o.textContent==='24px'));e.value='24';e.dispatchEvent(new Event('change',{bubbles:true}))})()`);
const format=await js(`(()=>{const e=document.querySelector('#qa-host [contenteditable="true"]'),w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT),a=[];while(w.nextNode()){if(w.currentNode.textContent.trim()){const s=getComputedStyle(w.currentNode.parentElement);a.push({text:w.currentNode.textContent,size:s.fontSize,style:s.fontStyle})}}return {html:e.innerHTML,nodes:a}})()`);
check('italic and bold retained',format.nodes.every(n=>n.style==='italic')&&format.html.includes('<b>'),format);
check('size 24 applies after italic',format.nodes.length>0&&format.nodes.every(n=>n.size==='24px'),format);
await js(`document.querySelector('#qa-host [contenteditable="true"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);await call('settle');
const saved=await call('snapshot');check('escape commits formatted HTML',saved.spec.visuals[0].config.html.includes('24px'),saved.spec.visuals[0].config.html);
for(const host of ['editor','viewer']){const s=await call('makeSpec','text_box');s.visuals[0].position={x:0,y:0,w:12,h:(160+8)/88};s.visuals[0].config.html='<p>'+('Long paragraph with Unicode ? ??? '.repeat(50))+'</p>';await call('mount','text_box',host,{spec:s,width:240,inspector:false});const b=await js(`(()=>{const e=document.querySelector('#qa-host [contenteditable]'),p=e.parentElement,r=e.getBoundingClientRect(),q=p.getBoundingClientRect();return {top:r.top,bottom:r.bottom,parentTop:q.top,parentBottom:q.bottom,overflow:getComputedStyle(e).overflowY,scroll:e.scrollHeight,client:e.clientHeight}})()`);check(host+' long text remains accessible',b.top>=b.parentTop&&b.bottom<=b.parentBottom&&(['auto','scroll'].includes(b.overflow)||b.scroll<=b.client),b)}
for(const host of ['editor','viewer']){
 await call('mount','text_box',host,{spec:saved.spec,inspector:false});
 const persisted=await js(`(()=>{const e=document.querySelector('#qa-host [contenteditable]');return {html:e.innerHTML,text:e.textContent}})()`);
 check(host+' reopens mixed formatting',persisted.html.includes('24px')&&persisted.html.includes('italic')&&persisted.html.includes('<b>')&&persisted.text==='QA text bold',persisted);
 for(const patch of [{fontFamily:'Georgia'},{fontSize:32},{fontWeight:800},{color:'#123456'},{align:'left'},{align:'right'},{vAlign:'top'},{vAlign:'bottom'}]){
  await call('change',{html:'Plain text',...patch});
  const actual=await js(`(()=>{const e=document.querySelector('#qa-host [contenteditable]'),s=getComputedStyle(e);return {fontFamily:s.fontFamily,fontSize:s.fontSize,fontWeight:s.fontWeight,color:s.color,align:s.textAlign,vAlign:getComputedStyle(e.parentElement).alignItems}})()`);
  const key=Object.keys(patch)[0],expected=key==='fontSize'?patch[key]+'px':key==='fontWeight'?String(patch[key]):key==='color'?'rgb(18, 52, 86)':key==='vAlign'?(patch[key]==='top'?'flex-start':'flex-end'):patch[key];
  check(host+' base '+key+' '+patch[key],actual[key]===expected,actual);
 }
}
report.complete=true;fs.writeFileSync(out,JSON.stringify(report,null,2));app.exit(report.events.length||report.checks.some(c=>!c.pass)?1:0)
}catch(e){report.fatal=e.stack;fs.writeFileSync(out,JSON.stringify(report,null,2));app.exit(1)}})
