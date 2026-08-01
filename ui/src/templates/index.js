// ── Measure classification ──────────────────────────────────────────────────────
function inferType(m) {
  const n = (m.name || '').toLowerCase()
  const e = (m.expression || '').toLowerCase()
  if (n.includes('%') || /\b(rate|ratio|pct|margin|coverage|mix|share)\b/.test(n)) return 'Percent'
  if (/\b(revenue|sales|cost|price|amount|profit|spend|budget|gross|net|income|expense|fee)\b/.test(n)) return 'Currency'
  if (e.includes('countrows') || e.includes('distinctcount') || /\b(count|volume|qty|quantity|units|orders|customers|users)\b/.test(n)) return 'Count'
  if (e.includes('average') || /\b(average|avg|mean)\b/.test(n)) return 'Average'
  return 'Numeric'
}

// Pick up to n measure NAMES, cycling through preferredTypes before falling back
function pickN(measures, preferTypes, n) {
  const vis = (measures || []).filter(m => !m.isHidden)
  const result = []
  const used = new Set()
  for (const type of preferTypes) {
    for (const m of vis) {
      if (result.length >= n) return result
      if (!used.has(m.name) && inferType(m) === type) {
        result.push(m.name); used.add(m.name)
      }
    }
  }
  for (const m of vis) {
    if (result.length >= n) return result
    if (!used.has(m.name)) { result.push(m.name); used.add(m.name) }
  }
  return result
}

// Best category column for bar/donut groupBy
function catBy(dimensions) {
  for (const tbl of (dimensions || [])) {
    if (tbl.tableType === 'measure_group') continue
    for (const col of (tbl.columns || [])) {
      if (col.isHidden || col.isKey) continue
      const dt = (col.dataType || '').toLowerCase()
      if (dt === 'string' || dt.startsWith('str') || col.isCategory) {
        return { table: tbl.name, column: col.name }
      }
    }
  }
  return { table: 'Product', column: 'Category' }
}

// Best date column for trend groupBy
function dateBy(dimensions) {
  for (const tbl of (dimensions || [])) {
    for (const col of (tbl.columns || [])) {
      if (col.isHidden) continue
      const dt = (col.dataType || '').toLowerCase()
      const nm = (col.name || '').toLowerCase()
      if (col.isDate || dt.includes('date') || dt.includes('datetime') || /\b(date|month|year)\b/.test(nm)) {
        return { table: tbl.name, column: col.name }
      }
    }
  }
  return { table: 'Date', column: 'Date' }
}

let _uid = 0
function uid(prefix) { return `${prefix}_${(++_uid).toString(36)}` }

function baseSpec(title, colorScheme, mode) {
  return {
    version: '1.0',
    title,
    theme: { mode: mode || 'dark', colorScheme: colorScheme || 'blue', fontFamily: 'Inter' },
    layout: { columns: 12, rowHeight: 80, gap: 8, pagePreset: '16:9', pageWidth: 1280, pageHeight: 720 },
    visuals: [],
    slicers: [],
  }
}

// ── Visual builders ─────────────────────────────────────────────────────────────
function mkKpi(x, y, w, h, measure) {
  return { id: uid('kpi'), type: 'kpi', position: { x, y, w, h },
    data: { measures: [measure], groupBy: null },
    config: { title: measure } }
}

function mkBar(x, y, w, h, measure, groupBy, title) {
  return { id: uid('bar'), type: 'bar', position: { x, y, w, h },
    data: { measures: [measure], groupBy, orderBy: 'desc', limit: 10 },
    config: { title: title || `${measure} by ${groupBy.column}` } }
}

function mkLine(x, y, w, h, measures, groupBy, title) {
  const ms = Array.isArray(measures) ? measures : [measures]
  return { id: uid('line'), type: 'line', position: { x, y, w, h },
    data: { measures: ms, groupBy, orderBy: 'asc' },
    config: { title: title || `Trend over ${groupBy.column}` } }
}

function mkArea(x, y, w, h, measures, groupBy, title) {
  const ms = Array.isArray(measures) ? measures : [measures]
  return { id: uid('area'), type: 'area', position: { x, y, w, h },
    data: { measures: ms, groupBy, orderBy: 'asc' },
    config: { title: title || 'Trend' } }
}

