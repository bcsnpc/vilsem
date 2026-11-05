import {it,expect} from 'vitest'
import {deriveFlows,validateFlows} from '../packages/core/src/templates/flow-transforms.js'
it('partitions additive flows into sorted periods and remaps each contributor to the original query row',()=>{
 const rows=[{t:'2020-02-01',a:'A',b:'B',v:5},{t:'2020-01-01',a:'A',b:'B',v:2},{t:'2020-01-01',a:'A',b:'C',v:3}],config={time:'t',timeFormat:'yyyy-MM',levels:['a','b'],value:'v'},result=deriveFlows(config,k=>rows.map(r=>r[k]),rows.length)
 expect(result.labels).toEqual(['2020-01','2020-02']);expect(result.frames[0].links.map(l=>l.value)).toEqual([2,3]);expect(result.frames[0].nodes.find(n=>n.label==='A').rowIndexes).toEqual([1,2]);expect(result.frames[1].links[0].rowIndexes).toEqual([0]);expect(result.frames[1].nodes[0].id).toBe(result.frames[0].nodes[0].id)
 const errors=[];validateFlows({...config,timeFormat:'eval'},()=>{},errors,'test');expect(errors.join()).toContain('timeFormat')
})
it('bounds time frames and refuses invalid formatted dates or negative flows',()=>{
 const config={time:'t',levels:['a','b'],value:'v'};expect(()=>deriveFlows(config,k=>Array.from({length:121},(_,i)=>k==='t'?String(i):k==='v'?1:'A'),121)).toThrow(/120 time/)
 expect(()=>deriveFlows({...config,timeFormat:'yyyy-MM'},k=>k==='t'?['bad']:k==='v'?[1]:['A'],1)).toThrow(/ISO dates/);expect(()=>deriveFlows(config,k=>k==='t'?['2020']:k==='v'?[-1]:['A'],1)).toThrow(/non-negative/)
})
