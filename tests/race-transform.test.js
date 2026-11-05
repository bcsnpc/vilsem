import{it,expect}from'vitest'
import{deriveRace,validateRace}from'../packages/core/src/templates/race-transform.js'
const records=[{t:'2025-02',c:'A',v:3},{t:'2025-01',c:'A',v:2},{t:'2025-01',c:'B',v:4},{t:'2025-02',c:'B',v:1}]
const run=(rows=records,config={})=>deriveRace({time:'t',category:'c',value:'v',...config},key=>rows.map(r=>r[key]),rows.length)
it('ranks real values over sorted time with stable mark ids and exact row lineage',()=>{
 const result=run();expect(result.timeLabels).toEqual(['2025-01','2025-02']);expect(result.frames[0].data.map(p=>p.name)).toEqual(['B','A']);expect(result.frames[1].data.map(p=>p.name)).toEqual(['A','B'])
 expect(result.frames[1].data[0]).toMatchObject({id:'A',value:3,rowIndexes:[0]});expect(result.maxValue).toBe(4)
 expect(result.frames[0].tileData[0]).toEqual({id:'B',name:'B',value:[1,0,4],rowIndexes:[2]});expect(result.frames[1].tileData[0].value).toEqual([0,0,3])
})
it('provides bounded line histories without replacing missing observations with zero',()=>{
 const result=run([{t:'1',c:'A',v:2},{t:'2',c:'B',v:5},{t:'3',c:'A',v:3}],{history:2})
 expect(result.frames[2].series[0].data).toEqual([{name:'2',value:[1,null],rowIndexes:[]},{name:'3',value:[2,3],rowIndexes:[2]}])
})
it('emits x/y/size for bubble frames without aggregating model measures',()=>{
 const result=run([{t:'1',c:'A',v:.23,x:2,y:3,s:5}],{x:'x',y:'y',size:'s'});expect(result.frames[0].data[0].value).toEqual([2,3,5,.23])
})
it('does not silently sum duplicate grains, ratios, invalid sizes or nonfinite values',()=>{
 expect(()=>run([...records,records[0]])).toThrow(/duplicate grain/)
 expect(()=>run([{t:'1',c:'A',v:Infinity}])).toThrow(/finite/)
 expect(()=>run([{t:'1',c:'A',v:1,x:2,y:3,s:-1}],{x:'x',y:'y',size:'s'})).toThrow(/non-negative/)
})
it('limits frames and ranked groups and handles an empty result',()=>{
 expect(run([]).frames).toEqual([]);expect(run(records,{topN:1}).frames[0].data).toHaveLength(1)
 expect(()=>run(records,{maxFrames:1})).toThrow(/frame limit/)
})
it('validates all field references and bounded options',()=>{
 const errors=[],fields=[];validateRace({time:'t',category:'c',value:'v',x:'x',topN:101},f=>fields.push(f),errors,'test')
 expect(fields).toEqual(['t','c','v','x']);expect(errors).toHaveLength(2)
})
it('formats actual calendar labels without changing frame identity or aggregating months',()=>{
 const result=run([{t:'2020-01-01T00:00:00.0000000',c:'A',v:1}],{timeFormat:'yyyy-MM'});expect(result.labels).toEqual(['2020-01']);expect(result.frames[0].name).toBe('2020-01-01T00:00:00.0000000');expect(result.frames[0].label).toBe('2020-01');expect(()=>run([{t:'not-a-date',c:'A',v:1}],{timeFormat:'yyyy-MM'})).toThrow(/calendar/)
})
