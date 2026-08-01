// Local LLM pipeline — intent extraction → AppSpec builder.
// Tiny prompts (~200 tok in, ~80 out) ≈ 8–15 sec on CPU.
// Cloud provider paths in llm.js are NEVER touched from here.

const localLlm = require('./localLlm')

// ── All supported visual types ────────────────────────────────────────────
// Multi-word types listed first so regex matching prefers them over substrings.
const ALL_VISUAL_TYPES = [
  'stacked_bar','grouped_bar','stacked_area','sparkline_kpi','stat_card',
  'metric_tile','ranked_list',
  'kpi','bar','column','line','area','donut','pie','scatter','bubble',
  'treemap','heatmap','funnel','radar','gauge','bullet','progress',
  'table','waterfall','lollipop','sankey','chord','sunburst','waffle',
  'slope','bump','narrative','insight',
]

// Default position + config per visual type
const VISUAL_DEFAULTS = {
  kpi:          { w:4,  h:2, cfg:{ showTrend:false, animationPreset:'fade' },          dim:null },
  stat_card:    { w:4,  h:2, cfg:{ showChange:true },                                  dim:null },
  sparkline_kpi:{ w:6,  h:2, cfg:{ showSparkline:true },                               dim:'any' },
  metric_tile:  { w:4,  h:2, cfg:{},                                                   dim:null },
  gauge:        { w:4,  h:3, cfg:{ min:0, max:100 },                                   dim:null },
  bullet:       { w:6,  h:2, cfg:{ min:0 },                                            dim:null },
  progress:     { w:6,  h:2, cfg:{},                                                   dim:null },
  bar:          { w:12, h:4, cfg:{},                              limit:15,             dim:'cat' },
  column:       { w:12, h:4, cfg:{},                              limit:15,             dim:'cat' },
  stacked_bar:  { w:12, h:4, cfg:{ stacked:true },               limit:10,             dim:'cat' },
  grouped_bar:  { w:12, h:4, cfg:{ grouped:true },               limit:8,              dim:'cat' },
  lollipop:     { w:12, h:4, cfg:{},                              limit:15,             dim:'cat' },
  waterfall:    { w:12, h:4, cfg:{},                              limit:12,             dim:'cat' },
  line:         { w:12, h:4, cfg:{ smooth:true, showDots:false, dataLabels:false },     dim:'any' },
  area:         { w:12, h:4, cfg:{ smooth:true, showDots:false, filled:true },          dim:'any' },
  stacked_area: { w:12, h:4, cfg:{ stacked:true, filled:true },                        dim:'any' },
  slope:        { w:8,  h:4, cfg:{},                                                   dim:'any' },
  bump:         { w:12, h:4, cfg:{},                                                   dim:'any' },
  donut:        { w:6,  h:4, cfg:{ innerRadius:60, legendPosition:'right', showLabels:true }, limit:8, dim:'cat' },
  pie:          { w:6,  h:4, cfg:{ legendPosition:'right', showLabels:true },          limit:8,  dim:'cat' },
  sunburst:     { w:6,  h:4, cfg:{},                              limit:10,             dim:'cat' },
  waffle:       { w:6,  h:4, cfg:{},                              limit:8,              dim:'cat' },
  scatter:      { w:8,  h:4, cfg:{},                                                   dim:'cat' },
  bubble:       { w:8,  h:4, cfg:{},                                                   dim:'cat' },
  treemap:      { w:8,  h:4, cfg:{},                              limit:20,             dim:'cat' },
  heatmap:      { w:8,  h:4, cfg:{},                                                   dim:'cat' },
  funnel:       { w:6,  h:4, cfg:{},                              limit:8,              dim:'cat' },
  radar:        { w:6,  h:4, cfg:{},                                                   dim:'cat' },
  chord:        { w:8,  h:4, cfg:{},                                                   dim:'cat' },
  sankey:       { w:12, h:5, cfg:{},                                                   dim:'cat' },
  table:        { w:12, h:5, cfg:{ striped:true },               limit:50,             dim:null },
  ranked_list:  { w:6,  h:5, cfg:{},                              limit:10,             dim:'cat' },
  narrative:    { w:12, h:3, cfg:{},                                                   dim:null },
  insight:      { w:12, h:3, cfg:{},                                                   dim:null },
}

