import{it,expect}from'vitest'
import{powerPartition,polygonArea,deriveVoronoi,validateVoronoi}from'../packages/core/src/templates/voronoi-transform.js'
const square=[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}]
it('independently samples the parent interior to detect overlapping or missing cells',()=>{
 const cells=powerPartition(square,[90,5,3,2]),contains=(polygon,x,y)=>{let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside}return inside}
 for(let x=0;x<50;x++)for(let y=0;y<50;y++)expect(cells.filter(cell=>contains(cell,(x+.381966)/50,(y+.618034)/50))).toHaveLength(1)
})
it.each([[1,1,1],[90,5,3,2],[30,29,12,10,9,10]])('solves deterministic weighted power cells for%j',(...weights)=>{
 const cells=powerPartition(square,weights),total=weights.reduce((a,b)=>a+b,0)
 expect(cells.reduce((sum,p)=>sum+polygonArea(p),0)).toBeCloseTo(1,8)
 cells.forEach((cell,i)=>{expect(Math.abs(polygonArea(cell)-weights[i]/total)/(weights[i]/total)).toBeLessThan(.0002);expect(cell.every(p=>p.x>=-1e-10&&p.x<=1+1e-10&&p.y>=-1e-10&&p.y<=1+1e-10)).toBe(true)})
 expect(powerPartition(square,weights)).toEqual(cells)
})
it('preserves hierarchy weights, leaf areas and source identities',()=>{
 const rows=Array.from({length:18},(_,i)=>({country:'C'+Math.floor(i/3),category:'K'+i%3,weight:[90,7,3][i%3]*(1+Math.floor(i/3))})),result=deriveVoronoi({levels:['country','category'],value:'weight'},key=>rows.map(r=>r[key]),rows.length)
 expect(result.data).toHaveLength(24);expect(result.maxRelativeAreaError).toBeLessThan(.001);expect(result.work).toBeLessThanOrEqual(2000000)
 expect(result.nodes.filter(n=>n.depth===1).reduce((sum,n)=>sum+n.area,0)).toBeCloseTo(1,8);expect(result.nodes.find(n=>n.name==='C0 / K0').rowIndexes).toEqual([0])
 const reversed=deriveVoronoi({levels:['country','category'],value:'weight'},key=>[...rows].reverse().map(r=>r[key]),rows.length)
 expect(reversed.nodes.map(n=>({name:n.name,polygon:n.polygon}))).toEqual(result.nodes.map(n=>({name:n.name,polygon:n.polygon})))
})
it('converges for50 deterministic positive-weight probes within the fixed budget',()=>{
 let seed=17;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed}
 for(let probe=0;probe<50;probe++){const weights=Array.from({length:3+probe%5},()=>1+next()%1000),budget={work:0,iterations:0},cells=powerPartition(square,weights,budget),sum=weights.reduce((a,b)=>a+b,0);cells.forEach((p,i)=>expect(Math.abs(polygonArea(p)-weights[i]/sum)/(weights[i]/sum)).toBeLessThan(.0002));expect(budget.work).toBeLessThanOrEqual(2000000)}
})
it('handles empty/zero data and refuses negatives, tiny fractions and excessive solver parameters',()=>{
 expect(deriveVoronoi({levels:['a','b'],value:'v'},()=>[],0).emptyData).toHaveLength(1)
 expect(()=>powerPartition(square,[1,1e-12])).toThrow(/precision/)
 expect(()=>deriveVoronoi({levels:['a','b'],value:'v'},key=>key==='v'?[-1]:['A'],1)).toThrow(/non-negative/)
 const errors=[];validateVoronoi({levels:['a','b'],value:'v',iterations:100000},()=>{},errors,'test');expect(errors.join()).toContain('unknown voronoi setting')
})
