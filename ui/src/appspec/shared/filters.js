// Filter-resolution helpers for the cross-filter + slicer pipeline. Verbatim
// extract from AppSpecRenderer.jsx (pre-Phase-1).

// Determines whether a slicer affects a given visual.
//   affects === "all"          → applies to every visual
//   affects is array           → applies only to listed visual IDs
//   affects is missing/undef   → treat as "all" (fail-safe)
//   any other value            → treat as "all" (fail-safe)
function visualMatchesSlicer(slicer, visualId) {
  const affects = slicer.affects
  if (affects == null)             return true
  if (affects === 'all')           return true
  if (Array.isArray(affects))      return affects.includes(visualId)
  return true
}

// If THIS visual was the source of a filter, return the selected category
// value — chart components use this to dim non-selected bars visually.
// null when the visual didn't trigger any current filter.
export function getSourceSelectedCat(visual, globalFilters, filterSources) {
  if (!visual?.id || !filterSources || !globalFilters) return null
  for (const [key, sourceId] of Object.entries(filterSources)) {
    if (sourceId === visual.id && globalFilters[key] != null) {
      return globalFilters[key]
    }
  }
  return null
}

// Build the filter object to pass to a visual's query.
// Merges only those global filter keys whose slicer affects this visual.
export function buildAppliedFiltersForVisual(spec, visual, globalFilters, filterSources) {
  const applied = {}
  const slicerKeys = new Set()

  // 1. Slicer-sourced filters — only applied to visuals the slicer affects
  for (const s of (spec.slicers || [])) {
    const dim = s.dimension
    if (!dim?.table || !dim?.column) continue
    const key = `${dim.table}[${dim.column}]`
    slicerKeys.add(key)
    if (!visualMatchesSlicer(s, visual.id) || filterSources?.[key]) continue
    if (globalFilters[key] != null) applied[key] = globalFilters[key]
  }

  // 2. Cross-filter from bar/chart clicks — applied to ALL visuals except
  //    the one that triggered the click (so the source chart stays visible
  //    showing all categories while others filter).
  if (filterSources) {
    for (const key of Object.keys(globalFilters)) {
      if (applied[key] !== undefined) continue  // slicer already handled it
      const sourceId = filterSources[key]
      if (!sourceId && slicerKeys.has(key)) continue // excluded slicer must not re-enter as a global filter
      if (sourceId && sourceId === visual.id) continue  // skip self-filter
      if (globalFilters[key] != null) applied[key] = globalFilters[key]
    }
  }

  return applied
}
