export const APP_SPEC_VERSION = '1.0'

export const VISUAL_TYPES = [
  'kpi', 'bar', 'stacked_bar', 'grouped_bar', 'column', 'line', 'area', 'stacked_area',
  'donut', 'pie', 'gauge', 'radar', 'scatter', 'bubble', 'treemap', 'funnel', 'sankey',
  'table', 'waterfall', 'lollipop', 'bullet', 'progress', 'heatmap', 'ranked_list',
  'stat_card', 'metric_tile', 'sparkline_kpi', 'slope', 'bump', 'chord', 'sunburst',
  'narrative', 'insight', 'waffle', 'bar_race', 'nav_button',
]

export const SLICER_TYPES = ['dropdown', 'buttons', 'date_range']

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
export const PAGE_SIZE_PRESETS = {
  '16:9':    { label: '16:9 (1280×720)',     width: 1280, height: 720  },
  '16:10':   { label: '16:10 (1280×800)',    width: 1280, height: 800  },
  '4:3':     { label: '4:3 (1024×768)',      width: 1024, height: 768  },
  'tall':    { label: 'Tall (1280×1920)',    width: 1280, height: 1920 },
  'square':  { label: 'Square (1024×1024)',  width: 1024, height: 1024 },
  'auto':    { label: 'Auto-fit content',    width: 1280, height: null }, // height computed at render
  'custom':  { label: 'Custom…',              width: null, height: null }, // both from layout.pageWidth/pageHeight
}

// Clamps for custom page size (prevents degenerate values)
export const PAGE_SIZE_LIMITS = {
  minWidth:  640,
  minHeight: 480,
  maxWidth:  4096,
  maxHeight: 8192,
}

/** Default page size when AppSpec doesn't specify one. */
export const DEFAULT_PAGE_SIZE = PAGE_SIZE_PRESETS['16:9']

function validateVisuals(visuals, prefix, errors, warnings) {
  const ids = new Set()
  visuals.forEach((v, i) => {
    const p = `${prefix}[${i}]`
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
    if (!v.data || typeof v.data !== 'object') {
      errors.push(`${p}: missing data block`)
    } else {
      const noMeasuresOk = v.type === 'table' || v.type === 'nav_button'
      if (!Array.isArray(v.data.measures) || v.data.measures.length === 0) {
        if (!noMeasuresOk) errors.push(`${p}: data.measures must be a non-empty array`)
      }
    }
    if (!v.config || typeof v.config !== 'object') {
      warnings.push(`${p}: missing config block — defaults will be used`)
    }
  })
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
      if (!page.id) errors.push(`pages[${pi}]: missing id`)
      if (!page.name) errors.push(`pages[${pi}]: missing name`)
      if (!Array.isArray(page.visuals)) {
        errors.push(`pages[${pi}]: visuals must be an array`)
      } else {
        validateVisuals(page.visuals, `pages[${pi}].visuals`, errors, warnings)
      }
    })
  } else {
    // Single-page (flat) mode — backward compat
    if (!Array.isArray(spec.visuals)) {
      errors.push('spec.visuals must be an array')
    } else {
      validateVisuals(spec.visuals, 'visuals', errors, warnings)
    }
  }

  // slicers (optional)
  if (spec.slicers !== undefined) {
    if (!Array.isArray(spec.slicers)) {
      errors.push('spec.slicers must be an array')
    } else {
      spec.slicers.forEach((s, i) => {
        const prefix = `slicers[${i}]`
        if (!s.id) errors.push(`${prefix}: missing id`)
        if (!s.type || !SLICER_TYPES.includes(s.type)) {
          errors.push(`${prefix}: invalid type "${s.type}". Must be one of: ${SLICER_TYPES.join(', ')}`)
        }
        if (!s.dimension || typeof s.dimension !== 'object' || !s.dimension.table || !s.dimension.column) {
          errors.push(`${prefix}: missing or invalid dimension (expected { table, column })`)
        }
        if (!s.position || typeof s.position !== 'object') {
          errors.push(`${prefix}: missing position`)
        }
      })
    }
  }

  // connections (optional, informational)
  if (spec.connections !== undefined && !Array.isArray(spec.connections)) {
    warnings.push('spec.connections should be an array')
  }

  return { valid: errors.length === 0, errors, warnings }
}
