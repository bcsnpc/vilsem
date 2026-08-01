// Click-to-drill — pure helpers (no React, no I/O), unit-tested and shared.
//
// A visual declares an ordered hierarchy on its data block:
//   data.drill = [{ table, column }, { table, column }, ...]   // ≥2 levels
//
// At runtime each visual keeps a `drillPath` — the array of category values the
// user has clicked into. At depth d the visual is GROUPED BY drill[d] and
// FILTERED BY every ancestor value drill[0..d-1]. Depth 0 = the base level.
//
// The three surfaces differ only in how the deeper level's rows are obtained:
//   • vilsem canvas / web export → live re-query at drill[d] with ancestor filters
//   • PBI .pbiviz               → client-side re-aggregation of the pre-bound
//                                 finest-grain dataView (same path math, no query)
// This module owns the shared math so all surfaces agree on levels + filters.

/**
 * Normalise a visual's declared drill hierarchy.
 * @returns {Array<{table,column,ref,label}>|null} null when there is no
 *          drillable hierarchy (absent, malformed, or fewer than 2 valid levels).
 */
export function drillHierarchy(visual) {
  const raw = visual?.data?.drill
  if (!Array.isArray(raw)) return null
  const levels = raw
    .filter(d => d && d.table && d.column)
    .map(d => ({ table: d.table, column: d.column, ref: `${d.table}[${d.column}]`, label: d.column }))
  // A single level is just a normal groupBy — not a hierarchy to drill through.
  return levels.length >= 2 ? levels : null
}

/**
 * Resolve the effective query for a visual at its current drill depth.
 * @returns {{levels,depth,maxDepth,atLeaf,groupBy,ancestorFilters}|null}
 *          null when the visual has no drillable hierarchy.
 *          groupBy         — {table,column} to group by at this depth
 *          ancestorFilters — { 'Table[Col]': value } for every level above
 */
export function resolveDrillQuery(visual, drillPath) {
  const levels = drillHierarchy(visual)
  if (!levels) return null
  const path = Array.isArray(drillPath) ? drillPath : []
  // Can never group deeper than the last declared level.
  const depth = Math.min(path.length, levels.length - 1)
  const groupBy = { table: levels[depth].table, column: levels[depth].column }
  const ancestorFilters = {}
  for (let i = 0; i < depth; i++) ancestorFilters[levels[i].ref] = path[i]
  return {
    levels,
    depth,
    maxDepth: levels.length - 1,
    atLeaf: depth >= levels.length - 1,
    groupBy,
    ancestorFilters,
  }
}

/**
 * Breadcrumb trail for the current drill path. The LAST entry is the current
 * level (render it as active/non-clickable); earlier entries pop back when
 * clicked via their `toDepth`.
 * @returns {Array<{label,toDepth}>} always starts with the base level's label.
 */
export function drillCrumbs(visual, drillPath) {
  const levels = drillHierarchy(visual)
  if (!levels) return []
  const path = (Array.isArray(drillPath) ? drillPath : []).slice(0, levels.length - 1)
  const crumbs = [{ label: levels[0].label, toDepth: 0 }]
  path.forEach((v, i) => crumbs.push({ label: String(v), toDepth: i + 1 }))
  return crumbs
}

/**
 * Push a clicked category value onto the drill path, unless already at the leaf.
 * Returns the SAME array reference when nothing changes (safe for setState guards).
 */
export function pushDrill(drillPath, value, levels) {
  const path = Array.isArray(drillPath) ? drillPath : []
  if (value == null || !Array.isArray(levels)) return path
  if (path.length >= levels.length - 1) return path // already at leaf → no deeper level
  return [...path, String(value)]
}

/** Truncate the drill path back to `depth` (breadcrumb click). */
export function popDrillTo(drillPath, depth) {
  const path = Array.isArray(drillPath) ? drillPath : []
  if (depth >= path.length) return path
  return path.slice(0, Math.max(0, depth))
}