// ── System prompts ─────────────────────────────────────────────────────────

const VISUAL_TYPE_LIST = ALL_VISUAL_TYPES.join('|')

const INTENT_SYSTEM = `Output ONLY valid JSON. No explanation. No markdown.
Schema: {"visual":"${VISUAL_TYPE_LIST}","measures":["exact name"],"dimension":{"table":"T","column":"C"}|null,"title":"string"}
Rules: Pick visual type matching user intent. measures = exact names from provided list. dimension null for kpi/stat_card/gauge/table/narrative.`

const REFINE_SYSTEM = `Output ONLY valid JSON. No explanation. No markdown.
Schema: {"op":"add|remove|color|type|config","target":"visual_id or visual_type or null","changes":{}}
add: changes={visual:"${VISUAL_TYPE_LIST}",measure:"exact name"}
remove: target=id or type, changes={}
color: changes={colorName:"gold|blue|red|green|purple|orange|teal|pink|gray|yellow|emerald|violet|crimson|rose|cyan|amber|navy|lime|indigo"}
type: target=id or type, changes={newType:"${VISUAL_TYPE_LIST}"}
config: target=id or type, changes={fieldName:value}`

// ── Keyword helpers ────────────────────────────────────────────────────────

function detectExplicitVisualType(desc) {
  const d = desc.toLowerCase()
  return ALL_VISUAL_TYPES.find(t => new RegExp(`\\b${t.replace('_', '[_ ]')}\\b`).test(d)) || null
}

function detectVisualHint(desc) {
  const d = desc.toLowerCase()
  if (/\b(kpi|card|big number|single number|total|metric tile)\b/.test(d)) return 'kpi'
  if (/\bstacked[_ ]bar\b/.test(d))   return 'stacked_bar'
  if (/\bgrouped[_ ]bar\b/.test(d))   return 'grouped_bar'
  if (/\bstacked[_ ]area\b/.test(d))  return 'stacked_area'
  if (/\bsparkline\b/.test(d))        return 'sparkline_kpi'
  if (/\bstat[_ ]card\b/.test(d))     return 'stat_card'
  if (/\branked[_ ]list\b/.test(d))   return 'ranked_list'
  if (/\b(waterfall|bridge chart)\b/.test(d)) return 'waterfall'
  if (/\blollipop\b/.test(d))         return 'lollipop'
  if (/\b(treemap|tree map)\b/.test(d)) return 'treemap'
  if (/\b(heatmap|heat map)\b/.test(d)) return 'heatmap'
  if (/\b(funnel|conversion|pipeline)\b/.test(d)) return 'funnel'
  if (/\b(radar|spider|web chart)\b/.test(d)) return 'radar'
  if (/\bgauge\b/.test(d))            return 'gauge'
  if (/\bbubble\b/.test(d))           return 'bubble'
  if (/\bscatter\b/.test(d))          return 'scatter'
  if (/\b(donut|doughnut)\b/.test(d)) return 'donut'
  if (/\bpie\b/.test(d))              return 'pie'
  if (/\b(area chart|area)\b/.test(d)) return 'area'
  if (/\b(line|trend|over time|by month|monthly|quarterly|yearly|by year|by quarter|by week|daily)\b/.test(d)) return 'line'
  if (/\b(bar|column|rank|top \d|highest|lowest|compare|vs\b)\b/.test(d)) return 'bar'
  if (/\b(table|list|grid|detail|all rows)\b/.test(d)) return 'table'
  if (/\b(sankey|flow)\b/.test(d))    return 'sankey'
  if (/\bnarrative\b/.test(d))        return 'narrative'
  return null
}

function isMultiVisualRequest(desc) {
  return /\b(dashboard|full report|complete|multiple visuals|several charts|overview with|summary with|and also a|along with a|plus a|as well as a|add both|show all)\b/i.test(desc)
}

// ── Prompt builders ────────────────────────────────────────────────────────

