import{it,expect}from'vitest'
import{deriveSetOverlaps,validateSetOverlaps}from'../packages/core/src/templates/set-overlaps.js'
const definition={value:'weight',sets:[{name:'Black',field:'color',equals:'Black'},{name:'Unisex',field:'style',equals:'U'},{name:'High',field:'price',equals:'High'}]}
const run=rows=>deriveSetOverlaps(definition,key=>rows.map(r=>r[key]),rows.length)
it('counts every actual disjoint three-set region and inclusive total without inventing intersections',()=>{
 const rows=Array.from({length:8},(_,mask)=>({color:mask&1?'Black':'Red',style:mask&2?'U':'W',price:mask&4?'High':'Low',weight:mask+1})),result=run(rows)
 expect(result.regions.map(r=>r.count)).toEqual([1,2,3,4,5,6,7,8]);expect(result.total).toBe(36);expect(result.union).toBe(35)
 expect(result.sets.map(s=>s.count)).toEqual([20,22,26]);expect(result.regions[7].rowIndexes).toEqual([7]);expect(result.sets[0].rowIndexes).toEqual([1,3,5,7])
 expect(result.areaEncoding).toContain('not proportional')
})
it('reports an absent triple as zero rather than estimating it from marginals',()=>{
 const result=run([{color:'Black',style:'U',price:'Low',weight:4},{color:'Red',style:'U',price:'High',weight:7}])
 expect(result.regions[7].count).toBe(0);expect(result.regions[7].rowIndexes).toEqual([])
})
it('preserves null/zero emptiness and refuses negative/nonfinite/overflowing weights',()=>{
 expect(run([{weight:null},{weight:0}]).total).toBe(0)
 for(const weight of[-1,Infinity,'invalid'])expect(()=>run([{weight}])).toThrow()
 expect(()=>run([{weight:1e308},{weight:1e308}])).toThrow(/finite range/)
})
it('rejects duplicate/ambiguous set definitions and validates every source field',()=>{
 const fields=[],errors=[];validateSetOverlaps(definition,f=>fields.push(f),errors,'test');expect(errors).toEqual([]);expect(fields).toEqual(['weight','color','style','price'])
 validateSetOverlaps({...definition,sets:[definition.sets[0],definition.sets[0]]},()=>{},errors,'test');expect(errors.join()).toContain('unique names')
})
