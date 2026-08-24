import React from 'react'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import EChartsCanvas from '../shared/EChartsCanvas.jsx'
import { applyTooltipConfig } from '../shared/applyTooltipConfig.js'
import getThemeTokens from '../getThemeTokens'
import { mergeFragments, PointMarks } from '../../primitives/index'
import { gridLineColor } from '../shared/palettes.js'

export default function CompactScatterEcharts({ rows, config, loading, error }) {
  const t = config._T || getThemeTokens('dark')

  if (loading) return <LoadingShimmer />
  if (error)   return <EmptyState error={error} />
  if (!rows?.length) return <EmptyState label={config.title || config.label} />

  // PointMarks reads ctx.theme.gridStroke for the splitLine color only, so we
  // override it with the user-resolved grid color (gridLinesColor + gridLinesOpacity).
  const ctx = {
    data: { fields: [], rows },
    encoding: {},
    theme: { ...t, gridStroke: gridLineColor(config, t.gridStrokeOn) },
    selection: { selectedCat: null },
    dimensions: { width: 0, height: 0 },
  }

  const option = mergeFragments([
    PointMarks({
      colorScheme:  config.colorScheme,
      dotSize:      config.dotSize      ?? 16,
      dotSizeMax:   config.dotSizeMax   ?? 100,
      fillOpacity:  config.fillOpacity  ?? 0.75,
      showGrid:     config.gridLines    ?? true,
      showXAxis:    config.showXAxis    ?? true,
      showYAxis:    config.showYAxis    ?? true,
      showLabels:   config.showLabels   ?? false,
      animEnabled:  config.animationEnabled !== false,
      xLabel:       config.measureName,
      yLabel:       config.secondaryMeasureName,
    }, ctx),
  ])

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <EChartsCanvas option={applyTooltipConfig(option, config)} />
    </div>
  )
}
