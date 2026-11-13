// Playground Spike — the heart of the spike.
//
// instantiateVisual: a SINGLE PURE FUNCTION that turns a `.vilsem-visual`
// template + normalized rows + param values + theme into a resolved ECharts
// `option` object (exactly what EChartsCanvas consumes).
//
// Declarative only. Templates never carry JavaScript. The one place ECharts
// needs a function — label/tooltip formatters — is expressed as a whitelisted
// DSL string (`formatterTemplate`) and the function is built HERE, in our code,
// from that whitelist. Nothing from the template is ever eval'd.
//
// Token grammar (resolved by resolveToken, never eval):
//   $slot.<name>.categories       category labels for the slot's rows
//   $slot.<name>.values           primary measure values (numbers)
//   $slot.<name>.series.<i>       the i-th measure's values (multi-measure slot)
//   $slot.<name>.pairs            [[cat, val], …] convenience for scatter/lollipop
//   $param.<name>                 a param value (after defaults + coercion)
//   $theme.palette / .palette.<i> / .font / .textMuted / .gridStroke / .accent
//
// Formatter DSL (only inside a `formatterTemplate` string):
//   {value} {value:thousands} {value:percent} {value:compact} {value:date} {name} {seriesName}
//   {value.N[:fmt]} picks tuple component N (e.g. {value.0:percent} for [value, category] pairs).
//   {value:compact} scales to K/M/B/T and keeps the measure's currency symbol ($9.9B).

import { pal, MULTI_COLORS } from '../shared/palettes.js'
import { derive, validateTransforms, BLOCKED } from './transforms.js'
import { contrastingText,readablePalette } from '../shared/colourContrast.js'
import { createModelFormatter } from '../shared/modelFormatting.js'
import {validateExpression,resolveExpressionTokens,compileExpressionSeries} from '../expressions/index.js'
import {applyAnimation,validateAnimation} from './animation.js'
export {mapTimelineSeries,collectTimelineSeries,preserveTimelineIndex} from './timeline.js'
export {createMotionVisibilityController,finishChartFrame} from './motionVisibility.js'
import {applyTemplateTooltipPolicy} from './tooltipPolicy.js'

