// Attach to the already authenticated QA browser. Never reads cookies or tokens.
const fs = require('node:fs');
const path = require('node:path');
const endpoint = process.argv[2];
if (!endpoint?.startsWith('ws://127.0.0.1:')) throw Error('Provide the local QA browser CDP URL');
const ws = new WebSocket(endpoint), pending = new Map(); let id = 0;
const report = { at: new Date().toISOString(), scope: 'Hosted Fabric app inside authenticated Fabric portal; real semantic model', pages: [] };
const output = path.resolve('docs/qa/evidence');
ws.onerror = () => {
  report.error = 'Could not connect to the QA browser CDP endpoint; refresh its URL.';
  fs.writeFileSync(path.join(output, 'fabric-portal-connection-error.json'), JSON.stringify(report, null, 2));
  console.error(report.error);
  process.exitCode = 1;
};
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const n = ++id; const timeout = setTimeout(() => { pending.delete(n); reject(Error(`${method} timed out`)); }, method === 'Page.captureScreenshot' ? 45000 : 15000);
  pending.set(n, m => { clearTimeout(timeout); m.error ? reject(Error(m.error.message)) : resolve(m.result); });
  ws.send(JSON.stringify({ id: n, method, params, sessionId }));
});
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id) { pending.get(m.id)?.(m); pending.delete(m.id); } };
ws.onopen = async () => {
  try {
    const { targetInfos } = await send('Target.getTargets');
    const portal = targetInfos.find(t => t.type === 'page' && t.url.includes('/appbackends/3340d5cf-f8e0-489c-9068-085790a558af'));
    const hosted = targetInfos.find(t => t.type === 'iframe' && t.url.startsWith('https://clean-bluff-17e2acd9d2-centralus.webapp.fabricapps.net/'));
    if (!portal || !hosted) throw Error('Authenticated QA portal and hosted iframe must both be open');
    const top = (await send('Target.attachToTarget', { targetId: portal.targetId, flatten: true })).sessionId;
    await send('Page.bringToFront',{},top);
    const app = (await send('Target.attachToTarget', { targetId: hosted.targetId, flatten: true })).sessionId;
    const evaluate = async expression => {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, app);
      if (r.exceptionDetails) throw Error(r.exceptionDetails.text);
      return r.result.value;
    };
    const names = await evaluate(`Array.from(document.querySelectorAll('button')).map(b=>b.innerText.match(/Visuals \\d+-\\d+/)?.[0]).filter(Boolean)`);
    if (names.length !== 7) throw Error(`Expected seven gallery navigation buttons; found ${names.length}. App is not ready.`);
    for (const name of names) {
      await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.innerText.includes(${JSON.stringify(name)})).click()`);
      await evaluate(`Array.from(document.querySelectorAll('*')).filter(e=>e.scrollTop).forEach(e=>e.scrollTop=0)`);
      let previous = '', stable = 0, state; const deadline = Date.now() + 45000;
      while (Date.now() < deadline) {
        state = await evaluate(`(()=>{const text=document.body.innerText;const canvases=Array.from(document.querySelectorAll('canvas'));return {text,charts:document.querySelectorAll('[_echarts_instance_]').length,canvas:canvases.length,paint:canvases.map(c=>{try{let s=c.toDataURL(),h=0;for(let i=0;i<s.length;i+=97)h=(h*31+s.charCodeAt(i))|0;return h}catch{return null}}),loading:/Loading|Connecting to|Signing in/i.test(text)}})()`);
        const signature = JSON.stringify(state); stable = signature === previous && !state.loading ? stable + 1 : 0; previous = signature;
        if (stable >= 3) break;
        await new Promise(r => setTimeout(r, 250));
      }
      const image = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, top);
      const file = `fabric-live-${name.replaceAll(' ', '-').toLowerCase()}.png`;
      fs.writeFileSync(path.join(output, file), Buffer.from(image.data, 'base64'));
      await evaluate(`Array.from(document.querySelectorAll('*')).filter(e=>e.scrollHeight>e.clientHeight+20 && /auto|scroll/.test(getComputedStyle(e).overflowY)).forEach(e=>e.scrollTop=e.scrollHeight)`);
      const bottom = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, top);
      fs.writeFileSync(path.join(output, file.replace('.png', '-bottom.png')), Buffer.from(bottom.data, 'base64'));
      report.pages.push({ name, status: stable >= 3 ? 'SETTLED_REQUIRES_REVIEW' : 'UNSETTLED', ...state, screenshot: file });
      fs.writeFileSync(path.join(output, 'fabric-portal-audit.json'), JSON.stringify(report, null, 2));
      console.log(JSON.stringify({ name, charts: state.charts, status: report.pages.at(-1).status }));
    }
    report.dimensionOnly = await evaluate(`window.semantica.queryTable({groupBy:['Product Categories Lookup[CategoryName]'],measures:[],filters:{},limit:10,orderBy:'asc'}).then(r=>({error:r.error,message:r.message,rows:r.rows}))`);
    // The dimension includes Components, which has no sales in the measure gallery.
    const categoryNames = report.dimensionOnly.rows?.map(r=>r['Product Categories Lookup[CategoryName]']).sort();
    if (report.dimensionOnly.error || JSON.stringify(categoryNames)!==JSON.stringify(['Accessories','Bikes','Clothing','Components'])) throw Error('Hosted dimension-only query did not return the four category members');
    await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.innerText.includes('Visuals 1-6')).click();Array.from(document.querySelectorAll('*')).filter(e=>e.scrollTop).forEach(e=>e.scrollTop=0)`);
    await evaluate(`new Promise((resolve,reject)=>{const until=Date.now()+15000;const check=()=>{if(document.body.innerText.includes('84.2k')&&document.querySelectorAll('canvas').length===5)resolve();else if(Date.now()>until)reject(Error('Page one not ready'));else setTimeout(check,100)};check()})`);
    const doc = await send('DOM.getDocument', {}, app);
    const node = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'canvas' }, app);
    report.firstCanvasBox = (await send('DOM.getBoxModel', { nodeId: node.nodeId }, app)).model.content;
    const b=report.firstCanvasBox, x=b[0]+(b[2]-b[0])*0.55, y=b[1]+(b[5]-b[1])*0.19;
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y},app);
    await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1},app);
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1},app);
    report.barSelection=await evaluate(`new Promise(resolve=>{const until=Date.now()+15000;const check=()=>{const text=document.body.innerText;if(text.includes('57.8k')&&!text.includes('84.2k'))resolve({status:'PASS',text});else if(Date.now()>until)resolve({status:'NOT_CONFIRMED',text});else setTimeout(check,150)};check()})`);
    const click = async (cx,cy,modifiers=0) => {
      await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:cx,y:cy,modifiers},app);
      await send('Input.dispatchMouseEvent',{type:'mousePressed',x:cx,y:cy,button:'left',clickCount:1,modifiers},app);
      await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:cx,y:cy,button:'left',clickCount:1,modifiers},app);
    };
    const value = expected => evaluate(`new Promise(resolve=>{const until=Date.now()+15000;const check=()=>{const title=Array.from(document.querySelectorAll('*')).find(e=>e.childElementCount===0&&e.textContent==='QA kpi');const text=title?.parentElement?.innerText||'';if(text.includes(${JSON.stringify(expected)}))resolve({status:'PASS',text});else if(Date.now()>until)resolve({status:'NOT_CONFIRMED',text});else setTimeout(check,150)};check()})`);
    await click(x,y); report.barDeselect=await value('84.2k');
    await click(x,y); report.barReselect=await value('57.8k');
    await click(b[0]+(b[2]-b[0])*0.34,b[1]+(b[5]-b[1])*0.50,2);
    report.barMultiSelect=await value('71.7k');
    await click(x,y,2); report.barMultiRemove=await value('13.9k');
    await click(b[0]+(b[2]-b[0])*0.34,b[1]+(b[5]-b[1])*0.50);
    report.barClear=await value('84.2k');
    await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.innerText.includes('Visuals 31-36')).click()`);
    report.navigation=await evaluate(`new Promise(resolve=>{const until=Date.now()+10000;let clicked=false;const check=()=>{const button=Array.from(document.querySelectorAll('button')).find(b=>b.innerText.includes('Go to detail'));if(button&&!clicked){clicked=true;button.click()}if(clicked&&document.body.innerText.includes('QA pie'))resolve({status:'PASS',text:document.body.innerText});else if(Date.now()>until)resolve({status:'NOT_CONFIRMED',text:document.body.innerText});else setTimeout(check,100)};check()})`);
    await evaluate(`window.__qaQueryCalls=[];if(!window.__qaQueryOriginal){window.__qaQueryOriginal=window.semantica.query;window.semantica.query=async p=>{const r=await window.__qaQueryOriginal(p);window.__qaQueryCalls.push({filters:p.filters,data:r.data,error:r.error});return r}}`);
    const radarNodes=await send('DOM.querySelectorAll',{nodeId:doc.root.nodeId,selector:'canvas'},app);
    const rb=(await send('DOM.getBoxModel',{nodeId:radarNodes.nodeIds[2]},app)).model.content;
    const rr=Math.min(rb[2]-rb[0],rb[5]-rb[1])*0.68/2*(13929/57809);
    const rx=(rb[0]+rb[2])/2-rr*Math.sqrt(3)/2,ry=(rb[1]+rb[5])/2+rr/2;
    await click(rx,ry);
    report.radarSelection=await evaluate(`new Promise(resolve=>{const until=Date.now()+15000;const check=()=>{const calls=window.__qaQueryCalls;if(calls.some(c=>c.filters?.['Product Categories Lookup[CategoryName]']==='Bikes'&&c.data?.['Quantity Sold']===13929))resolve({status:'PASS',calls});else if(Date.now()>until)resolve({status:'NOT_CONFIRMED',calls});else setTimeout(check,150)};check()})`);
    await evaluate(`window.__qaQueryCalls=[]`);await click(rx,ry);
    report.radarClear=await evaluate(`new Promise(resolve=>{const until=Date.now()+15000;const check=()=>{const calls=window.__qaQueryCalls;if(calls.some(c=>!c.filters?.['Product Categories Lookup[CategoryName]']&&c.data?.['Quantity Sold']===84174))resolve({status:'PASS',calls});else if(Date.now()>until)resolve({status:'NOT_CONFIRMED',calls});else setTimeout(check,150)};check()})`);
    // Native pie clicks exercise the deployed adapter and real model filtering.
    // Filter-driven loading can replace sibling canvases, so reacquire its node.
    const pieDoc=await send('DOM.getDocument',{},app);
    const pieNode=await send('DOM.querySelector',{nodeId:pieDoc.root.nodeId,selector:'canvas'},app);
    const pb=(await send('DOM.getBoxModel',{nodeId:pieNode.nodeId},app)).model.content;
    const pw=pb[2]-pb[0],ph=pb[5]-pb[1],pr=Math.min(pw*.7,ph)*.85/2*.6;
    const piePoint=(start,fraction)=>{const a=-Math.PI/2+(start+fraction/2)*Math.PI*2;return [pb[0]+pw*.35+Math.cos(a)*pr,pb[1]+ph*.5+Math.sin(a)*pr]};
    const accessories=piePoint(0,57809/84174),bikes=piePoint(57809/84174,13929/84174);
    const pieCheck=async (key,point,modifiers,expectedFilter,expectedValue)=>{
      await evaluate(`window.__qaQueryCalls=[]`);await click(...point,modifiers);
      report[key]=await evaluate(`new Promise(resolve=>{const until=Date.now()+15000;const check=()=>{const calls=window.__qaQueryCalls;if(calls.some(c=>JSON.stringify(c.filters?.['Product Categories Lookup[CategoryName]']??null)===${JSON.stringify(JSON.stringify(expectedFilter))}&&c.data?.['Quantity Sold']===${expectedValue}))resolve({status:'PASS',calls});else if(Date.now()>until)resolve({status:'NOT_CONFIRMED',calls});else setTimeout(check,150)};check()})`);
    };
    await pieCheck('pieSelection',accessories,0,'Accessories',57809);
    await pieCheck('pieMultiSelect',bikes,2,['Accessories','Bikes'],71738);
    await pieCheck('pieMultiRemove',accessories,2,['Bikes'],13929);
    await pieCheck('pieClear',bikes,2,null,84174);
    await evaluate(`window.semantica.query=window.__qaQueryOriginal;delete window.__qaQueryOriginal`);
    report.theme={};
    for(const [mode,symbol,expected] of [['light','☀','rgb(255, 255, 255)'],['dark','☾','rgb(13, 17, 23)']]) {
      await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.innerText.trim()===${JSON.stringify(symbol)}).click();Array.from(document.querySelectorAll('*')).filter(e=>e.scrollTop).forEach(e=>e.scrollTop=0)`);
      report.theme[mode]=await evaluate(`new Promise(resolve=>{const until=Date.now()+10000;const check=()=>{const header=getComputedStyle(document.querySelector('button').parentElement).backgroundColor;if(header===${JSON.stringify(expected)}&&document.querySelectorAll('canvas').length===6)resolve({status:'PASS',header});else if(Date.now()>until)resolve({status:'NOT_CONFIRMED',header});else setTimeout(check,100)};check()})`);
      const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},top);
      fs.writeFileSync(path.join(output,`fabric-theme-${mode}.png`),Buffer.from(screenshot.data,'base64'));
    }
    if(Object.entries(report).some(([k,v])=>(k.startsWith('bar')||k.startsWith('radar')||k.startsWith('pie')||k==='navigation')&&v?.status!=='PASS')) process.exitCode=1;
    if(Object.values(report.theme).some(v=>v.status!=='PASS'))process.exitCode=1;
    fs.writeFileSync(path.join(output, 'fabric-portal-audit.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({dimensionOnly:'PASS',firstCanvasBox:report.firstCanvasBox}));
  } catch (e) { report.error = e.message; fs.writeFileSync(path.join(output, 'fabric-portal-audit.json'), JSON.stringify(report, null, 2)); console.error(e.message); process.exitCode = 1; }
  finally { ws.close(); }
};
