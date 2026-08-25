const axios  = require('axios')
const fs     = require('fs')
const path   = require('path')
const { ipcMain, safeStorage, app } = require('electron/main')

// Store AI keys in a small encrypted JSON file alongside the workspace config
function getKeysFilePath() {
  return path.join(app.getPath('userData'), 'semantica-ai-keys.json')
}

function readKeys() {
  try {
    const raw = fs.readFileSync(getKeysFilePath(), 'utf8')
    const obj = JSON.parse(raw)
    const result = {}
    for (const [k, v] of Object.entries(obj)) {
      try {
        result[k] = safeStorage.isEncryptionAvailable()
          ? safeStorage.decryptString(Buffer.from(v, 'base64'))
          : v
      } catch { result[k] = null }
    }
    return result
  } catch { return {} }
}

function writeKeys(keys) {
  const obj = {}
  for (const [k, v] of Object.entries(keys)) {
    if (v == null) continue
    obj[k] = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(v).toString('base64')
      : v
  }
  fs.writeFileSync(getKeysFilePath(), JSON.stringify(obj), 'utf8')
}

function saveKey(account, value) {
  const keys = readKeys()
  keys[account] = value
  writeKeys(keys)
}

function getKey(account) {
  return readKeys()[account] || null
}

function deleteKey(account) {
  const keys = readKeys()
  delete keys[account]
  writeKeys(keys)
}

// ── Model lists ───────────────────────────────────────────────────────────────

const ANTHROPIC_MODELS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5',  description: 'Fastest · ~$0.0001 per visual' },
  { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6', description: 'Recommended · ~$0.003 per visual' },
  { id: 'claude-opus-4-7',           label: 'Claude Opus 4.7',   description: 'Best quality · ~$0.015 per visual' },
]

const OPENAI_MODELS = [
  { id: 'gpt-4o-mini',   label: 'GPT-4o Mini',   description: 'Fastest · cheapest' },
  { id: 'gpt-4o',        label: 'GPT-4o',         description: 'Recommended · best balance' },
  { id: 'gpt-4-turbo',   label: 'GPT-4 Turbo',    description: 'Most capable' },
]

const GROQ_MODELS = [
  { id: 'moonshotai/kimi-k2-instruct',                label: 'Kimi K2',           description: 'Most capable · reasoning' },
  { id: 'meta-llama/llama-4-scout-17b-16e-instruct',  label: 'Llama 4 Scout',     description: 'Fast · vision capable' },
  { id: 'llama-3.3-70b-versatile',                    label: 'Llama 3.3 70B',     description: 'Versatile · strong · recommended' },
  { id: 'qwen/qwen3-32b',                             label: 'Qwen 3 32B',         description: 'Multilingual · reasoning' },
]

const GEMINI_MODELS = [
  { id: 'gemini-2.0-flash-lite',    label: 'Gemini 2.0 Flash Lite', description: 'Fastest · cheapest · routing' },
  { id: 'gemini-2.5-flash-preview-05-20', label: 'Gemini 2.5 Flash', description: 'Balanced · stable · recommended' },
  { id: 'gemini-2.5-pro-preview-06-05',   label: 'Gemini 2.5 Pro',   description: 'Best value · 1M context' },
]

const LOCAL_MODELS = [
  { id: 'phi-4-mini-q4', label: 'Phi-4-mini (Q4_K_M)', description: 'Offline · No API key · 128K context' },
]

// ── Key validation ────────────────────────────────────────────────────────────

async function testApiKey(provider, apiKey) {
  try {
    if (provider === 'anthropic') {
      await axios.post(
        'https://api.anthropic.com/v1/messages',
        { model: 'claude-haiku-4-5-20251001', max_tokens: 10, messages: [{ role: 'user', content: 'hi' }] },
        { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, timeout: 10000 }
      )
      return { valid: true }
    }
    if (provider === 'openai') {
      await axios.get('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }, timeout: 10000,
      })
      return { valid: true }
    }
    if (provider === 'groq') {
      await axios.get('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }, timeout: 10000,
      })
      return { valid: true }
    }
    if (provider === 'gemini') {
      const res = await axios.get(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
        { timeout: 10000 }
      )
      const models = (res.data.models || [])
        .filter(m => m.name.includes('gemini') && m.supportedGenerationMethods?.includes('generateContent') && !m.name.includes('embedding') && !m.name.includes('aqa') && !m.name.includes('imagen') && !m.name.includes('veo') && !m.name.includes('lyria'))
        .map(m => ({ id: m.name.replace('models/', ''), label: m.displayName || m.name.replace('models/', ''), description: m.description || '' }))
        .slice(0, 8)
      return { valid: true, models }
    }
    return { valid: false, error: 'Unknown provider' }
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message
    return { valid: false, error: msg }
  }
}

async function fetchGeminiModels(apiKey) {
  try {
    const res = await axios.get(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { timeout: 10000 }
    )
    const models = (res.data.models || [])
      .filter(m => m.name.includes('gemini') && m.supportedGenerationMethods?.includes('generateContent') && !m.name.includes('embedding') && !m.name.includes('aqa') && !m.name.includes('imagen') && !m.name.includes('veo') && !m.name.includes('lyria'))
      .map(m => ({ id: m.name.replace('models/', ''), label: m.displayName || m.name.replace('models/', ''), description: m.description || '' }))
      .slice(0, 8)
    return models.length ? models : GEMINI_MODELS
  } catch { return GEMINI_MODELS }
}

// Fetch Groq's live model catalog (OpenAI-compatible /models). Groq rotates
// models often, so a hardcoded list goes stale and 404s at generation time.
// Filters out non-chat models (audio/moderation/tts/embeddings); falls back to
// the static GROQ_MODELS on any error or empty result.
async function fetchGroqModels(apiKey) {
  try {
    const res = await axios.get('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` }, timeout: 10000,
    })
    // Drop non-chat models (audio/moderation/tts/embeddings) AND models whose
    // context window is too small to hold this app's generation prompt — that's
    // why allam-2-7b (4K ctx) 400'd. Rank proven generation models first so the
    // dropdown's default (index 0) is always something capable of full-page gen.
    const EXCLUDE = /whisper|distil|tts|guard|embed|playai/i
    const PREFER = [/llama-3\.3-70b/i, /kimi-k2/i, /llama-4/i, /gpt-oss/i, /qwen3/i]
    const rank = id => { const i = PREFER.findIndex(re => re.test(id)); return i === -1 ? PREFER.length : i }
    const models = (res.data?.data || [])
      .filter(m => m && m.id && m.active !== false && !EXCLUDE.test(m.id) && (m.context_window || 0) >= 16384)
      .sort((a, b) =>
        rank(a.id) - rank(b.id) ||
        (b.context_window || 0) - (a.context_window || 0) ||
        a.id.localeCompare(b.id))
      .map(m => ({
        id: m.id,
        label: m.id,
        description: [m.owned_by, m.context_window ? `${Math.round(m.context_window / 1000)}K ctx` : null]
          .filter(Boolean).join(' · '),
      }))
      .slice(0, 15)
    return models.length ? models : GROQ_MODELS
  } catch { return GROQ_MODELS }
}

// ── Model summary helpers ─────────────────────────────────────────────────────

function shortType(dataType) {
  const map = {
    int64: 'Int', int32: 'Int', int16: 'Int', int8: 'Int',
    double: 'Dec', decimal: 'Dec', single: 'Dec',
    string: 'Str', boolean: 'Bool',
    datetime: 'Date', date: 'Date',
    unknown: '?',
  }
  return map[(dataType || '').toLowerCase()] || '?'
}

function inferMeasureTypeLocal(name, expression) {
  const n = (name || '').toLowerCase()
  const e = (expression || '').toLowerCase()
  if (n.includes('%') || n.includes('rate') || n.includes('ratio') || n.includes('pct') || n.includes('margin')) return 'Percent'
  if (n.includes('revenue') || n.includes('sales') || n.includes('cost') || n.includes('price') || n.includes('amount')) return 'Currency'
  if (e.includes('countrows') || e.includes('distinctcount') || n.includes('count') || n.includes('total')) return 'Count'
  if (e.includes('average') || n.includes('avg') || n.includes('average')) return 'Average'
  return 'Numeric'
}

/**
 * Build a compact, token-efficient model summary for Stage 1 routing.
 * When selectedMeasures/selectedTables are provided, scopes to those only.
 */
function buildModelSummary(modelContext, selectedMeasures, selectedTables) {
  if (!modelContext) return ''
  const { measures, tables, relationships } = modelContext

  const relMeasures = selectedMeasures
    ? measures.filter(m => selectedMeasures.includes(m.name))
    : measures.filter(m => !m.isHidden).slice(0, 20)

  const relTables = selectedTables
    ? tables.filter(t => selectedTables.includes(t.name))
    : tables.filter(t => t.name)

  const tableLines = relTables.map(t => {
    const visCols = (t.columns || [])
      .filter(c => !c.isHidden)
      .map(c => `${c.name}(${shortType(c.dataType)})`)
      .join(', ')
    return `T: ${t.name} | C: ${visCols}`
  }).join('\n')

  const relLines = (relationships || [])
    .filter(r => relTables.some(t => t.name === r.fromTable) || relTables.some(t => t.name === r.toTable))
    .map(r => {
      const dir    = (r.crossFilter || '').includes('both') ? 'Both' : 'Single'
      const active = r.isActive ? '' : ' [INACTIVE]'
      return `${r.fromTable}[${r.fromColumn}] -> ${r.toTable}[${r.toColumn}] (1:M, ${dir})${active}`
    }).join('\n')

  const measureLines = relMeasures.map(m => {
    const type = inferMeasureTypeLocal(m.name, m.expression)
    const e    = (m.expression || '').toLowerCase()
    const agg  = e.includes('divide') ? 'Ratio' : (e.includes('totalytd') || e.includes('dateadd') || e.includes('sameperiod')) ? 'TimeIntel' : 'Additive'
    const fmtPart = m.formatString ? ` | Fmt: ${m.formatString}` : ''
    const isComplex = agg !== 'Additive' || (m.expression || '').length > 50
    const daxPart = isComplex && m.expression ? ` | DAX: ${m.expression.substring(0, 80)}` : ''
    return `M: ${m.name} | Type: ${type} | Agg: ${agg}${fmtPart}${daxPart}`
  }).join('\n')

  return [tableLines, relLines, measureLines].filter(Boolean).join('\n\n')
}

// ── App Generator system prompt ───────────────────────────────────────────────

