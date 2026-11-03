import { validateTemplate } from '@vilsem/core/templates'

export const APP_SPEC_VERSION = '1.0'

export const VISUAL_TYPES = [
  'kpi', 'bar', 'stacked_bar', 'grouped_bar', 'column', 'line', 'area', 'stacked_area',
  'donut', 'pie', 'gauge', 'radar', 'scatter', 'bubble', 'treemap', 'funnel', 'sankey',
  'table', 'waterfall', 'lollipop', 'bullet', 'progress', 'heatmap', 'ranked_list',
  'stat_card', 'metric_tile', 'sparkline_kpi', 'slope', 'bump', 'chord', 'sunburst',
  'narrative', 'insight', 'waffle', 'bar_race', 'nav_button',
  // Canvas objects — non-data authorable elements (no measures, no card chrome).
  'text_box', 'shape', 'image', 'divider', 'custom',
]

// Canvas object types — authorable elements that carry no data (no measures/query) and
// render without the data-card chrome. Used to relax validation + skip the data fetch and
// the card wrapper across render paths and the PBI publish path.
export const OBJECT_TYPES = new Set(['text_box', 'shape', 'image', 'divider'])
export const isObjectType = (type) => OBJECT_TYPES.has(type)

// Types that render "bare" (no data-card chrome) and take a full-surface drag handle:
// the canvas objects plus the nav button (a web-style button, not a boxed visual).
export const isBareVisual = (type) => OBJECT_TYPES.has(type) || type === 'nav_button'

export const SLICER_TYPES = ['dropdown', 'buttons', 'date_range', 'multi_select']

export const THEMES = ['dark', 'light', 'midnight', 'slate']

/**
 * Page-size presets used by both AppSpecRenderer (editor canvas) and the
 * Power BI publish path (report page dimensions). Values are pixel sizes.
 *
 * Why these exist:
 *   • Power BI report pages have fixed dimensions and don't scroll. Without
 *     a declared pageHeight, tall dashboards get clipped on publish.
 *   • The editor and PBI must agree on a canvas size for pixel parity —
 *     otherwise the same grid position renders at different scale.
 */
export { PAGE_SIZE_PRESETS, PAGE_SIZE_LIMITS, DEFAULT_PAGE_SIZE } from '@vilsem/core/pbir/layout'

function validateVisuals(visuals, prefix, errors, warnings, customVisuals) {
  const ids = new Set()
  visuals.forEach((v, i) => {
    const p = `${prefix}[${i}]`
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
      errors.push(`${p}: visual must be an object`)
      return
    }
    if (!v.id || typeof v.id !== 'string') {
      errors.push(`${p}: missing or invalid id`)
    } else if (ids.has(v.id)) {
      errors.push(`${p}: duplicate id "${v.id}"`)
    } else {
      ids.add(v.id)
    }
    if (!v.type || !VISUAL_TYPES.includes(v.type)) {
      errors.push(`${p}: invalid type "${v.type}". Must be one of: ${VISUAL_TYPES.join(', ')}`)
    }
    if (!v.position || typeof v.position !== 'object') {
      errors.push(`${p}: missing position`)
    } else {
      const { x, y, w, h } = v.position
      if (typeof x !== 'number' || typeof y !== 'number') errors.push(`${p}: position.x and position.y must be numbers`)
      if (typeof w !== 'number' || w < 1) errors.push(`${p}: position.w must be >= 1`)
      if (typeof h !== 'number' || h < 1) errors.push(`${p}: position.h must be >= 1`)
      if (x + w > 12) warnings.push(`${p}: visual extends beyond 12-column grid (x=${x}, w=${w})`)
    }
    // Canvas objects + nav buttons carry no data at all — skip the data-block/measures checks.
    if (!isBareVisual(v.type)) {
      if (!v.data || typeof v.data !== 'object') {
        errors.push(`${p}: missing data block`)
      } else {
        const noMeasuresOk = v.type === 'table' || v.type === 'nav_button'
        if (!Array.isArray(v.data.measures) || v.data.measures.length === 0) {
          if (!noMeasuresOk) errors.push(`${p}: data.measures must be a non-empty array`)
        }
      }
    }
    if (!v.config || typeof v.config !== 'object') {
      warnings.push(`${p}: missing config block — defaults will be used`)
    }
    if (v.type === 'custom') {
      const template = customVisuals?.[v.customTemplateId] || v.customTemplate
      try {
        const result = validateTemplate(template)
        errors.push(...result.errors.map(e => `${p}: custom template: ${e}`))
        warnings.push(...result.warnings.map(e => `${p}: custom template: ${e}`))
      } catch {
        errors.push(`${p}: malformed custom template`)
      }
    }
  })
}

