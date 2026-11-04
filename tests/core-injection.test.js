import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { injectVisual, makeVisualContainer, validateVisualContainer, RENDERER_GUID, assertRendererVersion, requiredRendererVersion } from '@vilsem/core/pbir'
import { resolveVisualSpec } from '@vilsem/core/spec/resolve'
import { lollipop } from '@vilsem/core/templates/examples'

let report
async function write(file, value) {
  const target = path.join(report, file)
  await fs.mkdir(path.dirname(target), { recursive:true })
  await fs.writeFile(target, JSON.stringify(value,null,2))
}
async function snapshot(dir=report, result={}) {
  for (const entry of await fs.readdir(dir,{withFileTypes:true})) {
    const file=path.join(dir,entry.name)
    if (entry.isDirectory()) await snapshot(file,result)
    else result[path.relative(report,file)]=crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex')
  }
  return result
}
beforeEach(async()=>{
  report=await fs.mkdtemp(path.join(os.tmpdir(),'vilsem-injection-'))
  await write('definition/report.json',{themeCollection:{ customTheme:{name:'KeepTheme'} },filterConfig:{filters:[{name:'keep-filter'}]},resourcePackages:[]})
  await write('definition/pages/pages.json',{pageOrder:['existing'],activePageName:'existing'})
  await write('definition/pages/existing/page.json',{name:'existing',displayName:'Existing page',filterConfig:{filters:[{name:'page-filter'}]}})
  await write('definition/pages/existing/visuals/native/visual.json',{name:'native',visual:{visualType:'slicer',objects:{keep:true}}})
  await write('definition/bookmarks/bookmark.json',{name:'existing-bookmark',state:{keep:true}})
})
afterEach(async()=>{await fs.rm(report,{recursive:true,force:true})})
const args=()=>({reportDir:report,pageName:'existing',visualName:'new_vilsem',spec:{version:1,type:'bar',config:{title:'Sales'}},bindings:{dimensions:[{table:'Product',column:'Name'}],measures:[{table:'Measures',name:'Sales'}]},layout:{x:80,y:50,width:600,height:300}})

describe('core PBIR insertion',()=>{
  it('inserts exactly one visual, preserves unrelated bytes and registers the bundled renderer',async()=>{
    const before=await snapshot()
    const result=await injectVisual(args())
    expect(result.rendererRegistered).toBe(true)
    const after=await snapshot()
    for(const [name,hash] of Object.entries(before)) if(name!==path.join('definition','report.json')) expect(after[name],name).toBe(hash)
    const value=JSON.parse(await fs.readFile(result.path,'utf8'))
    expect(value.visual.visualType).toBe(RENDERER_GUID)
    expect(value.visual.query.queryState.content.projections[0].field.Measure.Property).toBe('Sales')
    await expect(validateVisualContainer(value)).resolves.toBe(true)
    const reportJson=JSON.parse(await fs.readFile(path.join(report,'definition/report.json'),'utf8'))
    expect(reportJson.themeCollection.customTheme.name).toBe('KeepTheme')
    expect(reportJson.filterConfig.filters[0].name).toBe('keep-filter')
    expect(reportJson.resourcePackages).toHaveLength(1)
    expect((await fs.readdir(path.join(report,'CustomVisuals',RENDERER_GUID)))).toContain('package.json')
  })
  it('does not rewrite report.json when renderer registration already exists',async()=>{
    await injectVisual(args())
    const before=await snapshot()
    await injectVisual({...args(),visualName:'second'})
    const after=await snapshot()
    for(const [name,hash] of Object.entries(before)) expect(after[name],name).toBe(hash)
  })
  it('refuses to overwrite native visuals and leaves the entire report untouched',async()=>{
    const before=await snapshot()
    await expect(injectVisual({...args(),visualName:'native'})).rejects.toThrow()
    expect(await snapshot()).toEqual(before)
  })
  it.each(['../other','a/b','C:\\outside'])('rejects path traversal: %s',async visualName=>{
    const before=await snapshot()
    await expect(injectVisual({...args(),visualName})).rejects.toThrow(/folder name/)
    expect(await snapshot()).toEqual(before)
  })
  it('rejects unsupported/native spec types before touching report files',async()=>{
    const before=await snapshot()
    await expect(injectVisual({...args(),spec:{type:'slicer'}})).rejects.toThrow(/not supported/)
    expect(await snapshot()).toEqual(before)
  })
  it('validates positions and field bindings',()=>{
    expect(()=>makeVisualContainer({...args(),layout:{width:-1}})).toThrow(/layout/)
    expect(()=>makeVisualContainer({...args(),bindings:{measures:[{name:'Sales'}]}})).toThrow(/table/)
  })
  it('refuses advanced specs against old registered resources before writing any report file',async()=>{
    await injectVisual(args())
    await write(`CustomVisuals/${RENDERER_GUID}/package.json`,{visual:{guid:RENDERER_GUID},version:'4.14.2.0'})
    const spec={template:{...lollipop,transforms:[{waterfall:{category:'category',value:'value'},as:'steps'}]}}
    // Use the actual slot names of the fixture; version rejection is separate
    // from ordinary spec validation and must leave every byte intact.
    const slots=Object.entries(lollipop.slots)
    spec.template.transforms[0].waterfall={category:slots.find(([,s])=>s.kind==='dimension')[0],value:slots.find(([,s])=>s.kind==='measure')[0]}
    const before=await snapshot()
    await expect(injectVisual({...args(),visualName:'advanced',spec})).rejects.toThrow(/requires vilsem Renderer 4.18/)
    expect(await snapshot()).toEqual(before)
    await expect(injectVisual({...args(),visualName:'basic'})).resolves.toBeTruthy()
  })
  it('detects feature floors and compares complete renderer versions',()=>{
    expect(requiredRendererVersion({type:'bar'})).toBe(null)
    const spec={template:{transforms:[{heikinAshi:{},as:'ha'}]}}
    expect(requiredRendererVersion(spec)).toBe('4.17.0.0')
    expect(()=>assertRendererVersion(spec,{},'4.16.9.9')).toThrow(/4.17/)
    expect(()=>assertRendererVersion(spec,{},undefined)).toThrow(/unreadable/)
    expect(()=>assertRendererVersion(spec,{},'4.17.0.0')).not.toThrow()
    expect(()=>assertRendererVersion(spec,{},'5.0.0.0')).not.toThrow()
    expect(requiredRendererVersion({measures:{Ratio:'1'}})).toBe('4.15.0.0')
    expect(requiredRendererVersion({template:{slots:{values:{kind:'measure',count:6}}}})).toBe('4.15.0.0')
    expect(requiredRendererVersion({template:{template:{series:{concat:[]}}}})).toBe('4.15.0.0')
    expect(requiredRendererVersion({template:{transforms:[{allocate:{},as:'grid'}]}})).toBe('4.16.0.0')
  })
})

describe('headless spec validation',()=>{
  it('resolves declarative templates with no browser globals',()=>{
    const option=resolveVisualSpec({template:lollipop},[{_cat:'Bikes',_val:12}])
    expect(option.series).toBeTruthy()
  })
  it('returns precise unknown slot and formatter errors',()=>{
    expect(()=>resolveVisualSpec({template:{...lollipop,template:{series:[{data:'$slot.missing.values'}]}}})).toThrow(/unknown slot|undeclared slot/)
    expect(()=>resolveVisualSpec({template:{...lollipop,template:{tooltip:{formatterTemplate:'{value:money}'}}}})).toThrow(/unknown formatter/)
  })
})
