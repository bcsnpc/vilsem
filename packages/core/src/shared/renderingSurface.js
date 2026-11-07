// Pure display-surface policy, shared by the native adapter and preview critique.
export const SURFACE_DPR_THRESHOLD=0.05
export const SURFACE_DEBOUNCE_MS=120
export const RENDER_MODES=[{displayName:'Automatic (spec)',value:'auto'},{displayName:'Canvas',value:'canvas'},{displayName:'SVG',value:'svg'}]
export function effectiveDpr(devicePixelRatio,renderedWidth,viewportWidth){
 if(![devicePixelRatio,renderedWidth,viewportWidth].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>0))return 1
 const dpr=devicePixelRatio*(renderedWidth/viewportWidth)
 return Number.isFinite(dpr)?Math.min(4,Math.max(1,dpr)):1
}
export function surfaceNeedsReinit(previous,next){
 return !previous||previous.renderer!==next.renderer||(next.renderer==='canvas'&&Math.abs(previous.dpr-next.dpr)>SURFACE_DPR_THRESHOLD+1e-9)
}
export function rendererPolicy(spec={},option={},pane={}){
 const override=pane.appearance?.renderMode??spec.formatting?.appearance?.renderMode
 const requested=override&&override!=='auto'?override:spec.config?.renderer??'canvas'
 if(!['canvas','svg'].includes(requested))throw Error('/config/renderer: renderer must be canvas or svg')
 let unsupported=false
 const blocks=[option]
 while(blocks.length){const block=blocks.pop();if(!block||typeof block!=='object')continue
  if(block.baseOption)blocks.push(block.baseOption)
  if(Array.isArray(block.options))blocks.push(...block.options)
  const series=Array.isArray(block.series)?block.series:block.series?[block.series]:[]
  if([block,...series].some(s=>s.blendMode&&!['source-over','normal'].includes(s.blendMode)||s.effect?.show===true&&Number(s.effect.trailLength??0)>0))unsupported=true
 }
 return requested==='svg'&&unsupported?{renderer:'canvas',requested,warnings:['SVG requested, but this option uses Canvas-only blending or trail effects. Native rendering falls back to Canvas; preview sharpness does not certify native effects.']}:{renderer:requested,requested,warnings:[]}
}