function mkDonut(x, y, w, h, measure, groupBy, title) {
  return { id: uid('donut'), type: 'donut', position: { x, y, w, h },
    data: { measures: [measure], groupBy, orderBy: 'desc', limit: 8 },
    config: { title: title || `${measure} Mix` } }
}

function mkTable(x, y, w, h, measures, groupBy, title) {
  return { id: uid('tbl'), type: 'table', position: { x, y, w, h },
    data: { measures, groupBy, orderBy: 'desc', limit: 15 },
    config: { title: title || 'Detail Table' } }
}

function mkScatter(x, y, w, h, m1, m2, groupBy, title) {
  return { id: uid('sct'), type: 'scatter', position: { x, y, w, h },
    data: { measures: [m1, m2], groupBy, orderBy: 'desc', limit: 50 },
    config: { title: title || `${m1} vs ${m2}` } }
}

function mkGroupedBar(x, y, w, h, measures, groupBy, title) {
  return { id: uid('grp'), type: 'grouped_bar', position: { x, y, w, h },
    data: { measures, groupBy, orderBy: 'desc', limit: 10 },
    config: { title: title || 'Comparison' } }
}

function mkWaterfall(x, y, w, h, measure, groupBy, title) {
  return { id: uid('wf'), type: 'waterfall', position: { x, y, w, h },
    data: { measures: [measure], groupBy, orderBy: 'asc', limit: 12 },
    config: { title: title || `${measure} Breakdown` } }
}

function mkSlicer(x, y, w, dimension, label, type) {
  return { id: uid('slc'), type: type || 'dropdown', dimension, position: { x, y, w, h: 1 },
    config: { title: label || dimension.column } }
}

// ── Template generators ─────────────────────────────────────────────────────────

// S=1 means the first data row (y=1) after a slicer at y=0
const S = 1

function tplExecutive(measures, dimensions, colorScheme, mode) {
  const kpis = pickN(measures, ['Currency', 'Count', 'Average', 'Percent', 'Numeric'], 4)
  const catG = catBy(dimensions)
  const dateG = dateBy(dimensions)
  const primary = kpis[0] || 'Revenue'
  const spec = baseSpec('Executive Overview', colorScheme || 'violet', mode)
  spec.slicers = [mkSlicer(0, 0, 12, catG, catG.column)]
  spec.visuals = [
    mkKpi(0, S, 3, 2, kpis[0] || 'Revenue'),
    mkKpi(3, S, 3, 2, kpis[1] || 'Orders'),
    mkKpi(6, S, 3, 2, kpis[2] || 'Avg Value'),
    mkKpi(9, S, 3, 2, kpis[3] || 'Margin'),
    mkBar(0, S+2, 6, 5, primary, catG, `Top ${catG.column} by ${primary}`),
    mkLine(6, S+2, 6, 5, primary, dateG, `${primary} Trend`),
  ]
  return spec
}

function tplSales(measures, dimensions, colorScheme, mode) {
  const kpis = pickN(measures, ['Currency', 'Count', 'Percent', 'Average', 'Numeric'], 4)
  const catG = catBy(dimensions)
  const primary = kpis[0] || 'Revenue'
  const spec = baseSpec('Sales Performance', colorScheme || 'teal', mode)
  spec.slicers = [mkSlicer(0, 0, 12, catG, catG.column)]
  spec.visuals = [
    mkKpi(0, S, 3, 2, kpis[0] || 'Revenue'),
    mkKpi(3, S, 3, 2, kpis[1] || 'Orders'),
    mkKpi(6, S, 3, 2, kpis[2] || 'AOV'),
    mkKpi(9, S, 3, 2, kpis[3] || 'Margin'),
    mkBar(0, S+2, 7, 5, primary, catG, `${primary} by ${catG.column}`),
    mkDonut(7, S+2, 5, 5, primary, catG, `${primary} Mix`),
  ]
  return spec
}

function tplOperations(measures, dimensions, colorScheme, mode) {
  const kpis = pickN(measures, ['Count', 'Numeric', 'Average', 'Currency', 'Percent'], 3)
  const allMeasures = pickN(measures, ['Count', 'Numeric', 'Average', 'Currency', 'Percent'], 5)
  const catG = catBy(dimensions)
  const primary = kpis[0] || 'Volume'
  const spec = baseSpec('Operations Dashboard', colorScheme || 'gold', mode)
  spec.slicers = [mkSlicer(0, 0, 12, catG, catG.column)]
  spec.visuals = [
    mkKpi(0, S, 4, 2, kpis[0] || 'Volume'),
    mkKpi(4, S, 4, 2, kpis[1] || 'Efficiency'),
    mkKpi(8, S, 4, 2, kpis[2] || 'Throughput'),
    mkBar(0, S+2, 7, 5, primary, catG, `${primary} by ${catG.column}`),
    mkTable(7, S+2, 5, 5, allMeasures.slice(0, 3), catG, 'Detail View'),
  ]
  return spec
}

