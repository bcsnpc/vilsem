const fs=require('node:fs'),path=require('node:path')
const {app,BrowserWindow}=require('electron/main')
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/qa/evidence',process.argv.includes('--after')?'present-round.json':'present-round.json')
app.setPath('userData',path.join(root,'cache/qa-present-round'));app.disableHardwareAcceleration()
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
 const tall=window.qaFull.makeSpec('bar');tall.layout.pageHeight=2600;tall.visuals.push({...JSON.parse(JSON.stringify(tall.visuals[0])),id:'lower',position:{x:0,y:25,w:8,h:4},config:{title:'Lower visual',animations:false}});window.qaProductMount(tall);
 })()`)
 await wait('window.qaProductState?.spec?.pages?.length===1')
 await check('existing project opens with one bar','window.qaProductState.spec.pages[0].visuals[0].type==="bar"')

 const authored=await js('JSON.stringify(window.qaProductState.spec)');await click('Present');await wait('document.querySelector(".ag-present-root")');await wait('document.querySelector(".ag-present-root canvas")');await check('Present opens production renderer','!!document.querySelector(".ag-present-root canvas")');
 for(const width of [640,1280]){win.setSize(width,800);await js('window.qaFull.settle()');await check('Present width '+width+' fits viewport',`(()=>{const r=document.querySelector('.ag-present-root').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1})()`)}
 await wait(`document.querySelector('.ag-present-root')?.innerText.includes('Lower visual')`);const scrollable=await js(`(()=>{const root=document.querySelector('.ag-present-root'),scroll=[...root.querySelectorAll('div')].find(e=>getComputedStyle(e).overflowY==='auto'&&e.scrollHeight>e.clientHeight+50);if(!scroll)return false;scroll.scrollTop=scroll.scrollHeight;return scroll.scrollTop>0})()`);report.checks.push({name:'Tall Present page remains scrollable',pass:scrollable});
 await js(`window.roundKeys=[];window.addEventListener('keydown',e=>window.roundKeys.push({key:e.key,code:e.code}))`);win.focus();win.webContents.focus();win.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});await js(`new Promise(r=>{let n=0;const f=()=>++n>10?r():requestAnimationFrame(f);f()})`);report.nativeKeys=await js('window.roundKeys');await js(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);await wait('!document.querySelector(".ag-present-root")');await check('Escape handler exits without altering spec',`JSON.stringify(window.qaProductState.spec)===${JSON.stringify(authored)}`);
 await click('Present');await wait('document.querySelector(".ag-present-root")');await click('Exit');await wait('!document.querySelector(".ag-present-root")');await check('Exit returns to authoring','!!window.qaProductState.spec');

 report.complete=true;persist();app.exit(report.checks.some(c=>!c.pass)?1:0)
 }catch(e){report.events.push({fatal:e.stack,body:await js('document.body.innerText.slice(-6000)'),aiCalls:await js('JSON.stringify(window.qaAiCalls)'),buttons:await js('[...document.querySelectorAll("button")].map(b=>b.textContent.trim()).slice(0,100)')});persist();app.exit(1)}})