const APP_GEN_SYSTEM_PROMPT = `You are Semantica App Generator.
Generate a complete analytics dashboard as an App Spec JSON.

<output_rules>
Return ONLY valid JSON. No markdown fences. No explanation.
The JSON must match the schema below exactly.
</output_rules>

<schema>
{
  "version": "1.0",
  "title": "string",
  "theme": { "mode": "dark", "primaryColor": "#14B8A6", "fontFamily": "Inter" },
  "layout": { "columns": 12, "rowHeight": 80, "gap": 8 },
  "visuals": [
    {
      "id": "visual_1",
      "type": "kpi|bar|stacked_bar|grouped_bar|column|line|area|stacked_area|donut|pie|gauge|radar|scatter|bubble|treemap|funnel|sankey|table|waterfall|lollipop|bullet|progress|heatmap|ranked_list|stat_card|metric_tile|sparkline_kpi|slope|bump|chord|sunburst|narrative|waffle|bar_race|nav_button|text_box|shape|image|divider",
      "position": { "x": 0, "y": 0, "w": 3, "h": 3 },
      "data": {
        "measures": ["exact measure name from model", "optional second measure for stacked_bar"],
        "groupBy": { "table": "TableName", "column": "ColumnName" },
        "filters": [],
        "orderBy": "desc",
        "limit": 10
      },
      "config": {
        "title": "Visual Title",
        "subtitle": null,
        "colorScheme": "teal|blue|gold|green|purple|violet|rose|red|orange",
        "prefix": null,
        "suffix": null,
        "dataLabels": false,
        "gridLines": false,
        "titleFontFamily": null,
        "titleFontSize": null,
        "titleColor": null,
        "valueFontFamily": null,
        "valueFontSize": null,
        "orientation": null,
        "barRadius": null,
        "gradient": null,
        "showAvgLine": null,
        "targetLine": null,
        "conditionalColor": null,
        "strokeWidth": null,
        "fillOpacity": null,
        "showDots": null,
        "smooth": null,
        "innerRadius": null,
        "legendPosition": null,
        "showLabels": null,
        "showTrend": null,
        "showPercentage": null,
        "showConversion": null,
        "animationPreset": null,
        "animationDuration": null
      }
    }
  ],
  "slicers": [
    {
      "id": "slicer_1",
      "type": "dropdown|buttons|date_range",
      "dimension": { "table": "TableName", "column": "ColumnName" },
      "label": "Filter Label",
      "position": { "x": 0, "y": 0, "w": 4, "h": 1 },
      "affects": "all",
      "defaultValue": null
    }
  ],
  "connections": [],
  "warnings": []
}
</schema>

<visual_type_guide>
VISUAL TYPES:
KPI/Metric (single value, no groupBy needed):
  kpi: Value card with title below. Use for key metrics.
  stat_card: Left-aligned value with trend arrow (▲/▼ %). Use for metrics with comparison.
  metric_tile: Value with mini ring gauge beside it. Use when showing % of target.
  sparkline_kpi: Value with inline sparkline trend. Needs multiple rows of time data.
  gauge: Arc gauge with configurable min/max. Use for rates, scores, percentages, or any scalar KPI with a known target max.
  bullet: Value vs target with range bands. Use for goal tracking.
  progress: Horizontal progress bar with %. Use for completion metrics.

Charts (REQUIRE groupBy with table+column):
  bar: Horizontal bars ranked by value. Most common chart.
  column: Vertical bars. Use when categories are short labels.
  grouped_bar: Side-by-side vertical bars for 2 measures. Needs 2 measures.
  stacked_bar: Stacked horizontal bars for 2 measures. Needs 2 measures.
  lollipop: Dot-on-line horizontal chart. Clean alternative to bar.
  waterfall: Increase/decrease/total bars. Use for revenue breakdown, P&L.
  line: Line/trend chart. Use with date/time groupBy.
  area: Filled area chart. Use for volume/cumulative trends.
  stacked_area: Two stacked filled areas. Needs 2 measures + date groupBy.

Distribution (REQUIRE groupBy):
  donut: Ring chart with legend. Single value = progress ring.
  pie: Solid pie chart (no hole). Use for part-of-whole.
  sunburst: Thick multi-ring donut. Use for hierarchical breakdown.
  treemap: Proportional rectangles. Use for size comparison.
  waffle: 10x10 grid of cells. Single value = filled %. Multiple = colored segments.
  heatmap: Grid of intensity-colored cells. Use for matrix data.

Relationship (REQUIRE groupBy):
  scatter: X/Y dot plot. REQUIRES groupBy (a category like product/region/month) + 2 measures. Without groupBy you get ONE dot — useless. Example: "revenue vs profit by product" → groupBy=Product, measures=[Revenue, Profit].
  bubble: Scatter with variable dot size. REQUIRES groupBy + 2-3 measures. Same rule as scatter.
  radar: Spider/polygon chart. Use for multi-category comparison.
  chord: Circular arc diagram. Use for flow/relationship data.

Ranking/Comparison:
  ranked_list: Numbered list with inline bars. Clean alternative to bar for top-N.
  slope: Two-period comparison with lines. Needs 2 measures (start, end).
  bump: Rank change over time. GroupBy = time periods, value = rank.
  bar_race: Animated bar-chart RACE with a Play/scrub timeline. Bars re-rank frame-by-frame over a TIME dimension. REQUIRES data.groupBy = the racing category (e.g. Product Category) + one measure + config.playAxis = a time column string "Table[Column]" (e.g. "Date[Year-Quarter]"). Use for "over time", "race", "how rankings changed", animated storytelling.
  funnel: Stage drop-off bars. Use for conversion funnels.

Text/Insight:
  narrative: AI-generated text insight box. Auto-generates from data. Good for executive summaries.
  table: Data table with ranked rows. Supports multiple dimension columns and multiple measures. See TABLE RULES.
</visual_type_guide>

<navigation_and_objects>
MULTI-PAGE APPS: for multi-section dashboards return "pages": [ { "id": "page_1", "name": "Overview", "visuals": [...], "slicers": [...] }, ... ] INSTEAD of top-level visuals/slicers. Each page has its own visuals/slicers with grid positions restarting at y:0. Name pages clearly — the names show in the navigation. Add "nav": { "position": "sidebar" } (or "topbar" | "none") at the spec ROOT to control the nav shell (sidebar is a good default). Mark a page "hidden": true when it is used ONLY as a popup (it stays out of the nav but a button can still open it).

NAV BUTTONS — type "nav_button" (no data/measures). config:
  { "label": "View details →", "navTarget": "page|modal|url|filter", "variant": "primary|secondary|outline|ghost", "size": "sm|md|lg", "color": "#3B82F6", "icon": "→", "fullWidth": false }
  - navTarget "page": add "targetPageId" (another page's id) → navigates there.
  - navTarget "modal": add "modalPageId" (usually a hidden page's id) → opens it as an in-app popup.
  - navTarget "url": add "url".
  - navTarget "filter": a quick-filter / reset button. Add "filterMode": "toggle|set|clear"; for toggle/set also "filterColumn": "Table[Column]" and "filterValue"; "clear" resets all filters (a "Reset" button).
  Default size w:2 h:1.

CANVAS OBJECTS — decoration with NO data block (no measures/groupBy):
  text_box: { "text": "Section heading", "fontSize": 22, "fontWeight": 700, "align": "left", "color": "#F1F5F9" }. Great for section headers/labels. Heading size w:6 h:1.
  shape: { "shape": "rectangle|rounded|ellipse|triangle|diamond|star|arrow|line", "fillColor": "rgba(94,234,212,0.14)", "borderColor": null, "borderWidth": 0 }. Decorative background/accent. w:3 h:2.
  image: { "imageUrl": "https://…", "fit": "contain" }. w:3 h:3.
  divider: { "orientation": "horizontal|vertical", "thickness": 2, "color": null }. w:12 h:1.
</navigation_and_objects>

<strict_size_rules>
DEFAULT SIZES (compact, professional):
  KPI cards:   w:3  h:2  (landscape cards, never portrait)
  stat_card:   w:3  h:2  metric_tile: w:3 h:2  sparkline_kpi: w:3 h:2
  Bar charts:  w:12 h:5  (or w:8 h:5 if paired)
  Column:      w:12 h:5  grouped_bar: w:12 h:5
  Stacked bar: w:12 h:5  (requires 2 measures)
  Lollipop:    w:12 h:5  (same as bar)
  Waterfall:   w:12 h:5
  Line charts: w:12 h:4  area: w:12 h:4  stacked_area: w:12 h:4
  Slicers:     w:4  h:1  (always h:1, never more)
  Donut (primary, standalone): w:6  h:4
  Donut (secondary / small):   w:4  h:3
  Pie:         w:5  h:3  sunburst: w:6 h:4  waffle: w:4 h:3
  Gauge:       w:3  h:3  bullet: w:4 h:2  progress: w:4 h:2
  Radar:       w:6  h:4  chord: w:6 h:4
  Scatter:     w:8  h:4  bubble: w:8 h:4
  Treemap:     w:8  h:4  heatmap: w:6 h:4
  Funnel:      w:6  h:4  ranked_list: w:5 h:4
  Slope:       w:6  h:4  bump: w:8 h:4
  Bar race:    w:12 h:5  (needs room for the play bar + bars)
  Table:       w:12 h:5  (or w:6 h:4 when paired beside a chart)
  Narrative:   w:12 h:3  (text block, full width)

TABLE RULES:
  Table visuals display ranked/detail rows — use when user asks for "table", "leaderboard", "top N list", "detail rows", or when many categories are better shown as rows than a chart.
  Table uses data.dimensions[] (array of {table, column} objects) instead of groupBy. Supports 1-5 dimension columns and any number of measures.
  Default: w:12 h:5 with limit:100 and orderBy:"desc".
  Table example with 2 dimensions and 2 measures:
    {
      "id": "visual_1", "type": "table",
      "position": { "x": 0, "y": 0, "w": 12, "h": 5 },
      "data": {
        "dimensions": [
          { "table": "DimProduct", "column": "Category" },
          { "table": "DimDate", "column": "Year" }
        ],
        "measures": ["Total Revenue", "Units Sold"],
        "orderBy": "desc", "limit": 100
      },
      "config": { "title": "Revenue and Units by Category and Year" }
    }
  For a simple single-dimension table, dimensions[] still contains one entry (NOT groupBy).

DONUT PAIRING RULE:
  If user asks for "bar chart and donut", "donut beside bar", "small donut", or similar:
    → bar: x:0 w:8 h:5
    → donut: x:8 w:4 h:3  (same y row as bar — they share a row)
  If donut is the ONLY or PRIMARY visual and user did not say "small":
    → donut: x:0 w:6 h:4 (centered or left-aligned)

rowHeight is 80. This means:
  h:2 KPI  = 168px  (compact landscape)
  h:5 bar  = 432px  (good for 6-10 bars)
  h:1 slicer = 80px (compact filter row)

NEVER exceed these heights.
NEVER use h:3 for KPI cards.
NEVER use h:2 or higher for slicers.
x + w must NEVER exceed 12.
KPI cards do NOT need groupBy — set it to null.
</strict_size_rules>

<layout_templates>
Pick ONE template that best fits the request. You may combine elements.

TEMPLATE A — KPIs only (1-4 metrics):
  No slicers unless asked
  All KPIs in one row, each w = 12/count, h:2
  Example 4 KPIs: w:3 each, x: 0,3,6,9, y:0 h:2

TEMPLATE B — KPIs + one chart:
  Row 0: slicers (if requested) h:1
  Row 1: KPIs h:2
  Row 2: full-width chart h:5 (or h:4 for line)
  Example:
    slicer: x:0 y:0 w:4 h:1
    kpi_1:  x:0 y:1 w:3 h:2
    kpi_2:  x:3 y:1 w:3 h:2
    kpi_3:  x:6 y:1 w:3 h:2
    kpi_4:  x:9 y:1 w:3 h:2
    bar:    x:0 y:3 w:12 h:5

TEMPLATE C — KPIs + two side-by-side charts (equal split):
  Row 0: slicers (if requested) h:1
  Row 1: KPIs h:2
  Row 2: left chart x:0 w:6 h:5, right chart x:6 w:6 h:5
  CRITICAL: both charts MUST share the SAME y value to render side by side.

TEMPLATE D — Chart only:
  visual_1: x:0 y:0 w:12 h:5

TEMPLATE E — Slicer + chart:
  slicer_1: x:0 y:0 w:4 h:1
  visual_1: x:0 y:1 w:12 h:5

TEMPLATE F — Bar + small donut (same row, 8/4 split):
  bar:   x:0 y:0 w:8 h:5
  donut: x:8 y:0 w:4 h:3
  CRITICAL: both MUST share the SAME y value.

TEMPLATE G — KPIs + side-by-side charts + full-width bottom:
  Row 0: KPIs h:2
  Row 1: left chart x:0 w:6 h:5, right chart x:6 w:6 h:5 (SAME y!)
  Row 2: full-width line/table x:0 w:12 h:5
  Example:
    kpi_1: x:0 y:0 w:3 h:2 ... kpi_4: x:9 y:0 w:3 h:2
    bar:   x:0 y:2 w:6 h:5
    donut: x:6 y:2 w:6 h:4
    line:  x:0 y:7 w:12 h:4

TEMPLATE H — KPIs + 8/4 chart/table row:
  Row 0: KPIs h:2
  Row 1: bar x:0 w:8 h:5, table x:8 w:4 h:5 (SAME y!)
  Example:
    kpi_1: x:0 y:0 w:4 h:2 ... kpi_3: x:8 y:0 w:4 h:2
    bar:   x:0 y:2 w:8 h:5
    table: x:8 y:2 w:4 h:5

TEMPLATE I — KPIs + 7/5 chart pair:
  Row 0: KPIs h:2
  Row 1: primary chart x:0 w:7 h:5, secondary chart x:7 w:5 h:5 (SAME y!)

SIDE-BY-SIDE RULES (critical for correct rendering):
  To place two visuals side by side they MUST:
    1. Share the EXACT SAME y value
    2. Have x values that don't overlap: left at x:0, right at x:(left.w)
    3. Have widths that sum to ≤ 12: e.g. 6+6, 8+4, 7+5
  If the user says "side by side", "beside", "left and right", "next to each other",
  or "bar and donut", "chart and table" etc., you MUST use the same y for both.
  Common width splits:
    Equal:          6/6  (two similar charts)
    Primary/accent: 8/4  (bar + small donut, chart + compact table)
    Weighted:       7/5  (one slightly larger)

ABSOLUTE RULES:
  KPI h = 2 always
  Slicer h = 1 always
  Chart h max = 5
  x + w must not exceed 12
  Only add slicers if user explicitly asked for filter
  Never add date_range slicers
</layout_templates>

<data_rules>
1. Use measure names EXACTLY as listed in the schema provided.
2. Use table/column names EXACTLY as listed.
3. NEVER invent measures or columns.
4. KPI/gauge: set measures array, set groupBy to null.
5. Bar/line/area/stacked_bar/table: must have groupBy with valid table+column (string/category type, NOT numeric).
6. Slicer dimension MUST be { "table": "...", "column": "..." } — NEVER a plain string.
7. Set affects to "all" on every slicer unless the user explicitly asks for a targeted slicer.
8. Only add slicers when the user explicitly asks for a filter or slicer.
9. Slicer dimensions must be low-cardinality text/category columns from lookup or dimension tables.
10. NEVER use these as slicer dimensions:
    - measure names (measures are not columns)
    - columns ending in "Key" (surrogate keys: ProductKey, DateKey, CustomerKey)
    - columns ending in "Id" (foreign keys: OrderId, CustomerId)
    - numeric quantity/amount columns
    - date columns (use date_range type only if user explicitly asks)
11. If measure is marked [RATIO:0-1->%], it returns decimal (0.47 = 47%) — label with % in title.
12. Bar chart data.orderBy should be "desc" by default.
13. Bar chart data.limit should be 10 by default. IMPORTANT: when user says "top N", "top 5", "top 15", "best 20", "leading 3" etc., set data.limit = N and keep orderBy "desc". When user says "bottom N" or "worst N", set orderBy "asc" with data.limit = N. When user says "all" or doesn't specify, use default 10 for bar/column/lollipop; for line/area use grain-based default (see rule 17).
13a. Bar chart example with top N:
    {
      "id": "visual_1", "type": "bar",
      "position": { "x": 0, "y": 2, "w": 12, "h": 5 },
      "data": { "measures": ["Revenue"], "groupBy": { "table": "Product", "column": "Category" }, "orderBy": "desc", "limit": 10 },
      "config": { "title": "Top 10 Categories by Revenue" }
    }
14. Table data.limit should be 10 by default, data.orderBy "desc".
18. stacked_bar RULES:
    - Use ONLY when user asks for "stacked bar", "stacked comparison", "composition by category"
    - CRITICAL: data.measures MUST be an array with EXACTLY 2 elements: ["Measure1", "Measure2"]
    - If the user names two specific measures, include BOTH — do NOT drop one
    - If only one valid measure exists, use type "bar" instead — NEVER emit stacked_bar with 1 measure
    - Default: w:12 h:5, limit:10, orderBy:"desc"
    stacked_bar example (ALWAYS follow this exact structure):
    {
      "id": "visual_1", "type": "stacked_bar",
      "position": { "x": 0, "y": 0, "w": 12, "h": 5 },
      "data": { "measures": ["MeasureName1", "MeasureName2"], "groupBy": { "table": "T", "column": "C" }, "orderBy": "desc", "limit": 10 },
      "config": { "title": "MeasureName1 vs MeasureName2 by C" }
    }
18a. grouped_bar RULES (sibling of stacked_bar):
    - Use when user asks for "grouped bar", "compare X and Y by category", "X and Y side by side", "side-by-side bars", "comparison chart" — anywhere the user names TWO measures over a single category and wants them visually compared (not stacked / not added together)
    - When the user names two measures and DOESN'T explicitly say "stacked", PREFER grouped_bar over plain bar — plain bar drops the 2nd measure entirely, grouped_bar shows both side by side
    - CRITICAL: data.measures MUST be an array with EXACTLY 2 elements: ["Measure1", "Measure2"]
    - If only one valid measure exists, use type "bar" instead — NEVER emit grouped_bar with 1 measure
    - Default: w:12 h:5, limit:10, orderBy:"desc"
    grouped_bar example:
    {
      "id": "visual_1", "type": "grouped_bar",
      "position": { "x": 0, "y": 0, "w": 12, "h": 5 },
      "data": { "measures": ["MeasureName1", "MeasureName2"], "groupBy": { "table": "T", "column": "C" }, "orderBy": "desc", "limit": 10 },
      "config": { "title": "MeasureName1 vs MeasureName2 by C" }
    }
17. Line/area chart data.limit and orderBy — line/area is a time series, NOT a top-N ranking. ALWAYS sort ascending by the time axis so dates render in chronological order, and use a generous limit so the full series is visible (PBI-like behaviour):
    - data.orderBy MUST be "asc" for line/area (NEVER "desc" — that cherry-picks high-value points and breaks the time-series narrative)
    - data.limit defaults:
      - "by date" / "by day":   2000 (≈5+ years of daily data, effectively unlimited for most ranges)
      - "by month":              500 (≈40 years of monthly)
      - "by quarter":            200 (≈50 years of quarterly)
      - "by year":               100 (a century)
      - categorical (non-time) line: 50
    - Only override the limit if the user explicitly says "last N months", "last 30 days", etc. — then set limit=N and orderBy="desc" (most recent N reversed back to asc by the renderer).
15. Table supports multiple dimensions and measures. Use data.dimensions[] (array of {table, column}) — NOT groupBy. Use table when user says "table", "leaderboard", "top N", "detail rows", "ranked list", or when 10+ categories are better shown as rows.
16. Slicer h is ALWAYS 1 — never more.
15. Do not emit date_range slicers unless the request explicitly asks for a date range.
19. Bar/column/lollipop config fields — set these when user asks:
    - showAvgLine: true — when user says "average line", "avg line", "average reference line", "mean line"
    - targetLine: N — when user says "target line at N", "goal line", "target of N" (N is the numeric value)
    - conditionalColor: { "threshold": N, "above": "#22C55E", "below": "#EF4444" } — when user says "color red if below", "green above target", "conditional coloring", "color by threshold"
    - gradient: true — when user says "gradient bars", "gradient fill"
    - highlightMax: true — when user says "highlight top bar", "highlight max", "highlight best"
    - rankOpacity: false — when user says "same opacity", "all same color", "no fading"
    - dataLabels: true — when user says "show values", "show labels", "data labels"
</data_rules>

<slicer_rules>
GOOD slicer dimensions — low-cardinality text columns from dimension tables:
  { "table": "Product", "column": "Color" }
  { "table": "Product Categories", "column": "CategoryName" }
  { "table": "Region", "column": "RegionName" }
  { "table": "Customer", "column": "CustomerSegment" }

BAD slicer dimensions — never use these:
  { "table": "Sales", "column": "ProductKey" }   ← surrogate key
  { "table": "Sales", "column": "OrderId" }       ← foreign key
  { "table": "Sales", "column": "Quantity" }      ← numeric measure column
  { "table": "Date", "column": "DateKey" }        ← numeric key
  "Product[Color]"                                ← must be object, not string

Example — user asks "add a dropdown filter by product color":
{
  "id": "slicer_1",
  "type": "dropdown",
  "label": "Product Color",
  "dimension": { "table": "Product", "column": "Color" },
  "position": { "x": 0, "y": 0, "w": 4, "h": 1 },
  "affects": "all",
  "defaultValue": null
}
</slicer_rules>

<time_axis_rules>
When the user asks for a time axis (year, month, quarter, date, week):
1. If the user writes an explicit Table[Column] reference (e.g. Date[Year]), use that EXACTLY.
2. Otherwise prefer a column from a date or calendar table that has active relationships to fact tables.
3. NEVER use a disconnected or generated date table (one with no active relationships) as groupBy.
4. For line/area charts: always pick a true time-grain column matching what the user asked:
   - "by year"    → column whose name contains "Year"
   - "by month"   → column whose name contains "Month"
   - "by quarter" → column whose name contains "Quarter"
   - "by date"    → column whose name contains "Date" or "Day"
5. Do NOT use a column from a measures table or calculated table as a time axis.
6. If the RELATIONSHIPS section shows the date table is not connected, pick a different one.
</time_axis_rules>

<axis_switch_rules>
config.axisOptions — optional array of alternative groupBy dimensions for a visual.
When present, the UI renders compact pill buttons in the card header so users can switch axes without refinement.

WHEN TO ADD axisOptions:
- When the user asks for "switch between X and Y", "toggle by", "drill between"
- When the model has a natural hierarchy (e.g. Region→Country, Category→Subcategory, Year→Month)
- When the visual's groupBy dimension table has multiple related categorical columns
- Do NOT add axisOptions to KPI or gauge visuals (they have no groupBy)

FORMAT:
"axisOptions": [
  { "label": "Short Label", "groupBy": { "table": "TableName", "column": "ColumnName" } },
  { "label": "Short Label 2", "groupBy": { "table": "TableName", "column": "ColumnName2" } }
]

RULES:
1. The first entry MUST match the visual's main data.groupBy exactly
2. Keep labels short (1-2 words): "Region", "Country", "Year", "Month"
3. Maximum 4 options per visual
4. All groupBy references must be valid table[column] from the model
5. If no natural alternatives exist, omit axisOptions entirely (set to null)
6. axisOptions columns should be category/text type, not numeric keys
</axis_switch_rules>

<color_guide>
colorScheme values: teal, blue, purple, gold, green, red, rose, orange
First visual: teal. Alternate for variety. Never repeat consecutively.
</color_guide>`

