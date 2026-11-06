// Browser adapters supply visibility; no DOM/global access in the core helper.
// Pause the existing animation clock instead of rebuilding marks from zero.
export function finishChartFrame(chart){
 const zr=chart.getZr?.(),roots=zr?.storage?.getRoots?.()
 if(!Array.isArray(roots)||typeof zr.flush!=='function')return false
 const seen=new Set(),finish=el=>{if(!el||seen.has(el))return;if(seen.size>=100000)throw Error('Frame completion exceeds100000 elements');seen.add(el);el.stopAnimation?.(null,true);finish(el.getClipPath?.());finish(el.getTextContent?.());finish(el.getTextGuideLine?.())}
 for(const root of roots){finish(root);root.traverse?.(finish)}
 zr.flush();return true
}
export function createMotionVisibilityController(chart,isVisible=()=>true,{beforePause}={}){
 let paused=false,resumeTimeline=false,disposed=false
 const sync=()=>{
  if(disposed)return
  const visible=isVisible(),clock=chart.getZr?.()?.animation
  if(!visible&&!paused){beforePause?.();const timeline=chart.getOption?.()?.timeline;resumeTimeline=(Array.isArray(timeline)?timeline[0]:timeline)?.autoPlay===true;chart.dispatchAction?.({type:'timelinePlayChange',playState:false});clock?.pause?.();paused=true}
  else if(visible&&paused){clock?.resume?.();if(resumeTimeline)chart.dispatchAction?.({type:'timelinePlayChange',playState:true});paused=false;resumeTimeline=false}
 }
 return{sync,dispose(){if(disposed)return;disposed=true;resumeTimeline=false;if(paused)chart.getZr?.()?.animation?.resume?.();paused=false},get paused(){return paused}}
}