function validateSlicers(slicers, prefix, errors) {
  if (slicers === undefined) return
  if (!Array.isArray(slicers)) { errors.push(`${prefix} must be an array`); return }
  slicers.forEach((s, i) => {
    const p = `${prefix}[${i}]`
    if (!s || typeof s !== 'object' || Array.isArray(s)) { errors.push(`${p}: slicer must be an object`); return }
    if (!s.id) errors.push(`${p}: missing id`)
    if (!SLICER_TYPES.includes(s.type)) errors.push(`${p}: invalid type "${s.type}". Must be one of: ${SLICER_TYPES.join(', ')}`)
    if (!s.dimension || typeof s.dimension !== 'object' || !s.dimension.table || !s.dimension.column) errors.push(`${p}: missing or invalid dimension (expected { table, column })`)
    if (!s.position || typeof s.position !== 'object') errors.push(`${p}: missing position`)
  })
}

/**
 * Fill in ids/names the model left out (pages, visuals, slicers), so a spec that's
 * otherwise valid isn't rejected for a missing id. Mutates in place and returns the spec.
 * Call before validateAppSpec on any model-generated spec.
 */
export function ensureSpecIds(spec) {
  if (!spec || typeof spec !== 'object') return spec
  let n = 0
  const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${n++}`
  const fixItems = (arr, kind) => {
    if (!Array.isArray(arr)) return
    for (const v of arr) { if (v && typeof v === 'object' && !v.id) v.id = uid(kind) }
  }
  if (Array.isArray(spec.pages)) {
    spec.pages.forEach((p, i) => {
      if (p && typeof p === 'object') {
        if (!p.id) p.id = `page_${i + 1}`
        if (!p.name) p.name = `Page ${i + 1}`
        fixItems(p.visuals, 'v')
        fixItems(p.slicers, 'sl')
      }
    })
  }
  fixItems(spec.visuals, 'v')
  fixItems(spec.slicers, 'sl')
  return spec
}

/**
 * Validates an App Spec JSON object.
 * Returns { valid: boolean, errors: string[], warnings: string[] }
 */
export function validateAppSpec(spec) {
  const errors = []
  const warnings = []

  if (!spec || typeof spec !== 'object') {
    return { valid: false, errors: ['Spec must be an object'], warnings: [] }
  }

  // version
  if (!spec.version) warnings.push('Missing version field')

  // title
  if (!spec.title || typeof spec.title !== 'string') {
    errors.push('Missing or invalid title')
  }

  // pages (multi-page mode) — validate each page's visuals/slicers
  if (Array.isArray(spec.pages) && spec.pages.length > 0) {
    spec.pages.forEach((page, pi) => {
      if (!page || typeof page !== 'object' || Array.isArray(page)) { errors.push(`pages[${pi}]: page must be an object`); return }
      if (!page.id) errors.push(`pages[${pi}]: missing id`)
      if (!page.name) errors.push(`pages[${pi}]: missing name`)
      if (!Array.isArray(page.visuals)) {
        errors.push(`pages[${pi}]: visuals must be an array`)
      } else {
        validateVisuals(page.visuals, `pages[${pi}].visuals`, errors, warnings, spec.customVisuals)
      }
      validateSlicers(page.slicers, `pages[${pi}].slicers`, errors)
    })
  } else {
    // Single-page (flat) mode — backward compat
    if (!Array.isArray(spec.visuals)) {
      errors.push('spec.visuals must be an array')
    } else {
      validateVisuals(spec.visuals, 'visuals', errors, warnings, spec.customVisuals)
    }
  }

  // slicers (optional)
  validateSlicers(spec.slicers, 'slicers', errors)

  // connections (optional, informational)
  if (spec.connections !== undefined && !Array.isArray(spec.connections)) {
    warnings.push('spec.connections should be an array')
  }

  return { valid: errors.length === 0, errors, warnings }
}
