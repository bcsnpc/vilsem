import{it,expect}from'vitest'
import{PNG}from'pngjs'
import jpeg from'jpeg-js'
import{extractDesignTokens}from'../packages/core/src/images/designTokens.js'
import{decodeDesignImage}from'../packages/core/src/images/decode.js'
function fixture(bg,bar,{grid=false,title=false}={}){
 const image={width:200,height:120,data:new Uint8Array(200*120*4)}
 const rect=(x,y,w,h,rgb)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)image.data.set([...rgb,255],(yy*200+xx)*4)}
 rect(0,0,200,120,bg)
 if(grid)for(const y of[40,60,80,100])rect(20,y,160,1,[200,200,200])
 rect(30,50,35,50,bar);rect(90,70,35,30,bar)
 if(title){rect(60,8,80,14,[20,20,20]);rect(30,107,30,6,[20,20,20]);rect(90,107,30,6,[20,20,20])}
 return image
}
it.each([
 ['light comparison',[255,255,255],[20,120,230],{},'light'],
 ['dark comparison',[16,20,28],[45,210,170],{},'dark'],
 ['mockup grid',[255,255,255],[210,70,110],{grid:true},'light'],
 ['sketch typography',[250,248,240],[30,30,30],{title:true},'light'],
])('extracts bounded non-ML statistics from the %s PNG fixture',(_name,bg,bar,options,mode)=>{
 const image=fixture(bg,bar,options),decoded=decodeDesignImage(PNG.sync.write(image)),tokens=extractDesignTokens({image:decoded})
 expect(tokens.theme.mode).toBe(mode);expect(tokens.theme.palette.length).toBeGreaterThan(0);expect(tokens.theme.palette.length).toBeLessThanOrEqual(8);expect(tokens.layout.aspectRatio).toBeCloseTo(200/120)
 expect(tokens.theme.palette).not.toContain(tokens.theme.background)
 if(options.grid)expect(tokens.layout.gridlines).toBe(true)
 if(options.title)expect(tokens.layout.titleLabelFontRatio).toBeGreaterThan(1.5)
})
it('decodes a bounded JPEG photo input without reading paths or remote resources',()=>{
 const image=fixture([255,255,255],[0,100,200]),encoded=jpeg.encode(image,85).data
 expect(extractDesignTokens({image:decodeDesignImage(encoded)}).theme.mode).toBe('light')
})
it('refuses malformed/oversized/unsupported images before statistics or native code',()=>{
 for(const bytes of[Buffer.from('<svg onload="fetch(1)"/>'),Buffer.alloc(8388609),Buffer.from([255,216,0])])expect(()=>decodeDesignImage(bytes)).toThrow()
 const png=PNG.sync.write(fixture([255,255,255],[0,0,0]));png.writeUInt32BE(100000,16);expect(()=>decodeDesignImage(png)).toThrow(/dimensions/)
 expect(()=>extractDesignTokens({image:{width:100000,height:100000,data:new Uint8Array(0)}})).toThrow(/RGBA/)
})
it('returns null typography when the pixels contain no readable row-band evidence',()=>{
 const image={width:20,height:20,data:new Uint8Array(20*20*4).fill(255)},tokens=extractDesignTokens({image})
 expect(tokens.theme.palette).toEqual([]);expect(tokens.layout.titleLabelFontRatio).toBeNull();expect(tokens.layout.gridlines).toBe(false)
})
