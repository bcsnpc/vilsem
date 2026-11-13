import {beforeAll,afterAll,it,expect} from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import AdmZip from 'adm-zip'
import {chromium} from 'playwright-core'

const guid='semanticaRenderer4A7F2D9B8C3E1F5A6D4B2C8E9F1A3B7D'
let browser,metadata
beforeAll(async()=>{
 const candidates=[process.env.VILSEM_PREVIEW_BROWSER_PATH,...['PROGRAMFILES','PROGRAMFILES(X86)','LOCALAPPDATA'].flatMap(key=>['Microsoft/Edge/Application/msedge.exe','Google/Chrome/Application/chrome.exe'].map(file=>process.env[key]&&path.join(process.env[key]!,file)))].filter(Boolean)
 const executablePath=candidates.find(file=>fs.existsSync(file!))
 if(!executablePath)throw Error('Renderer security tests require local Chrome/Edge (or VILSEM_PREVIEW_BROWSER_PATH). No browser tests may be skipped for release.')
 const zip=new AdmZip('packages/core/assets/renderer.pbiviz')
 metadata=JSON.parse(zip.readAsText(zip.getEntries().find(e=>e.entryName.endsWith('.pbiviz.json'))!))
 // The bundled renderer must be the one built from this tree (sanitizer present since 4.44).
 const built=JSON.parse(fs.readFileSync('vilsem-renderer/pbiviz.json','utf8')).visual.version
 expect(metadata.visual).toMatchObject({guid,version:built})
 expect(Number(built.split('.')[1])).toBeGreaterThanOrEqual(44)
 browser=await chromium.launch({executablePath,headless:true,chromiumSandbox:true,env:Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^ELECTRON_/i.test(key)))})
},60000)
afterAll(async()=>{await browser?.close()})

async function fixture(){
 const page=await browser.newPage()
 await page.route('**/*',route=>route.abort())
 await page.clock.install()
 await page.clock.pauseAt(Date.now()+1000)
 await page.setContent('<div id="host" style="width:600px;height:400px"></div>')
 await page.addStyleTag({content:metadata.content.css})
 await page.evaluate(()=>{(window as any).powerbi={visuals:{plugins:{}}}})
 await page.addScriptTag({content:metadata.content.js})
 await page.evaluate(guid=>{
  const w=window as any;w.calls={select:[],clear:0};w.pwned=0
  const ids=['A','B'].map(name=>({name,equals(other){return other?.name===name},getKey(){return name}}))
  const selection={registerOnSelectCallback(){},getSelectionIds(){return []},select(id,multi){w.calls.select.push({name:id.name,multi});return Promise.resolve([id])},clear(){w.calls.clear++;return Promise.resolve([])}}
  const host={createSelectionManager:()=>selection,createSelectionIdBuilder:()=>{let index=0;const b={withCategory(_cat,i){index=i;return b},createSelectionId:()=>ids[index]};return b}}
  w.visual=w.powerbi.visuals.plugins[guid].create({element:document.getElementById('host'),host})
 },guid)
 return page
}

it.each(['single','categorical','selection'])('makes malicious %s HTML-measure content inert in the actual renderer',async mode=>{
 const page=await fixture()
 try{
  await page.evaluate(mode=>{
   const w=window as any,html='<div onclick="window.pwned++"><img src=x onerror="window.pwned++"><script>window.pwned++</script><a href="javascript:window.pwned++">link</a><svg onload="window.pwned++"><a xlink:href="javascript:window.pwned++">bad</a><foreignObject><iframe srcdoc="<script>parent.pwned++</script>"></iframe></foreignObject></svg><span>safe</span></div>'
   const categorical={values:[{source:{roles:{content:true}},values:[html]}],...(mode==='selection'?{categories:[{source:{queryName:'Items.Name'},values:['A']}]}:{})}
   w.visual.update({viewport:{width:600,height:400},dataViews:[mode==='single'?{single:{value:html}}:{categorical}]})
   document.querySelector('#host div[onclick]')?.dispatchEvent(new MouseEvent('click',{bubbles:true}))
  },mode)
  await page.clock.runFor(100)
  expect(await page.evaluate(()=>{
   const root=document.getElementById('host')!
   return {pwned:(window as any).pwned,dangerous:root.querySelectorAll('img,script,a,iframe,foreignObject,[onclick],[onerror],[onload],[href],[xlink\\:href]').length,text:root.textContent}
  })).toMatchObject({pwned:0,dangerous:0,text:expect.stringContaining('safe')})
 }finally{await page.close()}
})

it('preserves styled HTML, SVG, count-up, axis pills and category selection after sanitizing',async()=>{
 const page=await fixture()
 try{
  await page.evaluate(()=>{
   const html=`<div class="sbar-axis-pills"><button data-axis-idx="0" data-active-bg="#123456">First</button><button data-axis-idx="1" data-active-bg="#123456">Second</button></div>
    <style>.safe-label{font-weight:700}@keyframes entry{from{opacity:0}to{opacity:1}}</style>
    <div data-axis-section="0" style="display:flex;color:rgb(12, 34, 56)"><div data-sbar-cat="A"><span class="safe-label" data-countup="42" data-prefix="$" data-suffix="K">$42K</span><span class="sbar-tt" style="display:none">Tooltip A</span></div><div data-sbar-cat="B">B</div></div>
    <div data-axis-section="1" data-axis-table="Items" data-axis-column="Name" style="display:none"><span>Alternate</span></div>
    <svg viewBox="0 0 100 20"><defs><linearGradient id="grad"><stop offset="0%" stop-color="#123456"/></linearGradient></defs><path d="M0 0L10 10" stroke="#123456"/><rect width="10" height="10" fill="url(#grad)"/></svg>`
   ;(window as any).visual.update({viewport:{width:600,height:400},dataViews:[{categorical:{categories:[{source:{queryName:'Items.Name'},values:['A','B']}],values:[{source:{roles:{content:true}},values:[html,html]}]}}]})
  })
  await page.clock.runFor(1000)
  expect(await page.locator('[data-countup]').textContent()).toBe('$42K')
  expect(await page.locator('[data-axis-section="0"]').evaluate(el=>getComputedStyle(el).color)).toBe('rgb(12, 34, 56)')
  expect(await page.locator('svg path').getAttribute('d')).toBe('M0 0L10 10')
  expect(await page.locator('svg linearGradient stop').count()).toBe(1)
  expect(await page.locator('#host style').textContent()).toContain('@keyframes entry')
  await page.locator('[data-sbar-cat="A"]').dispatchEvent('click',{ctrlKey:true})
  expect(await page.evaluate(()=>(window as any).calls.select)).toEqual([{name:'A',multi:true}])
  await page.locator('[data-axis-idx="1"]').click()
  expect(await page.locator('[data-axis-section="0"]').evaluate(el=>(el as HTMLElement).style.display)).toBe('none')
  expect(await page.locator('[data-axis-section="1"]').evaluate(el=>(el as HTMLElement).style.display)).toBe('flex')
  await page.locator('#host').dispatchEvent('click')
  expect(await page.evaluate(()=>(window as any).calls.clear)).toBe(1)
 }finally{await page.close()}
})
