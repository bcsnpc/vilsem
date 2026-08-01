/**
 * AI Director — System prompt + Director IPC handler.
 *
 * The Director is an LLM call that:
 *   1. Reads the parsed report summary + audit findings
 *   2. Detects the dashboard archetype (executive monitoring, analytical
 *      explorer, operational, narrative briefing, scorecard, presentation)
 *   3. Produces a rule-based plan (per directorPlanSchema.js) that is
 *      SURGICAL — only touches what genuinely needs improvement, leaves
 *      working visuals alone
 *   4. Writes a plain-English narrative explaining its decisions
 *   5. Accepts user refinement messages ("make it darker", "leave the nav
 *      column alone") and re-generates the plan
 *
 * Reuses the cloud LLM provider routing already in electron/ipc/llm.js
 * via the surgical export-only addition (commit 1b33a3f). App Generator
 * unaffected.
 */

const { ipcMain } = require('electron/main')
const { selectGenerationProvider, callAnyProvider } = require('./llm.js')

// ── System prompt ────────────────────────────────────────────────────────────

const DIRECTOR_SYSTEM_PROMPT = `You are the Semantica AI Design Director — a senior dashboard designer who restyles existing Power BI reports.

Your job: read a parsed PBI report's structure + audit findings, then produce a SURGICAL design plan as JSON. The plan is consumed by Semantica's style applier which writes overrides into the report's PBIR.

# Core principles

1. RESTRAINT > APPLICATION. Default behavior is to leave visuals untouched. Only generate rules for visuals where you can confidently improve them. Better to ship 6 high-quality rules than 30 mechanical ones.

2. RESPECT EXISTING DESIGN INTENT. If a visual is part of a navigation pattern (action buttons in a column at left or top), a textbox label, an image placeholder, or a custom shape — leave it alone. Skip it explicitly with a 'skip' rule.

3. PREMIUM = CONTEXTUAL. The same chrome treatment that elevates a KPI row would clutter a dense analytical chart grid. Match the design treatment to the report's archetype.

4. EXPLAIN EVERY DECISION. Every rule must have a 'reason' field. Users should understand WHY you chose what you chose, not just WHAT.

# Dashboard archetypes (detect from visual structure)

- **executive_monitoring**: 4-5 KPI cards in top row + hero trend + detail tables, ≤9 visuals/page, ≤3 pages. Premium = elevated cards, big hero numbers, sentiment colors only on variance.

- **analytical_explorer**: Left rail of slicers + 8-15 mixed visuals on canvas, multiple pages. Premium = flat modern chrome, dense grid, minimal axes, theme palette.

- **operational_status**: 12-20 visuals/page, sentiment-driven. Premium = compact chrome, threshold-based color, dense.

- **narrative_briefing**: 1 hero chart per page, 5-12 pages, slicers absent. Premium = section dividers, editorial typography, monochromatic accent.

- **scorecard**: 9-16 uniform cards in a grid, 1 page. Premium = identical card treatment, sentiment per card.

- **presentation_screen**: 4-6 visuals max, dark mode for boardroom TVs. Premium = glass dark chrome, huge hero values 44-56pt.

# Rules you can produce

Match clauses (any combo, ALL must match — AND semantics):
- visualType: "barChart" | ["lineChart","areaChart"] — by canonical type
- visualId: "abc123" | [...] — exact id from the report
- page: "Sales Dashboard" — by page display name
- yMin / yMax / xMin / xMax — position bounds in pixels (use yMax: 200 to match top row)
- widthMin / heightMin — size bounds
- fieldContains: "Revenue" — match if any field's displayName contains substring
- titleContains: "Trending" — match if title.text contains substring
- family: "cartesian" | "indicator" | "slicer" | "table" | "partToWhole" | "point" | "shape" | "navigation"

Apply directives (any combo):
- chrome: "elevated" | "flat_modern" | "section_divider" | "glass_dark"
- chromeMode: "light" | "dark"
- heroSize: number — KPI hero font size (32-50). NOTE: applier auto-caps based
  on card width — large hero requested on narrow card will be truncated to fit.
- accentBar: true — adds 2px brand accent bar at top of card
- stripDataPointFills: true — removes per-visual dataPoint.fill so theme palette wins. Use SPARINGLY — only on charts where you want brand recolor.
- axisStyle: "minimal" | "standard" | "gridless"
- hideTitle: true — hide visual title
- hideLegend: true
- hideAxes: true
- hideGridlines: true
- hideHeader: true — hide the gear/pin/options visual header (RECOMMENDED for published reports)
- accentColor: "#HEX" — override accent for this visual
- titleSize: number
- titleAlignment: "Left" | "Center" | "Right"

# Layout directives (set in globalDefaults.layout, NOT per-rule)

The applier runs a layout normalizer pass before per-visual styling. You
can request stronger layout transforms via globalDefaults.layout:

- snapToGrid: true (default) — snap all positions to 8px multiples
- equalizeRowHeights: true (default) — visuals on same row get same height
- resolveOverlaps: true (default) — push overlapping visuals down
- clampToPageBounds: true (default) — shrink/move visuals that extend off page
- equalizeRowWidths: true — force same-width within a row (riskier; off by default)
- standardizeGutters: true — uniform gutters between row members (riskier)
- repackPageGrid: true — REPACK every page into a clean CSS-Grid-like
  layout: rows ordered top-to-bottom, x-positions re-flowed at uniform
  gutters from outer margin, widths shrunk if row exceeds page. Most
  transformative option. Use for reports that look "messy" in audit
  even after styling — it forces a genuine planned-layout look.
- gutter: number (default 16) — pixels between row members
- outerMargin: number (default 24) — pixels from page edge to first visual

OR use 'skip: true' instead of apply to leave a visual untouched. Always include a 'reason'.

# Output schema

Return ONLY valid JSON in this exact shape (no markdown, no code blocks):

\`\`\`
{
  "narrative": "Plain-English summary, 2-4 sentences. What you detected, what you'll change, what you'll leave alone.",
  "archetype": "executive_monitoring" | "analytical_explorer" | "operational_status" | "narrative_briefing" | "scorecard" | "presentation_screen",
  "confidence": "high" | "medium" | "low",
  "globalDefaults": {
    "ramp": "light" | "dark" | "warmLight",
    "accent": "#HEX",
    "fontPairing": "modern_sans" | "microsoft_default" | "editorial" | "numeric_focus",
    "chromeMode": "light" | "dark"
  },
  "rules": [
    {
      "id": "stable_short_id",
      "match": { ... },
      "apply": { ... }   OR   "skip": true,
      "reason": "Why this rule exists"
    }
  ]
}
\`\`\`

# Quality bar

- 6-15 rules per plan typically. Less than 4 = under-applied. More than 20 = mechanical.
- ALWAYS include skip rules for: actionButton, textbox, basicShape, image, shape, bookmarkNavigator, pageNavigator. These are user-curated content; the restyler should never touch them generically.
- The first matching rule wins for each visual. Order rules by specificity (skips first, then specific id matches, then type matches).
- For gauge/kpi/card/cardVisual: use 'chromeOnly' approach — chrome the container but DON'T set 'hideTitle' (their internal callout/title is purpose-built).
- If user provides brand accent color, use it as globalDefaults.accent AND for accentBar in KPI rules.
- If audit shows score < 50, be more aggressive (more rules). If score > 75, be conservative (only fix the actual issues).

# What you must NOT do

- Don't write generic "apply elevated chrome to every visual" rules. That's the mechanical approach we replaced you to fix.
- Don't include rules with no reason. Reason must be specific.
- Don't output anything except the JSON. No markdown fences, no commentary outside the JSON narrative field.
- Don't restyle action buttons, textboxes, images, shapes, navigators, custom visuals (their visualType doesn't match a known native type).`