function tplMarketing(measures, dimensions, colorScheme, mode) {
  const kpis = pickN(measures, ['Count', 'Numeric', 'Currency', 'Average', 'Percent'], 3)
  const catG = catBy(dimensions)
  const dateG = dateBy(dimensions)
  const primary = kpis[0] || 'Sessions'
  const spec = baseSpec('Marketing Dashboard', colorScheme || 'rose', mode)
  spec.slicers = [mkSlicer(0, 0, 12, catG, catG.column)]
  spec.visuals = [
    mkKpi(0, S, 4, 2, kpis[0] || 'Impressions'),
    mkKpi(4, S, 4, 2, kpis[1] || 'Clicks'),
    mkKpi(8, S, 4, 2, kpis[2] || 'Conversions'),
    mkDonut(0, S+2, 5, 5, primary, catG, `${primary} by ${catG.column}`),
    mkArea(5, S+2, 7, 5, primary, dateG, `${primary} Trend`),
  ]
  return spec
}

function tplFinancial(measures, dimensions, colorScheme, mode) {
  const kpis = pickN(measures, ['Currency', 'Numeric', 'Count', 'Average', 'Percent'], 3)
  const catG = catBy(dimensions)
  const dateG = dateBy(dimensions)
  const primary = kpis[0] || 'Revenue'
  const spec = baseSpec('Financial P&L', colorScheme || 'green', mode)
  spec.slicers = [mkSlicer(0, 0, 12, catG, catG.column)]
  spec.visuals = [
    mkKpi(0, S, 4, 2, kpis[0] || 'Revenue'),
    mkKpi(4, S, 4, 2, kpis[1] || 'Cost'),
    mkKpi(8, S, 4, 2, kpis[2] || 'Profit'),
    mkWaterfall(0, S+2, 7, 5, primary, catG, `${primary} Breakdown`),
    mkLine(7, S+2, 5, 5, primary, dateG, `${primary} Trend`),
  ]
  return spec
}

function tplComparison(measures, dimensions, colorScheme, mode) {
  const m2 = pickN(measures, ['Currency', 'Count', 'Numeric', 'Average', 'Percent'], 2)
  const catG = catBy(dimensions)
  const a = m2[0] || 'Measure A'
  const b = m2[1] || m2[0] || 'Measure B'
  const spec = baseSpec('Comparison Analysis', colorScheme || 'purple', mode)
  spec.slicers = [mkSlicer(0, 0, 12, catG, catG.column)]
  spec.visuals = [
    mkKpi(0, S, 6, 2, a),
    mkKpi(6, S, 6, 2, b),
    mkScatter(0, S+2, 6, 5, a, b, catG, `${a} vs ${b}`),
    mkGroupedBar(6, S+2, 6, 5, [a, b], catG, 'Side-by-Side'),
  ]
  return spec
}

function tplTrend(measures, dimensions, colorScheme, mode) {
  const kpis = pickN(measures, ['Currency', 'Count', 'Average', 'Percent', 'Numeric'], 4)
  const dateG = dateBy(dimensions)
  const primary = kpis[0] || 'Revenue'
  const spec = baseSpec('Trend Analysis', colorScheme || 'blue', mode)
  spec.slicers = [mkSlicer(0, 0, 12, dateG, dateG.column, 'date_range')]
  spec.visuals = [
    mkKpi(0, S, 3, 2, kpis[0] || 'Revenue'),
    mkKpi(3, S, 3, 2, kpis[1] || 'Orders'),
    mkKpi(6, S, 3, 2, kpis[2] || 'AOV'),
    mkKpi(9, S, 3, 2, kpis[3] || 'Margin'),
    mkArea(0, S+2, 12, 5, primary, dateG, `${primary} Over Time`),
  ]
  return spec
}

