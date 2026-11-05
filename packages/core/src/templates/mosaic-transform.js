// Additive area-preserving layout on the unit square. Each cell keeps its
// contributing source rows; no independent marginals or overlaps are invented.
export function validateMosaic(d,field,errors,label){
 for(const key of ['x','y','value'])field(d[key])
 if(d.limit!=null&&(!Number.isInteger(d.limit)||d.limit<1||d.limit>2000))errors.push(`${label}: mosaic limit must be 1..2000 cells`)
}
export function deriveMosaic(d,get,n){
 const xs=get(d.x),ys=get(d.y),values=get(d.value),groups=new Map(),yNames=[],yIndexes=new Map();let total=0,count=0
 for(let i=0;i<n;i++){
  const raw=values[i];if(raw==null||raw==='')continue
  const v=Number(raw);if(!Number.isFinite(v))throw Error('mosaic requires finite additive weights')
  if(v<0)throw Error('mosaic requires non-negative additive weights');if(v===0)continue
  const x=String(xs[i]??'(Blank)'),y=String(ys[i]??'(Blank)')
  if(!groups.has(x))groups.set(x,{sum:0,cells:new Map()})
  const group=groups.get(x)
  if(!group.cells.has(y)){if(++count>(d.limit??2000))throw Error('mosaic cell limit exceeded; filter the input');group.cells.set(y,{weight:0,rowIndexes:[]})}
  if(!yIndexes.has(y)){yIndexes.set(y,yNames.length);yNames.push(y)}
  const cell=group.cells.get(y);cell.weight+=v;cell.rowIndexes.push(i);group.sum+=v;total+=v
  if(!Number.isFinite(total))throw Error('mosaic additive total exceeds finite range; rescale the measure')
 }
 const data=[],xCategories=[...groups.keys()];let left=0,xi=0
 for(const [x,group]of groups){
  const width=group.sum/total;let bottom=0
  for(const [y,cell]of group.cells){const height=cell.weight/group.sum;data.push({name:`${x} / ${y}`,rowIndexes:cell.rowIndexes,value:[left,bottom,width,height,cell.weight,xi,yIndexes.get(y),x,y]});bottom+=height}
  left+=width;xi++
 }
 return {data,xCategories,yCategories:yNames,total,count:data.length}
}
