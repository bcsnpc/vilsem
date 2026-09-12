import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const require=createRequire(import.meta.url)
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'vilsem-project-test-'))
const original=process.env.SEMANTICA_DATA_DIR
let db
beforeAll(async()=>{process.env.SEMANTICA_DATA_DIR=profile;const file=require.resolve('../src/cache/sqlite.js');delete require.cache[file];db=require(file);await db.initCache()})
afterAll(()=>{if(original===undefined)delete process.env.SEMANTICA_DATA_DIR;else process.env.SEMANTICA_DATA_DIR=original})

describe('PERSIST-001 project names cannot redirect a save to another project',()=>{
 it('rejects a same-dataset rename collision and preserves both projects across reload',async()=>{
  const a=db.saveAppSpec('A','rename',{title:'A'}),b=db.saveAppSpec('B','rename',{title:'B'})
  expect(()=>db.renameAppSpec(b,'A')).toThrow(/already exists/i)
  expect(db.saveAppSpec('B','rename',{title:'Edited B'})).toBe(b)
  await db.initCache()
  expect(db.getAppSpecs('rename').find(p=>p.id===a).spec.title).toBe('A')
  expect(db.getAppSpecs('rename').find(p=>p.id===b).spec.title).toBe('Edited B')
 })
 it('allows the same name in a different dataset and an unchanged name',()=>{
  const a=db.saveAppSpec('Shared','one',{title:'one'}),b=db.saveAppSpec('Other','two',{title:'two'})
  expect(()=>db.renameAppSpec(b,'Shared')).not.toThrow()
  expect(()=>db.renameAppSpec(a,'Shared')).not.toThrow()
  expect(db.getAppSpecs('two').find(p=>p.id===b).name).toBe('Shared')
 })
 it('refuses an ambiguous legacy name instead of updating the first matching record',()=>{
  db.saveAppSpec('Duplicate','legacy',{title:'first'})
  db.getDb().run('INSERT INTO saved_app_specs (name,dataset_id,spec_json) VALUES (?,?,?)',['Duplicate','legacy',JSON.stringify({title:'second'})])
  expect(()=>db.saveAppSpec('Duplicate','legacy',{title:'overwrite'})).toThrow(/multiple projects/i)
  expect(db.getAppSpecs('legacy').map(p=>p.spec.title).sort()).toEqual(['first','second'])
 })
})
