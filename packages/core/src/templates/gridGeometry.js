const finite=(v,message)=>{if(!Number.isFinite(v))throw Error(message);return v}
const hexPath=Array.from({length:6},(_,i)=>{const angle=(30+60*i)*Math.PI/180;return `${i?'L':'M'}${Math.round(Math.cos(angle)*1e6)/1e6} ${Math.round(Math.sin(angle)*1e6)/1e6}`}).join(' ')+' Z'
export function hexagonGeometry(data,radiusX,radiusY){
 if(!(radiusX>0&&radiusY>0)||![radiusX,radiusY].every(Number.isFinite))throw Error('hexbin geometry requires positive finite cell radii')
 const expressionData=data.map(cell=>({...cell,value:[...cell.value,radiusX,radiusY,hexPath]})),xs=data.map(d=>d.value[0]),ys=data.map(d=>d.value[1])
 return {expressionData,expressionXMin:data.length?finite(Math.min(...xs)-radiusX,'hexbin X domain overflow'):0,expressionXMax:data.length?finite(Math.max(...xs)+radiusX,'hexbin X domain overflow'):1,expressionYMin:data.length?finite(Math.min(...ys)-radiusY,'hexbin Y domain overflow'):0,expressionYMax:data.length?finite(Math.max(...ys)+radiusY,'hexbin Y domain overflow'):1}
}
// Marching squares on the sampled KDE grid. Emits bounded line segments,
// including open contours at boundaries, not invented closed confidence areas.
export function contourGeometry(data,bins,fractions){
 if(!Array.isArray(fractions)||fractions.length<1||fractions.length>8||fractions.some((v,i)=>!Number.isFinite(v)||v<=0||v>=1||i>0&&v<=fractions[i-1]))throw Error('contourFractions must be1..8 increasing fractions strictly between0 and1')
 if(!data.length)return {contourData:[],contourLevels:[],contourXMin:0,contourXMax:1,contourYMin:0,contourYMax:1}
 if(!Number.isInteger(bins)||bins<4||bins>64||data.length!==bins*bins)throw Error('Contours require a complete4..64 square density grid')
 const grid=new Map(data.map(d=>[d.grid.join('/'),d])),peak=Math.max(...data.map(d=>d.value[2])),levels=fractions.map(f=>f*peak),contourData=[];let lineage=0
 const simple={1:[[3,0]],2:[[0,1]],3:[[3,1]],4:[[1,2]],6:[[0,2]],7:[[3,2]],8:[[2,3]],9:[[2,0]],11:[[1,2]],12:[[1,3]],13:[[0,1]],14:[[3,0]]}
 for(let level=0;level<levels.length;level++)for(let y=0;y<bins-1;y++)for(let x=0;x<bins-1;x++){
  const corners=[grid.get(`${x}/${y}`),grid.get(`${x+1}/${y}`),grid.get(`${x+1}/${y+1}`),grid.get(`${x}/${y+1}`)]
  if(corners.some(c=>!c||!Array.isArray(c.value)||c.value.slice(0,3).some(v=>!Number.isFinite(v))))throw Error('Contour grid contains missing/nonfinite samples')
  const threshold=levels[level],mask=corners.reduce((m,c,i)=>m|(c.value[2]>=threshold?1<<i:0),0)
  if(mask===0||mask===15)continue
  // Asymptotic saddle decider, scaled before products to avoid overflow.
  const scale=Math.max(1,threshold,...corners.map(c=>Math.abs(c.value[2]))),shifted=corners.map(c=>c.value[2]/scale-threshold/scale),q=shifted[0]*shifted[2]-shifted[1]*shifted[3],pairs=mask===5?(q>=0?[[0,1],[2,3]]:[[3,0],[1,2]]):mask===10?(q<0?[[3,0],[1,2]]:[[0,1],[2,3]]):simple[mask]
  const point=edge=>{const a=corners[edge].value,b=corners[(edge+1)%4].value,delta=b[2]/scale-a[2]/scale,t=delta?(threshold/scale-a[2]/scale)/delta:.5;return [0,1].map(i=>finite(a[i]*(1-t)+b[i]*t,'Contour interpolation overflow'))}
  const rowIndexes=[...new Set(corners.flatMap(c=>c.rowIndexes||[]))]
  for(const [first,second]of pairs){const a=point(first),b=point(second);if(a[0]===b[0]&&a[1]===b[1])continue
   if(lineage+rowIndexes.length>100000||contourData.length>=2000)throw Error('Contours exceed2000 segments/100000 contributor identities; reduce bins/levels or filter input')
   lineage+=rowIndexes.length;contourData.push({name:`${fractions[level]*100}% of peak density`,value:[...a,...b,threshold,level],rowIndexes})
  }
 }
 return {contourData,contourLevels:levels,contourXMin:Math.min(...data.map(d=>d.value[0])),contourXMax:Math.max(...data.map(d=>d.value[0])),contourYMin:Math.min(...data.map(d=>d.value[1])),contourYMax:Math.max(...data.map(d=>d.value[1]))}
}
