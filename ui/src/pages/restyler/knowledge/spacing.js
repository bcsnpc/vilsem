/**
 * Spacing system — 8pt grid, padding scale, gutters, page margins.
 *
 * The single biggest "agency" lever is grid discipline. PBI's default reports
 * have ragged 7px / 11px / 13px offsets because the formatting UI uses arbitrary
 * pixel values. Premium dashboards snap everything to an 8px grid (Material 3,
 * IBM Carbon) or 4px (Polaris) — we use 8px as the practical default.
 *
 * Source: Material Design 3, IBM Carbon, Doc 2 + Doc 3 design rules.
 */

// ── 8-point grid base unit ───────────────────────────────────────────────────

export const GRID_UNIT = 8

/**
 * Snap a value to the nearest grid multiple. Default is 8px.
 *
 *   snapToGrid(7)   → 8
 *   snapToGrid(13)  → 16
 *   snapToGrid(45)  → 48
 *   snapToGrid(7, 4) → 8
 */
export function snapToGrid(value, unit = GRID_UNIT) {
  return Math.round(value / unit) * unit
}

/**
 * Snap a position object (x, y, width, height) to the grid.
 */
export function snapPosition(pos, unit = GRID_UNIT) {
  return {
    ...pos,
    x:      snapToGrid(pos.x ?? 0, unit),
    y:      snapToGrid(pos.y ?? 0, unit),
    width:  snapToGrid(pos.width ?? 0, unit),
    height: snapToGrid(pos.height ?? 0, unit),
  }
}

/**
 * Check if a position is on the grid.
 */
export function isOnGrid(pos, unit = GRID_UNIT) {
  return ['x', 'y', 'width', 'height'].every(k =>
    pos[k] == null || pos[k] % unit === 0
  )
}

// ── Spacing scale ────────────────────────────────────────────────────────────

/**
 * Standard padding/gap scale. Use these instead of arbitrary numbers.
 * All multiples of 4 (sub-grid for fine-tuning).
 */
export const SPACING = {
  xs:   4,
  sm:   8,
  md:  12,
  lg:  16,
  xl:  20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
}

// ── Visual padding (inside container) ────────────────────────────────────────

/**
 * Internal padding for `visualContainerObjects.padding`. The agency rule:
 *   - 12-16px standard for charts and cards
 *   - 16-20px for "calm" / executive treatment
 *   -  8-10px for dense / data-heavy
 *   - never <8 inside a card with a visible border
 *
 * The `CONTAINER_PADDING` keys map to chrome treatment styles.
 */
export const CONTAINER_PADDING = {
  dense:        { top: 8,  right: 8,  bottom: 8,  left: 8  },
  standard:     { top: 16, right: 16, bottom: 16, left: 16 },
  calm:         { top: 20, right: 20, bottom: 20, left: 20 },
  executive:    { top: 24, right: 24, bottom: 24, left: 24 },
  cardHorizontal: { top: 12, right: 16, bottom: 12, left: 16 },
}

// ── Gutter (between visuals) ─────────────────────────────────────────────────

/**
 * Recommended outer gutters between visual containers. Doc 3 says SaaS standard
 * is 12-column with 16px gutters (Material 8pt grid, Carbon 8pt, Polaris 4pt).
 *
 * Per layout style:
 *   - dense / analytical:  12px
 *   - standard / mixed:    16px
 *   - executive / calm:    24px
 */
export const GUTTERS = {
  dense:     12,
  standard:  16,
  executive: 24,
}

// ── Page geometry ────────────────────────────────────────────────────────────

/**
 * Page sizes. PBI default 1280×720 is too cramped for premium output; Doc 3
 * recommends 1664×936 (30% larger, same 16:9 ratio) for desktop dashboards.
 */
export const PAGE_PRESETS = {
  '16:9_default':   { width: 1280, height: 720,  label: '16:9 default (PBI standard)' },
  '16:9_premium':   { width: 1664, height: 936,  label: '16:9 premium (recommended)' },
  '16:9_hd':        { width: 1920, height: 1080, label: '16:9 HD' },
  '16:10':          { width: 1440, height: 900,  label: '16:10' },
  '4:3':            { width: 1024, height: 768,  label: '4:3' },
  'tall':           { width: 1280, height: 1920, label: 'Tall (mobile-friendly scroll)' },
  'square':         { width: 1024, height: 1024, label: 'Square' },
  'a4_landscape':   { width: 1123, height: 794,  label: 'A4 landscape (export-friendly)' },
}

/**
 * Outer page margin (canvas → first visual). Wallpaper image is set to the
 * page background and visuals inset from the edge.
 */
export const PAGE_MARGINS = {
  dense:     16,
  standard:  24,
  executive: 32,
}

// ── Layout patterns ──────────────────────────────────────────────────────────

/**
 * Common premium dashboard layouts with their grid signatures.
 * Each describes how to allocate vertical space and what each band contains.
 */
export const LAYOUT_PATTERNS = {
  executive_kpi_top: {
    label: 'Executive — KPI top, hero charts middle, detail bottom',
    sections: [
      { role: 'header',     heightRatio: 0.08, content: 'Page title + global slicers' },
      { role: 'kpi_row',    heightRatio: 0.18, content: '4-5 KPI cards, equal width, identical height ~120px' },
      { role: 'hero',       heightRatio: 0.42, content: '1-2 hero charts (trend or top-N bar)' },
      { role: 'detail',     heightRatio: 0.32, content: 'Detail tables/breakdowns' },
    ],
  },
  analytical_left_rail: {
    label: 'Analytical — left slicer rail, multi-chart canvas',
    sections: [
      { role: 'left_rail',  widthRatio: 0.18, content: 'Vertical slicer stack (240-280px)' },
      { role: 'canvas',     widthRatio: 0.82, content: 'Mixed visuals' },
    ],
  },
  scorecard_grid: {
    label: 'Scorecard — uniform card grid, no hero',
    sections: [
      { role: 'header',     heightRatio: 0.10 },
      { role: 'grid',       heightRatio: 0.90, content: '3x3 or 4x4 uniform cards' },
    ],
  },
  monitoring_dense: {
    label: 'Monitoring — dense, low contrast, refresh-friendly',
    sections: [
      { role: 'header',     heightRatio: 0.06 },
      { role: 'kpi_row',    heightRatio: 0.12 },
      { role: 'grid',       heightRatio: 0.82, content: 'Dense chart grid (6-9 visuals)' },
    ],
  },
}

// ── KPI row alignment ────────────────────────────────────────────────────────

/**
 * The "KPI row" is the most-scrutinized area of a dashboard. Standard premium
 * treatment:
 *   - All cards on one horizontal row
 *   - Identical height (~120-140px)
 *   - Identical width (or wider for primary KPI)
 *   - Equal horizontal gap (gutter)
 *   - Snap to grid
 */
export const KPI_ROW_RULES = {
  recommendedHeight:     120,
  recommendedHeightDense: 96,
  recommendedHeightCalm: 144,
  yToleranceForRowDetect: 16,   // visuals within 16px y-distance count as "same row"
  alignTopToY:            32,   // first KPI row top
}
