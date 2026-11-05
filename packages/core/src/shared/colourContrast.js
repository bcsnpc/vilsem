// Opaque sRGB only. Unknown/translucent paints need the actual backdrop and
// retain the caller's foreground rather than claiming a contrast guarantee.
export function contrastingText(colour, fallback = '#252423') {
  let rgb
  if(typeof colour!=='string')return fallback
  const hex=/^#([a-f\d]{3}|[a-f\d]{6})$/i.exec(colour)
  if(hex){const h=hex[1].length===3?[...hex[1]].map(c=>c+c).join(''):hex[1];rgb=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16))}
  else {
    const match=/^(rgb|rgba)\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(colour)
    if(!match)return fallback
    if(match[1].toLowerCase()==='rgba' ? Number(match[5])!==1 : match[5]!=null)return fallback
    rgb=match.slice(2,5).map(Number)
    if(rgb.some(c=>!Number.isFinite(c)||c<0||c>255))return fallback
  }
  const linear=rgb.map(c=>{const s=c/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4})
  const luminance=.2126*linear[0]+.7152*linear[1]+.0722*linear[2]
  return (luminance+.05)/.05 >= 1.05/(luminance+.05) ? '#000000' : '#ffffff'
}
