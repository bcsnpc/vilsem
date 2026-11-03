const fs=require('node:fs'),path=require('node:path'),ts=require('typescript')
const {app,BrowserWindow}=require('electron/main')
app.setPath('userData',path.resolve('cache/qa-pbi-waffle'));app.disableHardwareAcceleration()
const report={scope:'Production Power BI adapter with bundled app Waffle in native Chromium',checks:[],errors:[]}
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,allowJs:true}}).outputText
app.whenReady().then(async()=>{
  const win=new BrowserWindow({width:1000,height:700});const js=s=>win.webContents.executeJavaScript(s)
  win.webContents.on('console-message',e=>{if(e.level==='error')report.errors.push(e.message)})
  try{
    const html=path.resolve('cache/powerbi-dom/qa.html')
    fs.writeFileSync(html,'<html><body><div id="pbi" style="position:relative;width:480px;height:320px"></div></body></html>')
    await win.loadFile(html)
    await js(`import('./powerbiDom.js').then(m=>{window.domBridge=m})`)
    const helpers={
      './palettes.js':compile('ui/src/appspec/shared/palettes.js'),
      './appspec/shared/chrome.js':compile('ui/src/appspec/shared/chrome.js'),
      './appspec/shared/chartTitle.js':compile('ui/src/appspec/shared/chartTitle.js'),
      './appspec/getThemeTokens':compile('ui/src/appspec/getThemeTokens.ts'),
    }
    await js(`(()=>{const modules=${JSON.stringify(helpers)},require=n=>{if(n==='../generated/powerbiDom.js')return domBridge;if(modules[n]){const exports={};new Function('exports','require',modules[n])(exports,require);return exports}return n==='echarts/core'?{use(){}}:{}};const exports={};${compile('vilsem-renderer/src/visual.ts')};window.visual=new exports.Visual({element:document.querySelector('#pbi'),host:{createSelectionManager:()=>({})}});window.draw=(values,config={},theme='dark')=>visual.renderPrimitiveChart({categorical:{categories:[{values:values.map((_,i)=>'Long category '+i+' <b>literal</b>')}],values:[{source:{displayName:'Value'},values}]}},{type:'waffle',canvasTheme:theme,config:{cardStyle:'plain',customColors:['#ff0000','#00ff00','#0000ff'],...config}})})()`)
    for(const theme of ['dark','light'])for(const values of [[],[42],[0],[-5],[1,1,1],[0,0,0],[-1,2,3],[1e300,1e300]]){
      const state=await js(`(()=>{draw(${JSON.stringify(values)},{cellSize:13,cellGap:3,cellRadius:4},'${theme}');const grid=[...document.querySelectorAll('#pbi div')].find(e=>e.style.gridTemplateColumns.includes('repeat(10'));return {cells:grid.children.length,size:grid.firstElementChild.style.width,radius:grid.firstElementChild.style.borderRadius,gap:grid.style.gap,text:visual.root.innerText,markup:visual.root.querySelectorAll('b').length,colored:[...grid.children].filter(e=>['rgb(255, 0, 0)','rgb(0, 255, 0)','rgb(0, 0, 255)'].includes(e.style.background)).length}})()`)
      report.checks.push({theme,values,...state,pass:state.cells===100&&state.size==='13px'&&state.radius==='4px'&&state.gap==='3px'&&!state.text.includes('NaN')&&state.markup===0&&(values.length<2||state.colored===(values.some(Boolean)?100:0))})
    }
    for(const values of [[42],[1,2,3]])for(const width of [80,160,480])for(const height of [60,320]){
      const state=await js(`(()=>{visual.root.style.width='${width}px';visual.root.style.height='${height}px';draw(${JSON.stringify(values)});const grid=[...visual.root.querySelectorAll('div')].find(e=>e.style.gridTemplateColumns.includes('repeat(10')),viewport=grid.parentElement.parentElement;viewport.scrollTop=viewport.scrollHeight;grid.scrollLeft=grid.scrollWidth;const g=grid.getBoundingClientRect(),v=viewport.getBoundingClientRect(),cell=grid.lastElementChild.getBoundingClientRect(),label=grid.nextElementSibling.getBoundingClientRect();return {lastCell:cell.right<=g.right+1,label:label.bottom<=v.bottom+1,bounds:g.left>=v.left-1&&g.right<=v.right+1}})()`)
      report.checks.push({values,width,height,...state,pass:Object.values(state).every(Boolean)})
    }
    for(const type of ['bullet','progress'])for(const config of [{},{showTitle:false},{cardStyle:'plain'}]){
      const state=await js(`(()=>{visual.renderPrimitiveChart({categorical:{categories:[],values:[{source:{displayName:'Sales'},values:[125]},{source:{displayName:'Goal'},values:[150]}]}},{type:'${type}',canvasTheme:'dark',config:{title:'Unique card title',...${JSON.stringify(config)}}});return {titles:visual.root.innerText.split('Unique card title').length-1,bars:visual.root.querySelectorAll('[data-format-target="value-bar"]').length,caption:visual.root.innerText.includes('(target:')}})()`)
      report.checks.push({type,config,titleOwnership:true,...state,pass:state.titles===(config.showTitle===false||config.cardStyle==='plain'?0:1)&&state.bars===1&&!state.caption})
    }
    for(const type of ['stat_card','metric_tile'])for(const theme of ['dark','light'])for(const value of [0,50,null]){
      const state=await js(`(()=>{visual.root.style.width='480px';visual.root.style.height='320px';visual.renderPrimitiveChart({categorical:{categories:[],values:[{source:{displayName:'Sales'},values:[${JSON.stringify(value)}]},{source:{displayName:'Prior'},values:[100]}]}},{type:'${type}',canvasTheme:'${theme}',config:{title:'Scalar title',valueFontSize:35,valueColor:'#ff0000',maxValue:200,ringColor:'#00ff00'}});const root=visual.root;return {text:root.innerText,titles:root.innerText.split('Scalar title').length-1,comparison:!!root.querySelector('[data-format-target="comparison"]'),ring:!!root.querySelector('[data-format-target="metric-ring"]'),styled:[...root.querySelectorAll('div')].some(e=>e.style.fontSize==='35px'&&e.style.color==='rgb(255, 0, 0)')}})()`)
      report.checks.push({type,theme,value,...state,pass:state.titles===1&&state.styled&&!state.text.includes('NaN')&&(type==='stat_card'?state.comparison===(value!==null):state.ring)})
    }
    for(const type of ['funnel','waterfall','heatmap','ranked_list','chord','sankey','sunburst','narrative','insight'])for(const theme of ['dark','light'])for(const values of [[25,50],[0,0],[-20,50],[]]){
      await js(`(()=>{visual.root.style.width='480px';visual.root.style.height='320px';visual.renderPrimitiveChart({categorical:{categories:[{values:${JSON.stringify(values.map((_,i)=>'Category '+i))}}],values:[{source:{displayName:'Sales'},values:${JSON.stringify(values)}}]}},{type:'${type}',canvasTheme:'${theme}',config:{title:'Renderer title',animationEnabled:false,animations:false}})})()`)
      await js(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`)
      const state=await js(`(()=>{const root=visual.root;return {type:root.querySelector('[data-powerbi-dom-visual]')?.dataset.powerbiDomVisual,text:root.innerText,titles:root.innerText.split('Renderer title').length-1,invalid:/NaN|Infinity/.test(root.innerHTML),marks:root.querySelectorAll('svg,path,rect').length}})()`)
      report.checks.push({type,theme,values,...state,pass:state.type===type&&state.titles===1&&!state.invalid})
    }
    for(const type of ['shape','divider'])for(const config of (type==='shape'?['rectangle','rounded','ellipse','triangle','diamond','pentagon','hexagon','star','arrow','chevron','line'].map(shape=>({shape,fillColor:'#ff0000',borderColor:'#0000ff',borderWidth:3})):['horizontal','vertical'].flatMap(orientation=>['solid','dashed','dotted'].map(style=>({orientation,style,color:'#00ff00',thickness:7}))))){
      const state=await js(`(()=>{visual.bakedSpecRaw=()=>JSON.stringify({type:'${type}',config:${JSON.stringify(config)}});visual.update({dataViews:[]});const container=visual.root.querySelector('[data-powerbi-dom-visual]'),mark=container?.querySelector('svg')?.firstElementChild,line=container?.firstElementChild?.firstElementChild;return {mounted:container?.dataset.powerbiDomVisual,text:visual.root.innerText,fill:mark?.getAttribute('fill'),stroke:mark?.getAttribute('stroke'),line:line?{width:line.style.width,height:line.style.height,background:line.style.background,gradient:line.style.backgroundImage}:null}})()`)
      const pass=state.mounted===type&&state.text===''&&(type==='shape'?state.stroke==='#0000ff'&&(config.shape==='line'||state.fill==='#ff0000'):state.line[config.orientation==='vertical'?'width':'height']==='7px'&&(config.style==='solid'?state.line.background==='rgb(0, 255, 0)':state.line.gradient.includes('rgb(0, 255, 0)')))
      report.checks.push({type,config,noData:true,...state,pass})
    }
    const emptyPalette=await js(`(()=>{draw([1,2,3],{customColors:[]});const grid=[...visual.root.querySelectorAll('div')].find(e=>e.style.gridTemplateColumns.includes('repeat(10'));return {colored:[...grid.children].filter(e=>!!e.style.background).length}})()`)
    report.checks.push({name:'Empty custom palette falls back to default colors',...emptyPalette,pass:emptyPalette.colored===100})
    const lifecycle=await js(`(()=>{const previous=visual.domVisual;draw([25],{maxValue:50,prefix:'$',suffix:'!'});const text=visual.root.innerText;let rejected=false;try{previous.update([], {})}catch{rejected=true}visual.destroy();visual.destroy();return {rejected,empty:!visual.root.innerText,cleared:visual.domVisual===null,formatted:text.includes('$25!')&&text.includes('$50!')}})()`)
    report.checks.push({lifecycle,...lifecycle,pass:Object.values(lifecycle).every(Boolean)})
  }catch(error){report.error=error.stack}
  fs.writeFileSync('docs/qa/evidence/powerbi-waffle.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));app.exit(report.error||report.errors.length||report.checks.some(c=>!c.pass)?1:0)
})