function tplScorecard(measures, dimensions, colorScheme, mode) {
  const all = pickN(measures, ['Currency', 'Count', 'Average', 'Percent', 'Numeric'], 12)
  const spec = baseSpec('KPI Scorecard', colorScheme || 'blue', mode)
  spec.slicers = []
  spec.visuals = []
  for (let i = 0; i < Math.min(all.length, 12); i++) {
    spec.visuals.push(mkKpi((i % 4) * 3, Math.floor(i / 4) * 2, 3, 2, all[i]))
  }
  return spec
}

// ── Fallback data for unconnected state ─────────────────────────────────────────
const FALLBACK_MEASURES = [
  { name: 'Total Revenue',   expression: 'SUM(Sales[Revenue])',              isHidden: false },
  { name: 'Total Orders',    expression: 'COUNTROWS(Sales)',                 isHidden: false },
  { name: 'Avg Order Value', expression: 'AVERAGE(Sales[Amount])',           isHidden: false },
  { name: 'Profit Margin %', expression: 'DIVIDE([Profit],[Revenue])',       isHidden: false },
  { name: 'Total Cost',      expression: 'SUM(Sales[Cost])',                 isHidden: false },
  { name: 'Customer Count',  expression: 'DISTINCTCOUNT(Sales[CustomerID])', isHidden: false },
  { name: 'YTD Revenue',     expression: 'TOTALYTD(SUM(Sales[Revenue]),Date[Date])', isHidden: false },
  { name: 'Revenue Growth %',expression: 'DIVIDE([Revenue]-[LY Revenue],[LY Revenue])', isHidden: false },
]

const FALLBACK_DIMENSIONS = [
  { name: 'Product', tableType: 'dimension',
    columns: [{ name: 'Category', dataType: 'string', isHidden: false, isKey: false, isCategory: true }] },
  { name: 'Date', tableType: 'dimension',
    columns: [{ name: 'Date', dataType: 'dateTime', isHidden: false, isDate: true }] },
]

