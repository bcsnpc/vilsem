import {describe,it,expect} from 'vitest'
import fs from 'node:fs'
import AdmZip from 'adm-zip'
import {asBlockComment,buildNotices,packageRootFromPath} from '../packages/core/scripts/notices-lib.mjs'

const pkg=JSON.parse(fs.readFileSync('packages/core/package.json','utf8'))
const notices=fs.readFileSync('packages/core/THIRD_PARTY_NOTICES.md','utf8')
const zip=new AdmZip('packages/core/assets/renderer.pbiviz')
const visual=JSON.parse(zip.readAsText(zip.getEntries().find(e=>e.entryName.endsWith('.pbiviz.json'))))
const built=JSON.parse(fs.readFileSync('vilsem-renderer/pbiviz.json','utf8')).visual.version

describe('third-party notices',()=>{
 it('ship in the core package with a NOTICE that credits Apache ECharts',()=>{
  expect(pkg.files).toEqual(expect.arrayContaining(['NOTICE','THIRD_PARTY_NOTICES.md']))
  const notice=fs.readFileSync('packages/core/NOTICE','utf8')
  expect(notice).toContain('Apache ECharts')
  expect(notice).toContain('This product includes software developed at')
  expect(fs.readFileSync('NOTICE','utf8')).toContain('https://github.com/bcsnpc/vilsem')
  expect(fs.readFileSync('NOTICE','utf8')).not.toContain('semantic_app')
 })
 it('cover the renderer build that produced the bundled asset',()=>{
  expect(notices).toContain(`vilsem Renderer ${built}`)
  for(const name of ['echarts','zrender','react','react-dom','dompurify','recharts','d3-shape','tslib'])expect(notices).toMatch(new RegExp(`^- ${name} \\d`,'m'))
  expect(notices).toContain('## NOTICE files (Apache License 2.0, section 4(d))')
  expect(notices).toMatch(/Apache License\s+Version 2\.0/)
  expect(notices).toContain('Vilsem uses it under Apache-2.0')
 })
 it('are embedded in the renderer instead of a dangling LICENSE.txt pointer',()=>{
  const js=visual.content.js
  expect(js.startsWith('/*!\n# Third-party notices: vilsem Renderer')).toBe(true)
  expect(js).not.toContain('visual.js.LICENSE.txt')
  const banner=js.slice(0,js.indexOf('*/')+2)
  expect(banner).toContain('Apache ECharts')
  expect(banner.length).toBeGreaterThan(notices.length-200)
 })
 it('keep a block comment closed and never let license text end it early',()=>{
  expect(asBlockComment('a */ b')).toBe('/*!\na * / b*/\n')
 })
 it('resolve package roots, including scoped packages',()=>{
  expect(packageRootFromPath('./node_modules/echarts/lib/core.js')).toBe('./node_modules/echarts')
  expect(packageRootFromPath('D:/x/node_modules/@reduxjs/toolkit/dist/a.js')).toBe('D:/x/node_modules/@reduxjs/toolkit')
  expect(packageRootFromPath('src/visual.ts')).toBeNull()
 })
 it('refuse to invent a license for a package that ships none and is unknown',()=>{
  const dir=fs.mkdtempSync('cache/notices-test-')
  try{
   fs.writeFileSync(`${dir}/package.json`,JSON.stringify({name:'mystery-pkg',version:'1.0.0',license:'SEE LICENSE IN EULA'}))
   expect(()=>buildNotices([dir],{title:'t',intro:'i'})).toThrow('no license file')
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
 })
})
