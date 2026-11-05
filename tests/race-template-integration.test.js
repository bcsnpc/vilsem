import {it,expect} from 'vitest'
import {instantiateVisual,validateTemplate} from '../packages/core/src/templates/instantiate.js'
const template={meta:{id:'race-integration',formatVersion:4},slots:{time:{kind:'dimension'},category:{kind:'dimension'},value:{kind:'measure'}},transforms:[{as:'ranked',race:{time:'time',category:'category',value:'value',topN:10,history:2}}],animation:{enter:{duration:200},update:{duration:350}},template:{baseOption:{timeline:{axisType:'category',autoPlay:true,playInterval:1000,data:'$calc.ranked.timeLabels'},xAxis:{type:'value'},yAxis:{type:'category'},series:[{id:'rank',type:'bar',data:[]}]},options:{repeat:'$calc.ranked.frames',template:{title:{text:'$item.name'},yAxis:{data:'$item.categories'},series:[{id:'rank',type:'bar',data:'$item.data'}]}}}}
it('resolves real frame data into declarative timeline options and keeps mark ids and lineage',()=>{
 expect(validateTemplate(template).errors).toEqual([])
 const rows=[{_cats:['2025-02','A'],_val:.2},{_cats:['2025-01','A'],_val:.3},{_cats:['2025-01','B'],_val:.5}]
 const {option}=instantiateVisual({template,rows});expect(option.baseOption.timeline.data).toEqual(['2025-01','2025-02']);expect(option.options).toHaveLength(2)
 expect(option.options[0].series[0].data[0]).toEqual({name:'B',id:'B',value:.5,rowIndexes:[2]});expect(option.options[1].series[0].data).toHaveLength(1)
 expect(option.animationDurationUpdate).toBe(350)
})
it('rejects unknown race settings and duplicate model grains through the public template entry point',()=>{
 const invalid=structuredClone(template);invalid.transforms[0].race.callback='window.fetch';expect(validateTemplate(invalid).errors.join()).toContain('unknown race property')
 expect(()=>instantiateVisual({template,rows:[{_cats:['1','A'],_val:1},{_cats:['1','A'],_val:2}]})).toThrow(/duplicate grain/)
})
