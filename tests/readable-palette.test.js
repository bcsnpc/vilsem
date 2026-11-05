import{it,expect}from'vitest'
import{readablePalette,contrastingText}from'../packages/core/src/shared/colourContrast.js'
import{resolveVisualSpec}from'../packages/core/src/spec/resolve.js'
function luminance(hex){const c=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722}
it.each(['#ffffff','#000000'])('adjusts low-contrast marks against %s while preserving readable host colours',background=>{
 const colours=['#ffffff','#000000','#12239e','#118dff','#e66c37'],adjusted=readablePalette(colours,background),bg=luminance(background)
 adjusted.forEach(c=>{const light=luminance(c);expect((Math.max(light,bg)+.05)/(Math.min(light,bg)+.05)).toBeGreaterThanOrEqual(3)})
 expect(adjusted[background==='#ffffff'?1:0]).toBe(colours[background==='#ffffff'?1:0])
})
it('does not claim to solve unknown/translucent backgrounds',()=>{
 expect(readablePalette(['#112233'],'transparent')).toEqual(['#112233']);expect(contrastingText('rgba(0,0,0,0.5)','fallback')).toBe('fallback')
})
it('provides the same opt-in theme palette to light and dark template resolution',()=>{
 const spec={type:'custom',template:{meta:{id:'readable'},slots:{value:{kind:'measure'}},template:{color:'$theme.readablePalette',series:[{type:'pie',data:'$slot.value.pieData'}]}}}
 const light=resolveVisualSpec(spec,[{_cat:'A',_val:1}],{theme:'light'}),dark=resolveVisualSpec(spec,[{_cat:'A',_val:1}],{theme:'dark'});expect(light.color).not.toEqual(dark.color)
})
