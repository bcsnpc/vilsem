// White-box audit: expose production private patch helpers in this process only.
// No edited product file, credentials, provider call, or existing database is used.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict')
const {app}=require('electron/main')
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/qa/evidence')
const profile=fs.mkdtempSync(path.join(root,'cache/qa-contract-'))
app.setPath('userData',profile);process.env.SEMANTICA_DATA_DIR=profile
const clone=x=>JSON.parse(JSON.stringify(x)),report={scope:'Production persistence and patch functions in isolated Electron; no live LLM',checks:[],parity:[]}
async function check(name,fn){try{const evidence=await fn();report.checks.push({name,status:'PASS',evidence})}catch(e){report.checks.push({name,status:'FAIL',message:e.message})}}
app.whenReady().then(async()=>{
  try{
    const llmPath=path.join(root,'electron/ipc/llm.js'),m=new Module(llmPath,module)
    m.filename=llmPath;m.paths=Module._nodeModulePaths(path.dirname(llmPath))
    m._compile(fs.readFileSync(llmPath,'utf8')+'\nmodule.exports.__qa={validatePatchOperations,applyJsonPatch,buildVisualSchemaHint,VISUAL_SCHEMA_MAP};',llmPath)
    const {__qa:qa,sanitizeAppSpec,reflowLayout}=m.exports
    const base={version:'1.0',title:'QA',layout:{freeform:true,columns:12,rowHeight:80,gap:8},visuals:[{id:'qa',type:'bar',position:{x:0,y:0,w:6,h:4},data:{measures:['Revenue'],groupBy:{table:'QA',column:'Category'}},config:{title:'QA'}}],slicers:[]}
    const pipeline=(spec,patches)=>{const accepted=qa.validatePatchOperations(clone(spec),clone(patches),['Revenue','Cost','Units']);return {accepted,result:reflowLayout(sanitizeAppSpec(qa.applyJsonPatch(spec,accepted)))}}
    await check('AI valid title patch survives',()=>{const r=pipeline(base,[{op:'replace',path:'/visuals/0/config/title',value:'New title'}]);assert.equal(r.result.visuals[0].config.title,'New title');return r.accepted})
    await check('AI unknown measure is rejected',()=>{assert.equal(pipeline(base,[{op:'replace',path:'/visuals/0/data/measures',value:['Unknown']}]).accepted.length,0)})
    await check('AI unknown operation is rejected',()=>{assert.equal(pipeline(base,[{op:'execute',path:'/visuals/0/config/title',value:'bad'}]).accepted.length,0)})
    await check('AI nonexistent parent is rejected',()=>{assert.equal(pipeline(base,[{op:'replace',path:'/visuals/9/config/title',value:'bad'}]).accepted.length,0)})
    await check('AI invalid config type is rejected',()=>{const r=pipeline(base,[{op:'replace',path:'/visuals/0/config/barRadius',value:'not a number'}]);assert.equal(r.accepted.length,0,'Invalid barRadius type was accepted and survived sanitizer')})
    await check('AI unknown config key is rejected',()=>{assert.equal(pipeline(base,[{op:'replace',path:'/visuals/0/config/nonexistentQaProperty',value:17}]).accepted.length,0,'Unknown renderer property was accepted')})
    await check('AI color-only patch preserves multi-select slicer',()=>{const s=clone(base);s.slicers=[{id:'s',type:'multi_select',dimension:{table:'QA',column:'Category'},position:{x:0,y:0,w:4,h:1}}];const r=pipeline(s,[{op:'replace',path:'/visuals/0/config/colorScheme',value:'gold'}]);assert.equal(r.result.slicers[0]?.type,'multi_select')})
    await check('AI remove measure is accepted',()=>{const r=pipeline(base,[{op:'remove',path:'/visuals/0/data/measures/0'}]);assert.equal(r.accepted.length,1,'Removal was rejected by value validation');return r.result.visuals[0].data})
    await check('AI sequential add-parent then set-child accepted',()=>{const r=pipeline(base,[{op:'add',path:'/visuals/0/config/categoryColors',value:{}},{op:'add',path:'/visuals/0/config/categoryColors/North',value:'#123456'}]);assert.equal(r.accepted.length,2,'Validation uses original spec rather than sequential patch state');assert.equal(r.result.visuals[0].config.categoryColors.North,'#123456')})

    await check('AI validation does not mutate supplied patch or spec',()=>{const patches=[{op:'replace',path:'/visuals/0/config/primaryColor',value:'#123456'}],before=clone(base);qa.validatePatchOperations(base,patches,['Revenue','Cost','Units']);assert.equal(patches[0].op,'replace');assert.deepEqual(base,before)})
    await check('AI child patch rejected after parent removal',()=>{const r=pipeline(base,[{op:'remove',path:'/visuals/0/data'},{op:'add',path:'/visuals/0/data/measures',value:['Revenue']}]);assert.equal(r.accepted.length,1)})
    await check('AI scalar parent cannot receive child properties',()=>{const r=pipeline(base,[{op:'add',path:'/visuals/0/config/targetLine',value:50},{op:'add',path:'/visuals/0/config/targetLine/value',value:70}]);assert.equal(r.accepted.length,1)})
    const inventory=JSON.parse(fs.readFileSync(path.join(out,'renderer-smoke.json'),'utf8')).inventory
    for(const [type,{fields}]of Object.entries(inventory)){
      const hint=qa.buildVisualSchemaHint([type])
      for(const f of fields){const s=clone(base);s.visuals[0].type=type;let value=f.default;if(value===undefined)value=f.type==='boolean'?true:['number','range'].includes(f.type)?(f.min??1):f.type==='select'?f.options?.[0]?.value:'QA';if(value===undefined)value=null
        const r=pipeline(s,[{op:'replace',path:`/visuals/0/config/${f.key}`,value}]);report.parity.push({type,key:f.key,hintContainsKey:hint.includes(f.key+':'),accepted:r.accepted.length===1,preserved:JSON.stringify(r.result.visuals[0].config[f.key])===JSON.stringify(value)})
      }
    }
    const db=require(path.join(root,'src/cache/sqlite.js'));await db.initCache()
    await check('Persistence all registry specs survive reload',async()=>{for(const type of Object.keys(inventory)){const s=clone(base);s.visuals[0].type=type;s.visuals[0].config={title:'日本語 & <QA>',titleFontSize:27,showLegend:false,categoryColors:{North:'#d946ef'}};db.saveAppSpec('QA '+type,'qa-dataset',s)}await db.initCache();const rows=db.getAppSpecs('qa-dataset');assert.equal(rows.length,Object.keys(inventory).length);for(const row of rows)assert.equal(row.spec.visuals[0].config.titleFontSize,27);return {saved:rows.length}})
    await check('Persistence updating same name does not create duplicate',()=>{const id=db.saveAppSpec('Same','qa-dataset',base);const id2=db.saveAppSpec('Same','qa-dataset',{...base,title:'Updated'});assert.equal(id,id2);assert.equal(db.getAppSpecs('qa-dataset').find(r=>r.id===id).spec.title,'Updated')})
    await check('Persistence dataset boundaries preserved',()=>{db.saveAppSpec('Same','other-qa',base);assert.equal(db.getAppSpecs('other-qa').length,1)})
    await check('Persistence rename and delete',()=>{const id=db.saveAppSpec('Rename','qa-dataset',base);db.renameAppSpec(id,'Renamed');assert.equal(db.getAppSpecs('qa-dataset').find(r=>r.id===id).name,'Renamed');db.deleteAppSpec(id);assert.ok(!db.getAppSpecs('qa-dataset').some(r=>r.id===id))})
    await check('Persistence rename collision rejected and both projects preserved',()=>{const a=db.saveAppSpec('Collision A','qa-collision',{...base,title:'A'}),b=db.saveAppSpec('Collision B','qa-collision',{...base,title:'B'});assert.throws(()=>db.renameAppSpec(b,'Collision A'),/already exists/);assert.equal(db.saveAppSpec('Collision B','qa-collision',{...base,title:'Edited B'}),b);assert.equal(db.getAppSpecs('qa-collision').find(p=>p.id===a).spec.title,'A')})
    const {getConfig}=require(path.join(root,'node_modules/app-builder-lib/out/util/config/config.js'))
    const active=await getConfig(root),legacy=await getConfig(root,'electron-builder.yml')
    report.packaging={active:{productName:active.productName,appId:active.appId,directories:active.directories,files:active.files},explicitYaml:{productName:legacy.productName,appId:legacy.appId,directories:legacy.directories,files:legacy.files},precedence:'Installed app-builder-lib loadConfig prefers packageMetadata.build; YAML requires explicit config when build field exists.'}
    await check('Active packaging excludes env files',()=>{assert.ok(JSON.stringify(active.files).includes('!.env'));assert.equal(active.productName,'vilsem')})
    report.complete=true
  }catch(e){report.fatal=e.stack}
  fs.writeFileSync(path.join(out,process.argv.includes('--after')?'contract-audit-after.json':'contract-audit.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({checks:report.checks.map(({name,status})=>({name,status})),parity:report.parity.length,fatal:report.fatal}));app.exit(report.fatal||report.checks.some(c=>c.status==='FAIL')?1:0)
})
