import primitiveVisualTypes from './primitiveVisualTypes.json' with { type: 'json' }
export const PRIMITIVE_COVERED_TYPES = new Set(primitiveVisualTypes)

export function isPrimitiveCovered(visualType) {
  return PRIMITIVE_COVERED_TYPES.has(visualType)
}

export function buildPrimitiveSpec(visual, canvasTheme = 'dark') {
  const config = { ...(visual?.config || {}) }
  // Strip web-only runtime keys
  for (const k of Object.keys(config)) {
    if (k.startsWith('_')) delete config[k]
  }
  // Strip null-valued keys to keep the JSON small
  for (const k of Object.keys(config)) {
    if (config[k] === null) delete config[k]
  }
  const measures = visual?.measures || visual?.data?.measures || []
  // Click-to-drill hierarchy (interaction-plays). When present (≥2 levels) the
  // publish flow binds every level to category1..N, and the .pbiviz re-aggregates
  // client-side on click (drillStyle rides in config). Absent → visual unchanged.
  const drillRaw = Array.isArray(visual?.drill) ? visual.drill
    : (Array.isArray(visual?.data?.drill) ? visual.data.drill : null)
  const drill = drillRaw
    ? drillRaw.filter(d => d?.table && d?.column).map(d => ({ table: d.table, column: d.column }))
    : null
  return {
    version: 1,
    type: visual?.type,
    // Phase 5.3: carry the canvas theme so the .pbiviz uses the same dark/light
    // tokens as Semantica without relying on host.colorPalette inference (which
    // doesn't always reflect Semantica's actual canvas in PBI Service).
    canvasTheme: canvasTheme === 'light' ? 'light' : 'dark',
    config,
    ...(drill && drill.length >= 2 ? { drill } : {}),
    measures: {
      primary:   measures[0] || null,
      secondary: measures[1] || null,
      tertiary:  measures[2] || null,
      // Full ordered list — table visual reads this for dynamic N measure labels.
      all: measures,
    },
  }
}

/**
 * Convenience: returns the JSON-stringified spec ready to embed in a Power BI
 * report-visual property. The .pbiviz reads it via
 * `dataView.metadata.objects.semantica.primitiveSpec` (declared in capabilities.json).
 */
export function buildPrimitiveSpecJson(visual, canvasTheme = 'dark') {
  return JSON.stringify(buildPrimitiveSpec(visual, canvasTheme))
}
