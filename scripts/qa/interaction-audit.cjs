const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const {app,BrowserWindow}=require('electron/main')
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/qa/evidence'),profile=path.join(root,'cache/qa-interaction-profile')
fs.mkdirSync(profile,{recursive:true});app.setPath('userData',profile);app.disableHardwareAcceleration()
let win
const report={scope:'Native Electron mouse/keyboard events against production hosts; synthetic query transport',checks:[],templates:[],events:[]}
const js=c=>win.webContents.executeJavaScript(c),call=(m,...a)=>js(`window.qaFull.${m}(...${JSON.stringify(a)})`)
const settle=()=>call('settle')
async function check(name,fn){try{report.checks.push({name,status:'PASS',evidence:await fn()})}catch(e){report.checks.push({name,status:'FAIL',message:e.message})}}
async function click(x,y,modifiers=[]){win.webContents.sendInputEvent({type:'mouseMove',x:Math.round(x),y:Math.round(y)});win.webContents.sendInputEvent({type:'mouseDown',x:Math.round(x),y:Math.round(y),button:'left',clickCount:1,modifiers});win.webContents.sendInputEvent({type:'mouseUp',x:Math.round(x),y:Math.round(y),button:'left',clickCount:1,modifiers});await settle()}
async function chartPoint(i=0){return js(`(async()=>{const ec={getInstanceByDom:el=>window.qaFull.getCharts().find(c=>c.getDom()===el)};const el=document.querySelector('#qa-host [_echarts_instance_]');if(!el)throw Error('No chart instance');const c=ec.getInstanceByDom(el);const p=c.getModel().getSeriesByIndex(0).getData().getItemLayout(${i});if(!p)throw Error('No mark layout');const r=el.getBoundingClientRect();return {x:r.x+p.x+p.width/2,y:r.y+p.y+p.height/2}})()`)}
const filters=s=>s.requests.filter(q=>q.method==='query').map(q=>q.params.filters)
app.whenReady().then(async()=>{
  win=new BrowserWindow({width:1500,height:1000,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}})
  win.webContents.on('console-message',e=>{if(e.level==='error')report.events.push(e.message)})
  try{
    await win.loadURL('http://127.0.0.1:5173/qa/full-audit.html');await js(`new Promise(r=>{const f=()=>window.qaFullReady?r():requestAnimationFrame(f);f()})`)
    await check('Bar race tooltip changes apply immediately and reset to auto',async()=>{
      await call('mount','bar_race','viewer',{inspector:false})
      const results=[]
      for(const config of [{tooltipEnabled:false,tooltipTrigger:'axis'},{tooltipEnabled:true,tooltipTrigger:'item'},{tooltipEnabled:true,tooltipTrigger:'auto'}]){
        await call('change',config)
        const actual=await js(`(()=>{const t=qaFull.getCharts()[0].getOption().tooltip[0];return {show:t.show,trigger:t.trigger}})()`)
        assert.equal(actual.show,config.tooltipEnabled)
        assert.equal(actual.trigger,config.tooltipTrigger==='auto'?'item':config.tooltipTrigger)
        results.push({config,actual})
      }
      return results
    })
    const pair=await call('makeSpec','bar');pair.visuals.push({id:'other',type:'kpi',position:{x:8,y:0,w:4,h:4},data:{measures:['Revenue']},config:{title:'Total',animations:false,countUp:false}})
    await check('Native bar click cross-filters another visual',async()=>{await call('mount','bar','viewer',{spec:pair,inspector:false});const p=await chartPoint();await click(p.x,p.y);const s=await call('snapshot');assert.ok(filters(s).some(f=>f['QA[Category]']==='North'),'No category filter reached other visual query');return {filters:filters(s),text:s.text}})
    await check('Native repeat click deselects category',async()=>{const p=await chartPoint();await click(p.x,p.y);const s=await call('snapshot');assert.deepEqual(filters(s).at(-1),{});return {filters:filters(s)}})
    await check('Ctrl multi-select preserves both categories',async()=>{const a=await chartPoint(0);await click(a.x,a.y);const b=await chartPoint(1);await click(b.x,b.y,['control']);const s=await call('snapshot'),f=filters(s).at(-1)?.['QA[Category]'];assert.ok(Array.isArray(f)&&f.includes('North')&&f.includes('South'),`Observed filter: ${JSON.stringify(f)}`);return filters(s)})

    for(const type of ['bar','column','grouped_bar','stacked_bar']) {
      await check(type+' modifier selection lifecycle',async()=>{
        const spec=await call('makeSpec',type);spec.visuals.push(pair.visuals[1]);await call('mount',type,'viewer',{spec,inspector:false});
        let p=await chartPoint(0);await click(p.x,p.y);p=await chartPoint(1);await click(p.x,p.y,['control']);
        let f=filters(await call('snapshot')).at(-1)?.['QA[Category]'];assert.deepEqual(f,['North','South']);
        const opacity=await js(`(async()=>{const ec={getInstanceByDom:el=>window.qaFull.getCharts().find(c=>c.getDom()===el)},c=ec.getInstanceByDom(document.querySelector('#qa-host [_echarts_instance_]'));return c.getOption().series[0].data.map(d=>d.itemStyle?.opacity)})()`);assert.notEqual(opacity[0],0.25);assert.notEqual(opacity[1],0.25);assert.equal(opacity[2],0.25);
        p=await chartPoint(0);await click(p.x,p.y,['control']);assert.deepEqual(filters(await call('snapshot')).at(-1)?.['QA[Category]'],['South']);
        p=await chartPoint(1);await click(p.x,p.y,['control']);assert.deepEqual(filters(await call('snapshot')).at(-1),{});
        p=await chartPoint(0);await click(p.x,p.y);p=await chartPoint(1);await click(p.x,p.y);assert.equal(filters(await call('snapshot')).at(-1)?.['QA[Category]'],'South');
        return {type,selectedOpacity:opacity,steps:'add, remove, clear, plain replacement'};
      })
    }
    await check('Native hover tooltip remains inside viewport',async()=>{await call('mount','bar','viewer',{spec:pair,inspector:false});const p=await chartPoint();win.webContents.sendInputEvent({type:'mouseMove',x:Math.round(p.x),y:Math.round(p.y)});await settle();const tooltips=await js(`(()=>{return [...document.querySelectorAll('div')].filter(e=>e.style.zIndex==='9999999'&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none').map(e=>{const r=e.getBoundingClientRect();return {text:e.innerText,x:r.x,y:r.y,right:r.right,bottom:r.bottom,viewport:[innerWidth,innerHeight]}})})()`);assert.ok(tooltips.length,'No visible tooltip captured at readiness check');for(const t of tooltips)assert.ok(t.x>=0&&t.y>=0&&t.right<=t.viewport[0]&&t.bottom<=t.viewport[1]);return tooltips})
    for(const style of ['replace','expand','panel'])await check(`Native ${style} drill routes to child dimension`,async()=>{const spec=await call('makeSpec','bar');spec.visuals[0].data.drill=[{table:'QA',column:'Category'},{table:'QA',column:'Product'}];spec.visuals[0].config.drillStyle=style;await call('mount','bar','viewer',{spec,inspector:false});const p=await chartPoint();await click(p.x,p.y);const s=await call('snapshot');assert.ok(s.requests.some(q=>q.params.groupBy?.includes('QA[Product]')),'No child dimension query');return {queries:s.requests,text:s.text}})
    await check('Axis-switch pill changes query grouping',async()=>{const spec=await call('makeSpec','bar');spec.visuals[0].config.axisOptions=[{label:'Category',groupBy:{table:'QA',column:'Category'}},{label:'Product',groupBy:{table:'QA',column:'Product'}}];await call('mount','bar','viewer',{spec,inspector:false});const p=await js(`(()=>{const b=[...document.querySelectorAll('#qa-host button')].find(b=>b.innerText==='Product');if(!b)throw Error('Pill missing');const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await click(p.x,p.y);const s=await call('snapshot');assert.ok(s.requests.some(q=>q.params.groupBy?.includes('QA[Product]')));return s.requests})
    for(const dx of [70,1500])await check(`Native editor drag ${dx}px preserves positive width`,async()=>{await call('mount','bar','editor',{inspector:false});const p=await js(`(()=>{const t=[...document.querySelectorAll('#qa-host span')].find(e=>e.textContent==='QA bar');if(!t)throw Error('Title not found');const r=t.getBoundingClientRect();return {x:r.x+10,y:r.y+5}})()`);win.webContents.sendInputEvent({type:'mouseDown',x:Math.round(p.x),y:Math.round(p.y),button:'left',clickCount:1});await settle();win.webContents.sendInputEvent({type:'mouseMove',x:Math.round(p.x+dx),y:Math.round(p.y)});await settle();win.webContents.sendInputEvent({type:'mouseUp',x:Math.round(p.x+dx),y:Math.round(p.y),button:'left',clickCount:1});await settle();const s=await call('snapshot');assert.ok(s.spec.visuals[0].position.w>=1,JSON.stringify(s.spec.visuals[0].position));return s.spec.visuals[0].position})
    await check('Native resize changes width and preserves valid dimensions',async()=>{await call('mount','bar','editor',{inspector:false});const p=await js(`(()=>{const e=[...document.querySelectorAll('#qa-host div')].find(e=>e.style.cursor==='nwse-resize');if(!e)throw Error('Resize handle missing');const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);win.webContents.sendInputEvent({type:'mouseDown',x:Math.round(p.x),y:Math.round(p.y),button:'left',clickCount:1});await settle();win.webContents.sendInputEvent({type:'mouseMove',x:Math.round(p.x-100),y:Math.round(p.y-70)});await settle();win.webContents.sendInputEvent({type:'mouseUp',x:Math.round(p.x-100),y:Math.round(p.y-70),button:'left',clickCount:1});await settle();const s=await call('snapshot'),pos=s.spec.visuals[0].position;assert.ok(pos.w<8&&pos.w>=1&&pos.h>=1);return pos})
    // Benign markup proves whether untrusted category text is escaped, without executing scripts.
    for(const type of ['bar','line','pie','donut','scatter','bubble','treemap','radar'])await check(type+' tooltip category markup is rendered as text',async()=>{await call('mount',type,'viewer',{inspector:false,fixture:'markup'});const evidence=await js(`(async()=>{const ec={getInstanceByDom:el=>window.qaFull.getCharts().find(c=>c.getDom()===el)};const c=ec.getInstanceByDom(document.querySelector('#qa-host [_echarts_instance_]'));const f=c.getOption().tooltip?.[0]?.formatter;if(typeof f!=='function')throw Error('No tooltip formatter');const html=f({name:'<b data-qa-markup="yes">North</b>',value:${JSON.stringify(['scatter','bubble'].includes(type)?[25,10]:type==='radar'?[25,50,75,100]:25)},seriesName:'Revenue',color:'#14b8a6'});const d=document.createElement('div');d.innerHTML=html;return {interpretedMarkup:!!d.querySelector('[data-qa-markup]'),html}})()`);assert.equal(evidence.interpretedMarkup,false,'Category HTML interpreted as markup');assert.ok(evidence.html.includes('&lt;b'),'Tooltip must retain literal category text');return evidence})
    for(const type of ['pie','donut'])await check(`Single-category ${type} retains native slice cross-filter`,async()=>{
      const spec=await call('makeSpec',type);spec.visuals.push(pair.visuals[1]);await call('mount',type,'viewer',{spec,fixture:'one',inspector:false});
      const p=await js(`(()=>{const c=window.qaFull.getCharts()[0],el=c.getDom(),r=el.getBoundingClientRect(),d=c.getModel().getSeriesByIndex(0).getData().getItemLayout(0),angle=(d.startAngle+d.endAngle)/2,rad=(d.r+d.r0)/2;return{x:r.x+d.cx+Math.cos(angle)*rad,y:r.y+d.cy+Math.sin(angle)*rad}})()`);
      await click(p.x,p.y);const result=await call('snapshot');assert.equal(filters(result).at(-1)?.['QA[Category]'],'North');return {filters:filters(result),charts:result.charts};
    })
    for(const type of ['pie','donut'])await check(`${type} modifier selection lifecycle`,async()=>{
      const spec=await call('makeSpec',type);spec.visuals.push(pair.visuals[1]);await call('mount',type,'viewer',{spec,inspector:false});
      const point=async i=>js(`(()=>{const c=window.qaFull.getCharts()[0],r=c.getDom().getBoundingClientRect(),d=c.getModel().getSeriesByIndex(0).getData().getItemLayout(${i}),a=(d.startAngle+d.endAngle)/2,rad=(d.r+d.r0)/2;return{x:r.x+d.cx+Math.cos(a)*rad,y:r.y+d.cy+Math.sin(a)*rad}})()`);
      let p=await point(0);await click(p.x,p.y);p=await point(1);await click(p.x,p.y,['control']);
      assert.deepEqual(filters(await call('snapshot')).at(-1)?.['QA[Category]'],['North','South']);
      p=await point(0);await click(p.x,p.y,['control']);assert.deepEqual(filters(await call('snapshot')).at(-1)?.['QA[Category]'],['South']);
      p=await point(1);await click(p.x,p.y,['control']);assert.deepEqual(filters(await call('snapshot')).at(-1),{});
      return {steps:'add second category, remove first, clear final'};
    })
    for(const type of ['slope','lollipop'])await check(`${type} animation control changes renderer state`,async()=>{
      await call('mount',type,'viewer',{inspector:false});
      const enabled=()=>js(`window.qaFull.getCharts()[0].getOption().animation`);
      assert.equal(await enabled(),false,'Disabled animations must reach the renderer');
      await call('change',{animations:true,animationEnabled:true});assert.equal(await enabled(),true);
      await call('change',{animationEnabled:false});assert.equal(await enabled(),false);
      return {states:[false,true,false]};
    })
    for(const type of ['line','area','stacked_area','treemap','scatter','bubble','slope','lollipop'])await check(`${type} modifier selection lifecycle`,async()=>{
      const spec=await call('makeSpec',type);spec.visuals[0].config.showDots=true;spec.visuals[0].config.dotSize=8;spec.visuals.push(pair.visuals[1]);await call('mount',type,'viewer',{spec,inspector:false});
      const point=async name=>js(`(()=>{const c=window.qaFull.getCharts()[0],r=c.getDom().getBoundingClientRect(),type=${JSON.stringify(type)},series=type==='slope'?c.getModel().getSeries().find(s=>s.name===${JSON.stringify(name)}):c.getModel().getSeriesByIndex(type==='lollipop'?1:0),d=series.getData(),i=type==='slope'?0:type==='lollipop'?c.getOption().yAxis[0].data.indexOf(${JSON.stringify(name)}):d.indexOfName(${JSON.stringify(name)});if(i<0)throw Error('Category absent');if(${JSON.stringify(type)}==='treemap'){const el=d.getItemGraphicEl(i),b=el.getBoundingRect().clone();b.applyTransform(el.getComputedTransform());return{x:r.x+b.x+b.width/2,y:r.y+b.y+b.height/2}}const p=c.convertToPixel({seriesIndex:series.seriesIndex},[d.get(d.mapDimension('x'),i),d.get(d.mapDimension('y'),i)]);return{x:r.x+p[0],y:r.y+p[1]}})()`);
      let p=await point('North');await click(p.x,p.y);assert.equal(filters(await call('snapshot')).at(-1)?.['QA[Category]'],'North');
      p=await point('South');await click(p.x,p.y,['control']);assert.deepEqual(filters(await call('snapshot')).at(-1)?.['QA[Category]'],['North','South']);
      p=await point('North');await click(p.x,p.y,['control']);assert.deepEqual(filters(await call('snapshot')).at(-1)?.['QA[Category]'],['South']);
      p=await point('South');await click(p.x,p.y,['control']);assert.deepEqual(filters(await call('snapshot')).at(-1),{});
      return {steps:'add second category, remove first, clear final'};
    })
    await check('Vertical lollipop selects the category coordinate',async()=>{
      const spec=await call('makeSpec','lollipop');spec.visuals[0].config.orientation='vertical';spec.visuals.push(pair.visuals[1]);await call('mount','lollipop','viewer',{spec,inspector:false});
      const p=await js(`(()=>{const c=window.qaFull.getCharts()[0],r=c.getDom().getBoundingClientRect(),d=c.getModel().getSeriesByIndex(1).getData(),p=c.convertToPixel({seriesIndex:1},[d.get(d.mapDimension('x'),1),d.get(d.mapDimension('y'),1)]);return{x:r.x+p[0],y:r.y+p[1]}})()`);
      await click(p.x,p.y);const f=filters(await call('snapshot')).at(-1);assert.equal(f?.['QA[Category]'],'South');return f;
    })
    await check('Slope right endpoint selects the series category',async()=>{
      const spec=await call('makeSpec','slope');Object.assign(spec.visuals[0].config,{leftLabel:'Before',rightLabel:'After'});spec.visuals.push(pair.visuals[1]);await call('mount','slope','viewer',{spec,inspector:false});
      const p=await js(`(()=>{const c=window.qaFull.getCharts()[0],r=c.getDom().getBoundingClientRect(),s=c.getModel().getSeries().find(s=>s.name==='South'),d=s.getData(),p=c.convertToPixel({seriesIndex:s.seriesIndex},[1,d.get(d.mapDimension('y'),1)]);return{x:r.x+p[0],y:r.y+p[1]}})()`);
      await click(p.x,p.y);const f=filters(await call('snapshot')).at(-1);assert.equal(f?.['QA[Category]'],'South');return f;
    })
    await check('Radar spoke identity and Ctrl selection',async()=>{
      const spec=await call('makeSpec','radar');spec.visuals[0].config.showDots=true;spec.visuals.push(pair.visuals[1]);await call('mount','radar','viewer',{spec,inspector:false});
      const point=async i=>js(`(()=>{const c=window.qaFull.getCharts()[0],r=c.getDom().getBoundingClientRect(),p=c.getModel().getSeriesByIndex(0).getData().getItemLayout(0)[${i}];return {x:r.x+p[0],y:r.y+p[1]}})()`);
      let p=await point(1);await click(p.x,p.y);let s=await call('snapshot');assert.equal(filters(s).at(-1)?.['QA[Category]'],'South');
      p=await point(2);await click(p.x,p.y,['control']);s=await call('snapshot');assert.deepEqual(filters(s).at(-1)?.['QA[Category]'],['South','East']);return {filters:filters(s)};
    })
    const templates=await js('window.qaFull.templates')
    for(const template of templates){const s=await call('makeSpec','custom');s.customVisuals={[template.meta.id]:template};s.visuals[0].customTemplateId=template.meta.id;const dims=Object.entries(template.slots).filter(([,v])=>v.kind==='dimension').reduce((n,[,v])=>n+(v.count||1),0);if(dims>1)s.visuals[0].data.dimensions=[{table:'Date',column:'Date'},{table:'QA',column:'Category'}];else if(/calendar/.test(template.meta.id))s.visuals[0].data.groupBy={table:'Date',column:'Date'};for(const host of ['editor','viewer']){const r=await call('mount','custom',host,{spec:s,inspector:false});report.templates.push({id:template.meta.id,host,queries:r.requests,text:r.text,charts:r.charts})}}
    report.complete=true
  }catch(e){report.fatal=e.stack}
  fs.writeFileSync(path.join(out,process.argv.includes('--after')?'interaction-audit-after.json':'interaction-audit.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report.checks.map(({name,status,message})=>({name,status,message}))));app.exit(report.fatal||report.checks.some(c=>c.status==='FAIL')?1:0)
})