function buildIntentPrompt(userDesc, modelCtx) {
  const measures = (modelCtx?.measures || [])
    .filter(m => !m.isHidden).slice(0, 20).map(m => m.name)

  const dateDims = [], catDims = []
  for (const table of (modelCtx?.tables || [])) {
    if (table.tableType === 'measure_group') continue
    for (const col of (table.columns || [])) {
      if (col.isHidden) continue
      const ref = `${table.name}[${col.name}]`
      if (col.isDate) dateDims.push(ref)
      else if (!col.isKey && (col.isCategory || /string|text/i.test(col.dataType || ''))) catDims.push(ref)
    }
  }

  const hint = detectVisualHint(userDesc)
  return [
    `Measures: ${measures.join(', ') || 'none'}`,
    dateDims.length ? `Date dims: ${dateDims.slice(0, 8).join(', ')}` : null,
    catDims.length  ? `Category dims: ${catDims.slice(0, 8).join(', ')}` : null,
    hint            ? `Visual hint: ${hint}` : null,
    `Request: "${userDesc}"`,
  ].filter(Boolean).join('\n')
}

function buildRefinePrompt(userDesc, currentSpec, modelCtx) {
  const measures = (modelCtx?.measures || [])
    .filter(m => !m.isHidden).slice(0, 15).map(m => m.name)

  const visualSummary = (currentSpec?.visuals || []).map(v => {
    const m = (v.data?.measures || []).join(', ') || 'none'
    const g = v.data?.groupBy ? `${v.data.groupBy.table}[${v.data.groupBy.column}]` : 'none'
    return `${v.id}(${v.type}): measures=[${m}] groupBy=${g}`
  }).join('; ')

  return [
    `Measures: ${measures.join(', ') || 'none'}`,
    `Visuals: ${visualSummary || 'none'}`,
    `Request: "${userDesc}"`,
  ].join('\n')
}

// ── JSON parser ────────────────────────────────────────────────────────────

function parseJson(text) {
  if (!text) return null
  const t = text.trim()
  try { return JSON.parse(t) } catch {}
  const m = t.match(/\{[\s\S]*\}/)
  if (!m) return null
  try { return JSON.parse(m[0]) } catch {}
  return null
}

// ── LLM calls ─────────────────────────────────────────────────────────────

async function extractIntent(userDesc, modelCtx) {
  const prompt = buildIntentPrompt(userDesc, modelCtx)
  console.log(`[localPipeline] Intent prompt ~${prompt.split(/\s+/).length} words`)
  const t0 = Date.now()
  const result = await localLlm.generate([{ role: 'user', content: prompt }], INTENT_SYSTEM, 300)
  console.log(`[localPipeline] Intent done in ${((Date.now()-t0)/1000).toFixed(1)}s | in=${result.usage.inputTokens} out=${result.usage.outputTokens} tok | raw: ${result.content}`)
  return { usage: result.usage, json: parseJson(result.content) }
}

async function extractRefinement(userDesc, currentSpec, modelCtx) {
  const prompt = buildRefinePrompt(userDesc, currentSpec, modelCtx)
  console.log(`[localPipeline] Refine prompt ~${prompt.split(/\s+/).length} words`)
  const t0 = Date.now()
  const result = await localLlm.generate([{ role: 'user', content: prompt }], REFINE_SYSTEM, 200)
  console.log(`[localPipeline] Refine done in ${((Date.now()-t0)/1000).toFixed(1)}s | raw: ${result.content}`)
  return { usage: result.usage, json: parseJson(result.content) }
}

// ── Dimension finders ──────────────────────────────────────────────────────

function findDateDim(modelCtx, measureTable) {
  const related = buildRelated(modelCtx, measureTable)
  const candidates = []
  for (const t of (modelCtx?.tables || [])) {
    if (t.tableType === 'measure_group') continue
    for (const c of (t.columns || [])) {
      if (!c.isDate || c.isHidden) continue
      let score = 0
      if (/date|calendar|time|period/i.test(t.name)) score += 3
      if (/date|month|year|quarter|period/i.test(c.name)) score += 2
      if (related.has(t.name)) score += 1
      candidates.push({ table: t.name, column: c.name, score })
    }
  }
  if (!candidates.length) return null
  return candidates.sort((a, b) => b.score - a.score)[0]
}

