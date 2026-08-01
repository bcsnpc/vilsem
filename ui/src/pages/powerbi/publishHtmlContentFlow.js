/**
 * publishHtmlContentFlow — reusable HTML Content publish pipeline
 * ─────────────────────────────────────────────────────────────────
 * Extracted from ReportEditor.jsx:handlePublishHtmlContent so both
 * Power BI Mode (ReportEditor) and App Generator (Publish-to-PBI button)
 * can call the same implementation.
 *
 * Pipeline (6 stages, reports progress via onProgress callback):
 *   1. Pre-render HTML for each visual via htmlTemplates
 *   2. Fetch current dataset TMDL (pbismGetDefinition)
 *   3. Inject/replace _SemanticaGenerated table with one measure per visual
 *   4. Push updated TMDL back (pbismUpdateDefinition)
 *   5. Build PBIR report parts (reportBuilder_htmlcontent)
 *   6. Create or update the Power BI report
 *
 * Returns { success, reportId, reportName, measuresByVisualId, tableName }
 * on success, or throws with a descriptive Error on failure.
 */

import { renderVisualToHtml } from './htmlTemplates/index.js'
import { mergeTmdlPartsWithSemanticaTable, mergeTmdlPartsWithLiveDax } from './tmdlMeasureInjector.js'
import { buildHtmlContentReportParts } from './reportBuilder_htmlcontent.js'
import { buildLiveDax } from './daxTemplateBuilder.js'

// Canonical visual types that have dedicated renderers. Must stay in sync
// with TEMPLATE_MAP in htmlTemplates/index.js. Anything outside this set
// triggers a warning and uses the fallback card (publish still succeeds).
const KNOWN_VISUAL_TYPES = new Set([
  'kpi', 'bar', 'stacked_bar', 'line', 'area', 'donut', 'gauge',
  'radar', 'scatter', 'treemap', 'funnel', 'sankey', 'table',
])

/**
 * Parse "Table[Column]" string → { table, column }, or null if malformed.
 */
function parseDimensionString(dim) {
  if (!dim || typeof dim !== 'string') return null
  const m = dim.match(/^(.+?)\[(.+)\]$/)
  return m ? { table: m[1], column: m[2] } : null
}

/**
 * @typedef {Object} PublishArgs
 * @property {Array}    pages          — [{ id, name, visuals: [{ id, type, measures, dimension, x, y, width, height, limit, orderBy, config }] }]
 * @property {string}   workspaceId    — Fabric workspace GUID
 * @property {string}   datasetId      — Fabric dataset GUID (semantic model)
 * @property {string|null} reportId    — existing report id (update path) or null (create path)
 * @property {string}   reportName
 * @property {string}   [workspaceName]— display name, used only on new-report path
 * @property {string}   [datasetName]  — display name, used only on new-report path
 * @property {string}   [canvasTheme]  — 'dark' | 'light' (default 'dark')
 * @property {Array}    [originalParts]— PBIR parts for update path (optional; from pbiGetReportDefinitionV2)
 * @property {Function} [onProgress]   — (pctNumber, stageText) => void
 *
 * @returns {Promise<{ success: true, reportId, reportName, measuresByVisualId, tableName }>}
 */
