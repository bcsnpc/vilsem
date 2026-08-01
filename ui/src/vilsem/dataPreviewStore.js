import { useState, useEffect } from 'react'

// Pub/sub bridge: the canvas (CanvasEditor) publishes each visual's resolved DAX
// + returned rows + timing here as it fetches; the Data-preview rail pane reads
// the SELECTED visual's snapshot. This deliberately reuses already-fetched data
// instead of issuing another query — no re-query storm (429).

let snapshots = {}   // { [visualId]: { dax, rows, rowCount, elapsedMs, measures, groupBy, dimensions, type, title, error } }
const subs = new Set()

export function setPreview(visualId, snap) {
  if (!visualId) return
  snapshots = { ...snapshots, [visualId]: { ...snap } }
  subs.forEach((fn) => fn(snapshots))
}

export function clearPreviews() {
  snapshots = {}
  subs.forEach((fn) => fn(snapshots))
}

export function useDataPreview(visualId) {
  const [all, setAll] = useState(snapshots)
  useEffect(() => {
    subs.add(setAll)
    setAll(snapshots)
    return () => { subs.delete(setAll) }
  }, [])
  return visualId ? (all[visualId] || null) : null
}
