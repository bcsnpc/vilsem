import {it,expect}from'vitest'
import {deriveMosaic,validateMosaic}from'../packages/core/src/templates/mosaic-transform.js'
const layout=(rows,limit)=>deriveMosaic({x:'x',y:'y',value:'v',limit},key=>rows.map(r=>r[key]),rows.length)
it('preserves real joint weights as rectangle areas, widths and source identities',()=>{
 const result=layout([{x:'A',y:'X',v:3},{x:'A',y:'Y',v:1},{x:'B',y:'X',v:6},{x:'A',y:'X',v:2}])
 expect(result.total).toBe(12);expect(result.data).toHaveLength(3)
 expect(result.data[0].rowIndexes).toEqual([0,3])
 for(const cell of result.data){const [x,y,w,h,v]=cell.value;expect(w*h).toBeCloseTo(v/12,12);expect(x+w).toBeLessThanOrEqual(1.000000000001);expect(y+h).toBeLessThanOrEqual(1.000000000001)}
 expect(result.data.reduce((sum,d)=>sum+d.value[2]*d.value[3],0)).toBeCloseTo(1,12)
})
it('handles zero/null-only results and Unicode without artificial cells',()=>{
 expect(layout([{x:'一',y:'🙂',v:null},{x:'一',y:'🙂',v:0}]).data).toEqual([])
 expect(layout([{x:'一',y:'🙂',v:1}]).data[0]).toMatchObject({name:'一 / 🙂',value:[0,0,1,1,1,0,0,'一','🙂']})
})
it('refuses negative, nonfinite, overflowing weights and too many cells',()=>{
 for(const v of [-1,Infinity,'bad'])expect(()=>layout([{x:'A',y:'B',v}])).toThrow()
 expect(()=>layout([{x:'A',y:'B',v:1e308},{x:'C',y:'D',v:1e308}])).toThrow(/finite/)
 expect(()=>layout([{x:'A',y:'B',v:1},{x:'C',y:'D',v:1}],1)).toThrow(/limit/)
})
it('validates every field and its explicit bounded limit',()=>{
 const fields=[],errors=[];validateMosaic({x:'a',y:'b',value:'v',limit:2001},f=>fields.push(f),errors,'t')
 expect(fields).toEqual(['a','b','v']);expect(errors[0]).toContain('1..2000')
})