// ── Helpers — build the user message ─────────────────────────────────────────

/**
 * Build a compact summary of the parsed report for the LLM. Avoid sending the
 * full PBIR (too large) — summarize structure + visuals.
 */
function summarizeForDirector(parsed, audit, brandKit, userPrompt, boldness, layoutIntensity) {
  if (!parsed) return ''

  // Per-page summary with up-to-30-visuals each (full reports may have hundreds)
  const pages = (parsed.pages || []).map(page => {
    const visuals = (page.visuals || []).slice(0, 30).map(v => ({
      id:         v.id,
      type:       v.visualType,
      x:          Math.round(v.position?.x || 0),
      y:          Math.round(v.position?.y || 0),
      w:          Math.round(v.position?.width  || 0),
      h:          Math.round(v.position?.height || 0),
      title:      readTitleText(v),
      measures:   firstFew(extractMeasures(v.fields)),
      categories: firstFew(extractCategories(v.fields)),
    }))
    return {
      name:       page.name,
      id:         page.id,
      visualCount: page.visuals?.length || 0,
      visuals,
    }
  })

  const context = {
    format:      parsed.format,
    pageCount:   pages.length,
    totalVisuals: pages.reduce((n, p) => n + p.visualCount, 0),
    pages,
    audit: audit ? {
      score:  audit.score,
      issues: (audit.issues || []).slice(0, 15).map(i => ({
        ruleId: i.ruleId, severity: i.severity, label: i.label, detail: i.detail,
      })),
    } : null,
    brandKit: brandKit || null,
    userIntent: userPrompt || 'No specific user instructions — apply your best premium judgement.',
    boldness:   boldness || 'balanced',
    layoutIntensity: layoutIntensity || 'preserve',
  }

  // Pre-extract exact page names + visualIds the LLM MUST use verbatim
  // when matching. Prevents the page-name hallucination bug observed in
  // the first Director runs ("Exec Dashboard" vs the real "Sales Dashboard").
  const exactPageNames = pages.map(p => p.name).filter(Boolean)
  const exactPageIds   = pages.map(p => p.id).filter(Boolean)

  // Boldness-specific guidance
  const boldnessGuidance =
    boldness === 'subtle' ?
      `BOLDNESS = SUBTLE. Be conservative. Maximum 6-8 rules. Do NOT use stripDataPointFills (preserve original colors). Hero size bumps modest (max +4pt). Apply chrome only to KPI cards, not charts. Goal: tighten without transforming.` :
    boldness === 'dramatic' ?
      `BOLDNESS = DRAMATIC. Be aggressive. 12-20 rules. USE stripDataPointFills on focal charts so brand palette takes over. Push hero sizes to 50-60pt. Apply page background overrides. Hide ALL gridlines. Replace original chart series colors. Goal: transform into a premium executive look that's clearly different from the input.` :
      `BOLDNESS = BALANCED (default). 8-13 rules. Apply chrome to KPIs + charts. Use stripDataPointFills on 1-2 focal charts (e.g. the most prominent trend chart). Hero size bumps moderate (44-50pt). Hide visual headers globally. Goal: visibly improved without being radical.`

  // Layout-intensity guidance — translates to globalDefaults.layout values
  const layoutGuidance =
    layoutIntensity === 'repack' ?
      `LAYOUT = REPACK. Set globalDefaults.layout = { snapToGrid:true, equalizeRowHeights:true, resolveOverlaps:true, clampToPageBounds:true, repackPageGrid:true, gutter:16, outerMargin:24 }. The applier will re-pack every page into a clean CSS-Grid-like layout — rows top-to-bottom, x-positions re-flowed at uniform gutters from outer margin, widths shrunk if a row exceeds page width. Use when the source report looks structurally messy.` :
    layoutIntensity === 'tidy' ?
      `LAYOUT = TIDY. Set globalDefaults.layout = { snapToGrid:true, equalizeRowHeights:true, resolveOverlaps:true, clampToPageBounds:true, gutter:16, outerMargin:24 }. The applier will snap to grid + equalize KPI row heights + push overlapping visuals apart + clamp visuals that extend off-page. Won't aggressively rearrange.` :
      `LAYOUT = PRESERVE (default). Set globalDefaults.layout = { snapToGrid:true, equalizeRowHeights:true }. Original positions kept beyond that.`

  return `# Report context

The report has these EXACT page names (use these strings verbatim if you reference \`match.page\`):
${exactPageNames.map(n => `  - "${n}"`).join('\n')}

EXACT page ids (use these for \`match.pageId\`):
${exactPageIds.map(n => `  - "${n}"`).join('\n')}

PREFERRED MATCH STRATEGY: position-based (\`yMax\`, \`xMax\`, \`family\`) and visualType matching are MORE PORTABLE than page-name matching. A rule like \`{ visualType: "card", yMax: 200 }\` matches all top-row KPI cards regardless of page name. Use page names only when you need to scope to ONE specific page.

CRITICAL: NEVER invent page names. If you reference \`match.page\`, the value MUST appear in the exact-names list above. Inventing names like "Exec Dashboard" when the actual page is named differently means the rule never fires and the visual is left untouched.

# Boldness directive
${boldnessGuidance}

# Layout directive
${layoutGuidance}

# Parsed report

\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\`

Now produce the design plan as JSON. Output ONLY JSON, no markdown fences, no commentary outside the narrative field.`
}

