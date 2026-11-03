import {describe,it,expect} from 'vitest'
import {composeOption} from '../vilsem-renderer/src/compositions'
const rows=[{_cat:'A',_val:3},{_cat:'B',_val:7}]
const theme={textMuted:'#888',textPrimary:'#fff',gridStroke:'#222'}
describe('Power BI Line/Area identity',()=>{
 it('defaults Area to a filled series',()=>expect(composeOption('area',rows,{},theme).series[0].areaStyle).toBeDefined())
 it('retains an unfilled Line',()=>expect(composeOption('line',rows,{},theme).series[0].areaStyle).toBeUndefined())
})
