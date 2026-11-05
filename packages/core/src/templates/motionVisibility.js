// Browser adapters supply visibility; no DOM/global access in the core helper.
// Pause the existing animation clock instead of rebuilding marks from zero.
export function createMotionVisibilityController(chart,isVisible=()=>true){
 let paused=false,resumeTimeline=false,disposed=false
 const sync=()=>{
  if(disposed)return
  const visible=isVisible(),clock=chart.getZr?.()?.animation
  if(!visible&&!paused){const timeline=chart.getOption?.()?.timeline;resumeTimeline=(Array.isArray(timeline)?timeline[0]:timeline)?.autoPlay===true;chart.dispatchAction?.({type:'timelinePlayChange',playState:false});clock?.pause?.();paused=true}
  else if(visible&&paused){clock?.resume?.();if(resumeTimeline)chart.dispatchAction?.({type:'timelinePlayChange',playState:true});paused=false;resumeTimeline=false}
 }
 return{sync,dispose(){disposed=true;resumeTimeline=false},get paused(){return paused}}
}