// ── numeric formatting (deterministic, no Intl dependency) ──────────────────
function fmtThousands(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v ?? '')
  const rounded = Math.round(n * 100) / 100
  const neg = rounded < 0
  const [intPart, fracRaw] = Math.abs(rounded).toString().split('.')
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return (neg ? '-' : '') + grouped + (fracRaw ? '.' + fracRaw : '')
}
function fmtPercent(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v ?? '')
  const pct = Math.round(n * 1000) / 10
  return `${pct}%`
}
// Compact units for labels and axes: 950, 14.6K, 9.9B, 1.2T. One decimal below
// 100 of a unit, none above; a trailing ".0" is dropped so axes read $2B, $4B.
// `style` comes from the bound measure's format: only its currency symbol is kept.
function fmtCompact(v, style) {
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v ?? '')
  const units = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']]
  const abs = Math.abs(n)
  // The 0.9995 threshold promotes values that would round up to 1000 of a unit (999,960 -> 1M).
  const [div, unit] = units.find(([d]) => abs >= d * 0.9995) || [1, '']
  const scaled = abs / div
  const text = (abs < 1 ? Math.round(scaled * 100) / 100 : scaled < 100 ? Math.round(scaled * 10) / 10 : Math.round(scaled)).toString()
  return (n < 0 ? '-' : '') + (style?.prefix || '') + text + unit + (style?.suffix || '')
}
function numberOrNull(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// ── slot-count helper — how many measure fields a slot consumes ─────────────
// The current data shape provides at most 3 measures (_val,_val2,_val3), so a
// range slot shapes for its `max`; the binding panel enforces the `min`.
export function slotCount(count) {
  if (count == null) return 1
  if (typeof count === 'number') return Math.max(1, Math.floor(count))
  if (typeof count === 'object') return Math.max(1, Math.floor(count.max ?? count.min ?? 1))
  return 1
}

// ── shapeValues — the full accessor set for a single numeric array ──────────
// Shared by measure slots and by `calculate` transform outputs so both expose
// the same tokens ($…​.values / .pairs / .pairsSwapped / .cells / .pieData / scalars).
// Min/max date (YYYY-MM-DD) across category labels — ISO dates sort lexically, so
// string min/max is chronological. Feeds a calendar's `range` so it auto-fits the
// data instead of a guessed year. [] when there are no date-like categories.
export function computeDateRange(cats) {
  const dates = (Array.isArray(cats) ? cats : []).filter(v => typeof v === 'string' && /^\d{4}-\d{2}/.test(v))
  if (!dates.length) return []
  let lo = dates[0], hi = dates[0]
  for (const d of dates) { if (d < lo) lo = d; if (d > hi) hi = d }
  return [lo.slice(0, 10), hi.slice(0, 10)]
}

export function shapeValues(primary, cats) {
  const p = Array.isArray(primary) ? primary : []
  const c = Array.isArray(cats) ? cats : []
  const nums = p.filter(v => typeof v === 'number' && Number.isFinite(v))
  const last = nums.length ? nums[nums.length - 1] : null
  const first = nums.length ? nums[0] : null
  const sum = nums.reduce((a, b) => a + b, 0)
  const avg = nums.length ? sum / nums.length : null
  const delta = (last != null && first != null) ? last - first : null
  const deltaPct = (delta != null && first) ? delta / first : null
  return {
    values: p,
    lastRowValue:p.length?(p[p.length-1]??null):null,
    lastRowLabel:p.length?(c[p.length-1]??null):null,
    series: [p],
    categories: c,
    pairs: p.map((v, i) => [c[i], v]),
    pairsSwapped: p.map((v, i) => [v, c[i]]),
    cells: p.map((v, i) => [i, 0, v]),
    pieData: p.map((v, i) => ({ value: v, name: c[i] })),
    dateRange: computeDateRange(c),
    count: 1,
    last, first, sum, avg,
    lastIndex: p.findLastIndex(v=>typeof v==='number' && Number.isFinite(v)),
    min: nums.length ? Math.min(...nums) : null,
    max: nums.length ? Math.max(...nums) : null,
    delta, deltaPct,
    lastLabel: last != null ? fmtThousands(last) : '',
    sumLabel: fmtThousands(sum),
    deltaLabel: delta != null ? fmtThousands(delta) : '',
    deltaPctLabel: deltaPct != null ? fmtPercent(deltaPct) : '',
  }
}

// ── evalExpr — a SAFE arithmetic evaluator (recursive descent, NEVER eval) ──
// Supports + - * / %, parentheses, unary +/-, numbers, identifiers (from scope),
// and a whitelist of math functions. Unknown identifiers → 0; divide-by-zero → 0.
// This is what keeps the `calculate` transform declarative: no JS ever runs.
const CALC_FUNCS = { abs: Math.abs, min: Math.min, max: Math.max, round: Math.round, floor: Math.floor, ceil: Math.ceil, sqrt: Math.sqrt }
export function evalExpr(expr, scope = {}) {
  const src = String(expr == null ? '' : expr)
  let i = 0
  const peek = () => src[i]
  const skipWs = () => { while (i < src.length && /\s/.test(src[i])) i++ }
  function parseExpr() { return parseAdd() }
  function parseAdd() {
    let left = parseMul()
    for (;;) { skipWs(); const c = peek()
      if (c === '+' || c === '-') { i++; const r = parseMul(); left = c === '+' ? left + r : left - r } else return left }
  }
  function parseMul() {
    let left = parseUnary()
    for (;;) { skipWs(); const c = peek()
      if (c === '*' || c === '/' || c === '%') { i++; const r = parseUnary()
        left = c === '*' ? left * r : (r === 0 ? 0 : (c === '/' ? left / r : left % r)) } else return left }
  }
  function parseUnary() { skipWs(); if (peek() === '-') { i++; return -parseUnary() } if (peek() === '+') { i++; return parseUnary() } return parsePrimary() }
  function parsePrimary() {
    skipWs()
    const c = peek()
    if (c === '(') { i++; const v = parseExpr(); skipWs(); if (peek() === ')') i++; return v }
    if (c != null && /[0-9.]/.test(c)) { let n = ''; while (i < src.length && /[0-9.]/.test(src[i])) n += src[i++]; return Number(n) || 0 }
    if (c != null && /[A-Za-z_]/.test(c)) {
      let id = ''; while (i < src.length && /[A-Za-z0-9_]/.test(src[i])) id += src[i++]
      skipWs()
      if (peek() === '(') {
        i++; const args = []; skipWs()
        if (peek() !== ')') { args.push(parseExpr()); skipWs(); while (peek() === ',') { i++; args.push(parseExpr()); skipWs() } }
        if (peek() === ')') i++
        const fn = Object.hasOwn(CALC_FUNCS,id) ? CALC_FUNCS[id] : null
        return fn ? (Number(fn(...args)) || 0) : 0
      }
      const v = scope[id]
      return (typeof v === 'number' && Number.isFinite(v)) ? v : 0
    }
    i++ // skip an unexpected character
    return 0
  }
  const out = parseExpr()
  return Number.isFinite(out) ? out : 0
}

// ── applyTransforms — declarative derived fields (Vega-Lite `calculate` style) ─
// transforms: [{ calculate: "high - low", as: "span" }] → per-row arrays exposed
// as $calc.<as>.* (same accessor set as a measure slot). Identifiers in the
// expression resolve to that row's measure/dim value, params, or an earlier calc.
export function applyTransforms(transforms, shaped, cats, params) {
  const calc = {}
  const warnings = []
  if (!Array.isArray(transforms) || !transforms.length) return { calc, warnings }
  const lens = Object.values(shaped).map(s => (Array.isArray(s?.values) ? s.values.length : 0))
  const rowCount = Math.max(0, ...(cats ? [cats.length] : []), ...lens)
  for (const t of transforms) {
    if (!t || t.as == null) { warnings.push('transform needs { calculate, as }'); continue }
    if (t.calculate == null) { calc[t.as] = derive(t, shaped, calc, cats, shapeValues,params); continue }
    const out = []
    const refs = [...String(t.calculate).matchAll(/[A-Za-z_]\w*/g)].map(m=>m[0]).filter(name=>Object.hasOwn(shaped,name)||Object.hasOwn(calc,name))
    const length = refs.length ? Math.max(0,...refs.map(name=>(calc[name]||shaped[name]).values?.length||0)) : rowCount
    for (let r = 0; r < length; r++) {
      const scope = { ...(params || {}) }
      for (const [name, s] of Object.entries(shaped)) if (Array.isArray(s?.values)) scope[name] = Number(s.values[r]) || 0
      // Relational transforms (facets/links/hierarchies) have no numeric vector.
      // Their presence must not break later independent arithmetic transforms.
      for (const [name, s] of Object.entries(calc)) if(Array.isArray(s?.values))scope[name] = Number(s.values[r]) || 0
      out.push(refs.some(name=>(calc[name]||shaped[name]).values?.[r]==null) ? null : evalExpr(t.calculate, scope))
    }
    calc[String(t.as)] = shapeValues(out, cats)
  }
  return { calc, warnings }
}

// ── shapeSlots — map fixed normalized rows onto named template slots ────────
// rows: [{ _cat, _val, _val2, _val3, ... }]  (from the existing query layer)
// Measure slots consume _val,_val2,_val3 in declaration order; dimension/time
// slots consume the single category axis. This is the fixed-row-shape boundary
// (documented in PLAYGROUND_SPIKE.md §5) — over-declaring measures warns, not breaks.
export function shapeSlots(rows, slots) {
  const warnings = []
  const list = Array.isArray(rows) ? rows : []
  // Up to six dimension/time slots consume _cats in declaration order.
  // (both provided by normaliseTableRows when dimensions[] is bound). Measures
  // read _vals[] first (multi-measure path), falling back to _val/_val2/_val3.
  const cats1 = list.map(r => (r?._cat != null ? String(r._cat) : ''))
  const cats2 = list.map(r => (r?._cat2 != null ? String(r._cat2) : ''))
  const uniq1 = [...new Set(cats1)]
  const uniq2 = [...new Set(cats2.filter(v => v !== ''))]
  const measureFields = ['_val', '_val2', '_val3']
  const measureAt = (r, idx) => (Array.isArray(r?._vals) && r._vals.length > idx)
    ? numberOrNull(r._vals[idx])
    : (idx < 3 ? numberOrNull(r?.[measureFields[idx]]) : null)

  let measCursor = 0
  let dimCursor = 0
  const shaped = {}

  for (const [name, slot] of Object.entries(slots || {})) {
    const kind = slot?.kind
    if (kind === 'measure') {
      const n = slotCount(slot?.count)
      const series = []
      for (let k = 0; k < n; k++) {
        const idx = measCursor++
        if (idx >= 3 && !list.some(r => Array.isArray(r?._vals) && r._vals.length > idx)) {
          warnings.push(`slot "${name}"[${k}]: measure ${idx + 1} exceeds what the bound data provides — bind fewer measures or more fields.`)
          series.push([])
          continue
        }
        series.push(list.map(r => measureAt(r, idx)))
      }
      const primary = series[0] || []
      // matrix: [xIndex, yIndex, value] triples for a 2-D heatmap (dim1 × dim2).
      const matrix = list.map((r, i) => [uniq1.indexOf(cats1[i]), Math.max(0, uniq2.indexOf(cats2[i])), primary[i]])
      shaped[name] = { ...shapeValues(primary, cats1), series, count: series.length, matrix }
    } else if (kind === 'dimension' || kind === 'time') {
      const which = dimCursor++
      const perRow = list.map(r => String(r?._cats?.[which] ?? (which===0?r?._cat:which===1?r?._cat2:r?.['_cat'+(which+1)]) ?? ''))
      const uniq = [...new Set(perRow)]
      // .categories is the UNIQUE axis list (identical to per-row for single-dim
      // groupBy); .values keeps the per-row labels for pairing.
      shaped[name] = { categories: uniq, values: perRow, series: [perRow], pairs: [], count: 1, dateRange: computeDateRange(uniq) }
      const maxCard = slot?.constraints?.maxCardinality
      if (maxCard != null && uniq.length > maxCard) {
        warnings.push(`slot "${name}": ${uniq.length} categories exceeds advisory maxCardinality ${maxCard}.`)
      }
    } else {
      warnings.push(`slot "${name}": unknown kind "${kind}" (expected measure|dimension|time).`)
      shaped[name] = { categories: cats1, values: [], series: [], pairs: [], count: 0 }
    }
  }
  return { shaped, warnings }
}

// ── resolveParams — merge declared defaults with provided values + coerce ───
export function resolveParams(paramDefs, provided) {
  const out = {}
  for (const p of paramDefs || []) {
    if (!p?.name) continue
    const has = provided && Object.prototype.hasOwnProperty.call(provided, p.name)
    let value = has ? provided[p.name] : p.default
    if (p.type === 'number' && value != null && value !== '') {
      const n = Number(value)
      value = Number.isFinite(n) ? n : (p.default ?? 0)
    } else if (p.type === 'boolean') {
      value = Boolean(value)
    }
    out[p.name] = value
  }
  return out
}

// ── token resolution ────────────────────────────────────────────────────────
function getPath(obj, keys) {
  let node = obj
  for (const k of keys) {
    if (node == null) return undefined
    if (BLOCKED.has(k) || !Object.prototype.hasOwnProperty.call(node,k)) return undefined
    node = node[k] // string numeric keys index arrays fine ('0' → arr[0])
  }
  return node
}

export function resolveToken(token, ctx) {
  const path = String(token).slice(1).split('.') // drop leading $
  const root = path[0]
  if (root === 'slot') {
    const slot = ctx.slots?.[path[1]]
    if (slot === undefined) throw new Error(`unknown slot "${path[1]}" in token "${token}"`)
    return getPath(slot, path.slice(2))
  }
  if (root === 'calc') {
    const c = ctx.calc?.[path[1]]
    if (c === undefined) throw new Error(`unknown calc "${path[1]}" in token "${token}" — declare it in template.transforms`)
    return getPath(c, path.slice(2))
  }
  if (root === 'param') return getPath(ctx.params, path.slice(1))
  if (root === 'theme') return getPath(ctx.theme, path.slice(1))
  if (root === 'item') return getPath(ctx.item, path.slice(1))
  throw new Error(`unknown token root "$${root}" in "${token}" (expected slot|calc|param|theme)`)
}

// ── whitelist formatter DSL → real function (built in OUR code, no eval) ─────
export function makeFormatter(tpl,emptyText='') {
  const template = String(tpl)
  const formatter = function formatter(p, modelFormatter) {
    return template.replace(/\{([^}]+)\}/g, (_, expr) => {
      const [rawKey, fmt] = expr.split(':')
      // Accept ECharts' native placeholders as aliases — models reach for them
      // by instinct: {c}=value, {b}=name/category, {a}=seriesName, {d}=percent (pie share).
      const indexed = /^(value|c)\.([0-5])$/.exec(rawKey)
      const key = indexed ? 'value' : rawKey === 'c' ? 'value' : rawKey === 'b' ? 'name' : rawKey === 'a' ? 'seriesName'
        : (rawKey === 'd' || rawKey === 'percent') ? 'percent' : rawKey
      if (key === 'label') {const label=p?.data?.label;return label!=null&&['string','number','boolean'].includes(typeof label)?String(label):p?.name ?? ''}
      if (key === 'name') return p?.name ?? ''
      if (key === 'seriesName') return p?.seriesName ?? ''
      if (key === 'percent') return p?.percent != null ? String(p.percent) : '' // pie slice share-of-total
      if (key === 'value') {
        const raw = (p && typeof p === 'object') ? p.value : p
        const v = Array.isArray(raw) ? raw[indexed ? Number(indexed[2]) : raw.length - 1] : indexed ? null : raw
        if(v==null || v==='' || (typeof v==='number'&&!Number.isFinite(v)))return emptyText
        if (fmt === 'date') { const ms=typeof v==='number'?v:Date.parse(String(v??''));return Number.isFinite(ms)?new Date(ms).toISOString().slice(0,10):'' }
        if (fmt === 'compact') {
          // Compact scaling takes precedence over the measure's own display format,
          // keeping only its currency symbol; percent/date/text measures keep theirs.
          const component=Array.isArray(raw)?(indexed?Number(indexed[2]):raw.length-1):undefined
          const own=typeof modelFormatter!=='function'?null:component==null?modelFormatter
            :modelFormatter.vilsemTupleFormatters?.[component] || (component===(modelFormatter.vilsemValueIndex ?? raw.length-1)?modelFormatter:null)
          const style=own?.vilsemNumberStyle
          if(own && style && style.kind!=='number' && style.kind!=='general')return own(v)
          return fmtCompact(v, style)
        }
        if(typeof modelFormatter==='function') {
          const component=Array.isArray(raw)?(indexed?Number(indexed[2]):raw.length-1):undefined
          const tupleFormatter=component==null?null:modelFormatter.vilsemTupleFormatters?.[component]
          if(typeof tupleFormatter==='function')return tupleFormatter(v)
          if(!Array.isArray(raw) || component===(modelFormatter.vilsemValueIndex ?? raw.length-1))return modelFormatter(v)
        }
        if (fmt === 'thousands') return fmtThousands(v)
        if (fmt === 'percent') return fmtPercent(v)
        return v == null ? '' : String(v)
      }
      return `{${expr}}` // unknown key → leave literal (never eval)
    })
  }
  formatter.vilsemFormatter=true
  return formatter
}

