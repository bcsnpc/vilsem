import React from 'react'
import CompactLineEcharts from './CompactLineEcharts.jsx'

// Bump chart = line chart with the y-axis inverted (treats _val as a rank — rank 1
// belongs at the top). Renders y-axis values as integers since they're discrete
// rankings, and shows dots at each tick by default so individual rank positions
// are visible. This matches the existing Recharts implementation at parity (a
// single-series stylized line chart, not a true multi-series rank-tracking bump).
export default function CompactBumpChartEcharts({ rows, config, loading, error, groupBy }) {
  // Spread first, then override bump-specific keys with `??` fallbacks so a null
  // from the LLM's spec template (which emits null for unfilled fields) doesn't
  // beat the bump default. Only an explicit user value (true/false) overrides.
  const bumpConfig = {
    ...config,
    chartType: config.chartType ?? 'line',
    invertY:   config.invertY   ?? true,
    showDots:  config.showDots  ?? true,
    showYAxis: config.showYAxis ?? true,
    smooth:    config.smooth    ?? false,    // discrete ranks read more honestly with sharp polylines
  }
  return <CompactLineEcharts rows={rows} config={bumpConfig} loading={loading} error={error} groupBy={groupBy} />
}
