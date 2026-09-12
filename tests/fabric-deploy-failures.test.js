import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const filename = path.resolve('electron/fabric/runRayfin.js')
function harness(failure) {
  const commands=[]
  const nativeRequire=createRequire(filename)
  const module={exports:{}}
  vm.runInNewContext(fs.readFileSync(filename,'utf8'),{
    module, exports:module.exports, __dirname:path.dirname(filename), process,
    require(id) {
      if(id==='fs')return {mkdirSync(){},existsSync(){return true},rmSync(){throw Error('Unexpected cleanup')}}
      if(id==='electron')return {app:{isPackaged:false}}
      if(id==='./generateProject')return {injectFullApp(){if(failure==='inject')throw Error('Missing renderer');return {connectionAlias:'model',visualCount:1,bundleBytes:10,written:['app']}}}
      if(id==='child_process')return {spawn(line){commands.push(line);const c=new EventEmitter();c.stdout=new EventEmitter();c.stderr=new EventEmitter();queueMicrotask(()=>c.emit('close',line.includes(failure)?1:0));return c}}
      return nativeRequire(id)
    },
  },{filename})
  return {deploy:module.exports.deployToFabric,commands}
}
describe('Fabric deployment prerequisite failures',()=>{
  it('does not start scaffolding without a cloud model connection',async()=>{
    const h=harness('NO_MATCH')
    const result=await h.deploy({title:'QA'},{workspace:'QA'})
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('NO_MODEL_CONNECTION')
    expect(h.commands).toHaveLength(0)
  })
  for(const [failure,stage] of [['fabric-embed:build','build'],['inject','inject'],['fabric-app-data add','connection'],['fabric-app-data generate','connection'],['npm install','install']]) {
    it(`stops before publication when ${failure} fails`,async()=>{
      const h=harness(failure)
      const result=await h.deploy({title:'QA'},{appName:'qa',workspace:'QA',reuseExisting:true,parentDir:path.resolve('cache/qa-deploy-unit'),modelWorkspaceId:'ws',datasetId:'model'})
      expect(result.ok).toBe(false)
      expect(result.stage).toBe(stage)
      expect(h.commands.some(c=>/ up(?: |$)/.test(c))).toBe(false)
    })
  }
  it('deploys only after successful renderer and connection setup',async()=>{
    const h=harness('NO_MATCH')
    expect((await h.deploy({title:'QA'},{workspace:'QA',reuseExisting:true,modelWorkspaceId:'ws',datasetId:'model'})).ok).toBe(true)
    expect(h.commands.at(-1)).toMatch(/ up$/)
  })
})
