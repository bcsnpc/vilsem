// Authored motion is data. Only trusted code below creates ECharts callbacks.
export const ANIMATION_EASINGS=Object.freeze(['linear','cubicIn','cubicOut','cubicInOut','quadraticIn','quadraticOut','quadraticInOut','sinusoidalInOut','exponentialOut','backOut','bounceOut','elasticOut'])
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)
export function validateAnimation(animation){
 const errors=[]
 if(animation==null)return errors
 const fail=(path,message)=>errors.push(`${path}: ${message}`)
 if(!object(animation))return ['/animation: expected a declarative motion object']
 for(const key of Object.keys(animation))if(!['enabled','enter','update','animationThreshold'].includes(key))fail('/animation/'+key,'unknown motion property')
 if(animation.enabled!=null&&typeof animation.enabled!=='boolean')fail('/animation/enabled','expected boolean')
 if(animation.animationThreshold!=null&&(!Number.isInteger(animation.animationThreshold)||animation.animationThreshold<1||animation.animationThreshold>10000))fail('/animation/animationThreshold','expected integer1..10000')
 for(const phase of ['enter','update'])if(animation[phase]!=null){
  const value=animation[phase],path='/animation/'+phase
  if(!object(value)){fail(path,'expected duration/easing/delayByIndex object');continue}
  for(const key of Object.keys(value))if(!['duration','easing','delayByIndex'].includes(key))fail(path+'/'+key,'unknown motion property')
  if(value.duration!=null&&(!Number.isFinite(value.duration)||value.duration<0||value.duration>30000))fail(path+'/duration','expected finite duration0..30000 milliseconds')
  if(value.easing!=null&&!ANIMATION_EASINGS.includes(value.easing))fail(path+'/easing','expected one of '+ANIMATION_EASINGS.join(', '))
  if(value.delayByIndex!=null){const d=value.delayByIndex
   if(!object(d)||Object.keys(d).some(k=>!['milliseconds','max'].includes(k))||!Number.isFinite(d.milliseconds)||d.milliseconds<0||d.milliseconds>1000||!Number.isFinite(d.max)||d.max<0||d.max>30000)fail(path+'/delayByIndex','expected {milliseconds:0..1000,max:0..30000}')
  }
 }
 return errors
}
export function applyAnimation(option,animation,context={}){
 const errors=validateAnimation(animation);if(errors.length)throw Error(errors.join('\n'))
 const enabled=context.enabled!==false&&context.reduceMotion!==true&&animation?.enabled!==false
 if(!enabled){
  const stop=block=>({...block,animation:false,animationDuration:0,animationDurationUpdate:0,...(block.timeline?{timeline:Array.isArray(block.timeline)?block.timeline.map(t=>({...t,autoPlay:false})):{...block.timeline,autoPlay:false}}:{}),...(block.series?{series:(Array.isArray(block.series)?block.series:[block.series]).map(s=>({...s,animation:false,animationDuration:0,animationDurationUpdate:0}))}:{}),...(block.baseOption?{baseOption:stop(block.baseOption)}:{}),...(Array.isArray(block.options)?{options:block.options.map(stop)}:{})})
  return stop(option)
 }
 if(!animation)return option
 const out={...option,animation:true,...(animation.animationThreshold!=null?{animationThreshold:animation.animationThreshold}:{})}
 for(const [phase,suffix]of [['enter',''],['update','Update']]){
  const value=animation[phase];if(!value)continue
  if(value.duration!=null)out['animationDuration'+suffix]=value.duration
  if(value.easing)out['animationEasing'+suffix]=value.easing
  if(value.delayByIndex){const {milliseconds,max}=value.delayByIndex;out['animationDelay'+suffix]=index=>Math.min(max,Math.max(0,Number.isFinite(index)?index:0)*milliseconds)}
 }
 if(out.baseOption)out.baseOption=applyAnimation(out.baseOption,animation,context)
 if(Array.isArray(out.options))out.options=out.options.map(frame=>applyAnimation(frame,animation,context))
 return out
}