// ── Patch system prompt ───────────────────────────────────────────────────────
const PATCH_SYSTEM_PROMPT = `You are a JSON Patch generator for analytics dashboards.

Given a current App Spec JSON and a user change request, return ONLY a JSON object with a "patches" key containing an RFC 6902 patch array.

RULES:
1. Return ONLY { "patches": [...operations] } — no other keys, no explanation
2. Only patch what the user explicitly asked to change
3. Never remove visuals unless the user explicitly said to remove them
4. Never change measures/data unless the user asked to change data
5. Use operations: "replace", "add", "remove"
6. Paths use JSON Pointer format: /visuals/0/config/colorScheme

COMMON PATTERNS:
  "make bars gold"          → replace colorScheme on bar visuals
  "sort descending"         → replace data.orderBy to "desc" on bar/chart visuals
  "sort ascending"          → replace data.orderBy to "asc" on bar/chart visuals
  "show top 20"/"top 5"/"top 15" → replace data.limit to 20/5/15 on bar/column/lollipop/table visuals
  "bottom 10"/"worst 5"     → replace data.limit AND data.orderBy to "asc"
  "show all"                → replace data.limit to 100 (or higher)
  "remove limit"            → replace data.limit to 100
  "disable animation"       → replace config.animations to false on that visual
  "enable animation"        → replace config.animations to true
  "remove accent strip"/"hide side line" → replace config.showAccentStrip to false
  "show accent strip"/"add side line" → replace config.showAccentStrip to true
  "toggle grid lines"       → replace config.gridLines to !current
  "smart labels"/"auto labels"/"labels auto" → replace config.labelPosition to "auto" (wide bars get inside, narrow bars get outside right) + config.dataLabels: true
  "white data labels"/"black data labels"/"data labels red" → replace config.dataLabelColor to the hex (#FFFFFF / #000000 / #EF4444). "auto label color"/"reset label color" → config.dataLabelColor: "auto"
  "labels inside bars"/"labels on bars" → replace config.labelPosition to "inside" + ensure config.dataLabels: true
  "labels next to bars"/"labels at end" → replace config.labelPosition to "right" + config.dataLabels: true
  "labels above bars"/"labels on top" → replace config.labelPosition to "top" + config.dataLabels: true
  "hide labels"/"no labels"   → replace config.dataLabels to false (bar/column/line). For scatter: replace config.showLabels to false
  "show labels"              → replace config.dataLabels to true (bar/column/line). For scatter: replace config.showLabels to true
  "add point labels" / "label the dots" / "show dot labels" → replace /visuals/N/config/showLabels to true on scatter visuals
  "hide point labels" / "remove dot labels" → replace /visuals/N/config/showLabels to false on scatter visuals
  "make dots bigger" / "larger dots" / "increase dot size" → replace /visuals/N/config/dotSize to a larger value (e.g. 24) on scatter visuals
  "make dots smaller" / "smaller dots" / "decrease dot size" → replace /visuals/N/config/dotSize to a smaller value (e.g. 8) on scatter visuals
  "show y axis" / "add y axis"  → replace /visuals/N/config/showYAxis to true on scatter
  "hide y axis" / "remove y axis" → replace /visuals/N/config/showYAxis to false on scatter
  "show x axis" / "hide x axis" → replace /visuals/N/config/showXAxis accordingly on scatter
  "make cards smaller"      → replace position.h on kpi visuals (min 1)
  "change title to X" / "add title X" / "set title" / "rename to X" → replace /visuals/N/config/title where N is the visual's index from CURRENT VISUALS
  "add a year filter"       → add to /slicers array
  "make all charts blue"    → replace colorScheme on non-kpi visuals
  "change axis to X"        → replace data.groupBy with { "table": "...", "column": "..." }
  "show as table"           → replace /visuals/N/type to "table" (keep groupBy, measures, limit, orderBy)
  "show as bar chart"       → replace /visuals/N/type to "bar" (keep groupBy, measures, limit, orderBy)
  "add axis toggle"         → add /visuals/N/config/axisOptions with array of { label, groupBy } alternatives
  "let me switch between X and Y" → add axisOptions to the relevant visual
  "add average line"/"add avg line"/"average reference line"/"show average"/"mean line"/"add reference line" → replace /visuals/N/config/showAvgLine to true
  "remove average line"/"hide avg line"/"remove reference line" → replace /visuals/N/config/showAvgLine to false
  "add target line at N"/"goal line N"/"target N" → replace /visuals/N/config/targetLine to N (numeric)
  "color red below N"/"conditional color"/"color by threshold" → replace /visuals/N/config/conditionalColor to { "threshold": N, "above": "#22C55E", "below": "#EF4444" }
  "highlight max bar"/"highlight top" → replace /visuals/N/config/highlightMax to true
  "gradient bars" → replace /visuals/N/config/gradient to true

VISUAL CONFIG PROPERTIES (use /visuals/N/config/PROPERTY):
  Style: colorScheme, prefix, suffix, cardStyle (minimal|filled|glass|accent|bordered)
  Title: titlePosition (above|below), titleUppercase (true|false), titleFontFamily, titleFontSize, titleColor, titleFontWeight
  Value: valueFontFamily, valueFontSize, valueFontWeight, valueColor
  KPI: showTrend (true|false), showSparkline (true|false), showIcon (true|false), icon ("💰"), showGlow (true|false), showProgress (true|false), progressMax, align (left|center|right), compact (true|false)
  Bar: orientation (horizontal|vertical), barRadius, gradient (true|false), gradientTo, rankOpacity (true=fade lower bars), highlightMax (true=bold top bar), showAvgLine (true=shows average reference line), avgLineColor (hex color for avg line, default amber #F59E0B), avgLineStyle (solid|dashed|dotted), targetLine (number=dashed rose target line), conditionalColor ({threshold,above,below} colors), maxBarSize, showBarBackground, labelPosition (right|inside|top)
  Line: smooth (true|false), strokeWidth, showDots, dotSize, fillOpacity, showYAxis, showSecondary, chartType (line|area)
  Donut: innerRadius (0=pie, 52=donut), legendPosition (right|bottom), showLabels, labelStyle (percent|value|name), showCenterText, cornerRadius, customColors
  Gauge: minValue (default 0), maxValue (REQUIRED — set to the measure's expected max, e.g. 100 for %, 30000000 for revenue), arcWidth, gaugeSize, colorZones ([{from,to,color}]), targetValue, showMinMax
  Funnel: showConversion, showPercentage, barHeight, barRadius, gradient
  Treemap: colorMode (single|gradient|multi), showValues, borderRadius
  Scatter/Bubble: dotSize (px, default 16), dotSizeMax (max bubble area, default 100 — increase for bubble charts), fillOpacity (0–1), showGrid (true|false), showXAxis (true|false), showYAxis (true|false), showLabels (true|false — shows category name on each dot)
  Animation: animationPreset (none|fadeUp|fadeIn|scaleIn), animationDuration (fast|medium|slow), animationEnabled
  Grid: gridLines, gridStyle (solid|dashed|dotted), gridLinesColor
  Data labels: dataLabels (true|false)
  Size: position.w (1-12 columns), position.h (1-6 rows)

SLICER PATCH SHAPE — CRITICAL:
When adding a slicer, dimension MUST be an object { "table": "...", "column": "..." }.
NEVER use a string like "Product[Category]" for dimension.

Example — "add a dropdown filter by product category":
{ "patches": [
  { "op": "add", "path": "/slicers/-", "value": {
    "id": "slicer_new_1",
    "type": "dropdown",
    "label": "Product Category",
    "dimension": { "table": "Product", "column": "Category" },
    "position": { "x": 0, "y": 0, "w": 4, "h": 1 },
    "affects": "all",
    "defaultValue": null
  }}
] }

ADD-NEW-VISUAL TYPE SELECTION (when user says "add bar chart of X by Y", "add radar", "add line", etc.):
RULE 1 — ALWAYS use the chart type the user explicitly named:
  - "radar" / "spider" / "web chart" → type:"radar"
  - "line" / "trend line" / "line chart" → type:"line"
  - "area" / "area chart" → type:"area"
  - "donut" / "pie" → type:"donut"
  - "scatter" / "bubble" → type:"scatter"
  - "table" / "data table" → type:"table"
  - "bar" / "bar chart" / "column chart" → type:"bar"
  - "stacked bar" / "stacked column" → type:"stacked_bar"
  - "grouped bar" / "grouped column" → type:"grouped_bar"
  - NO explicit chart type named → default to type:"bar"
RULE 2 — Multi-measure defaults (only applies when user does NOT name a chart type):
- TWO measures named + user says "stacked"/"composition"/"breakdown" → type:"stacked_bar", measures array MUST contain BOTH
- TWO measures named + user says "grouped"/"comparison"/"compare X and Y"/"side by side" → type:"grouped_bar", measures array MUST contain BOTH
- TWO measures named without explicit "stacked"/"grouped" → PREFER "grouped_bar" (shows both side by side; plain "bar" silently drops the 2nd measure which is wrong)
- For ANY add operation, include a sensible position (typically { x:0, y:bottom_of_canvas, w:12, h:5 }).
- For NON-table chart adds, include data.groupBy (single { table, column } object).
- For TABLE adds, NEVER use data.groupBy. Use data.dimensions (array of { table, column } objects — one per dimension column). All named dimension columns go in the array.

Example — "add grouped bar comparing total revenue and total profit by region":
{ "patches": [
  { "op": "add", "path": "/visuals/-", "value": {
    "id": "visual_grouped_1",
    "type": "grouped_bar",
    "position": { "x": 0, "y": 8, "w": 12, "h": 5 },
    "data": {
      "measures": ["Total Revenue", "Total Profit"],
      "groupBy": { "table": "Region", "column": "RegionName" },
      "orderBy": "desc",
      "limit": 10
    },
    "config": { "title": "Total Revenue and Total Profit by Region", "colorScheme": "teal" }
  }}
] }

Example — "add stacked bar of revenue and cost by category":
{ "patches": [
  { "op": "add", "path": "/visuals/-", "value": {
    "id": "visual_stacked_1",
    "type": "stacked_bar",
    "position": { "x": 0, "y": 8, "w": 12, "h": 5 },
    "data": {
      "measures": ["Total Revenue", "Total Cost"],
      "groupBy": { "table": "Product", "column": "Category" },
      "orderBy": "desc",
      "limit": 10
    },
    "config": { "title": "Revenue and Cost by Category" }
  }}
] }

Example — "add a table with Territory Lookup[Region], Territory Lookup[Country], Product[CategoryName] showing Total Revenue and Total Profit":
{ "patches": [
  { "op": "add", "path": "/visuals/-", "value": {
    "id": "visual_table_1",
    "type": "table",
    "position": { "x": 0, "y": 8, "w": 12, "h": 5 },
    "data": {
      "dimensions": [
        { "table": "Territory Lookup", "column": "Region" },
        { "table": "Territory Lookup", "column": "Country" },
        { "table": "Product", "column": "CategoryName" }
      ],
      "measures": ["Total Revenue", "Total Profit"],
      "orderBy": "desc",
      "limit": 100
    },
    "config": { "title": "Revenue and Profit by Region, Country, and Category" }
  }}
] }

Example — "add radar chart in 4th row to show Total Revenue by Calendar Lookup[Month Name]":
{ "patches": [
  { "op": "add", "path": "/visuals/-", "value": {
    "id": "visual_radar_1",
    "type": "radar",
    "position": { "x": 0, "y": 3, "w": 6, "h": 5 },
    "data": {
      "measures": ["Total Revenue"],
      "groupBy": { "table": "Calendar Lookup", "column": "Month Name" }
    },
    "config": { "title": "Total Revenue by Month" }
  }}
] }

Example — "add average line" / "show average reference line" / "add avg line":
{ "patches": [
  { "op": "replace", "path": "/visuals/0/config/showAvgLine", "value": true }
] }

Example — "add target line at 5000000":
{ "patches": [
  { "op": "replace", "path": "/visuals/0/config/targetLine", "value": 5000000 }
] }

Example — "sort ascending":
{ "patches": [
  { "op": "replace", "path": "/visuals/0/data/orderBy", "value": "asc" }
] }

Example — "move title above the value":
{ "patches": [
  { "op": "replace", "path": "/visuals/0/config/titlePosition", "value": "above" }
] }

Example — "use filled card style, align left, show trend":
{ "patches": [
  { "op": "replace", "path": "/visuals/0/config/cardStyle", "value": "filled" },
  { "op": "replace", "path": "/visuals/0/config/align", "value": "left" },
  { "op": "replace", "path": "/visuals/0/config/showTrend", "value": true }
] }

Example — "value font Plus Jakarta Sans size 40":
{ "patches": [
  { "op": "replace", "path": "/visuals/0/config/valueFontFamily", "value": "Plus Jakarta Sans" },
  { "op": "replace", "path": "/visuals/0/config/valueFontSize", "value": 40 }
] }

Example — "move sparkline below the value":
{ "patches": [
  { "op": "replace", "path": "/visuals/0/config/sparklinePosition", "value": "below" }
] }

Example — "sparkline by quarter" (use ACTUAL date table/column from the model):
{ "patches": [
  { "op": "replace", "path": "/visuals/0/config/sparklineAxis", "value": "<DateTable>[<QuarterColumn>]" }
] }

CRITICAL: sparklineAxis MUST be a STRING in "Table[Column]" format, NOT an object.
CORRECT:   "value": "Calendar Lookup[Start of Month]"
WRONG:     "value": { "table": "Calendar Lookup", "column": "Start of Month" }
If unsure which column to use, omit the patch entirely — sparkline auto-detects.

ELEMENT-SPECIFIC COLOR RULES (CRITICAL):
When user says "make the sparkline green", ONLY change sparklineColor, NOT colorScheme.
When user says "progress bar red", ONLY change progressColor.
When user says "icon blue", ONLY change iconColor.
When user says "trend green", ONLY change trendUpColor.
When user says "title yellow", ONLY change titleColor.
When user says "value red", ONLY change valueColor.
When user says "card blue" or "change color to blue", change colorScheme (affects whole visual).

Example — "make sparkline green":
{ "patches": [
  { "op": "replace", "path": "/visuals/0/config/sparklineColor", "value": "#22C55E" }
] }

Example — "progress bar track #374151, fill #F59E0B":
{ "patches": [
  { "op": "replace", "path": "/visuals/0/config/progressTrackColor", "value": "#374151" },
  { "op": "replace", "path": "/visuals/0/config/progressColor", "value": "#F59E0B" }
] }

Example — "title color red":
{ "patches": [
  { "op": "replace", "path": "/visuals/0/config/titleColor", "value": "#EF4444" }
] }

Example — "change axis to DimensionTable[CategoryColumn]":
{ "patches": [
  { "op": "replace", "path": "/visuals/0/data/groupBy", "value": { "table": "DimensionTable", "column": "CategoryColumn" } }
] }

TYPE SWITCH RULES:
When changing visual type (e.g. "show as table", "make it a bar chart"):
  - ONLY replace /visuals/N/type — do NOT touch data.measures, data.groupBy, data.limit, data.orderBy
  - The renderer handles each type with the existing data fields
  - EXCEPTION: when switching TO stacked_bar, data.measures MUST have exactly 2 measures.
    If the current visual has only 1 measure and user names a second, add it.

Example — "make this a stacked bar of Revenue and Profit":
{ "patches": [
  { "op": "replace", "path": "/visuals/0/type", "value": "stacked_bar" },
  { "op": "replace", "path": "/visuals/0/data/measures", "value": ["Total Revenue", "Total Profit"] }
] }
  - If switching to table: keep limit and orderBy as-is (table uses them)

AXIS OPTIONS RULES:
When user asks for axis toggle/switch buttons:
  - The first axisOptions entry MUST match the visual's current data.groupBy
  - All entries must use valid { "table": "...", "column": "..." } from the model
  - Maximum 4 options per visual
  - If existing axisOptions are shown in CURRENT VISUALS, preserve/extend them rather than replacing from scratch

Example — "show as table":
{ "patches": [
  { "op": "replace", "path": "/visuals/0/type", "value": "table" }
] }

Example — "add axis toggle between Region and Country":
{ "patches": [
  { "op": "add", "path": "/visuals/0/config/axisOptions", "value": [
    { "label": "Region", "groupBy": { "table": "Territory", "column": "Region" } },
    { "label": "Country", "groupBy": { "table": "Territory", "column": "Country" } }
  ]}
] }

Example — "make donut smaller":
{ "patches": [
  { "op": "replace", "path": "/visuals/1/position/w", "value": 4 },
  { "op": "replace", "path": "/visuals/1/position/h", "value": 3 }
] }

EXAMPLES:
{ "patches": [
  { "op": "replace", "path": "/visuals/0/config/colorScheme", "value": "gold" },
  { "op": "replace", "path": "/visuals/0/data/orderBy", "value": "desc" }
] }`

// ── Visual schema map — mirrors ui/src/primitives/*/index.ts field definitions ──
// Used to inject exact config key names into PATCH prompt so LLM uses `barRadius`
// not `borderRadius`, `fillOpacity` not `opacity`, etc. Update when schemas change.
const _barSchema = [
  { key: 'barRadius',         label: 'Corner radius',             type: 'range',   range: '0–20',    default: 4 },
  { key: 'maxBarSize',        label: 'Max bar width (px)',        type: 'range',   range: '8–80',    default: 26 },
  { key: 'showBarBackground', label: 'Bar background track',      type: 'boolean', default: true },
  { key: 'gradient',          label: 'Gradient fill',             type: 'boolean', default: false },
  { key: 'rankOpacity',       label: 'Rank-based opacity fade',   type: 'boolean', default: true },
  { key: 'highlightMax',      label: 'Highlight max bar',         type: 'boolean', default: false },
  { key: 'gridLines',         label: 'Grid lines',                type: 'boolean', default: false },
  { key: 'gridStyle',         label: 'Grid style',                type: 'select',  options: ['dashed', 'solid', 'dotted'] },
  { key: 'stacked',           label: 'Stack series',              type: 'boolean', default: false },
  { key: 'secondaryColor',    label: 'Secondary series color',    type: 'color' },
  { key: 'dataLabels',        label: 'Show data labels',          type: 'boolean', default: true },
  { key: 'labelPosition',     label: 'Label position',            type: 'select',  options: ['right', 'inside', 'top', 'auto'] },
  { key: 'showAvgLine',       label: 'Average reference line',    type: 'boolean', default: false },
  { key: 'avgLineColor',      label: 'Avg line color (hex)',      type: 'color',   default: '#F59E0B' },
  { key: 'avgLineStyle',      label: 'Avg line style',            type: 'select',  options: ['dashed', 'solid', 'dotted'] },
  { key: 'targetLine',        label: 'Target reference value',    type: 'number' },
  { key: 'conditionalColor',  label: 'Conditional bar color',     type: 'object',  note: '{ threshold, above: "#hex", below: "#hex" }' },
]

const _lineSchema = [
  { key: 'chartType',      label: 'Chart type',          type: 'select',  options: ['line', 'area'], default: 'line' },
  { key: 'smooth',         label: 'Smooth curve',        type: 'boolean', default: false },
  { key: 'strokeWidth',    label: 'Stroke width',        type: 'range',   range: '1–6',   default: 2.5 },
  { key: 'fillOpacity',    label: 'Fill opacity',        type: 'range',   range: '0–1',   default: 0.28 },
  { key: 'stacked',        label: 'Stack series',        type: 'boolean', default: false },
  { key: 'primaryColor',   label: 'Primary line color',  type: 'color',   default: '' },
  { key: 'secondaryColor', label: 'Secondary line color',type: 'color',   default: '' },
  { key: 'showDots',       label: 'Data point dots',     type: 'boolean', default: true },
  { key: 'dotSize',        label: 'Dot size',            type: 'range',   range: '1–8',   default: 2.5 },
  { key: 'showGrid',       label: 'Grid lines',          type: 'boolean', default: false },
  { key: 'showXAxis',      label: 'X axis',              type: 'boolean', default: true },
  { key: 'showYAxis',      label: 'Y axis',              type: 'boolean', default: false },
  { key: 'invertY',        label: 'Invert Y axis',       type: 'boolean', default: false },
  { key: 'showAvgLine',    label: 'Average line',        type: 'boolean', default: false },
  { key: 'targetLine',     label: 'Target reference',    type: 'number' },
]

const _gaugeSchema = [
  { key: 'minValue',      label: 'Min value',        type: 'number',  default: 0 },
  { key: 'maxValue',      label: 'Max value',        type: 'number',  default: 100 },
  { key: 'arcWidth',      label: 'Arc width (px)',   type: 'range',   range: '4–30',   default: 10 },
  { key: 'gaugeSize',     label: 'Gauge size (%)',   type: 'range',   range: '30–100', default: 80 },
  { key: 'showMinMax',    label: 'Show min/max labels', type: 'boolean', default: false },
  { key: 'valueFontSize', label: 'Value font size',  type: 'range',   range: '10–28',  default: 15 },
  { key: 'colorZones',    label: 'Color zones',      type: 'array',   note: '[{from,to,color}] — overrides scheme color by value range' },
  { key: 'targetValue',   label: 'Target marker',    type: 'number' },
]

const _pieSchema = [
  { key: 'innerRadius',    label: 'Inner radius (0=pie, 52=donut)', type: 'range',   range: '0–80',  default: 52 },
  { key: 'outerRadius',    label: 'Outer radius',                  type: 'range',   range: '50–95', default: 85 },
  { key: 'paddingAngle',   label: 'Segment gap (deg)',             type: 'range',   range: '0–10',  default: 2 },
  { key: 'cornerRadius',   label: 'Segment corner radius',         type: 'range',   range: '0–12',  default: 0 },
  { key: 'showLegend',     label: 'Legend',                        type: 'boolean', default: true },
  { key: 'legendPosition', label: 'Legend position',               type: 'select',  options: ['right', 'bottom'] },
  { key: 'maxLegendItems', label: 'Max legend items',              type: 'number',  default: 6 },
  { key: 'showLabels',     label: 'Slice labels',                  type: 'boolean', default: false },
  { key: 'labelStyle',     label: 'Label style',                   type: 'select',  options: ['percent', 'value', 'name'] },
  { key: 'showCenterText', label: 'Center text',                   type: 'boolean', default: true },
  { key: 'centerFontSize', label: 'Center font size',              type: 'range',   range: '12–48', default: 22 },
]

const _scatterSchema = [
  { key: 'dotSize',     label: 'Dot size (px)',     type: 'range',   range: '4–60',   default: 16 },
  { key: 'dotSizeMax',  label: 'Max bubble area',   type: 'number',  default: 100,    note: 'bubble charts only — controls z-size scaling' },
  { key: 'fillOpacity', label: 'Fill opacity',      type: 'range',   range: '0.1–1',  default: 0.75 },
  { key: 'showGrid',    label: 'Grid lines',        type: 'boolean', default: true },
  { key: 'showXAxis',   label: 'X axis',            type: 'boolean', default: true },
  { key: 'showYAxis',   label: 'Y axis',            type: 'boolean', default: true },
  { key: 'showLabels',  label: 'Point labels (category name)', type: 'boolean', default: false },
]

const _radarSchema = [
  { key: 'fillOpacity',   label: 'Fill opacity',    type: 'range',   range: '0–1',   default: 0.22 },
  { key: 'strokeWidth',   label: 'Stroke width',    type: 'range',   range: '1–6',   default: 2 },
  { key: 'showDots',      label: 'Data point dots', type: 'boolean', default: false },
  { key: 'radarRadius',   label: 'Radar size (%)',  type: 'range',   range: '40–90', default: 68 },
  { key: 'labelFontSize', label: 'Label font size', type: 'range',   range: '7–14',  default: 9 },
]

const _treemapSchema = [
  { key: 'showLabels',    label: 'Tile labels',    type: 'boolean', default: true },
  { key: 'labelFontSize', label: 'Label size',     type: 'range',   range: '8–18',  default: 10 },
  { key: 'showValues',    label: 'Tile values',    type: 'boolean', default: false },
  { key: 'valueFontSize', label: 'Value size',     type: 'range',   range: '7–16',  default: 9 },
  { key: 'colorMode',     label: 'Color mode',     type: 'select',  options: ['single', 'gradient', 'multi'] },
  { key: 'borderRadius',  label: 'Border radius',  type: 'range',   range: '0–12',  default: 0 },
  { key: 'borderWidth',   label: 'Border width',   type: 'range',   range: '0–4',   default: 1 },
  { key: 'padding',       label: 'Outer padding',  type: 'range',   range: '0–24',  default: 0 },
]

const VISUAL_SCHEMA_MAP = {
  bar: _barSchema, column: _barSchema, stacked_bar: _barSchema,
  grouped_bar: _barSchema, lollipop: _barSchema, waterfall: _barSchema,
  bar_race: _barSchema,
  line: _lineSchema, area: _lineSchema, stacked_area: _lineSchema,
  slope: _lineSchema, bump: _lineSchema,
  gauge: _gaugeSchema,
  donut: _pieSchema, pie: _pieSchema, sunburst: _pieSchema,
  scatter: _scatterSchema, bubble: _scatterSchema,
  radar: _radarSchema,
  treemap: _treemapSchema,
}

