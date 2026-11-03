// Playground Spike — Phase 7: AI template generation & refinement.
//
// A SEPARATE module from the canvas generation prompt (they must never entangle).
// This owns: the system prompt, the create/refine user messages, fence-stripping,
// JSON parsing, and the validate→retry-once loop. The actual provider call is the
// existing BYO-key client (window.semantica.generateCustomTemplate → llm.js
// selectGenerationProvider + callAnyProvider) — no new provider code.
//
// The system prompt is composed from the format the ENGINE enforces (instantiate.js
// + the three starter templates), not from prose docs. See PLAYGROUND_SPIKE.md §8.

import { EXAMPLE_TEMPLATES } from '@vilsem/core/templates/examples'
import { validateTemplate } from '@vilsem/core/templates'

const [KPI, BULLET, LOLLIPOP] = EXAMPLE_TEMPLATES
const j = (o) => JSON.stringify(o, null, 2)

// ── the system prompt (shared rules for both modes) ─────────────────────────
export const SYSTEM_PROMPT = `You generate .vilsem-visual template JSON — a declarative definition of ONE data
visual rendered with Apache ECharts. Respond with ONLY the JSON document: no prose,
no explanation, no markdown code fences.

## Template format
A template is a JSON object with these top-level keys:
- meta: { "id", "name", "description", "author", "version", "icon" }
    id   — stable kebab-case identifier (REQUIRED; in refine mode, keep it unchanged).
    icon — a single emoji.
- slots: named data bindings the user fills with model fields. Each slot is:
    { "kind": "dimension" | "measure" | "time",
      "count": <number> | { "min": <n>, "max": <n> },
      "constraints": { "maxCardinality": <n> } }   // constraints optional, advisory
- params: static user-editable configuration. Array of:
    { "name": <string>, "type": "number" | "string" | "color" | "boolean", "default": <value> }
- template: an ECharts \`option\` object (the skeleton) with placeholder tokens (below)
    wherever data / param / theme values are injected.
- transforms: OPTIONAL. An array of derived per-row fields computed by a safe
    arithmetic expression (no JS). Each is { "calculate": "<expr>", "as": "<name>" }
    and becomes a $calc.<name>.* accessor (same shape as a measure slot). This is the
    ONLY way to do cross-slot / cross-measure arithmetic.
- themeBindings: optional metadata naming the theme tokens used. (Theming actually
    happens through the $theme.* tokens inside \`template\`.)

## Tokens — string values inside \`template\`, resolved by the engine (never eval'd)
Data, from the bound slots:
  $slot.<name>.categories    array of category labels (the axis)
  $slot.<name>.values        array of numbers — a measure slot's primary values
  $slot.<name>.series.<i>    array of numbers for the i-th measure of a multi-measure slot
  $slot.<name>.pairs         array of [category, value] pairs — VERTICAL dot plots (category on x)
  $slot.<name>.pairsSwapped  array of [value, category] pairs — HORIZONTAL dot plots (category on y)
  $slot.<name>.cells         array of [index, 0, value] triples — a single-row heatmap / heat-strip
  $slot.<name>.pieData       array of {value, name} objects — pie / donut / rose / nightingale
  $slot.<name>.matrix        array of [xIndex, yIndex, value] triples — a 2-D heatmap (needs 2 dimension slots)
Scalar accessors on a measure slot (numbers):
  $slot.<name>.last  .first  .sum  .avg  .min  .max  .delta  .deltaPct
Pre-formatted scalar STRINGS (thousands / percent) — use these for static text:
  $slot.<name>.lastLabel  .sumLabel  .deltaLabel  .deltaPctLabel
Derived (from a transforms entry): $calc.<name>.values / .pairs / .pairsSwapped / … (same accessors as a slot)
Params:  $param.<name>
Theme:   $theme.palette   $theme.palette.<i>   $theme.accent   $theme.font   $theme.background
         $theme.textPrimary   $theme.textMuted   $theme.gridStroke   $theme.gridStrokeOn   $theme.axisLine

The accessors above are the COMPLETE set. Do NOT invent others — there is no
.name, .label, .total, .count, .key, .id, or any accessor not listed here.
Referencing one that doesn't exist resolves to nothing and the visual breaks.

## Available ECharts pieces (the renderer registers ONLY these — do not use others)
Series types: bar, line, scatter, effectScatter, pie, gauge, radar, treemap, heatmap,
pictorialBar (isotype/pictogram), funnel, sunburst, tree, sankey, graph, boxplot,
candlestick, parallel, themeRiver.
Components: grid (cartesian), polar (angleAxis + radiusAxis, for radial bar / rose /
nightingale), calendar (calendar heatmap), singleAxis, parallel, tooltip, legend,
title, graphic, markLine, markArea, markPoint, dataZoom (inside), and visualMap.
NOTE ON DATA SHAPE: the bindings give up to 2 dimensions + up to 3 measures. A 2-D
heatmap IS now supported (two dim slots + $slot.<m>.matrix). Series that need still
richer data — candlestick (OHLC = 4 values/row), boxplot (5-number summary),
sankey/graph (nodes+links) — cannot be fed yet; prefer shapes within 2 dims + ≤3 measures.
PER-CATEGORY COLORING (each bar/slice a different colour): pie/donut/rose colour
their slices from the palette automatically; for a bar/pictorialBar add "colorBy":"data"
to the series (do NOT also set a single itemStyle.color) so each bar takes the next
palette colour. The user can override the palette per-section in the inspector.
VALUE-BASED COLORING: there are no expressions and no per-point color functions. The
ONLY declarative way to color by data (e.g. negative=red, positive=green, or a
gradient by magnitude) is a "visualMap" (continuous or piecewise) mapping the series
values to colors. Use visualMap for any conditional coloring — never a function, and
never a ternary in a token.
CROSS-SLOT ARITHMETIC via transforms: to compute across measures/rows (high−low,
value÷total, a connector span), add a "transforms" entry — e.g.
{ "calculate": "high - low", "as": "span" } — and reference $calc.span.values. The
expression allows + - * / %, parentheses, numbers, slot/param names, and the
functions abs/min/max/round/floor/ceil/sqrt ONLY — no other functions, no property
access, no ternaries.

## Formatters — the ONLY way to format axis / label / tooltip text
Inside any ECharts label or tooltip object use a "formatterTemplate" STRING (never a
function). The engine turns it into a real formatter. Use ONLY these tokens — do NOT
use ECharts' native {c} {b} {a} {d}:
  {value}   {value:thousands}   {value:percent}   {name}   {seriesName}

## HARD CONSTRAINTS — violating ANY of these makes the template INVALID
1. The data row shape supports up to TWO dimensions + up to THREE measure values.
   Declare AT MOST TWO slots of kind "dimension" or "time" (the 1st →
   $slot.<d>.categories, the 2nd → a second axis or the heatmap y). A single-dimension
   visual uses one dim slot; a grid/2-D heatmap uses two. "measure" slot counts sum to ≤ 3.
2. Every template MUST declare at least one "measure" slot. Measure-less visuals are
   unsupported in this build.
3. DECLARATIVE ONLY. No JavaScript anywhere — no functions, no "formatter": function,
   no computed keys. Formatting is exclusively the "formatterTemplate" whitelist above.
   Every $-token must be a PLAIN dotted path ($slot.x.y, $param.x, $theme.x) — NEVER an
   expression, comparison, arithmetic, or ternary like "$slot.v.x > 0 ? 'red' : 'green'".
   The engine does not evaluate tokens; an expression resolves to nothing. For
   conditional colour use a visualMap, not a token expression.
   A token is replaced WHOLE — do NOT append characters to it. "$param.innerRadius%" is
   INVALID (the trailing % breaks it). If a value needs a unit (a percentage like "20%",
   a pixel size), declare a STRING param whose default already includes the unit
   (e.g. {"name":"innerRadius","type":"string","default":"20%"}) and reference $param.innerRadius alone.
   To show a category or series NAME in a label or tooltip, use a "formatterTemplate" with
   {name} / {seriesName} — there is NO $slot.<name>.name token (measure slots have no name).
4. Static text (ECharts "title".text, "graphic" text) does NOT run formatters. For a
   big-number / KPI display bind a PRE-FORMATTED scalar accessor
   (e.g. "text": "$slot.value.lastLabel") — never a raw number, never a formatter.
5. Series colors and fonts MUST come from $theme tokens (e.g. "color": "$theme.palette.0",
   "fontFamily": "$theme.font"). Do not hard-code hex for series or text. Fixed SEMANTIC
   colors for qualitative bands (a red/amber/green bullet) MAY be literal hex, as in the
   bullet example below.

## Recipes — the correct construction for each visual family (use these tokens/series)
- Big number / KPI: ECharts "title".text = "$slot.value.lastLabel" (pre-formatted). Add a
  "line" series over $slot.value.values for a sparkline. No formatter on the title.
- Ranked bars / column: xAxis category = $slot.<dim>.categories; "bar" series data = $slot.<m>.values.
- Vertical lollipop: a thin "bar" ($slot.<m>.values) + a "scatter" at $slot.<m>.pairs; label
  "formatterTemplate": "{value:thousands}".
- Horizontal dot plot / dumbbell dots: yAxis category = $slot.<dim>.categories; "scatter" data =
  $slot.<m>.pairsSwapped. (A connecting line between two measures is NOT expressible — omit it.)
- Line / area over time: xAxis category = $slot.<time>.categories; "line" series ($slot.<m>.values),
  add "areaStyle" for area.
- Conditional / sign coloring (tornado, threshold): a normal "bar"/"scatter" series PLUS a top-level
  "visualMap" (piecewise for sign buckets, continuous for a gradient) mapping the series values to
  $theme colors. Never a token expression. A CONTINUOUS visualMap MUST set "min":"$slot.<m>.min" and
  "max":"$slot.<m>.max" so the gradient spans the real data — a hardcoded range makes every cell one colour.
  IMPORTANT: for a visualMap to colour by the VALUE, use a VERTICAL bar (xAxis category, yAxis value). On a
  HORIZONTAL bar (yAxis category) the visualMap colours by the row index instead — wrong. Keep sign/value-
  coloured bars vertical.
- Pie / donut / rose: "pie" series, data = $slot.<m>.pieData; add "roseType":"area" for a nightingale,
  "radius":["40%","70%"] for a donut.
- Radial / circular bar: coordinateSystem "polar" with angleAxis {type:"category", data:$slot.<dim>.categories}
  + radiusAxis {type:"value"}; "bar" series data = $slot.<m>.values, "coordinateSystem":"polar".
- Heat-strip (one row): "heatmap" series data = $slot.<m>.cells; xAxis category = $slot.<time>.categories,
  yAxis {type:"category", data:[""]}; add a continuous "visualMap" with "min":"$slot.<m>.min",
  "max":"$slot.<m>.max" (required — otherwise every cell is the same colour) and "inRange":{"color":[...]}.
- Gauge: "gauge" series with data:[{"value":"$slot.<m>.last"}]; set min/max via $param.
- Floating range bar (low→high per category): transforms:[{"calculate":"high - low","as":"span"}];
  a transparent base "bar" ($slot.low.values, stack:"range") + a visible "bar" ($calc.span.values,
  same stack). The stack turns base+span into a bar floating from low to high.
- Dumbbell with connector: transforms:[{"calculate":"min(start,end)","as":"base"},
  {"calculate":"abs(end - start)","as":"gap"}]; a thin transparent base "bar" + a thin visible "bar"
  (stacked, small barWidth, z:1) draws the connecting line; two "scatter" series (pairsSwapped, z:3)
  draw the start/end dots on top.
- Pictogram (isotype): "pictorialBar" series data = $slot.<m>.values, "symbol":"$param.symbol",
  "symbolRepeat":true, "symbolSize":["60%","12%"], "symbolClip":true — repeated icons per category.
- Calendar heatmap: a "calendar" component with "range":"$slot.<time>.dateRange" (auto-fits the data's
  span — never a hardcoded year); a "heatmap" series with "coordinateSystem":"calendar", data =
  $slot.<m>.pairs (each [dateString, value]); + a continuous visualMap (min:$slot.<m>.min, max:$slot.<m>.max).
- 2-D heatmap / grid: TWO dimension slots (xDim, yDim) + 1 measure. xAxis category =
  $slot.xDim.categories, yAxis category = $slot.yDim.categories, "heatmap" series data =
  $slot.<m>.matrix (the [xIndex,yIndex,value] triples), + a continuous visualMap (min/max).

## Examples (user request → the template it should produce)
User: "a KPI card showing a measure's latest value with a trend sparkline below it"
${j(KPI)}

User: "a bullet chart of one measure against a target with poor/good/max bands"
${j(BULLET)}

User: "a lollipop chart ranking one measure across a category"
${j(LOLLIPOP)}`