function findCategoryDim(modelCtx, measureTable, byPhrase) {
  const related = buildRelated(modelCtx, measureTable)
  const phrase  = (byPhrase || '').toLowerCase().trim()
  const candidates = []
  for (const t of (modelCtx?.tables || [])) {
    if (t.tableType === 'measure_group') continue
    for (const c of (t.columns || [])) {
      if (c.isDate || c.isKey || c.isHidden) continue
      const label = (c.cleanLabel || c.name).toLowerCase()
      const name  = c.name.toLowerCase()
      let score = 0
      if (phrase) {
        if (label === phrase || name === phrase) score += 4
        else if (label.includes(phrase) || phrase.includes(label)) score += 3
        else if (name.includes(phrase)  || phrase.includes(name))  score += 2
      }
      if (related.has(t.name)) score += 1
      if (c.isCategory) score += 1
      if (/string|text/i.test(c.dataType || '')) score += 1
      if (score > 0) candidates.push({ table: t.name, column: c.name, score })
    }
  }
  if (!candidates.length) return null
  return candidates.sort((a, b) => b.score - a.score)[0]
}

function buildRelated(modelCtx, measureTable) {
  const related = new Set([measureTable])
  for (const r of (modelCtx?.relationships || [])) {
    if (!r.isActive) continue
    if (r.fromTable === measureTable) related.add(r.toTable)
    if (r.toTable   === measureTable) related.add(r.fromTable)
  }
  return related
}

// ── Measure helpers ────────────────────────────────────────────────────────

function resolveMeasures(names, modelCtx) {
  const valid = (modelCtx?.measures || []).filter(m => !m.isHidden)
  const result = []
  for (const name of (Array.isArray(names) ? names : [])) {
    if (!name) continue
    const exact = valid.find(m => m.name === name)
    if (exact) { result.push(name); continue }
    const lower = name.toLowerCase()
    const ci    = valid.find(m => m.name.toLowerCase() === lower)
    if (ci)  { result.push(ci.name); continue }
    const sub   = valid.find(m => m.name.toLowerCase().includes(lower) || lower.includes(m.name.toLowerCase()))
    if (sub) result.push(sub.name)
  }
  return [...new Set(result)]
}

function extractMentionedMeasures(desc, modelCtx) {
  const d = desc.toLowerCase()
  const valid = (modelCtx?.measures || []).filter(m => !m.isHidden)
  return [...valid].sort((a,b) => b.name.length - a.name.length)
    .filter(m => d.includes(m.name.toLowerCase())).map(m => m.name)
}

// ── Title generator ────────────────────────────────────────────────────────

function makeTitle(measures, visualType) {
  const base = measures.length === 1 ? measures[0]
    : measures.length === 2 ? `${measures[0]} & ${measures[1]}`
    : `${measures[0]} & more`
  if (/line|area|slope|bump/.test(visualType))              return `${base} Trend`
  if (/bar|column|lollipop|waterfall|ranked/.test(visualType)) return `${base} by Category`
  if (/donut|pie|sunburst|waffle/.test(visualType))         return `${base} Breakdown`
  if (/treemap|funnel|radar/.test(visualType))              return `${base} Distribution`
  return base
}

// ── Color map ──────────────────────────────────────────────────────────────

const COLOR_MAP = {
  gold:'#F59E0B', golden:'#F59E0B', yellow:'#EAB308',
  blue:'#3B82F6', navy:'#1E40AF', sky:'#0EA5E9',
  red:'#EF4444', crimson:'#DC2626', rose:'#F43F5E',
  green:'#22C55E', emerald:'#10B981', lime:'#84CC16',
  purple:'#8B5CF6', violet:'#7C3AED', indigo:'#6366F1',
  orange:'#F97316', amber:'#F59E0B',
  pink:'#EC4899', cyan:'06B6D4', teal:'#14B8A6',
  white:'#F8FAFC', gray:'#64748B', grey:'#64748B', black:'#0F172A', silver:'#94A3B8',
}