// Builds a compact config-key reference for the given visual types.
// Injected into the patch-app-spec user message so the LLM uses exact key names.
function buildVisualSchemaHint(types) {
  const seenSchema = new Set()
  const sections = []
  for (const type of (types || [])) {
    const schema = VISUAL_SCHEMA_MAP[type]
    if (!schema || seenSchema.has(schema)) continue
    seenSchema.add(schema)
    const canonicalLabel =
      schema === _barSchema     ? 'bar / column / stacked_bar / grouped_bar / lollipop / waterfall'
      : schema === _lineSchema  ? 'line / area / stacked_area / slope / bump'
      : schema === _pieSchema   ? 'donut / pie / sunburst'
      : schema === _scatterSchema ? 'scatter / bubble'
      : type
    const lines = [`${canonicalLabel}:`]
    for (const f of schema) {
      let desc = `  ${f.key}: ${f.label}`
      if (f.type === 'range' && f.range)   desc += ` (range ${f.range}`
      else if (f.type === 'number')        desc += ` (number`
      else if (f.type === 'boolean')       desc += ` (boolean`
      else if (f.type === 'color')         desc += ` (hex color string`
      else if (f.type === 'select' && f.options) desc += ` (one of: ${f.options.join(' | ')}`
      else                                 desc += ` (${f.type}`
      if (f.default !== undefined)         desc += `, default: ${JSON.stringify(f.default)}`
      if (f.note)                          desc += ` — ${f.note}`
      desc += ')'
      lines.push(desc)
    }
    sections.push(lines.join('\n'))
  }
  if (!sections.length) return ''
  return `ACTIVE VISUAL CONFIG SCHEMAS — use ONLY these exact key names when patching config:\n${sections.join('\n\n')}`
}

// Stage 1 system prompt — lightweight routing
const STAGE1_SYSTEM_PROMPT = `You are a semantic routing engine for a Power BI semantic model.
Given a user request and model summary, identify the most relevant schema elements.
Return ONLY this JSON (no other text):
{
  "selectedMeasures": ["measure name"],
  "selectedTables": ["table name"],
  "visualType": "kpi|bar|line|gauge|scatter|treemap|radar|sankey|area|donut|funnel",
  "impliedFilters": {}
}`

// ── AI prompt ─────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a data visualization expert for Microsoft Fabric semantic models.

Given a user description and available measures and dimensions, return ONLY a valid JSON object.
No explanation. No markdown. Just JSON.

The available measures and dimensions are provided in each user message — use ONLY those exact names.

Available visual types:
- kpi: Single KPI value card — use for a single scalar metric
- gauge: Arc gauge with configurable min/max — use for any scalar KPI; set minValue/maxValue to match the measure's scale (e.g. maxValue: 30000000 for a revenue metric)
- bar: Horizontal bar chart ranked by category — REQUIRES categoryColumn (a table[column] from the list)
- line: Area/line chart over time — REQUIRES dateColumn (a date/year/period column from the list)
- sankey: Flow diagram — REQUIRES sourceColumn AND targetColumn (two categorical columns)
- radar: Radar/spider chart comparing multiple categories on one or two measures — REQUIRES categoryColumn; use secondaryMeasure for a second axis
- scatter: Scatter plot comparing two measures per category — REQUIRES primaryMeasure AND secondaryMeasure AND categoryColumn. Without categoryColumn there is only ONE dot — always add a groupBy dimension (product, region, channel, etc.)
- treemap: Proportional area tiles by category — REQUIRES categoryColumn and primaryMeasure
- donut: Radial progress arc (single measure, no categoryColumn) OR segmented donut (with categoryColumn). Single-measure: shows value as arc fill, value centered. Multi-segment: slices per category with legend.
- funnel: Conversion funnel with stage drop-offs — use categoryColumn for stage names, primaryMeasure for stage values. Renders demo data if no categoryColumn.
- area: Filled area chart emphasizing volume over time — like line but with strong fill gradient. REQUIRES dateColumn or categoryColumn. Use for cumulative/volume metrics.

Color scheme guidance:
- gold: counts, totals, primary KPIs
- teal: rates, throughput, efficiency
- violet: advanced analytics, predictions
- rose: risk, pressure, negative metrics
- blue: general purpose, comparisons
- green: positive metrics, growth, wins
- purple: multi-dimensional analysis
- amber: warnings, secondary metrics

Return exactly this JSON structure:
{
  "visualType": "one of the types above",
  "primaryMeasure": "exact measure name from the list",
  "secondaryMeasure": "exact measure name or null",
  "categoryColumn": "table[column] or null",
  "locationColumn": "table[column] or null",
  "sourceColumn": "table[column] or null",
  "targetColumn": "table[column] or null",
  "dateColumn": "table[column] or null",
  "sizeColumn": "table[column] or null",
  "filters": {},
  "label": "display title for this visual",
  "subtitle": null,
  "colorScheme": "gold|teal|danger|purple|blue|green",
  "theme": "dark",
  "gridLines": false,
  "gridLinesColor": null,
  "gridLinesDash": "4 4",
  "dataLabels": false,
  "strokeWidth": 2.5,
  "showDots": true,
  "fillOpacity": 0.3,
  "smooth": true,
  "barRadius": 4,
  "prefix": null,
  "suffix": null,
  "minValue": null,
  "maxValue": null,
  "targetValue": null,
  "targetMeasure": null,
  "colorZones": null,
  "titleFontFamily": null,
  "titleColor": null,
  "dateColumnMonth": null,
  "dateColumnDate": null,
  "reasoning": "one sentence explaining your choices"
}

CRITICAL RULES:
1. Return ONLY fields listed in the schema above. NEVER add new fields not listed here. Fields like "titleFontStyle", "timePeriodToggle", "drilldown", "crosshair", "legend", "animation", "tooltip" DO NOT EXIST — do not use them.
2. If the user asks for interactive features (toggles, filters, drill-down, period switchers) that cannot be expressed as the fields above, acknowledge in reasoning that it's not supported, and return the config unchanged.
3. On refinement: only change fields the user explicitly asked to change. Copy all other fields exactly from currentConfig.

Styling fields — supported values:
- gridLines: true/false — horizontal dashed grid lines (bar, line)
- gridLinesColor: hex string e.g. "#90EE90"
- gridLinesDash: "4 4" | "6 2" | "2 2" | "8 4"
- dataLabels: true/false — value labels on data points (bar, line)
- strokeWidth: 1–4 — line thickness
- showDots: true/false — dot markers on line chart
- fillOpacity: 0–1 — area fill opacity
- smooth: true/false — smooth vs angular line
- barRadius: 0–10 — rounded bar corners
- prefix: string — prepend to value e.g. "$"
- suffix: string — append to value e.g. "%"
- subtitle: string — secondary text under title
- minValue: number — gauge min value (default 0)
- maxValue: number — gauge max value (default 100)
- targetValue: number — gauge static target marker (use when target is a fixed number)
- targetMeasure: string — gauge target from a measure e.g. "Order Target" (use when target is a measure in the dataset)
- colorZones: array — gauge color zones e.g. [{"from":0,"to":50,"color":"#F87171"},{"from":50,"to":80,"color":"#FBBF24"},{"from":80,"to":100,"color":"#4ADE80"}]
- showMinMax: boolean — show min/max value labels at the arc endpoints (default false)
- arcWidth: number — arc thickness in px (default 10, range 4–30)
- valueFontSize: number — center value font size (default 15, range 10–28)
- titleFontFamily: "cursive" | "serif" | "monospace" | null (default sans-serif)
- titleColor: hex string — title text color e.g. "#00C9A7"
- dateColumnMonth: "table[column]" — month-level date column from dimensions (enables Month toggle on line chart)
- dateColumnDate: "table[column]" — day-level date column from dimensions (enables Date toggle on line chart)
  When user asks for period toggles/drill-down on a line chart, set dateColumnMonth and/or dateColumnDate from the available dimensions list.`

function buildContextBlock(measures, dimensions, modelContext) {
  const ctx = modelContext

  // ── Measure list ───────────────────────────────────────────────────────────
  const measureList = ctx
    ? ctx.measures.map(m => {
        let line = `- ${m.name}`
        if (m.dataType)          line += ` [${m.dataType}]`
        if (m.isRatio)           line += ` (ratio — value is 0–1, treat as %)`
        if (m.isTimeIntelligence) line += ` (time intelligence)`
        if (m.formatString)      line += ` format:"${m.formatString}"`
        return line
      }).join('\n')
    : measures.map(m => `- ${m.name} (table: ${m.table})`).join('\n')

  // ── Dimension/table list ───────────────────────────────────────────────────
  const dimList = ctx
    ? ctx.tables
        .filter(t => t.tableType !== 'measure_group')
        .map(t => {
          const catCols  = t.columns.filter(c => c.isCategory  && !c.isKey).map(c => `${t.name}[${c.name}]`)
          const dateCols = t.columns.filter(c => c.isDate).map(c => `${t.name}[${c.name}]`)
          const geoCols  = t.columns.filter(c => c.isGeography).map(c => `${t.name}[${c.name}]`)
          let line = `- ${t.name} (${t.tableType})`
          if (catCols.length)  line += `\n  categories: ${catCols.join(', ')}`
          if (dateCols.length) line += `\n  dates: ${dateCols.join(', ')}`
          if (geoCols.length)  line += `\n  geography: ${geoCols.join(', ')}`
          return line
        }).join('\n')
    : dimensions.map(d => {
        const cols = (d.columns || []).slice(0, 15).map(c => (typeof c === 'string' ? c : c.name))
        return `- ${d.name || d.tableName}: ${cols.join(', ')}`
      }).join('\n')

  // ── Relationship context ───────────────────────────────────────────────────
  const relBlock = ctx?.relationships?.length
    ? `\nRelationships:\n${ctx.relationships.map(r => `  ${r.key}`).join('\n')}`
    : ''

  // ── Model summary ──────────────────────────────────────────────────────────
  const summaryLine = ctx?.summary
    ? `Model: ${ctx.summary.domain} domain | ${ctx.summary.totalMeasures} measures | ` +
      `fact tables: ${ctx.summary.factTables.join(', ') || 'n/a'} | ` +
      `date tables: ${ctx.summary.dateTables.join(', ') || 'none'} | ` +
      `geography: ${ctx.summary.hasGeography}`
    : ''

  // ── Domain-specific rules ──────────────────────────────────────────────────
  const ratioNames = ctx?.summary?.ratioMeasures || []
  const ratioRule  = ratioNames.length
    ? `- These measures return 0–1 decimals (NOT percentages): ${ratioNames.join(', ')}`
    : ''
  const relRule = ctx?.relationships?.length
    ? '- Use the relationship list above to choose correct filter column references'
    : ''

  const rules = [ratioRule, relRule].filter(Boolean).join('\n')

  return `SEMANTIC MODEL CONTEXT:
${summaryLine}

AVAILABLE MEASURES:
${measureList}

AVAILABLE TABLES AND COLUMNS:
${dimList}
${relBlock}
${rules ? `\nMODEL RULES:\n${rules}` : ''}`
}

function buildUserMessage(description, measures, dimensions, modelContext, focusedSummary, pageSize) {
  const ctx = modelContext || global.semanticaModelContext || null
  const contextBlock = buildContextBlock(measures, dimensions, ctx)
  const summaryBlock = focusedSummary
    ? `\nFOCUSED MODEL SUMMARY (Stage 1 selected):\n${focusedSummary}\n`
    : ''
  // Canvas hints so the LLM lays out visuals for the target page size.
  let canvasBlock = ''
  if (pageSize && (pageSize.width || pageSize.height)) {
    const w = pageSize.width  || 1280
    const h = pageSize.height || 720
    const shape = h > 1000 ? ' (tall dashboard — prefer vertical stacking; use h:5 charts and add more rows)'
      : (w > h * 1.5 ? ' (wide — you can place 2-3 charts side-by-side per row)'
      : '')
    const cw = Math.round((w - 40) / 12)
    canvasBlock = `\nTARGET CANVAS: ${w}x${h} px${shape}. Each of the 12 grid columns is ~${cw}px wide; each row is 80px tall.\n`
  }
  return `${contextBlock}${summaryBlock}${canvasBlock}
USER REQUEST: "${description}"

CRITICAL: Use ONLY exact measure names and table[column] references from the lists above.
Return JSON config only.`
}

function buildRefinementMessage(description, measures, dimensions, currentConfig, modelContext) {
  const ctx = modelContext || global.semanticaModelContext || null
  return `You have already generated this visual configuration:
${JSON.stringify(currentConfig, null, 2)}

The user wants to refine it: "${description}"

${buildContextBlock(measures, dimensions, ctx)}