export async function publishHtmlContentFlow({
  pages,
  workspaceId,
  datasetId,
  reportId       = null,
  reportName,
  workspaceName  = '',
  datasetName    = '',
  canvasTheme    = 'dark',
  originalParts  = null,
  onProgress,
  liveDax        = false,  // opt-in: live DAX measures for cross-filter (trade-off: simplified visuals)
}) {
  const report = (pct, stage) => {
    if (typeof onProgress === 'function') {
      try { onProgress(pct, stage) } catch { /* ignore progress errors */ }
    }
  }

  // Guard rails
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error('publishHtmlContentFlow: pages[] is empty')
  }
  if (!workspaceId || !datasetId) {
    throw new Error('publishHtmlContentFlow: workspaceId and datasetId are required')
  }
  if (!window.semantica?.pbismGetDefinition) {
    throw new Error('publishHtmlContentFlow: pbismGetDefinition IPC unavailable (restart desktop app)')
  }

  const anyRenderable = pages.some((p) =>
    (p.visuals || []).some((v) => Array.isArray(v.measures) && v.measures.length > 0)
  )
  if (!anyRenderable) {
    throw new Error('publishHtmlContentFlow: no visuals with measures to publish')
  }

  // ── 1. Render visuals ─────────────────────────────────────────────────
  // Two modes:
  //   DEFAULT (liveDax=false): pre-render static HTML via htmlTemplates/.
  //     Pixel-perfect match with Semantica editor + web export. Tooltips,
  //     cursor-following, full visual fidelity. No cross-filter (static).
  //   OPT-IN (liveDax=true): generate DAX expressions that produce HTML at
  //     query time. Cross-filter works but visuals are simplified (no SVG
  //     charts, no <style> hover tooltips — PBI strips them from measure values).
  const htmlByVisualId = {}
  const daxByVisualId  = {}
  const unknownTypes   = new Set()
  const totalVisuals   = pages.reduce((n, p) => n + (p.visuals?.length || 0), 0)
  let rendered = 0

  report(5, liveDax ? 'Building live DAX templates…' : 'Rendering visuals to HTML…')

  for (const page of pages) {
    for (const v of (page.visuals || [])) {
      if (!Array.isArray(v.measures) || v.measures.length === 0) continue
      if (v.type && !KNOWN_VISUAL_TYPES.has(v.type)) {
        unknownTypes.add(v.type)
      }

      if (liveDax) {
        // Live DAX mode: build DAX expression per visual
        try {
          daxByVisualId[v.id] = buildLiveDax(v)
        } catch (e) {
          console.warn('[publishHtmlContentFlow] DAX build failed for', v.id, e?.message)
          daxByVisualId[v.id] = `"<div style='color:#F87171;padding:20px'>DAX error</div>"`
        }
      } else {
        // Static HTML mode: pre-fetch data and render
        try {
          const dim = parseDimensionString(v.dimension)
          const queryResult = dim
            ? await window.semantica.queryTable({
                groupBy: [v.dimension],
                measures: v.measures,
                filters: {},
                limit:   v.limit || 25,
                orderBy: v.orderBy || 'desc',
              })
            : await window.semantica.query({ measures: v.measures, filters: {} })
          const renderedHtml = renderVisualToHtml(v, queryResult, canvasTheme || 'dark') || ''
          htmlByVisualId[v.id] = renderedHtml
          console.log(`[publishFlow] HTML for ${v.id} (${v.type}), theme=${canvasTheme}, length=${renderedHtml.length}`)
          if (v.type === 'bar') console.log('[publishFlow] BAR HTML SAMPLE:', renderedHtml.substring(0, 500))
        } catch (e) {
          console.warn('[publishHtmlContentFlow] render failed for', v.id, e?.message)
          htmlByVisualId[v.id] = ''
        }
      }

      rendered++
      report(5 + Math.round((rendered / Math.max(totalVisuals, 1)) * 15),
        liveDax ? 'Building live DAX templates…' : 'Rendering visuals to HTML…')
    }
  }
  if (unknownTypes.size > 0) {
    console.warn('[publishHtmlContentFlow] unknown visual types:', [...unknownTypes])
  }

  // ── 2. Fetch dataset TMDL ───────────────────────────────────────────────
  report(25, 'Fetching dataset TMDL…')
  const defRes = await window.semantica.pbismGetDefinition({ workspaceId, datasetId, format: 'TMDL' })
  if (!defRes?.success) {
    throw new Error('pbismGetDefinition failed: ' + (defRes?.message || 'unknown'))
  }

  // ── 3. Inject _SemanticaGenerated measures ────────────────────────────
  report(40, 'Injecting measures…')
  // MERGE (not replace) so other reports' _SemanticaGenerated measures survive.
  const { parts: newTmdlParts, measuresByVisualId, tableName } = liveDax
    ? mergeTmdlPartsWithLiveDax(defRes.parts, daxByVisualId)
    : mergeTmdlPartsWithSemanticaTable(defRes.parts, htmlByVisualId)

  // ── 4. Push updated TMDL ────────────────────────────────────────────────
  report(50, 'Updating dataset (adding HTML measures)…')
  const upRes = await window.semantica.pbismUpdateDefinition({
    workspaceId, datasetId, parts: newTmdlParts,
  })
  if (!upRes?.success) {
    throw new Error('pbismUpdateDefinition failed: ' + (upRes?.message || 'unknown'))
  }

  // ── 5. Build PBIR parts ─────────────────────────────────────────────────
  report(70, 'Building report parts…')
  // Pass theme to each page so PBI page background matches
  const themedPages = pages.map((p) => ({ ...p, theme: canvasTheme || 'dark' }))
  const parts = buildHtmlContentReportParts({
    originalParts,
    pages: themedPages,
    datasetId,
    reportName,
    workspaceName,
    datasetName,
    measuresByVisualId,
  })

  // ── 6. Publish report ───────────────────────────────────────────────────
  report(85, reportId ? 'Updating report…' : 'Creating report…')
  const res = reportId
    ? await window.semantica.pbiUpdateReportDefinition({ workspaceId, reportId, parts })
    : await window.semantica.pbiCreateReport({ workspaceId, reportName, parts })
  if (!res?.success) {
    throw new Error(res?.message || 'Report publish failed')
  }

  report(100, 'Done (HTML Content mode)')
  return {
    success:            true,
    reportId:           res.reportId,
    reportName:         res.reportName || reportName,
    measuresByVisualId,
    tableName,
  }
}
