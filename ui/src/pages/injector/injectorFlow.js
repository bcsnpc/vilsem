/**
 * injectorFlow — the publish pipeline applied to ONE existing report.
 * ─────────────────────────────────────────────────────────────────────
 * Difference from publishHtmlContentFlow:
 *   - Doesn't create a new report — appends visuals into an existing one
 *   - Doesn't replace the _SemanticaGenerated table — merges measures
 *   - Doesn't touch existing pages, visuals, or other parts
 *
 * Reuses everything else: visual rendering, TMDL injection, HTML Content
 * visual binding, custom visual registration. PBIR (modern) only — legacy
 * is being deprecated by Microsoft (Jan 2026 default switch).
 *
 * Flow:
 *   1. Render each Semantica visual to HTML via htmlTemplates/
 *   2. Pull dataset TMDL → merge measures in → push back
 *   3. Pull report parts → append visual.json files for the target page
 *      → register HTML Content visual on report.json if missing → push back
 *
 * Returns:
 *   {
 *     success:            true,
 *     reportId:           string,
 *     measuresByVisualId: { [visualId]: measureName },
 *     injectedVisualIds:  string[]
 *   }
 */

import { renderVisualToHtml } from '../powerbi/htmlTemplates/index.js'
import {
  mergeNamedMeasuresIntoTmdlParts, measureNameForVisual,
  secondaryMeasureNameForVisual, tertiaryMeasureNameForVisual, tableMeasureNameForVisual,
} from '../powerbi/tmdlMeasureInjector.js'
import { buildDataOnlyDax, buildPrimitiveSpecJson, isPrimitiveCovered } from '../powerbi/daxTemplateBuilder.js'
import {
  buildVisualJson,
  ensureHtmlContentRegistered,
  ensureSemanticaRendererRegistered,
  isReportJsonPath,
  visualIdSlug,
  pageDirName,
  safeParse,
  HTML_CONTENT_VISUAL_GUID,
  SEMANTICA_GENERATED_TABLE,
} from '../powerbi/reportBuilder_htmlcontent.js'

const KNOWN_VISUAL_TYPES = new Set([
  'kpi', 'bar', 'stacked_bar', 'line', 'area', 'donut', 'gauge',
  'radar', 'scatter', 'treemap', 'funnel', 'sankey', 'table',
])

function parseDimensionString(dim) {
  if (!dim || typeof dim !== 'string') return null
  const m = dim.match(/^(.+?)\[(.+)\]$/)
  return m ? { table: m[1], column: m[2] } : null
}

/**
 * @param {Object} args
 * @param {Object} args.report             — { id, name, workspaceId, datasetId }
 * @param {Array}  args.reportParts        — pre-fetched PBIR parts (from pbiGetReportDefinitionV2)
 * @param {string} args.format             — 'PBIR' | 'PBIR-Legacy' (parser's output)
 * @param {string} args.targetPageDir      — page directory name (e.g. 'ReportSection1')
 * @param {Array}  args.visuals            — Semantica visuals: [{ id, type, measures, dimension, x, y, width, height, ... }]
 * @param {string} [args.theme]            — 'dark' | 'light' (default 'dark')
 * @param {Function} [args.onProgress]     — (pct, stageText) => void
 */