Update only the fields the user explicitly asked to change. Preserve all other fields exactly. Return JSON config only.`
}

function parseAiResponse(text) {
  // Strip code fences
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  // Fast path: the whole cleaned string is valid JSON
  try { return JSON.parse(cleaned) } catch (_) {}

  // Fallback: extract the first JSON object or array substring.
  // Handles models that prepend/append explanatory text.
  const objMatch = cleaned.match(/\{[\s\S]*\}/)
  if (objMatch) {
    try { return JSON.parse(objMatch[0]) } catch (_) {}
  }
  const arrMatch = cleaned.match(/\[[\s\S]*\]/)
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]) } catch (_) {}
  }

  throw new Error(`AI response is not valid JSON. Preview: ${cleaned.slice(0, 160)}`)
}

async function generateWithClaude(userMessage, apiKey, model, maxTokens, systemPromptOverride) {
  const t0 = Date.now()
  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: model || 'claude-sonnet-4-6',
      max_tokens: maxTokens || 1000,
      system: systemPromptOverride || SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      temperature: 0.1,
    },
    {
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      timeout: 60000,
    }
  )
  const u = response.data.usage || {}
  const inputTokens  = u.input_tokens  || 0
  const outputTokens = u.output_tokens || 0
  const totalTokens  = inputTokens + outputTokens
  return {
    config: parseAiResponse(response.data.content[0].text),
    usage: { inputTokens, outputTokens, totalTokens, elapsedMs: Date.now() - t0, estimatedCost: (inputTokens / 1e6) * 3 + (outputTokens / 1e6) * 15 },
  }
}

async function generateWithGroq(userMessage, apiKey, model, maxTokens, systemPrompt) {
  const t0 = Date.now()
  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: model || 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt || SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      max_tokens: maxTokens || 1000,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    },
    {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 60000,
    }
  )
  const u = response.data.usage || {}
  const inputTokens  = u.prompt_tokens     || 0
  const outputTokens = u.completion_tokens || 0
  const totalTokens  = inputTokens + outputTokens
  return {
    config: parseAiResponse(response.data.choices[0].message.content),
    usage: { inputTokens, outputTokens, totalTokens, elapsedMs: Date.now() - t0, estimatedCost: 0 },
  }
}

async function generateWithOpenAI(userMessage, apiKey, model, maxTokens, systemPromptOverride) {
  const t0 = Date.now()
  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: model || 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPromptOverride || SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      max_tokens: maxTokens || 1000,
      temperature: 0.1,
    },
    {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 60000,
    }
  )
  const u = response.data.usage || {}
  const inputTokens  = u.prompt_tokens     || 0
  const outputTokens = u.completion_tokens || 0
  const totalTokens  = inputTokens + outputTokens
  return {
    config: parseAiResponse(response.data.choices[0].message.content),
    usage: { inputTokens, outputTokens, totalTokens, elapsedMs: Date.now() - t0, estimatedCost: (inputTokens / 1e6) * 2.5 + (outputTokens / 1e6) * 10 },
  }
}

async function generateWithGemini(userMessage, apiKey, model, maxTokens, systemPromptOverride, disableThinking = false) {
  const t0 = Date.now()
  const modelId = model || 'gemini-2.5-flash-preview-05-20'
  const genConfig = {
    temperature: 0.1,
    maxOutputTokens: maxTokens || 1000,
    responseMimeType: 'application/json',
  }
  // gemini-2.5-flash has built-in thinking that can consume most of maxOutputTokens.
  // For structured JSON tasks (patch generation, routing), disable thinking so the
  // full token budget goes to actual output instead of internal reasoning.
  if (disableThinking || modelId.includes('2.5')) {
    genConfig.thinkingConfig = { thinkingBudget: 0 }
  }
  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
    {
      system_instruction: { parts: [{ text: systemPromptOverride || SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: genConfig,
    },
    { timeout: 60000 }
  )
  const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Empty response from Gemini')
  const u = response.data.usageMetadata || {}
  const inputTokens  = u.promptTokenCount     || 0
  const outputTokens = u.candidatesTokenCount || 0
  return {
    config: parseAiResponse(text),
    usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, elapsedMs: Date.now() - t0, estimatedCost: (inputTokens / 1e6) * 0.075 + (outputTokens / 1e6) * 0.3 },
  }
}

async function generateWithLocal(userMessage, systemPrompt, maxTokens) {
  const localLlm = require('./localLlm')
  const result   = await localLlm.generate([{ role: 'user', content: userMessage }], systemPrompt, maxTokens)
  return {
    config: parseAiResponse(result.content),
    usage:  result.usage,
  }
}

// ── App Generator helpers ──────────────────────────────────────────────────────

// Returns the first model from the provider's list of available models —
// serves as the "if the user has no saved preference" choice. No separate
// hardcoded table: the list the UI populates from IS the source of truth.
function getDefaultGenerationModel(provider) {
  const lists = { anthropic: ANTHROPIC_MODELS, openai: OPENAI_MODELS, gemini: GEMINI_MODELS, groq: GROQ_MODELS, local: LOCAL_MODELS }
  const list = lists[provider] || ANTHROPIC_MODELS
  const first = list[0]
  if (!first) return ''
  return typeof first === 'string' ? first : first.id
}

// Picks cheapest/fastest configured provider for Stage 1 routing
function selectRoutingProvider() {
  const priority = [
    { provider: 'groq',     key: 'groq',     model: 'llama-3.3-70b-versatile'     },
    { provider: 'gemini',   key: 'gemini',   model: 'gemini-2.0-flash-lite'        },
    { provider: 'anthropic',key: 'anthropic',model: 'claude-haiku-4-5-20251001'    },
    { provider: 'openai',   key: 'openai',   model: 'gpt-4o-mini'                  },
  ]
  for (const opt of priority) {
    const apiKey = getKey(opt.key)
    if (apiKey) return { provider: opt.provider, apiKey, model: opt.model }
  }
  return null
}

// Picks best configured provider for generation, respecting preferred provider.
// `modelOverride` lets the UI's Provider+Model dropdown override the keychain-saved
// per-provider default. Falls back to saved/default if not provided.
function selectGenerationProvider(preferredProvider, modelOverride) {
  if (preferredProvider === 'local') {
    const localLlm = require('./localLlm')
    if (!localLlm.isModelPresent()) throw new Error('Local model file not found. Check Local AI settings.')
    return { provider: 'local', apiKey: null, model: modelOverride || 'phi-4-mini-q4' }
  }
  if (preferredProvider) {
    const apiKey = getKey(preferredProvider === 'anthropic' ? 'anthropic' : preferredProvider)
    if (apiKey) {
      const modelKeyMap = { anthropic: 'anthropic-model', openai: 'openai-model', groq: 'groq-model', gemini: 'gemini-model' }
      const model = modelOverride || getKey(modelKeyMap[preferredProvider]) || getDefaultGenerationModel(preferredProvider)
      return { provider: preferredProvider, apiKey, model }
    }
  }
  // Fall back to best available
  const priority = [
    { provider: 'anthropic', key: 'anthropic', modelKey: 'anthropic-model', default: 'claude-sonnet-4-6' },
    { provider: 'openai',    key: 'openai',    modelKey: 'openai-model',    default: 'gpt-4o'             },
    { provider: 'gemini',    key: 'gemini',    modelKey: 'gemini-model',    default: 'gemini-2.5-flash-preview-05-20' },
    { provider: 'groq',      key: 'groq',      modelKey: 'groq-model',      default: 'llama-3.3-70b-versatile' },
  ]
  for (const opt of priority) {
    const apiKey = getKey(opt.key)
    if (apiKey) {
      const model = getKey(opt.modelKey) || opt.default
      return { provider: opt.provider, apiKey, model }
    }
  }
  throw new Error('No AI provider configured. Add at least one API key in Health → AI Settings.')
}

// True for HTTP status codes / error shapes that are transient (retryable).
function isTransientError(err) {
  const status = err?.response?.status || err?.status
  if ([429, 529, 502, 503, 504].includes(status)) return true
  const msg = String(err?.message || '').toLowerCase()
  if (/overloaded|rate.?limit|too many requests|capacity|timeout|econnreset|socket hang up/.test(msg)) return true
  return false
}

// Turn a raw provider AxiosError into an actionable message for the UI, so the
// user sees WHY it failed (and what to do) instead of "AxiosError: 413".
function friendlyProviderError(err, provider) {
  const status = err?.response?.status
  const body = err?.response?.data?.error?.message || err?.response?.data?.message || ''
  const p = provider || 'The AI provider'
  if (status === 413) {
    return new Error(`${p} rejected the request as too large (413).${body ? ' ' + body : ''} This prompt exceeds the per-request token limit for this model/tier — pick a higher-limit model (on Groq, llama-3.3-70b-versatile or llama-4-scout), generate a simpler page, or switch to Gemini/Anthropic.`)
  }
  if (status === 429) {
    return new Error(`${p} rate limit reached (429).${body ? ' ' + body : ''} Wait a few seconds and retry, or switch to a different model/provider.`)
  }
  if (status === 401 || status === 403) {
    return new Error(`${p} rejected your API key (${status}). Re-check the key in Settings → AI Settings.`)
  }
  if (status === 404) {
    return new Error(`${p} could not find that model (404). Pick a different model in the dropdown.`)
  }
  return err
}

// Calls a single provider, no retry.
async function callProviderOnce(providerConfig, userMessage, systemPrompt, maxTokens) {
  const { provider, apiKey, model } = providerConfig
  let result
  switch (provider) {
    case 'local':   result = await generateWithLocal(userMessage, systemPrompt, maxTokens);                  break
    case 'gemini':  result = await generateWithGemini(userMessage, apiKey, model, maxTokens, systemPrompt);  break
    case 'openai':  result = await generateWithOpenAI(userMessage, apiKey, model, maxTokens, systemPrompt);  break
    case 'groq':    result = await generateWithGroq(userMessage, apiKey, model, maxTokens, systemPrompt);    break
    default:        result = await generateWithClaude(userMessage, apiKey, model, maxTokens, systemPrompt);  break
  }
  return { config: result.config, usage: result.usage || null }
}

// Sum two usage objects (handles nulls safely)
function sumUsage(a, b) {
  if (!a) return b || null
  if (!b) return a
  return {
    inputTokens:   (a.inputTokens || 0) + (b.inputTokens || 0),
    outputTokens:  (a.outputTokens || 0) + (b.outputTokens || 0),
    totalTokens:   (a.totalTokens || 0) + (b.totalTokens || 0),
    estimatedCost: (a.estimatedCost || 0) + (b.estimatedCost || 0),
    elapsedMs:     (a.elapsedMs || 0) + (b.elapsedMs || 0),
  }
}

// Calls any provider with retry + fallback. Accumulates usage across ALL attempts.
async function callAnyProvider(providerConfig, userMessage, systemPrompt, maxTokens = 4000) {
  const RETRIES = 2
  const BACKOFF = [1500, 3000]
  let totalUsage = null
  let lastError

  // Attempt preferred provider with retries
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const res = await callProviderOnce(providerConfig, userMessage, systemPrompt, maxTokens)
      totalUsage = sumUsage(totalUsage, res.usage)
      return { config: res.config, usage: totalUsage, actualProvider: providerConfig.provider, actualModel: providerConfig.model }
    } catch (err) {
      lastError = err
      if (!isTransientError(err) || attempt === RETRIES) break
      console.warn(`[llm] ${providerConfig.provider} attempt ${attempt + 1} failed (${err?.response?.status || err.message}), retrying in ${BACKOFF[attempt]}ms...`)
      await new Promise(r => setTimeout(r, BACKOFF[attempt]))
    }
  }

  // Fallback to next configured provider
  if (isTransientError(lastError)) {
    const fallbackPriority = ['anthropic', 'openai', 'gemini', 'groq']
      .filter(p => p !== providerConfig.provider)
    for (const fbProvider of fallbackPriority) {
      const fbKey = getKey(fbProvider)
      if (!fbKey) continue
      // Validate the keychain-saved model against the known-good list. Prevents
      // stale preferences (e.g. retired model ids like claude-opus-4-6) from
      // being sent to the provider API and failing with 400 during fallback.
      const validModels = fbProvider === 'anthropic' ? ANTHROPIC_MODELS
        : fbProvider === 'openai'    ? OPENAI_MODELS
        : fbProvider === 'groq'      ? GROQ_MODELS
        : fbProvider === 'gemini'    ? GEMINI_MODELS
        : []
      const savedModel = getKey(`${fbProvider}-model`)
      const savedIsValid = savedModel && validModels.some(m => (typeof m === 'string' ? m : m.id) === savedModel)
      const fbModel = savedIsValid ? savedModel : getDefaultGenerationModel(fbProvider)
      try {
        console.log(`[llm] Falling back to ${fbProvider} (${fbModel}) after ${providerConfig.provider} overload`)
        const res = await callProviderOnce({ provider: fbProvider, apiKey: fbKey, model: fbModel }, userMessage, systemPrompt, maxTokens)
        totalUsage = sumUsage(totalUsage, res.usage)
        return { config: res.config, usage: totalUsage, actualProvider: fbProvider, actualModel: fbModel }
      } catch (fbErr) {
        console.warn(`[llm] Fallback ${fbProvider} also failed: ${fbErr.message}`)
        continue
      }
    }
  }

  if (isTransientError(lastError)) {
    throw new Error('AI provider is temporarily overloaded. Please retry in a few seconds or switch to a different mode.')
  }
  throw lastError
}

// Builds a focused model summary scoped to selected measures + tables
function buildFocusedModelSummary(modelContext, selectedMeasures, selectedTables) {
  if (!modelContext) return 'No model context available'
  const { measures, tables, relationships } = modelContext

  const visibleMeasureNames = new Set((measures || []).filter(m => !m.isHidden).map(m => m.name))
  const visibleTableNames   = new Set((tables || []).filter(t => t.tableType !== 'measure_group').map(t => t.name))
  const scopedMeasures = Array.isArray(selectedMeasures) && selectedMeasures.length
    ? selectedMeasures.filter(name => visibleMeasureNames.has(name))
    : [...visibleMeasureNames]
  const scopedTables = Array.isArray(selectedTables) && selectedTables.length
    ? selectedTables.filter(name => visibleTableNames.has(name))
    : [...visibleTableNames]

  const relMeasures = measures.filter(m => scopedMeasures.includes(m.name) && !m.isHidden)
  const relTables   = tables.filter(t => scopedTables.includes(t.name))

  const tableLines = relTables.map(t => {
    const cols = (t.columns || []).filter(c => !c.isHidden).slice(0, 12)
      .map(c => `${c.name}(${(c.dataType || '?').substring(0, 3).toUpperCase()})`).join(', ')
    return `T: ${t.name} | ${cols}`
  }).join('\n')

  const relLines = (relationships || [])
    .filter(r => scopedTables.includes(r.fromTable) || scopedTables.includes(r.toTable))
    .map(r => {
      const dir = (r.crossFilter || '').includes('both') ? 'Both' : 'Single'
      const active = r.isActive ? '' : ' [INACTIVE]'
      return `${r.fromTable}[${r.fromColumn}] -> ${r.toTable}[${r.toColumn}] (1:M, ${dir})${active}`
    }).join('\n')

  const measureLines = relMeasures.map(m => {
    const ratio = m.isRatio ? ' [RATIO:0-1->%]' : ''
    const fmt   = m.formatString ? ` | Fmt:${m.formatString}` : ''
    const ti    = m.isTimeIntelligence ? ' [TIME-INTEL]' : ''
    return `M: ${m.name} | Table:${m.table} | Type:${m.dataType || 'numeric'}${ratio}${ti}${fmt}`
  }).join('\n')

  return `TABLES:\n${tableLines || 'none'}\n\nRELATIONSHIPS:\n${relLines || 'none'}\n\nMEASURES:\n${measureLines || 'none'}`
}

function normaliseStage1Result(modelContext, result) {
  if (!modelContext) return result || null
  const measureSet = new Set((modelContext.measures || []).filter(m => !m.isHidden).map(m => m.name))
  const tableSet   = new Set((modelContext.tables || []).filter(t => t.tableType !== 'measure_group').map(t => t.name))
  const visualSet  = new Set(['kpi', 'bar', 'stacked_bar', 'line', 'area', 'donut', 'gauge', 'radar', 'scatter', 'treemap', 'funnel', 'sankey', 'table'])

  const selectedMeasures = (result?.selectedMeasures || []).filter(name => measureSet.has(name))
  const selectedTables   = (result?.selectedTables || []).filter(name => tableSet.has(name))
  const suggestedVisuals = (result?.suggestedVisuals || []).filter(type => visualSet.has(type))

  return {
    selectedMeasures,
    selectedTables,
    suggestedVisuals: suggestedVisuals.length ? suggestedVisuals : ['kpi', 'bar', 'line'],
    suggestedTitle: typeof result?.suggestedTitle === 'string' && result.suggestedTitle.trim()
      ? result.suggestedTitle.trim()
      : 'Analytics Dashboard',
    needsDateDimension: !!result?.needsDateDimension,
    needsComparison: !!result?.needsComparison,
  }
}

// Extract measure names explicitly mentioned in user text.
// Uses longest-name-first matching to avoid shorter names stealing longer phrases.
function extractExplicitMeasureNames(userDescription, modelCtx) {
  const desc = String(userDescription || '').toLowerCase()
  const measures = (modelCtx?.measures || []).filter(m => !m.isHidden)
  const sorted = [...measures].sort((a, b) => b.name.length - a.name.length)
  const found = []
  for (const m of sorted) {
    if (desc.includes(m.name.toLowerCase()) && !found.includes(m.name)) {
      found.push(m.name)
    }
  }
  return found
}

// Zero-latency keyword-based context selection for local LLM (replaces Stage 1).
// Scores measures and tables by keyword overlap with the user's description so
// buildFocusedModelSummary gets a tight subset instead of the full model.
function selectLocalContext(userDescription, modelCtx) {
  const STOP_WORDS = new Set(['and','or','the','as','a','an','of','for','with','by',
    'in','to','show','get','display','create','make','build','give','me','i','want',
    'need','please','can','you','add','is','are','what','how','many','much','last'])

  const desc = String(userDescription || '').toLowerCase()
  const words = desc.split(/\W+/).filter(w => w.length > 1 && !STOP_WORDS.has(w))

  const measures = (modelCtx?.measures || []).filter(m => !m.isHidden)
  const tables   = (modelCtx?.tables   || []).filter(t => t.tableType !== 'measure_group')

  // Exact matches first
  const exactMatches = new Set(extractExplicitMeasureNames(userDescription, modelCtx))

  // Score remaining measures by keyword overlap with measure name words
  function scoreTokens(tokens) {
    let score = 0
    for (const w of words) {
      if (tokens.some(t => t.includes(w) || w.includes(t))) score++
    }
    return score
  }

  const scoredMeasures = measures.map(m => ({
    name:  m.name,
    score: exactMatches.has(m.name) ? 999 : scoreTokens(m.name.toLowerCase().split(/\W+/)),
  })).sort((a, b) => b.score - a.score)

  const scoredTables = tables.map(t => {
    const colWords = (t.columns || []).flatMap(c => c.name.toLowerCase().split(/\W+/))
    return { name: t.name, score: scoreTokens([...t.name.toLowerCase().split(/\W+/), ...colWords]) }
  }).sort((a, b) => b.score - a.score)

  const selectedMeasures = [...new Set([
    ...scoredMeasures.filter(m => m.score > 0).slice(0, 15).map(m => m.name),
    ...exactMatches,
  ])].slice(0, 15)

  const selectedTables = scoredTables.filter(t => t.score > 0).slice(0, 4).map(t => t.name)

  // Infer visual type hints from keywords
  let suggestedVisuals = ['kpi', 'bar', 'line']
  if (/trend|month|year|quarter|week|daily|over time|period/.test(desc))          suggestedVisuals = ['line', 'area']
  else if (/breakdown|split|proportion|share|percent|composition/.test(desc))     suggestedVisuals = ['donut', 'stacked_bar']
  else if (/compare|vs\b|versus|side.by.side|grouped/.test(desc))                 suggestedVisuals = ['bar', 'grouped_bar']
  else if (/kpi|total|sum|count|number|how many|how much|single|big number/.test(desc)) suggestedVisuals = ['kpi']
  else if (/top |rank|highest|lowest|best|worst/.test(desc))                       suggestedVisuals = ['bar', 'table']
  else if (/scatter|correlation|relationship between/.test(desc))                  suggestedVisuals = ['scatter']
  else if (/treemap|hierarchy|nested/.test(desc))                                  suggestedVisuals = ['treemap']
  else if (/table|grid|list/.test(desc))                                           suggestedVisuals = ['table']
  else if (/gauge|target|goal/.test(desc))                                         suggestedVisuals = ['gauge']

  const needsDateDimension = /month|year|quarter|week|daily|over time|trend|period/.test(desc)

  return {
    selectedMeasures,
    selectedTables,
    suggestedVisuals,
    suggestedTitle:     'Analytics Dashboard',
    needsDateDimension,
    needsComparison:    false,
  }
}

// ── Local programmatic AppSpec generation ─────────────────────────────────────

function findDateDimension(modelCtx, measureTableName) {
  const relations = modelCtx.relationships || []
  const relatedTables = new Set([measureTableName])
  for (const r of relations) {
    if (!r.isActive) continue
    if (r.fromTable === measureTableName) relatedTables.add(r.toTable)
    if (r.toTable   === measureTableName) relatedTables.add(r.fromTable)
  }
  const candidates = []
  for (const table of (modelCtx.tables || [])) {
    if (table.tableType === 'measure_group') continue
    for (const col of (table.columns || [])) {
      if (!col.isDate || col.isHidden) continue
      let score = 0
      if (/date|calendar|time|period/i.test(table.name)) score += 3
      if (/date|month|year|quarter|period/i.test(col.name)) score += 2
      if (relatedTables.has(table.name)) score += 1
      candidates.push({ table: table.name, column: col.name, score })
    }
  }
  if (!candidates.length) return null
  candidates.sort((a, b) => b.score - a.score)
  return { table: candidates[0].table, column: candidates[0].column }
}

function findCategoryDimension(modelCtx, measureTableName, desc) {
  const byMatch = desc.match(/\bby\s+([a-z][a-z\s]{1,30}?)(?:\s+(?:and|or|,|\.|$)|\s*$)/i)
  const byPhrase = byMatch ? byMatch[1].toLowerCase().trim() : ''

  const relations = modelCtx.relationships || []
  const relatedTables = new Set([measureTableName])
  for (const r of relations) {
    if (!r.isActive) continue
    if (r.fromTable === measureTableName) relatedTables.add(r.toTable)
    if (r.toTable   === measureTableName) relatedTables.add(r.fromTable)
  }

  const candidates = []
  for (const table of (modelCtx.tables || [])) {
    if (table.tableType === 'measure_group') continue
    for (const col of (table.columns || [])) {
      if (col.isDate || col.isKey || col.isHidden) continue
      const colLabel = (col.cleanLabel || col.name).toLowerCase()
      const colName  = col.name.toLowerCase()
      let score = 0
      if (byPhrase) {
        if (colLabel === byPhrase || colName === byPhrase) score += 4
        else if (colLabel.includes(byPhrase) || byPhrase.includes(colLabel)) score += 3
        else if (colName.includes(byPhrase) || byPhrase.includes(colName)) score += 2
      }
      if (relatedTables.has(table.name)) score += 1
      if (col.isCategory) score += 1
      if (/string|text|varchar/i.test(col.dataType || '')) score += 1
      if (score > 0) candidates.push({ table: table.name, column: col.name, score })
    }
  }
  if (!candidates.length) return null
  candidates.sort((a, b) => b.score - a.score)
  return { table: candidates[0].table, column: candidates[0].column }
}

function generateLocalTitle(measureNames, visualType) {
  const base = measureNames.length === 1 ? measureNames[0]
    : measureNames.length === 2 ? `${measureNames[0]} & ${measureNames[1]}`
    : `${measureNames[0]} & more`
  if (visualType === 'line' || visualType === 'area')        return `${base} Trend`
  if (visualType === 'bar' || visualType === 'column')       return `${base} by Category`
  if (visualType === 'donut' || visualType === 'pie')        return `${base} Breakdown`
  return base
}

function buildLocalAppSpec(userDescription, modelCtx, stage1Result) {
  if (!modelCtx || !stage1Result) return null

  // Prefer measures explicitly named in the prompt; fall back to keyword-scored list (capped at 1).
  // This prevents "show Total Revenue as a KPI" from producing 4 KPI cards because the scorer
  // found 4 high-scoring measures.
  const explicitMatches = extractExplicitMeasureNames(userDescription, modelCtx)
    .filter(name => (modelCtx.measures || []).find(m => m.name === name && !m.isHidden))

  const measures = explicitMatches.length > 0
    ? explicitMatches
    : (stage1Result.selectedMeasures || [])
        .filter(name => (modelCtx.measures || []).find(m => m.name === name && !m.isHidden))
        .slice(0, 1)

  if (!measures.length) return null

  const primaryMeasure    = measures[0]
  const primaryMeasureObj = (modelCtx.measures || []).find(m => m.name === primaryMeasure) || {}
  const measureTableName  = primaryMeasureObj.table || ''

  const desc = (userDescription || '').toLowerCase()

  const isTimeTrend = stage1Result.needsDateDimension
    || /\b(trend|over time|by month|monthly|by quarter|quarterly|by year|yearly|by week|weekly|by day|daily|timeline|per month|per quarter|per year)\b/.test(desc)

  const isDonut = /\b(breakdown|proportion|share|percent|distribution|pie|donut)\b/.test(desc)

  const isBarOrCategory = !isTimeTrend && !isDonut && (
    /\bby\s+[a-z]/.test(desc)
    || /\b(compare|top \d|ranking|highest|lowest|split|bar|column)\b/.test(desc)
    || (stage1Result.suggestedVisuals || []).some(v => v === 'bar' || v === 'column')
  )

  const isKPI = !isTimeTrend && !isDonut && !isBarOrCategory

  let visualType, groupBy = null, limit = null

  if (isKPI) {
    visualType = 'kpi'
  } else if (isTimeTrend) {
    visualType = 'line'
    groupBy    = findDateDimension(modelCtx, measureTableName)
    if (!groupBy) return null
  } else if (isDonut) {
    visualType = 'donut'
    groupBy    = findCategoryDimension(modelCtx, measureTableName, desc)
    if (!groupBy) return null
    limit = 8
  } else if (isBarOrCategory) {
    visualType = 'bar'
    groupBy    = findCategoryDimension(modelCtx, measureTableName, desc)
    if (!groupBy) return null
    limit = 15
  } else {
    return null
  }

  let visuals
  if (visualType === 'kpi') {
    const kpiCount = Math.min(measures.length, 4)
    const widths   = [12, 6, 4, 3]
    const w        = widths[kpiCount - 1] || 3
    visuals = measures.slice(0, 4).map((name, i) => ({
      id:       `visual_${i + 1}`,
      type:     'kpi',
      position: { x: i * w, y: 0, w, h: 2 },
      data:     { measures: [name], groupBy: null, filters: [], orderBy: 'desc', limit: null },
      config:   { title: name, showTrend: false, animationPreset: 'fade' },
    }))
  } else if (visualType === 'line') {
    visuals = [{
      id:       'visual_1',
      type:     'line',
      position: { x: 0, y: 0, w: 12, h: 4 },
      data:     { measures, groupBy, filters: [], orderBy: null, limit: null },
      config:   { title: generateLocalTitle(measures, 'line'), smooth: true, showDots: false, dataLabels: false },
    }]
  } else if (visualType === 'donut') {
    visuals = [{
      id:       'visual_1',
      type:     'donut',
      position: { x: 0, y: 0, w: 6, h: 4 },
      data:     { measures: [primaryMeasure], groupBy, filters: [], orderBy: 'desc', limit },
      config:   { title: generateLocalTitle([primaryMeasure], 'donut'), innerRadius: 60, legendPosition: 'right', showLabels: true },
    }]
  } else {
    visuals = [{
      id:       'visual_1',
      type:     'bar',
      position: { x: 0, y: 0, w: 12, h: 4 },
      data:     { measures: [primaryMeasure], groupBy, filters: [], orderBy: 'desc', limit },
      config:   { title: generateLocalTitle([primaryMeasure], 'bar') },
    }]
  }

  const dashboardTitle = stage1Result.suggestedTitle && stage1Result.suggestedTitle !== 'Analytics Dashboard'
    ? stage1Result.suggestedTitle
    : generateLocalTitle(measures, visualType)

  return {
    version:     '1.0',
    title:       dashboardTitle,
    theme:       { mode: 'dark', primaryColor: '#3B82F6', fontFamily: 'Inter' },
    layout:      { columns: 12, rowHeight: 80, gap: 8 },
    visuals,
    slicers:     [],
    connections: [],
    warnings:    [],
  }
}

const LOCAL_COLOR_MAP = {
  gold: '#F59E0B', golden: '#F59E0B', yellow: '#EAB308',
  blue: '#3B82F6', navy: '#1E40AF', sky: '#0EA5E9',
  red: '#EF4444', crimson: '#DC2626', rose: '#F43F5E',
  green: '#22C55E', emerald: '#10B981', lime: '#84CC16',
  purple: '#8B5CF6', violet: '#7C3AED', indigo: '#6366F1',
  orange: '#F97316', amber: '#F59E0B',
  pink: '#EC4899', magenta: '#D946EF',
  cyan: '#06B6D4', teal: '#14B8A6',
  white: '#F8FAFC', gray: '#64748B', grey: '#64748B', black: '#0F172A', slate: '#475569',
  silver: '#94A3B8', brown: '#92400E',
}

function patchLocalAppSpec(userDescription, currentSpec, modelCtx) {
  if (!currentSpec || !modelCtx) return null
  const desc = (userDescription || '').toLowerCase()

  // ── Pattern 1: Add a new visual ────────────────────────────────────────────
  if (/\b(add|include|put|insert|also show|and add|append)\b/.test(desc)) {
    const explicitMatches = extractExplicitMeasureNames(userDescription, modelCtx)
      .filter(name => (modelCtx.measures || []).find(m => m.name === name && !m.isHidden))
    if (explicitMatches.length) {
      const primaryMeasure    = explicitMatches[0]
      const primaryMeasureObj = (modelCtx.measures || []).find(m => m.name === primaryMeasure) || {}
      const measureTableName  = primaryMeasureObj.table || ''

      const isTimeTrend = /\b(trend|over time|by month|monthly|by quarter|quarterly|by year|yearly|by week|weekly|by day|daily|per month|per quarter|per year)\b/.test(desc)
      const isDonut     = /\b(breakdown|proportion|share|percent|distribution|pie|donut)\b/.test(desc)
      const isBar       = !isTimeTrend && !isDonut && (/\bby\s+[a-z]/.test(desc) || /\b(bar|column|compare|ranking)\b/.test(desc))

      let visualType, groupBy = null, limit = null
      if (isTimeTrend) {
        visualType = 'line'
        groupBy    = findDateDimension(modelCtx, measureTableName)
        if (!groupBy) return null
      } else if (isDonut) {
        visualType = 'donut'
        groupBy    = findCategoryDimension(modelCtx, measureTableName, desc)
        if (!groupBy) return null
        limit = 8
      } else if (isBar) {
        visualType = 'bar'
        groupBy    = findCategoryDimension(modelCtx, measureTableName, desc)
        if (!groupBy) return null
        limit = 15
      } else {
        visualType = 'kpi'
      }

      const existingVisuals = currentSpec.visuals || []
      const maxY = existingVisuals.reduce((max, v) =>
        Math.max(max, (v.position?.y || 0) + (v.position?.h || 2)), 0)
      const newId = `visual_${existingVisuals.length + 1}`

      let newVisual
      if (visualType === 'kpi') {
        newVisual = {
          id: newId, type: 'kpi',
          position: { x: 0, y: maxY, w: 4, h: 2 },
          data:   { measures: [primaryMeasure], groupBy: null, filters: [], orderBy: 'desc', limit: null },
          config: { title: primaryMeasure, showTrend: false, animationPreset: 'fade' },
        }
      } else if (visualType === 'line') {
        newVisual = {
          id: newId, type: 'line',
          position: { x: 0, y: maxY, w: 12, h: 4 },
          data:   { measures: explicitMatches, groupBy, filters: [], orderBy: null, limit: null },
          config: { title: generateLocalTitle(explicitMatches, 'line'), smooth: true, showDots: false, dataLabels: false },
        }
      } else if (visualType === 'donut') {
        newVisual = {
          id: newId, type: 'donut',
          position: { x: 0, y: maxY, w: 6, h: 4 },
          data:   { measures: [primaryMeasure], groupBy, filters: [], orderBy: 'desc', limit },
          config: { title: generateLocalTitle([primaryMeasure], 'donut'), innerRadius: 60, legendPosition: 'right', showLabels: true },
        }
      } else {
        newVisual = {
          id: newId, type: 'bar',
          position: { x: 0, y: maxY, w: 12, h: 4 },
          data:   { measures: [primaryMeasure], groupBy, filters: [], orderBy: 'desc', limit },
          config: { title: generateLocalTitle([primaryMeasure], 'bar') },
        }
      }
      return { ...currentSpec, visuals: [...existingVisuals, newVisual] }
    }
  }

  // ── Pattern 2: Remove a visual ─────────────────────────────────────────────
  if (/\b(remove|delete|hide|take out|get rid of)\b/.test(desc)) {
    const VISUAL_TYPES = ['kpi', 'bar', 'column', 'line', 'area', 'donut', 'pie', 'table', 'scatter', 'gauge', 'stat_card', 'metric_tile']
    const typeMatch = VISUAL_TYPES.find(t => new RegExp(`\\b${t}\\b`).test(desc))
    if (typeMatch) {
      const remaining = (currentSpec.visuals || []).filter(v => v.type !== typeMatch)
      if (remaining.length < (currentSpec.visuals || []).length) {
        return { ...currentSpec, visuals: remaining }
      }
    }
  }

  // ── Pattern 3: Color / style change ────────────────────────────────────────
  const colorKey = Object.keys(LOCAL_COLOR_MAP).find(c => new RegExp(`\\b${c}\\b`).test(desc))
  if (colorKey && /\b(make|change|set|color|colour|turn|use)\b/.test(desc)) {
    const colorHex = LOCAL_COLOR_MAP[colorKey]
    const VISUAL_TYPES = ['kpi', 'bar', 'column', 'line', 'area', 'donut', 'pie', 'table', 'scatter', 'gauge', 'stat_card', 'metric_tile']
    const typeMatch = VISUAL_TYPES.find(t => new RegExp(`\\b${t}\\b`).test(desc))

    const target = typeMatch
      ? (currentSpec.visuals || []).find(v => v.type === typeMatch)
      : (currentSpec.visuals || []).length === 1 ? currentSpec.visuals[0] : null

    if (target) {
      const updatedVisuals = (currentSpec.visuals || []).map(v =>
        v.id !== target.id ? v
          : { ...v, config: { ...(v.config || {}), colorScheme: colorHex, titleColor: colorHex } }
      )
      return { ...currentSpec, visuals: updatedVisuals }
    }
  }

  return null
}

// ── App Spec post-processing ───────────────────────────────────────────────────

const SIZE_LIMITS = {
  kpi:          { maxW: 12, maxH: 4,  minW: 1, minH: 1 },
  stat_card:    { maxW: 12, maxH: 4,  minW: 1, minH: 1 },
  metric_tile:  { maxW: 6,  maxH: 4,  minW: 1, minH: 1 },
  sparkline_kpi:{ maxW: 6,  maxH: 4,  minW: 1, minH: 1 },
  gauge:        { maxW: 6,  maxH: 4,  minW: 1, minH: 1 },
  bullet:       { maxW: 12, maxH: 4,  minW: 2, minH: 1 },
  progress:     { maxW: 12, maxH: 4,  minW: 2, minH: 1 },
  donut:        { maxW: 5,  maxH: 3,  minW: 3, minH: 3 },
  pie:          { maxW: 5,  maxH: 3,  minW: 3, minH: 3 },
  sunburst:     { maxW: 6,  maxH: 4,  minW: 3, minH: 3 },
  waffle:       { maxW: 6,  maxH: 4,  minW: 3, minH: 3 },
  bar:          { maxW: 12, maxH: 5,  minW: 4, minH: 3 },
  column:       { maxW: 12, maxH: 5,  minW: 4, minH: 3 },
  stacked_bar:  { maxW: 12, maxH: 5,  minW: 4, minH: 3 },
  grouped_bar:  { maxW: 12, maxH: 5,  minW: 4, minH: 3 },
  lollipop:     { maxW: 12, maxH: 5,  minW: 4, minH: 3 },
  waterfall:    { maxW: 12, maxH: 5,  minW: 4, minH: 3 },
  line:         { maxW: 12, maxH: 4,  minW: 4, minH: 3 },
  area:         { maxW: 12, maxH: 4,  minW: 4, minH: 3 },
  stacked_area: { maxW: 12, maxH: 4,  minW: 4, minH: 3 },
  slope:        { maxW: 8,  maxH: 4,  minW: 4, minH: 3 },
  bump:         { maxW: 12, maxH: 4,  minW: 4, minH: 3 },
  bar_race:     { maxW: 12, maxH: 6,  minW: 4, minH: 4 },
  radar:        { maxW: 6,  maxH: 4,  minW: 3, minH: 3 },
  scatter:      { maxW: 8,  maxH: 4,  minW: 3, minH: 3 },
  bubble:       { maxW: 8,  maxH: 4,  minW: 3, minH: 3 },
  treemap:      { maxW: 8,  maxH: 4,  minW: 3, minH: 3 },
  heatmap:      { maxW: 8,  maxH: 4,  minW: 3, minH: 3 },
  funnel:       { maxW: 6,  maxH: 4,  minW: 3, minH: 3 },
  chord:        { maxW: 8,  maxH: 4,  minW: 4, minH: 3 },
  sankey:       { maxW: 12, maxH: 6,  minW: 4, minH: 4 },
  table:        { maxW: 12, maxH: 6,  minW: 4, minH: 3 },
  ranked_list:  { maxW: 6,  maxH: 5,  minW: 3, minH: 3 },
  narrative:    { maxW: 12, maxH: 4,  minW: 4, minH: 2 },
  insight:      { maxW: 12, maxH: 4,  minW: 4, minH: 2 },
}

// ── Time-axis grounding helpers ───────────────────────────────────────────────

// Extracts explicit Table[Column] references from user description text.
function extractExplicitFieldRefs(userDescription) {
  const refs = []
  const rx = /([A-Za-z][A-Za-z0-9 _]*)\[([^\]]+)\]/g
  let m
  while ((m = rx.exec(userDescription || '')) !== null) {
    refs.push({ table: m[1].trim(), column: m[2].trim() })
  }
  return refs
}

// True when a column name sounds like a time/date dimension column.
function looksLikeTimeColumn(columnName) {
  if (!columnName) return false
  const n = columnName.toLowerCase()
  return /\b(year|month|quarter|week|day|date|fiscal|period|calend)\b/.test(n)
}

// Returns coarse grain implied by column name: 'year' | 'quarter' | 'month' | 'week' | 'date' | null
function getTimeGrain(columnName) {
  if (!columnName) return null
  const n = columnName.toLowerCase()
  if (/\byear\b/.test(n))    return 'year'
  if (/\bquarter\b/.test(n)) return 'quarter'
  if (/\bmonth\b/.test(n))   return 'month'
  if (/\bweek\b/.test(n))    return 'week'
  if (/\bdate\b|\bday\b/.test(n)) return 'date'
  return null
}

// True when a table has at least one active relationship in the model context.
function tableHasActiveRelationships(tableName, modelCtx) {
  if (!modelCtx?.relationships) return false
  return modelCtx.relationships.some(r =>
    r.isActive !== false &&
    (r.fromTable === tableName || r.toTable === tableName)
  )
}

// Given a groupBy column name (e.g. "Year"), find a matching column in a date/calendar
// table that is actively connected to other tables. Returns { table, column } or null.
function findConnectedTimeColumnMatch(columnName, modelCtx) {
  if (!modelCtx?.tables) return null
  const grain = getTimeGrain(columnName)
  if (!grain) return null

  const candidateTables = modelCtx.tables.filter(t => {
    const tn = t.name.toLowerCase()
    return /date|calendar|time|dim_date|dimdate|fiscal/.test(tn) &&
      tableHasActiveRelationships(t.name, modelCtx)
  })

  for (const t of candidateTables) {
    const cols = (t.columns || []).filter(c => !c.isHidden)
    const match = cols.find(c => {
      const cn = c.name.toLowerCase()
      switch (grain) {
        case 'year':    return /\byear\b/.test(cn)
        case 'quarter': return /\bquarter\b/.test(cn)
        case 'month':   return /\bmonth\b/.test(cn)
        case 'week':    return /\bweek\b/.test(cn)
        case 'date':    return /\bdate\b|\bday\b/.test(cn)
        default:        return false
      }
    })
    if (match) return { table: t.name, column: match.name }
  }
  return null
}

// Repairs time-dimension groupBy fields in generated visuals.
// Priority: explicit Table[Column] in user text → connected date-table column → original (no change).
function repairTimeGroupBy(spec, userDescription, modelCtx) {
  if (!spec?.visuals || !modelCtx) return spec

  const explicitRefs = extractExplicitFieldRefs(userDescription)

  const visuals = spec.visuals.map(v => {
    const gby = v.data?.groupBy
    if (!gby?.table || !gby?.column) return v

    // 1. If user explicitly wrote Table[Column] for this column → honour it
    const exactMatch = explicitRefs.find(r => r.table === gby.table && r.column === gby.column)
    if (exactMatch) return v

    // 2. If groupBy column looks temporal and its table has no active relationships,
    //    try to find a better connected match
    if (looksLikeTimeColumn(gby.column) && !tableHasActiveRelationships(gby.table, modelCtx)) {
      const better = findConnectedTimeColumnMatch(gby.column, modelCtx)
      if (better) {
        console.log(`[llm] repairTimeGroupBy: ${v.id} ${gby.table}[${gby.column}] → ${better.table}[${better.column}]`)
        return { ...v, data: { ...v.data, groupBy: better } }
      }
    }

    return v
  })

  return { ...spec, visuals }
}

// Conservative side-by-side repair for generated specs.
// If the user asked for "side by side" / "beside" / "left and right" and the AI
// placed two adjacent non-KPI visuals on separate y-rows, merge them into one row.
// Only fires when exactly 2 non-KPI visuals exist and the user's intent is clear.
function repairSideBySide(spec, userDescription) {
  if (!spec?.visuals || !userDescription) return spec
  const desc = userDescription.toLowerCase()
  const hasSideBySideIntent = /side.?by.?side|beside|\bleft.{0,6}right\b|next to|bar.{0,8}donut|chart.{0,8}table|bar.{0,8}table|line.{0,8}table|donut.{0,8}bar/.test(desc)
  if (!hasSideBySideIntent) return spec

  const nonKpi = spec.visuals.filter(v => v.type !== 'kpi')
  // Only repair when exactly 2 non-KPI visuals — conservative scope
  if (nonKpi.length !== 2) return spec

  const [a, b] = nonKpi
  const ay = Math.round(a.position?.y ?? 0)
  const by = Math.round(b.position?.y ?? 0)

  // Already on the same row — no repair needed
  if (ay === by && (a.position?.x ?? 0) !== (b.position?.x ?? 0)) return spec

  // Determine widths based on visual type pairing
  let wA = 6, wB = 6
  const smallTypes = new Set(['donut', 'gauge', 'table'])
  if (smallTypes.has(b.type) && !smallTypes.has(a.type)) {
    wA = 8; wB = 4
  } else if (smallTypes.has(a.type) && !smallTypes.has(b.type)) {
    wA = 4; wB = 8
  }

  // Find the y for the first non-KPI row (preserve KPI placement)
  const targetY = Math.min(ay, by)

  const repaired = spec.visuals.map(v => {
    if (v === a) return { ...v, position: { ...v.position, x: 0, y: targetY, w: wA } }
    if (v === b) return { ...v, position: { ...v.position, x: wA, y: targetY, w: wB } }
    return v
  })
  console.log(`[llm] repairSideBySide: placed ${a.id}(w:${wA}) + ${b.id}(w:${wB}) on y:${targetY}`)
  return { ...spec, visuals: repaired }
}

// Repairs stacked_bar visuals: ensures 2 measures exist, or downgrades to bar.
// Scans user text for explicitly mentioned measure names to restore missing ones.
function repairStackedBar(spec, userDescription, modelCtx) {
  if (!spec?.visuals) return spec
  const allMeasures = (modelCtx?.measures || []).filter(m => !m.isHidden)
  const measureSet = new Set(allMeasures.map(m => m.name))
  const wantsStackedBar = /\bstacked\s+bar\b|\bstacked\s+comparison\b|\bcomposition by category\b/i.test(userDescription || '')

  const explicitMeasures = extractExplicitMeasureNames(userDescription, modelCtx)

  const visuals = spec.visuals.map(v => {
    const currentMeasures = Array.isArray(v.data?.measures) ? v.data.measures.filter(m => measureSet.has(m)) : []
    const canUpgradeBar =
      wantsStackedBar &&
      v.type === 'bar' &&
      !!v.data?.groupBy &&
      (currentMeasures.length === 0 || currentMeasures.some(m => explicitMeasures.includes(m)))

    if (v.type !== 'stacked_bar' && !canUpgradeBar) return v

    let measures = currentMeasures

    // Already has 2+ valid measures — keep first 2
    if (measures.length >= 2) {
      return {
        ...v,
        type: 'stacked_bar',
        data: { ...v.data, measures: measures.slice(0, 2) }
      }
    }

    // < 2 measures — try to build from user's explicit mentions
    if (explicitMeasures.length >= 2) {
      // Use the first two distinct user-mentioned measures
      const restored = []
      for (const m of explicitMeasures) {
        if (!restored.includes(m)) restored.push(m)
        if (restored.length >= 2) break
      }
      if (restored.length >= 2) {
        console.log(`[llm] repairStackedBar: restored measures [${restored.join(', ')}] for ${v.id}`)
        return {
          ...v,
          type: 'stacked_bar',
          data: { ...v.data, measures: restored }
        }
      }
    }

    // Still < 2 — if we have 1, try to find ANY second user-mentioned measure
    if (measures.length === 1 && explicitMeasures.length >= 1) {
      const second = explicitMeasures.find(m => m !== measures[0])
      if (second) {
        console.log(`[llm] repairStackedBar: added second measure "${second}" for ${v.id}`)
        return {
          ...v,
          type: 'stacked_bar',
          data: { ...v.data, measures: [measures[0], second] }
        }
      }
    }

    // Can't get 2 valid measures — downgrade to bar
    console.log(`[llm] repairStackedBar: downgrading ${v.id} to bar (only ${measures.length} valid measures)`)
    return { ...v, type: 'bar', data: { ...v.data, measures: measures.length ? measures : v.data?.measures } }
  })

  return { ...spec, visuals }
}

// ── Slicer dimension validation helpers ──────────────────────────────────────

// True when a column name looks like a surrogate/foreign key that makes a poor slicer.
function looksLikeBadSlicerColumn(name) {
  if (!name) return true
  // Surrogate keys end in "Key" (ProductKey, DateKey, CustomerKey)
  if (/Key$/i.test(name)) return true
  // Short ID columns (OrderID, ProductId) — threshold 14 avoids false positives like CalendarYearID
  if (/Id$/i.test(name) && name.length <= 14) return true
  return false
}

// True when a { table, column } dimension is safe to use as a slicer.
// Uses model context when available for existence + type checks; otherwise shape-only.
function isValidSlicerDimension(dim, modelCtx) {
  if (!dim?.table || !dim?.column) return false
  if (looksLikeBadSlicerColumn(dim.column)) return false
  if (!modelCtx?.tables) return true  // no context — accept shape-valid dims
  const table = modelCtx.tables.find(t => t.name === dim.table)
  if (!table) return false  // table does not exist in the model
  const col = (table.columns || []).find(c => c.name === dim.column)
  if (!col) return false   // column does not exist
  // Reject purely numeric columns (not useful as slicer categories)
  if (col.dataType === 'Int64' || col.dataType === 'Double' || col.dataType === 'Decimal') return false
  return true
}

function sanitizeAppSpec(spec) {
  if (!spec?.visuals) return spec
  const wasFreeform = spec.layout?.freeform === true
  spec.layout = { columns: 12, rowHeight: 80, gap: 8, ...(spec.layout || {}) }
  spec.layout.columns = 12
  spec.layout.rowHeight = 80
  spec.layout.gap = 8
  // Preserve freeform flag
  if (wasFreeform) spec.layout.freeform = true
  const cols = spec.layout.columns

  spec.visuals = spec.visuals.map(v => {
    const limits = SIZE_LIMITS[v.type] || { maxW: 12, maxH: 6, minW: 2, minH: 2 }
    const pos    = { ...(v.position || { x: 0, y: 0, w: 3, h: 3 }) }
    // In freeform mode, skip clamping so user can resize freely
    if (!wasFreeform) {
      if (pos.h > limits.maxH) pos.h = limits.maxH
      if (pos.h < limits.minH) pos.h = limits.minH
      if (pos.w > limits.maxW) pos.w = limits.maxW
      if (pos.w < limits.minW) pos.w = limits.minW
      if (pos.x + pos.w > cols) pos.x = Math.max(0, cols - pos.w)
      if (pos.x < 0) pos.x = 0
    } else {
      // Still clamp to canvas bounds
      if (pos.x < 0) pos.x = 0
      if (pos.y < 0) pos.y = 0
      if (pos.w < 0.5) pos.w = 0.5
      if (pos.h < 0.5) pos.h = 0.5
    }
    return { ...v, position: pos }
  })

  const modelCtx = global.semanticaModelContext || null

  const seenDims = new Set()
  spec.slicers = (spec.slicers || []).map(s => {
    const pos = { ...(s.position || { x: 0, y: 0, w: 4, h: 1 }) }
    pos.h = 1
    if (!pos.w || pos.w < 2) pos.w = 4
    if (pos.w > cols) pos.w = cols
    if (pos.x + pos.w > cols) pos.x = 0
    if (pos.x < 0) pos.x = 0

    // Repair dimension: model sometimes emits "Table[Column]" string instead of object
    let dim = s.dimension
    if (typeof dim === 'string') {
      const m = dim.match(/^(.+)\[([^\]]+)\]$/)
      dim = m ? { table: m[1].trim(), column: m[2].trim() } : null
    }

    // Repair affects: missing → "all"
    const affects = s.affects != null ? s.affects : 'all'

    // Repair type: unknown value → dropdown
    const validTypes = ['dropdown', 'buttons', 'date_range']
    const type = validTypes.includes(s.type) ? s.type : 'dropdown'

    return { ...s, dimension: dim, affects, type, position: pos }
  }).filter(s => {
    // Drop slicers with missing or structurally bad dimensions
    if (!isValidSlicerDimension(s.dimension, modelCtx)) return false
    // Drop duplicates on the same table[column]
    const key = `${s.dimension.table}[${s.dimension.column}]`
    if (seenDims.has(key)) return false
    seenDims.add(key)
    return true
  })

  return spec
}

function reflowLayout(spec) {
  // In freeform mode, preserve all positions as-is
  if (spec.layout?.freeform) return spec
  const cols = spec.layout?.columns || 12
  const visuals = spec.visuals || []
  const slicers = spec.slicers || []

  // ── Place slicers first in dedicated rows ──────────
  let currentY = 0
  const placedSlicers = []

  const sortedSlicers = [...slicers].sort((a, b) =>
    (a.position?.y || 0) - (b.position?.y || 0)
  )

  for (const slicer of sortedSlicers) {
    placedSlicers.push({
      ...slicer,
      position: {
        ...slicer.position,
        y: currentY,
        h: 1
      }
    })
    currentY += 1
  }

  // ── Group visuals by original y value ─────────────
  const sorted = [...visuals].sort((a, b) => {
    const ay = a.position?.y || 0
    const by2 = b.position?.y || 0
    return ay !== by2 ? ay - by2 : (a.position?.x || 0) - (b.position?.x || 0)
  })

  const rowMap = new Map()
  for (const v of sorted) {
    const y = Math.round(v.position?.y || 0)
    if (!rowMap.has(y)) rowMap.set(y, [])
    rowMap.get(y).push(v)
  }
  const rawRows = Array.from(rowMap.values())

  // ── Merge consecutive KPI-only rows ───────────────
  const mergedRows = []
  let kpiBuffer = []

  for (const row of rawRows) {
    const allKpi = row.every(v => v.type === 'kpi')
    if (allKpi) {
      kpiBuffer.push(...row)
    } else {
      if (kpiBuffer.length > 0) {
        mergedRows.push(kpiBuffer)
        kpiBuffer = []
      }
      mergedRows.push(row)
    }
  }
  if (kpiBuffer.length > 0) mergedRows.push(kpiBuffer)

  // ── Place rows sequentially ───────────────────────
  const placedVisuals = []

  for (const row of mergedRows) {
    const rowH = Math.max(...row.map(v => v.position?.h || 2))
    const totalW = row.reduce((s, v) => s + (v.position?.w || 3), 0)
    let rowX = 0

    if (totalW <= cols) {
      // Fits — place as-is with correct x positions
      for (const v of row) {
        placedVisuals.push({
          ...v,
          position: { ...v.position, x: rowX, y: currentY }
        })
        rowX += v.position.w
      }
    } else {
      // Too wide — distribute evenly
      const evenW = Math.floor(cols / row.length)
      for (let i = 0; i < row.length; i++) {
        const v = row[i]
        const w = i === row.length - 1 ? cols - rowX : evenW
        placedVisuals.push({
          ...v,
          position: { ...v.position, x: rowX, y: currentY, w }
        })
        rowX += w
      }
    }

    currentY += rowH
  }

  return {
    ...spec,
    visuals: placedVisuals,
    slicers: placedSlicers
  }
}

function getValueAtPointer(root, pathParts) {
  let current = root
  for (const part of pathParts) {
    if (current == null) return undefined
    if (Array.isArray(current)) {
      const index = Number(part)
      if (!Number.isInteger(index)) return undefined
      current = current[index]
    } else {
      current = current[part]
    }
  }
  return current
}

function collectMeasureNamesFromValue(value, acc = []) {
  if (Array.isArray(value)) {
    value.forEach(item => collectMeasureNamesFromValue(item, acc))
    return acc
  }
  if (!value || typeof value !== 'object') return acc
  if (Array.isArray(value.measures)) {
    for (const name of value.measures) {
      if (typeof name === 'string') acc.push(name)
    }
  }
  for (const nested of Object.values(value)) collectMeasureNamesFromValue(nested, acc)
  return acc
}

function validatePatchOperations(currentSpec, patches, measureNames) {
  const measureSet = new Set(measureNames || [])
  const valid = []
  for (const patch of patches || []) {
    if (!patch || !['add', 'replace', 'remove'].includes(patch.op) || typeof patch.path !== 'string' || !patch.path.startsWith('/')) continue

    const parts = patch.path.split('/').filter(Boolean)
    const parentParts = parts.slice(0, -1)
    const lastPart = parts[parts.length - 1]
    const parent = parentParts.length ? getValueAtPointer(currentSpec, parentParts) : currentSpec
    if (parent == null) continue

    if (patch.op === 'remove') {
      if (getValueAtPointer(currentSpec, parts) === undefined) continue
    }
    // For replace: allow setting new config properties (upsert behavior)
    // Only reject if the PARENT doesn't exist (i.e. the visual/config object itself)
    if (patch.op === 'replace') {
      if (parent == null) continue
      // If property doesn't exist yet, treat as add (upsert)
      if (getValueAtPointer(currentSpec, parts) === undefined) {
        patch.op = 'add'
      }
    }

    if (patch.op === 'add' && Array.isArray(parent) && lastPart !== '-') {
      const index = Number(lastPart)
      if (!Number.isInteger(index) || index < 0 || index > parent.length) continue
    }

    const referencedMeasures = patch.path.includes('/data/measures')
      ? (Array.isArray(patch.value) ? patch.value : [patch.value])
      : collectMeasureNamesFromValue(patch.value, [])
    if (referencedMeasures.some(name => typeof name !== 'string' || !measureSet.has(name))) {
      continue
    }

    valid.push(patch)
  }
  return valid
}

function applyJsonPatch(spec, patches) {
  const result = JSON.parse(JSON.stringify(spec))
  for (const patch of patches || []) {
    const parts = String(patch.path || '').split('/').filter(Boolean)
    const parentParts = parts.slice(0, -1)
    const lastPart = parts[parts.length - 1]
    const parent = parentParts.length ? getValueAtPointer(result, parentParts) : result
    if (parent == null) continue

    if (patch.op === 'replace') {
      if (Array.isArray(parent)) {
        const index = Number(lastPart)
        if (Number.isInteger(index) && index >= 0 && index < parent.length) parent[index] = patch.value
      } else {
        parent[lastPart] = patch.value
      }
    } else if (patch.op === 'add') {
      if (Array.isArray(parent)) {
        if (lastPart === '-') parent.push(patch.value)
        else {
          const index = Number(lastPart)
          if (Number.isInteger(index) && index >= 0 && index <= parent.length) parent.splice(index, 0, patch.value)
        }
      } else {
        parent[lastPart] = patch.value
      }
    } else if (patch.op === 'remove') {
      if (Array.isArray(parent)) {
        const index = Number(lastPart)
        if (Number.isInteger(index) && index >= 0 && index < parent.length) parent.splice(index, 1)
      } else {
        delete parent[lastPart]
      }
    }
  }
  return result
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

function register() {

  // Set up DAX self-healing repair function accessible to query.js
  // Uses Groq Llama (fast) if configured, else Claude Haiku, else disabled
  ;(async () => {
    const groqKey    = getKey('groq')
    const claudeKey  = getKey('anthropic')
    if (groqKey) {
      global.semanticaDaxRepairFn = async (repairPrompt) => {
        const res = await generateWithGroq(repairPrompt, groqKey, 'llama-3.3-70b-versatile', 400)
        // repair response is raw DAX, not JSON — extract it
        return typeof res.config === 'string' ? res.config : JSON.stringify(res.config)
      }
      console.log('[llm] DAX repair function set (Groq)')
    } else if (claudeKey) {
      global.semanticaDaxRepairFn = async (repairPrompt) => {
        const res = await generateWithClaude(repairPrompt, claudeKey, 'claude-haiku-4-5-20251001', 400)
        return typeof res.config === 'string' ? res.config : JSON.stringify(res.config)
      }
      console.log('[llm] DAX repair function set (Claude Haiku)')
    } else {
      console.log('[llm] No AI key available — DAX self-healing disabled')
    }
  })()

  // Playground Spike (Phase 7) — generate/refine a .vilsem-visual template.
  // Reuses the existing BYO-key client verbatim: selectGenerationProvider gives
  // the same provider selection / key handling / no-key guard; callAnyProvider
  // gives the same retry+fallback. The caller supplies its OWN system prompt
  // (playgroundAI.js) so this never entangles with the canvas generation prompt.
  ipcMain.handle('generate-custom-template', async (_e, { system, user, provider, model }) => {
    if (!system || !user) throw new Error('system and user prompts are required')
    const providerConfig = selectGenerationProvider(provider, model) // throws if no key configured (same guard)
    const result = await callAnyProvider(providerConfig, user, system, 4000)
    // result.config is the parsed JSON (parseAiResponse already stripped fences);
    // a non-JSON response makes callAnyProvider throw → handled by the renderer.
    return { template: result.config, provider: result.actualProvider, model: result.actualModel, usage: result.usage }
  })

  ipcMain.handle('save-ai-key', async (_e, { provider, apiKey }) => {
    const test = await testApiKey(provider, apiKey)
    if (!test.valid) throw new Error(test.error || 'Invalid API key')
    await saveKey(provider, apiKey)
    return { saved: true }
  })

  ipcMain.handle('test-ai-key', async (_e, { provider, apiKey }) => {
    return await testApiKey(provider, apiKey)
  })

  ipcMain.handle('remove-ai-key', async (_e, { provider }) => {
    await deleteKey(provider)
    return { removed: true }
  })

  ipcMain.handle('get-ai-status', async () => {
    const claudeKey       = getKey('anthropic')
    const openaiKey       = getKey('openai')
    const groqKey         = getKey('groq')
    const geminiKey       = getKey('gemini')
    const defaultProvider = getKey('default-provider') || 'anthropic'
    const claudeModel     = getKey('anthropic-model') || 'claude-sonnet-4-6'
    const openaiModel     = getKey('openai-model') || 'gpt-4o'
    const groqModel       = getKey('groq-model') || 'llama-3.3-70b-versatile'
    const geminiModel     = getKey('gemini-model') || 'gemini-2.5-flash-preview-05-20'
    const geminiModels    = geminiKey ? await fetchGeminiModels(geminiKey) : GEMINI_MODELS
    const groqModels      = groqKey ? await fetchGroqModels(groqKey) : GROQ_MODELS
    const localLlm        = require('./localLlm')
    const localStatus     = localLlm.getStatus()
    return {
      claude:           { configured: !!claudeKey },
      openai:           { configured: !!openaiKey },
      groq:             { configured: !!groqKey },
      gemini:           { configured: !!geminiKey },
      local:            { configured: localStatus.modelPresent, running: localStatus.running },
      anyConfigured:    !!(claudeKey || openaiKey || groqKey || geminiKey || localStatus.modelPresent),
      defaultProvider,
      claudeModel, openaiModel, groqModel, geminiModel,
      anthropicModels:  ANTHROPIC_MODELS,
      openaiModels:     OPENAI_MODELS,
      groqModels,
      geminiModels,
      localModels:      LOCAL_MODELS,
    }
  })

  ipcMain.handle('get-gemini-models', async () => {
    const geminiKey = getKey('gemini')
    return geminiKey ? await fetchGeminiModels(geminiKey) : GEMINI_MODELS
  })

  ipcMain.handle('set-default-provider', async (_e, { provider }) => {
    await saveKey('default-provider', provider)
    return { provider }
  })

  ipcMain.handle('set-ai-model', async (_e, { provider, model }) => {
    const keyMap = { anthropic: 'anthropic-model', openai: 'openai-model', groq: 'groq-model', gemini: 'gemini-model' }
    saveKey(keyMap[provider] || 'anthropic-model', model)
    return { provider, model }
  })

  ipcMain.handle('get-ai-models', async () => {
    const geminiKey = getKey('gemini')
    const groqKey = getKey('groq')
    const geminiModels = geminiKey ? await fetchGeminiModels(geminiKey) : GEMINI_MODELS
    const groqModels = groqKey ? await fetchGroqModels(groqKey) : GROQ_MODELS
    return { anthropic: ANTHROPIC_MODELS, openai: OPENAI_MODELS, groq: groqModels, gemini: geminiModels, local: LOCAL_MODELS }
  })

  ipcMain.handle('generate-visual-config', async (_e, {
    userDescription, availableMeasures, availableDimensions, provider, model, currentConfig, maxTokens,
  }) => {
    const activeProvider = provider || getKey('default-provider') || 'anthropic'
    const apiKey = getKey({ openai: 'openai', groq: 'groq', gemini: 'gemini' }[activeProvider] || 'anthropic')
    if (!apiKey) throw new Error(`No API key for ${activeProvider}. Add your key in Settings.`)

    let activeModel = model
    if (!activeModel) {
      const modelKeyMap = { openai: 'openai-model', groq: 'groq-model', gemini: 'gemini-model' }
      activeModel = getKey(modelKeyMap[activeProvider] || 'anthropic-model')
    }

    const tokens = maxTokens || 1000
    const modelCtx = global.semanticaModelContext || null

    // ── Two-stage pipeline (only on first generation, not refinement) ──────────
    // Stage 1: Use Groq (fast + cheap) to route — select relevant measures/tables
    // Stage 2: Use the chosen provider with a focused context subset
    let stage1Result = null
    let stage1Usage = null
    const groqKey = getKey('groq')
    if (!currentConfig && groqKey && modelCtx) {
      try {
        const modelSummary = buildModelSummary(modelCtx)
        const stage1Msg    = `Model Summary:\n${modelSummary}\n\nUser request: "${userDescription}"`
        const stage1Res    = await generateWithGroq(stage1Msg, groqKey, 'llama-3.3-70b-versatile', 300, STAGE1_SYSTEM_PROMPT)
        stage1Result = stage1Res.config
        stage1Usage = stage1Res.usage || null
        console.log('[llm] Stage 1 routing:', JSON.stringify(stage1Result), '| tokens:', stage1Usage?.totalTokens)
      } catch (e) {
        console.warn('[llm] Stage 1 routing failed, using full context:', e.message)
      }
    }

    // ── Build focused measure/dimension lists for Stage 2 ─────────────────────
    let focusedMeasures    = availableMeasures || []
    let focusedDimensions  = availableDimensions || []
    let impliedFilters     = {}

    if (stage1Result) {
      if (stage1Result.selectedMeasures?.length) {
        focusedMeasures = focusedMeasures.filter(m => stage1Result.selectedMeasures.includes(m.name))
        if (focusedMeasures.length === 0) focusedMeasures = availableMeasures || [] // safety fallback
        // Ensure any measure the user explicitly mentioned by name is included
        // (prevents Stage 1 from accidentally dropping measures for stacked/multi-measure visuals)
        const descLower = (userDescription || '').toLowerCase()
        for (const m of (availableMeasures || [])) {
          if (descLower.includes(m.name.toLowerCase()) && !focusedMeasures.some(fm => fm.name === m.name)) {
            focusedMeasures.push(m)
          }
        }
      }
      if (stage1Result.selectedTables?.length) {
        focusedDimensions = focusedDimensions.filter(d => stage1Result.selectedTables.includes(d.name || d.tableName))
        if (focusedDimensions.length === 0) focusedDimensions = availableDimensions || []
      }
      impliedFilters = stage1Result.impliedFilters || {}
    }

    // ── Build focused model summary for Stage 2 ───────────────────────────────
    const focusedSummary = modelCtx && stage1Result
      ? buildModelSummary(modelCtx, stage1Result.selectedMeasures, stage1Result.selectedTables)
      : null

    const userMessage = currentConfig
      ? buildRefinementMessage(userDescription, availableMeasures || [], availableDimensions || [], currentConfig)
      : buildUserMessage(userDescription, focusedMeasures, focusedDimensions, null, focusedSummary)

    let result
    if (activeProvider === 'openai')       result = await generateWithOpenAI(userMessage, apiKey, activeModel, tokens)
    else if (activeProvider === 'groq')    result = await generateWithGroq(userMessage, apiKey, activeModel, tokens)
    else if (activeProvider === 'gemini')  result = await generateWithGemini(userMessage, apiKey, activeModel, tokens)
    else                                   result = await generateWithClaude(userMessage, apiKey, activeModel, tokens)

    // Merge implied filters from Stage 1
    if (Object.keys(impliedFilters).length > 0 && result.config) {
      result.config.filters = { ...impliedFilters, ...(result.config.filters || {}) }
    }

    return result
  })

  // ── App Generator pipeline ────────────────────────────────────────────────
  ipcMain.handle('generate-app-spec', async (_e, {
    userDescription, provider: preferredProvider, model: preferredModel, mode, currentSpec, pageSize,
  }) => {
    // pageSize: { preset, width, height } — shape the LLM's layout decisions
    // to the target canvas (e.g. 1280x1920 "tall" wants more vertical stacking).
    const _t0 = Date.now()
    const modelCtx = global.semanticaModelContext || null
    let stage1Provider = 'none'
    let stage1Usage = null

    // Map mode to preferred provider
    let resolvedPreferred = preferredProvider
    if (!resolvedPreferred) {
      if (mode === 'quality')  resolvedPreferred = 'anthropic'
      else if (mode === 'economy') resolvedPreferred = 'gemini'
      // 'auto' → null → smart selection
    }

    // ── Local LLM: intent-extraction pipeline ─────────────────────────────────
    // Self-contained fast path (~8–15 sec). Cloud paths below are untouched.
    if (resolvedPreferred === 'local') {
      return await require('./localPipeline').generate({ userDescription, currentSpec, modelCtx, pageSize })
    }

    // ── Stage 1: Smart routing (best-effort, skipped on refinement) ───────────
    let stage1Result = null
    if (!currentSpec && modelCtx && resolvedPreferred === 'local') {
      // Zero-latency keyword selection — no LLM call, runs in <1ms
      stage1Result = normaliseStage1Result(modelCtx, selectLocalContext(userDescription, modelCtx))
      console.log('[llm] Stage1 (local/keyword):', stage1Result?.selectedMeasures?.slice(0, 5), '| tables:', stage1Result?.selectedTables?.slice(0, 3))
      stage1Provider = 'local-keyword'
    }
    if (!currentSpec && modelCtx && resolvedPreferred !== 'local') {
      const routingCfg = selectRoutingProvider()
      if (routingCfg) {
        try {
          stage1Provider = routingCfg.provider
          console.log(`[llm] Stage1 routing via ${routingCfg.provider} (${routingCfg.model})`)
          const modelSummary = buildModelSummary(modelCtx)
          const stage1Prompt = `Given this model summary and user request, identify the most relevant measures and tables.