/**
 * The interaction style for a visual's drill hierarchy. Defaults to 'expand'
 * (the prototype's expand-in-place) when a hierarchy exists but none is set.
 *   'expand'  — bar splits into its children alongside greyed siblings
 *   'replace' — chart re-queries to the child level (phase-1 behaviour)
 *   'panel'   — detail drawer beside the chart (pattern 01, later)
 *   'zoom'    — semantic zoom / drag-to-grain (pattern 03, later)
 */
export function drillStyleOf(visual) {
  const s = visual?.config?.drillStyle
  if (s === 'replace' || s === 'expand' || s === 'panel' || s === 'zoom' || s === 'off') return s
  return drillHierarchy(visual) ? 'expand' : null
}

/**
 * Expand-in-place levels: the base level and its immediate children. v1 supports
 * one expansion at the base level (parent → children), matching the prototype.
 * @returns {{parent,child}|null}
 */
export function expandLevels(visual) {
  const levels = drillHierarchy(visual)
  if (!levels) return null
  return { parent: levels[0], child: levels[1] }
}

/**
 * Shape a 2-dim (parent,child) query result into mixed-grain expand-in-place
 * rows: the expanded parent becomes one row per child (highlighted); every other
 * parent collapses to a single summed row. Parent order follows first appearance.
 * Each row carries `_group` (its parent) and `_child` (true if an expanded leaf),
 * used by the bar to colour children vs siblings and to key universalTransition.
 * @param rows [{_cat: parent, _cat2: child, _val}]  (from normaliseTableRows, 2 dims)
 */
export function shapeExpandInPlace(rows, expandedValue, valKey = '_val') {
  const byParent = new Map()
  for (const r of (rows || [])) {
    const p = String(r._cat)
    if (!byParent.has(p)) byParent.set(p, [])
    byParent.get(p).push(r)
  }
  const exp = expandedValue == null ? null : String(expandedValue)
  const out = []
  for (const [parent, childRows] of byParent) {
    if (parent === exp) {
      for (const cr of childRows) {
        out.push({ _cat: String(cr._cat2 ?? cr._cat), _val: Number(cr[valKey]) || 0, _group: parent, _child: true })
      }
    } else {
      const sum = childRows.reduce((a, cr) => a + (Number(cr[valKey]) || 0), 0)
      out.push({ _cat: parent, _val: sum, _group: parent, _child: false })
    }
  }
  return out
}

/**
 * Client-side re-aggregation for surfaces that CANNOT re-query (PBI): given the
 * full finest-grain rows (each carrying every level's column value + a numeric
 * measure), collapse to the current drill level.
 * @param rows      Array of row objects
 * @param levels    hierarchy from drillHierarchy()
 * @param drillPath current path
 * @param measureKeys keys on each row to SUM (e.g. ['_val','_val2'])
 * @param colOf     (row, level) => the row's value for that level's column
 * @returns Array<{ _cat, ...summedMeasures }> grouped by the current level
 */
export function aggregateDrillLevel(rows, levels, drillPath, measureKeys, colOf) {
  if (!Array.isArray(rows) || !Array.isArray(levels) || levels.length === 0) return rows || []
  const path = Array.isArray(drillPath) ? drillPath : []
  const depth = Math.min(path.length, levels.length - 1)
  // Keep only rows matching every ancestor value.
  const kept = rows.filter(r => {
    for (let i = 0; i < depth; i++) {
      if (String(colOf(r, levels[i])) !== String(path[i])) return false
    }
    return true
  })
  const groups = new Map()
  for (const r of kept) {
    const key = String(colOf(r, levels[depth]))
    let acc = groups.get(key)
    if (!acc) { acc = { _cat: key }; for (const m of measureKeys) acc[m] = 0; groups.set(key, acc) }
    for (const m of measureKeys) acc[m] += Number(r[m]) || 0
  }
  return Array.from(groups.values())
}