function readTitleText(v) {
  const env = v.visualContainerObjects?.title?.[0]?.properties?.text?.expr?.Literal?.Value
                ?? v.visualContainerObjects?.title?.[0]?.properties?.text
  if (typeof env === 'string') return env.replace(/^'|'$/g, '')
  return null
}

function extractMeasures(fields) {
  if (!fields) return []
  const out = []
  for (const role of Object.values(fields)) {
    if (!Array.isArray(role)) continue
    for (const f of role) if (f.kind === 'measure') out.push(f.measure || f.displayName)
  }
  return out
}
function extractCategories(fields) {
  if (!fields) return []
  const out = []
  for (const role of Object.values(fields)) {
    if (!Array.isArray(role)) continue
    for (const f of role) if (f.kind === 'column') out.push(f.column || f.displayName)
  }
  return out
}
function firstFew(arr, n = 3) {
  return Array.isArray(arr) ? arr.slice(0, n) : []
}

// ── JSON extraction (LLMs sometimes wrap in code fences despite instructions) ──

function extractJsonObject(text) {
  if (!text || typeof text !== 'string') return null
  // Try direct parse
  try { return JSON.parse(text) } catch { /* fall through */ }
  // Strip code fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1]) } catch { /* fall through */ }
  }
  // Find first { ... last }
  const first = text.indexOf('{')
  const last  = text.lastIndexOf('}')
  if (first >= 0 && last > first) {
    try { return JSON.parse(text.slice(first, last + 1)) } catch { /* fall through */ }
  }
  return null
}