// Power BI host tooltips do not consume ECharts' formatter automatically.
// Reuse only the formatter resolved by trusted core, retaining host identities
// at the caller. Never stringify tuples as unlabelled raw decimal arrays.
export function nativeTemplateTooltipItems(params, formatter, tupleLabels, boundFields, modelFormatter) {
  if(typeof formatter==='function') {
    const formatted=formatter(params)
    if(formatted!=null && typeof formatted!=='object')return [{displayName:'Details',value:String(formatted)}]
  }
  const raw=params?.value ?? params?.data?.value
  const show=value=>value==null?'(Blank)':typeof value==='number'?(modelFormatter?modelFormatter(value):fmtThousands(value)):String(value)
  if(Array.isArray(raw) && Array.isArray(tupleLabels)) {
    const items=raw.slice(0,50).map((value,index)=>({displayName:`${params?.name || params?.seriesName || 'Value'}: ${tupleLabels[index]?.name ?? tupleLabels[index] ?? `Indicator ${index+1}`}`,value:show(value)}))
    if(raw.length>50)items.push({displayName:'Additional indicators',value:`${raw.length-50} omitted`})
    return items
  }
  if(Array.isArray(boundFields))return boundFields.map(field=>{
    const hasFormat=Object.hasOwn(field,'format')
    let value=hasFormat?createModelFormatter(field.format,{locale:field.locale})(field.value):show(field.value)
    if(!field.format && field.value!=null && (field.isDate || Object.prototype.toString.call(field.value)==='[object Date]')) {
      const date=new Date(field.value)
      if(Number.isFinite(date.getTime()))value=date.toISOString().slice(0,10)
    }
    return {displayName:String(field.name),value}
  })
  const label=params?.data?.label
  const name=label!=null&&['string','number','boolean'].includes(typeof label)?label:params?.name ?? params?.seriesName ?? 'Value'
  return [{displayName:String(name),value:Array.isArray(raw)?raw.map(show).join(' / '):show(raw)}]
}

