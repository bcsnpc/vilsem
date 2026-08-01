import React from 'react'
import CompactBarEcharts from './CompactBarEcharts.jsx'

// Column = vertical bar. Rides the BarMarks primitive (and barMarksSchema in the
// inspector) — the only difference from `bar` is the orientation default and the
// label position (labels sit on top of vertical columns, not to the right).
// Spread config first, then override with `??` fallbacks so an explicit user
// value (e.g. flipping to horizontal) still wins, but unset/null defaults to the
// column look.
export default function CompactColumnEcharts({ rows, config, loading, error, groupBy }) {
  const columnConfig = {
    ...config,
    orientation:   config.orientation   ?? 'vertical',
    labelPosition: config.labelPosition  ?? 'top',
  }
  return <CompactBarEcharts rows={rows} config={columnConfig} loading={loading} error={error} groupBy={groupBy} />
}