function resolveColor(text) {
  const t = (text || '').toLowerCase()
  return COLOR_MAP[t] || COLOR_MAP[Object.keys(COLOR_MAP).find(k => t.includes(k))] || null
}

// ── AppSpec finalizer ──────────────────────────────────────────────────────

function finalizeSpec(spec, pageSize) {
  const { sanitizeAppSpec, reflowLayout } = require('./llm')
  if (pageSize?.preset) spec.layout = { ...(spec.layout||{}), pagePreset: pageSize.preset }
  if (pageSize?.width)  spec.layout = { ...(spec.layout||{}), pageWidth:  pageSize.width }
  if (pageSize?.height) spec.layout = { ...(spec.layout||{}), pageHeight: pageSize.height }
  const r = reflowLayout(sanitizeAppSpec(spec))
  r.version = '1.0'
  return r
}

// ── Build a single visual from type + measures + dimension ─────────────────

function buildVisual(id, visualType, measures, groupBy, yOffset) {
  const d    = VISUAL_DEFAULTS[visualType] || VISUAL_DEFAULTS.bar
  const prim = measures[0]
  const limit = d.limit || null

  const orderBy = (visualType === 'line' || visualType === 'area' || visualType === 'stacked_area' || visualType === 'slope' || visualType === 'bump')
    ? null : 'desc'

  return {
    id,
    type: visualType,
    position: { x: 0, y: yOffset || 0, w: d.w, h: d.h },
    data: {
      measures: (visualType === 'scatter' || visualType === 'bubble') ? measures.slice(0,2) : [prim],
      groupBy:  groupBy || null,
      filters:  [],
      orderBy,
      limit,
    },
    config: { title: makeTitle(measures, visualType), ...d.cfg },
  }
}

// ── Full AppSpec builder from extracted intent ─────────────────────────────

function buildSpecFromIntent(intent, modelCtx, pageSize) {
  const visual   = (intent.visual || 'kpi').toLowerCase().replace(/ /g, '_')
  const measures = resolveMeasures(intent.measures, modelCtx)
  if (!measures.length) return null

  const primary   = measures[0]
  const primObj   = (modelCtx?.measures || []).find(m => m.name === primary) || {}
  const primTable = primObj.table || ''

  const def = VISUAL_DEFAULTS[visual] || VISUAL_DEFAULTS.bar

  // Resolve dimension
  let groupBy = null
  if (def.dim !== null) {
    // Try intent-provided dimension first
    if (intent.dimension?.table && intent.dimension?.column) {
      const tbl = (modelCtx?.tables || []).find(t => t.name === intent.dimension.table)
      const col = tbl && (tbl.columns || []).find(c => c.name === intent.dimension.column)
      if (col) groupBy = { table: intent.dimension.table, column: intent.dimension.column }
    }
    // Auto-detect
    if (!groupBy) {
      const byPhrase = (intent.dimension?.column || '').toLowerCase()
      if (def.dim === 'any') {
        groupBy = findDateDim(modelCtx, primTable) || findCategoryDim(modelCtx, primTable, byPhrase)
      } else if (def.dim === 'cat') {
        groupBy = findCategoryDim(modelCtx, primTable, byPhrase)
      }
    }
    // If dimension required but not found → fallback to kpi
    if (!groupBy && (def.dim === 'cat')) {
      console.log(`[localPipeline] No dimension found for ${visual} — falling back to kpi`)
      return buildSpecFromIntent({ ...intent, visual: 'kpi' }, modelCtx, pageSize)
    }
  }

  // KPI: support multiple cards in a row
  let visuals
  if (visual === 'kpi' || visual === 'stat_card' || visual === 'metric_tile') {
    const count  = Math.min(measures.length, 4)
    const widths = [12, 6, 4, 3]
    const w      = widths[count - 1] || 3
    visuals = measures.slice(0, 4).map((name, i) => ({
      id: `visual_${i + 1}`, type: visual,
      position: { x: i * w, y: 0, w, h: def.h },
      data:   { measures: [name], groupBy: null, filters: [], orderBy: 'desc', limit: null },
      config: { title: name, ...def.cfg },
    }))
  } else {
    visuals = [buildVisual('visual_1', visual, measures, groupBy, 0)]
  }

  const title = typeof intent.title === 'string' && intent.title.trim()
    ? intent.title.trim()
    : makeTitle(measures, visual)

  const appSpec = {
    version: '1.0', title,
    theme:   { mode: 'dark', primaryColor: '#3B82F6', fontFamily: 'Inter' },
    layout:  { columns: 12, rowHeight: 80, gap: 8 },
    visuals, slicers: [], connections: [], warnings: [],
  }
  return finalizeSpec(appSpec, pageSize)
}