// ── Template registry ─────────────────────────────────────────────────────────────
export const TEMPLATES = [
  {
    id: 'executive',
    label: 'Executive Overview',
    desc: '4 KPIs · bar chart · trend line',
    accent: '#6366F1',
    colorScheme: 'violet',
    preview: [
      { x: 0, y: 0, w: 3, h: 2, type: 'kpi' }, { x: 3, y: 0, w: 3, h: 2, type: 'kpi' },
      { x: 6, y: 0, w: 3, h: 2, type: 'kpi' }, { x: 9, y: 0, w: 3, h: 2, type: 'kpi' },
      { x: 0, y: 2, w: 6, h: 5, type: 'bar' }, { x: 6, y: 2, w: 6, h: 5, type: 'line' },
    ],
    generate: tplExecutive,
  },
  {
    id: 'sales',
    label: 'Sales Performance',
    desc: '4 KPIs · ranked bar · donut mix',
    accent: '#14B8A6',
    colorScheme: 'teal',
    preview: [
      { x: 0, y: 0, w: 3, h: 2, type: 'kpi' }, { x: 3, y: 0, w: 3, h: 2, type: 'kpi' },
      { x: 6, y: 0, w: 3, h: 2, type: 'kpi' }, { x: 9, y: 0, w: 3, h: 2, type: 'kpi' },
      { x: 0, y: 2, w: 7, h: 5, type: 'bar' }, { x: 7, y: 2, w: 5, h: 5, type: 'donut' },
    ],
    generate: tplSales,
  },
  {
    id: 'operations',
    label: 'Operations',
    desc: '3 KPIs · bar chart · detail table',
    accent: '#F59E0B',
    colorScheme: 'gold',
    preview: [
      { x: 0, y: 0, w: 4, h: 2, type: 'kpi' }, { x: 4, y: 0, w: 4, h: 2, type: 'kpi' },
      { x: 8, y: 0, w: 4, h: 2, type: 'kpi' },
      { x: 0, y: 2, w: 7, h: 5, type: 'bar' }, { x: 7, y: 2, w: 5, h: 5, type: 'table' },
    ],
    generate: tplOperations,
  },
  {
    id: 'marketing',
    label: 'Marketing',
    desc: '3 KPIs · donut · area trend',
    accent: '#EC4899',
    colorScheme: 'rose',
    preview: [
      { x: 0, y: 0, w: 4, h: 2, type: 'kpi' }, { x: 4, y: 0, w: 4, h: 2, type: 'kpi' },
      { x: 8, y: 0, w: 4, h: 2, type: 'kpi' },
      { x: 0, y: 2, w: 5, h: 5, type: 'donut' }, { x: 5, y: 2, w: 7, h: 5, type: 'area' },
    ],
    generate: tplMarketing,
  },
  {
    id: 'financial',
    label: 'Financial P&L',
    desc: '3 KPIs · waterfall · trend line',
    accent: '#22C55E',
    colorScheme: 'green',
    preview: [
      { x: 0, y: 0, w: 4, h: 2, type: 'kpi' }, { x: 4, y: 0, w: 4, h: 2, type: 'kpi' },
      { x: 8, y: 0, w: 4, h: 2, type: 'kpi' },
      { x: 0, y: 2, w: 7, h: 5, type: 'waterfall' }, { x: 7, y: 2, w: 5, h: 5, type: 'line' },
    ],
    generate: tplFinancial,
  },
  {
    id: 'comparison',
    label: 'Comparison',
    desc: '2 KPIs · scatter plot · grouped bar',
    accent: '#8B5CF6',
    colorScheme: 'purple',
    preview: [
      { x: 0, y: 0, w: 6, h: 2, type: 'kpi' }, { x: 6, y: 0, w: 6, h: 2, type: 'kpi' },
      { x: 0, y: 2, w: 6, h: 5, type: 'scatter' }, { x: 6, y: 2, w: 6, h: 5, type: 'grouped_bar' },
    ],
    generate: tplComparison,
  },
  {
    id: 'trend',
    label: 'Trend Analysis',
    desc: '4 KPIs · full-width area chart',
    accent: '#3B82F6',
    colorScheme: 'blue',
    preview: [
      { x: 0, y: 0, w: 3, h: 2, type: 'kpi' }, { x: 3, y: 0, w: 3, h: 2, type: 'kpi' },
      { x: 6, y: 0, w: 3, h: 2, type: 'kpi' }, { x: 9, y: 0, w: 3, h: 2, type: 'kpi' },
      { x: 0, y: 2, w: 12, h: 5, type: 'area' },
    ],
    generate: tplTrend,
  },
  {
    id: 'scorecard',
    label: 'KPI Scorecard',
    desc: 'Up to 12 KPIs in a 4×3 grid',
    accent: '#F43F5E',
    colorScheme: 'rose',
    preview: [
      { x: 0, y: 0, w: 3, h: 2, type: 'kpi' }, { x: 3, y: 0, w: 3, h: 2, type: 'kpi' },
      { x: 6, y: 0, w: 3, h: 2, type: 'kpi' }, { x: 9, y: 0, w: 3, h: 2, type: 'kpi' },
      { x: 0, y: 2, w: 3, h: 2, type: 'kpi' }, { x: 3, y: 2, w: 3, h: 2, type: 'kpi' },
      { x: 6, y: 2, w: 3, h: 2, type: 'kpi' }, { x: 9, y: 2, w: 3, h: 2, type: 'kpi' },
      { x: 0, y: 4, w: 3, h: 2, type: 'kpi' }, { x: 3, y: 4, w: 3, h: 2, type: 'kpi' },
      { x: 6, y: 4, w: 3, h: 2, type: 'kpi' }, { x: 9, y: 4, w: 3, h: 2, type: 'kpi' },
    ],
    generate: tplScorecard,
  },
]

// ── Public API ────────────────────────────────────────────────────────────────────
export function generateFromTemplate(templateId, measures, dimensions, { colorScheme, mode } = {}) {
  const tpl = TEMPLATES.find(t => t.id === templateId)
  if (!tpl) throw new Error(`Unknown template: ${templateId}`)
  const useMeasures   = measures   && measures.length   > 0 ? measures   : FALLBACK_MEASURES
  const useDimensions = dimensions && dimensions.length > 0 ? dimensions : FALLBACK_DIMENSIONS
  return tpl.generate(useMeasures, useDimensions, colorScheme || tpl.colorScheme, mode || 'dark')
}

// Returns short list of measure names that will be used by a template (for preview)
export function previewUsage(templateId, measures) {
  const tpl = TEMPLATES.find(t => t.id === templateId)
  if (!tpl) return []
  const useMeasures = measures && measures.length > 0 ? measures : FALLBACK_MEASURES
  // Pick 3 representative measures using same logic as the template
  return pickN(useMeasures, ['Currency', 'Count', 'Average', 'Percent', 'Numeric'], 3)
}
