/**
 * Layout Normalizer — actually moves visuals on the page so the result
 * doesn't feel like "themed but still messy".
 *
 * What it does:
 *   1. Snap all positions to the 8pt grid (Material/Carbon convention)
 *   2. Detect "rows" of visuals (visuals on the same y within tolerance)
 *      and equalize their heights so KPI rows look like KPI rows
 *   3. Equalize widths within a row so cards/charts fit edge-to-edge with
 *      consistent gutters
 *   4. Standardize gutters between adjacent visuals (16px / 24px)
 *
 * What it does NOT do:
 *   - Move visuals between pages
 *   - Add or remove visuals
 *   - Change z-order or stacking
 *   - Touch shapes / images / textboxes that have specific positions
 *     (we treat them as anchors)
 *
 * Per Doc 3 and Doc 1 design rules: 8pt grid is THE single biggest "premium"
 * lever — most default reports have ragged 7px/13px offsets that read as
 * "homemade". Even a brutally simple snap-to-8 catches 90% of the visual-
 * polish gap.
 *
 * Conservative by default. Risky operations (column-equalization,
 * cross-row alignment) are gated by explicit options the user opts into.
 */

import { canonicalize } from './knowledge/visualTypeMap.js'

const GRID = 8
const ROW_Y_TOLERANCE = 16     // visuals within this y-distance count as same row
const COL_X_TOLERANCE = 16
const STANDARD_GUTTER = 16

// ── Public entry point ───────────────────────────────────────────────────────

/**
 * Normalize the layout of every page in a parsed report.
 *
 *   normalizeLayout(parsed, {
 *     snapToGrid: true,
 *     equalizeRowHeights: true,
 *     equalizeRowWidths: true,        // careful — moves visuals horizontally
 *     standardizeGutters: true,
 *     gridUnit: 8,
 *     gutter: 16,
 *   })
 *
 * Returns the parsed object with `visual.position` mutated in place.
 * Records each change in `result.changes[]` so the applier can include them
 * in the diff.
 */
