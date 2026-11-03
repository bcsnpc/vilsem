// Export a single vilsem visual as a self-contained Power BI .pbiviz.
//
// The user imports the resulting package into Power BI (per-report or as an
// Organizational visual) and binds the fields listed in the guide. Power BI
// queries the model from those fields; the spec baked into the package draws the
// chart. No API inject, no DAX to write.

import { buildPrimitiveSpecJson, isPrimitiveCovered } from './daxTemplateBuilder.js'

// The model fields the user must bind in Power BI for this visual to render.
export function bindingGuideFor(visual) {
  const d = visual?.data || {}
  const drill = Array.isArray(d.drill) ? d.drill.filter(x => x?.table && x?.column) : []
  const barFamily = ['bar', 'column', 'grouped_bar', 'stacked_bar'].includes(visual?.type)
  const dims = barFamily && drill.length >= 2
    ? drill.map(x => `${x.table}[${x.column}]`)
    : (Array.isArray(d.dimensions) && d.dimensions.length)
    ? d.dimensions.filter(x => x?.table && x?.column).map(x => `${x.table}[${x.column}]`)
    : (d.groupBy?.table && d.groupBy?.column ? [`${d.groupBy.table}[${d.groupBy.column}]`] : [])
  // Bar race carries its time/frame axis outside data.dimensions — surface it too.
  if (visual?.type === 'bar_race') {
    const t = visual?.config?.playAxis || d.frameBy
    const tRef = typeof t === 'string' ? t : (t?.table && t?.column ? `${t.table}[${t.column}]` : null)
    if (tRef && !dims.includes(tRef)) dims.unshift(tRef)
  }
  const measures = Array.isArray(d.measures) ? d.measures.filter(Boolean) : []
  // Map to the ACTUAL Power BI field wells the semanticaRenderer exposes, so the
  // guide names match what the user sees (Content / Secondary / Tertiary for
  // measures; Category / Category 2 … for dimensions).
  const MEASURE_WELLS = ['Content', 'Secondary', 'Tertiary']
  const wells = []
  const table = visual?.type === 'table'
  measures.slice(0, table ? 10 : 3).forEach((m, i) => wells.push({ well: table ? 'Content' : MEASURE_WELLS[i], field: m }))
  dims.slice(0, 6).forEach((ref, i) => wells.push({ well: i === 0 ? 'Category' : `Category ${i + 1}`, field: ref }))
  return { wells, dims, measures }
}

// Normalize the authored visual into the shape buildPrimitiveSpec expects
// (top-level measures + dimension/dimensions), then serialize to a spec string.
export function specForExport(visual, theme = 'light') {
  if (!isPrimitiveCovered(visual?.type)) throw new Error(`Power BI custom visual export is not supported for ${visual?.type || 'this visual'} yet. No package was saved.`)
  const { dims, measures } = bindingGuideFor(visual)
  const maxMeasures = visual?.type === 'table' ? 10 : 3
  if (measures.length > maxMeasures) throw new Error(`Power BI visual export supports up to ${maxMeasures} measures for ${visual.type}. Remove extra measures before exporting; no package was saved.`)
  if (dims.length > 6) throw new Error('Power BI visual export supports up to six category fields. Remove extra dimensions before exporting; no package was saved.')
  const forSpec = {
    type: visual?.type,
    config: visual?.config || {},
    measures,
    dimension: dims[0] || null,
    dimensions: dims,
    data: { drill: visual?.data?.drill },
  }
  return buildPrimitiveSpecJson(forSpec, theme)
}

// Run the export (opens a native Save dialog via the desktop IPC).
export async function exportVisualPbiviz(visual, theme = 'light') {
  if (!window.semantica?.pbiExportVisualPackage) {
    return { success: false, message: 'Export is only available in the desktop app.' }
  }
  const title = visual?.config?.title || visual?.config?.label || (visual?.type || 'visual')
  const spec = specForExport(visual, theme)
  const res = await window.semantica.pbiExportVisualPackage({ spec, title, fileBase: title })
  return { ...res, guide: bindingGuideFor(visual), title }
}