export async function injectVisualsIntoReport({
  report,
  reportParts,
  format,
  targetPageDir,
  visuals,
  theme = 'dark',
  onProgress,
}) {
  const report_ = (pct, stage) => {
    if (typeof onProgress === 'function') {
      try { onProgress(pct, stage) } catch { /* ignore */ }
    }
  }

  // ── Guard rails ─────────────────────────────────────────────────────────
  if (format !== 'PBIR' && format !== 'PBIR-Legacy') {
    throw new Error(`Unknown report format: ${format}`)
  }
  if (!report?.id || !report?.workspaceId) {
    throw new Error('report.id and report.workspaceId are required')
  }
  if (!report?.datasetId) {
    throw new Error('report.datasetId is required (the report must be bound to a semantic model)')
  }
  if (!Array.isArray(reportParts) || reportParts.length === 0) {
    throw new Error('reportParts is empty (call pbiGetReportDefinitionV2 first)')
  }
  if (!targetPageDir) throw new Error('targetPageDir is required')
  if (!Array.isArray(visuals) || visuals.length === 0) {
    throw new Error('visuals[] is empty')
  }
  const renderable = visuals.filter((v) => Array.isArray(v.measures) && v.measures.length > 0)
  if (renderable.length === 0) {
    throw new Error('No injectable visuals — each visual needs at least one measure')
  }
  if (renderable.length !== visuals.length) throw new Error('Every selected visual needs at least one measure; no visuals were inserted.')
  const ids = new Set()
  for (const visual of visuals) {
    if (!visual.id || ids.has(visual.id)) throw new Error('Selected visuals must have distinct, non-empty IDs.')
    ids.add(visual.id)
  }
  // Validate the destination before any query or semantic-model mutation.
  const reportEntry = reportParts.find(p => isReportJsonPath(p.path))
  const reportJson = reportEntry && safeParse(reportEntry.content)
  if (!reportJson || typeof reportJson !== 'object' || Array.isArray(reportJson)) throw new Error('The existing report.json is missing or invalid; reload the report before inserting.')
  if (format === 'PBIR') {
    const page = reportParts.find(p => p.path === `definition/pages/${targetPageDir}/page.json`)
    const pageJson = page && safeParse(page.content)
    if (!pageJson || pageJson.name !== targetPageDir) throw new Error(`Target page "${targetPageDir}" is missing or invalid; reload the report before inserting.`)
  } else if (!reportJson.sections?.some(s => s.name === targetPageDir || s.displayName === targetPageDir)) {
    throw new Error(`Target page "${targetPageDir}" not found in legacy sections`)
  }
  if (!window.semantica?.pbismGetDefinition) {
    throw new Error('pbismGetDefinition IPC unavailable (restart desktop app)')
  }

  // ── 1. Build one or more measures per visual ────────────────────────────
  //   PBIR chart-covered types WITH a category → live DATA measures +
  //   primitiveSpec (interactive cross-filtering). Everything else (KPI, gauge
  //   w/o category, legacy reports) → baked HTML measure — the proven path,
  //   byte-for-byte unchanged.
  report_(5, 'Querying data + rendering visuals…')
  const named = []                        // [{ name, body, isRawDax }] — merged, never rebuilt
  const measuresByVisualId          = {}
  const secondaryMeasuresByVisualId = {}
  const tertiaryMeasuresByVisualId  = {}
  const tableMeasureNamesByVisualId = {}
  const specsByVisualId             = {}  // primitiveSpec JSON per chart visual
  // Existing-report insertion still uses static HTML. Modern PBIR private visuals
  // now render in the isolated Service gallery after resource-path corrections
  // (docs/qa/visual-cycles.md). Enabling primitives here also requires validating
  // insertion bindings, resource registration and native-filter compatibility.
  const usePrimitive = false
  let done = 0

  for (const v of renderable) {
    const cfg = v.config || {}
    const hasAxisSwitcher = Array.isArray(cfg.axisOptions) && cfg.axisOptions.some(o => o?.groupBy?.table && o?.groupBy?.column)
    const hasCategory = !!(v.dimension || (Array.isArray(v.dimensions) && v.dimensions.length))
    let handled = false

    if (usePrimitive && isPrimitiveCovered(v.type) && !hasAxisSwitcher && hasCategory) {
      try {
        if (v.type === 'table') {
          const dax = (v.measures || []).map((_, i) => buildDataOnlyDax(v, i)).filter(Boolean)
          if (dax.length) {
            const names = dax.map((_, i) => tableMeasureNameForVisual(v.id, i))
            dax.forEach((d, i) => named.push({ name: names[i], body: d, isRawDax: true }))
            tableMeasureNamesByVisualId[v.id] = names
            specsByVisualId[v.id] = buildPrimitiveSpecJson(v, theme)
            handled = true
          }
        } else {
          const d0 = buildDataOnlyDax(v, 0)
          if (d0 && d0.trim()) {
            const cn = measureNameForVisual(v.id)
            named.push({ name: cn, body: d0, isRawDax: true }); measuresByVisualId[v.id] = cn
            specsByVisualId[v.id] = buildPrimitiveSpecJson(v, theme)
            const d1 = buildDataOnlyDax(v, 1); if (d1 && d1.trim()) { const sn = secondaryMeasureNameForVisual(v.id); named.push({ name: sn, body: d1, isRawDax: true }); secondaryMeasuresByVisualId[v.id] = sn }
            const d2 = buildDataOnlyDax(v, 2); if (d2 && d2.trim()) { const tn = tertiaryMeasureNameForVisual(v.id); named.push({ name: tn, body: d2, isRawDax: true }); tertiaryMeasuresByVisualId[v.id] = tn }
            handled = true
          }
        }
      } catch (e) { console.warn('[injectorFlow] primitive build failed for', v.id, e?.message) }
    }

    if (!handled) {
      // Baked-HTML content measure (identical to the proven inject path).
      try {
        const dim = parseDimensionString(v.dimension)
        const q = dim
          ? await window.semantica.queryTable({ groupBy: [v.dimension], measures: v.measures, filters: {}, limit: v.limit || 25, orderBy: v.orderBy || 'desc' })
          : await window.semantica.query({ measures: v.measures, filters: {} })
        if (!q || q.error || q.success === false) throw new Error(q?.message || 'Data query failed')
        const html = renderVisualToHtml(v, q, theme) || ''
        if (!html.trim()) throw new Error('Visual preparation returned empty content')
        const cn = measureNameForVisual(v.id)
        named.push({ name: cn, body: html, isRawDax: false }); measuresByVisualId[v.id] = cn
      } catch (e) {
        throw new Error(`Could not prepare visual ${v.id}: ${e?.message || 'Unknown rendering error'}`)
      }
    }
    done++
    report_(5 + Math.round((done / renderable.length) * 15), 'Preparing measures…')
  }

  // ── 2. Fetch dataset TMDL ───────────────────────────────────────────────
  report_(25, 'Fetching dataset TMDL…')
  const defRes = await window.semantica.pbismGetDefinition({
    workspaceId: report.workspaceId, datasetId: report.datasetId, format: 'TMDL',
  })
  if (!defRes?.success) {
    throw new Error('pbismGetDefinition failed: ' + (defRes?.message || 'unknown'))
  }

  // ── 3. MERGE measures into _SemanticaGenerated (preserves prior visuals) ─
  report_(40, 'Merging measures into dataset…')
  const { parts: newTmdlParts } = mergeNamedMeasuresIntoTmdlParts(defRes.parts, named)

  // ── 4. Push updated TMDL ────────────────────────────────────────────────
  report_(55, 'Updating dataset…')
  const tmdlRes = await window.semantica.pbismUpdateDefinition({
    workspaceId: report.workspaceId, datasetId: report.datasetId, parts: newTmdlParts,
  })
  if (!tmdlRes?.success) {
    throw new Error('pbismUpdateDefinition failed: ' + (tmdlRes?.message || 'unknown'))
  }

  // ── 4b. Real-renderer embed (PBIR only) ────────────────────────────────
  // If any visual took the primitive/chart path, embed our custom-visual binary
  // so injected charts render as live ECharts (reading primitiveSpec) instead of
  // the static HTML-Content visual. Legacy reports bake HTML and need no binary.
  // Falls back to HTML-Content if the binary can't be loaded (non-fatal).
  let rendererGuid = null
  let customVisualParts = []
  if (format === 'PBIR' && Object.keys(specsByVisualId).length > 0) {
    try {
      const cv = await window.semantica.pbiGetCustomVisualParts()
      if (cv?.success && cv.guid && Array.isArray(cv.parts) && cv.parts.length) {
        rendererGuid = cv.guid
        customVisualParts = cv.parts
        report_(72, 'Embedding vilsem renderer…')
      } else {
        console.warn('[injectorFlow] custom-visual parts unavailable — charts fall back to HTML-Content:', cv?.message)
      }
    } catch (e) {
      console.warn('[injectorFlow] pbiGetCustomVisualParts failed — charts fall back to HTML-Content:', e?.message)
    }
  }

  // ── 5. Build new visual parts + register the custom visual ─────────────
  report_(75, 'Building visual JSON files…')
  const newReportParts = format === 'PBIR-Legacy'
    ? injectIntoLegacyReport({
        reportParts,
        targetPageId: targetPageDir,
        visuals: renderable,
        measuresByVisualId,
      })
    : injectVisualPartsIntoReport({
        reportParts,
        targetPageDir,
        visuals: renderable,
        measuresByVisualId,
        secondaryMeasuresByVisualId,
        tertiaryMeasuresByVisualId,
        tableMeasureNamesByVisualId,
        specsByVisualId,
        rendererGuid,
        customVisualParts,
      })

  // ── 6. Push updated report ──────────────────────────────────────────────
  report_(90, 'Updating report…')
  const upRes = await window.semantica.pbiUpdateReportDefinition({
    workspaceId: report.workspaceId, reportId: report.id, parts: newReportParts,
  })
  if (!upRes?.success) {
    throw new Error('pbiUpdateReportDefinition failed: ' + (upRes?.message || 'unknown'))
  }

  report_(100, 'Done')
  return {
    success:            true,
    reportId:           report.id,
    measuresByVisualId,
    injectedVisualIds:  renderable.map((v) => v.id),
  }
}

