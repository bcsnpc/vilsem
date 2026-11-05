import{it,expect}from'vitest'
import fs from'node:fs/promises'
import os from'node:os'
import path from'node:path'
import{requiredRendererVersion}from'../packages/core/src/pbir/rendererCompatibility.js'
import{injectVisual,RENDERER_GUID}from'../packages/core/src/pbir/injectVisual.js'
it('requires a reader that understands the persisted0.7 semantic version even for an ordinary bar',()=>{
 expect(requiredRendererVersion({type:'bar',canvasTheme:'light',specVersion:'0.7'})).toBe('4.36.0.0')
 expect(requiredRendererVersion({type:'bar',canvasTheme:'light',specVersion:'0.6'})).not.toBe('4.36.0.0')
})
it('refuses an unversioned insertion into a0.6 reader before changing any report/resource bytes',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'vilsem-reader-floor-'))
 try{
  const write=async(relative,value)=>{const target=path.join(root,relative);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,JSON.stringify(value))}
  await write('definition/pages/p1/page.json',{name:'p1',displayName:'QA'})
  const report={resourcePackages:[{type:'CustomVisual',name:RENDERER_GUID}]},metadata={visual:{guid:RENDERER_GUID,version:'4.35.0.0'}}
  await write('definition/report.json',report);await write(`CustomVisuals/${RENDERER_GUID}/package.json`,metadata)
  const before=await fs.readFile(path.join(root,'definition/report.json'))
  await expect(injectVisual({reportDir:root,pageName:'p1',visualName:'newbar',spec:{type:'bar',canvasTheme:'light'},bindings:{dimensions:[],measures:[{table:'Sales',name:'Revenue'}]}})).rejects.toThrow(/4.36/)
  expect(await fs.readFile(path.join(root,'definition/report.json'))).toEqual(before)
  await expect(fs.access(path.join(root,'definition/pages/p1/visuals/newbar/visual.json'))).rejects.toThrow()
  expect(JSON.parse(await fs.readFile(path.join(root,`CustomVisuals/${RENDERER_GUID}/package.json`),'utf8'))).toEqual(metadata)
 }finally{await fs.rm(root,{recursive:true,force:true})}
})