// Appended to the system prompt only when refining.
export const REFINE_SYSTEM_SUFFIX = `

## REFINE MODE
You are MODIFYING an existing template. Return the COMPLETE modified template as JSON.
Change only what the instruction requires; preserve everything else verbatim —
including meta.id. Obey all HARD CONSTRAINTS above.`

export function composeSystemPrompt(mode) {
  return mode === 'refine' ? SYSTEM_PROMPT + REFINE_SYSTEM_SUFFIX : SYSTEM_PROMPT
}

export function composeUserMessage({ mode, instruction, currentTemplate }) {
  if (mode === 'refine') {
    return `Here is the current template:\n${j(currentTemplate)}\n\nApply this instruction: "${instruction}"\n\nReturn the complete modified template as JSON only.`
  }
  return `Create a .vilsem-visual template for: "${instruction}"\n\nRespond with the JSON template only.`
}

// ── response handling (pure, testable) ──────────────────────────────────────
// Strip accidental markdown fences and grab the JSON body.
export function stripFences(text) {
  let s = String(text == null ? '' : text).trim()
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  // If prose leaked around the JSON, keep the outermost object.
  if (!s.startsWith('{')) {
    const start = s.indexOf('{')
    const end = s.lastIndexOf('}')
    if (start !== -1 && end > start) s = s.slice(start, end + 1)
  }
  return s
}