// ── deep walk: replace whole-token strings + convert formatterTemplate keys ──
export function deepResolve(node, ctx, warnings) {
  if (typeof node === 'string') {
    if (node.length > 1 && node[0] === '$') {
      try {
        const v = resolveToken(node, ctx)
        if (v === undefined) { warnings.push(`token "${node}" resolved to undefined`); return null }
        return v
      } catch (e) {
        warnings.push(e.message)
        return null
      }
    }
    return node
  }
  if (Array.isArray(node)) return node.map(n => deepResolve(n, ctx, warnings))
  if (node && typeof node === 'object') {
    if(node.language==='vilsem-expression')return resolveExpressionTokens(node,token=>resolveToken(token,ctx))
    if (Object.hasOwn(node,'concat')) {
      if(Object.keys(node).length!==1 || !Array.isArray(node.concat))throw Error('concat requires an array of declarative arrays')
      const arrays=node.concat.map(part=>deepResolve(part,ctx,warnings))
      if(arrays.some(part=>!Array.isArray(part)))throw Error('concat members must resolve to arrays')
      const result=arrays.flat()
      if(result.length>20000)throw Error('concat limit is 20000 items')
      return result
    }
    if (Object.prototype.hasOwnProperty.call(node,'repeat')) {
      const source=deepResolve(node.repeat,ctx,warnings)
      if(!Array.isArray(source))throw Error('repeat must resolve to an array')
      if(source.length>10000)throw Error('repeat limit is 10000 items')
      const depth=(ctx.repeatDepth||0)+1;if(depth>4)throw Error('repeat nesting limit is 4')
      ctx.budget ||= {remaining:20000}
      return source.map(item=>{if(--ctx.budget.remaining<0)throw Error('repeat expansion limit is 20000 objects');return deepResolve(node.template,{...ctx,item,repeatDepth:depth},warnings)})
    }
    const out = {}
    for (const [k, v] of Object.entries(node)) {
      if (BLOCKED.has(k)) throw Error(`unsafe object key ${k}`)
      if(k==='formatterEmptyText')continue
      if (k === 'formatterTemplate' && typeof v === 'string') {
        out.formatter = makeFormatter(v,node.formatterEmptyText??'')
        continue
      }
      out[k] = deepResolve(v, ctx, warnings)
    }
    return out
  }
  return node
}