Model Summary:
${modelSummary}

User Request: "${userDescription}"

Return ONLY this JSON object, nothing else:
{
  "selectedMeasures": ["exact measure name 1", "exact measure name 2 if explicitly requested"],
  "selectedTables": ["exact table name"],
  "suggestedVisuals": ["kpi", "bar"],
  "suggestedTitle": "Dashboard Title",
  "needsDateDimension": false,
  "needsComparison": false
}`
          const stage1Raw = await callAnyProvider(routingCfg, stage1Prompt, STAGE1_SYSTEM_PROMPT, 400)
          stage1Result = normaliseStage1Result(modelCtx, stage1Raw.config)
          stage1Usage = stage1Raw.usage
          stage1Provider = stage1Raw.actualProvider || routingCfg.provider
          console.log('[llm] Stage1 selected:', stage1Result?.selectedMeasures?.slice(0, 5), '| tokens:', stage1Usage?.totalTokens)
        } catch (e) {
          const is429 = e.response?.status === 429 || e.message?.includes('429')
          if (is429) {
            console.log('[llm] Stage1 rate-limited on routing model, using full context for Stage 2')
          } else {
            console.warn('[llm] Stage1 failed:', e.message)
          }
          stage1Result = null
        }
      }
    }

    // Build fallback if Stage 1 failed or skipped
    if (!stage1Result?.selectedMeasures) {
      stage1Result = normaliseStage1Result(modelCtx, {
        selectedMeasures: (modelCtx?.measures || []).filter(m => !m.isHidden).map(m => m.name),
        selectedTables:   (modelCtx?.tables   || []).filter(t => t.tableType !== 'measure_group').map(t => t.name),
        suggestedVisuals: ['kpi', 'bar', 'line'],
        suggestedTitle:   'Analytics Dashboard',
        needsDateDimension: false,
        needsComparison: false,
      }) || {
        selectedMeasures: [],
        selectedTables: [],
        suggestedVisuals: ['kpi', 'bar', 'line'],
        suggestedTitle: 'Analytics Dashboard',
        needsDateDimension: false,
        needsComparison: false,
      }
    }

    // ── Programmatic patch for local provider (refinement: "add X as Y") ───────
    if (currentSpec && resolvedPreferred === 'local') {
      const patchedSpec = patchLocalAppSpec(userDescription, currentSpec, modelCtx)
      if (patchedSpec) {
        console.log('[llm] Local AppSpec patched programmatically — skipping LLM call')
        const sanitized = sanitizeAppSpec(patchedSpec)
        const reflowed  = reflowLayout(sanitized)
        reflowed.version = '1.0'
        if (pageSize && (pageSize.preset || pageSize.width || pageSize.height)) {
          if (pageSize.preset) reflowed.layout.pagePreset = pageSize.preset
          if (pageSize.width)  reflowed.layout.pageWidth  = pageSize.width
          if (pageSize.height) reflowed.layout.pageHeight = pageSize.height
        }
        const _elapsed = Date.now() - _t0
        return {
          spec:            reflowed,
          stage1:          stage1Result,
          provider:        'local-programmatic',
          model:           'programmatic',
          routingProvider: 'local-keyword',
          usage: {
            stage1:   { inputTokens: 0, outputTokens: 0, totalTokens: 0, elapsedMs: 0, estimatedCost: 0 },
            stage2:   { inputTokens: 0, outputTokens: 0, totalTokens: 0, elapsedMs: _elapsed, estimatedCost: 0 },
            combined: { inputTokens: 0, outputTokens: 0, totalTokens: 0, elapsedMs: _elapsed, estimatedCost: 0 },
          },
        }
      }
    }

    // ── Programmatic generation for local provider (new spec only) ───────────
    if (!currentSpec && resolvedPreferred === 'local' && stage1Result?.selectedMeasures?.length) {
      const programmaticSpec = buildLocalAppSpec(userDescription, modelCtx, stage1Result)
      if (programmaticSpec) {
        console.log('[llm] Local AppSpec generated programmatically — skipping LLM call')
        const sanitized = sanitizeAppSpec(programmaticSpec)
        const reflowed  = reflowLayout(sanitized)
        reflowed.version = '1.0'
        if (pageSize && (pageSize.preset || pageSize.width || pageSize.height)) {
          if (pageSize.preset) reflowed.layout.pagePreset = pageSize.preset
          if (pageSize.width)  reflowed.layout.pageWidth  = pageSize.width
          if (pageSize.height) reflowed.layout.pageHeight = pageSize.height
        }
        const _elapsed = Date.now() - _t0
        return {
          spec:            reflowed,
          stage1:          stage1Result,
          provider:        'local-programmatic',
          model:           'programmatic',
          routingProvider: 'local-keyword',
          usage: {
            stage1:   { inputTokens: 0, outputTokens: 0, totalTokens: 0, elapsedMs: 0, estimatedCost: 0 },
            stage2:   { inputTokens: 0, outputTokens: 0, totalTokens: 0, elapsedMs: _elapsed, estimatedCost: 0 },
            combined: { inputTokens: 0, outputTokens: 0, totalTokens: 0, elapsedMs: _elapsed, estimatedCost: 0 },
          },
        }
      }
      console.log('[llm] Programmatic generation not applicable — using LLM Stage 2')
    }

    // ── Build focused schema for Stage 2 ──────────────────────────────────
    const explicitMeasureNames = extractExplicitMeasureNames(userDescription, modelCtx)
    const stage2MeasureNames = Array.from(new Set([
      ...(stage1Result.selectedMeasures || []),
      ...explicitMeasureNames,
    ]))

    const focusedSchema = buildFocusedModelSummary(
      modelCtx,
      stage2MeasureNames,
      stage1Result.selectedTables
    )

    // ── Stage 2: App Spec generation ───────────────────────────────────────
    // Pass the user's explicit model choice from the dropdown; falls back to
    // keychain/default if empty. Only honor the model override when the provider
    // actually matched (so we don't send, e.g., a Gemini model id to Anthropic).
    const modelOverride = (resolvedPreferred === preferredProvider) ? preferredModel : null
    const genCfg = selectGenerationProvider(resolvedPreferred, modelOverride)
    // Cap to Sonnet when mode isn't explicitly 'quality' (legacy flag kept for
    // back-compat). The provider/model dropdowns now let the user pick Opus
    // directly if they want it. Covers both the current `claude-opus-4-7` and
    // any stray older ID from a stale saved preference.
    if (mode !== 'quality' && genCfg.provider === 'anthropic' && /^claude-opus-/.test(genCfg.model)) {
      genCfg.model = 'claude-sonnet-4-6'
    }
    console.log(`[llm] Stage2 generation via ${genCfg.provider} (${genCfg.model})`)

    // Canvas hint — injected into both new-gen and refinement paths.
    let canvasHint = ''
    if (pageSize && (pageSize.width || pageSize.height)) {
      const w = pageSize.width || 1280
      const h = pageSize.height || 720
      const shape = h > 1000 ? ' (tall — stack visuals vertically; prefer more rows)'
        : (w > h * 1.5 ? ' (wide — side-by-side charts OK)' : '')
      const cw = Math.round((w - 40) / 12)
      canvasHint = `\nTARGET CANVAS: ${w}x${h} px${shape}. Each of the 12 columns is ~${cw}px; row height 80px. Lay out visuals to fill this canvas efficiently.\n`
    }

    let stage2Msg
    if (currentSpec) {
      stage2Msg = `SEMANTIC MODEL — use ONLY these measures and tables:
${focusedSchema}
${canvasHint}
CURRENT APP SPEC:
${JSON.stringify(currentSpec, null, 2)}

USER REFINEMENT REQUEST: "${userDescription}"

Update only the parts the user asked to change. Preserve all other visuals, slicers, and config.
Return the complete updated App Spec JSON. Return ONLY valid JSON.`
    } else {
      stage2Msg = `SEMANTIC MODEL — use ONLY these measures and tables:
${focusedSchema}
${canvasHint}
ROUTING HINTS:
- Suggested visual types: ${stage1Result.suggestedVisuals?.join(', ')}
- Suggested title: "${stage1Result.suggestedTitle}"
- Needs date dimension: ${stage1Result.needsDateDimension}
- Needs comparison layout: ${stage1Result.needsComparison}

USER REQUEST: "${userDescription}"

Generate the complete App Spec JSON now. Return ONLY valid JSON. No markdown. No explanation.`
    }

    // Groq's free tier caps tokens-per-request tightly (e.g. ~8K for some
    // models). The app-gen system prompt alone is ~5.6K tokens, so a 6K output
    // budget pushes the request past the cap → 413. Give Groq a smaller output
    // budget so it fits a high-TPM model (llama-3.3-70b/llama-4); other
    // providers keep the full budget. JSON repair covers rare truncation.
    const stage2MaxTokens = genCfg.provider === 'groq' ? 3500 : 6000
    let stage2Raw
    try {
      stage2Raw = await callAnyProvider(genCfg, stage2Msg, APP_GEN_SYSTEM_PROMPT, stage2MaxTokens)
    } catch (err) {
      throw friendlyProviderError(err, genCfg.provider)
    }
    const appSpec = stage2Raw.config
    const stage2Usage = stage2Raw.usage
    // Enforce layout defaults regardless of what the AI returned
    appSpec.layout = { rowHeight: 80, columns: 12, gap: 8, ...(appSpec.layout || {}) }
    appSpec.layout.rowHeight = 80
    // Persist the caller's page-size choice into the spec so downstream
    // renderers (Semantica canvas, web export, PBI publish) all see it.
    if (pageSize && (pageSize.preset || pageSize.width || pageSize.height)) {
      if (pageSize.preset) appSpec.layout.pagePreset = pageSize.preset
      if (pageSize.width)  appSpec.layout.pageWidth  = pageSize.width
      if (pageSize.height) appSpec.layout.pageHeight = pageSize.height
    }
    // Repair disconnected time-dimension groupBy fields before sanitization
    const repairedTimeAxis = repairTimeGroupBy(appSpec, userDescription, modelCtx)
    const repairedLayout = repairSideBySide(repairedTimeAxis, userDescription)
    const repairedStacked = repairStackedBar(repairedLayout, userDescription, modelCtx)
    const sanitized = sanitizeAppSpec(repairedStacked)
    const reflowed  = reflowLayout(sanitized)
    reflowed.version = '1.0'

    return {
      spec:            reflowed,
      stage1:          stage1Result,
      provider:        stage2Raw.actualProvider || genCfg.provider,
      model:           stage2Raw.actualModel || genCfg.model,
      routingProvider: stage1Provider,
      usage: {
        stage1: stage1Usage,
        stage2: stage2Usage,
        combined: sumUsage(stage1Usage, stage2Usage),
      },
    }
  })

  // ── patch-app-spec: returns JSON Patch array for refinement ───────────────
  ipcMain.handle('patch-app-spec', async (_e, { currentSpec, userRequest, provider, model }) => {
    // Local provider: delegate to intent-extraction pipeline, return normalizedSpec directly
    if (provider === 'local') {
      const modelCtx = global.semanticaModelContext
      const result = await require('./localPipeline').generate({
        userDescription: userRequest, currentSpec, modelCtx, pageSize: null,
      })
      return {
        patches:       [],
        normalizedSpec: result.spec,
        provider:      result.provider,
        usage:         result.usage?.combined || null,
      }
    }

    const patchCfg = selectGenerationProvider(provider, model)

    // Include full measure + table context so patch generation uses exact names
    const modelCtx = global.semanticaModelContext
    const visibleMeasures = (modelCtx?.measures || [])
      .filter(m => !m.isHidden)
    const measureNames = visibleMeasures.map(m => m.name)
    const measureList = visibleMeasures
      .map(m => `- ${m.name}${m.table ? ` (table: ${m.table})` : ''}`)
      .join('\n')
    const tableList = (modelCtx?.tables || [])
      .filter(t => t.tableType !== 'measure_group')
      .map(t => `- ${t.name}: ${(t.columns || []).slice(0, 12).map(c => c.name).join(', ')}`)
      .join('\n')
    const visualSummary = (currentSpec?.visuals || []).map((visual, index) => {
      const groupBy = visual.data?.groupBy?.table && visual.data?.groupBy?.column
        ? `${visual.data.groupBy.table}[${visual.data.groupBy.column}]`
        : 'none'
      const extras = []
      if (visual.data?.limit)    extras.push(`limit=${visual.data.limit}`)
      if (visual.data?.orderBy)  extras.push(`orderBy=${visual.data.orderBy}`)
      if (Array.isArray(visual.config?.axisOptions) && visual.config.axisOptions.length > 0) {
        extras.push(`axisOptions=[${visual.config.axisOptions.map(o => o.label).join(',')}]`)
      }
      const extrasStr = extras.length ? ` | ${extras.join(' | ')}` : ''
      return `${index}. ${visual.id} | type=${visual.type} | measures=${(visual.data?.measures || []).join(', ') || 'none'} | groupBy=${groupBy}${extrasStr}`
    }).join('\n')

    const patchContextBlock = `AVAILABLE TABLES AND COLUMNS:
${tableList || '(none)'}

CURRENT VISUALS:
${visualSummary || '(none)'}`

    // Build schema hint for the visual types actually present in the spec
    const activeTypes = [...new Set((currentSpec?.visuals || []).map(v => v.type).filter(Boolean))]
    const schemaHint = buildVisualSchemaHint(activeTypes)

    const userMessage =
`${patchContextBlock}

AVAILABLE MEASURES (use ONLY these exact names):
${measureList || '(none — use names already in the spec)'}

${schemaHint ? schemaHint + '\n\n' : ''}CURRENT APP SPEC:
${JSON.stringify(currentSpec, null, 2)}

USER CHANGE REQUEST: "${userRequest}"

Return ONLY { "patches": [...] } with the RFC 6902 operations needed.
Do not rewrite the spec. Only patch what was asked.`

    const patchRaw = await callAnyProvider(patchCfg, userMessage, PATCH_SYSTEM_PROMPT, 4000)
    let result = patchRaw.config
    const patchUsage = patchRaw.usage

    // If result is a string (JSON parse failed upstream), try to repair truncated JSON
    if (typeof result === 'string') {
      let s = result.trim()
      // Strip markdown fences
      s = s.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()
      // Try to close truncated JSON: add missing ]}
      for (let suffix of ['', '}]}', ']}', ']', '}']) {
        try { result = JSON.parse(s + suffix); break } catch { /* try next */ }
      }
      if (typeof result === 'string') throw new Error('AI response is not valid JSON. Preview: ' + s.substring(0, 200))
    }

    // result is parsed JSON: { patches: [...] } or possibly bare array
    const rawPatches = Array.isArray(result) ? result : (result?.patches || [])
    if (rawPatches.length === 0) {
      console.warn('[patch-app-spec] LLM returned 0 patches. Raw result:', JSON.stringify(result).substring(0, 400))
    }
    const patches = validatePatchOperations(currentSpec, rawPatches, measureNames)
    if (patches.length < rawPatches.length) {
      console.warn('[patch-app-spec] Validation dropped', rawPatches.length - patches.length, 'patches. measureSet size:', measureNames.length,
        '\nDropped:', rawPatches.filter(p => !patches.includes(p)).map(p => `${p.op} ${p.path}`).join(', '))
    }
    let normalizedSpec = null
    if (patches.length > 0) {
      normalizedSpec = reflowLayout(sanitizeAppSpec(applyJsonPatch(currentSpec, patches)))
      normalizedSpec.version = '1.0'
    }
    return { patches, normalizedSpec, provider: patchRaw.actualProvider || patchCfg.provider, usage: patchUsage }
  })
}

function sanitizeAllPages(spec) {
  if (!Array.isArray(spec?.pages) || spec.pages.length === 0) {
    return reflowLayout(sanitizeAppSpec(spec))
  }
  return {
    ...spec,
    pages: spec.pages.map(page => {
      const pageSpec = { ...spec, visuals: page.visuals || [], slicers: page.slicers || [] }
      const cleaned  = reflowLayout(sanitizeAppSpec(pageSpec))
      return { ...page, visuals: cleaned.visuals, slicers: cleaned.slicers }
    }),
  }
}

module.exports = {
  register,
  sanitizeAppSpec,
  sanitizeAllPages,
  reflowLayout,
  repairTimeGroupBy,
  repairSideBySide,
  repairStackedBar,
  patchLocalAppSpec,
  // Exposed for the PBI Restyler's AI Director (electron/ipc/pbiRestyler.js).
  // Both functions are unchanged — only added to this export list. App
  // Generator's flows (generate-app-spec / patch-app-spec) are unaffected.
  selectGenerationProvider,
  callAnyProvider,
}
