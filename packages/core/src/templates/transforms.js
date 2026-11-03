// Bounded, declarative data shaping. No source code, callbacks or model writes.
// Relational sums are opt-in: use additive measures for links/hierarchies/facets.
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key)
export const SAFE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/
export const BLOCKED = new Set(['__proto__', 'constructor', 'prototype'])
const OPS = ['window', 'date', 'take', 'links', 'hierarchy', 'facet']
const finite = value => value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null
export function isoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return null
  const date = value.slice(0,10), ms = Date.parse(date + 'T00:00:00Z')
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0,10) === date ? ms : null
}
export function validateTransforms(transforms, slots, params = []) {
  const errors = [], names = new Set(), known = new Set(Object.keys(slots || {}))
  if(params==null)params=[]
  if(!Array.isArray(params)){errors.push('template.params must be an array');params=[]}
  const safeName = name => typeof name === 'string' && SAFE_NAME.test(name) && !BLOCKED.has(name)
  if(transforms.length>128)errors.push('transform limit is 128')
  for(const p of params)if(!safeName(p?.name))errors.push('params require safe names')
  for (const name of known) if (!safeName(name)) errors.push(`unsafe slot name "${name}"`)
  for (const t of transforms || []) {
    if (!t || !safeName(t.as) || names.has(t.as) || known.has(t.as)) { errors.push('each transform needs a unique safe "as" name'); continue }
    const keys = ['calculate', ...OPS].filter(key => own(t,key))
    if (keys.length !== 1) { errors.push(`transform "${t.as}": exactly one supported operation is required (calculate, ${OPS.join(', ')})`); continue }
    const op=keys[0], d=t[op]
    const field = name => { if(!safeName(name) || !known.has(name)) errors.push(`transform "${t.as}": unknown field "${name}"; use a slot or earlier transform`) }
    if(op==='calculate') {
      if(typeof d!=='string' || d.length>2048 || /[^A-Za-z0-9_+*/%().,\s-]/.test(d) || /[A-Za-z_]\w*\s*\./.test(d)) errors.push(`transform "${t.as}": invalid calculate expression`)
      else for(const match of d.matchAll(/[A-Za-z_]\w*/g)) {
        const id=match[0], fn=/^\s*\(/.test(d.slice(match.index+id.length))
        if(fn ? !['abs','min','max','round','floor','ceil','sqrt'].includes(id) : !known.has(id) && !params.some(p=>p.name===id)) errors.push(`transform "${t.as}": unknown ${fn?'function':'field'} "${id}"`)
      }
    } else if(!d || typeof d!=='object' || Array.isArray(d)) errors.push(`transform "${t.as}": ${op} requires an object`)
    else if(op==='hierarchy') {
      if(!Array.isArray(d.levels) || d.levels.length<2 || d.levels.length>6) errors.push(`transform "${t.as}": hierarchy needs 2..6 levels`)
      else d.levels.forEach(field)
      field(d.value)
    } else if(op==='links') { field(d.source);field(d.target);field(d.value) }
    else if(op==='facet') {
      field(d.by);field(d.category);field(d.value)
      if(d.columns!=null && (!Number.isInteger(d.columns)||d.columns<1||d.columns>6)) errors.push(`transform "${t.as}": facet columns must be 1..6`)
      if(d.maxPanels!=null && (!Number.isInteger(d.maxPanels)||d.maxPanels<1||d.maxPanels>36)) errors.push(`transform "${t.as}": maxPanels must be 1..36`)
    } else {
      field(d.field)
      if(op==='window') {
        if(!['sum','lag','percentOfTotal'].includes(d.op)) errors.push(`transform "${t.as}": unknown window op "${d.op}"`)
        if(d.orderBy)field(d.orderBy)
        if(d.partitionBy)field(d.partitionBy)
        if(d.offset!=null && (!Number.isInteger(d.offset)||d.offset<1||d.offset>10000))errors.push(`transform "${t.as}": lag offset must be 1..10000`)
      }
      if(op==='take' && (!Number.isInteger(d.count)||d.count<1||d.count>10000))errors.push(`transform "${t.as}": take count must be 1..10000`)
      if(op==='date' && d.take!=null && (!Number.isInteger(d.take)||d.take<1||d.take>10000))errors.push(`transform "${t.as}": date take must be 1..10000`)
    }
    names.add(t.as);known.add(t.as)
  }
  return {errors,names}
}
export function derive(t, shaped, calc, cats, shapeValues) {
  const get = name => (own(calc,name)?calc[name]:shaped[name])?.values || []
  const n=Math.max(0,...Object.values(shaped).map(s=>s.values?.length||0))
  if(n>10000)throw Error('Template data limit is 10000 rows')
  if(t.date) { const d=t.date; return shapeValues(get(d.field).slice(0,d.take??10000).map(isoDate),cats.slice(0,d.take??10000)) }
  if(t.take) { const values=get(t.take.field).slice(0,t.take.count);return shapeValues(values,values) }
  if(t.window) {
    const d=t.window,values=get(d.field),order=d.orderBy?get(d.orderBy):[],part=d.partitionBy?get(d.partitionBy):[]
    const groups=new Map(), out=Array(values.length).fill(null)
    values.forEach((_,i)=>{const key=part[i]??'';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i)})
    for(const indexes of groups.values()) {
      if(d.orderBy)indexes.sort((a,b)=>String(order[a]??'').localeCompare(String(order[b]??''),'en',{numeric:true}) || a-b)
      let running=0;const total=indexes.reduce((s,i)=>s+(finite(values[i])??0),0)
      indexes.forEach((i,j)=>{const v=finite(values[i]); if(d.op==='sum'){running+=v??0;out[i]=running}else if(d.op==='lag')out[i]=j>=(d.offset||1)?finite(values[indexes[j-(d.offset||1)]]):d.default??null;else out[i]=v==null||total===0?null:v/total})
    }
    return shapeValues(out,cats)
  }
  if(t.links) {
    const d=t.links,sources=get(d.source),targets=get(d.target),weights=get(d.value),nodes=new Map(),links=new Map()
    for(let i=0;i<n;i++) {
      const v=finite(weights[i]);if(v==null)continue;if(v<0)throw Error('links requires non-negative weights')
      const source=JSON.stringify([d.source,sources[i]??'']),target=JSON.stringify([d.target,targets[i]??''])
      for(const [id,label,category] of [[source,sources[i],0],[target,targets[i],1]]) {
        if(!nodes.has(id))nodes.set(id,{id,name:id,category,label:String(label??'(Blank)'),value:0,rowIndexes:[]})
        const node=nodes.get(id);node.value+=v;node.rowIndexes.push(i)
      }
      const key=JSON.stringify([source,target]);if(!links.has(key))links.set(key,{source,target,value:0,rowIndexes:[]})
      links.get(key).value+=v;links.get(key).rowIndexes.push(i)
    }
    return {nodes:[...nodes.values()],links:[...links.values()]}
  }
  if(t.hierarchy) {
    const d=t.hierarchy,levels=d.levels.map(get),weights=get(d.value),roots=[]
    for(let i=0;i<n;i++) {
      const value=finite(weights[i]);if(value==null)continue;if(value<0)throw Error('hierarchy requires non-negative weights')
      let children=roots,path=[]
      for(let depth=0;depth<levels.length;depth++) {
        const name=String(levels[depth][i]??'(Blank)');path.push(name)
        let node=children.find(c=>c.name===name)
        if(!node){node={id:JSON.stringify(path),name,value:0,rowIndexes:[],children:[]};children.push(node)}
        node.value+=value;node.rowIndexes.push(i);children=node.children
      }
    }
    return {children:roots}
  }
  if(t.facet) {
    const d=t.facet,by=get(d.by),category=get(d.category),weight=get(d.value),panels=new Map(),categories=[...new Set(category)]
    for(let i=0;i<n;i++) {
      const key=String(by[i]??'(Blank)');if(!panels.has(key))panels.set(key,new Map())
      const p=panels.get(key),c=category[i]??'',v=finite(weight[i]);if(v==null)continue
      if(!p.has(c))p.set(c,{name:c,value:0,rowIndexes:[]});p.get(c).value+=v;p.get(c).rowIndexes.push(i)
    }
    if(panels.size>(d.maxPanels??36))throw Error(`facet has ${panels.size} panels; maxPanels=${d.maxPanels??36}. Filter or raise the explicit limit.`)
    const columns=Math.min(d.columns??3,Math.max(1,panels.size)),rows=Math.ceil(panels.size/columns),width=86/columns,height=72/Math.max(1,rows)
    const out=[...panels].map(([name,data],index)=>({name,index,categories,data:categories.map(c=>data.get(c)??{name:c,value:null,rowIndexes:[]}),left:`${7+(index%columns)*width}%`,top:`${17+Math.floor(index/columns)*height}%`,width:`${width-4}%`,height:`${height-9}%`}))
    return {panels:out,max:Math.max(0,...out.flatMap(p=>p.data.map(d=>d.value??0)))}
  }
  throw Error(`Unsupported transform "${t.as}"`)
}
