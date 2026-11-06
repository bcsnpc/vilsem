import {it,expect,vi} from 'vitest'
import {createMotionVisibilityController,finishChartFrame} from '../packages/core/src/templates/motionVisibility.js'
it.each([true,false])('pauses one clock and resumes only a previously playing timeline (%s)',autoPlay=>{
 let visible=true;const clock={pause:vi.fn(),resume:vi.fn()},chart={getZr:()=>({animation:clock}),getOption:()=>({timeline:[{autoPlay}]}),dispatchAction:vi.fn()},controller=createMotionVisibilityController(chart,()=>visible)
 controller.sync();expect(clock.pause).not.toHaveBeenCalled();visible=false;controller.sync();controller.sync();expect(clock.pause).toHaveBeenCalledOnce();expect(controller.paused).toBe(true);visible=true;controller.sync();expect(clock.resume).toHaveBeenCalledOnce();expect(chart.dispatchAction.mock.calls.map(c=>c[0].playState)).toEqual(autoPlay?[false,true]:[false]);controller.dispose();visible=false;controller.sync();expect(clock.pause).toHaveBeenCalledOnce()
})
it('settles clips and attached text before flushing an offscreen first frame',()=>{
 const clip={stopAnimation:vi.fn()},text={stopAnimation:vi.fn()},line={stopAnimation:vi.fn()},child={stopAnimation:vi.fn(),getClipPath:()=>clip,getTextContent:()=>text,getTextGuideLine:()=>line},root={stopAnimation:vi.fn(),traverse:visit=>{visit(child);visit(clip)}},flush=vi.fn(),chart={getZr:()=>({storage:{getRoots:()=>[root]},flush})}
 expect(finishChartFrame(chart)).toBe(true);for(const el of[root,child,clip,text,line])expect(el.stopAnimation).toHaveBeenCalledExactlyOnceWith(null,true);expect(flush).toHaveBeenCalledOnce();expect(finishChartFrame({})).toBe(false)
})
it('finishes an explicit hidden-frame callback before pausing its animation clock',()=>{
 const order=[],chart={getZr:()=>({animation:{pause:()=>order.push('pause')}}),dispatchAction:()=>order.push('timeline')},controller=createMotionVisibilityController(chart,()=>false,{beforePause:()=>order.push('finish')});controller.sync();expect(order).toEqual(['finish','timeline','pause']);controller.dispose()
})
it('completes transient clip callbacks and preserves permanent clipping',()=>{
 const order=[],permanent={stopAnimation:vi.fn()},clip={onframe:value=>order.push(['frame',value]),ondestroy:()=>order.push(['done']),animation:{removeClip:()=>order.push(['remove'])}},root={animators:[{getClip:()=>clip}],stopAnimation:vi.fn(),getClipPath:()=>permanent},flush=()=>order.push(['flush'])
 expect(finishChartFrame({getZr:()=>({storage:{getRoots:()=>[root]},flush})})).toBe(true)
 expect(order).toEqual([['frame',1],['done'],['remove'],['flush']]);expect(root.getClipPath()).toBe(permanent);expect(permanent.stopAnimation).toHaveBeenCalledOnce()
})
it('snapshots sibling elements before completion callbacks remove them',()=>{
 const second={stopAnimation:vi.fn()},children=[],first={animators:[{getClip:()=>({onframe:()=>{},ondestroy:()=>children.splice(0,1)})}],stopAnimation:vi.fn()};children.push(first,second)
 const root={traverse:visit=>{for(const child of children)visit(child)}}
 finishChartFrame({getZr:()=>({storage:{getRoots:()=>[root]},flush:()=>{}})})
 expect(first.stopAnimation).toHaveBeenCalledOnce();expect(second.stopAnimation).toHaveBeenCalledOnce()
})
it('releases its paused clock when a retained chart replaces the visibility controller',()=>{
 const clock={pause:vi.fn(),resume:vi.fn()},chart={getZr:()=>({animation:clock}),getOption:()=>({timeline:[{autoPlay:true}]}),dispatchAction:vi.fn()},old=createMotionVisibilityController(chart,()=>false)
 old.sync();old.dispose();old.dispose();expect(clock.resume).toHaveBeenCalledOnce();expect(old.paused).toBe(false);expect(chart.dispatchAction).toHaveBeenCalledExactlyOnceWith({type:'timelinePlayChange',playState:false})
 const next=createMotionVisibilityController(chart,()=>true);next.sync();expect(clock.pause).toHaveBeenCalledOnce();next.dispose()
})
