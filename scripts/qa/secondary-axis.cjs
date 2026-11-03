const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const {app,BrowserWindow}=require('electron/main')
app.setPath('userData',path.resolve('cache/qa-secondary-axis'));app.disableHardwareAcceleration()
const report={checks:[],events:[]}
app.whenReady().then(async()=>{
  const win=new BrowserWindow({width:1500,height:1000,webPreferences:{backgroundThrottling:false}})
  win.webContents.on('console-message',e=>{if(e.level==='error')report.events.push(e.message)})
  const js=s=>win.webContents.executeJavaScript(s),call=(m,...args)=>js(`window.qaFull.${m}(...${JSON.stringify(args)})`)
  const change=async(label,value,group='Secondary axis')=>{
    await js(`(()=>{const panel=document.querySelector('[data-settings-panel="${group}"]'),label=[...panel.querySelectorAll('span')].find(e=>e.textContent===${JSON.stringify(label)});if(!label)throw Error('Control not found');const input=label.parentElement.querySelector('input,select');if(input.type==='checkbox'){if(input.checked!==${JSON.stringify(value)})input.click()}else{Object.getOwnPropertyDescriptor(input.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(String(value))});input.dispatchEvent(new Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}))}})()`)
    await call('settle')
  }
  const state=()=>js(`(()=>{const c=qaFull.getCharts()[0],o=c.getOption(),a=o.yAxis[1];return {count:o.yAxis.length,series:o.series.map(s=>({axis:s.yAxisIndex||0,stack:s.stack,data:s.data})),axis:a?{show:a.show,title:a.name,titleColor:a.nameTextStyle.color,titleSize:a.nameTextStyle.fontSize,titleWeight:a.nameTextStyle.fontWeight,titleGap:a.nameGap,labelColor:a.axisLabel.color,labelFamily:a.axisLabel.fontFamily,labelSize:a.axisLabel.fontSize,labelWeight:a.axisLabel.fontWeight,labelRotation:a.axisLabel.rotate,labelSpacing:a.axisLabel.margin,lineColor:a.axisLine.lineStyle.color,grid:a.splitLine.show,gridColor:a.splitLine.lineStyle.color,formatted:typeof a.axisLabel.formatter==='function'?a.axisLabel.formatter(12):null}:null}})()`)
  const controls=[['Show axis',false,'show'],['Title','Returns','title'],['Title color','#a855f7','titleColor'],['Title size',20,'titleSize'],['Title weight',800,'titleWeight'],['Title spacing',45,'titleGap'],['Label color','#e11d48','labelColor'],['Label font','Inter','labelFamily'],['Label size',18,'labelSize'],['Label weight',700,'labelWeight'],['Label rotation',25,'labelRotation'],['Label spacing',12,'labelSpacing'],['Axis line color','#10b981','lineColor'],['Grid lines',true,'grid'],['Grid color','#6366f1','gridColor'],['Number prefix','$','formatted','$12'],['Number suffix',' units','formatted','$12 units']]
  try {
    await win.loadURL('http://127.0.0.1:5173/qa/full-audit.html')
    await js(`new Promise((r,j)=>{const end=Date.now()+30000;const f=()=>window.qaFullReady?r():Date.now()>end?j(Error('Entry timeout')):requestAnimationFrame(f);f()})`)
    for(const type of ['line','area'])for(const host of ['editor','viewer']){
      await call('mount',type,host);await call('tab','style');const original=await state()
      await change('Independent scale',true);let current=await state()
      assert.equal(current.count,2);assert.equal(current.series[1].axis,1);assert.deepEqual(current.series.map(s=>s.data),original.series.map(s=>s.data))
      report.checks.push({type,host,control:'Independent scale',pass:true})
      for(const[label,value,key,expected]of controls){await change(label,value);current=await state();assert.equal(current.axis[key],expected??value,`${type}/${host}/${label}`);report.checks.push({type,host,control:label,pass:true})}
      await change('Show axis',true)
      await change('Invert Y axis',true,'Axes');assert.equal((await state()).count,1)
      await change('Independent scale',true);assert.equal((await state()).count,2)
      if(type==='line'&&host==='editor')fs.writeFileSync('docs/qa/evidence/secondary-axis-settings.png',(await win.webContents.capturePage()).toPNG())
      if(type==='area'){await change('Stack series',true,'Shape');current=await state();assert.equal(current.count,1);assert.equal(current.series[1].stack,'total')}
      await change('Independent scale',true);current=await state();assert.equal(current.count,2);assert.ok(!current.series[1].stack)
      await call('setData',{measures:['Revenue']});assert.equal((await state()).count,1)
      await call('setData',{measures:['Revenue','Cost']});assert.equal((await state()).count,2)
      const saved=(await call('snapshot')).spec;await call('mount',type,host,{spec:saved});assert.equal((await state()).axis.labelColor,'#e11d48')
      await change('Independent scale',false);current=await state();assert.equal(current.count,1);assert.equal(current.series[1].axis,0)
      report.checks.push({type,host,control:'stack/remove-field/reopen/disable lifecycle',pass:true})
    }
    for(const type of ['slope','stacked_area','bump']){
      const spec=await call('makeSpec',type);Object.assign(spec.visuals[0].config,{secondaryAxisEnabled:true,stacked:false,invertY:false})
      await call('mount',type,'viewer',{spec,inspector:false});assert.equal((await state()).count,1)
      report.checks.push({type,control:'stale secondary-axis configuration excluded',pass:true})
    }
    for(const type of ['line','area'])for(const width of [160,320,640]){
      const spec=await call('makeSpec',type);spec.visuals[0].config={...spec.visuals[0].config,secondaryAxisEnabled:false,secondaryAxisTitle:'Returns',secondaryAxisLabelColor:'#e11d48',secondaryAxisLabelSize:18,secondaryAxisTitleSize:20}
      await call('mount',type,'viewer',{spec,width,inspector:false})
      await call('change',{secondaryAxisEnabled:true})
      const size=await js(`(()=>{const c=qaFull.getCharts()[0],r=c.getModel().getComponent('grid').coordinateSystem.getRect();return {width:c.getWidth(),height:c.getHeight(),plot:{x:r.x,y:r.y,width:r.width,height:r.height}}})()`)
      if(type==='line')fs.writeFileSync('docs/qa/evidence/secondary-axis-'+width+'.png',(await win.webContents.capturePage()).toPNG())
      assert.ok(size.plot.width>0&&size.plot.height>0,`${type}/${width}: drawable plot ${JSON.stringify(size)}`)
      report.checks.push({type,width,control:'resized independent axis',...size,pass:true})
      const reach=await js(`(()=>{const root=qaFull.getCharts()[0].getDom(),viewport=root.parentElement;viewport.scrollLeft=viewport.scrollWidth;return {right:root.getBoundingClientRect().right,edge:viewport.getBoundingClientRect().right,scroll:viewport.scrollLeft}})()`)
      assert.ok(reach.right<=reach.edge+1,`${type}/${width}: right axis reachable`)
      if(type==='line')fs.writeFileSync('docs/qa/evidence/secondary-axis-'+width+'-scrolled.png',(await win.webContents.capturePage()).toPNG())
      if(width===160){
        await js(`(()=>{const c=qaFull.getCharts()[0];c.getDom().parentElement.scrollLeft=0;c.dispatchAction({type:'showTip',seriesIndex:0,dataIndex:0})})()`);await call('settle')
        const tooltip=await js(`(()=>{const el=[...document.querySelectorAll('div')].find(e=>e.style.position==='absolute'&&['none','auto'].includes(e.style.pointerEvents)&&e.textContent.includes('North'));if(!el)return {found:false};const r=el.getBoundingClientRect();let clipped=false;for(let p=el.parentElement;p&&p!==document.body;p=p.parentElement){const s=getComputedStyle(p),b=p.getBoundingClientRect();if(/auto|hidden|scroll/.test(s.overflowX)&&(r.left<b.left-1||r.right>b.right+1))clipped=true}return {found:true,clipped,left:r.left,right:r.right,viewport:innerWidth}})()`)
        assert.ok(tooltip.found&&!tooltip.clipped&&tooltip.left>=0&&tooltip.right<=tooltip.viewport,`${type}: tooltip ${JSON.stringify(tooltip)}`)
        report.checks.push({type,control:'narrow chart tooltip remains visible',...tooltip,pass:true})
      }
    }
  }catch(e){report.error=e.stack}
  fs.writeFileSync('docs/qa/evidence/secondary-axis.json',JSON.stringify(report,null,2));console.log(JSON.stringify({checks:report.checks.length,error:report.error,events:report.events}));app.exit(report.error||report.events.length?1:0)
})
