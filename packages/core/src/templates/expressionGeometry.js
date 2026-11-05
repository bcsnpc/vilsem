// Fixed data-to-path shaping for bounded custom-series geometry. It emits
// numeric path commands only; authored callbacks and arbitrary SVG are absent.
export function expressionGeometry(panels,{xMin,xMax,yMin,yMax,closed=false}){
 if(![xMin,xMax,yMin,yMax].every(Number.isFinite)||xMin>=xMax||yMin>=yMax)throw Error('expression geometry requires finite increasing domains')
 if(panels.length>100)throw Error('expression geometry panel limit is100')
 const xRange=xMax-xMin,yRange=yMax-yMin;if(!Number.isFinite(xRange)||!Number.isFinite(yRange))throw Error('expression geometry domain span overflow')
 const number=v=>{if(!Number.isFinite(v)||Math.abs(v)>1000000)throw Error('expression geometry coordinate exceeds bounds');return String(Math.round(v*1e6)/1e6)}
 const data=panels.map((panel,index)=>{
  const points=panel.data.map(p=>p.value)
  if(points.length<2||points.length>256)throw Error('expression geometry requires2..256 vertices per path')
  const path=points.map((p,i)=>{if(!Array.isArray(p)||p.length<2||!p.slice(0,2).every(Number.isFinite))throw Error('expression geometry requires numeric point pairs');return `${i?'L':'M'}${number((p[0]-xMin)/xRange)} ${number((yMax-p[1])/yRange)}`}).join(' ')+(closed?' Z':'')
  if(path.length>8192)throw Error('expression geometry path exceeds8192 characters')
  const rowIndexes=[...new Set(panel.rowIndexes||panel.data.flatMap(p=>p.rowIndexes||[]))]
  if(rowIndexes.length>10000||rowIndexes.some(i=>!Number.isInteger(i)||i<0||i>=10000))throw Error('expression geometry requires bounded source-row identities')
  // Keep textual path data away from coordinate dimensions: ECharts coerces
  // axis-mapped values to numeric storage even with an ordinal declaration.
  return {name:panel.name??String(index),rowIndexes,value:[xMin,yMax,xRange,yRange,index,path]}
 })
 return {geometryData:data,geometryXMin:xMin,geometryXMax:xMax,geometryYMin:yMin,geometryYMax:yMax}
}
