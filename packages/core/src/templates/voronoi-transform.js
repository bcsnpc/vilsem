const EPS=1e-12,MAX_WORK=2000000
const charge=(budget,n=1)=>{budget.work+=n;if(budget.work>MAX_WORK)throw Error('voronoi exceeds2000000 geometric work units; reduce siblings/levels or filter input')}
export function polygonArea(polygon){return Math.abs(polygon.reduce((sum,p,i)=>{const q=polygon[(i+1)%polygon.length];return sum+p.x*q.y-q.x*p.y},0))/2}
function centroid(polygon){let area=0,x=0,y=0;for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],cross=a.x*b.y-b.x*a.y;area+=cross;x+=(a.x+b.x)*cross;y+=(a.y+b.y)*cross}if(Math.abs(area)<1e-15)throw Error('voronoi cell degenerates below numerical precision');return{x:x/(3*area),y:y/(3*area)}}
function clip(polygon,nx,ny,c,edge,budget){
 const out=[]
 for(let i=0;i<polygon.length;i++){charge(budget);const a=polygon[(i+polygon.length-1)%polygon.length],b=polygon[i],da=nx*a.x+ny*a.y-c,db=nx*b.x+ny*b.y-c,insideA=da<=EPS,insideB=db<=EPS
  const intersection=tag=>{const t=Math.max(0,Math.min(1,da/(da-db)));return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,edge:tag}}
  if(insideA&&insideB)out.push({...b})
  else if(insideA)out.push(intersection(b.edge))
  else if(insideB){out.push(intersection(edge));out.push({...b})}
 }
 if(out.length>256)throw Error('voronoi polygon vertex budget exceeded')
 return out
}
function cellsFor(polygon,sites,weights,budget){
 return sites.map((site,i)=>{let cell=polygon.map(p=>({...p,edge:null}));for(let j=0;j<sites.length&&cell.length>=3;j++)if(i!==j){const other=sites[j],dx=other.x-site.x,dy=other.y-site.y,distance=Math.hypot(dx,dy);if(distance<1e-12)throw Error('voronoi sites coincide below numerical precision');const c=(dx*(other.x+site.x)+dy*(other.y+site.y)+weights[i]-weights[j])/(2*distance);cell=clip(cell,dx/distance,dy/distance,c,j,budget)}return cell})
}
function halton(i,base){let out=0,f=1/base;while(i>0){out+=f*(i%base);i=Math.floor(i/base);f/=base}return out}
function initialSites(polygon,count){
 const triangles=[];let total=0
 for(let i=1;i<polygon.length-1;i++){const vertices=[polygon[0],polygon[i],polygon[i+1]],area=polygonArea(vertices);if(area>1e-15){total+=area;triangles.push({vertices,limit:total})}}
 if(!triangles.length)throw Error('voronoi parent polygon is degenerate')
 return Array.from({length:count},(_,i)=>{const target=(i+.5)/count*total,triangle=triangles.find(t=>target<=t.limit)||triangles.at(-1),[a,b,c]=triangle.vertices,u=Math.sqrt(halton(i+1,3)),v=halton(i+1,5);return{x:(1-u)*a.x+u*(1-v)*b.x+u*v*c.x,y:(1-u)*a.y+u*(1-v)*b.y+u*v*c.y}})
}
function linearSolve(matrix,vector){
 const n=vector.length,a=matrix.map((row,i)=>[...row,vector[i]])
 for(let k=0;k<n;k++){let pivot=k;for(let i=k+1;i<n;i++)if(Math.abs(a[i][k])>Math.abs(a[pivot][k]))pivot=i;if(Math.abs(a[pivot][k])<1e-12)return null;[a[k],a[pivot]]=[a[pivot],a[k]];const divisor=a[k][k];for(let j=k;j<=n;j++)a[k][j]/=divisor;for(let i=0;i<n;i++)if(i!==k){const factor=a[i][k];for(let j=k;j<=n;j++)a[i][j]-=factor*a[k][j]}}
 return a.map(row=>row[n])
}
function solve(polygon,sites,targets,budget){
 const n=sites.length;let weights=Array(n).fill(0),cells=cellsFor(polygon,sites,weights,budget)
 for(let iteration=0;iteration<80;iteration++){
  budget.iterations++;const areas=cells.map(p=>p.length>=3?polygonArea(p):0),errors=areas.map((area,i)=>targets[i]-area),relative=Math.max(...errors.map((e,i)=>Math.abs(e)/targets[i]))
  if(relative<=1e-4)return cells
  const jacobian=Array.from({length:n},()=>Array(n).fill(0))
  cells.forEach((cell,i)=>cell.forEach((b,k)=>{charge(budget);const j=b.edge;if(j==null||j===i)return;const a=cell[(k+cell.length-1)%cell.length],length=Math.hypot(b.x-a.x,b.y-a.y),distance=Math.hypot(sites[j].x-sites[i].x,sites[j].y-sites[i].y),value=length/(2*distance);jacobian[i][i]+=value;jacobian[i][j]-=value}))
  const proposed=linearSolve(jacobian.slice(0,-1).map(row=>row.slice(0,-1)),errors.slice(0,-1)),directions=[...(proposed?[proposed.concat(0)]:[]),errors.map(e=>e-errors.at(-1))],score=errors.reduce((sum,e)=>sum+e*e,0);let accepted=false
  for(const delta of directions){for(let attempt=0;attempt<20;attempt++){const step=2**-attempt,nextWeights=weights.map((w,i)=>w+step*delta[i]);if(nextWeights.some(w=>!Number.isFinite(w)))continue;const next=cellsFor(polygon,sites,nextWeights,budget),nextAreas=next.map(p=>p.length>=3?polygonArea(p):0),nextScore=nextAreas.reduce((sum,area,i)=>sum+(area-targets[i])**2,0);if(nextAreas.every(a=>a>1e-14)&&nextScore<score){weights=nextWeights;cells=next;accepted=true;break}}if(accepted)break}
  if(!accepted)throw Error(`voronoi weighted-cell solve stalled at relative error${relative}; reduce weight imbalance/siblings`)
 }
 throw Error('voronoi weighted-cell solve did not converge within80 iterations')
}
export function powerPartition(polygon,weights,budget={work:0,iterations:0}){
 if(!weights.length||weights.length>24||weights.some(w=>!Number.isFinite(w)||w<=0))throw Error('voronoi requires1..24 positive finite sibling weights')
 if(weights.length===1)return[polygon.map(p=>({x:p.x,y:p.y}))]
 const xMin=Math.min(...polygon.map(p=>p.x)),yMin=Math.min(...polygon.map(p=>p.y)),width=Math.max(...polygon.map(p=>p.x))-xMin,height=Math.max(...polygon.map(p=>p.y))-yMin
 if(!(width>0&&height>0)||![width,height].every(Number.isFinite))throw Error('voronoi parent bounds are degenerate')
 const local=polygon.map(p=>({x:(p.x-xMin)/width,y:(p.y-yMin)/height})),area=polygonArea(local),maximum=Math.max(...weights),scaled=weights.map(w=>w/maximum),sum=scaled.reduce((a,b)=>a+b,0),targets=scaled.map(w=>w/sum*area);if(targets.some(t=>t/area<1e-7))throw Error('voronoi sibling fraction falls below1e-7 precision limit')
 let sites=initialSites(local,weights.length),cells
 for(let pass=0;pass<3;pass++){cells=solve(local,sites,targets,budget);if(pass<2)sites=cells.map(centroid)}
 return cells.map(cell=>cell.map(p=>({x:xMin+p.x*width,y:yMin+p.y*height})))
}
export function validateVoronoi(d,field,errors,label){
 if(!Array.isArray(d.levels)||d.levels.length<2||d.levels.length>3)errors.push(`${label}: voronoi levels must contain2..3 category fields`);else d.levels.forEach(field)
 field(d.value)
 if(d.limit!=null&&(!Number.isInteger(d.limit)||d.limit<1||d.limit>128))errors.push(`${label}: voronoi node limit must be1..128`)
 for(const key of Object.keys(d))if(!['levels','value','limit'].includes(key))errors.push(`${label}: unknown voronoi setting ${key}; solver work/precision limits are fixed`)
}
export function deriveVoronoi(d,get,n){
 const levels=d.levels.map(get),values=get(d.value),root={children:new Map(),value:0,rowIndexes:[]},colours=new Map();let count=0
 for(let i=0;i<n;i++){
  if(values[i]==null||values[i]==='')continue;const value=Number(values[i]);if(!Number.isFinite(value)||value<0)throw Error('voronoi requires non-negative finite additive weights');if(!value)continue
  root.value+=value;if(!Number.isFinite(root.value))throw Error('voronoi additive total overflow; rescale the measure')
  let node=root;const path=[]
  levels.forEach((level,depth)=>{const name=String(level[i]??'(Blank)');if(name.length>2000)throw Error('voronoi category name exceeds2000 characters');path.push(name);if(!node.children.has(name)){if(++count>(d.limit??128))throw Error('voronoi node limit exceeded; filter or aggregate the data');node.children.set(name,{name,path:[...path],depth,children:new Map(),value:0,rowIndexes:[]})}node=node.children.get(name);node.value+=value;node.rowIndexes.push(i)})
 }
 if(!root.value)return{data:[],nodes:[],total:0,maxRelativeAreaError:0,iterations:0,work:0,emptyData:[{value:[.5,.5],rowIndexes:[]}]}
 const budget={work:0,iterations:0},data=[],nodes=[];let maxRelativeAreaError=0
 function visit(parent,polygon){
  const children=[...parent.children.values()].sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0),cells=powerPartition(polygon,children.map(c=>c.value),budget)
  children.forEach((node,i)=>{const cell=cells[i],area=polygonArea(cell),target=node.value/root.value;if(target<1e-7)throw Error('voronoi root fraction falls below1e-7 precision limit');const error=Math.abs(area-target)/target;maxRelativeAreaError=Math.max(maxRelativeAreaError,error);const centre=centroid(cell),leaf=!node.children.size,name=node.path.join(' / ');if(!colours.has(node.name))colours.set(node.name,colours.size);let radius=Infinity
   for(let k=0;k<cell.length;k++){const a=cell[k],b=cell[(k+1)%cell.length],length=Math.hypot(b.x-a.x,b.y-a.y);if(length>EPS)radius=Math.min(radius,Math.abs((b.x-a.x)*(a.y-centre.y)-(a.x-centre.x)*(b.y-a.y))/length)}
   const path=cell.map((p,k)=>`${k?'L':'M'}${Number(p.x.toPrecision(12))} ${Number((1-p.y).toPrecision(12))}`).join(' ')+' Z';if(path.length>8192||!Number.isFinite(radius))throw Error('voronoi path/label geometry budget exceeded')
   const label=Array.from(name).slice(0,120).join('')+(Array.from(name).length>120?'…':'');data.push({name,id:JSON.stringify(node.path),rowIndexes:node.rowIndexes,value:[centre.x,centre.y,node.value,node.depth,colours.get(node.name),leaf?1:0,path,label,Math.SQRT2*radius,Math.SQRT2*radius]});nodes.push({name,depth:node.depth,area,target,error,polygon:cell,rowIndexes:node.rowIndexes})
   if(node.children.size)visit(node,cell)
  })
 }
 visit(root,[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}])
 if(maxRelativeAreaError>.001)throw Error('voronoi hierarchy exceeds0.1% relative area error; no partial layout returned')
 return{data,nodes,total:root.value,maxRelativeAreaError,iterations:budget.iterations,work:budget.work,emptyData:[]}
}
