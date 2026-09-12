const fs=require('node:fs'),path=require('node:path')
const {app,BrowserWindow}=require('electron/main')
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/qa/evidence',process.argv.includes('--after')?'product-audit-after.json':'product-audit.json')
app.setPath('userData',path.join(root,'cache/qa-product-profile'));app.disableHardwareAcceleration()
const report={scope:'Production AppGenerator and inspector; synthetic model and in-memory save transport. Disk persistence tested separately in contract-audit.',checks:[],events:[]}
let win
const js=c=>win.webContents.executeJavaScript(c)
const persist=()=>fs.writeFileSync(out,JSON.stringify(report,null,2))
const wait=c=>js(`new Promise((resolve,reject)=>{const end=performance.now()+15000;const poll=()=>(${c})?resolve(true):performance.now()>end?reject(Error('Condition timed out: '+${JSON.stringify(c)})):requestAnimationFrame(poll);poll()})`)
const click=label=>js(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)}&&!b.disabled);if(!b)throw Error('Missing button '+${JSON.stringify(label)});b.click()})()`)
const check=async(name,c)=>{report.checks.push({name,pass:!!await js(c),detail:await js('JSON.stringify(window.qaProductState?.spec)')});persist()}
app.whenReady().then(async()=>{try{
 win=new BrowserWindow({width:1500,height:1000,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}})
 win.webContents.on('console-message',e=>{if(e.level==='error')report.events.push(e.message)})
 await win.loadURL('http://127.0.0.1:5173/qa/full-audit.html');await wait('window.qaFullReady')
 await js(`(async()=>{
 const {default:React}=await import('/node_modules/.vite/deps/react.js'),{default:ReactDOM}=await import('/node_modules/.vite/deps/react-dom_client.js'),{default:AppGenerator}=await import('/src/pages/AppGenerator.jsx'),{ToastProvider}=await import('/src/ui/Toast.jsx'),{useCanvasStore}=await import('/src/vilsem/canvasStore.js');
 window.qaSaved=[];window.qaSaveCalls=[];
 Object.assign(window.semantica,{getAiStatus:async()=>({anyConfigured:true,anthropic:{configured:true}}),getMeasures:async()=>({measures:[{name:'Revenue'},{name:'Cost'},{name:'Units'}]}),getDimensions:async()=>({tables:[{name:'QA',columns:[{name:'Category',dataType:'string'},{name:'Product',dataType:'string'}]}]}),getWorkspaceConfig:async()=>({datasetId:'qa',workspaceId:'qa'}),loadCustomTemplates:async()=>[],getAppSpecs:async()=>window.qaSaved,getAiModels:async()=>({anthropic:[]}),saveAppSpec:async p=>{window.qaSaveCalls.push(p);window.qaSaved=[{...p,id:1}];return {id:1}}});
 function Observer(){window.qaProductState=useCanvasStore();return null}
 const el=document.createElement('div');document.body.append(el);window.qaProductRoot=ReactDOM.createRoot(el);
 window.qaProductMount=spec=>window.qaProductRoot.render(React.createElement(ToastProvider,null,React.createElement(Observer),React.createElement(AppGenerator,{key:Date.now(),initialSpec:spec,initialProjectId:1,initialProjectName:'QA project'})));
 window.qaProductMount(window.qaFull.makeSpec('bar'));
 })()`)
 await wait('window.qaProductState?.spec?.pages?.length===1')
 await check('existing project opens with one bar','window.qaProductState.spec.pages[0].visuals[0].type==="bar"')
 await js(`[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Visual').at(-1).click()`);await wait(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Bar')`);await click('Bar');await wait('window.qaProductState.spec.pages[0].visuals.length===2')
 await check('palette creates and selects visual','!!window.qaProductState.selectedId')
 await click('Duplicate');await wait('window.qaProductState.spec.pages[0].visuals.length===3')
 await check('duplicate creates unique ID','new Set(window.qaProductState.spec.pages[0].visuals.map(v=>v.id)).size===3')
 await click('Delete');await wait('window.qaProductState.spec.pages[0].visuals.length===2')
 await check('delete removes selected visual','window.qaProductState.spec.pages[0].visuals.length===2')
 await js('window.qaProductState.onSelect(window.qaProductState.spec.pages[0].visuals[1].id)');await wait(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Data')`);await click('Data')
 await wait(`[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Add measure'))`)
 await js(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Add measure')).click()`)
 await wait(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Revenue')`);await click('Revenue')
 await wait('window.qaProductState.spec.pages[0].visuals[1].data.measures.length===1')
 await check('inspector binds measure to new visual','window.qaProductState.spec.pages[0].visuals[1].data.measures[0]==="Revenue"')
 await click('Save');await wait('window.qaSaveCalls.length===1')
 await check('save includes page configuration','window.qaSaveCalls[0].spec.pages[0].visuals.length===2')
 await js('window.qaProductMount(window.qaSaved[0].spec)');await js('window.qaFull.settle()');await wait('window.qaProductState?.spec?.pages?.[0]?.visuals?.length===2')
 await check('saved spec reopens through initialSpec','window.qaProductState.spec.pages[0].visuals.length===2')
 await js(`window.qaAiCalls=[];window.semantica.patchAppSpec=async p=>{window.qaAiCalls.push(p);return {patches:[{op:'replace',path:'/visuals/0/config/title',value:'AI audit title'}],provider:'qa'}};window.qaProductState.onSelect('qa')`)
 await wait(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='AI'||b.textContent.trim()==='✨ AI')`)
 await js(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='AI'||b.textContent.trim()==='✨ AI').click()`)
 await wait(`document.querySelector('textarea[placeholder^="e.g. set sparkline"]')`)
 await js(`(()=>{const e=document.querySelector('textarea[placeholder^="e.g. set sparkline"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'Set title to AI audit title');e.dispatchEvent(new Event('input',{bubbles:true}))})()`)
 await wait(`[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Apply Changes')&&!b.disabled)`)
 await js(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Apply Changes')).click()`)
 await wait('window.qaProductState.spec.pages[0].visuals[0].config.title==="AI audit title"')
 await check('AI inspector response updates selected visual through production refine flow','window.qaAiCalls[0].userRequest.includes("Only patch /visuals/0/config")&&window.qaProductState.spec.pages[0].visuals[0].config.title==="AI audit title"')
 await js(`document.querySelector('button[title="Add page"]').click()`);await wait('window.qaProductState.spec.pages.length===2')
 await check('adding page retains original visuals and creates empty page','window.qaProductState.spec.pages[0].visuals.length===2&&window.qaProductState.spec.pages[1].visuals.length===0')
 await click('Save');await wait('window.qaSaveCalls.length===2')
 await check('multi-page save retains both pages','window.qaSaveCalls[1].spec.pages.length===2&&window.qaSaveCalls[1].spec.pages[0].visuals[0].config.title==="AI audit title"')
 report.complete=true;persist();app.exit(report.checks.some(c=>!c.pass)?1:0)
 }catch(e){report.events.push({fatal:e.stack,body:await js('document.body.innerText.slice(-6000)'),aiCalls:await js('JSON.stringify(window.qaAiCalls)'),buttons:await js('[...document.querySelectorAll("button")].map(b=>b.textContent.trim()).slice(0,100)')});persist();app.exit(1)}})