export function normalizeLayout(parsed, options = {}) {
  const opts = {
    snapToGrid:         options.snapToGrid          ?? true,
    equalizeRowHeights: options.equalizeRowHeights  ?? true,
    equalizeRowWidths:  options.equalizeRowWidths   ?? false,   // off by default — riskier
    standardizeGutters: options.standardizeGutters  ?? false,   // off by default — riskier
    gridUnit:           options.gridUnit            ?? GRID,
    gutter:             options.gutter              ?? STANDARD_GUTTER,
    yTolerance:         options.yTolerance          ?? ROW_Y_TOLERANCE,
    xTolerance:         options.xTolerance          ?? COL_X_TOLERANCE,
  }

  if (!parsed?.pages?.length) return { parsed, changes: [] }

  const changes = []

  for (const page of parsed.pages) {
    const visuals = (page.visuals || []).filter(v => v.position)
    if (!visuals.length) continue

    // Step 1 — snap each position to the grid
    if (opts.snapToGrid) {
      for (const v of visuals) {
        const before = { ...v.position }
        v.position.x      = snap(v.position.x,      opts.gridUnit)
        v.position.y      = snap(v.position.y,      opts.gridUnit)
        v.position.width  = snap(v.position.width,  opts.gridUnit)
        v.position.height = snap(v.position.height, opts.gridUnit)
        if (positionChanged(before, v.position)) {
          changes.push({
            page:    page.name,
            visualId: v.id,
            kind:    'snap-to-grid',
            before, after: { ...v.position },
          })
        }
      }
    }

    // Step 2 — detect rows + equalize heights
    if (opts.equalizeRowHeights) {
      const rows = detectRows(visuals, opts.yTolerance)
      for (const row of rows) {
        if (row.length < 2) continue
        // Use the median height to avoid a single outlier dragging everyone
        const heights = row.map(v => v.position.height).sort((a, b) => a - b)
        const targetH = snap(heights[Math.floor(heights.length / 2)], opts.gridUnit)
        for (const v of row) {
          if (Math.abs(v.position.height - targetH) > 4) {
            const before = { ...v.position }
            v.position.height = targetH
            changes.push({
              page:    page.name,
              visualId: v.id,
              kind:    'equalize-row-height',
              before, after: { ...v.position },
            })
          }
        }
      }
    }

    // Step 3 — equalize widths within rows (only if opted in — riskier)
    if (opts.equalizeRowWidths) {
      const rows = detectRows(visuals, opts.yTolerance)
      for (const row of rows) {
        if (row.length < 2) continue
        // Skip rows that mix wide elements (e.g. a hero chart with side cards)
        const widths = row.map(v => v.position.width).sort((a, b) => a - b)
        const ratio = widths[widths.length - 1] / widths[0]
        if (ratio > 2.5) continue   // mixed sizes — leave alone
        const median = widths[Math.floor(widths.length / 2)]
        const targetW = snap(median, opts.gridUnit)
        for (const v of row) {
          if (Math.abs(v.position.width - targetW) > 4) {
            const before = { ...v.position }
            v.position.width = targetW
            changes.push({
              page:    page.name,
              visualId: v.id,
              kind:    'equalize-row-width',
              before, after: { ...v.position },
            })
          }
        }
      }
    }

    // Step 4 — standardize gutters between adjacent same-row visuals
    if (opts.standardizeGutters) {
      const rows = detectRows(visuals, opts.yTolerance)
      for (const row of rows) {
        if (row.length < 2) continue
        // Sort left-to-right
        row.sort((a, b) => a.position.x - b.position.x)
        // Re-flow x so each visual sits at prev.x + prev.width + gutter
        for (let i = 1; i < row.length; i++) {
          const prev = row[i - 1]
          const target = prev.position.x + prev.position.width + opts.gutter
          if (Math.abs(row[i].position.x - target) > 2) {
            const before = { ...row[i].position }
            row[i].position.x = snap(target, opts.gridUnit)
            changes.push({
              page:    page.name,
              visualId: row[i].id,
              kind:    'standardize-gutter',
              before, after: { ...row[i].position },
            })
          }
        }
      }
    }

    // Step 5 — resolve overlaps (Half A.2). Sort visuals by y, then for each
    // pair check if rectangles overlap. If so, push the LATER visual (and
    // everything below it) downward by the overlap amount.
    //
    // Skips background shapes (treated as layout anchors that intentionally
    // sit behind data visuals).
    if (opts.resolveOverlaps) {
      const sortable = visuals.filter(v => {
        const t = canonicalize(v.visualType)
        return !(['shape', 'basicShape'].includes(t) &&
                 v.position.height > 200 && v.position.width > 600)
      })
      // Sort by y then x — top-to-bottom, left-to-right scan
      sortable.sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
      for (let i = 0; i < sortable.length; i++) {
        for (let j = i + 1; j < sortable.length; j++) {
          if (rectsOverlap(sortable[i].position, sortable[j].position, 2)) {
            const a = sortable[i].position
            const b = sortable[j].position
            const pushDown = (a.y + a.height) - b.y + opts.gutter
            if (pushDown > 0) {
              const before = { ...b }
              b.y = snap(b.y + pushDown, opts.gridUnit)
              changes.push({
                page:    page.name,
                visualId: sortable[j].id,
                kind:    'resolve-overlap',
                before, after: { ...b },
                detail:   `pushed down ${pushDown}px to clear overlap with ${sortable[i].id}`,
              })
              // Cascade — anything else below b might now also overlap, but the
              // continued j-loop will catch it on its own pair-check
            }
          }
        }
      }
    }

    // Step 6 — clamp visuals to page bounds (Half A.3). If a visual extends
    // past the page width or height, shrink it to fit OR shift it leftward/
    // upward. Page dimensions come from page.width / page.height (parsed
    // from page.json).
    if (opts.clampToPageBounds) {
      const pageW = Number(page.width)  || 1280
      const pageH = Number(page.height) || 720
      const margin = opts.outerMargin ?? 24
      for (const v of visuals) {
        const before = { ...v.position }
        // Clamp x + width to page width
        if (v.position.x + v.position.width > pageW - margin) {
          // Try shrinking width first (preserves position)
          const newWidth = pageW - margin - v.position.x
          if (newWidth >= 80) {
            v.position.width = snap(newWidth, opts.gridUnit)
          } else {
            // Width too small — shift visual left instead
            v.position.x = snap(Math.max(margin, pageW - margin - v.position.width), opts.gridUnit)
          }
        }
        // Clamp y + height to page height
        if (v.position.y + v.position.height > pageH - margin) {
          const newHeight = pageH - margin - v.position.y
          if (newHeight >= 60) {
            v.position.height = snap(newHeight, opts.gridUnit)
          } else {
            v.position.y = snap(Math.max(margin, pageH - margin - v.position.height), opts.gridUnit)
          }
        }
        // Clamp negative positions
        if (v.position.x < 0) v.position.x = 0
        if (v.position.y < 0) v.position.y = 0
        if (positionChanged(before, v.position)) {
          changes.push({
            page:    page.name,
            visualId: v.id,
            kind:    'clamp-to-page-bounds',
            before, after: { ...v.position },
            detail:   `page ${pageW}×${pageH}, margin ${margin}`,
          })
        }
      }
    }
  }

  // ── Half B: Page-grid repack (cross-page operation) ──
  if (opts.repackPageGrid) {
    repackAllPages(parsed, opts, changes)
  }

  return { parsed, changes }
}

