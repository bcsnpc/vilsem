import React from 'react'
import CompactScatterEcharts from './CompactScatterEcharts.jsx'

// Bubble chart = ECharts scatter with variable symbolSize driven by the 3rd measure (_val3).
// PointMarks primitive already scales symbolSize proportionally between dotSize and
// sqrt(dotSizeMax/π)*2 when _val3 varies across rows, so this wrapper only has to
// supply sensible bubble-sized defaults that the user can still override via the inspector.
export default function CompactBubbleEcharts({ rows, config, loading, error }) {
  const bubbleConfig = {
    dotSize:    8,
    dotSizeMax: 200,
    ...config,   // user config overrides defaults when set
  }
  return <CompactScatterEcharts rows={rows} config={bubbleConfig} loading={loading} error={error} />
}