// ── theme context: normalized tokens + palette array the DSL reads ──────────
export function buildThemeContext(tokens = {}, colorScheme, fontFamily, paletteOverride,report = {}) {
  const p = pal(colorScheme)
  const base = [p.start, p.mid, ...MULTI_COLORS.filter(c => c !== p.start && c !== p.mid)]
  // Per-section colours (config.sectionColors) override the scheme palette so each
  // bar / slice / category can be coloured individually.
  const override = Array.isArray(paletteOverride) ? paletteOverride.filter(Boolean) : []
  const palette = override.length ? override : base
  return {
    palette,
    readablePalette:readablePalette(palette,report.background||tokens.canvasBg),
    pageBackground:report.background||tokens.canvasBg||'transparent',
    paletteText: palette.map(colour=>contrastingText(colour,tokens.textPrimary || '#252423')),
    accent: palette[0] || p.start,
    // Font is customizable per-instance (the inspector's Text tab writes it); the
    // template consumes it via $theme.font. Falls back to the app's default stack.
    font: fontFamily ? `${fontFamily}, system-ui, sans-serif` : "'Inter', system-ui, -apple-system, sans-serif",
    textPrimary: tokens.textPrimary || 'rgba(255,255,255,0.92)',
    textMuted: tokens.textMuted || 'rgba(255,255,255,0.4)',
    background: tokens.canvasBg || 'transparent', // models reach for $theme.background
    gridStroke: tokens.gridStroke || 'rgba(255,255,255,0.035)',
    gridStrokeOn: tokens.gridStrokeOn || 'rgba(255,255,255,0.08)',
    axisLine: tokens.axisLine || 'rgba(255,255,255,0.08)',
  }
}

