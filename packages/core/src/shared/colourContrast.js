// Opaque sRGB only. Unknown/translucent paints need the actual backdrop and
// retain the caller's foreground rather than claiming a contrast guarantee.
function opaqueRgb(colour) {
  let rgb
  if(typeof colour!=='string')return null
  const hex=/^#([a-f\d]{3}|[a-f\d]{6})$/i.exec(colour)
  if(hex){const h=hex[1].length===3?[...hex[1]].map(c=>c+c).join(''):hex[1];rgb=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16))}
  else {
    const match=/^(rgb|rgba)\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(colour)
    if(!match)return null
    if(match[1].toLowerCase()==='rgba' ? Number(match[5])!==1 : match[5]!=null)return null
    rgb=match.slice(2,5).map(Number)
    if(rgb.some(c=>!Number.isFinite(c)||c<0||c>255))return null
  }
  return rgb
}
function luminance(rgb){
  const linear=rgb.map(c=>{const s=c/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4})
  return .2126*linear[0]+.7152*linear[1]+.0722*linear[2]
}
export function contrastingText(colour,fallback='#252423'){
 const rgb=opaqueRgb(colour);if(!rgb)return fallback
 const light=luminance(rgb)
 return (light+.05)/.05 >= 1.05/(light+.05) ? '#000000' : '#ffffff'
}
/** Opt-in mark palette for a known opaque page background. Original host
 * colours remain unchanged when they already meet the non-text3:1 threshold. */
export function readablePalette(palette,background){
 const bg=opaqueRgb(background);if(!bg)return [...palette]
 const bgLuminance=luminance(bg),towards=contrastingText(background)==='#ffffff'?255:0
 const ratio=rgb=>{const light=luminance(rgb);return (Math.max(light,bgLuminance)+.05)/(Math.min(light,bgLuminance)+.05)}
 return palette.map(colour=>{
  const source=opaqueRgb(colour);if(!source)return contrastingText(background)
  if(ratio(source)>=3)return colour
  for(let i=1;i<=10;i++){const mixed=source.map(c=>Math.round(c+(towards-c)*i/10));if(ratio(mixed)>=3)return '#'+mixed.map(c=>c.toString(16).padStart(2,'0')).join('')}
  return contrastingText(background)
 })
}
