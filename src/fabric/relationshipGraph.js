/**
 * relationshipGraph.js
 * BFS-based relationship graph for validating cross-table filter paths.
 *
 * TMSL convention:
 *   fromTable/fromColumn = many side (fact table)
 *   toTable/toColumn     = one side (dimension table)
 *   Filter flows FROM the one side (dimension) TO the many side (fact).
 *
 * So BFS edges must go toTable → fromTable (dimension → fact).
 * For bothDirections, add the reverse edge too.
 */

function normalizeName(name) {
  return (name || '').toLowerCase().trim()
}

class RelationshipGraph {
  constructor(relationships) {
    this.graph = new Map()
    this.build(relationships || [])
  }

  build(relationships) {
    for (const rel of relationships) {
      const factKey = normalizeName(rel.fromTable)   // many side
      const dimKey  = normalizeName(rel.toTable)     // one side (dimension)
      if (!factKey || !dimKey) continue

      const cf = rel.crossFilter || rel.crossFilteringBehavior || ''

      // Primary filter direction: dimension (one) → fact (many)
      if (!this.graph.has(dimKey)) this.graph.set(dimKey, [])
      this.graph.get(dimKey).push({
        targetTable: factKey,
        fromColumn:  rel.toColumn,
        toColumn:    rel.fromColumn,
        direction:   cf || 'oneDirection',
        isActive:    rel.isActive !== false,
      })

      // Reverse direction (bothDirections or for completeness)
      if (cf === 'bothDirections') {
        if (!this.graph.has(factKey)) this.graph.set(factKey, [])
        this.graph.get(factKey).push({
          targetTable: dimKey,
          fromColumn:  rel.fromColumn,
          toColumn:    rel.toColumn,
          direction:   'bothDirections',
          isActive:    rel.isActive !== false,
        })
      }
    }
  }

  /**
   * BFS: Can filterTable reach measureTable via relationships?
   * Normalizes names before lookup.
   * Returns { valid, path, hasInactive }
   */
  canFilter(filterTable, measureTable) {
    const normFilter  = normalizeName(filterTable)
    const normMeasure = normalizeName(measureTable)

    if (normFilter === normMeasure) return { valid: true, path: [], hasInactive: false }

    const visited = new Set()
    const queue   = [{ table: normFilter, path: [] }]

    while (queue.length > 0) {
      const { table, path } = queue.shift()
      if (visited.has(table)) continue
      visited.add(table)

      for (const edge of (this.graph.get(table) || [])) {
        const newPath = [...path, edge]
        if (edge.targetTable === normMeasure) {
          return {
            valid:       true,
            path:        newPath,
            hasInactive: newPath.some(e => !e.isActive),
          }
        }
        if (!visited.has(edge.targetTable)) {
          queue.push({ table: edge.targetTable, path: newPath })
        }
      }
    }

    return { valid: false, path: [] }
  }

  getValidFilterTablesFor(measureTable) {
    const normMeasure = normalizeName(measureTable)
    const valid = new Set()
    for (const [table] of this.graph) {
      if (this.canFilter(table, normMeasure).valid) valid.add(table)
    }
    return [...valid]
  }
}

module.exports = { RelationshipGraph }