// ── IPC handler ──────────────────────────────────────────────────────────────

async function generateDirectorPlan({ parsedSummary, audit, brandKit, userPrompt, provider, model, boldness, layoutIntensity }) {
  if (!parsedSummary) {
    return { success: false, message: 'parsedSummary is required' }
  }

  const userMessage = summarizeForDirector(parsedSummary, audit, brandKit, userPrompt, boldness || 'balanced', layoutIntensity || 'preserve')

  // Use the same provider-routing helpers App Generator uses (zero behavior
  // change to App Generator — these are exported by llm.js since 1b33a3f).
  const providerConfig = selectGenerationProvider(provider, model)
  if (!providerConfig?.apiKey && providerConfig?.provider !== 'local') {
    return { success: false, message: `Provider ${providerConfig?.provider || provider || 'unknown'} not configured. Add API key in Settings.` }
  }

  console.log(`[restyler-director] LLM call via ${providerConfig.provider} / ${providerConfig.model}`)

  let llmResponse
  try {
    llmResponse = await callAnyProvider(
      providerConfig,
      userMessage,
      DIRECTOR_SYSTEM_PROMPT,
      8000,                    // max tokens — plans are 1-3kb typically
    )
  } catch (err) {
    // parseAiResponse throws when LLM returns non-JSON. The error message
    // already contains a 160-char preview from the LLM, which is the
    // most diagnostic info we can return.
    return { success: false, message: `LLM call failed: ${err.message}` }
  }

  // callAnyProvider returns { config: <already-parsed object>, usage }
  // — the provider-specific generators (generateWithClaude/Gemini/etc.) all
  // pipe through parseAiResponse() which JSON.parse()s the LLM output.
  // So `config` IS the plan object — no second parse needed.
  const plan = llmResponse?.config
  if (!plan || typeof plan !== 'object') {
    return { success: false, message: 'Director returned an empty/invalid plan' }
  }

  return {
    success:  true,
    plan,
    provider: providerConfig.provider,
    model:    providerConfig.model,
    usage:    llmResponse?.usage || null,
  }
}

function register() {
  ipcMain.handle('pbi-restyler-ai-plan', (_e, p) => generateDirectorPlan(p || {}))
  console.log('[restyler-director] IPC registered (pbi-restyler-ai-plan)')
}

module.exports = {
  register,
  generateDirectorPlan,
  DIRECTOR_SYSTEM_PROMPT,
}