// ── Programmatic patch (instant, no LLM) ──────────────────────────────────

function programmaticPatch(desc, currentSpec, modelCtx, pageSize) {
  const d = desc.toLowerCase()

  // ── Color by measure name: "change color of [measure] to gold" ───────────
  const colorOfMatch = desc.match(/(?:color\s+of|make|change|set)\s+(.+?)\s+(?:to|as)\s+(\w+)/i)
    || desc.match(/(\w[\w\s]+?)\s+(color|colour)\s+(?:to\s+|as\s+)?(\w+)/i)
  if (colorOfMatch) {
    const phrase    = (colorOfMatch[1] || '').trim().toLowerCase()
    const colorWord = colorOfMatch[colorOfMatch.length - 1]
    const hex       = resolveColor(colorWord)
    if (hex && phrase.length > 1) {
      const targetVisual = (currentSpec.visuals || []).find(v =>
        (v.data?.measures || []).some(m => m.toLowerCase().includes(phrase) || phrase.includes(m.toLowerCase()))
      )
      if (targetVisual) {
        const visuals = (currentSpec.visuals || []).map(v =>
          v.id !== targetVisual.id ? v
            : { ...v, config: { ...(v.config||{}), colorScheme: hex, titleColor: hex } }
        )
        return finalizeSpec({ ...currentSpec, visuals }, pageSize)
      }
    }
  }

  // ── Color by type/all: "make kpi gold" / "make all gold" ─────────────────
  const colorKey = Object.keys(COLOR_MAP).find(c => new RegExp(`\\b${c}\\b`).test(d))
  if (colorKey && /\b(make|change|set|color|colour|turn)\b/.test(d)) {
    const hex        = COLOR_MAP[colorKey]
    const targetType = detectExplicitVisualType(d)
    const all        = /\b(all|every)\b/.test(d)
    const target     = targetType
      ? (currentSpec.visuals || []).find(v => v.type === targetType)
      : (all || (currentSpec.visuals || []).length === 1) ? currentSpec.visuals?.[0] : null
    if (target) {
      const visuals = (currentSpec.visuals || []).map(v =>
        v.id !== target.id ? v
          : { ...v, config: { ...(v.config||{}), colorScheme: hex, titleColor: hex } }
      )
      return finalizeSpec({ ...currentSpec, visuals }, pageSize)
    }
  }

  // ── Add visual with explicit type: "add line chart" / "add bar for sales" ─
  if (/\b(add|insert|include|append)\b/.test(d)) {
    const vtype    = detectExplicitVisualType(d) || 'kpi'
    const found    = extractMentionedMeasures(desc, modelCtx)
    const measures = resolveMeasures(found, modelCtx)
    if (!measures.length) return null

    const primary  = measures[0]
    const primObj  = (modelCtx?.measures || []).find(m => m.name === primary) || {}
    const primTbl  = primObj.table || ''
    const def      = VISUAL_DEFAULTS[vtype] || VISUAL_DEFAULTS.bar

    let groupBy = null
    if (def.dim === 'cat') {
      groupBy = findCategoryDim(modelCtx, primTbl, '')
      if (!groupBy) return null
    } else if (def.dim === 'any') {
      groupBy = findDateDim(modelCtx, primTbl) || findCategoryDim(modelCtx, primTbl, '')
    }

    const existing = currentSpec.visuals || []
    const maxY     = existing.reduce((m, v) => Math.max(m, (v.position?.y||0) + (v.position?.h||2)), 0)
    const newId    = `visual_${existing.length + 1}`
    const newVisual = buildVisual(newId, vtype, measures, groupBy, maxY)
    return finalizeSpec({ ...currentSpec, visuals: [...existing, newVisual] }, pageSize)
  }

  // ── Remove visual by type: "remove bar chart" ─────────────────────────────
  if (/\b(remove|delete|hide)\b/.test(d)) {
    const vtype = detectExplicitVisualType(d)
    if (vtype) {
      const filtered = (currentSpec.visuals || []).filter(v => v.type !== vtype)
      if (filtered.length < (currentSpec.visuals || []).length) {
        return finalizeSpec({ ...currentSpec, visuals: filtered }, pageSize)
      }
    }
  }

  // ── Change visual type: "change bar to line" ──────────────────────────────
  const typeChangeMatch = d.match(/\bchange\b.+\bto\b\s+(\w+)/)
    || d.match(/\bconvert\b.+\bto\b\s+(\w+)/)
    || d.match(/\bmake\b.+\b(?:a|an)\b\s+(\w+)/)
  if (typeChangeMatch) {
    const newType = detectExplicitVisualType(typeChangeMatch[1] || typeChangeMatch[0])
    const fromType = detectExplicitVisualType(d.replace(typeChangeMatch[1] || '', ''))
    if (newType && newType !== fromType) {
      const target = fromType
        ? (currentSpec.visuals || []).find(v => v.type === fromType)
        : (currentSpec.visuals || []).length === 1 ? currentSpec.visuals[0] : null
      if (target) {
        const def = VISUAL_DEFAULTS[newType] || {}
        const visuals = (currentSpec.visuals || []).map(v =>
          v.id !== target.id ? v
            : { ...v, type: newType, config: { ...(v.config||{}), ...def.cfg } }
        )
        return finalizeSpec({ ...currentSpec, visuals }, pageSize)
      }
    }
  }

  return null
}

