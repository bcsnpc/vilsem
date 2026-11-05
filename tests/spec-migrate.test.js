import {describe,it,expect} from 'vitest'
import {migrate,CURRENT_SPEC_VERSION,scopedMeasuresOf} from '../packages/core/src/spec/migrate.js'
import {resolveVisualSpec} from '../packages/core/src/spec/resolve.js'
import {makeVisualContainer} from '../packages/core/src/pbir/injectVisual.js'
import {requiredRendererVersion} from '../packages/core/src/pbir/rendererCompatibility.js'
describe('forward-only visual spec migrations',()=>{
 it('preserves historical field-label metadata rather than converting it into DAX declarations',()=>{
  for(const spec of [{type:'table',measures:{primary:'[Revenue]',secondary:'Orders'}},{type:'bar',measures:{primary:'Revenue',secondary:null,all:['Revenue','Orders']}},{type:'bar',measures:{primary:{table:'Sales',name:'Revenue'}}}]){
   expect(migrate(spec).measures).toEqual(spec.measures);expect(scopedMeasuresOf(spec)).toEqual({})
  }
  const old={type:'bar',measures:{primary:'Revenue',all:['Revenue']}}
  expect(resolveVisualSpec(old).series).toBeDefined()
  expect(requiredRendererVersion({...old,canvasTheme:'dark'})).toBeNull()
  expect(makeVisualContainer({visualName:'legacy',spec:old,bindings:{measures:[{table:'Sales',name:'Revenue'}]}}).visual.query.queryState.content.projections[0].field).toHaveProperty('Measure')
  expect(migrate({type:'bar',measures:{primary:'1 + 2'}}).measures.primary).toEqual({expression:'1 + 2'})
 })
 it.each(['0.1','0.2','0.3','0.4','0.5','0.6','0.7'])('reads version%s and preserves visual meaning',version=>{
  const old={specVersion:version,version:1,type:'bar',measures:{Net:'1 + 2'},config:{showLegend:false}},before=structuredClone(old)
  const current=migrate(old)
  expect(current).toEqual({...old,specVersion:CURRENT_SPEC_VERSION,measures:{Net:{expression:'1 + 2'}}});expect(old).toEqual(before)
  expect(resolveVisualSpec(old).series).toBeDefined();expect(migrate(current)).toEqual(current)
 })
 it('migrates unversioned round2 string measures into structured definitions on commit',()=>{
  const old={type:'bar',measures:{Net:'1'}}
  const visual=makeVisualContainer({visualName:'new',spec:old,bindings:{measures:[{table:'Sales',name:'Net'}]}})
  const literal=visual.visual.objects.semantica[0].properties.primitiveSpec.expr.Literal.Value
  expect(JSON.parse(literal.slice(1,-1).replace(/''/g,"'"))).toMatchObject({specVersion:CURRENT_SPEC_VERSION,measures:{Net:{expression:'1'}}})
  expect(old.specVersion).toBeUndefined()
 })
 it('refuses future formats, wire envelopes and downgrade attempts',()=>{expect(()=>migrate({specVersion:'99',type:'bar'})).toThrow('Unsupported specVersion');expect(()=>migrate({version:99,type:'bar'})).toThrow('Unsupported spec version 99');expect(()=>migrate({type:'bar'},'0.6','0.1')).toThrow('forward-only')})
})
