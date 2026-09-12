import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import * as echarts from 'echarts/core'
import CanvasEditor from '../src/appspec/CanvasEditor.jsx'
import AppSpecRenderer from '../src/appspec/AppSpecRenderer.jsx'
import VisualInspector from '../src/appspec/VisualInspector.jsx'
import VisualBoundary from '../src/appspec/shared/VisualBoundary.jsx'
import { VISUAL_MAP } from '../src/appspec/visuals/index.js'
import { EXAMPLE_TEMPLATES } from '../src/playground/examples/index.js'
import { isBareVisual, validateAppSpec } from '../src/appspec/schema.js'
import '../src/index.css'
import '../src/ui/tokens.css'
import '../src/ui/components.css'
import '../src/vilsem/tokens.css'

// No remote service or application credentials: this is a deterministic transport adapter.
const clone = x => JSON.parse(JSON.stringify(x))
const standard = ['North','South','East','West'].map((category,i)=>({ category, product: `Product ${i}`, date:`2026-0${i%2+1}-01`, Revenue:25*(i+1), Cost:15*(i+1), Units:i+1 }))
let fixture = 'standard', pending = 0, requests = [], state, change, revision = 0
const dataRows = () => fixture === 'empty' || fixture === 'error' ? [] : fixture === 'one' ? standard.slice(0,1) : fixture === 'zero' ? standard.map(r=>({...r,Revenue:0,Cost:0})) : fixture === 'negative' ? standard.map((r,i)=>({...r,Revenue:-25*(i+1)})) : fixture === 'mixed' ? standard.map((r,i)=>({...r,Revenue:[-100,0,1e-8,1e12][i]})) : fixture === 'nulls' ? standard.map((r,i)=>({...r,Revenue:i%2?null:r.Revenue,category:i===0?null:r.category})) : fixture === 'markup' ? standard.map(r=>({...r,category:'<b data-qa-markup="yes">'+r.category+'</b>'})) : fixture === 'long' ? Array.from({length:120},(_,i)=>({...standard[i%4],category:`${i}: 日本語 Ω & <QA> ${'Very long category '.repeat(8)}`,Revenue:i+1})) : standard
const valFor = (r,ref) => /date/i.test(ref) ? r.date : /product/i.test(ref) ? r.product : r.category
const filterRows = filters => dataRows().filter(r=>Object.entries(filters||{}).every(([k,v])=>v==null || (Array.isArray(v) ? v.includes(valFor(r,k)) : typeof v==='object' ? true : String(valFor(r,k))===String(v))))
async function track(method,params,fn) { pending++; requests.push({method,params:clone(params||{})}); try { return fn() } finally { pending-- } }
window.semantica = {
  query: p=>track('query',p,()=> fixture==='error'?{error:'QA query failure',message:'QA query failure'}:{data:Object.fromEntries((p.measures||[]).map(m=>[m,filterRows(p.filters).reduce((s,r)=>s+(r[m]||0),0)]))}),
  queryTable: p=>track('queryTable',p,()=>fixture==='error'?{error:'QA query failure',message:'QA query failure'}:{rows:filterRows(p.filters).slice(0,p.limit||1000).map(r=>({...Object.fromEntries((p.groupBy||[]).map(ref=>[ref,valFor(r,ref)])),...Object.fromEntries((p.measures||[]).map(m=>[m,r[m]??null]))}))}),
  getDistinctValues: p=>track('getDistinctValues',p,()=>({values:[...new Set(dataRows().map(r=>valFor(r,p.column)))]})),
  getModelContext: async()=>({measures:['Revenue','Cost','Units'].map(name=>({name})), tables:[{name:'QA',type:'dimension',columns:[{name:'Category',dataType:'string'},{name:'Product',dataType:'string'}]},{name:'Date',type:'date',columns:[{name:'Date',dataType:'dateTime'}]}]}),
}
const root = createRoot(document.getElementById('qa-root'))
const frames = async()=>{ for(let i=0;i<2;i++) await new Promise(requestAnimationFrame) }
async function settle() {
  // React effects, ResizeObserver and ECharts resize may settle on different frames.
  // Require stable measured geometry across frames before recording evidence.
  let previous='',stable=0;const end=performance.now()+5000
  while(performance.now()<end&&stable<4){await frames();const geometry=JSON.stringify([...document.querySelectorAll('#qa-host,#qa-host canvas,#qa-host svg')].map(e=>{const r=e.getBoundingClientRect();return [r.width,r.height]}));stable=!pending&&geometry===previous?stable+1:0;previous=geometry}
}
const inlineImage = 'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#14b8a6"/></svg>')
function makeSpec(type) {
  const scalar = ['kpi','stat_card','metric_tile','sparkline_kpi','gauge','bullet','progress'].includes(type)
  const v={id:'qa',type,position:{x:0,y:0,w:8,h:4},data:{measures:isBareVisual(type)?[]:['Revenue','Cost','Units'],groupBy:scalar?null:{table:'QA',column:'Category'},orderBy:'desc',limit:20},config:{title:`QA ${type}`,animations:false,animationEnabled:false,countUp:false}}
  if(type==='table') v.data.dimensions=[{table:'QA',column:'Category'},{table:'QA',column:'Product'}]
  if(type==='bar_race') v.config.playAxis='Date[Date]'
  if(type==='text_box') v.config.html='<p>QA text <b>bold</b></p>'
  if(type==='image') v.config.imageUrl=inlineImage
  if(type==='nav_button') Object.assign(v.config,{label:'Go to detail',targetPageId:'page2'})
  if(type==='custom') v.customTemplateId='donut'
  return {version:'1.0',title:'QA audit',layout:{freeform:true,columns:12,rowHeight:80,gap:8,pageWidth:900,pageHeight:720},theme:{mode:'light'},customVisuals:{donut:EXAMPLE_TEMPLATES.find(t=>t.meta.id==='donut')},visuals:[v],slicers:[]}
}
function Harness({initial,host,width=900,inspector=true,zoom=1}) {
  const [spec,setSpec]=useState(initial)
  state=spec
  change=fn=>{flushSync(()=>setSpec(s=>{const n=clone(s);fn(n);return n}));revision++}
  return <div style={{display:'flex',gap:16,padding:12,background:'#f1f5f9',alignItems:'flex-start'}}>
    <div id="qa-host" style={{width,flexShrink:0,transform:`scale(${zoom})`,transformOrigin:'top left'}}>
      <VisualBoundary resetKey={revision}>
        {host==='editor'?<CanvasEditor spec={spec} theme="light" selectedId="qa" zoom={zoom} onSelect={()=>{}} onSpecChange={(id,pos)=>change(s=>{s.visuals.find(v=>v.id===id).position=pos})} onConfigChange={(id,p)=>change(s=>Object.assign(s.visuals.find(v=>v.id===id).config,p))}/>:<AppSpecRenderer spec={spec} theme="light" canvasWidth={width} availableMeasures={['Revenue','Cost','Units']} onNavigatePage={id=>{window.qaNavigation=id}}/>}
      </VisualBoundary>
    </div>
    {inspector&&<div id="qa-inspector" style={{width:350,height:920,position:'relative',flexShrink:0}}>
      <VisualInspector embedded visual={spec.visuals[0]} selectedVisualId="qa" canvasTheme="light" editSpec={change} customTemplate={spec.customVisuals?.[spec.visuals[0].customTemplateId]} pages={[{id:'page1',name:'Overview'},{id:'page2',name:'Details'}]} onClose={()=>{}} onDelete={()=>{}} onDuplicate={()=>{}} onAiRefine={async()=>false}/>
    </div>}
  </div>
}
async function mount(type,host='editor',options={}) { fixture=options.fixture||'standard';requests=[];window.qaNavigation=null;flushSync(()=>root.render(<Harness key={`${type}:${host}:${Date.now()}`} initial={options.spec||makeSpec(type)} host={host} {...options}/>));await settle();return snapshot() }
function chartInstances() {return [...document.querySelectorAll('#qa-host [_echarts_instance_]')].map(el=>echarts.getInstanceByDom(el)).filter(Boolean)}
function hash(s) {let n=2166136261;for(let i=0;i<s.length;i++)n=Math.imul(n^s.charCodeAt(i),16777619);return (n>>>0).toString(16)}
function renderFingerprint() {
  const el=document.getElementById('qa-host')
  const styles=[...el.querySelectorAll('span,div,text,img,svg,path')].slice(0,700).map(e=>{const s=getComputedStyle(e);return [e.tagName,e.childElementCount?null:e.textContent,s.fontSize,s.fontWeight,s.color,s.backgroundColor,s.display,s.textAlign,s.width,s.height]})
  return hash(JSON.stringify({text:el.innerText,styles,charts:chartInstances().map(c=>c.getOption())},(_k,v)=>typeof v==='function'?String(v):v))
}
function snapshot(){const el=document.getElementById('qa-host');return {spec:clone(state),requests:clone(requests),text:el.innerText.slice(0,1800),fingerprint:renderFingerprint(),charts:chartInstances().map(c=>({series:((c.getOption()||{}).series||[]).map(s=>({type:s.type,stack:s.stack,area:!!s.areaStyle,data:s.data?.slice(0,6)})),width:c.getWidth(),height:c.getHeight()})),navigation:window.qaNavigation}}
function controlLabel(el) {let p=el.parentElement;for(let n=0;n<4&&p;n++,p=p.parentElement){const span=[...p.children].find(c=>c.tagName==='SPAN'&&c.textContent.trim());if(span)return span.textContent.trim();const label=p.querySelector(':scope > label');if(label)return label.textContent.trim()}return el.placeholder||el.getAttribute('aria-label')||el.type||el.tagName}
function controls() {return [...document.querySelectorAll('#qa-inspector input,#qa-inspector select,#qa-inspector textarea')].filter(el=>!el.disabled&&el.type!=='file'&&getComputedStyle(el).display!=='none'&&el.getClientRects().length).map((el,index)=>({el,index,label:controlLabel(el),tag:el.tagName,type:el.type,value:el.type==='checkbox'?el.checked:el.value,options:el.tagName==='SELECT'?[...el.options].map(o=>({value:o.value,label:o.text})):undefined}))}
async function tab(name){const b=[...document.querySelectorAll('#qa-inspector button')].find(b=>b.textContent.trim().toLowerCase()===name);if(b){b.click();await settle()}return !!b}
function writeControl(el,value) {
  if(el.type==='checkbox'){if(el.checked!==value)el.click();return}
  const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto,'value').set.call(el,String(value))
  el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}))
  if(el.tagName!=='SELECT')el.dispatchEvent(new Event('change',{bubbles:true}))
}
function changedPaths(a,b,p='') {if(JSON.stringify(a)===JSON.stringify(b))return [];if(!a||!b||typeof a!=='object'||typeof b!=='object')return [{path:p,before:a,after:b}];return [...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(k=>changedPaths(a[k],b[k],`${p}/${k}`))}
function alternate(c) {if(c.type==='checkbox')return !c.value;if(c.tag==='SELECT')return c.options.find(o=>o.value!==c.value&&o.value!=='')?.value;if(c.type==='color')return c.value==='#d946ef'?'#2563eb':'#d946ef';if(['range','number'].includes(c.type)){const min=Number(c.el.min||0),max=Number(c.el.max||999),step=Number(c.el.step||1);return Math.min(max,Math.max(min,Number(c.value||min)+step*2))===Number(c.value)?min:Math.min(max,Math.max(min,Number(c.value||min)+step*2))}return /color|colour|fill|stroke|accent|bg|hex/i.test(c.label)?'#d946ef':c.value==='QA changed'?'QA alternate':'QA changed'}
async function properties(type,variant='default',onlyLabels=null) {
  await mount(type)
  if(variant==='expanded') {change(s=>Object.assign(s.visuals[0].config,{showSparkline:true,showTrend:true,showProgress:true,showIcon:true,gridLines:true,gradient:true,dataLabels:true,showLegend:true,showAvgLine:true,conditionalColor:true,tooltipEnabled:true}));await settle()}
  const results=[]
  for(const name of ['style','text','layout']) {
    await tab(name)
    const descriptors=controls().filter(c=>!onlyLabels||onlyLabels.includes(c.label)).map(c=>({index:c.index,label:c.label,tag:c.tag,type:c.type}))
    for(const d of descriptors) {
      // Restore only the spec; the inspector tab stays mounted. Conditional controls
      // are explored in a second pass, not assumed to exist for all configurations.
      const baseline=clone(state)
      const c=controls().find(c=>c.index===d.index&&c.label===d.label&&c.type===d.type)
      if(!c){results.push({...d,typeId:type,variant,tab:name,status:'CONTROL_CHANGED_DURING_ENUMERATION'});continue}
      const value=alternate(c)
      if(value===undefined){results.push({...d,typeId:type,variant,tab:name,status:'NO_ALTERNATIVE'});continue}
      const before=renderFingerprint()
      writeControl(c.el,value);await settle()
      const diff=changedPaths(baseline,state)
      results.push({typeId:type,variant,tab:name,label:c.label,input:c.type,from:c.value,to:value,diff,renderChanged:before!==renderFingerprint(),status:diff.length?'STATE_UPDATED':'NO_STATE_CHANGE'})
      change(s=>{for(const k of Object.keys(s))delete s[k];Object.assign(s,baseline)});await settle()
    }
  }
  return results
}
window.qaFull={getCharts:chartInstances,mount,tab,controls:()=>controls().map(({el,...c})=>c),properties,snapshot,settle,change:async patch=>{change(s=>Object.assign(s.visuals[0].config,patch));await settle();return snapshot()},setData:async patch=>{requests=[];change(s=>Object.assign(s.visuals[0].data,patch));await settle();return snapshot()},setFixture:async name=>{fixture=name;requests=[];change(s=>s.visuals[0].data.limit++);await settle();return snapshot()},setSpec:async spec=>{change(s=>{for(const k of Object.keys(s))delete s[k];Object.assign(s,clone(spec))});await settle();return snapshot()},makeSpec,types:Object.keys(VISUAL_MAP),templates:EXAMPLE_TEMPLATES,chartClick:async(index=0)=>{const c=chartInstances()[0];if(!c)return {missingChart:true};const s=c.getOption().series?.[0],item=s?.data?.[index];c.trigger('click',{componentType:'series',seriesType:s?.type,dataIndex:index,name:typeof item==='object'?item.name||['North','South','East','West'][index]:['North','South','East','West'][index],value:typeof item==='object'?item.value:item,data:item});await settle();return snapshot()},validate:()=>validateAppSpec(state)}
window.qaFullReady=true
