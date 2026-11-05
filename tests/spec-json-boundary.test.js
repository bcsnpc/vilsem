import{it,expect,vi}from'vitest'
import{migrate}from'../packages/core/src/spec/migrate.js'
import{resolveVisualSpec}from'../packages/core/src/spec/resolve.js'
import{validateSpecDetailed}from'../packages/core/src/spec/diagnostics.js'
import vm from'node:vm'
function input(){const getter=vi.fn(()=>1),spec={type:'custom',template:{meta:{id:'boundary',formatVersion:4},slots:{value:{kind:'measure'}},template:{series:[{type:'custom',data:[],renderItem:{language:'vilsem-expression',version:1,root:{type:'circle',shape:{cx:0,cy:0,r:1}}}}]}}};Object.defineProperty(spec.template.template.series[0].renderItem.root.shape,'cx',{enumerable:true,get:getter});return{spec,getter}}
it.each([['migration',migrate],['resolver',resolveVisualSpec]])('rejects accessor AST inputs before %s can invoke supplied code',(_name,run)=>{
 const {spec,getter}=input();expect(()=>run(spec)).toThrow(/accessor|JSON/i);expect(getter).not.toHaveBeenCalled()
})
it('returns a precise diagnostic without invoking a getter while collecting paths',()=>{
 const {spec,getter}=input(),result=validateSpecDetailed(spec);expect(result.valid).toBe(false);expect(result.errors[0].path).toContain('/shape/cx');expect(getter).not.toHaveBeenCalled()
})
it('does not read a semantic-version getter before the migration guard',()=>{
 const getter=vi.fn(()=> '0.6'),spec={type:'bar'};Object.defineProperty(spec,'specVersion',{enumerable:true,get:getter});expect(()=>migrate(spec)).toThrow(/accessor|JSON/i);expect(getter).not.toHaveBeenCalled()
})
it('accepts plain JSON and clone-safe historical dates from another JavaScript realm',()=>{
 const foreign=vm.runInNewContext('({type:"bar",config:{palette:["#123456"],date:new Date("2025-01-01")}})')
 expect(migrate(foreign).config.palette).toEqual(['#123456']);expect(validateSpecDetailed(foreign).valid).toBe(true)
})
it('rejects a custom prototype impersonating Object without calling its behavior',()=>{
 const fake=Object.create({constructor:Object});fake.type='bar';expect(()=>migrate(fake)).toThrow(/plain/)
})
