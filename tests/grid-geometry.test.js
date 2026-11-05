import{it,expect}from'vitest'
import{hexagonGeometry,contourGeometry}from'../packages/core/src/templates/gridGeometry.js'
it('emits six-sided hexagons with intact counts, source rows and inclusive domains',()=>{
 const result=hexagonGeometry([{value:[10,20,3],rowIndexes:[0,2,4]}],2,3),point=result.expressionData[0]
 expect(point.rowIndexes).toEqual([0,2,4]);expect(point.value.slice(0,5)).toEqual([10,20,3,2,3]);expect(point.value[5].match(/[ML]/g)).toHaveLength(6);expect(result.expressionXMin).toBe(8);expect(result.expressionYMax).toBe(23)
})
const gradient=()=>Array.from({length:16},(_,i)=>({grid:[i%4,Math.floor(i/4)],value:[i%4,Math.floor(i/4),i%4],rowIndexes:[i]}))
it('interpolates a known linear density contour exactly and retains local contributors',()=>{
 const result=contourGeometry(gradient(),4,[.5]);expect(result.contourData).toHaveLength(3)
 for(const line of result.contourData){expect(line.value[0]).toBe(1.5);expect(line.value[2]).toBe(1.5);expect(line.value[4]).toBe(1.5);expect(line.rowIndexes).toHaveLength(4)}
})
it('handles empty data, multiple levels and saddle cells without fabricating filled confidence areas',()=>{
 expect(contourGeometry([],4,[.5]).contourData).toEqual([]);expect(contourGeometry(gradient(),4,[.25,.75]).contourLevels).toEqual([.75,2.25])
 const saddle=gradient().map(d=>({...d,value:[d.value[0],d.value[1],(d.grid[0]+d.grid[1])%2]}));const result=contourGeometry(saddle,4,[.4]);expect(result.contourData.length).toBeGreaterThan(9);expect(result.contourData.every(d=>d.value.every(Number.isFinite))).toBe(true)
})
it('refuses invalid grids, thresholds and overflow rather than returning misleading marks',()=>{
 expect(()=>contourGeometry(gradient().slice(1),4,[.5])).toThrow(/complete/);expect(()=>contourGeometry(gradient(),4,[.8,.2])).toThrow(/increasing/);expect(()=>hexagonGeometry([],Infinity,1)).toThrow(/radii/)
})
it('uses the asymptotic saddle topology instead of an incorrect centre-average connection',()=>{
 const data=gradient().map(d=>({...d,value:[d.value[0],d.value[1],0]}));data[0].value[2]=100;data[1].value[2]=1;data[4].value[2]=1;data[5].value[2]=10.1
 const result=contourGeometry(data,4,[.1]);expect(result.contourData[0].value[0]).toBe(0);expect(result.contourData[0].value[3]).toBe(0);expect(result.contourData[1].value[0]).toBe(1);expect(result.contourData[1].value[3]).toBe(1)
})