// Parse a model response into { template, jsonError, text }. `text` is the cleaned
// JSON string that lands in the editor regardless of validity.
export function parseTemplateResponse(raw) {
  const text = stripFences(raw)
  try { return { template: JSON.parse(text), jsonError: null, text } }
  catch (e) { return { template: null, jsonError: e.message, text } }
}

// ── the generate/refine driver: call → parse → validate → one retry ─────────
// Returns { ok, text, template, errors, warnings, retried, provider, model }.
// `text` ALWAYS holds the (cleaned) JSON to drop into the editor — validation, lint
// and preview then fire through the normal editor path. Never renders directly.
export async function generateTemplate({ mode, instruction, currentTemplate, provider, model, onLog, onStage }) {
  const stage = (s) => { try { onStage?.(s) } catch {} }
  const system = composeSystemPrompt(mode)
  const attempt = async (userMessage) => {
    const res = await window.semantica.generateCustomTemplate({ system, user: userMessage, provider, model })
    // llm.js already parses; hand back both the object and a pretty text form.
    const obj = res?.template ?? null
    const text = obj ? JSON.stringify(obj, null, 2) : stripFences(res?.text || '')
    const parsed = obj ? { template: obj, jsonError: null, text } : parseTemplateResponse(res?.text || '')
    return { parsed, provider: res?.provider, model: res?.model }
  }

  const log = (rec) => { try { onLog?.(rec) } catch {} }

  // Attempt 1
  let userMessage = composeUserMessage({ mode, instruction, currentTemplate })
  let first
  stage(mode === 'refine' ? 'Refining…' : 'Generating…')
  try { first = await attempt(userMessage) }
  catch (e) {
    log({ mode, instruction, result: 'error', retried: false, error: e.message })
    return { ok: false, text: '', template: null, errors: [e.message], warnings: [], retried: false }
  }

  stage('Validating…')
  let { parsed, provider: usedProvider, model: usedModel } = first
  let validation = parsed.template ? validateTemplate(parsed.template) : { errors: [parsed.jsonError || 'invalid JSON'], warnings: [] }
  if (parsed.template && validation.errors.length === 0) {
    log({ mode, instruction, result: 'pass', retried: false, provider: usedProvider, model: usedModel })
    return { ok: true, text: parsed.text, template: parsed.template, errors: [], warnings: validation.warnings, retried: false, provider: usedProvider, model: usedModel }
  }

  // One silent retry with the validator's complaint appended.
  stage('Fixing & retrying…')
  const errText = (parsed.jsonError ? [parsed.jsonError] : validation.errors).join('; ')
  const retryMessage = `${userMessage}\n\nYour previous output failed validation: ${errText}\nReturn a corrected COMPLETE template as JSON only.`
  try {
    const second = await attempt(retryMessage)
    parsed = second.parsed; usedProvider = second.provider; usedModel = second.model
    validation = parsed.template ? validateTemplate(parsed.template) : { errors: [parsed.jsonError || 'invalid JSON'], warnings: [] }
    if (parsed.template && validation.errors.length === 0) {
      log({ mode, instruction, result: 'pass', retried: true, provider: usedProvider, model: usedModel })
      return { ok: true, text: parsed.text, template: parsed.template, errors: [], warnings: validation.warnings, retried: true, provider: usedProvider, model: usedModel }
    }
  } catch (e) {
    log({ mode, instruction, result: 'error', retried: true, error: e.message })
    return { ok: false, text: parsed.text || '', template: parsed.template, errors: [e.message], warnings: [], retried: true }
  }

  // Second failure — surface honestly. `text` still goes to the editor for manual fixes.
  log({ mode, instruction, result: 'fail', retried: true, errors: validation.errors })
  return { ok: false, text: parsed.text, template: parsed.template, errors: validation.errors.length ? validation.errors : [parsed.jsonError || 'invalid JSON'], warnings: validation.warnings || [], retried: true, provider: usedProvider, model: usedModel }
}