// ── Apply LLM-extracted refinement op ─────────────────────────────────────

function applyRefinement(currentSpec, op, modelCtx, pageSize) {
  if (!op?.op) return null
  let updated = { ...currentSpec, visuals: [...(currentSpec.visuals || [])] }

  if (op.op === 'add') {
    const measure  = resolveMeasures([op.changes?.measure], modelCtx)[0]
    if (!measure) return null
    const vtype    = ((op.changes?.visual || 'kpi').toLowerCase().replace(/ /g,'_'))
    const primObj  = (modelCtx?.measures || []).find(m => m.name === measure) || {}
    const primTbl  = primObj.table || ''
    const def      = VISUAL_DEFAULTS[vtype] || VISUAL_DEFAULTS.bar

    let groupBy = null
    if (def.dim === 'cat') {
      groupBy = findCategoryDim(modelCtx, primTbl, '')
      if (!groupBy) return null
    } else if (def.dim === 'any') {
      groupBy = findDateDim(modelCtx, primTbl) || findCategoryDim(modelCtx, primTbl, '')
    }

    const existing  = currentSpec.visuals || []
    const maxY      = existing.reduce((m, v) => Math.max(m, (v.position?.y||0)+(v.position?.h||2)), 0)
    const newVisual = buildVisual(`visual_${existing.length + 1}`, vtype, [measure], groupBy, maxY)
    updated.visuals = [...existing, newVisual]

  } else if (op.op === 'remove') {
    const target = op.target
    if (!target) return null
    const filtered = updated.visuals.filter(v => v.id !== target && v.type !== target)
    if (filtered.length === updated.visuals.length) return null
    updated.visuals = filtered

  } else if (op.op === 'color') {
    const hex = resolveColor(op.changes?.colorName)
    if (!hex) return null
    const target = op.target
    // If target looks like a measure name, find the visual containing it
    const targetVisualByMeasure = target
      ? (updated.visuals).find(v => (v.data?.measures||[]).some(m => m.toLowerCase().includes((target||'').toLowerCase())))
      : null
    const targetVisualByType = target
      ? updated.visuals.find(v => v.id === target || v.type === target)
      : null
    const tv = targetVisualByMeasure || targetVisualByType
    updated.visuals = updated.visuals.map(v => {
      if (tv && v.id !== tv.id) return v
      return { ...v, config: { ...(v.config||{}), colorScheme: hex, titleColor: hex } }
    })

  } else if (op.op === 'type') {
    const newType = (op.changes?.newType || '').toLowerCase().replace(/ /g,'_')
    if (!newType) return null
    const target  = op.target
    const def     = VISUAL_DEFAULTS[newType] || {}
    updated.visuals = updated.visuals.map(v => {
      if (target && v.id !== target && v.type !== target) return v
      return { ...v, type: newType, config: { ...(v.config||{}), ...def.cfg } }
    })

  } else if (op.op === 'config') {
    const target  = op.target
    const changes = op.changes || {}
    if (!Object.keys(changes).length) return null
    updated.visuals = updated.visuals.map(v => {
      if (target && v.id !== target && v.type !== target) return v
      return { ...v, config: { ...(v.config||{}), ...changes } }
    })

  } else {
    return null
  }

  return finalizeSpec(updated, pageSize)
}