/**
 * Pure transform: take existing report parts, append one visual.json per
 * Semantica visual under the target page, and ensure the HTML Content
 * custom visual is registered in report.json. Doesn't touch any other parts.
 */
function injectVisualPartsIntoReport({ reportParts, targetPageDir, visuals, measuresByVisualId, secondaryMeasuresByVisualId = {}, tertiaryMeasuresByVisualId = {}, tableMeasureNamesByVisualId = {}, specsByVisualId = {}, rendererGuid = null, customVisualParts = [] }) {
  const out = []
  let reportJsonHandled = false

  for (const part of reportParts) {
    if (isReportJsonPath(part.path)) {
      // Register the custom visual(s) in publicCustomVisuals (idempotent).
      // HTML-Content for baked visuals; Semantica Renderer when we embed it.
      const parsed  = safeParse(part.content) || {}
      let updated   = ensureHtmlContentRegistered(parsed)
      if (rendererGuid) updated = ensureSemanticaRendererRegistered(updated, rendererGuid)
      out.push({ path: part.path, content: JSON.stringify(updated, null, 2) })
      reportJsonHandled = true
    } else {
      out.push({ ...part })
    }
  }

  if (!reportJsonHandled) {
    console.warn('[injectorFlow] report.json not found in parts — HTML Content visual may not register')
  }

  // Collect existing visual folder names on the target page so injected folders
  // never collide with a native visual — a same-path collision makes Fabric
  // reject the whole update with DuplicateDefinitionParts.
  const usedSlugs = new Set()
  const visPrefix = `definition/pages/${targetPageDir}/visuals/`
  for (const p of out) {
    if (p.path.startsWith(visPrefix)) {
      const rest = p.path.slice(visPrefix.length)
      const dir = rest.slice(0, rest.indexOf('/'))
      if (dir) usedSlugs.add(dir)
    }
  }
  const uniqueSlug = (base) => {
    let s = base || `v${Math.random().toString(36).slice(2, 8)}`
    if (!usedSlugs.has(s)) { usedSlugs.add(s); return s }
    let i = 2
    while (usedSlugs.has(`${s}_${i}`)) i++
    const u = `${s}_${i}`; usedSlugs.add(u); return u
  }

  // Append new visual.json parts under the target page directory.
  // Path shape: definition/pages/<pageDir>/visuals/<visualSlug>/visual.json
  for (const v of visuals) {
    const ctx = { measuresByVisualId, secondaryMeasuresByVisualId, tertiaryMeasuresByVisualId, tableMeasureNamesByVisualId, specsByVisualId, rendererGuid }
    const slug = uniqueSlug(visualIdSlug(v.id))
    const visualJson = buildVisualJson(v, ctx)
    visualJson.name = slug   // the folder name must equal the visual's `name`
    out.push({
      path:    `definition/pages/${targetPageDir}/visuals/${slug}/visual.json`,
      content: JSON.stringify(visualJson, null, 2),
    })
  }

  // Embed the custom-visual binary parts (CustomVisuals/<guid>/…) so the report
  // is self-contained. They arrive already base64-encoded ({path, payload,
  // payloadType}); encodeParts() on the IPC side passes them through unchanged.
  // Idempotent: skip any path already present (re-inject / already embedded).
  if (customVisualParts.length) {
    const seen = new Set(out.map((p) => p.path))
    for (const p of customVisualParts) {
      if (!seen.has(p.path)) { out.push(p); seen.add(p.path) }
    }
  }

  // Grow the target page so injected visuals placed below existing content stay
  // visible — PBI does NOT auto-expand a page to fit newly-added visuals. Only
  // ever grow (never shrink), so existing content is never clipped.
  let maxBottom = 0
  for (const v of visuals) {
    const b = (Number(v.y) || 0) + (Number(v.height) || 0)
    if (b > maxBottom) maxBottom = b
  }
  if (maxBottom > 0) {
    const pagePath = `definition/pages/${targetPageDir}/page.json`
    const idx = out.findIndex((p) => p.path === pagePath)
    if (idx >= 0) {
      const pj = safeParse(out[idx].content) || {}
      const needed = Math.ceil(maxBottom + 40)   // pad below the last injected visual
      if (!(Number(pj.height) >= needed)) {
        pj.height = needed
        out[idx] = { path: pagePath, content: JSON.stringify(pj, null, 2) }
      }
    }
  }

  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// PBIR-Legacy injection
// ─────────────────────────────────────────────────────────────────────────────
//
// Legacy reports keep everything inside a single `report.json` (or
// `definition/report.json`) where each visual is a string-encoded `config`
// blob inside `sections[].visualContainers[]`. To inject:
//
//   1. Find report.json
//   2. Find the target section by `name` or `displayName`
//   3. Append a new visualContainer with config = JSON.stringify({...})
//      bound to the HTML Content visual's `content` data role
//   4. Register HTML_CONTENT_VISUAL_GUID in `publicCustomVisuals[]`
//
// All other parts pass through unchanged.

function injectIntoLegacyReport({ reportParts, targetPageId, visuals, measuresByVisualId }) {
  // Legacy report.json may live at the root or under definition/. The parser
  // tolerates both — match whichever one is present.
  const reportEntry = reportParts.find((p) =>
    p.path === 'report.json' ||
    p.path === 'definition/report.json' ||
    /(^|\/)report\.json$/i.test(p.path),
  )
  if (!reportEntry) throw new Error('report.json not found in legacy report parts')

  const report = safeParse(reportEntry.content)
  if (!report || !Array.isArray(report.sections)) {
    throw new Error('report.json has no sections (legacy)')
  }

  // Resolve the target section. UI passes the parser's normalized id, which
  // for legacy is `section.name` (e.g. "ReportSection"). Fall back to
  // displayName for safety.
  const section = report.sections.find((s) => s.name === targetPageId)
               || report.sections.find((s) => s.displayName === targetPageId)
  if (!section) throw new Error(`Target page "${targetPageId}" not found in legacy sections`)
  if (!Array.isArray(section.visualContainers)) section.visualContainers = []

  // Register HTML Content visual (idempotent)
  if (!Array.isArray(report.publicCustomVisuals)) report.publicCustomVisuals = []
  if (!report.publicCustomVisuals.includes(HTML_CONTENT_VISUAL_GUID)) {
    report.publicCustomVisuals.push(HTML_CONTENT_VISUAL_GUID)
  }

  // Append one container per visual
  for (const v of visuals) {
    const measureName = measuresByVisualId[v.id]
    if (!measureName) continue
    section.visualContainers.push(buildLegacyHtmlContentContainer(v, measureName))
  }

  // Re-serialize report.json. Other parts pass through.
  return reportParts.map((p) => p === reportEntry
    ? { ...p, content: JSON.stringify(report) }
    : p,
  )
}

/**
 * Build a legacy-format visualContainer pointing at the HTML Content visual,
 * bound to one _SemanticaGenerated[<measureName>] measure on the `content` role.
 *
 * Mirrors the shape that publishCustomVisualFlow.js produces for the Semantica
 * Renderer custom visual, but with HTML_CONTENT_VISUAL_GUID and the lone
 * `content` projection role.
 */
function buildLegacyHtmlContentContainer(visual, measureName) {
  const w = Number(visual.width)  > 0 ? Number(visual.width)  : 420
  const h = Number(visual.height) > 0 ? Number(visual.height) : 280
  const x = Number(visual.x) || 0
  const y = Number(visual.y) || 0
  const z = 2000

  const slug = visualIdSlug(visual.id) + Math.random().toString(36).slice(2, 8)

  // Inner singleVisual config — the part Power BI parses to render the visual
  const innerConfig = {
    name: slug,
    layouts: [{
      id: 0,
      position: { x, y, z, width: w, height: h, tabOrder: z },
    }],
    singleVisual: {
      visualType: HTML_CONTENT_VISUAL_GUID,
      projections: {
        content: [{ queryRef: `${SEMANTICA_GENERATED_TABLE}.${measureName}` }],
      },
      prototypeQuery: {
        Version: 2,
        From: [{ Name: '_', Entity: SEMANTICA_GENERATED_TABLE, Type: 0 }],
        Select: [{
          Measure: { Expression: { SourceRef: { Source: '_' } }, Property: measureName },
          Name: `${SEMANTICA_GENERATED_TABLE}.${measureName}`,
          NativeReferenceName: measureName,
        }],
      },
      drillFilterOtherVisuals: true,
      // HTML Content visual's own properties — render HTML, no hyperlinks
      objects: {
        contentFormatting: [{
          properties: {
            showRawHtml: { expr: { Literal: { Value: 'false' } } },
            hyperlinks:  { expr: { Literal: { Value: 'false' } } },
          },
        }],
      },
      // vcObjects = container chrome. Hide PBI's white background + header
      // so the HTML's own card design fills the visual rectangle.
      vcObjects: {
        background:   [{ properties: { show: { expr: { Literal: { Value: 'false' } } } } }],
        visualHeader: [{ properties: { show: { expr: { Literal: { Value: 'false' } } } } }],
      },
    },
  }

  return {
    x, y, z, width: w, height: h, tabOrder: z,
    config:  JSON.stringify(innerConfig),
    filters: '[]',
  }
}

/**
 * Helper for the UI: extract pages from PBIR parts so the user can pick one.
 * Returns [{ dirName, displayName, width, height, visualCount }].
 */
export function extractPagesFromParts(reportParts) {
  if (!Array.isArray(reportParts)) return []
  const pages = {}

  for (const part of reportParts) {
    const pageMatch = part.path.match(/^definition\/pages\/([^/]+)\/page\.json$/)
    if (pageMatch) {
      const dirName = pageMatch[1]
      const parsed  = safeParse(part.content) || {}
      pages[dirName] = pages[dirName] || { dirName, visualCount: 0 }
      pages[dirName].displayName = parsed.displayName || dirName
      pages[dirName].width       = Number(parsed.width)  || 1280
      pages[dirName].height      = Number(parsed.height) || 720
      continue
    }
    const visualMatch = part.path.match(/^definition\/pages\/([^/]+)\/visuals\//)
    if (visualMatch) {
      const dirName = visualMatch[1]
      pages[dirName] = pages[dirName] || { dirName, visualCount: 0 }
      // count distinct visual dirs, not parts (each visual has a few files)
      pages[dirName].visualCount = (pages[dirName].visualCount || 0) + 1
    }
  }

  return Object.values(pages).filter((p) => p.displayName !== undefined)
}

/**
 * Normalize a target page reference. Caller may provide a page directory
 * name (preferred) or a Semantica-style page id — fall back to slugged dir
 * if the parts don't include a page.json with a matching displayName.
 */
export function resolveTargetPageDir(reportParts, requested) {
  const pages = extractPagesFromParts(reportParts)
  // Direct match by dirName
  const direct = pages.find((p) => p.dirName === requested)
  if (direct) return direct.dirName
  // Match by displayName (case-insensitive)
  const lower = String(requested || '').toLowerCase()
  const byName = pages.find((p) => (p.displayName || '').toLowerCase() === lower)
  if (byName) return byName.dirName
  // Default: first page
  return pages[0]?.dirName || pageDirName(requested, 0)
}