// ── the pure entry point ─────────────────────────────────────────────────────
// Expand only series provenance, using the same bounded repeat/concat sources.
// This carries unit information to the formatter adapter without adding private
// metadata to ECharts options or reinterpreting caller calculations.
function seriesSources(node,ctx,parentRepeat,frameRepeat) {
  if(Array.isArray(node))return node.flatMap(item=>seriesSources(item,ctx,parentRepeat,frameRepeat))
  if(!node || typeof node!=='object')return []
  if(Array.isArray(node.concat))return node.concat.flatMap(item=>seriesSources(item,ctx,parentRepeat,frameRepeat))
  if(Object.hasOwn(node,'repeat')) {
    const source=typeof node.repeat==='string'?resolveToken(node.repeat,ctx):node.repeat
    if(!Array.isArray(source))return []
    return source.flatMap(item=>seriesSources(node.template,{...ctx,item},node.repeat,frameRepeat??parentRepeat))
  }
  return [{data:node.data,repeat:parentRepeat,dataRepeat:node.data?.repeat,...(frameRepeat?{frameRepeat}:{})}]
}
function optionFormatSources(node,ctx,frameRepeat){
 const out={seriesSources:seriesSources(node?.series,ctx,frameRepeat,frameRepeat)}
 if(node?.baseOption)out.baseOption=optionFormatSources(node.baseOption,ctx)
 if(Array.isArray(node?.options))out.options=node.options.map(frame=>optionFormatSources(frame,ctx))
 else if(node?.options?.repeat){const frames=deepResolve(node.options.repeat,ctx,[]);out.options=frames.map(item=>optionFormatSources(node.options.template,{...ctx,item},node.options.repeat))}
 return out
}

// { template, rows, params, theme } → { option, warnings, seriesSources }
export function instantiateVisual({ template, rows = [], params = {}, theme, motionPolicy={} } = {}) {
  const warnings = []
  const errors=validateTemplate(template).errors
  if(errors.length)throw Error(errors.join('\n'))
  if(!Array.isArray(rows)||rows.length>10000)throw Error('Template data limit is 10000 rows')
  const { shaped, warnings: slotWarns } = shapeSlots(rows, template?.slots || {})
  warnings.push(...slotWarns)
  const paramValues = resolveParams(template?.params || [], params)
  const cats = (Array.isArray(rows) ? rows : []).map(r => (r?._cat != null ? String(r._cat) : ''))
  const { calc, warnings: tWarns } = applyTransforms(template?.transforms, shaped, cats, paramValues)
  warnings.push(...tWarns)
  const ctx = { slots: shaped, calc, params: paramValues, theme: theme || {} }
  let option = deepResolve(template?.template || {}, ctx, warnings)
  const capabilityErrors=templateCapabilityErrors(option)
  if(capabilityErrors.length)throw Error(capabilityErrors.join('\n'))
  // An absent reference measure is not a zero-valued line. ECharts cannot lay
  // out null annotation coordinates, even when the underlying series is empty.
  for(const series of Array.isArray(option.series)?option.series:[]) {
    for(const annotation of ['markLine','markArea'])if(Array.isArray(series[annotation]?.data))series[annotation]={...series[annotation],data:series[annotation].data.filter(item=>{
      const points=Array.isArray(item)?item:[item]
      return points.every(point=>point && !['xAxis','yAxis'].some(key=>Object.hasOwn(point,key)&&point[key]==null) && (!Array.isArray(point.coord)||point.coord.every(v=>v!=null)))
    })}
  }
  const sources=seriesSources(template?.template?.series,ctx)
  // Playground, web and Fabric also use this entry point directly. Compile the
  // same bounded interpreter here; the spec resolver reapplies pane overrides.
  option=compileExpressionSeries(option,{textDefaults:{color:theme?.textPrimary,fontFamily:theme?.font,...option.textStyle}})
  option=applyAnimation(option,template.animation,motionPolicy)
  option=applyTemplateTooltipPolicy(option)
  return { option, warnings, seriesSources: sources.length===(option.series?.length || 0)?sources:[],formatSources:optionFormatSources(template.template,ctx) }
}