// ── Main entry point ───────────────────────────────────────────────────────

async function generate({ userDescription, currentSpec, modelCtx, pageSize }) {
  if (!modelCtx) throw new Error('No semantic model connected. Please connect to a dataset first.')

  const t0 = Date.now()
  let spec = null, usage = null, provider = 'local-intent'

  if (currentSpec) {
    // ── Refinement path ────────────────────────────────────────────────────

    // Step 1: comprehensive programmatic patterns — no LLM, instant
    spec = programmaticPatch(userDescription, currentSpec, modelCtx, pageSize)
    if (spec) {
      console.log('[localPipeline] Programmatic patch matched — skipping LLM')
      provider = 'local-programmatic'
    }

    // Step 2: LLM refinement
    if (!spec) {
      console.log('[localPipeline] No programmatic match — calling LLM for refinement...')
      const result = await extractRefinement(userDescription, currentSpec, modelCtx)
      usage = result.usage
      if (result.json) spec = applyRefinement(currentSpec, result.json, modelCtx, pageSize)
    }

    if (!spec) {
      throw new Error(
        'Could not interpret this change. Try:\n' +
        '• "add [measure] as kpi / bar / line / donut"\n' +
        '• "remove [visual type]"\n' +
        '• "make [kpi/bar/measure name] gold"\n' +
        '• "change bar to line"'
      )
    }

  } else {
    // ── New spec path ──────────────────────────────────────────────────────

    // Warn if user asks for a full dashboard — local works best one visual at a time
    const multiRequest = isMultiVisualRequest(userDescription)
    if (multiRequest) {
      console.log('[localPipeline] Multi-visual request detected — generating single visual with warning')
    }

    console.log('[localPipeline] Calling LLM for intent extraction...')
    const result = await extractIntent(userDescription, modelCtx)
    usage = result.usage

    if (result.json) spec = buildSpecFromIntent(result.json, modelCtx, pageSize)

    if (!spec) {
      throw new Error(
        'Could not generate a visual. Tip: name a specific measure.\n' +
        'Example: "show Total Sales as a KPI" or "bar chart of Internet Sales by Product Category"'
      )
    }

    // Add warning for multi-visual requests
    if (multiRequest && spec) {
      spec = {
        ...spec,
        warnings: [
          ...(spec.warnings || []),
          'Local mode works best one visual at a time. Add more visuals by typing "add [visual type] for [measure]".',
        ],
      }
    }
  }

  const elapsed = Date.now() - t0
  const u = usage || { inputTokens:0, outputTokens:0, totalTokens:0, elapsedMs:elapsed, estimatedCost:0 }

  return {
    spec, stage1: null,
    provider, model: 'phi-4-mini-q4',
    routingProvider: 'local-intent',
    usage: {
      stage1:   { inputTokens:0, outputTokens:0, totalTokens:0, elapsedMs:0, estimatedCost:0 },
      stage2:   { ...u, elapsedMs: elapsed },
      combined: { ...u, elapsedMs: elapsed },
    },
  }
}

module.exports = { generate }