// ── Half A.2 helper — rect overlap test ──────────────────────────────────────

function rectsOverlap(a, b, tolerance = 0) {
  const ax2 = a.x + a.width,  ay2 = a.y + a.height
  const bx2 = b.x + b.width,  by2 = b.y + b.height
  return !(ax2 - tolerance <= b.x || bx2 - tolerance <= a.x ||
           ay2 - tolerance <= b.y || by2 - tolerance <= a.y)
}

// ── Half B — Page grid repack solver (CSS-Grid-like layout) ──────────────────

/**
 * Re-pack each page into a clean grid layout.
 *
 * Algorithm (per page):
 *   1. Compute available canvas: page.width - 2×margin, page.height - 2×margin
 *   2. Detect rows by y-clustering (existing detectRows)
 *   3. Sort rows top-to-bottom by min y
 *   4. For each row:
 *        a. Sort visuals left-to-right by x
 *        b. If row total width (sum of widths + gutters) > availableWidth,
 *           shrink each visual proportionally
 *        c. Re-flow x positions: first at margin, each next at prev.x + prev.width + gutter
 *   5. Re-flow y positions: first row at margin, each next at prev_row_y + prev_row_max_height + gutter
 *
 * This eliminates overlaps + uniform gutters + page-bound conformance in one pass.
 * Conservative: doesn't change widths or heights more than necessary.
 *
 * Skips background shapes (treated as anchors — they keep their positions).
 */
