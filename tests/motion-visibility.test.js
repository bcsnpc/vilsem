import {it,expect,vi} from 'vitest'
import {createMotionVisibilityController} from '../packages/core/src/templates/motionVisibility.js'
it.each([true,false])('pauses one clock and resumes only a previously playing timeline (%s)',autoPlay=>{
 let visible=true;const clock={pause:vi.fn(),resume:vi.fn()},chart={getZr:()=>({animation:clock}),getOption:()=>({timeline:[{autoPlay}]}),dispatchAction:vi.fn()},controller=createMotionVisibilityController(chart,()=>visible)
 controller.sync();expect(clock.pause).not.toHaveBeenCalled();visible=false;controller.sync();controller.sync();expect(clock.pause).toHaveBeenCalledOnce();expect(controller.paused).toBe(true);visible=true;controller.sync();expect(clock.resume).toHaveBeenCalledOnce();expect(chart.dispatchAction.mock.calls.map(c=>c[0].playState)).toEqual(autoPlay?[false,true]:[false]);controller.dispose();visible=false;controller.sync();expect(clock.pause).toHaveBeenCalledOnce()
})
