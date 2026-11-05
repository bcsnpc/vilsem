import{it,expect}from'vitest'
import{applyAnimation,validateAnimation}from'../packages/core/src/templates/animation.js'
import{resolveVisualSpec}from'../packages/core/src/spec/resolve.js'
import{validateSpecDetailed}from'../packages/core/src/spec/diagnostics.js'
it('compiles bounded enter/update motion and delays from JSON, without authored callbacks',()=>{
 const definition={enter:{duration:500,easing:'cubicOut',delayByIndex:{milliseconds:15,max:900}},update:{duration:300,easing:'linear'},animationThreshold:5000},result=applyAnimation({series:[{type:'bar'}]},definition)
 expect(result.animation).toBe(true);expect(result.animationDuration).toBe(500);expect(result.animationDurationUpdate).toBe(300)
 expect(result.animationDelay(10000)).toBe(900);expect(result.animationDelay(-1)).toBe(0);expect(result.animationDelay(NaN)).toBe(0)
 expect(definition.enter.duration).toBe(500)
})
it.each([{enabled:false},{reduceMotion:true}])('disables transitions and autoplay under motion policy %j',policy=>{
 const result=applyAnimation({animation:true,timeline:{autoPlay:true}}, {enter:{duration:1000}},policy)
 expect(result.animation).toBe(false);expect(result.animationDurationUpdate).toBe(0);expect(result.timeline.autoPlay).toBe(false)
})
it('preserves legacy option motion when no new block or explicit disabling is supplied',()=>{
 const option={animation:false};expect(applyAnimation(option)).toBe(option)
})
it('cannot restart motion through a nested timeline frame or series override',()=>{
 const frame={animation:true,timeline:[{autoPlay:true}],series:[{type:'bar',animation:true,animationDuration:500}]},source={baseOption:frame,options:[frame]};const result=applyAnimation(source,null,{reduceMotion:true})
 expect(result.baseOption.timeline[0].autoPlay).toBe(false);expect(result.options[0].series[0].animationDuration).toBe(0);expect(source.options[0].series[0].animation).toBe(true)
})
it('applies authored duration and easing to timeline containers, whose root settings ECharts otherwise ignores',()=>{
 const option=applyAnimation({baseOption:{timeline:{data:['A','B']}},options:[{series:[{type:'bar'}]},{series:[{type:'bar'}]}]},{enter:{duration:450,easing:'linear'},update:{duration:650}})
 expect(option.baseOption.animationDuration).toBe(450);expect(option.options[0].animationDurationUpdate).toBe(650);expect(option.options[1].animationEasing).toBe('linear')
})
it('shares the authored animation contract with resolver, pane overrides and precise validation',()=>{
 const spec={type:'custom',template:{meta:{id:'motion',formatVersion:4},slots:{value:{kind:'measure'}},animation:{enter:{duration:500}},template:{series:[{type:'pie',data:'$slot.value.pieData'}]}}}
 expect(resolveVisualSpec(spec,[{_cat:'A',_val:1}]).animationDuration).toBe(500)
 expect(resolveVisualSpec(spec,[{_cat:'A',_val:1}],{formatPaneOverrides:{motion:{enabled:false}}}).animation).toBe(false)
 expect(resolveVisualSpec(spec,[{_cat:'A',_val:1}],{reduceMotion:true}).animation).toBe(false)
 spec.template.animation.enter.duration=-1
 expect(validateSpecDetailed(spec).errors[0].path).toBe('/template/animation/enter/duration')
})
it.each([{enter:{duration:Infinity}},{enter:{duration:30001}},{update:{easing:'eval'}},{animationThreshold:10001},{enter:{delayByIndex:{milliseconds:1,max:Infinity}}},{enter:{callback:'fetch'}},{enabled:'yes'}])('refuses invalid motion %j',definition=>{
 expect(validateAnimation(definition).length).toBeGreaterThan(0);expect(()=>applyAnimation({},definition)).toThrow()
})
