// Bounded sequences implemented by core, never executable template callbacks.
const finite = v => v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null
export const SEQUENCE_OPS = ['waterfall', 'heikinAshi']
export function validateSequence(op, d, field, errors, label) {
  if (op === 'heikinAshi') {for (const key of ['open','close','low','high']) field(d[key]); return}
  field(d.category); field(d.value)
  if (d.detail != null) field(d.detail)
  if (d.start != null) field(d.start)
  for (const key of ['subtotals','total']) if (d[key] != null && typeof d[key] !== 'boolean') errors.push(`${label}: ${key} must be boolean`)
  for (const key of ['startLabel','totalLabel']) if (d[key] != null && (typeof d[key] !== 'string' || !d[key].trim() || d[key].length > 160)) errors.push(`${label}: ${key} must be a nonempty label up to 160 characters`)
}
export function deriveSequence(op, d, get, n, cats) {
  if (op === 'heikinAshi') {
    const fields = ['open','close','low','high'].map(key => get(d[key]))
    let previous = null
    return {data: Array.from({length:n},(_,i) => {
      const [open,close,low,high] = fields.map(f => finite(f[i]))
      let value = [null,null,null,null]
      if ([open,close,low,high].some(v => v == null)) previous = null
      else {
        if (low > Math.min(open,close) || high < Math.max(open,close)) throw Error(`Invalid OHLC bounds at row ${i}`)
        const haClose = open/4 + close/4 + low/4 + high/4
        const haOpen = previous ? previous[0]/2 + previous[1]/2 : open/2 + close/2
        value = [haOpen,haClose,Math.min(low,haOpen,haClose),Math.max(high,haOpen,haClose)]
        previous = value
      }
      return {name:String(cats[i] ?? ''),value,rowIndexes:[i]}
    })}
  }
  const result = {categories:[],base:[],positive:[],negative:[],totals:[],endpoints:[]}
  const category = get(d.category), detail = d.detail ? get(d.detail) : [], values = get(d.value), groups = new Map()
  for (let i=0;i<n;i++) {
    const v=finite(values[i]); if (v == null) continue
    const key=String(category[i] ?? '(Blank)'), name=d.detail ? String(detail[i] ?? '(Blank)') : key
    if (!groups.has(key)) groups.set(key,new Map())
    const parts=groups.get(key)
    if (!parts.has(name)) parts.set(name,{value:0,rowIndexes:[]})
    const p=parts.get(name); p.value+=v; p.rowIndexes.push(i)
    if (!Number.isFinite(p.value)) throw Error('Waterfall aggregation overflow; rescale the measure')
  }
  if (!groups.size) return result
  const starts=d.start ? get(d.start).map(finite).filter(v=>v!=null) : [0]
  if (!starts.length) throw Error('Waterfall requires a finite start measure')
  if (starts.some(v=>v!==starts[0])) throw Error('Waterfall start must be constant across returned rows')
  let running=starts[0], lineage=0
  const all=[]
  const push=(name,base,positive,negative,total,endpoint,indexes)=>{
    lineage+=indexes.length
    if (lineage>20000 || result.categories.length>=10000) throw Error('Waterfall expansion exceeds 10000 bars or 20000 selection-lineage entries; aggregate or filter the query')
    result.categories.push(name)
    // ECharts 6 stops stack accumulation at a null/NaN intermediate segment.
    // Zero-height inactive segments preserve the valid stack baseline/totals.
    for (const [key,value] of Object.entries({base,positive,negative,totals:total,endpoints:endpoint})) result[key].push({value:value ?? 0,rowIndexes:indexes})
  }
  if (d.start) push(d.startLabel ?? 'Start',0,null,null,running,running,[])
  for (const [group,parts] of groups) {
    for (const [name,p] of parts) {
      const before=running; running+=p.value
      if (!Number.isFinite(running)) throw Error('Waterfall running total overflow; rescale the measure')
      all.push(...p.rowIndexes)
      push(d.detail ? `${group} · ${name}` : group,Math.min(before,running),p.value>=0?p.value:null,p.value<0?-p.value:null,null,running,p.rowIndexes)
    }
    if (d.subtotals) push(`${group} · cumulative`,0,null,null,running,running,[...all])
  }
  if (d.total) push(d.totalLabel ?? 'Total',0,null,null,running,running,[...all])
  return result
}