// ── map a template's params → the inspector's schema-field shape ────────────
// Lets a custom visual on the canvas be tuned through the SAME schema-driven
// VisualInspector as a built-in: number→number, color→color, boolean→toggle,
// select→select, else text. Writes land in visual.config → resolveParams reads them.
export function paramsToSchema(template) {
  return (template?.params || []).filter(p => p && p.name).map(p => {
    const base = { key: p.name, label: p.name, default: p.default, group: 'Custom visual' }
    switch (p.type) {
      case 'number':  return { ...base, type: 'number', min: 0, max: 100000, step: 1 }
      case 'color':   return { ...base, type: 'color' }
      case 'boolean': return { ...base, type: 'boolean' }
      case 'select':  return { ...base, type: 'select', options: p.options || [] }
      default:        return { ...base, type: 'text' }
    }
  })
}

// ── static validation for the playground editor (pure, no rows needed) ──────
export function collectTokens(node, acc = [], expression=false) {
  if(node&&typeof node==='object'&&!Array.isArray(node)&&node.language==='vilsem-expression')expression=true
  if(expression&&node?.op==='literal')return acc
  if (typeof node === 'string') {
    if (node.length > 1 && node[0] === '$') acc.push(node)
  } else if (Array.isArray(node)) {
    node.forEach(n => collectTokens(n, acc,expression))
  } else if (node && typeof node === 'object') {
    for (const v of Object.values(node)) collectTokens(v, acc,expression)
  }
  return acc
}

