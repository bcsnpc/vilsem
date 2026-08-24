import React, { useMemo, useCallback } from 'react'
import { LoadingShimmer, EmptyState } from '../shared/atoms.jsx'
import EChartsCanvas from '../shared/EChartsCanvas.jsx'
import { applyTooltipConfig } from '../shared/applyTooltipConfig.js'
import getThemeTokens from '../getThemeTokens'
import { mergeFragments, LineMarks } from '../../primitives/index'
import { resolveGrain, sortRowsForAxis, formatAxisLabel } from '../shared/formatters.js'
import { gridLineColor } from '../shared/palettes.js'

export default function CompactLineEcharts({ rows, config, loading, error, groupBy }) {
  const t = config._T || getThemeTokens('dark')
  // Point click → category (x value), for click-to-drill / cross-filter.
  const handleClick = useCallback((params) => {
    const cat = params?.name
    if (config._onBarClick && cat != null) config._onBarClick(String(cat))
  }, [config._onBarClick])

  if (loading) return <LoadingShimmer />
  if (error)   return <EmptyState error={error} />
  if (!rows?.length) return <EmptyState label={config.title || config.label} />

  // Pre-process rows: figure out the date grain, sort by it, and pre-format
  // each row's _cat as a display label. The primitive treats _cat as opaque
  // strings — all grain awareness lives at the wrapper layer.
  const preparedRows = useMemo(() => {
    const grain      = resolveGrain(groupBy, rows)
    const sortedRows = sortRowsForAxis(rows, grain)
    return sortedRows.map(r => ({
      ...r,
      _cat: formatAxisLabel(r._cat, grain),
    }))
  }, [rows, groupBy])

  // LineMarks reads ctx.theme.gridStroke for the splitLine color only, so we
  // override it with the user-resolved grid color (gridLinesColor + gridLinesOpacity).
  const ctx = {
    data: { fields: [], rows: preparedRows },
    encoding: {},
    theme: { ...t, gridStroke: gridLineColor(config, t.gridStrokeOn) },
    selection: { selectedCat: null },
    dimensions: { width: 0, height: 0 },
  }

  // Resolve effective chartType — config.type='area' is the legacy spelling that
  // came through visual.type for area-charts; config.chartType wins when explicitly set.
  const effectiveChartType = config.chartType || (config.type === 'area' ? 'area' : 'line')

  const option = mergeFragments([
    LineMarks({
      colorScheme: config.colorScheme,
      chartType:   effectiveChartType,
      smooth:      config.smooth === true,    // explicit opt-in; default is sharp (matches PBI / standard analytics)
      strokeWidth: config.strokeWidth ?? 2.5,
      fillOpacity: config.fillOpacity ?? 0.28,
      showDots:    config.showDots ?? true,
      dotSize:     config.dotSize ?? 2.5,
      showDataLabels: config.dataLabels ?? false,    // hardcoded "Data labels" toggle in inspector writes here
      showGrid:    config.gridLines ?? false,
      showXAxis:   config.showXAxis ?? true,
      showYAxis:   config.showYAxis ?? false,
      invertY:     config.invertY ?? false,
      showAvgLine: config.showAvgLine ?? false,
      targetLine:  typeof config.targetLine === 'number' ? config.targetLine : null,
      animEnabled: config.animations !== false && config.animationEnabled !== false,
      prefix:      config.prefix,
      suffix:      config.suffix,
      measureName:          config.measureName,
      secondaryMeasureName: config.secondaryMeasureName,
      primaryColor:         config.primaryColor,
      secondaryColor:       config.secondaryColor,
    }, ctx),
  ])

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <EChartsCanvas option={applyTooltipConfig(option, config)} onClick={config._onBarClick ? handleClick : undefined} />
    </div>
  )
}