function repackAllPages(parsed, opts, changes) {
  for (const page of parsed.pages || []) {
    const pageW = Number(page.width)  || 1280
    const pageH = Number(page.height) || 720
    const margin = opts.outerMargin ?? 24
    const gutter = opts.gutter ?? 16
    const availableWidth = pageW - 2 * margin

    // Filter out background shapes — they stay where they are
    const sortable = (page.visuals || []).filter(v => {
      if (!v.position) return false
      const t = canonicalize(v.visualType)
      return !(['shape', 'basicShape'].includes(t) &&
               v.position.height > 200 && v.position.width > 600)
    })
    if (!sortable.length) continue

    const rows = detectRows(sortable, opts.yTolerance ?? 16)
    if (!rows.length) continue

    // Sort rows by their representative (min) y
    rows.sort((rA, rB) => Math.min(...rA.map(v => v.position.y)) - Math.min(...rB.map(v => v.position.y)))

    let nextY = margin
    for (const row of rows) {
      // Sort row left-to-right
      row.sort((a, b) => a.position.x - b.position.x)

      // Determine row height as the max within the row
      const rowHeight = Math.max(...row.map(v => v.position.height))

      // Sum existing widths + gutters
      const existingTotal = row.reduce((sum, v) => sum + v.position.width, 0) + gutter * (row.length - 1)
      // If overflows page, shrink proportionally
      let scale = 1
      if (existingTotal > availableWidth) {
        scale = (availableWidth - gutter * (row.length - 1)) / row.reduce((s, v) => s + v.position.width, 0)
      }

      // Re-flow x positions
      let cursor = margin
      for (const v of row) {
        const before = { ...v.position }
        const newWidth = snap(v.position.width * scale, opts.gridUnit ?? 8)
        v.position.x = snap(cursor, opts.gridUnit ?? 8)
        v.position.width = newWidth
        v.position.y = snap(nextY, opts.gridUnit ?? 8)
        // Heights unchanged in this pass — equalizeRowHeights handles that earlier
        cursor += newWidth + gutter
        if (positionChanged(before, v.position)) {
          changes.push({
            page:    page.name,
            visualId: v.id,
            kind:    'repack-grid',
            before, after: { ...v.position },
            detail:   scale < 1 ? `row total exceeded canvas — shrunk to fit (scale ${scale.toFixed(2)})` : 're-flowed x to clean grid',
          })
        }
      }
      nextY += rowHeight + gutter
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function snap(n, unit) {
  if (!Number.isFinite(n)) return n
  return Math.round(n / unit) * unit
}

function positionChanged(before, after) {
  return ['x', 'y', 'width', 'height'].some(k => before[k] !== after[k])
}

/**
 * Group visuals by row using y-position with tolerance.
 *
 * Algorithm:
 *   - Sort by y
 *   - Scan: if next visual's y is within tolerance of current row's y, add to row
 *     else start a new row
 *
 * Visuals that don't have a position (image placeholders etc.) are excluded.
 * Background shapes and large textboxes that span multiple "real" rows are
 * also excluded — they'd skew the row detection.
 */
export function detectRows(visuals, tolerance = ROW_Y_TOLERANCE) {
  const filtered = visuals.filter(v => {
    if (!v.position) return false
    // Skip background-spanning shapes (taller than 200px AND wider than 600px)
    const t = canonicalize(v.visualType)
    if (['shape', 'basicShape', 'image'].includes(t) &&
        v.position.height > 200 && v.position.width > 600) {
      return false
    }
    return true
  })

  const sorted = [...filtered].sort((a, b) => a.position.y - b.position.y)
  const rows = []
  let currentRow = []
  let currentY = null

  for (const v of sorted) {
    if (currentY === null || Math.abs(v.position.y - currentY) <= tolerance) {
      currentRow.push(v)
      // Track the row's representative y as the running average
      currentY = currentY === null ? v.position.y :
        (currentY * (currentRow.length - 1) + v.position.y) / currentRow.length
    } else {
      if (currentRow.length) rows.push(currentRow)
      currentRow = [v]
      currentY = v.position.y
    }
  }
  if (currentRow.length) rows.push(currentRow)
  return rows
}

/**
 * Summary diagnostic — used by the diff viewer to show what the normalizer
 * did. Returns counts grouped by change kind.
 */
export function summarizeNormalization(changes) {
  const counts = {}
  for (const c of changes) {
    counts[c.kind] = (counts[c.kind] || 0) + 1
  }
  return counts
}
