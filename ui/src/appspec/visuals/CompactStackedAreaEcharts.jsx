import React from 'react'
import CompactLineEcharts from './CompactLineEcharts.jsx'

// Stacked area = area chart with `stacked` enabled in LineMarks. Uses the same
// LineMarks primitive as line/area; the wrapper just supplies stacked-area defaults
// (chartType='area', stacked=true) which the user can still override via the inspector.
export default function CompactStackedAreaEcharts({ rows, config, loading, error, groupBy }) {
  const stackedAreaConfig = {
    chartType: 'area',
    stacked:   true,
    ...config,    // user config overrides defaults — switching chartType to 'line' or stacked=false in inspector still works
  }
  return <CompactLineEcharts rows={rows} config={stackedAreaConfig} loading={loading} error={error} groupBy={groupBy} />
}
