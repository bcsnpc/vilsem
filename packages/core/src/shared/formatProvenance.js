// Display-unit provenance is deliberately narrower than data lineage. A ratio,
// count, density or arbitrary calculation must not inherit its input's currency.
export function formatProvenance(template, slots) {
  const transforms = new Map((template?.transforms || []).map(t => [t.as,t]))
  const fieldUnit = (name, seen = new Set()) => {
    if(slots.has(name))return slots.get(name)
    if(seen.has(name))return null
    const next=new Set(seen);next.add(name)
    const t=transforms.get(name)
    const field=t?.take?.field
      ?? (['sum','lag','ewma'].includes(t?.window?.op)?t.window.field:undefined)
      ?? (['min','max','sum','mean','median','quantile','stddev'].includes(t?.stat?.op)?t.stat.field:undefined)
      ?? (typeof t?.calculate==='string' && /^\s*[A-Za-z_]\w*\s*$/.test(t.calculate)?t.calculate.trim():undefined)
    return field ? fieldUnit(field,next) : null
  }
  return source => {
    let token=source?.data
    if(Array.isArray(token)&&token.length){
      const units=token.map(item=>{const value=item&&typeof item==='object'&&!Array.isArray(item)?item.value:item,match=typeof value==='string'?/^\$(slot|calc)\.(\w+)\.(sum|avg|min|max|first|last|lastRowValue|delta)$/.exec(value):null;return match?fieldUnit(match[2]):null})
      if(units[0]!=null&&units.every(unit=>unit===units[0]))return{index:units[0],direct:false,projection:'values'}
    }
    if(token?.template?.value==='$item.values') {
      const repeat=/^\$calc\.(\w+)\.panels$/.exec(token.repeat || '')
      const d=transforms.get(repeat?.[1])?.facet
      if(d)return {index:fieldUnit(d.value),direct:false,projection:'radar'}
    }
    if(typeof token!=='string')return null
    if(token.startsWith('$item.')) {
      const frame=/^\$calc\.(\w+)\.frames$/.exec(source.frameRepeat || source.repeat || ''),transform=transforms.get(frame?.[1])
      if(transform?.race){const d=transform.race,index=fieldUnit(d.value)
       if(token==='$item.tileData')return{index,direct:false,projection:'matrix'}
       if(token==='$item.data'&&d.x){const tupleUnits=[fieldUnit(d.x),fieldUnit(d.y),fieldUnit(d.size??d.value),index];return{index,direct:false,projection:'points',tupleUnits}}
       if(token==='$item.data'&&source.repeat==='$item.series')return{index,direct:false,projection:'points',tupleUnits:[null,index]}
       if(token==='$item.data')return{index,direct:false,projection:'values'}
      }
      if(transform?.flows&&['$item.nodes','$item.links'].includes(token))return{index:fieldUnit(transform.flows.value),direct:false,projection:'pieData'}
      const repeat=/^\$calc\.(\w+)\.panels$/.exec(source.repeat || source.dataRepeat || '')
      const t=transforms.get(repeat?.[1]),d=t?.facet || t?.chunk
      if(!d || !['$item.data','$item.values'].includes(token))return null
      return {index:fieldUnit(d.value),direct:false,projection:'values'}
    }
    const match=/^\$(slot|calc)\.(\w+)\.(values|pieData|pairs|pairsSwapped|matrix|data|series\.([0-5]))$/.exec(token)
    if(!match)return null
    const [,root,name,projection,measureOffset]=match
    const t=root==='calc'?transforms.get(name):null
    if(t?.points && projection==='data') {
      const tupleUnits=t.points.fields.map(field=>fieldUnit(field))
      return {index:tupleUnits.find(unit=>unit!=null),tupleUnits,direct:true,projection:'points'}
    }
    const aggregate=t?.top || t?.facet || t?.chunk
    const index=root==='slot' && slots.has(name)?slots.get(name)+Number(measureOffset || 0)
      : aggregate?fieldUnit(aggregate.value):fieldUnit(name)
    return {index,direct:root==='slot',projection}
  }
}
