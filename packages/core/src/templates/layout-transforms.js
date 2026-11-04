// Fixed, bounded layout algorithms. No caller-supplied code or callbacks.
const finite = v => v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null
export const LAYOUT_OPS = ['points', 'chunk', 'top', 'allocate', 'tiles']
export function validateLayout(op, d, field, errors, label, params=[]) {
  const integer = (v, min, max, name) => {if (!Number.isInteger(v) || v < min || v > max) errors.push(`${label}: ${name} must be ${min}..${max}`)}
  if (op === 'points') {
    if (!Array.isArray(d.fields) || d.fields.length < 1 || d.fields.length > 6) errors.push(`${label}: points fields must contain 1..6 fields`)
    else d.fields.forEach(field)
    if (d.name != null) field(d.name)
    if (d.sample != null) integer(d.sample,1,10000,'point sample count')
    if (d.numeric != null && (!Array.isArray(d.numeric) || d.numeric.some(f => !d.fields?.includes(f)))) errors.push(`${label}: numeric must name fields in points.fields`)
    return
  }
  field(d.category); field(d.value)
  if(op==='tiles') {
    if(!Array.isArray(d.positions)||d.positions.length<1||d.positions.length>2000)errors.push(`${label}: tiles positions must contain 1..2000 named coordinates`)
    else {
      const names=new Set(),cells=new Set()
      for(const p of d.positions) {
        if(!p||typeof p.name!=='string'||!p.name||p.name.length>200||names.has(p.name)||!Number.isInteger(p.x)||Math.abs(p.x)>1000||!Number.isInteger(p.y)||Math.abs(p.y)>1000||cells.has(`${p.x}/${p.y}`))errors.push(`${label}: tiles require unique names/cells and integer coordinates within +/-1000`)
        names.add(p?.name);cells.add(`${p?.x}/${p?.y}`)
      }
    }
    return
  }
  if (op === 'chunk') {integer(d.size, 1, 1000, 'chunk size'); integer(d.columns ?? 3, 1, 6, 'columns')}
  else if (op === 'top') {
    if(d.countParam!=null) {
      if(d.count!=null||!params.some(p=>p.name===d.countParam&&p.type==='number'))errors.push(`${label}: top countParam requires a declared numeric parameter and no count`)
    } else integer(d.count, 1, 10000, 'top count')
    if (d.other != null && d.other !== false && (typeof d.other !== 'string' || !d.other.trim() || d.other.length > 100)) errors.push(`${label}: other requires false or a nonempty label up to 100 characters`)
  } else {
    integer(d.total, 1, 2000, 'allocation total')
    if (!['grid', 'hemicycle'].includes(d.layout)) errors.push(`${label}: allocation layout must be grid|hemicycle`)
    integer(d.columns ?? 10, 1, 100, 'columns')
  }
}
function aggregate(category, values, n) {
  const groups = new Map()
  for (let i = 0; i < n; i++) {
    const value = finite(values[i]); if (value == null) continue
    const name = String(category[i] ?? '(Blank)')
    if (!groups.has(name)) groups.set(name, {name, value: 0, rowIndexes: []})
    const g = groups.get(name); g.value += value; g.rowIndexes.push(i)
    if (!Number.isFinite(g.value)) throw Error('Layout aggregation overflow; rescale the input measure')
  }
  return [...groups.values()]
}
export function deriveLayout(op, d, get, n, params={}) {
  if (op === 'points') {
    const fields = d.fields.map(get), names = d.name ? get(d.name) : []
    const length=Math.max(0,...fields.map(values=>values.length)),count=Math.min(length,d.sample ?? length)
    return {data: Array.from({length: count}, (_, index) => {
      const i=count<=1?0:Math.round(index*(length-1)/(count-1))
      return {name: String(names[i] ?? ''), value: fields.map((f, j) => d.numeric?.includes(d.fields[j]) ? finite(f[i]) : f[i] ?? null), rowIndexes: [i]}
    })}
  }
  const groups = aggregate(get(d.category), get(d.value), n)
  if(op==='tiles') {
    const positions=new Map(d.positions.map(p=>[p.name,p]))
    const data=groups.map(g=>{const p=positions.get(g.name);if(!p)throw Error(`tiles has no position for category "${g.name}"; provide an explicit fixed coordinate`);return {...g,value:[p.x,p.y,g.value]}})
    return {data,max:Math.max(0,...groups.map(g=>g.value))}
  }
  if (op === 'top') {
    const count=d.countParam!=null?params[d.countParam]:d.count
    if(!Number.isInteger(count)||count<1||count>10000)throw Error('top count must be an integer 1..10000')
    const ranked = groups.map((g, index) => ({...g, index})).sort((a, b) => b.value - a.value || a.index - b.index)
    const data = ranked.slice(0, count).map(({index, ...g}) => g), tail = ranked.slice(count)
    if (tail.length && d.other !== false) {
      const name = d.other ?? 'Other'
      if (data.some(g => g.name === name)) throw Error(`Other bucket label "${name}" collides with a retained category; choose another label`)
      const value = tail.reduce((sum, g) => sum + g.value, 0)
      if (!Number.isFinite(value)) throw Error('Other bucket aggregation overflow')
      data.push({name, value, rowIndexes: tail.flatMap(g => g.rowIndexes)})
    }
    return {pieData: data, categories: data.map(g => g.name), values: data.map(g => g.value)}
  }
  if (op === 'chunk') {
    const count = Math.ceil(groups.length / d.size)
    if (count > 36) throw Error('chunk exceeds 36 panels; increase size or filter the data')
    const columns = Math.min(d.columns ?? 3, Math.max(1, count)), rows = Math.ceil(count / columns)
    return {panels: Array.from({length: count}, (_, index) => {
      const data = groups.slice(index * d.size, (index + 1) * d.size)
      return {index, name: `Part ${index + 1}`, data, categories: data.map(g => g.name), left: `${4 + index % columns * 92 / columns}%`, top: `${17 + Math.floor(index / columns) * 75 / rows}%`, width: `${92 / columns - 3}%`, height: `${75 / rows - 8}%`}
    })}
  }
  if (groups.some(g => g.value < 0)) throw Error('allocate requires non-negative weights')
  const maximum = Math.max(0, ...groups.map(g => g.value))
  if (!maximum) return {groups: [], total: 0}
  const sum = groups.reduce((s, g) => s + g.value / maximum, 0)
  const counts = groups.map((g, i) => {const exact = g.value / maximum / sum * d.total; return {i, count: Math.floor(exact), remainder: exact % 1}})
  const left = d.total - counts.reduce((s, g) => s + g.count, 0), priority = [...counts].sort((a, b) => b.remainder - a.remainder || a.i - b.i)
  for (let i = 0; i < left; i++) priority[i].count++
  if (counts.reduce((sum, g) => sum + g.count * groups[g.i].rowIndexes.length, 0) > 20000) throw Error('Allocation selection lineage exceeds 20000 entries; reduce seats or aggregate the query grain')
  const positions = []
  if (d.layout === 'grid') {
    const columns = d.columns ?? 10
    for (let i = 0; i < d.total; i++) positions.push([i % columns, Math.floor(i / columns)])
  } else {
    const rows = Math.max(1, Math.round(Math.sqrt(d.total) / 2)), capacities = [], weights = Array.from({length: rows}, (_, r) => 0.5 + 0.5 * (r + 1) / rows), weightSum = weights.reduce((a, b) => a + b)
    let remaining = d.total
    for (let r = 0; r < rows; r++) {const count = r === rows - 1 ? remaining : Math.floor(d.total * weights[r] / weightSum); capacities.push(count); remaining -= count}
    for (let r = 0; r < rows; r++) for (let i = 0; i < capacities[r]; i++) {
      const angle = Math.PI * (capacities[r] === 1 ? 0.5 : i / (capacities[r] - 1)), radius = weights[r]
      positions.push([Math.cos(angle) * radius, Math.sin(angle) * radius])
    }
    positions.sort((a, b) => Math.atan2(b[1], b[0]) - Math.atan2(a[1], a[0]))
  }
  let cursor = 0
  return {total: d.total, groups: groups.map((g, index) => ({...g, index, seats: counts[index].count, data: Array.from({length: counts[index].count}, () => ({name: g.name, value: positions[cursor++], rowIndexes: [...g.rowIndexes]}))}))}
}
