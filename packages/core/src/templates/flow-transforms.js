// Trusted finite categorical flow shaping; templates cannot supply algorithms.
import {createModelFormatter} from '../shared/modelFormatting.js'
import {intervalDate} from './date-utils.js'
export function validateFlows(d, field, errors, label) {
  if (!Array.isArray(d.levels) || d.levels.length < 2 || d.levels.length > 6) errors.push(`${label}: flows needs 2..6 levels`)
  else d.levels.forEach(field)
  field(d.value)
  if(d.time!=null)field(d.time)
  if(d.timeFormat!=null&&(!d.time||!['yyyy-MM','yyyy-MM-dd','yyyy'].includes(d.timeFormat)))errors.push(`${label}: flows timeFormat requires time and yyyy-MM|yyyy-MM-dd|yyyy`)
  if (d.order != null && !['input', 'value'].includes(d.order)) errors.push(`${label}: flows order must be input|value`)
  if (d.layout != null && !['line', 'bipartite'].includes(d.layout)) errors.push(`${label}: flows layout must be line|bipartite`)
  if (d.layout === 'bipartite' && d.levels?.length !== 2) errors.push(`${label}: bipartite layout requires exactly two levels`)
}

export function deriveFlows(d, get, n) {
  if(d.time){
    const times=get(d.time),groups=new Map();for(let i=0;i<n;i++){if(times[i]==null||times[i]==='')continue;const name=String(times[i]);if(!groups.has(name)){if(groups.size>=120)throw Error('flows exceeds120 time frames');groups.set(name,[])}groups.get(name).push(i)}
    const timeLabels=[...groups.keys()].sort((a,b)=>a<b?-1:a>b?1:0),format=d.timeFormat?createModelFormatter(d.timeFormat):null;let marks=0,lineage=0
    const frames=timeLabels.map((name,index)=>{const source=groups.get(name),config={...d};delete config.time;delete config.timeFormat;const result=deriveFlows(config,field=>{const values=get(field);return source.map(i=>values[i])},source.length)
      for(const item of [...result.nodes,...result.links]){item.rowIndexes=item.rowIndexes.map(i=>source[i]);lineage+=item.rowIndexes.length}marks+=result.nodes.length+result.links.length;if(marks>50000||lineage>100000)throw Error('flows timeline exceeds50000 marks or100000 contributor identities')
      const date=format?intervalDate(name):null;if(format&&date==null)throw Error('flows timeFormat requires ISO dates');return{name,label:format?format(date):name,index,...result}
    });return{frames,timeLabels,labels:frames.map(frame=>frame.label)}
  }
  const levels = d.levels.map(get), weights = get(d.value), nodes = new Map(), links = new Map()
  let lineage = 0
  const add = (item, value, index) => {
    item.value += value
    if (!Number.isFinite(item.value)) throw Error('flows aggregate exceeds finite numeric range; rescale the input')
    if (++lineage > 20000) throw Error('flows exceeds 20000 lineage entries; filter the input')
    item.rowIndexes.push(index)
  }
  for (let i = 0; i < n; i++) {
    const value = weights[i] == null || weights[i] === '' ? null : Number(weights[i])
    if (value == null || !Number.isFinite(value)) continue
    if (value < 0) throw Error('flows requires non-negative weights')
    // A zero observation contributes no ribbon or category selection.
    if (!value) continue
    const ids = levels.map((values, depth) => {
      const label = String(values[i] ?? '(Blank)'), id = JSON.stringify([depth, label])
      if (!nodes.has(id)) nodes.set(id, {id, name: id, label, depth, category: depth, value: 0, rowIndexes: []})
      add(nodes.get(id), value, i)
      return id
    })
    ids.slice(1).forEach((target, depth) => {
      const source = ids[depth], key = JSON.stringify([source, target])
      if (!links.has(key)) links.set(key, {source, target, label: `${nodes.get(source).label} \u2192 ${nodes.get(target).label}`, value: 0, rowIndexes: []})
      add(links.get(key), value, i)
    })
    if (nodes.size > 2000 || links.size > 10000) throw Error('flows exceeds 2000 nodes or 10000 links; filter the input')
  }
  const ordered = [...nodes.values()].sort((a, b) => a.depth - b.depth || (d.order === 'value' ? b.value - a.value : 0))
  const maximum = Math.max(0, ...ordered.map(node => node.value))
  const counts = d.levels.map((_, depth) => ordered.filter(node => node.depth === depth).length)
  const offsets = Array(d.levels.length).fill(0)
  ordered.forEach((node, index) => {
    node.symbolSize = maximum ? 10 + 32 * Math.sqrt(node.value / maximum) : 10
    if (d.layout === 'line') {node.x = index * 100; node.y = 0}
    else if (d.layout === 'bipartite') {node.x = node.depth * 600; node.y = (++offsets[node.depth]) * 400 / (counts[node.depth] + 1)}
  })
  return {nodes: ordered, links: [...links.values()]}
}
