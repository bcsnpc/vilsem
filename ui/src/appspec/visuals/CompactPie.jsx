import React from 'react'
import CompactDonutRecharts from './CompactDonutRecharts.jsx'
import CompactDonutEcharts from './CompactDonutEcharts.jsx'

// Pie = donut with innerRadius 0. Routes through the same useEchartsDonut flag
// as Donut, so flipping the master ECharts toggle covers both visuals at once.
// Default ECharts post-Phase 4 (close-out 2026-04-25); only opt-out via explicit
// localStorage 'false'.
export default function CompactPie({ rows, config, loading, error }) {
  const useEcharts = (() => { try { return localStorage.getItem('semantica.flags.useEchartsDonut') !== 'false' } catch { return true } })()
  const Component = useEcharts ? CompactDonutEcharts : CompactDonutRecharts
  return <Component rows={rows} config={{ ...config, innerRadius: 0, showCenterText: false }} loading={loading} error={error} />
}
