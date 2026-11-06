// Browser adapters supply visibility; no DOM/global access in the core helper.
// Pause the existing animation clock instead of rebuilding marks from zero.
export function finishChartFrame(chart){
 const zr=chart.getZr?.(),roots=zr?.storage?.getRoots?.()
 if(!Array.isArray(roots)||typeof zr.flush!=='function')return false
 const seen=new Set(),elements=[],collect=el=>{
  if(!el||seen.has(el))return
  if(seen.size>=100000)throw Error('Frame completion exceeds100000 elements')
  seen.add(el);elements.push(el)
  collect(el.getClipPath?.());collect(el.getTextContent?.());collect(el.getTextGuideLine?.())
 }
 // Completion callbacks can remove siblings. Snapshot before invoking them so
 // traversal never skips an animated element after an earlier callback runs.
 for(const root of roots){collect(root);root.traverse?.(collect)}
 for(const el of elements){
  // stopAnimation(true) forwards values but ABORTS: Sankey's temporary entry
  // clip is removed by its completion callback, so aborting keeps labels cut.
  // Mirror the trusted engine's normal completion using its clip interface.
  // Never remove arbitrary clip paths: authored/permanent plot clips survive.
  for(const animator of [...(el.animators||[])]){
   const clip=animator.getClip?.()
   if(typeof clip?.onframe==='function'&&typeof clip?.ondestroy==='function'){
    const animation=clip.animation
    clip.onframe(1);clip.ondestroy();animation?.removeClip?.(clip)
   }
  }
  el.stopAnimation?.(null,true)
 }
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
