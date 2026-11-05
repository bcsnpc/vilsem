import {it,expect} from 'vitest'
import {mapTimelineSeries,collectTimelineSeries,preserveTimelineIndex} from '../packages/core/src/templates/timeline.js'
it('styles every timeline frame using source identities without changing input or losing frame index',()=>{
 const source={baseOption:{timeline:{autoPlay:false},series:[{id:'race',data:[]}]},options:[{series:[{id:'race',data:[{value:3,rowIndexes:[0]}]}]},{series:[{id:'race',data:[{value:4,rowIndexes:[1]}]}]}]}
 const result=mapTimelineSeries(source,s=>({...s,data:s.data.map(d=>({...d,itemStyle:{opacity:d.rowIndexes.includes(1)?1:.25}}))}))
 expect(collectTimelineSeries(result)).toHaveLength(3);expect(result.options[0].series[0].data[0].itemStyle.opacity).toBe(.25);expect(result.options[1].series[0].data[0].itemStyle.opacity).toBe(1);expect(source.options[0].series[0].data[0].itemStyle).toBeUndefined()
 expect(preserveTimelineIndex(result,1).baseOption.timeline).toEqual({autoPlay:false,currentIndex:1});expect(preserveTimelineIndex(result,2)).toBe(result)
})