const TEMPLATE_SERIES=new Set(['bar','line','pie','scatter','gauge','radar','treemap','sunburst','sankey','graph','heatmap','tree','boxplot','candlestick','parallel','themeRiver','pictorialBar','funnel','chord','custom'])
function templateCapabilityErrors(option) {
  const errors=[]
  if(option?.geo!=null)errors.push('geo/map rendering requires a shipped registered map asset; the current renderer ships none')
  const visit=(series,path='/template/template/series')=>{
    if(Array.isArray(series)){series.forEach((s,i)=>visit(s,path+'/'+i));return}
    if(!series||typeof series!=='object')return
    if(series.repeat){visit(series.template,path+'/template');return}
    if(series.concat){visit(series.concat,path+'/concat');return}
    if(series.coordinateSystem==='geo'||series.type==='map')errors.push('geo/map rendering requires a shipped registered map asset; the current renderer ships none')
    else if(typeof series.type==='string'&&!series.type.startsWith('$')&&!TEMPLATE_SERIES.has(series.type))errors.push(series.type==='custom'?'custom series requires imperative renderItem; executable callbacks are not supported by the declarative format':`series type "${series.type}" is not shipped by the current renderer; a bounded declarative transform or a sandboxed extension is required`)
    if(series.type==='custom'){
      if(!series.renderItem||series.renderItem.language!=='vilsem-expression')errors.push(`${path}/renderItem: custom series requires a bounded expression AST; imperative/executable callbacks are not supported`)
      else errors.push(...validateExpression(series.renderItem,{path:path+'/renderItem'}).errors.map(e=>`${e.path}: ${e.message}`))
    }else if(series.renderItem&&!String(series.type).startsWith('$'))errors.push(`${path}/renderItem: expression renderers require type custom`)
  }
  visit(option?.series)
  if(option?.baseOption)errors.push(...templateCapabilityErrors(option.baseOption))
  if(Array.isArray(option?.options))for(const frame of option.options)errors.push(...templateCapabilityErrors(frame))
  else if(option?.options?.repeat)errors.push(...templateCapabilityErrors(option.options.template))
  return [...new Set(errors)]
}
export function validateTemplate(template) {
  const errors = []
  const warnings = []
  if (!template || typeof template !== 'object') { errors.push('template must be a JSON object'); return { errors, warnings } }
  errors.push(...validateAnimation(template.animation).map(e=>'/template'+e))
  if(template.animation&&template.meta?.formatVersion!==4)errors.push('/template/meta/formatVersion: declarative animation requires formatVersion4')
  if(template.meta?.formatVersion!=null && ![1,2,3,4].includes(template.meta.formatVersion))errors.push(`Unsupported template formatVersion ${template.meta.formatVersion}`)
  if (!template.meta || !template.meta.id) errors.push('meta.id is required')
  if (!template.meta || !template.meta.name) warnings.push('meta.name is recommended')

  const slots = template.slots || {}
  if (typeof slots !== 'object' || Array.isArray(slots)) errors.push('slots must be an object keyed by slot name')
  for (const [name, slot] of Object.entries(slots)) {
    if (!['measure', 'dimension', 'time'].includes(slot?.kind)) {
      errors.push(`slot "${name}": kind must be measure|dimension|time`)
    }
  }
  const measureSlots = Object.values(slots).filter(s => s?.kind === 'measure')
  const dimSlots = Object.values(slots).filter(s => s?.kind === 'dimension' || s?.kind === 'time')
  // Hard row-shape constraints (the fixed {_cat,_val×3} shape). Errors so the
  // editor lint AND the AI retry loop both reject violations.
  if (measureSlots.length === 0) {
    errors.push('at least one measure slot is required — measure-less visuals are unsupported in this build')
  }
  if (dimSlots.length > 6) {
    errors.push(`at most six dimension/time slots are supported (found ${dimSlots.length}); the 1st maps to $slot.<d>.categories, the 2nd to a second axis / heatmap y`)
  }
  const totalMeasures = measureSlots.reduce((sum, s) => sum + slotCount(s?.count), 0)
  if (totalMeasures > 6) {
    errors.push(`template declares ${totalMeasures} measures; at most six measure bindings are supported.`)
  }

  if (!template.template || typeof template.template !== 'object') {
    errors.push('template.template (the ECharts skeleton) is required')
  }

  const checked = validateTransforms(Array.isArray(template.transforms)?template.transforms:[], slots, template.params)
  errors.push(...checked.errors)
  if(template.transforms!=null&&!Array.isArray(template.transforms))errors.push('template.transforms must be an array')
  const transformNames = checked.names
  const checkSafety=(node,depth=0)=>{
    if(depth>64){errors.push('template nesting limit is 64');return}
    if(Array.isArray(node))return node.forEach(v=>checkSafety(v,depth+1))
    if(!node||typeof node!=='object')return
    if(Object.hasOwn(node,'formatterEmptyText')&&(!Object.hasOwn(node,'formatterTemplate')||typeof node.formatterEmptyText!=='string'||node.formatterEmptyText.length>200))errors.push('formatterEmptyText requires formatterTemplate and a literal string up to 200 characters')
    for(const [key,value] of Object.entries(node)) {
      if(BLOCKED.has(key))errors.push(`unsafe object key ${key}`)
      if(typeof value==='function')errors.push('executable functions are not supported')
      if(key==='renderItem'){
        if(value?.language!=='vilsem-expression')errors.push('custom series requires a bounded expression AST; imperative/executable callbacks are not supported')
        else if(template.meta?.formatVersion!==4)errors.push('bounded expression series requires template.meta.formatVersion4')
        continue // the closed AST validator owns this subtree and its budgets
      }
      checkSafety(value,depth+1)
    }
  }
  checkSafety(template)
  errors.push(...templateCapabilityErrors(template.template).filter(error=>!errors.includes(error)))
  if(errors.length)return {errors,warnings}
  const repeatShapes={frames:['name','label','index','data','tileData','nodes','links','series','categories','timeLabels'],series:['name','id','data','rowIndexes'],data:['name','value','rowIndexes'],groups:['name','value','rowIndexes','index','seats','data'],panels:['name','index','categories','values','rowIndexes','data','last','lastLabel','sum','max','avg','left','top','width','height'],pieData:['name','value'],nodes:['id','name','category','label','value','rowIndexes','depth','offset','span','base','data','pixelSpan','labelWidth','labelVisible','cx','cy','radius','diameter','x','y','symbolSize'],links:['source','target','label','value','rowIndexes'],children:['id','name','value','rowIndexes','children']}
  const checkItems=(node,fields=null)=>{
    if(node==='$item' && fields===null)errors.push('token "$item" requires a repeat scope')
    else if(typeof node==='string' && node.startsWith('$item.')) {
      const property=node.split('.')[1]
      if(!fields || !fields.includes(property))errors.push(`token "${node}" references an unknown repeat item field "${property}"`)
    } else if(Array.isArray(node))node.forEach(item=>checkItems(item,fields))
    else if(node && typeof node==='object') {
      if(Object.hasOwn(node,'repeat')) {
        checkItems(node.repeat,fields)
        const property=typeof node.repeat==='string'?node.repeat.split('.').at(-1):''
        const shape=Object.hasOwn(repeatShapes,property)?repeatShapes[property]:null
        checkItems(node.template,shape||[])
      } else Object.values(node).forEach(item=>checkItems(item,fields))
    }
  }
  checkItems(template.template)

  for (const tok of collectTokens(template.template || {})) {
    if(tok==='$item')continue // scope checked above; copies only the bounded current item
    // A token must be a plain dotted path. Reject expressions / ternaries /
    // arithmetic (the engine never evaluates them — they'd resolve to undefined).
    if (!/^\$(slot|calc|param|theme|item)(\.[A-Za-z0-9_]+)+$/.test(tok)) {
      errors.push(`token "${tok}" is not a plain path — no expressions, comparisons, ternaries, arithmetic, or spaces are allowed. Use $slot.x.y / $calc.x / $param.x / $theme.x, and a visualMap for conditional colour.`)
      continue
    }
    const path = tok.slice(1).split('.')
    if(path.some(part=>BLOCKED.has(part))){errors.push(`unsafe token path ${tok}`);continue}
    if (path[0] === 'slot') {
      if (!slots[path[1]]) errors.push(`token "${tok}" references undeclared slot "${path[1]}"`)
    } else if (path[0] === 'calc') {
      if (!transformNames.has(path[1])) errors.push(`token "${tok}" references undeclared calc "${path[1]}" — add it to template.transforms`)
    } else if (path[0] === 'param') {
      const declared = (template.params || []).some(p => p.name === path[1])
      if (!declared) warnings.push(`token "${tok}" references undeclared param "${path[1]}"`)
    } else if (path[0] !== 'theme' && path[0] !== 'item') {
      errors.push(`token "${tok}" has unknown root "$${path[0]}" (expected slot|calc|param|theme)`)
    }
  }
  return { errors, warnings }
}
