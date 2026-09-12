// Real hosted Fabric clicks. Pixel location is restricted to the known teal QA
// marks; assertions use the actual semantic-model response, never synthetic data.
const fs=require('node:fs'),path=require('node:path')
const endpoint=process.argv[2]
if(!endpoint?.startsWith('ws://127.0.0.1:'))throw Error('Provide the QA browser CDP endpoint')
const ws=new WebSocket(endpoint),pending=new Map(),report={at:new Date().toISOString(),scope:'Hosted Fabric native point selection/clear, real AdventureWorks model',checks:[]};let id=0
const output=path.resolve('docs/qa/evidence/fabric-point-interactions.json')
const write=()=>fs.writeFileSync(output,JSON.stringify(report,null,2))
const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error(method+' timeout'))},20000);pending.set(n,m=>{clearTimeout(timer);m.error?reject(Error(m.error.message)):resolve(m.result)});ws.send(JSON.stringify({id:n,method,params,sessionId}))})
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id)}}
ws.onerror=()=>{report.error='CDP connection failed';write();process.exitCode=1}
ws.onopen=async()=>{
 let app,evaluate
 try{
  const targets=(await send('Target.getTargets')).targetInfos
  const portal=targets.find(t=>t.type==='page'&&t.url.includes('/appbackends/3340d5cf-f8e0-489c-9068-085790a558af'))
  const hosted=targets.find(t=>t.type==='iframe'&&t.url.startsWith('https://clean-bluff-17e2acd9d2-centralus.webapp.fabricapps.net/'))
  if(!portal||!hosted)throw Error('Open the authenticated QA Fabric app first')
  const top=(await send('Target.attachToTarget',{targetId:portal.targetId,flatten:true})).sessionId
  await send('Page.bringToFront',{},top)
  app=(await send('Target.attachToTarget',{targetId:hosted.targetId,flatten:true})).sessionId
  evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},app);if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
  await evaluate(`window.__qaPointCalls=[];window.__qaPointOriginals={};for(const method of ['query','queryTable']){const original=window.semantica[method];window.__qaPointOriginals[method]=original;window.semantica[method]=async p=>{const r=await original(p);window.__qaPointCalls.push({method,filters:p.filters,data:r.data,rows:r.rows,error:r.error});return r}}`)
  for(const [type,page]of [['scatter','Visuals 7-12'],['bubble','Visuals 7-12'],['lollipop','Visuals 13-18'],['slope','Visuals 25-30']]){
   await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.innerText.includes(${JSON.stringify(page)})).click()`)
   const point=await evaluate(`new Promise((resolve,reject)=>{const until=Date.now()+15000;const check=()=>{const title=Array.from(document.querySelectorAll('[data-chart-title]')).find(e=>e.textContent==='QA '+${JSON.stringify(type)});let card=title;while(card&&!card.querySelector('canvas'))card=card.parentElement;const c=card?.querySelector('canvas');if(!c){if(Date.now()>until)return reject(Error('Chart not ready'));return setTimeout(check,100)}c.scrollIntoView({block:'center'});requestAnimationFrame(()=>{const ctx=c.getContext('2d'),pixels=ctx.getImageData(0,0,c.width,c.height).data,mask=new Uint8Array(c.width*c.height),groups=[];for(let i=0;i<mask.length;i++){const j=i*4;mask[i]=pixels[j]<35&&pixels[j+1]>130&&pixels[j+2]>100&&pixels[j+3]>100?1:0}for(let i=0;i<mask.length;i++){if(!mask[i])continue;const stack=[i],g={count:0,minX:c.width,minY:c.height,maxX:0,maxY:0,sumX:0,sumY:0};mask[i]=0;while(stack.length){const n=stack.pop(),x=n%c.width,y=Math.floor(n/c.width);g.count++;g.sumX+=x;g.sumY+=y;g.minX=Math.min(g.minX,x);g.maxX=Math.max(g.maxX,x);g.minY=Math.min(g.minY,y);g.maxY=Math.max(g.maxY,y);for(const d of [-1,1,-c.width,c.width]){const next=n+d;if(next>=0&&next<mask.length&&mask[next]&&Math.abs(next%c.width-x)<=1){mask[next]=0;stack.push(next)}}}if(g.count>8)groups.push(g)}if(!groups.length)return reject(Error('No QA marks painted'));const type=${JSON.stringify(type)},r=c.getBoundingClientRect(),sx=c.width/c.clientWidth,sy=c.height/c.clientHeight;const g=['slope','lollipop'].includes(type)?groups.sort((a,b)=>(b.maxX-b.minX)-(a.maxX-a.minX))[0]:groups.sort((a,b)=>b.maxX-a.maxX)[0];let x=g.sumX/g.count/sx,y=g.sumY/g.count/sy;if(type==='slope'){x=g.minX/sx+5;y=g.minY/sy+5}if(type==='lollipop'){x=g.maxX/sx-6;y=(g.minY+g.maxY)/2/sy}resolve({x:r.x+x,y:r.y+y,group:g,canvas:{width:c.clientWidth,height:c.clientHeight}})})};check()})`)
   const click=async()=>{await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y},app);await send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1},app);await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1},app)}
   for(const selected of [true,false]){
    await evaluate('window.__qaPointCalls=[]');await click()
    const result=await evaluate(`new Promise(resolve=>{const until=Date.now()+15000,selected=${selected};const check=()=>{const calls=window.__qaPointCalls;const match=calls.find(c=>{const filter=c.filters?.['Product Categories Lookup[CategoryName]'];if(selected?filter!=='Accessories':filter!=null)return false;if(c.data?.['Quantity Sold']===(selected?57809:84174))return true;const cats=new Set((c.rows||[]).map(r=>r['Product Categories Lookup[CategoryName]']));return selected?cats.size===1&&cats.has('Accessories'):['Accessories','Bikes','Clothing'].every(x=>cats.has(x))});if(match)resolve({status:'PASS',response:match});else if(Date.now()>until)resolve({status:'FAIL',calls});else setTimeout(check,100)};check()})`)
    report.checks.push({type,operation:selected?'select':'clear',point,...result});write()
    if(result.status!=='PASS')throw Error(type+' '+(selected?'selection':'clear')+' not confirmed')
    // A query response precedes React's commit and ECharts' lazy option update.
    // Wait for both paint turns before clicking the next selection state.
    await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))')
   }
   console.log(type+' selection/clear PASS')
  }
 }catch(e){report.error=e.message;process.exitCode=1}
 finally{if(evaluate)try{await evaluate(`if(window.__qaPointOriginals){Object.assign(window.semantica,window.__qaPointOriginals);delete window.__qaPointOriginals}`)}catch{}write();ws.close()}
}
